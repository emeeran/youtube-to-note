/**
 * Mock Obsidian API for testing.
 *
 * Everything the plugin imports from `obsidian` is available here BOTH on the
 * default export and as a named export. The named exports matter: production
 * modules use `import { requestUrl } from 'obsidian'`, and a default-export-only
 * mock makes those imports resolve to `undefined` under Jest.
 *
 * The vault half is a real (if tiny) in-memory filesystem:
 *
 *   MockVaultStore        — one path -> TFile/TFolder/content map, the single
 *                           source of truth
 *   MockFileSystemAdapter — the `DataAdapter` surface production uses
 *                           (exists/read/write/mkdir/rename/remove/rmdir/list/…)
 *   MockVault             — the `Vault` surface (create/createFolder/modify/
 *                           process/getAbstractFileByPath/…)
 *
 * A `MockApp` owns one store, and its `vault` and `vault.adapter` share it, so
 * a test can write with the adapter and read back through the vault (that is
 * exactly what the transcript disk cache and `ObsidianFileService` do). Every
 * method is still a `jest.fn`, so `toHaveBeenCalled*` and `mockResolvedValue`
 * keep working the way they always have.
 */

import type { DataAdapter, ListedFiles, Stat } from 'obsidian';

type PluginData = Record<string, unknown>;

/* ------------------------------------------------------------------ *
 * Shared spies (importable from specs so Notices/modals can be counted)
 * ------------------------------------------------------------------ */

const mockNotice = jest.fn();
const mockModalOpen = jest.fn();

/** Every `new Notice(...)` since the last `resetNoticeCalls()`. */
export function getNoticeCalls(): Array<{ message: string; duration?: number }> {
    return mockNotice.mock.calls.map(call => ({ message: call[0] as string, duration: call[1] as number | undefined }));
}

export function getNoticeMessages(): string[] {
    return getNoticeCalls().map(call => call.message);
}

export function resetNoticeCalls(): void {
    mockNotice.mockClear();
}

/* ------------------------------------------------------------------ *
 * Vault file tree
 * ------------------------------------------------------------------ */

export class TAbstractFile {
    vault?: unknown;
    path = '';
    name = '';
    parent: TFolder | null = null;
}

export class TFile extends TAbstractFile {
    basename = '';
    extension = '';
    stat = { ctime: 0, mtime: 0, size: 0 };
}

export class TFolder extends TAbstractFile {
    children: TAbstractFile[] = [];
    isRoot(): boolean {
        return this.path === '/';
    }
}

/**
 * Build a `TFile` the way Obsidian does: `name`/`basename`/`extension` are all
 * derived from `path`.
 */
export function createMockTFile(path: string, props: Partial<TFile> = {}): TFile {
    const file = new TFile();
    file.path = path;
    file.name = path.split('/').pop() ?? path;
    const lastDot = file.name.lastIndexOf('.');
    file.basename = lastDot > 0 ? file.name.slice(0, lastDot) : file.name;
    file.extension = lastDot > 0 ? file.name.slice(lastDot + 1) : '';
    Object.assign(file, props);
    return file;
}

/* ------------------------------------------------------------------ *
 * In-memory vault store (adapter + vault both read/write this)
 * ------------------------------------------------------------------ */

/** The `ENOENT`-flavoured error the real adapter throws for a missing path. */
function missingPath(path: string): Error {
    return new Error(`ENOENT: no such file or directory, open '${path}'`);
}

/** Millisecond timestamps the store stamps onto every entry it creates. */
function now(): number {
    return Date.now();
}

/**
 * Paths, files and folders of one mock vault.
 *
 * Behavioural notes kept deliberately close to Obsidian:
 *  - `create` refuses an existing target and requires its parent folder.
 *  - `createFolder` refuses an existing folder (ObsidianFileService depends on
 *    that throwing so its "already exists" recovery can be exercised).
 *  - `write`/`rename`/`remove` refuse a missing parent/target, like the real
 *    adapter's `ENOENT`.
 *  - `list` is non-recursive and returns vault-relative paths.
 */
export class MockVaultStore {
    readonly files = new Map<string, TFile>();
    readonly folders = new Map<string, TFolder>();
    readonly contents = new Map<string, string>();

    constructor(public basePath = '/tmp/mock-vault') {
        this.reset();
    }

    /** Drop everything, restoring just the (virtual) root folder. */
    reset(): void {
        this.files.clear();
        this.folders.clear();
        this.contents.clear();
        const root = new TFolder();
        root.path = '/';
        root.name = '';
        this.folders.set('/', root);
    }

    /** Forward slashes, no duplicate or edge slashes — `normalizePath` without the root special case. */
    static normalize(path: string): string {
        return String(path ?? '')
            .replace(/\\/g, '/')
            .replace(/\/{2,}/g, '/')
            .replace(/^\/+|\/+$/g, '');
    }

    /** Normalized path, where '' means the root. */
    static key(path: string): string {
        const normalized = MockVaultStore.normalize(path);
        return normalized === '' ? '/' : normalized;
    }

    /** The containing folder's path, or '/' for a top-level entry. */
    static parentOf(path: string): string {
        const key = MockVaultStore.key(path);
        const cut = key.lastIndexOf('/');
        return cut <= 0 ? '/' : key.slice(0, cut);
    }

    /** Name of the last segment, exactly as `TAbstractFile.name` reports it. */
    static basename(path: string): string {
        const key = MockVaultStore.key(path);
        return key === '/' ? '' : (key.split('/').pop() ?? key);
    }

    normalize(path: string): string {
        return MockVaultStore.key(path);
    }

    /** The file/folder at `path`, or null — the `getAbstractFileByPath` contract. */
    lookup(path: string): TAbstractFile | null {
        const key = MockVaultStore.key(path);
        return this.files.get(key) ?? this.folders.get(key) ?? null;
    }

    exists(path: string): boolean {
        return this.lookup(path) !== null;
    }

    /** Create every missing folder between the root and `path` (inclusive). */
    ensureFolder(path: string): TFolder {
        const key = MockVaultStore.key(path);
        const segments = key === '/' ? [] : key.split('/');
        let current = this.folders.get('/')!;

        for (let depth = 0; depth < segments.length; depth++) {
            const folderPath = segments.slice(0, depth + 1).join('/');
            const existing = this.folders.get(folderPath);
            if (existing) {
                current = existing;
                continue;
            }
            if (this.files.has(folderPath)) {
                throw new Error(`A file already exists at "${folderPath}"`);
            }
            const folder = new TFolder();
            folder.path = folderPath;
            folder.name = MockVaultStore.basename(folderPath);
            folder.parent = current;
            this.folders.set(folderPath, folder);
            current.children.push(folder);
            current = folder;
        }
        return current;
    }

    /** `vault.createFolder` — throws when the folder (or a file) is already there. */
    createFolder(path: string): TFolder {
        const key = MockVaultStore.key(path);
        const existing = this.lookup(key);
        if (existing) {
            throw new Error(
                existing instanceof TFile
                    ? `A file with the same name already exists: ${key}`
                    : 'Folder already exists.',
            );
        }
        return this.ensureFolder(key);
    }

    /** Register a file entry, linking it into its parent folder. */
    private registerFile(path: string, data: string): TFile {
        const key = MockVaultStore.key(path);
        const parent = this.ensureFolder(MockVaultStore.parentOf(key));
        const file = createMockTFile(key, { stat: { ctime: now(), mtime: now(), size: data.length } });
        file.parent = parent;
        this.files.set(key, file);
        this.contents.set(key, data);
        parent.children.push(file);
        return file;
    }

    /** `vault.create` — refuses an existing target or a missing parent folder. */
    createFile(path: string, data: string): TFile {
        const key = MockVaultStore.key(path);
        if (this.lookup(key)) {
            throw new Error(`File already exists: ${key}`);
        }
        const parentKey = MockVaultStore.parentOf(key);
        if (!this.folders.has(parentKey)) {
            throw new Error(`Folder does not exist: ${parentKey}`);
        }
        return this.registerFile(key, data);
    }

    /** `vault.modify` / adapter `write` — overwrite (or create) a file's content. */
    writeFile(path: string, data: string): TFile {
        const key = MockVaultStore.key(path);
        const existing = this.files.get(key);
        if (!existing) {
            return this.registerFile(key, data);
        }
        this.contents.set(key, data);
        existing.stat = { ...existing.stat, mtime: now(), size: data.length };
        return existing;
    }

    /** `vault.read` / adapter `read` — throws for a missing file, like the real one. */
    readFile(path: string): string {
        const key = MockVaultStore.key(path);
        const content = this.contents.get(key);
        if (content === undefined || !this.files.has(key)) {
            throw missingPath(key);
        }
        return content;
    }

    /** Append to a file, creating it when absent (the real `append` contract). */
    appendFile(path: string, data: string): TFile {
        const key = MockVaultStore.key(path);
        if (this.files.has(key)) {
            return this.writeFile(key, this.readFile(key) + data);
        }
        return this.writeFile(key, data);
    }

    /** Delete a file or an (empty, unless recursive) folder. */
    remove(path: string, recursive = false): void {
        const key = MockVaultStore.key(path);
        const file = this.files.get(key);
        if (file) {
            this.unlink(key);
            return;
        }
        const folder = this.folders.get(key);
        if (!folder) throw missingPath(key);
        if (folder.isRoot()) {
            throw new Error('Cannot delete the vault root');
        }
        const childCount = folder.children.length;
        if (childCount > 0 && !recursive) {
            throw new Error(`Folder is not empty: ${key}`);
        }
        for (const child of [...folder.children]) {
            this.remove(child.path, true);
        }
        folder.parent?.children.splice(folder.parent.children.indexOf(folder), 1);
        this.folders.delete(key);
    }

    /** Drop a file's entry, content and parent link. */
    private unlink(key: string): void {
        const file = this.files.get(key);
        if (file?.parent) {
            const at = file.parent.children.indexOf(file);
            if (at >= 0) file.parent.children.splice(at, 1);
        }
        this.files.delete(key);
        this.contents.delete(key);
    }

    /** Move a file or folder (and, for a folder, everything beneath it). */
    rename(from: string, to: string): void {
        const source = MockVaultStore.key(from);
        const target = MockVaultStore.key(to);
        if (!this.exists(source)) throw missingPath(source);
        if (this.exists(target)) throw new Error(`File or folder already exists: ${target}`);

        const entry = this.lookup(source)!;
        if (!(entry instanceof TFolder)) {
            const content = this.contents.get(source) ?? '';
            this.unlink(source);
            this.registerFile(target, content);
            return;
        }

        // A folder: snapshot its descendants (content included — the delete
        // below clears the map), delete the subtree, then rebuild it under the
        // new parent. Sorted so parents are recreated before their children.
        const descendants: Array<{ path: string; content?: string }> = [...this.folders.keys()]
            .filter(path => path.startsWith(`${source}/`))
            .sort()
            .map(path => ({ path }));
        for (const path of [...this.files.keys()].filter(path => path.startsWith(`${source}/`)).sort()) {
            descendants.push({ path, content: this.contents.get(path) });
        }

        this.remove(source, true);
        this.ensureFolder(target);
        for (const { path, content } of descendants) {
            const next = `${target}${path.slice(source.length)}`;
            if (content === undefined) this.ensureFolder(next);
            else this.registerFile(next, content);
        }
    }

    /** Non-recursive listing, paths relative to the vault root. */
    list(dir: string): ListedFiles {
        const key = MockVaultStore.key(dir);
        const folder = this.folders.get(key);
        if (!folder) throw missingPath(key);

        const files: string[] = [];
        const folders: string[] = [];
        for (const child of folder.children) {
            if (child instanceof TFile) files.push(child.path);
            else folders.push(child.path);
        }
        return { files: files.sort(), folders: folders.sort() };
    }

    /** `adapter.stat` — null for a missing path, `type` set for files and folders. */
    stat(path: string): Stat | null {
        const key = MockVaultStore.key(path);
        const file = this.files.get(key);
        if (file) {
            return { type: 'file', ctime: file.stat.ctime, mtime: file.stat.mtime, size: file.stat.size };
        }
        const folder = this.folders.get(key);
        if (!folder) return null;
        return { type: 'folder', ctime: 0, mtime: 0, size: 0 };
    }

    /** Every file path currently in the store — handy for assertions. */
    allFilePaths(): string[] {
        return [...this.files.keys()].sort();
    }

    /** Every folder path currently in the store, root excluded. */
    allFolders(): string[] {
        return [...this.folders.keys()].filter(path => path !== '/').sort();
    }

    /** Seed a file (and any missing parent folders) without fighting the guards. */
    seed(path: string, data = ''): TFile {
        this.ensureFolder(MockVaultStore.parentOf(MockVaultStore.key(path)));
        return this.writeFile(path, data);
    }
}

/* ------------------------------------------------------------------ *
 * FileSystemAdapter (DataAdapter backed by the store)
 * ------------------------------------------------------------------ */

/**
 * Stand-in for Obsidian's desktop `FileSystemAdapter`.
 *
 * The surface is the one production actually touches: the transcript disk cache
 * uses `exists`/`read`/`write`/`mkdir`/`rename`/`remove`/`rmdir`/`list`/
 * `getBasePath`, while `TranscriptDiskCache` treats a throwing or empty
 * `getBasePath()` as "no filesystem" (mobile/web). Implementing the full
 * `DataAdapter` interface keeps the mock honest if that surface grows.
 */
export class MockFileSystemAdapter implements DataAdapter {
    configDir = '.obsidian';

    constructor(readonly store: MockVaultStore = new MockVaultStore()) {}

    /* -- identity -------------------------------------------------- */

    getName = jest.fn((): string => 'MockFileSystemAdapter');
    getBasePath = jest.fn((): string => this.store.basePath);
    getVaultConfigDir = jest.fn((): string => this.configDir);
    getFullPath = jest.fn((path: string): string => `${this.store.basePath}/${MockVaultStore.normalize(path)}`);
    getResourcePath = jest.fn((path: string): string => `app://mock/${MockVaultStore.normalize(path)}`);
    getFilePath = jest.fn((path: string): string => `${this.store.basePath}/${MockVaultStore.normalize(path)}`);

    /* -- reads ----------------------------------------------------- */

    exists = jest.fn(async (path: string): Promise<boolean> => this.store.exists(path));
    stat = jest.fn(async (path: string): Promise<Stat | null> => this.store.stat(path));
    list = jest.fn(async (path: string): Promise<ListedFiles> => this.store.list(path));
    read = jest.fn(async (path: string): Promise<string> => this.store.readFile(path));
    readBinary = jest.fn(async (path: string): Promise<ArrayBuffer> => {
        const text = this.store.readFile(path);
        return new TextEncoder().encode(text).buffer as ArrayBuffer;
    });

    /* -- writes ---------------------------------------------------- */

    write = jest.fn(async (path: string, data: string): Promise<void> => {
        this.requireParent(path);
        this.store.writeFile(path, data);
    });
    writeBinary = jest.fn(async (path: string, data: ArrayBuffer): Promise<void> => {
        this.requireParent(path);
        this.store.writeFile(path, new TextDecoder().decode(new Uint8Array(data)));
    });
    append = jest.fn(async (path: string, data: string): Promise<void> => {
        this.requireParent(path);
        this.store.appendFile(path, data);
    });
    process = jest.fn(async (path: string, fn: (data: string) => string): Promise<string> => {
        const updated = fn(this.store.readFile(path));
        this.store.writeFile(path, updated);
        return updated;
    });
    mkdir = jest.fn(async (path: string): Promise<void> => {
        this.store.ensureFolder(path);
    });
    remove = jest.fn(async (path: string): Promise<void> => {
        this.store.remove(path);
    });
    rmdir = jest.fn(async (path: string, recursive: boolean): Promise<void> => {
        this.store.remove(path, recursive);
    });
    rename = jest.fn(async (from: string, to: string): Promise<void> => {
        this.store.rename(from, to);
    });
    copy = jest.fn(async (from: string, to: string): Promise<void> => {
        this.requireParent(to);
        this.store.writeFile(to, this.store.readFile(from));
    });
    trashSystem = jest.fn(async (_path: string): Promise<boolean> => false);
    trashLocal = jest.fn(async (path: string): Promise<void> => {
        const key = MockVaultStore.key(path);
        const name = MockVaultStore.basename(key);
        this.store.ensureFolder('.trash');
        this.store.rename(key, `.trash/${name}`);
    });

    /** `write`/`append`/`copy` need somewhere to land, like the real adapter. */
    private requireParent(path: string): void {
        const parent = MockVaultStore.parentOf(path);
        if (parent !== '/' && !this.store.exists(parent)) {
            throw missingPath(parent);
        }
    }
}

/** Back-compat alias: the mock's adapter stands in for `obsidian.FileSystemAdapter`. */
export const FileSystemAdapter = MockFileSystemAdapter;

/* ------------------------------------------------------------------ *
 * Vault (the high-level API, same store as the adapter)
 * ------------------------------------------------------------------ */

/** `Vault` backed by {@link MockVaultStore}, with its adapter sharing that store. */
export class MockVault {
    readonly store: MockVaultStore;
    readonly adapter: MockFileSystemAdapter;

    constructor(store: MockVaultStore = new MockVaultStore()) {
        this.store = store;
        this.adapter = new MockFileSystemAdapter(store);
    }

    getName = jest.fn((): string => 'MockVault');
    getRoot = jest.fn((): TFolder => this.store.ensureFolder('/'));
    getAbstractFileByPath = jest.fn((path: string): TAbstractFile | null => this.store.lookup(path));
    getFileByPath = jest.fn((path: string): TFile | null => {
        const entry = this.store.lookup(path);
        return entry instanceof TFile ? entry : null;
    });
    getFolderByPath = jest.fn((path: string): TFolder | null => {
        const entry = this.store.lookup(path);
        return entry instanceof TFolder ? entry : null;
    });
    getAllLoadedFiles = jest.fn((): TAbstractFile[] => [...this.store.files.values(), ...this.store.folders.values()]);
    getAllFolders = jest.fn((): TFolder[] => [...this.store.folders.values()].filter(folder => !folder.isRoot()));

    create = jest.fn(async (path: string, data: string): Promise<TFile> => this.store.createFile(path, data));
    createBinary = jest.fn(async (path: string, data: ArrayBuffer): Promise<TFile> => {
        const file = this.store.createFile(path, '');
        this.store.writeFile(path, new TextDecoder().decode(new Uint8Array(data)));
        return file;
    });
    createFolder = jest.fn(async (path: string): Promise<TFolder> => this.store.createFolder(path));
    read = jest.fn(async (file: TFile): Promise<string> => this.store.readFile(file.path));
    cachedRead = jest.fn(async (file: TFile): Promise<string> => this.store.readFile(file.path));
    readBinary = jest.fn(
        async (file: TFile): Promise<ArrayBuffer> =>
            new TextEncoder().encode(this.store.readFile(file.path)).buffer as ArrayBuffer,
    );
    getResourcePath = jest.fn((file: TFile): string => `app://mock/${file.path}`);

    delete = jest.fn(async (file: TAbstractFile, _force?: boolean): Promise<void> => {
        this.store.remove(file.path, true);
    });
    trash = jest.fn(async (file: TAbstractFile, _system: boolean): Promise<void> => {
        this.store.remove(file.path, true);
    });
    rename = jest.fn(async (file: TAbstractFile, newPath: string): Promise<void> => {
        this.store.rename(file.path, newPath);
    });

    modify = jest.fn(async (file: TFile, data: string): Promise<void> => {
        this.store.writeFile(file.path, data);
    });
    modifyBinary = jest.fn(async (file: TFile, data: ArrayBuffer): Promise<void> => {
        this.store.writeFile(file.path, new TextDecoder().decode(new Uint8Array(data)));
    });
    append = jest.fn(async (file: TFile, data: string): Promise<void> => {
        this.store.appendFile(file.path, data);
    });
    process = jest.fn(async (file: TFile, fn: (data: string) => string): Promise<string> => {
        const updated = fn(this.store.readFile(file.path));
        this.store.writeFile(file.path, updated);
        return updated;
    });

    /** Recorded `vault.on` subscriptions — a spec can invoke their callbacks. */
    events: Record<string, Array<(data: unknown) => unknown>> = {};
    on = jest.fn((name: string, callback: (data: unknown) => unknown): (() => void) => {
        this.events[name] = [...(this.events[name] ?? []), callback];
        return () => {
            this.events[name] = (this.events[name] ?? []).filter(listener => listener !== callback);
        };
    });

    /** Test helper: fire a vault event at every registered listener. */
    emit(name: string, data: unknown): void {
        for (const listener of this.events[name] ?? []) listener(data);
    }

    /** Test helper: seed the store so a file exists before the code runs. */
    seed(path: string, data = ''): TFile {
        return this.store.seed(path, data);
    }
}

/* ------------------------------------------------------------------ *
 * App
 * ------------------------------------------------------------------ */

export class MockApp {
    plugins = {
        getPlugin: jest.fn(),
    };
    vault: MockVault = new MockVault();
    /** Convenience handle — the same adapter `vault.adapter` exposes. */
    adapter: MockFileSystemAdapter = this.vault.adapter;
    /** Unused by the plugin itself; kept for parity with the real `App`. */
    getConfig = jest.fn((_key: string): string | undefined => undefined);
    workspace = {
        activeLeaf: null,
        getLeaf: jest.fn(),
        splitActiveLeaf: jest.fn(),
        getActiveFile: jest.fn(),
        setActiveLeaf: jest.fn(),
        trigger: jest.fn(),
        on: jest.fn(),
    };
    metadataCache = {
        on: jest.fn(),
        off: jest.fn(),
        getCache: jest.fn(),
    };
    lastEvent?: unknown;
}

/** Alias so specs read naturally: `new App()` matches the Obsidian name. */
export const App = MockApp;

/* ------------------------------------------------------------------ *
 * Plugin base class
 * ------------------------------------------------------------------ */

export interface MockManifest {
    id: string;
    name: string;
    version: string;
    dir: string;
    author?: string;
    description?: string;
    minAppVersion?: string;
}

/**
 * Constructible stand-in for Obsidian's `Plugin`.
 *
 * `loadData` / `saveData` are backed by an in-memory object so history/settings
 * round-trips can be exercised without a vault. Registration methods record
 * their arguments (jest.fn) so a spec can assert on what was registered.
 */
export class Plugin {
    app: MockApp;
    manifest: MockManifest;
    /** Registered by id — lets a spec invoke a command's callback directly. */
    commands: Record<string, { id: string; name: string; callback?: () => unknown }> = {};
    ribbonIcons: Array<{ icon: string; title: string; el: HTMLElement }> = [];
    registeredEvents: unknown[] = [];
    protocolHandlers: Record<string, (params: Record<string, string>) => unknown> = {};
    settingTabs: unknown[] = [];
    intervals: number[] = [];

    private data: PluginData = {};

    constructor(app: MockApp = new MockApp(), manifest: Partial<MockManifest> = {}) {
        this.app = app;
        this.manifest = {
            id: 'youtube-to-note',
            name: 'YouTube to Note',
            version: '2.0.0',
            dir: '.obsidian/plugins/youtube-to-note',
            ...manifest,
        };
    }

    addCommand = jest.fn((command: { id: string; name: string; callback?: () => unknown }) => {
        this.commands[command.id] = command;
        return command;
    });

    addRibbonIcon = jest.fn((icon: string, title: string, callback: () => unknown) => {
        const el = document.createElement('div');
        el.className = 'side-dock-ribbon-action';
        el.addEventListener('click', () => callback());
        const entry = { icon, title, el };
        this.ribbonIcons.push(entry);
        return entry;
    });

    addSettingTab = jest.fn((tab: unknown) => {
        this.settingTabs.push(tab);
        return tab;
    });

    registerEvent = jest.fn((eventRef: unknown) => {
        this.registeredEvents.push(eventRef);
        return eventRef;
    });

    registerDomEvent = jest.fn(
        (element: EventTarget, type: string, listener: EventListener, options?: AddEventListenerOptions) => {
            element.addEventListener(type, listener, options);
            return { w: element, t: type, l: listener, o: options };
        },
    );

    registerObsidianProtocolHandler = jest.fn(
        (action: string, handler: (params: Record<string, string>) => unknown) => {
            this.protocolHandlers[action] = handler;
        },
    );

    registerInterval = jest.fn((id: number) => {
        this.intervals.push(id);
        return id;
    });

    /** Obsidian returns `null` for a plugin with no data file yet. */
    async loadData(): Promise<PluginData | null> {
        if (Object.keys(this.data).length === 0) return null;
        return JSON.parse(JSON.stringify(this.data)) as PluginData;
    }

    async saveData(data: PluginData): Promise<void> {
        this.data = JSON.parse(JSON.stringify(data)) as PluginData;
    }

    /** Test helper: seed the in-memory data.json. */
    setData(data: PluginData): void {
        this.data = JSON.parse(JSON.stringify(data)) as PluginData;
    }
}

export const MockPlugin = Plugin;

/* ------------------------------------------------------------------ *
 * UI primitives
 * ------------------------------------------------------------------ */

export class MockModal {
    app: MockApp;
    containerEl: HTMLElement;
    modalEl: HTMLElement;
    contentEl: HTMLElement;
    titleEl: HTMLElement;
    shouldRestoreSelection = true;
    onOpen: () => void = () => {};
    onClose: () => void = () => {};

    constructor(app?: MockApp) {
        this.app = app ?? new MockApp();
        this.containerEl = document.createElement('div');
        this.modalEl = document.createElement('div');
        this.contentEl = document.createElement('div');
        this.titleEl = document.createElement('div');
        this.containerEl.className = 'modal-container';
        this.modalEl.className = 'modal';
        this.containerEl.appendChild(this.modalEl);
        this.modalEl.appendChild(this.titleEl);
        this.modalEl.appendChild(this.contentEl);
    }

    open(): void {
        mockModalOpen(this);
        if (typeof document !== 'undefined') {
            document.body.appendChild(this.containerEl);
        }
        this.onOpen();
    }

    close(): void {
        this.containerEl.remove();
        this.onClose();
    }
}

/** Back-compat alias for the original mock export. */
export const Modal = MockModal;

export class MockPluginSettingTab {
    display = jest.fn();
}

export const PluginSettingTab = MockPluginSettingTab;

/** A single entry recorded by the mocked {@link MockMenu}. */
export interface MockMenuItem {
    title?: string;
    icon?: string;
    section?: string;
    disabled?: boolean;
    onClick?: () => unknown;
}

export class MockMenu {
    items: MockMenuItem[] = [];

    addItem = jest.fn((cb: (item: MockMenuItemShim) => unknown) => {
        const item = new MockMenuItemShim();
        cb(item);
        this.items.push(item.toItem());
        return this;
    });

    addSeparator = jest.fn(() => this);

    showAtPosition = jest.fn((_position: unknown, _doc?: Document) => this);
    hide = jest.fn(() => this);
    close = jest.fn(() => this);
    setNoIcon = jest.fn(() => this);
}

/** Fluent builder handed to `Menu.addItem` callbacks. */
export class MockMenuItemShim {
    private item: MockMenuItem = {};

    setTitle(title: string | DocumentFragment): this {
        this.item.title = String(title);
        return this;
    }
    setIcon(icon: string): this {
        this.item.icon = icon;
        return this;
    }
    setSection(section: string): this {
        this.item.section = section;
        return this;
    }
    setDisabled(disabled: boolean): this {
        this.item.disabled = disabled;
        return this;
    }
    onClick(cb: () => unknown): this {
        this.item.onClick = cb;
        return this;
    }
    toItem(): MockMenuItem {
        return { ...this.item };
    }
}

export const Menu = MockMenu;

export class MockNotice {
    constructor(
        public message: string,
        public duration?: number,
    ) {
        mockNotice(message, duration);
    }
    hide(): void {}
    setMessage(message: string | DocumentFragment): this {
        this.message = String(message);
        mockNotice(this.message, this.duration);
        return this;
    }
}

export const Notice = MockNotice;

export class MockTextFieldComponent {
    inputEl: HTMLInputElement;
    constructor() {
        this.inputEl = document.createElement('input');
    }
    setValue = jest.fn().mockReturnThis();
    getValue = jest.fn().mockReturnValue('');
    setPlaceholder = jest.fn().mockReturnThis();
    onChange = jest.fn().mockReturnThis();
}

export const TextComponent = MockTextFieldComponent;

export class MockButtonComponent {
    buttonEl: HTMLButtonElement;
    constructor() {
        this.buttonEl = document.createElement('button');
    }
    setButtonText = jest.fn().mockReturnThis();
    setDisabled = jest.fn().mockReturnThis();
    setTooltip = jest.fn().mockReturnThis();
    onClick = jest.fn().mockReturnThis();
    setClass = jest.fn().mockReturnThis();
    setCta = jest.fn().mockReturnThis();
}

export const ButtonComponent = MockButtonComponent;

export class MockSetting {
    constructor(public containerEl?: HTMLElement) {}
    setName = jest.fn().mockReturnThis();
    setDesc = jest.fn().mockReturnThis();
    setClass = jest.fn().mockReturnThis();
    addText = jest.fn().mockReturnValue(new MockTextFieldComponent());
    addButton = jest.fn().mockReturnValue(new MockButtonComponent());
    addToggle = jest.fn().mockReturnThis();
    addDropdown = jest.fn().mockReturnThis();
    addSlider = jest.fn().mockReturnThis();
    addExtraButton = jest.fn().mockReturnThis();
    addTextArea = jest.fn().mockReturnThis();
}

export const Setting = MockSetting;

export class MockMomentFormatComponent {
    setDefaultFormat = jest.fn().mockReturnThis();
    setSampleEl = jest.fn().mockReturnThis();
    setValue = jest.fn().mockReturnThis();
    getValue = jest.fn().mockReturnValue('');
}

export const MomentFormatComponent = MockMomentFormatComponent;

export class MockToggleComponent {
    toggleEl: HTMLInputElement;
    constructor() {
        this.toggleEl = document.createElement('input');
        this.toggleEl.type = 'checkbox';
    }
    setValue = jest.fn().mockReturnThis();
    getValue = jest.fn().mockReturnValue(false);
    onChange = jest.fn().mockReturnThis();
}

export const ToggleComponent = MockToggleComponent;

export class MockDropdownComponent {
    selectEl: HTMLSelectElement;
    constructor() {
        this.selectEl = document.createElement('select');
    }
    addOption = jest.fn().mockReturnThis();
    setValue = jest.fn().mockReturnThis();
    getValue = jest.fn().mockReturnValue('');
    onChange = jest.fn().mockReturnThis();
}

export const DropdownComponent = MockDropdownComponent;

/* ------------------------------------------------------------------ *
 * Misc API surface
 * ------------------------------------------------------------------ */

export const Platform = {
    isDesktop: true,
    isMobile: false,
    isDesktopApp: true,
    isMobileApp: false,
    isMacOS: false,
    isWindows: true,
    isLinux: false,
    isIosApp: false,
    isAndroidApp: false,
    isIos: false,
    isAndroid: false,
};

/** Obsidian's `requestUrl` — stubbed per-test. */
export const requestUrl = jest.fn();

/** Obsidian's path normalizer: forward slashes, no leading/trailing slash. */
export const normalizePath = (path: string): string => {
    const normalized = String(path ?? '')
        .replace(/([\\/])+/g, '/')
        .replace(/(^\/+|\/+$)/g, '');
    return normalized === '' ? '/' : normalized;
};

export const addIcon = jest.fn();

export const htmlToMarkdown = jest.fn((html: string) => html);

export const setIcon = jest.fn();

/**
 * `debounce` with the Obsidian shape (callable + `cancel()` / `run()`).
 *
 * Honors `resetTimer`: with it set, every call pushes the deadline back;
 * without it, the first call fixes the deadline and later calls are folded in.
 */
export const debounce = <T extends unknown[], V>(
    cb: (...args: T) => V,
    timeout = 0,
    resetTimer = false,
): ((...args: T) => V | undefined) & { cancel: () => void; run: () => V | undefined } => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastResult: V | undefined;
    let pendingArgs: T | undefined;

    const fire = (): void => {
        timer = null;
        if (pendingArgs) {
            lastResult = cb(...pendingArgs);
            pendingArgs = undefined;
        }
    };

    const debounced = (...args: T): V | undefined => {
        if (timer === null || resetTimer) {
            if (timer !== null) clearTimeout(timer);
            timer = setTimeout(fire, timeout);
            pendingArgs = args;
        } else {
            pendingArgs = args;
        }
        return lastResult;
    };

    debounced.cancel = () => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        pendingArgs = undefined;
    };

    debounced.run = () => {
        const args = pendingArgs;
        debounced.cancel();
        lastResult = cb(...((args ?? []) as unknown as T));
        return lastResult;
    };

    return debounced;
};

export const moment = require('moment');

/* ------------------------------------------------------------------ *
 * Default export (kept for the specs that import the whole module)
 * ------------------------------------------------------------------ */

const mockObsidian = {
    Notice: MockNotice,
    Modal: MockModal,
    Plugin,
    PluginSettingTab: MockPluginSettingTab,
    Setting: MockSetting,
    TextComponent: MockTextFieldComponent,
    ButtonComponent: MockButtonComponent,
    ToggleComponent: MockToggleComponent,
    DropdownComponent: MockDropdownComponent,
    MomentFormatComponent: MockMomentFormatComponent,
    Menu: MockMenu,
    TAbstractFile,
    TFile,
    TFolder,
    FileSystemAdapter,
    MockFileSystemAdapter,
    MockVault,
    MockVaultStore,
    Platform,
    requestUrl,
    normalizePath,
    addIcon,
    htmlToMarkdown,
    setIcon,
    debounce,
    moment,
};

export default mockObsidian;

export { mockNotice, mockModalOpen };
