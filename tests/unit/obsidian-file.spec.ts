/**
 * `ObsidianFileService` against the in-memory vault in the Obsidian mock.
 *
 * The service is the one place the plugin talks to the vault's high-level API
 * (`create` / `createFolder` / `modify` / `getAbstractFileByPath`), so the specs
 * drive it through a real `MockApp` and assert on the vault's contents rather
 * than on call arguments.
 *
 * The conflict prompt is mocked out: `FileConflictModal` builds its DOM through
 * Obsidian's own `HTMLElement` extensions, which the mock deliberately does not
 * reimplement. What matters here is the decision the service acts on.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { App, TFile } from 'obsidian';

import { ObsidianFileService } from '../../src/obsidian-file';
import { MockApp, TFolder } from '../__mocks__/obsidian';
import type { ConflictResolution } from '../../src/components/common/file-conflict-modal';

/** Decisions the mocked `FileConflictModal` hands back, one per open. */
const conflictDecisions: ConflictResolution[] = [];
/** Every file the service showed the conflict prompt for. */
const conflictPrompts: TFile[] = [];

jest.mock('../../src/components/common', () => ({
    /* The class body only touches the module-scope arrays when it is
     * *instantiated*, which happens inside a test — long after this module has
     * finished evaluating. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FileConflictModal: class {
        constructor(_app: unknown, file: TFile) {
            conflictPrompts.push(file);
        }
        openAndWait(): Promise<ConflictResolution> {
            return Promise.resolve(conflictDecisions.shift() ?? 'cancel');
        }
    },
}));

const OUTPUT_PATH = 'YouTube/Notes';
const TITLE = 'Test Video Title';

/** Today, the way the service derives its daily folder. */
const TODAY = new Date().toISOString().split('T')[0];
const DAILY_FOLDER = `${OUTPUT_PATH}/${TODAY}`;

/** A real mock app plus the service under test, sharing one in-memory vault. */
function makeService(): { service: ObsidianFileService; app: MockApp } {
    const app = new MockApp();
    return { service: new ObsidianFileService(app as unknown as App), app };
}

beforeEach(() => {
    conflictDecisions.length = 0;
    conflictPrompts.length = 0;
});

describe('ObsidianFileService.saveToFile — path handling', () => {
    it('writes into a dated folder under the output path and returns its path', async () => {
        const { service, app } = makeService();

        const filePath = await service.saveToFile(TITLE, '# note', OUTPUT_PATH);

        expect(filePath).toBe(`YouTube/Notes/${TODAY}/Test Video Title.md`);
        expect(app.vault.getFileByPath(filePath)?.path).toBe(filePath);
        // The content landed in the vault, not just in the return value.
        expect(app.vault.store.readFile(filePath)).toBe('# note');
        expect(app.vault.getFolderByPath(DAILY_FOLDER)).toBeInstanceOf(TFolder);
    });

    it('normalizes backslashes, edge slashes and duplicate separators', async () => {
        const { service, app } = makeService();

        const filePath = await service.saveToFile(TITLE, '# note', '\\YouTube//Notes\\');

        expect(filePath).toBe(`YouTube/Notes/${TODAY}/Test Video Title.md`);
        // Nothing was created outside the intended subtree.
        expect(app.vault.store.allFilePaths()).toEqual([`YouTube/Notes/${TODAY}/Test Video Title.md`]);
    });

    it('refuses an output path with parent-directory segments', async () => {
        const { service, app } = makeService();

        await expect(service.saveToFile(TITLE, '# note', '../../sensitive')).rejects.toThrow(
            'Failed to save file: Output path must not contain parent-directory (..) segments.',
        );
        // Refused before anything was written.
        expect(app.vault.store.allFilePaths()).toEqual([]);
    });

    it('creates only the missing ancestors of an existing folder', async () => {
        const { service, app } = makeService();
        app.vault.store.seed(`${OUTPUT_PATH}/keep.md`, 'already here');

        const filePath = await service.saveToFile(TITLE, '# note', OUTPUT_PATH);

        expect(filePath).toBe(`YouTube/Notes/${TODAY}/Test Video Title.md`);
        expect(app.vault.store.readFile(`${OUTPUT_PATH}/keep.md`)).toBe('already here');
        expect(app.vault.store.allFilePaths()).toEqual([
            `YouTube/Notes/${TODAY}/Test Video Title.md`,
            `${OUTPUT_PATH}/keep.md`,
        ]);
    });

    it('treats "folder already exists" as success and still writes the note', async () => {
        const { service, app } = makeService();
        // Obsidian rejects a repeated createFolder; the service must treat that
        // one outcome as "already there" instead of surfacing it. The folder is
        // seeded so the recovery check finds it, and only the first call throws.
        app.vault.store.ensureFolder(OUTPUT_PATH);
        app.vault.createFolder.mockImplementationOnce(async () => {
            throw new Error('Folder already exists.');
        });

        const filePath = await service.saveToFile(TITLE, '# note', OUTPUT_PATH);

        expect(filePath).toBe(`YouTube/Notes/${TODAY}/Test Video Title.md`);
        expect(app.vault.store.readFile(filePath)).toBe('# note');
    });

    it('surfaces a folder-creation failure that is not "already exists"', async () => {
        const { service, app } = makeService();
        app.vault.createFolder.mockImplementation(async () => {
            throw new Error('permission denied');
        });

        await expect(service.saveToFile(TITLE, '# note', OUTPUT_PATH)).rejects.toThrow(
            'Failed to save file: Could not create folder "YouTube/Notes": permission denied',
        );
        expect(app.vault.store.allFilePaths()).toEqual([]);
    });
});

describe('ObsidianFileService.saveToFile — titles', () => {
    it('strips characters the filesystem refuses and collapses whitespace', async () => {
        const { service, app } = makeService();

        const filePath = await service.saveToFile('  My:  Video?  *Draft*  ', '# note', OUTPUT_PATH);

        expect(filePath).toBe(`YouTube/Notes/${TODAY}/My Video Draft.md`);
        expect(app.vault.getFileByPath(filePath)).not.toBeNull();
    });

    it('drops path separators from a title so it cannot escape its folder', async () => {
        const { service, app } = makeService();

        // `/` and `\` are stripped, so a title can never add a path segment —
        // the note lands in the dated folder whatever the title contains.
        const filePath = await service.saveToFile('a/b\\c', '# note', OUTPUT_PATH);

        expect(filePath).toBe(`YouTube/Notes/${TODAY}/abc.md`);
        expect(app.vault.store.allFolders()).toEqual(['YouTube', 'YouTube/Notes', DAILY_FOLDER]);
    });

    it('caps the title at 100 characters', async () => {
        const { service } = makeService();
        const longTitle = 'x'.repeat(180);

        const filePath = await service.saveToFile(longTitle, '# note', OUTPUT_PATH);

        expect(filePath).toBe(`YouTube/Notes/${TODAY}/${'x'.repeat(100)}.md`);
    });
});

describe('ObsidianFileService.saveToFile — conflicts', () => {
    it('creates the file without prompting when nothing is in the way', async () => {
        const { service, app } = makeService();

        const filePath = await service.saveToFile(TITLE, 'first', OUTPUT_PATH);

        expect(filePath).toBe(`YouTube/Notes/${TODAY}/Test Video Title.md`);
        expect(app.vault.store.readFile(filePath)).toBe('first');
        expect(conflictPrompts).toHaveLength(0);
    });

    it('overwrites the existing note when the user chooses overwrite', async () => {
        const { service, app } = makeService();
        const existing = app.vault.store.seed(`YouTube/Notes/${TODAY}/Test Video Title.md`, 'old content');
        conflictDecisions.push('overwrite');

        const filePath = await service.saveToFile(TITLE, 'new content', OUTPUT_PATH);

        expect(conflictPrompts).toEqual([existing]);
        expect(filePath).toBe(existing.path);
        expect(app.vault.store.readFile(filePath)).toBe('new content');
        // Overwritten in place — no numbered sibling was created.
        expect(app.vault.store.allFilePaths()).toEqual([existing.path]);
    });

    it('saves a numbered copy when the user chooses new-name', async () => {
        const { service, app } = makeService();
        const existing = app.vault.store.seed(`YouTube/Notes/${TODAY}/Test Video Title.md`, 'old content');
        conflictDecisions.push('new-name');

        const filePath = await service.saveToFile(TITLE, 'new content', OUTPUT_PATH);

        expect(filePath).toBe(`YouTube/Notes/${TODAY}/Test Video Title (1).md`);
        // The original is untouched.
        expect(app.vault.store.readFile(existing.path)).toBe('old content');
        expect(app.vault.store.readFile(filePath)).toBe('new content');
    });

    it('picks the first free number when the copy would clash too', async () => {
        const { service, app } = makeService();
        app.vault.store.seed(`YouTube/Notes/${TODAY}/Test Video Title.md`, 'old');
        app.vault.store.seed(`YouTube/Notes/${TODAY}/Test Video Title (1).md`, 'copy one');
        conflictDecisions.push('new-name');

        const filePath = await service.saveToFile(TITLE, 'new content', OUTPUT_PATH);

        expect(filePath).toBe(`YouTube/Notes/${TODAY}/Test Video Title (2).md`);
    });

    it('throws and writes nothing when the user cancels', async () => {
        const { service, app } = makeService();
        const existing = app.vault.store.seed(`YouTube/Notes/${TODAY}/Test Video Title.md`, 'old content');
        conflictDecisions.push('cancel');

        await expect(service.saveToFile(TITLE, 'new content', OUTPUT_PATH)).rejects.toThrow(
            'Failed to save file: Save cancelled by user',
        );
        expect(app.vault.store.readFile(existing.path)).toBe('old content');
    });
});

describe('ObsidianFileService helpers', () => {
    it('reports files but not folders through fileExists', () => {
        const { service, app } = makeService();
        const file = app.vault.store.seed(`${OUTPUT_PATH}/note.md`, 'content');

        expect(service.getFileByPath(file.path)).toBe(file);
        expect(service.fileExists(file.path)).toBe(true);
        expect(service.fileExists(OUTPUT_PATH)).toBe(false);
        expect(service.fileExists(`${OUTPUT_PATH}/missing.md`)).toBe(false);
        expect(service.getFileByPath(`${OUTPUT_PATH}/missing.md`)).toBeNull();
    });

    it('creates a uniquely named file when the requested path is taken', async () => {
        const { service, app } = makeService();
        const taken = app.vault.store.seed(`${OUTPUT_PATH}/note.md`, 'taken');

        const created = await service.createUniqueFile(`${OUTPUT_PATH}/note.md`, 'fresh');

        expect(created).toBe(`${OUTPUT_PATH}/note (1).md`);
        expect(app.vault.store.readFile(taken.path)).toBe('taken');
        expect(app.vault.store.readFile(created)).toBe('fresh');
    });

    it('opens an existing file through the workspace leaf', async () => {
        const { service, app } = makeService();
        const openFile = jest.fn(async () => undefined);
        app.workspace.getLeaf.mockReturnValue({ openFile });
        const file = app.vault.store.seed(`${OUTPUT_PATH}/note.md`, 'content');

        await service.openFileWithConfirmation(file as unknown as TFile);

        expect(app.workspace.getLeaf).toHaveBeenCalledWith(false);
        expect(openFile).toHaveBeenCalledWith(file);
    });

    it('fails when the file vanished between creation and opening', async () => {
        const { service, app } = makeService();
        app.workspace.getLeaf.mockReturnValue({ openFile: jest.fn() });
        const file = app.vault.store.seed(`${OUTPUT_PATH}/note.md`, 'content');
        app.vault.store.remove(file.path);

        await expect(service.openFileWithConfirmation(file as unknown as TFile)).rejects.toThrow(
            'Could not open file: File no longer exists',
        );
    });
});
