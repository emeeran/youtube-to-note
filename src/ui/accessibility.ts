

/**
 * Accessibility Manager for comprehensive a11y support
 */
export class AccessibilityManager {
    private static instance: AccessibilityManager;
    private announceElement: HTMLElement | null = null;
    private focusTrapElements: HTMLElement[] = [];
    private currentFocusTrap: HTMLElement | null = null;
    private keyboardHandlers: Map<string, (e: KeyboardEvent) => void> = new Map();
    private liveRegions: Map<string, HTMLElement> = new Map();

    private constructor() {
        this.initializeAnnounceRegion();
        this.setupGlobalKeyboardHandlers();
        this.enhanceObsidianAccessibility();
    }

    static getInstance(): AccessibilityManager {
        if (!AccessibilityManager.instance) {
            AccessibilityManager.instance = new AccessibilityManager();
        }
        return AccessibilityManager.instance;
    }

    /**
     * Initialize screen reader announcement region
     */
    private initializeAnnounceRegion(): void {
        this.announceElement = document.createElement('div');
        this.announceElement.setAttribute('aria-live', 'polite');
        this.announceElement.setAttribute('aria-atomic', 'true');
        this.announceElement.className = 'sr-announce';
        this.announceElement.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
            top: 0;
        `;
        document.body.appendChild(this.announceElement);
    }

    /**
     * Setup global keyboard navigation handlers
     */
    private setupGlobalKeyboardHandlers(): void {
        // Escape key handler
        const escapeHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.handleEscape();
            }
        };

        // Tab navigation enhancement
        const tabHandler = (e: KeyboardEvent) => {
            if (e.key === 'Tab') {
                this.handleTabNavigation(e);
            }
        };

        // Skip to main content
        const skipHandler = (e: KeyboardEvent) => {
            if (e.altKey && e.key === 'm') {
                e.preventDefault();
                this.skipToMainContent();
            }
        };

        document.addEventListener('keydown', escapeHandler);
        document.addEventListener('keydown', tabHandler);
        document.addEventListener('keydown', skipHandler);

        this.keyboardHandlers.set('escape', escapeHandler);
        this.keyboardHandlers.set('tab', tabHandler);
        this.keyboardHandlers.set('skip', skipHandler);
    }

    /**
     * Enhance Obsidian's accessibility
     */
    private enhanceObsidianAccessibility(): void {
        // Add skip links
        this.addSkipLinks();

        // Enhance focus management
        this.enhanceFocusManagement();

        // Add ARIA landmarks
        this.addARIALandmarks();

        // Improve color contrast
        this.improveColorContrast();
    }

    /**
     * Add skip links for keyboard navigation
     */
    private addSkipLinks(): void {
        const skipLinks = document.createElement('div');
        skipLinks.className = 'yt-skip-links';
        skipLinks.innerHTML = `
            <a href="#main-content" class="skip-link">Skip to main content</a>
            <a href="#sidebar" class="skip-link">Skip to sidebar</a>
            <a href="#ribbon" class="skip-link">Skip to ribbon</a>
        `;

        skipLinks.style.cssText = `
            position: fixed;
            top: -100px;
            left: 0;
            z-index: 999999;
            background: var(--background-primary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            padding: 8px;
        `;

        const style = document.createElement('style');
        style.textContent = `
            .yt-skip-links a:focus {
                top: 0;
                display: block;
                color: var(--text-normal);
                text-decoration: none;
                margin: 2px 0;
                padding: 8px;
                border-radius: 4px;
            }

            .skip-link {
                display: block;
                color: var(--text-normal);
                text-decoration: none;
                margin: 2px 0;
                padding: 8px;
                border-radius: 4px;
            }

            .skip-link:hover, .skip-link:focus {
                background: var(--background-modifier-hover);
                outline: 2px solid var(--interactive-accent);
                outline-offset: 2px;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(skipLinks);
    }

    /**
     * Enhance focus management
     */
    private enhanceFocusManagement(): void {
        // Improve focus visibility
        const style = document.createElement('style');
        style.textContent = `
            :focus {
                outline: 2px solid var(--interactive-accent) !important;
                outline-offset: 2px !important;
            }

            :focus:not(:focus-visible) {
                outline: none !important;
            }

            :focus-visible {
                outline: 2px solid var(--interactive-accent) !important;
                outline-offset: 2px !important;
            }

            /* Reduce motion for users who prefer it */
            @media (prefers-reduced-motion: reduce) {
                *, *::before, *::after {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                    scroll-behavior: auto !important;
                }
            }

            /* High contrast mode support */
            @media (prefers-contrast: high) {
                .yt-card {
                    border: 2px solid var(--text-normal) !important;
                }

                .yt-button {
                    border: 2px solid var(--text-normal) !important;
                }
            }
        `;
        document.head.appendChild(style);

        // Add focus indicators to interactive elements
        this.addFocusIndicators();
    }

    /**
     * Add ARIA landmarks to improve navigation
     */
    private addARIALandmarks(): void {
        // Add main landmark
        const mainContent = document.querySelector('.workspace-leaf') || document.querySelector('.main-content');
        if (mainContent) {
            mainContent.setAttribute('id', 'main-content');
            mainContent.setAttribute('role', 'main');
        }

        // Add navigation landmark
        const nav = document.querySelector('.nav-buttons-container') || document.querySelector('nav');
        if (nav) {
            nav.setAttribute('role', 'navigation');
            nav.setAttribute('aria-label', 'Main navigation');
        }

        // Add banner landmark
        const header = document.querySelector('.workspace-ribbon.mod-left') || document.querySelector('header');
        if (header) {
            header.setAttribute('role', 'banner');
            header.setAttribute('aria-label', 'Application header');
        }
    }

    /**
     * Improve color contrast for better readability
     */
    private improveColorContrast(): void {
        const style = document.createElement('style');
        style.textContent = `
            /* Ensure text meets WCAG AA contrast ratios */
            .yt-text-muted {
                color: var(--text-muted) !important;
                opacity: 0.8 !important;
            }

            .yt-button-secondary {
                border: 1px solid var(--interactive-accent) !important;
            }

            /* Enhance link visibility */
            a {
                text-decoration: underline !important;
                text-decoration-thickness: 1px !important;
                text-underline-offset: 2px !important;
            }

            a:hover {
                text-decoration-thickness: 2px !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Add focus indicators to interactive elements
     */
    private addFocusIndicators(): void {
        const interactiveElements = document.querySelectorAll('button, input, select, textarea, a, [tabindex]:not([tabindex="-1"])');

        interactiveElements.forEach(element => {
            const htmlElement = element as HTMLElement;

            // Ensure elements are focusable
            if (htmlElement.tabIndex < 0 && !htmlElement.getAttribute('aria-hidden')) {
                htmlElement.tabIndex = 0;
            }

            // Add ARIA attributes where missing
            this.addMissingARIA(htmlElement);
        });
    }

    /**
     * Add missing ARIA attributes
     */
    private addMissingARIA(element: HTMLElement): void {
        // Add aria-label for buttons without text content
        if (element.tagName === 'BUTTON' && !element.textContent?.trim()) {
            const icon = element.querySelector('svg');
            if (icon) {
                const ariaLabel = icon.getAttribute('aria-label') || this.generateARIALabel(icon);
                element.setAttribute('aria-label', ariaLabel);
            }
        }

        // Add role for interactive divs
        if (element.tagName === 'DIV' && element.onclick) {
            if (!element.getAttribute('role')) {
                element.setAttribute('role', 'button');
                element.setAttribute('tabindex', '0');

                // Add keyboard support
                element.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        element.click();
                    }
                });
            }
        }

        // Add aria-expanded for dropdown triggers
        if (element.classList.contains('dropdown-trigger') || element.getAttribute('data-dropdown')) {
            if (!element.getAttribute('aria-expanded')) {
                element.setAttribute('aria-expanded', 'false');
            }
        }
    }

    /**
     * Generate ARIA label from icon class or content
     */
    private generateARIALabel(icon: Element): string {
        const className = icon.className?.toString() || '';

        if (className.includes('film')) return 'Process video';
        if (className.includes('settings')) return 'Settings';
        if (className.includes('search')) return 'Search';
        if (className.includes('close')) return 'Close';
        if (className.includes('menu')) return 'Menu';
        if (className.includes('help')) return 'Help';
        if (className.includes('download')) return 'Download';
        if (className.includes('upload')) return 'Upload';
        if (className.includes('edit')) return 'Edit';
        if (className.includes('delete')) return 'Delete';
        if (className.includes('save')) return 'Save';
        if (className.includes('cancel')) return 'Cancel';
        if (className.includes('confirm')) return 'Confirm';

        return 'Button';
    }

    /**
     * Announce messages to screen readers
     */
    announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
        if (!this.announceElement) return;

        // Create temporary announcement element for assertive messages
        if (priority === 'assertive') {
            const assertiveElement = document.createElement('div');
            assertiveElement.setAttribute('aria-live', 'assertive');
            assertiveElement.setAttribute('aria-atomic', 'true');
            assertiveElement.style.cssText = this.announceElement.style.cssText;
            document.body.appendChild(assertiveElement);

            assertiveElement.textContent = message;
            setTimeout(() => {
                document.body.removeChild(assertiveElement);
            }, 1000);
        } else {
            this.announceElement.textContent = message;
            setTimeout(() => {
                if (this.announceElement) {
                    this.announceElement.textContent = '';
                }
            }, 1000);
        }
    }

    /**
     * Create focus trap within a container
     */
    createFocusTrap(container: HTMLElement): void {
        this.currentFocusTrap = container;
        this.focusTrapElements = Array.from(container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )) as HTMLElement[];

        if (this.focusTrapElements.length === 0) return;

        // Focus first element
        this.focusTrapElements[0].focus();

        // Trap focus
        const trapFocus = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            const firstElement = this.focusTrapElements[0];
            const lastElement = this.focusTrapElements[this.focusTrapElements.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        container.addEventListener('keydown', trapFocus);
        (container as any).focusTrapHandler = trapFocus;
    }

    /**
     * Remove focus trap
     */
    removeFocusTrap(container: HTMLElement): void {
        if ((container as any).focusTrapHandler) {
            container.removeEventListener('keydown', (container as any).focusTrapHandler);
            delete (container as any).focusTrapHandler;
        }

        if (this.currentFocusTrap === container) {
            this.currentFocusTrap = null;
            this.focusTrapElements = [];
        }
    }

    /**
     * Handle escape key
     */
    private handleEscape(): void {
        // Close modals and dropdowns
        const modals = document.querySelectorAll('.yt-modal.is-open');
        modals.forEach(modal => {
            (modal as any).close?.();
        });

        // Remove focus traps
        if (this.currentFocusTrap) {
            this.removeFocusTrap(this.currentFocusTrap);
        }

        this.announce('Modal closed');
    }

    /**
     * Handle tab navigation
     */
    private handleTabNavigation(e: KeyboardEvent): void {
        // Skip hidden elements
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && activeElement.offsetParent === null) {
            e.preventDefault();
            this.focusNextVisibleElement(e.shiftKey);
        }
    }

    /**
     * Focus next visible element
     */
    private focusNextVisibleElement(reverse = false): void {
        const focusableElements = Array.from(document.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )) as HTMLElement[];

        const visibleElements = focusableElements.filter(el =>
            el.offsetParent !== null &&
            !el.getAttribute('aria-hidden') &&
            el.style.display !== 'none'
        );

        const currentIndex = visibleElements.indexOf(document.activeElement as HTMLElement);
        const nextIndex = reverse ? currentIndex - 1 : currentIndex + 1;
        const nextElement = visibleElements[nextIndex] || visibleElements[reverse ? visibleElements.length - 1 : 0];

        if (nextElement) {
            nextElement.focus();
        }
    }

    /**
     * Skip to main content
     */
    private skipToMainContent(): void {
        const mainContent = document.getElementById('main-content') || document.querySelector('.workspace-leaf');
        if (mainContent) {
            (mainContent as HTMLElement).focus();
            this.announce('Skipped to main content');
        }
    }

    /**
     * Create or get a live region
     */
    getLiveRegion(id: string, polite = true): HTMLElement {
        if (this.liveRegions.has(id)) {
            return this.liveRegions.get(id)!;
        }

        const region = document.createElement('div');
        region.setAttribute('aria-live', polite ? 'polite' : 'assertive');
        region.setAttribute('aria-atomic', 'true');
        region.className = `yt-live-region-${id}`;
        region.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;

        document.body.appendChild(region);
        this.liveRegions.set(id, region);
        return region;
    }

    /**
     * Update live region content
     */
    updateLiveRegion(id: string, content: string): void {
        const region = this.liveRegions.get(id);
        if (region) {
            region.textContent = content;
        }
    }

    /**
     * Remove live region
     */
    removeLiveRegion(id: string): void {
        const region = this.liveRegions.get(id);
        if (region) {
            document.body.removeChild(region);
            this.liveRegions.delete(id);
        }
    }

    /**
     * Add keyboard navigation to custom components
     */
    enhanceComponentKeyboardNavigation(element: HTMLElement): void {
        // Add roving tabindex for lists
        if (element.classList.contains('yt-list') || element.getAttribute('role') === 'list') {
            this.enhanceListNavigation(element);
        }

        // Add grid navigation
        if (element.classList.contains('yt-grid') || element.getAttribute('role') === 'grid') {
            this.enhanceGridNavigation(element);
        }

        // Add menu navigation
        if (element.classList.contains('yt-menu') || element.getAttribute('role') === 'menu') {
            this.enhanceMenuNavigation(element);
        }
    }

    /**
     * Enhance list keyboard navigation
     */
    private enhanceListNavigation(list: HTMLElement): void {
        const items = list.querySelectorAll('[role="listitem"], .yt-list-item') as NodeListOf<HTMLElement>;

        items.forEach((item, index) => {
            item.tabIndex = index === 0 ? 0 : -1;

            item.addEventListener('keydown', (e) => {
                switch (e.key) {
                    case 'ArrowDown':
                    case 'j':
                        e.preventDefault();
                        this.focusListItem(items, index + 1);
                        break;
                    case 'ArrowUp':
                    case 'k':
                        e.preventDefault();
                        this.focusListItem(items, index - 1);
                        break;
                    case 'Home':
                        e.preventDefault();
                        this.focusListItem(items, 0);
                        break;
                    case 'End':
                        e.preventDefault();
                        this.focusListItem(items, items.length - 1);
                        break;
                }
            });
        });
    }

    /**
     * Enhance grid keyboard navigation
     */
    private enhanceGridNavigation(grid: HTMLElement): void {
        const cells = grid.querySelectorAll('[role="gridcell"], .yt-grid-cell') as NodeListOf<HTMLElement>;
        const columns = Math.sqrt(cells.length); // Assume square grid

        cells.forEach((cell, index) => {
            cell.tabIndex = index === 0 ? 0 : -1;

            cell.addEventListener('keydown', (e) => {
                const row = Math.floor(index / columns);
                const col = index % columns;

                switch (e.key) {
                    case 'ArrowRight':
                    case 'l':
                        e.preventDefault();
                        if (col < columns - 1) this.focusGridCell(cells, index + 1);
                        break;
                    case 'ArrowLeft':
                    case 'h':
                        e.preventDefault();
                        if (col > 0) this.focusGridCell(cells, index - 1);
                        break;
                    case 'ArrowDown':
                    case 'j':
                        e.preventDefault();
                        if (row < Math.floor(cells.length / columns) - 1) {
                            this.focusGridCell(cells, index + columns);
                        }
                        break;
                    case 'ArrowUp':
                    case 'k':
                        e.preventDefault();
                        if (row > 0) this.focusGridCell(cells, index - columns);
                        break;
                }
            });
        });
    }

    /**
     * Enhance menu keyboard navigation
     */
    private enhanceMenuNavigation(menu: HTMLElement): void {
        const items = menu.querySelectorAll('[role="menuitem"], .yt-menu-item') as NodeListOf<HTMLElement>;

        items.forEach((item, index) => {
            item.tabIndex = index === 0 ? 0 : -1;

            item.addEventListener('keydown', (e) => {
                switch (e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        this.focusMenuItem(items, index + 1);
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        this.focusMenuItem(items, index - 1);
                        break;
                    case 'Home':
                        e.preventDefault();
                        this.focusMenuItem(items, 0);
                        break;
                    case 'End':
                        e.preventDefault();
                        this.focusMenuItem(items, items.length - 1);
                        break;
                    case 'Enter':
                    case ' ':
                        e.preventDefault();
                        item.click();
                        break;
                }
            });
        });
    }

    /**
     * Focus list item
     */
    private focusListItem(items: NodeListOf<HTMLElement>, index: number): void {
        if (index >= 0 && index < items.length) {
            items.forEach(item => item.tabIndex = -1);
            items[index].tabIndex = 0;
            items[index].focus();
        }
    }

    /**
     * Focus grid cell
     */
    private focusGridCell(cells: NodeListOf<HTMLElement>, index: number): void {
        if (index >= 0 && index < cells.length) {
            cells.forEach(cell => cell.tabIndex = -1);
            cells[index].tabIndex = 0;
            cells[index].focus();
        }
    }

    /**
     * Focus menu item
     */
    private focusMenuItem(items: NodeListOf<HTMLElement>, index: number): void {
        if (index >= 0 && index < items.length) {
            items.forEach(item => item.tabIndex = -1);
            items[index].tabIndex = 0;
            items[index].focus();
        }
    }

    /**
     * Cleanup and remove accessibility enhancements
     */
    destroy(): void {
        // Remove announce element
        if (this.announceElement) {
            document.body.removeChild(this.announceElement);
            this.announceElement = null;
        }

        // Remove keyboard handlers
        this.keyboardHandlers.forEach((handler) => {
            document.removeEventListener('keydown', handler);
        });
        this.keyboardHandlers.clear();

        // Remove live regions
        this.liveRegions.forEach((region) => {
            document.body.removeChild(region);
        });
        this.liveRegions.clear();

        // Remove focus traps
        if (this.currentFocusTrap) {
            this.removeFocusTrap(this.currentFocusTrap);
        }
    }
}

// Export singleton instance
export const accessibilityManager = AccessibilityManager.getInstance();

// Export utility functions
export const a11y = {
    announce: (message: string, priority?: 'polite' | 'assertive') =>
        accessibilityManager.announce(message, priority),

    createFocusTrap: (container: HTMLElement) =>
        accessibilityManager.createFocusTrap(container),

    removeFocusTrap: (container: HTMLElement) =>
        accessibilityManager.removeFocusTrap(container),

    enhanceComponent: (element: HTMLElement) =>
        accessibilityManager.enhanceComponentKeyboardNavigation(element),

    getLiveRegion: (id: string, polite?: boolean) =>
        accessibilityManager.getLiveRegion(id, polite),

    updateLiveRegion: (id: string, content: string) =>
        accessibilityManager.updateLiveRegion(id, content),

    removeLiveRegion: (id: string) =>
        accessibilityManager.removeLiveRegion(id)
};