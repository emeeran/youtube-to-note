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

    it('exposes the same surface on its default export for legacy imports', () => {
        const byPath = mockObsidian as unknown as Record<string, unknown>;
        const required = [
            'Notice',
            'Plugin',
            'Modal',
            'Setting',
            'Menu',
            'TFile',
            'Platform',
            'requestUrl',
            'normalizePath',
            'addIcon',
            'debounce',
        ];
        const missing = required.filter(key => typeof byPath[key] === 'undefined');
        expect(missing).toEqual([]);
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
