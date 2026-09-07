module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    testMatch: [
        '**/__tests__/**/*.+(ts|tsx|js)',
        '**/*.(test|spec).+(ts|tsx|js)'
    ],
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
            tsconfig: 'tsconfig.json'
        }]
    },
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/main.ts',
        '!src/**/index.ts'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    // Floors sit 3-5 points below what the suite actually measures (see the
    // comment on each), so a real regression fails CI while day-to-day noise —
    // a reformat, a new branch in a low-coverage file — does not.
    //
    // `src/main.ts` stays out of `collectCoverageFrom` on purpose: it is
    // load-bearing for the bundle (the plugin class, `processYouTubeVideo` and
    // the settings/load path all live there) and is exercised indirectly
    // through `tests/unit/pipeline.spec.ts` with every collaborator stubbed.
    // Including it would report ~0% for those lines and sink the averages
    // without adding a floor anyone could act on.
    coverageThreshold: {
        global: {
            // Measured 41.84% lines (351/839) over what the directories below do
            // not claim: the src/*.ts top-level files (obsidian-file.ts,
            // secure-config.ts, validation.ts, video-data.ts, settings-tab.ts,
            // dom.ts) plus src/constants.
            lines: 37
        },
        // Measured 58.26% (254/436) — one client per provider.
        './src/ai/': {
            lines: 54
        },
        // Measured 60.63% (764/1260, cache included) — the core of the plugin.
        './src/services/': {
            lines: 56
        },
        // Measured 100% (3/3) — format templates and config are constants.
        './src/templates/': {
            lines: 95
        },
        // Measured 10.11% (110/1088); the untested modal component dominates the
        // denominator, so this floor only catches a deleted modal-utils suite.
        './src/components/': {
            lines: 7
        }
    },
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@tests/(.*)$': '<rootDir>/tests/$1',
        '^obsidian$': '<rootDir>/tests/__mocks__/obsidian.ts'
    },
    transformIgnorePatterns: [
        'node_modules/(?!(obsidian)/)'
    ]
};