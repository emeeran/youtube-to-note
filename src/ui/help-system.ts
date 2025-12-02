import { a11y } from './accessibility';
import { StyleManager } from './constants/index';


/**
 * Help content types
 */
export interface HelpContent {
    id: string;
    title: string;
    content: string;
    category: 'general' | 'features' | 'settings' | 'troubleshooting' | 'keyboard';
    tags?: string[];
    related?: string[];
    searchable?: boolean;
}

/**
 * Tooltip configuration
 */
export interface TooltipConfig {
    content: string;
    position: 'top' | 'bottom' | 'left' | 'right';
    trigger: 'hover' | 'click' | 'focus' | 'manual';
    delay?: number;
    hideDelay?: number;
    maxWidth?: number;
    persistent?: boolean;
    html?: boolean;
}

/**
 * Contextual help system with tooltips and guided tours
 */
export class HelpSystemManager {
    private static instance: HelpSystemManager;
    private helpContent: Map<string, HelpContent> = new Map();
    private tooltips: Map<string, HTMLElement> = new Map();
    private activeTooltip: HTMLElement | null = null;
    private helpModal: HTMLElement | null = null;
    private currentTour: any | null = null;
    private tourSteps: any[] = [];
    private currentTourStep = 0;
    private keyboardShortcuts: Map<string, { key: string; description: string; action: () => void }> = new Map();

    private constructor() {
        this.initializeHelpStyles();
        this.initializeHelpContent();
        this.setupGlobalHelpHandlers();
        this.setupKeyboardShortcuts();
    }

    static getInstance(): HelpSystemManager {
        if (!HelpSystemManager.instance) {
            HelpSystemManager.instance = new HelpSystemManager();
        }
        return HelpSystemManager.instance;
    }

    /**
     * Initialize help system styles
     */
    private initializeHelpStyles(): void {
        const helpCSS = `
            /* Help system base styles */
            .yt-help-system {
                --help-primary: var(--interactive-accent);
                --help-secondary: var(--background-secondary);
                --help-text: var(--text-normal);
                --help-muted: var(--text-muted);
                --help-border: var(--background-modifier-border);
            }

            /* Tooltip styles */
            .yt-tooltip {
                position: absolute;
                background: var(--help-secondary);
                color: var(--help-text);
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 13px;
                line-height: 1.4;
                max-width: 300px;
                z-index: 10000;
                pointer-events: none;
                opacity: 0;
                transform: translateY(5px);
                transition: opacity 0.2s ease, transform 0.2s ease;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                border: 1px solid var(--help-border);
                word-wrap: break-word;
            }

            .yt-tooltip.show {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }

            .yt-tooltip.plain {
                background: var(--background-primary);
                border: 1px solid var(--help-primary);
            }

            .yt-tooltip.warning {
                background: rgba(var(--text-warning-rgb), 0.1);
                border-color: var(--text-warning);
                color: var(--text-warning);
            }

            .yt-tooltip.error {
                background: rgba(var(--text-error-rgb), 0.1);
                border-color: var(--text-error);
                color: var(--text-error);
            }

            /* Tooltip arrows */
            .yt-tooltip::before {
                content: '';
                position: absolute;
                width: 0;
                height: 0;
                border: 5px solid transparent;
            }

            .yt-tooltip.top::before {
                bottom: -10px;
                left: 50%;
                transform: translateX(-50%);
                border-top-color: var(--help-secondary);
            }

            .yt-tooltip.bottom::before {
                top: -10px;
                left: 50%;
                transform: translateX(-50%);
                border-bottom-color: var(--help-secondary);
            }

            .yt-tooltip.left::before {
                right: -10px;
                top: 50%;
                transform: translateY(-50%);
                border-left-color: var(--help-secondary);
            }

            .yt-tooltip.right::before {
                left: -10px;
                top: 50%;
                transform: translateY(-50%);
                border-right-color: var(--help-secondary);
            }

            /* Help button */
            .yt-help-button {
                position: fixed;
                bottom: 80px;
                right: 24px;
                width: 48px;
                height: 48px;
                border-radius: 24px;
                background: var(--help-primary);
                color: white;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
                z-index: 1000;
            }

            .yt-help-button:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
            }

            .yt-help-button:active {
                transform: scale(0.95);
            }

            /* Help modal */
            .yt-help-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
            }

            .yt-help-modal.show {
                opacity: 1;
                pointer-events: auto;
            }

            .yt-help-modal-content {
                background: var(--background-primary);
                border-radius: 12px;
                width: 90vw;
                max-width: 800px;
                max-height: 80vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                transform: scale(0.9) translateY(20px);
                transition: transform 0.3s ease;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
            }

            .yt-help-modal.show .yt-help-modal-content {
                transform: scale(1) translateY(0);
            }

            .yt-help-modal-header {
                padding: 20px;
                border-bottom: 1px solid var(--help-border);
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: var(--help-secondary);
            }

            .yt-help-modal-title {
                font-size: 20px;
                font-weight: 600;
                color: var(--help-text);
                margin: 0;
            }

            .yt-help-modal-close {
                background: none;
                border: none;
                font-size: 24px;
                color: var(--help-muted);
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: background 0.2s ease;
            }

            .yt-help-modal-close:hover {
                background: rgba(0, 0, 0, 0.1);
            }

            .yt-help-modal-body {
                padding: 20px;
                overflow-y: auto;
                flex: 1;
            }

            /* Help search */
            .yt-help-search {
                margin-bottom: 20px;
            }

            .yt-help-search-input {
                width: 100%;
                padding: 12px;
                border: 2px solid var(--help-border);
                border-radius: 8px;
                font-size: 16px;
                background: var(--background-primary);
                color: var(--help-text);
                transition: border-color 0.2s ease;
            }

            .yt-help-search-input:focus {
                outline: none;
                border-color: var(--help-primary);
            }

            /* Help categories */
            .yt-help-categories {
                display: flex;
                gap: 8px;
                margin-bottom: 20px;
                flex-wrap: wrap;
            }

            .yt-help-category {
                padding: 6px 12px;
                border-radius: 16px;
                background: var(--help-secondary);
                border: 1px solid var(--help-border);
                color: var(--help-text);
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s ease;
            }

            .yt-help-category:hover {
                background: var(--help-primary);
                color: white;
            }

            .yt-help-category.active {
                background: var(--help-primary);
                color: white;
            }

            /* Help content */
            .yt-help-content-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 16px;
            }

            .yt-help-item {
                background: var(--help-secondary);
                border: 1px solid var(--help-border);
                border-radius: 8px;
                padding: 16px;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .yt-help-item:hover {
                border-color: var(--help-primary);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }

            .yt-help-item-title {
                font-weight: 600;
                color: var(--help-text);
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .yt-help-item-content {
                color: var(--help-muted);
                font-size: 14px;
                line-height: 1.4;
            }

            .yt-help-item-tags {
                display: flex;
                gap: 4px;
                margin-top: 8px;
                flex-wrap: wrap;
            }

            .yt-help-item-tag {
                font-size: 11px;
                color: var(--help-muted);
                background: rgba(0, 0, 0, 0.1);
                padding: 2px 6px;
                border-radius: 10px;
            }

            /* Guided tour */
            .yt-tour-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                z-index: 9998;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
            }

            .yt-tour-overlay.show {
                opacity: 1;
                pointer-events: auto;
            }

            .yt-tour-highlight {
                position: relative;
                z-index: 9999;
                border-radius: 8px;
                box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7);
                transition: box-shadow 0.3s ease;
            }

            .yt-tour-tooltip {
                position: absolute;
                background: var(--background-primary);
                border-radius: 12px;
                padding: 20px;
                max-width: 300px;
                z-index: 10000;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                opacity: 0;
                transform: scale(0.9);
                transition: opacity 0.3s ease, transform 0.3s ease;
            }

            .yt-tour-tooltip.show {
                opacity: 1;
                transform: scale(1);
            }

            .yt-tour-tooltip-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 8px;
                color: var(--help-text);
            }

            .yt-tour-tooltip-content {
                color: var(--help-muted);
                margin-bottom: 16px;
                line-height: 1.4;
            }

            .yt-tour-tooltip-actions {
                display: flex;
                gap: 8px;
                justify-content: space-between;
            }

            .yt-tour-tooltip-progress {
                font-size: 12px;
                color: var(--help-muted);
            }

            /* Keyboard shortcuts modal */
            .yt-keyboard-shortcuts {
                display: grid;
                gap: 12px;
            }

            .yt-keyboard-shortcut {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                background: var(--help-secondary);
                border-radius: 6px;
            }

            .yt-keyboard-shortcut-keys {
                display: flex;
                gap: 4px;
            }

            .yt-key {
                padding: 4px 8px;
                background: var(--background-primary);
                border: 1px solid var(--help-border);
                border-radius: 4px;
                font-family: monospace;
                font-size: 12px;
                color: var(--help-text);
            }

            /* Contextual help indicator */
            .yt-context-help {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: var(--help-primary);
                color: white;
                font-size: 10px;
                font-weight: bold;
                cursor: help;
                margin-left: 4px;
                transition: transform 0.2s ease;
            }

            .yt-context-help:hover {
                transform: scale(1.2);
            }

            /* Mobile optimizations */
            @media (max-width: 768px) {
                .yt-help-modal-content {
                    width: 95vw;
                    max-height: 90vh;
                }

                .yt-help-content-grid {
                    grid-template-columns: 1fr;
                }

                .yt-tour-tooltip {
                    max-width: 250px;
                }

                .yt-help-button {
                    bottom: 100px;
                    right: 16px;
                    width: 44px;
                    height: 44px;
                }
            }

            /* High contrast mode */
            @media (prefers-contrast: high) {
                .yt-tooltip {
                    border: 2px solid var(--help-text);
                }

                .yt-help-item {
                    border: 2px solid var(--help-border);
                }
            }

            /* Reduced motion */
            @media (prefers-reduced-motion: reduce) {
                .yt-tooltip,
                .yt-help-modal,
                .yt-help-modal-content,
                .yt-tour-overlay,
                .yt-tour-tooltip {
                    transition: none;
                }
            }
        `;

        StyleManager.addClass('help-system', {
            'root': helpCSS
        });
    }

    /**
     * Initialize default help content
     */
    private initializeHelpContent(): void {
        const defaultContent: HelpContent[] = [
            {
                id: 'getting-started',
                title: 'Getting Started',
                content: 'Welcome to YouTube Clipper! This plugin helps you process YouTube videos and create detailed notes from them.',
                category: 'general',
                tags: ['beginner', 'introduction'],
                searchable: true
            },
            {
                id: 'process-video',
                title: 'Processing a Video',
                content: 'Click the film icon in the ribbon or use the command palette to open the video processing modal. Enter a YouTube URL and select your preferred output format.',
                category: 'features',
                tags: ['video', 'processing', 'url'],
                searchable: true
            },
            {
                id: 'ai-providers',
                title: 'AI Providers',
                content: 'Choose between Gemini, Groq, or other AI providers for video analysis. Each provider has different capabilities and pricing.',
                category: 'settings',
                tags: ['ai', 'providers', 'gemini', 'groq'],
                searchable: true
            },
            {
                id: 'output-formats',
                title: 'Output Formats',
                content: 'Available formats include detailed guides, summaries, timestamps, and custom prompts. Each format processes the video differently.',
                category: 'features',
                tags: ['formats', 'output', 'export'],
                searchable: true
            },
            {
                id: 'keyboard-shortcuts',
                title: 'Keyboard Shortcuts',
                content: 'Use Ctrl/Cmd+Shift+Y to open the video modal, Ctrl/Cmd+Shift+H for help, and Escape to close modals.',
                category: 'keyboard',
                tags: ['shortcuts', 'keyboard'],
                searchable: true
            },
            {
                id: 'troubleshooting',
                title: 'Troubleshooting',
                content: 'If videos fail to process, check your API keys, internet connection, and ensure the YouTube video is accessible.',
                category: 'troubleshooting',
                tags: ['error', 'issues', 'help'],
                searchable: true
            }
        ];

        defaultContent.forEach(content => {
            this.helpContent.set(content.id, content);
        });
    }

    /**
     * Setup global help handlers
     */
    private setupGlobalHelpHandlers(): void {
        // Add help button
        this.addHelpButton();

        // Handle escape key for modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeHelpModal();
                this.endTour();
                this.hideAllTooltips();
            }
        });

        // Handle help button clicks
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('.yt-help-button')) {
                this.showHelpModal();
            }

            if (target.closest('.yt-context-help')) {
                const helpId = target.closest('.yt-context-help')?.getAttribute('data-help-id');
                if (helpId) {
                    this.showContextHelp(helpId);
                }
            }
        });
    }

    /**
     * Setup keyboard shortcuts
     */
    private setupKeyboardShortcuts(): void {
        this.addKeyboardShortcut('ctrl+shift+h', 'Open Help', () => {
            this.showHelpModal();
        });

        this.addKeyboardShortcut('ctrl+shift+y', 'Process Video', () => {
            // Trigger video processing modal
            const event = new CustomEvent('open-video-modal');
            document.dispatchEvent(event);
        });

        this.addKeyboardShortcut('ctrl+/', 'Show Keyboard Shortcuts', () => {
            this.showKeyboardShortcuts();
        });

        this.addKeyboardShortcut('f1', 'Help', () => {
            this.showHelpModal();
        });
    }

    /**
     * Add help button to the page
     */
    private addHelpButton(): void {
        const helpButton = document.createElement('button');
        helpButton.className = 'yt-help-button';
        helpButton.innerHTML = '?';
        helpButton.setAttribute('aria-label', 'Help');
        helpButton.setAttribute('title', 'Get help');
        document.body.appendChild(helpButton);
    }

    /**
     * Create tooltip for element
     */
    createTooltip(element: HTMLElement, config: TooltipConfig): string {
        const tooltipId = `tooltip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Remove existing tooltip
        this.removeTooltip(element);

        const tooltip = document.createElement('div');
        tooltip.className = `yt-tooltip ${config.position}`;
        tooltip.id = tooltipId;

        if (config.html) {
            tooltip.innerHTML = config.content;
        } else {
            tooltip.textContent = config.content;
        }

        if (config.maxWidth) {
            tooltip.style.maxWidth = `${config.maxWidth}px`;
        }

        document.body.appendChild(tooltip);
        this.tooltips.set(tooltipId, tooltip);

        // Position tooltip
        this.positionTooltip(element, tooltip, config.position);

        // Setup event handlers
        this.setupTooltipEvents(element, tooltip, config);

        // Store tooltip reference on element
        (element as any).ytTooltip = tooltipId;

        return tooltipId;
    }

    /**
     * Position tooltip relative to element
     */
    private positionTooltip(element: HTMLElement, tooltip: HTMLElement, position: string): void {
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        switch (position) {
            case 'top':
                tooltip.style.bottom = `${window.innerHeight - rect.top + 8}px`;
                tooltip.style.left = `${rect.left + (rect.width - tooltipRect.width) / 2}px`;
                break;
            case 'bottom':
                tooltip.style.top = `${rect.bottom + 8}px`;
                tooltip.style.left = `${rect.left + (rect.width - tooltipRect.width) / 2}px`;
                break;
            case 'left':
                tooltip.style.right = `${window.innerWidth - rect.left + 8}px`;
                tooltip.style.top = `${rect.top + (rect.height - tooltipRect.height) / 2}px`;
                break;
            case 'right':
                tooltip.style.left = `${rect.right + 8}px`;
                tooltip.style.top = `${rect.top + (rect.height - tooltipRect.height) / 2}px`;
                break;
        }

        // Adjust if tooltip goes off-screen
        this.adjustTooltipPosition(tooltip);
    }

    /**
     * Adjust tooltip position to keep it on screen
     */
    private adjustTooltipPosition(tooltip: HTMLElement): void {
        const rect = tooltip.getBoundingClientRect();
        const margin = 16;

        if (rect.left < margin) {
            tooltip.style.left = `${margin}px`;
        }
        if (rect.right > window.innerWidth - margin) {
            tooltip.style.left = `${window.innerWidth - rect.width - margin}px`;
        }
        if (rect.top < margin) {
            tooltip.style.top = `${margin}px`;
        }
        if (rect.bottom > window.innerHeight - margin) {
            tooltip.style.top = `${window.innerHeight - rect.height - margin}px`;
        }
    }

    /**
     * Setup tooltip event handlers
     */
    private setupTooltipEvents(element: HTMLElement, tooltip: HTMLElement, config: TooltipConfig): void {
        const showTooltip = () => {
            this.hideAllTooltips();
            this.activeTooltip = tooltip;
            tooltip.classList.add('show');
        };

        const hideTooltip = () => {
            tooltip.classList.remove('show');
            if (this.activeTooltip === tooltip) {
                this.activeTooltip = null;
            }
        };

        let showTimeout: NodeJS.Timeout;
        let hideTimeout: NodeJS.Timeout;

        switch (config.trigger) {
            case 'hover':
                element.addEventListener('mouseenter', () => {
                    clearTimeout(hideTimeout);
                    showTimeout = setTimeout(showTooltip, config.delay || 300);
                });

                element.addEventListener('mouseleave', () => {
                    clearTimeout(showTimeout);
                    hideTimeout = setTimeout(hideTooltip, config.hideDelay || 100);
                });

                tooltip.addEventListener('mouseenter', () => {
                    clearTimeout(hideTimeout);
                });

                tooltip.addEventListener('mouseleave', hideTooltip);
                break;

            case 'click':
                element.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (tooltip.classList.contains('show')) {
                        hideTooltip();
                    } else {
                        showTooltip();
                    }
                });

                if (!config.persistent) {
                    document.addEventListener('click', (e) => {
                        if (!element.contains(e.target as Node) && !tooltip.contains(e.target as Node)) {
                            hideTooltip();
                        }
                    });
                }
                break;

            case 'focus':
                element.addEventListener('focus', showTooltip);
                element.addEventListener('blur', hideTooltip);
                break;
        }
    }

    /**
     * Remove tooltip from element
     */
    removeTooltip(element: HTMLElement): void {
        const tooltipId = (element as any).ytTooltip;
        if (tooltipId) {
            const tooltip = this.tooltips.get(tooltipId);
            if (tooltip) {
                tooltip.remove();
                this.tooltips.delete(tooltipId);
            }
            delete (element as any).ytTooltip;
        }
    }

    /**
     * Hide all tooltips
     */
    hideAllTooltips(): void {
        this.tooltips.forEach(tooltip => {
            tooltip.classList.remove('show');
        });
        this.activeTooltip = null;
    }

    /**
     * Show help modal
     */
    showHelpModal(): void {
        if (this.helpModal) {
            this.helpModal.classList.add('show');
            return;
        }

        this.helpModal = this.createHelpModal();
        document.body.appendChild(this.helpModal);

        // Trigger animation
        requestAnimationFrame(() => {
            this.helpModal?.classList.add('show');
        });

        // Focus search input
        const searchInput = this.helpModal.querySelector('.yt-help-search-input') as HTMLInputElement;
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 300);
        }

        // Announce to screen readers
        a11y.announce('Help modal opened', 'polite');
    }

    /**
     * Close help modal
     */
    closeHelpModal(): void {
        if (!this.helpModal) return;

        this.helpModal.classList.remove('show');
        setTimeout(() => {
            if (this.helpModal) {
                this.helpModal.remove();
                this.helpModal = null;
            }
        }, 300);

        // Announce to screen readers
        a11y.announce('Help modal closed', 'polite');
    }

    /**
     * Create help modal
     */
    private createHelpModal(): HTMLElement {
        const modal = document.createElement('div');
        modal.className = 'yt-help-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'yt-help-modal-title');

        modal.innerHTML = `
            <div class="yt-help-modal-content">
                <div class="yt-help-modal-header">
                    <h2 id="yt-help-modal-title" class="yt-help-modal-title">Help & Documentation</h2>
                    <button class="yt-help-modal-close" aria-label="Close help">&times;</button>
                </div>
                <div class="yt-help-modal-body">
                    <div class="yt-help-search">
                        <input type="text" class="yt-help-search-input" placeholder="Search for help..." aria-label="Search help">
                    </div>
                    <div class="yt-help-categories">
                        <button class="yt-help-category active" data-category="all">All</button>
                        <button class="yt-help-category" data-category="general">General</button>
                        <button class="yt-help-category" data-category="features">Features</button>
                        <button class="yt-help-category" data-category="settings">Settings</button>
                        <button class="yt-help-category" data-category="troubleshooting">Troubleshooting</button>
                        <button class="yt-help-category" data-category="keyboard">Keyboard</button>
                    </div>
                    <div class="yt-help-content-grid">
                        <!-- Help items will be dynamically added here -->
                    </div>
                </div>
            </div>
        `;

        // Setup modal event handlers
        this.setupHelpModalEvents(modal);

        // Populate help content
        this.populateHelpContent(modal);

        return modal;
    }

    /**
     * Setup help modal event handlers
     */
    private setupHelpModalEvents(modal: HTMLElement): void {
        const closeButton = modal.querySelector('.yt-help-modal-close');
        const searchInput = modal.querySelector('.yt-help-search-input') as HTMLInputElement;
        const categoryButtons = modal.querySelectorAll('.yt-help-category');

        // Close button
        closeButton?.addEventListener('click', () => {
            this.closeHelpModal();
        });

        // Search functionality
        searchInput?.addEventListener('input', (e) => {
            const query = (e.target as HTMLInputElement).value;
            this.searchHelpContent(modal, query);
        });

        // Category filters
        categoryButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Update active state
                categoryButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Filter content
                const category = button.getAttribute('data-category');
                this.filterHelpContent(modal, category);
            });
        });

        // Help item clicks
        modal.addEventListener('click', (e) => {
            const helpItem = (e.target as HTMLElement).closest('.yt-help-item');
            if (helpItem) {
                const helpId = helpItem.getAttribute('data-help-id');
                if (helpId) {
                    this.showHelpDetail(helpId);
                }
            }
        });
    }

    /**
     * Populate help content in modal
     */
    private populateHelpContent(modal: HTMLElement): void {
        const contentGrid = modal.querySelector('.yt-help-content-grid') as HTMLElement;
        if (!contentGrid) return;

        contentGrid.innerHTML = '';

        this.helpContent.forEach(content => {
            const item = document.createElement('div');
            item.className = 'yt-help-item';
            item.setAttribute('data-help-id', content.id);
            item.setAttribute('data-category', content.category);

            const tagsHtml = content.tags?.map(tag =>
                `<span class="yt-help-item-tag">${tag}</span>`
            ).join('') || '';

            item.innerHTML = `
                <div class="yt-help-item-title">
                    <span>${this.getCategoryIcon(content.category)}</span>
                    <span>${content.title}</span>
                </div>
                <div class="yt-help-item-content">${content.content}</div>
                ${tagsHtml ? `<div class="yt-help-item-tags">${tagsHtml}</div>` : ''}
            `;

            contentGrid.appendChild(item);
        });
    }

    /**
     * Get category icon
     */
    private getCategoryIcon(category: string): string {
        const icons = {
            general: '📖',
            features: '⚡',
            settings: '⚙️',
            troubleshooting: '🔧',
            keyboard: '⌨️'
        };
        return icons[category as keyof typeof icons] || '📋';
    }

    /**
     * Search help content
     */
    private searchHelpContent(modal: HTMLElement, query: string): void {
        const items = modal.querySelectorAll('.yt-help-item');
        const lowerQuery = query.toLowerCase();

        items.forEach(item => {
            const title = item.querySelector('.yt-help-item-title')?.textContent?.toLowerCase() || '';
            const content = item.querySelector('.yt-help-item-content')?.textContent?.toLowerCase() || '';
            const tags = Array.from(item.querySelectorAll('.yt-help-item-tag'))
                .map(tag => tag.textContent?.toLowerCase() || '')
                .join(' ');

            const matchesSearch = !query ||
                title.includes(lowerQuery) ||
                content.includes(lowerQuery) ||
                tags.includes(lowerQuery);

            item.style.display = matchesSearch ? '' : 'none';
        });
    }

    /**
     * Filter help content by category
     */
    private filterHelpContent(modal: HTMLElement, category: string): void {
        const items = modal.querySelectorAll('.yt-help-item');

        items.forEach(item => {
            const itemCategory = item.getAttribute('data-category');
            const shouldShow = category === 'all' || itemCategory === category;
            item.style.display = shouldShow ? '' : 'none';
        });
    }

    /**
     * Show help detail
     */
    private showHelpDetail(helpId: string): void {
        const content = this.helpContent.get(helpId);
        if (!content) return;

        // Create detail modal
        const detailModal = document.createElement('div');
        detailModal.className = 'yt-help-modal show';
        detailModal.setAttribute('role', 'dialog');
        detailModal.setAttribute('aria-modal', 'true');

        detailModal.innerHTML = `
            <div class="yt-help-modal-content">
                <div class="yt-help-modal-header">
                    <h2 class="yt-help-modal-title">${content.title}</h2>
                    <button class="yt-help-modal-close">&times;</button>
                </div>
                <div class="yt-help-modal-body">
                    <div class="yt-help-item-content" style="font-size: 16px; line-height: 1.6;">
                        ${content.content}
                    </div>
                    ${content.tags?.length ? `
                        <div class="yt-help-item-tags" style="margin-top: 16px;">
                            ${content.tags.map(tag => `<span class="yt-help-item-tag">${tag}</span>`).join('')}
                        </div>
                    ` : ''}
                    ${content.related?.length ? `
                        <h3 style="margin-top: 20px; margin-bottom: 8px;">Related Topics</h3>
                        <div class="yt-help-content-grid">
                            ${content.related.map(relatedId => {
                                const relatedContent = this.helpContent.get(relatedId);
                                return relatedContent ? `
                                    <div class="yt-help-item" data-help-id="${relatedId}" style="cursor: pointer;">
                                        <div class="yt-help-item-title">${relatedContent.title}</div>
                                    </div>
                                ` : '';
                            }).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(detailModal);

        // Setup close handlers
        const closeButton = detailModal.querySelector('.yt-help-modal-close');
        closeButton?.addEventListener('click', () => {
            detailModal.remove();
        });

        detailModal.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).classList.contains('yt-help-item')) {
                const relatedId = (e.target as HTMLElement).getAttribute('data-help-id');
                if (relatedId) {
                    detailModal.remove();
                    this.showHelpDetail(relatedId);
                }
            }
        });
    }

    /**
     * Show contextual help
     */
    showContextHelp(helpId: string): void {
        const content = this.helpContent.get(helpId);
        if (!content) return;

        // Create tooltip with help content
        const tooltip = document.createElement('div');
        tooltip.className = 'yt-tooltip top show';
        tooltip.style.maxWidth = '400px';
        tooltip.innerHTML = `
            <strong>${content.title}</strong><br>
            ${content.content}
        `;

        document.body.appendChild(tooltip);

        // Position near the clicked element
        const event = new MouseEvent('click');
        const target = event.target as HTMLElement;
        if (target) {
            this.positionTooltip(target, tooltip, 'top');
        }

        // Auto-hide after 5 seconds
        setTimeout(() => {
            tooltip.remove();
        }, 5000);
    }

    /**
     * Add keyboard shortcut
     */
    addKeyboardShortcut(keys: string, description: string, action: () => void): void {
        this.keyboardShortcuts.set(keys.toLowerCase(), {
            key: keys,
            description,
            action
        });

        // Add keyboard event listener
        document.addEventListener('keydown', (e) => {
            const combo = this.getKeyboardCombo(e);
            if (combo.toLowerCase() === keys.toLowerCase()) {
                e.preventDefault();
                action();
            }
        });
    }

    /**
     * Get keyboard combination string
     */
    private getKeyboardCombo(e: KeyboardEvent): string {
        const parts: string[] = [];

        if (e.ctrlKey) parts.push('ctrl');
        if (e.metaKey) parts.push('cmd');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');

        if (!['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
            parts.push(e.key.toLowerCase());
        }

        return parts.join('+');
    }

    /**
     * Show keyboard shortcuts modal
     */
    showKeyboardShortcuts(): void {
        const modal = document.createElement('div');
        modal.className = 'yt-help-modal show';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');

        const shortcutsHtml = Array.from(this.keyboardShortcuts.entries())
            .map(([keys, { description }]) => `
                <div class="yt-keyboard-shortcut">
                    <span>${description}</span>
                    <div class="yt-keyboard-shortcut-keys">
                        ${keys.split('+').map(key => `<span class="yt-key">${key.toUpperCase()}</span>`).join(' + ')}
                    </div>
                </div>
            `).join('');

        modal.innerHTML = `
            <div class="yt-help-modal-content">
                <div class="yt-help-modal-header">
                    <h2 class="yt-help-modal-title">Keyboard Shortcuts</h2>
                    <button class="yt-help-modal-close">&times;</button>
                </div>
                <div class="yt-help-modal-body">
                    <div class="yt-keyboard-shortcuts">
                        ${shortcutsHtml}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup close handler
        const closeButton = modal.querySelector('.yt-help-modal-close');
        closeButton?.addEventListener('click', () => {
            modal.remove();
        });
    }

    /**
     * Start guided tour
     */
    startTour(steps: any[]): void {
        if (steps.length === 0) return;

        this.tourSteps = steps;
        this.currentTourStep = 0;

        // Create tour overlay
        const overlay = document.createElement('div');
        overlay.className = 'yt-tour-overlay';
        overlay.id = 'yt-tour-overlay';
        document.body.appendChild(overlay);

        this.showTourStep(0);
    }

    /**
     * Show specific tour step
     */
    private showTourStep(stepIndex: number): void {
        if (stepIndex >= this.tourSteps.length) {
            this.endTour();
            return;
        }

        const step = this.tourSteps[stepIndex];
        const element = document.querySelector(step.selector) as HTMLElement;

        if (!element) {
            
this.showTourStep(stepIndex + 1);
            return;
        }

        // Highlight element
        element.classList.add('yt-tour-highlight');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Create tour tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'yt-tour-tooltip';
        tooltip.innerHTML = `
            <div class="yt-tour-tooltip-title">${step.title}</div>
            <div class="yt-tour-tooltip-content">${step.content}</div>
            <div class="yt-tour-tooltip-actions">
                <div class="yt-tour-tooltip-progress">${stepIndex + 1} / ${this.tourSteps.length}</div>
                <div>
                    ${stepIndex > 0 ? '<button class="yt-tour-prev">Previous</button>' : ''}
                    <button class="yt-tour-next">${stepIndex === this.tourSteps.length - 1 ? 'Finish' : 'Next'}</button>
                </div>
            </div>
        `;

        // Position tooltip
        const rect = element.getBoundingClientRect();
        tooltip.style.top = `${rect.bottom + 10}px`;
        tooltip.style.left = `${rect.left}px`;

        document.body.appendChild(tooltip);

        // Setup button handlers
        const prevButton = tooltip.querySelector('.yt-tour-prev');
        const nextButton = tooltip.querySelector('.yt-tour-next');

        prevButton?.addEventListener('click', () => {
            this.showTourStep(stepIndex - 1);
        });

        nextButton?.addEventListener('click', () => {
            element.classList.remove('yt-tour-highlight');
            tooltip.remove();
            this.showTourStep(stepIndex + 1);
        });

        // Show overlay and tooltip
        const overlay = document.getElementById('yt-tour-overlay');
        if (overlay) {
            overlay.classList.add('show');
        }

        requestAnimationFrame(() => {
            tooltip.classList.add('show');
        });
    }

    /**
     * End guided tour
     */
    endTour(): void {
        // Remove overlay
        const overlay = document.getElementById('yt-tour-overlay');
        if (overlay) {
            overlay.remove();
        }

        // Remove any highlights
        document.querySelectorAll('.yt-tour-highlight').forEach(element => {
            element.classList.remove('yt-tour-highlight');
        });

        // Remove any tour tooltips
        document.querySelectorAll('.yt-tour-tooltip').forEach(tooltip => {
            tooltip.remove();
        });

        this.tourSteps = [];
        this.currentTourStep = 0;
    }

    /**
     * Add help content
     */
    addHelpContent(content: HelpContent): void {
        this.helpContent.set(content.id, content);
    }

    /**
     * Remove help content
     */
    removeHelpContent(id: string): void {
        this.helpContent.delete(id);
    }

    /**
     * Get help content by ID
     */
    getHelpContent(id: string): HelpContent | undefined {
        return this.helpContent.get(id);
    }

    /**
     * Search help content
     */
    searchHelp(query: string): HelpContent[] {
        const lowerQuery = query.toLowerCase();
        const results: HelpContent[] = [];

        this.helpContent.forEach(content => {
            if (!content.searchable) return;

            const searchText = `${content.title} ${content.content} ${content.tags?.join(' ')}`.toLowerCase();
            if (searchText.includes(lowerQuery)) {
                results.push(content);
            }
        });

        return results;
    }

    /**
     * Cleanup help system
     */
    destroy(): void {
        // Remove all tooltips
        this.tooltips.forEach(tooltip => tooltip.remove());
        this.tooltips.clear();

        // Close help modal
        this.closeHelpModal();

        // End tour
        this.endTour();

        // Remove help button
        const helpButton = document.querySelector('.yt-help-button');
        helpButton?.remove();

        // Clear help content
        this.helpContent.clear();
        this.keyboardShortcuts.clear();
    }
}

// Export singleton instance
export const helpSystemManager = HelpSystemManager.getInstance();

// Export utility functions
export const helpSystem = {
    createTooltip: (element: HTMLElement, config: TooltipConfig) => helpSystemManager.createTooltip(element, config),
    removeTooltip: (element: HTMLElement) => helpSystemManager.removeTooltip(element),
    showHelp: () => helpSystemManager.showHelpModal(),
    hideHelp: () => helpSystemManager.closeHelpModal(),
    addShortcut: (keys: string, description: string, action: () => void) =>
        helpSystemManager.addKeyboardShortcut(keys, description, action),
    showShortcuts: () => helpSystemManager.showKeyboardShortcuts(),
    startTour: (steps: any[]) => helpSystemManager.startTour(steps),
    endTour: () => helpSystemManager.endTour(),
    addContent: (content: HelpContent) => helpSystemManager.addHelpContent(content),
    removeContent: (id: string) => helpSystemManager.removeHelpContent(id),
    search: (query: string) => helpSystemManager.searchHelp(query)
};