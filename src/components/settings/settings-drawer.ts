/**
 * SettingsDrawer - Reusable collapsible drawer component for settings
 *
 * Features:
 * - Persistent state via localStorage
 * - Keyboard navigation support
 * - ARIA accessibility
 * - Smooth animations
 */

const CSS_PREFIX = 'ytc-settings';
const DRAWER_STATES_KEY = 'ytc-settings-drawer-states';

export interface DrawerStateStore {
    get(key: string): boolean | undefined;
    set(key: string, value: boolean): void;
}

/**
 * Default localStorage-based state store
 */
const defaultStateStore: DrawerStateStore = {
    get(key: string): boolean | undefined {
        try {
            const stored = localStorage.getItem(DRAWER_STATES_KEY);
            if (stored) {
                const states = JSON.parse(stored);
                return states[key];
            }
        } catch {
            // Silently fail
        }
        return undefined;
    },
    set(key: string, value: boolean): void {
        try {
            const stored = localStorage.getItem(DRAWER_STATES_KEY);
            const states = stored ? JSON.parse(stored) : {};
            states[key] = value;
            localStorage.setItem(DRAWER_STATES_KEY, JSON.stringify(states));
        } catch {
            // Silently fail
        }
    },
};

export interface SettingsDrawerOptions {
    /** Unique identifier for state persistence */
    id: string;
    /** Display title */
    title: string;
    /** Icon emoji or character */
    icon: string;
    /** Whether drawer starts open */
    isOpen?: boolean;
    /** Optional description shown below header */
    description?: string;
    /** Custom state store (for testing or custom persistence) */
    stateStore?: DrawerStateStore;
    /** Callback when drawer is toggled */
    onToggle?: (isOpen: boolean) => void;
}

/**
 * Reusable settings drawer component
 *
 * @example
 * ```typescript
 * const drawer = new SettingsDrawer({
 *     id: 'api-keys',
 *     title: 'API Keys',
 *     icon: '🔑',
 *     description: 'Configure your API keys for AI providers'
 * });
 *
 * container.appendChild(drawer.render());
 *
 * // Add content to drawer
 * const content = drawer.getContentElement();
 * content.createEl('p', { text: 'Settings content here' });
 * ```
 */
export class SettingsDrawer {
    private drawerEl: HTMLElement | null = null;
    private contentEl: HTMLElement | null = null;
    private headerEl: HTMLElement | null = null;
    private isOpen: boolean;
    private readonly stateStore: DrawerStateStore;

    constructor(private readonly options: SettingsDrawerOptions) {
        this.stateStore = options.stateStore ?? defaultStateStore;

        // Load saved state or use default
        const savedState = this.stateStore.get(options.id);
        this.isOpen = savedState ?? options.isOpen ?? false;
    }

    /**
     * Render the drawer element
     */
    render(): HTMLElement {
        this.drawerEl = document.createElement('div');
        this.drawerEl.className = `${CSS_PREFIX}-drawer${this.isOpen ? ' is-open' : ''}`;
        this.drawerEl.setAttribute('data-drawer-id', this.options.id);

        this.renderHeader(this.drawerEl);
        this.renderContent(this.drawerEl);

        return this.drawerEl;
    }

    /**
     * Render the drawer header
     */
    private renderHeader(container: HTMLElement): void {
        this.headerEl = container.createDiv({
            cls: `${CSS_PREFIX}-drawer-header`,
            attr: {
                role: 'button',
                tabindex: '0',
                'aria-expanded': String(this.isOpen),
                'aria-controls': `${this.options.id}-content`,
            },
        });

        this.headerEl.createSpan({
            cls: `${CSS_PREFIX}-drawer-icon`,
            text: this.options.icon,
        });

        this.headerEl.createEl('h3', {
            cls: `${CSS_PREFIX}-drawer-title`,
            text: this.options.title,
        });

        this.headerEl.createSpan({
            cls: `${CSS_PREFIX}-drawer-arrow`,
            text: '\u25BC', // ▼
        });

        this.headerEl.addEventListener('click', () => this.toggle());
        this.headerEl.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    /**
     * Render the drawer content
     */
    private renderContent(container: HTMLElement): void {
        const contentWrapper = container.createDiv({
            cls: `${CSS_PREFIX}-drawer-content`,
            attr: {
                id: `${this.options.id}-content`,
                role: 'region',
                'aria-labelledby': `${this.options.id}-header`,
            },
        });

        if (this.options.description) {
            contentWrapper.createDiv({
                cls: `${CSS_PREFIX}-section-desc`,
                text: this.options.description,
            });
        }

        this.contentEl = contentWrapper.createDiv({
            cls: `${CSS_PREFIX}-drawer-inner`,
        });
    }

    /**
     * Get the content element to add settings to
     */
    getContentElement(): HTMLElement {
        if (!this.contentEl) {
            throw new Error('Drawer must be rendered before accessing content');
        }
        return this.contentEl;
    }

    /**
     * Toggle drawer open/closed state
     */
    toggle(): void {
        this.isOpen = !this.isOpen;
        this.applyState();
        this.stateStore.set(this.options.id, this.isOpen);
        this.options.onToggle?.(this.isOpen);
    }

    /**
     * Open the drawer
     */
    open(): void {
        if (!this.isOpen) {
            this.toggle();
        }
    }

    /**
     * Close the drawer
     */
    close(): void {
        if (this.isOpen) {
            this.toggle();
        }
    }

    /**
     * Check if drawer is open
     */
    getIsOpen(): boolean {
        return this.isOpen;
    }

    /**
     * Show the drawer (remove hidden class)
     */
    show(): void {
        this.drawerEl?.classList.remove(`${CSS_PREFIX}-hidden`);
    }

    /**
     * Hide the drawer (add hidden class)
     */
    hide(): void {
        this.drawerEl?.classList.add(`${CSS_PREFIX}-hidden`);
    }

    /**
     * Check if drawer matches a search query
     * @param query Search query (lowercase)
     * @returns true if matches
     */
    matchesQuery(query: string): boolean {
        if (!query) return true;

        const title = this.options.title.toLowerCase();
        const description = (this.options.description ?? '').toLowerCase();
        const content = this.contentEl?.textContent?.toLowerCase() ?? '';

        return title.includes(query) || description.includes(query) || content.includes(query);
    }

    /**
     * Expand if matches query, otherwise hide
     */
    filterByQuery(query: string): void {
        const matches = this.matchesQuery(query);

        if (matches) {
            this.show();
            if (query) {
                this.open();
            }
        } else {
            this.hide();
        }
    }

    /**
     * Get the drawer element
     */
    getElement(): HTMLElement | null {
        return this.drawerEl;
    }

    /**
     * Apply current state to DOM
     */
    private applyState(): void {
        if (!this.drawerEl || !this.headerEl) return;

        if (this.isOpen) {
            this.drawerEl.classList.add('is-open');
        } else {
            this.drawerEl.classList.remove('is-open');
        }

        this.headerEl.setAttribute('aria-expanded', String(this.isOpen));
    }

    /**
     * Clean up event listeners and references
     */
    destroy(): void {
        this.drawerEl = null;
        this.contentEl = null;
        this.headerEl = null;
    }
}

/**
 * Factory function to create a drawer
 */
export function createDrawer(options: SettingsDrawerOptions): SettingsDrawer {
    return new SettingsDrawer(options);
}
