/**
 * Mock Obsidian API for testing.
 *
 * Everything the plugin imports from `obsidian` is available here BOTH on the
 * default export and as a named export. The named exports matter: production
 * modules use `import { requestUrl } from 'obsidian'`, and a default-export-only
 * mock makes those imports resolve to `undefined` under Jest.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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
 * App
 * ------------------------------------------------------------------ */

export class MockApp {
    plugins = {
        getPlugin: jest.fn(),
    };
    vault = {
        create: jest.fn(),
        read: jest.fn(),
        delete: jest.fn(),
        append: jest.fn(),
        modify: jest.fn(),
        getAbstractFileByPath: jest.fn(),
        getConfig: jest.fn(),
        on: jest.fn(),
    };
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

/** Minimal `FileSystemAdapter` stand-in (transcript cache reads its basePath). */
export class FileSystemAdapter {
    basePath = '/tmp/mock-vault';
    configDir = '.obsidian';
    getFullPath(path: string): string {
        return `${this.basePath}/${path}`;
    }
    getVaultConfigDir(): string {
        return this.configDir;
    }
}

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
