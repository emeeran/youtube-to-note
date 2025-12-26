// Mock Obsidian API for testing
const mockNotice = jest.fn();
const mockModalOpen = jest.fn();

class MockApp {
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
    };
    workspace = {
        activeLeaf: null,
        getLeaf: jest.fn(),
        splitActiveLeaf: jest.fn(),
        trigger: jest.fn(),
    };
    metadataCache = {
        on: jest.fn(),
        off: jest.fn(),
        getCache: jest.fn(),
    };
}

class MockPluginSettingTab {
    constructor() {
        // Mock constructor
    }
    display = jest.fn();
}

class MockModal {
    app: MockApp;
    open() {
        mockModalOpen(this);
    }
    onClose: () => void = () => {};
    close() {
        if (this.onClose) {
            this.onClose();
        }
    }
}

class MockNotice {
    constructor(public message: string, public duration?: number) {
        mockNotice(message, duration);
    }
}

class MockTextFieldComponent {
    inputEl: HTMLInputElement;
    constructor() {
        this.inputEl = document.createElement('input');
    }
    setValue = jest.fn().mockReturnThis();
    getValue = jest.fn().mockReturnValue('');
    setPlaceholder = jest.fn().mockReturnThis();
    onChange = jest.fn().mockReturnThis();
}

class MockButtonComponent {
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

class MockSetting {
    constructor() {
        // Mock constructor
    }
    setName = jest.fn().mockReturnThis();
    setDesc = jest.fn().mockReturnThis();
    addText = jest.fn().mockReturnValue(new MockTextFieldComponent());
    addButton = jest.fn().mockReturnValue(new MockButtonComponent());
    addToggle = jest.fn().mockReturnThis();
    addDropdown = jest.fn().mockReturnThis();
    addSlider = jest.fn().mockReturnThis();
}

class MockMomentFormatComponent {
    setDefaultFormat = jest.fn().mockReturnThis();
    setSampleEl = jest.fn().mockReturnThis();
    setValue = jest.fn().mockReturnThis();
    getValue = jest.fn().mockReturnValue('');
}

const mockObsidian = {
    Notice: MockNotice,
    Modal: MockModal,
    PluginSettingTab: MockPluginSettingTab,
    Setting: MockSetting,
    TextComponent: MockTextFieldComponent,
    ButtonComponent: MockButtonComponent,
    MomentFormatComponent: MockMomentFormatComponent,
    Platform: {
        isDesktop: true,
        isMobile: false,
        isMacOS: false,
        isWindows: true,
        isLinux: false,
        isIos: false,
        isAndroid: false,
    },
    requestUrl: jest.fn(),
    normalizePath: (path: string) => path,
    moment: require('moment'),
};

export default mockObsidian;
export { MockApp, MockModal, MockNotice };

// Export for testing
export { mockNotice, mockModalOpen };
