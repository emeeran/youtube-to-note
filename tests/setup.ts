import 'jest-environment-jsdom';

// Global test setup
global.console = {
    ...console,
    // Suppress console.log during tests unless debugging
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
};

// Mock crypto for encrypted storage
global.crypto = {
    getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
    },
} as any;

// Set timezone for consistent tests
process.env.TZ = 'UTC';
