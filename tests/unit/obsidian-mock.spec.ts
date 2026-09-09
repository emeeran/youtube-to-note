/**
 * Contract tests for the Obsidian API mock (`tests/__mocks__/obsidian.ts`).
 *
 * The mock is the single biggest coverage enabler in this repo: production
 * modules import `obsidian` symbols BY NAME, so anything missing there shows up
 * as a runtime `undefined is not a function` instead of a missing test. These
 * specs pin the surface the plugin actually relies on.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
// Imported by path: TypeScript resolves "obsidian" to the real typings (where
// `Plugin` is abstract and the mock's helpers do not exist), while Jest maps the
// same specifier onto this mock. The mapping itself is asserted below.
import * as mockObsidian from '../__mocks__/obsidian';
const {
    Menu,
    MockApp,
    MockFileSystemAdapter,
    MockVault,
    MockVaultStore,
    Notice,
    Platform,
    Plugin,
    PluginSettingTab,
    Setting,
    TAbstractFile,
    TFile,
    TFolder,
    Modal,
    addIcon,
    createMockTFile,
    debounce,
    getNoticeCalls,
    normalizePath,
    requestUrl,
    resetNoticeCalls,
} = mockObsidian;

describe('obsidian mock — named exports', () => {
    it('exposes requestUrl as a named export (production imports it by name)', () => {
        expect(typeof requestUrl).toBe('function');
    });

    it('is the module Jest hands out for the "obsidian" specifier, named exports included', async () => {
        // src/services/youtube-page.ts does `import { requestUrl } from 'obsidian'`.
        // A default-export-only mock makes that an undefined runtime value.
        const mapped = (await import('obsidian')) as unknown as Record<string, unknown>;
        const byPath = mockObsidian as unknown as Record<string, unknown>;
        const required = [
            'Notice',
            'Plugin',
            'Modal',
            'PluginSettingTab',
            'Setting',
            'Menu',
            'TAbstractFile',
            'TFile',
            'TFolder',
            'FileSystemAdapter',
            'MockFileSystemAdapter',
            'MockVault',
            'MockVaultStore',
            'Platform',
            'requestUrl',
            'normalizePath',
            'addIcon',
            'debounce',
        ];
        const missing = required.filter(key => typeof mapped[key] === 'undefined');
        expect(missing).toEqual([]);

        // The named surface must be the SAME objects as the mock's, not copies.
        for (const key of required) {
            expect(mapped[key]).toBe(byPath[key]);
        }
    });
});

describe('obsidian mock — normalizePath', () => {
    it('normalizes separators, duplicates and edge slashes', () => {
        expect(normalizePath('YouTube/Notes/Video.md')).toBe('YouTube/Notes/Video.md');
        expect(normalizePath('/YouTube//Notes/')).toBe('YouTube/Notes');
        expect(normalizePath('YouTube\\Notes')).toBe('YouTube/Notes');
        expect(normalizePath('')).toBe('/');
    });
});

describe('obsidian mock — Plugin base class', () => {
    it('is constructible with an app and a manifest carrying version + dir', () => {
        const plugin = new Plugin(new MockApp(), { version: '9.9.9', dir: '.obsidian/plugins/x' });
        expect(plugin.manifest.version).toBe('9.9.9');
        expect(plugin.manifest.dir).toBe('.obsidian/plugins/x');
        expect(plugin.manifest.id).toBe('youtube-to-note');
    });

    it('defaults the app so tests can construct it bare', () => {
        expect(new Plugin().app).toBeInstanceOf(MockApp);
    });

    it('returns null from loadData before anything is saved', async () => {
        expect(await new Plugin().loadData()).toBeNull();
    });

    it('round-trips saveData -> loadData without sharing references', async () => {
        const plugin = new Plugin();
        await plugin.saveData({ settings: { outputPath: 'YouTube' }, history: [1, 2] });

        const loaded = (await plugin.loadData()) as Record<string, unknown>;
        expect(loaded).toEqual({ settings: { outputPath: 'YouTube' }, history: [1, 2] });

        (loaded.settings as Record<string, unknown>).outputPath = 'mutated';
        (loaded.history as number[]).push(3);

        expect(await plugin.loadData()).toEqual({ settings: { outputPath: 'YouTube' }, history: [1, 2] });
    });

    it('seeds data.json from a test helper', async () => {
        const plugin = new Plugin();
        plugin.setData({ ytc: true });
        expect(await plugin.loadData()).toEqual({ ytc: true });
    });

    it('records commands, ribbon icons, events, protocol handlers and intervals', () => {
        const plugin = new Plugin();
        const callback = () => undefined;

        plugin.addCommand({ id: 'process', name: 'Process', callback });
        const ribbon = plugin.addRibbonIcon('youtube', 'Process', callback);
        const eventRef = plugin.registerEvent({ id: 1 });
        plugin.registerObsidianProtocolHandler('youtube-clipper', callback as never);
        plugin.registerInterval(42);
        plugin.addSettingTab(new PluginSettingTab());

        expect(plugin.commands.process).toMatchObject({ id: 'process', name: 'Process' });
        expect(plugin.ribbonIcons).toHaveLength(1);
        expect(ribbon.el.className).toContain('side-dock-ribbon-action');
        expect(plugin.registeredEvents).toHaveLength(1);
        expect(eventRef).toEqual({ id: 1 });
        expect(plugin.protocolHandlers['youtube-clipper']).toBeDefined();
        expect(plugin.intervals).toEqual([42]);
        expect(plugin.settingTabs).toHaveLength(1);
    });
});

describe('obsidian mock — vault file classes', () => {
    it('derives name, basename and extension from the path', () => {
        const file = createMockTFile('YouTube/Notes/My Video.md', { stat: { ctime: 1, mtime: 2, size: 3 } });
        expect(file).toBeInstanceOf(TAbstractFile);
        expect(file).toBeInstanceOf(TFile);
        expect(file.path).toBe('YouTube/Notes/My Video.md');
        expect(file.name).toBe('My Video.md');
        expect(file.basename).toBe('My Video');
        expect(file.extension).toBe('md');
        expect(file.stat).toEqual({ ctime: 1, mtime: 2, size: 3 });
    });

    it('handles files without an extension', () => {
        const file = createMockTFile('folder/README');
        expect(file.basename).toBe('README');
        expect(file.extension).toBe('');
    });

    it('gives folders children and a root check', () => {
        const folder = new TFolder();
        folder.path = 'YouTube';
        folder.children = [createMockTFile('YouTube/a.md')];
        expect(folder.isRoot()).toBe(false);
        expect(folder.children).toHaveLength(1);
        const root = new TFolder();
        root.path = '/';
        expect(root.isRoot()).toBe(true);
    });
});

describe('obsidian mock — in-memory vault (adapter + vault over one store)', () => {
    /** A fresh app per test: every `MockApp` owns exactly one store. */
    function makeApp() {
        const app = new MockApp();
        return { app, vault: app.vault, adapter: app.vault.adapter, store: app.vault.store };
    }

    it('gives the vault and its adapter the same store, so writes are visible both ways', async () => {
        const { app, vault, adapter, store } = makeApp();
        expect(app.adapter).toBe(adapter);
        expect(adapter.store).toBe(store);
        expect(vault.store).toBe(store);

        await adapter.mkdir('folder');
        await adapter.write('folder/note.md', 'via adapter');
        expect(vault.getAbstractFileByPath('folder/note.md')).toBeInstanceOf(TFile);

        await vault.create('folder/other.md', 'via vault');
        expect(await adapter.exists('folder/other.md')).toBe(true);
    });

    it('round-trips create / read / modify / append / process through the vault', async () => {
        const { vault } = makeApp();
        await vault.createFolder('YouTube/Notes');
        const file = await vault.create('YouTube/Notes/note.md', 'first');

        expect(await vault.read(file)).toBe('first');
        expect(vault.cachedRead(file)).resolves.toBe('first');

        await vault.modify(file, 'second');
        expect(await vault.read(file)).toBe('second');

        await vault.append(file, '+third');
        expect(await vault.read(file)).toBe('second+third');

        const processed = await vault.process(file, data => data.toUpperCase());
        expect(processed).toBe('SECOND+THIRD');
        expect(await vault.read(file)).toBe('SECOND+THIRD');
        // mtime moved on with the content.
        expect(file.stat.size).toBe('SECOND+THIRD'.length);
    });

    it('surfaces the DataAdapter methods the transcript disk cache uses', async () => {
        const { adapter, store } = makeApp();
        await adapter.mkdir('.obsidian/plugins/youtube-to-note/cache/transcripts');

        await adapter.write('.obsidian/plugins/youtube-to-note/cache/transcripts/abc.def.ghij.json', '{"savedAt":1}');
        expect(await adapter.exists('.obsidian/plugins/youtube-to-note/cache/transcripts')).toBe(true);
        expect(await adapter.read('.obsidian/plugins/youtube-to-note/cache/transcripts/abc.def.ghij.json')).toBe(
            '{"savedAt":1}',
        );

        const listing = await adapter.list('.obsidian/plugins/youtube-to-note/cache/transcripts');
        expect(listing.files).toEqual(['.obsidian/plugins/youtube-to-note/cache/transcripts/abc.def.ghij.json']);
        expect(listing.folders).toEqual([]);

        await adapter.rename(
            '.obsidian/plugins/youtube-to-note/cache/transcripts/abc.def.ghij.json',
            '.obsidian/plugins/youtube-to-note/cache/transcripts/abc.def.ghij.json.tmp-1-2',
        );
        await adapter.remove('.obsidian/plugins/youtube-to-note/cache/transcripts/abc.def.ghij.json.tmp-1-2');
        expect(store.allFilePaths()).toEqual([]);

        // Recursive delete takes the children with it.
        await adapter.mkdir('a/b');
        await adapter.write('a/b/note.md', 'x');
        await adapter.rmdir('a', true);
        expect(await adapter.exists('a')).toBe(false);
    });

    it('refuses the writes the real vault refuses', async () => {
        const { vault, adapter } = makeApp();

        await expect(vault.create('YouTube/note.md', 'x')).rejects.toThrow(/Folder does not exist/);
        await vault.createFolder('YouTube');
        await expect(vault.create('YouTube/note.md', 'x')).resolves.toBeDefined();
        await expect(vault.create('YouTube/note.md', 'x')).rejects.toThrow(/File already exists/);
        await expect(vault.createFolder('YouTube')).rejects.toThrow(/Folder already exists/);
        await expect(vault.createFolder('YouTube/note.md')).rejects.toThrow(/file with the same name/i);

        await expect(adapter.read('missing.md')).rejects.toThrow(/ENOENT/);
        await expect(adapter.write('missing-folder/note.md', 'x')).rejects.toThrow(/ENOENT/);

        const created = vault.getFileByPath('YouTube/note.md');
        expect(created).not.toBeNull();
        expect(vault.read(created!)).resolves.toBe('x');
    });

    it('replaces the cache entry when a write lands on an existing file', async () => {
        const { adapter } = makeApp();
        await adapter.mkdir('cache');
        await adapter.write('cache/note.md', 'old');
        await adapter.write('cache/note.md', 'new');

        expect(await adapter.read('cache/note.md')).toBe('new');
    });

    it('renames a folder together with everything beneath it', async () => {
        const { vault, store } = makeApp();
        await vault.createFolder('old/nested');
        await vault.create('old/nested/a.md', 'A');
        await vault.create('old/b.md', 'B');

        await vault.rename(vault.getFolderByPath('old')!, 'new');

        expect(store.allFilePaths()).toEqual(['new/b.md', 'new/nested/a.md']);
        expect(await vault.read(vault.getFileByPath('new/nested/a.md')!)).toBe('A');
    });

    it('reports a non-empty basePath, which is how the transcript cache detects a desktop vault', () => {
        const { adapter, vault } = makeApp();
        expect(adapter.getBasePath()).toBe('/tmp/mock-vault');
        expect(adapter.getName()).toBe('MockFileSystemAdapter');
        expect(vault.getName()).toBe('MockVault');
        expect(adapter.getFullPath('a/b.md')).toBe('/tmp/mock-vault/a/b.md');
        expect(adapter.getVaultConfigDir()).toBe('.obsidian');
    });

    it('returns null from the path lookups for anything missing, and the entry otherwise', () => {
        const { vault } = makeApp();
        const file = vault.seed('YouTube/note.md', 'x');

        expect(vault.getAbstractFileByPath('YouTube/note.md')).toBe(file);
        expect(vault.getFileByPath('YouTube/note.md')).toBe(file);
        expect(vault.getFolderByPath('YouTube/note.md')).toBeNull();
        expect(vault.getFolderByPath('YouTube')).toBeInstanceOf(TFolder);
        expect(vault.getFileByPath('YouTube')).toBeNull();
        expect(vault.getAbstractFileByPath('nope')).toBeNull();
        expect(vault.getAbstractFileByPath('/')).toBeInstanceOf(TFolder);
        expect(vault.getAllFolders().map(folder => folder.path)).toEqual(['YouTube']);
    });

    it('records vault event subscriptions so a spec can fire them', () => {
        const { vault } = makeApp();
        const onCreate = jest.fn();
        const unsubscribe = vault.on('create', onCreate);

        vault.emit('create', { path: 'a.md' });
        expect(onCreate).toHaveBeenCalledWith({ path: 'a.md' });

        unsubscribe();
        vault.emit('create', { path: 'b.md' });
        expect(onCreate).toHaveBeenCalledTimes(1);
    });

    it('is constructible standalone, so a spec can build a second vault', () => {
        const vault = new MockVault(new MockVaultStore('/tmp/other-vault'));
        const adapter = new MockFileSystemAdapter(vault.store);

        expect(adapter.getBasePath()).toBe('/tmp/other-vault');
        vault.seed('a.md', 'x');
        expect(vault.store.files.size).toBe(1);
    });
});

describe('obsidian mock — UI primitives', () => {
    beforeEach(() => {
        resetNoticeCalls();
    });

    it('records every Notice for later inspection', () => {
        new Notice('first');
        new Notice('second', 4000);
        expect(getNoticeCalls().map(call => call.message)).toEqual(['first', 'second']);
        expect(getNoticeCalls()[1]?.duration).toBe(4000);

        resetNoticeCalls();
        expect(getNoticeCalls()).toHaveLength(0);
    });

    it('constructs a Modal with usable modalEl/contentEl and open/close', () => {
        const modal = new Modal(new MockApp());
        expect(modal.modalEl.className).toBe('modal');
        expect(modal.modalEl.parentElement).toBe(modal.containerEl);
        expect(modal.contentEl.parentElement).toBe(modal.modalEl);

        const opened = jest.fn();
        const closed = jest.fn();
        modal.onOpen = opened;
        modal.onClose = closed;
        modal.open();
        expect(opened).toHaveBeenCalledTimes(1);
        expect(document.body.contains(modal.containerEl)).toBe(true);
        modal.close();
        expect(closed).toHaveBeenCalledTimes(1);
        expect(document.body.contains(modal.containerEl)).toBe(false);
    });

    it('collects Menu items built through the fluent shim', () => {
        const menu = new Menu();
        menu.addItem(item => {
            item.setTitle('Open note')
                .setIcon('document')
                .setSection('actions')
                .onClick(() => undefined);
        });
        menu.addSeparator();
        menu.addItem(item => item.setTitle('Disabled').setDisabled(true));

        expect(menu.items).toEqual([
            { title: 'Open note', icon: 'document', section: 'actions', onClick: expect.any(Function) },
            { title: 'Disabled', disabled: true },
        ]);
        expect(menu.showAtPosition({ x: 0, y: 0 })).toBe(menu);
        expect(menu.hide()).toBe(menu);
    });

    it('builds Setting components fluently', () => {
        const setting = new Setting(document.createElement('div'));
        expect(setting.setName('Provider')).toBe(setting);
        expect(setting.setDesc('Pick a provider')).toBe(setting);
        expect((setting.addText(() => undefined) as unknown as { inputEl: HTMLElement }).inputEl).toBeInstanceOf(
            HTMLInputElement,
        );
        expect((setting.addButton(() => undefined) as unknown as { buttonEl: HTMLElement }).buttonEl).toBeInstanceOf(
            HTMLButtonElement,
        );
    });

    it('exposes the desktop Platform defaults', () => {
        expect(Platform.isDesktop).toBe(true);
        expect(Platform.isMobile).toBe(false);
    });

    it('registers icons through addIcon', () => {
        addIcon('youtube', '<svg/>');
        expect(addIcon).toHaveBeenCalledWith('youtube', '<svg/>');
    });
});

describe('obsidian mock — debounce', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('folds rapid calls into one and keeps only the latest arguments', () => {
        jest.useFakeTimers();
        const callback = jest.fn();
        const debounced = debounce(callback, 100);

        debounced('first');
        jest.advanceTimersByTime(50);
        debounced('second');
        jest.advanceTimersByTime(120);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('second');
    });

    it('restarts the deadline when resetTimer is set', () => {
        jest.useFakeTimers();
        const callback = jest.fn();
        const debounced = debounce(callback, 100, true);

        debounced('a');
        jest.advanceTimersByTime(90);
        debounced('b');
        jest.advanceTimersByTime(90);
        expect(callback).not.toHaveBeenCalled();
        jest.advanceTimersByTime(20);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('supports cancel() and run()', () => {
        jest.useFakeTimers();
        const callback = jest.fn();
        const debounced = debounce(callback, 100);

        debounced('only');
        debounced.cancel();
        jest.advanceTimersByTime(500);
        expect(callback).not.toHaveBeenCalled();

        debounced('immediate');
        debounced.run();
        expect(callback).toHaveBeenCalledWith('immediate');
    });
});
