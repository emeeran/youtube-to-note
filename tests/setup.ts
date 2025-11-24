/**
 * Jest test setup
 */

// Mock Obsidian API
global.Obsidian = {
    Notice: jest.fn(),
    TFile: jest.fn(),
    TFolder: jest.fn(),
    App: jest.fn(),
    WorkspaceLeaf: jest.fn(),
    Plugin: jest.fn(),
    Modal: jest.fn(),
    Setting: jest.fn(),
    PluginSettingTab: jest.fn(),
    MarkdownView: jest.fn(),
    Editor: jest.fn(),
    Vault: jest.fn(),
    Workspace: jest.fn()
};

// Mock fetch
global.fetch = jest.fn();

// Mock console methods to avoid noise in tests
const originalConsole = { ...console };
beforeAll(() => {
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
    console.debug = jest.fn();
});

afterAll(() => {
    Object.assign(console, originalConsole);
});