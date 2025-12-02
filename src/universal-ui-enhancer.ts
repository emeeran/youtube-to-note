
/**
 * Universal UI Enhancer - Works with ANY modal structure
 * Applies enhanced styling regardless of the specific CSS classes used
 */

export class UniversalUIEnhancer {
    private static instance: UniversalUIEnhancer;
    private enhancementTimeout: NodeJS.Timeout | null = null;
    private isEnhanced = false;

    private constructor() {
        this.startContinuousEnhancement();
    }

    static getInstance(): UniversalUIEnhancer {
        if (!UniversalUIEnhancer.instance) {
            UniversalUIEnhancer.instance = new UniversalUIEnhancer();
        }
        return UniversalUIEnhancer.instance;
    }

    /**
     * Start continuous enhancement to catch all modals
     */
    private startContinuousEnhancement(): void {
        // Enhance immediately
        this.enhanceAllUI();

        // Check every 100ms for new elements
        this.enhancementTimeout = setInterval(() => {
            this.enhanceAllUI();
        }, 100);
    }

    /**
     * Enhance ALL UI elements - universal approach
     */
    enhanceAllUI(): void {
        try {
            // Add enhanced styles first
            this.ensureEnhancedStyles();

            // Enhance ALL modals, buttons, inputs, and form elements
            this.enhanceAllModals();
            this.enhanceAllButtons();
            this.enhanceAllInputs();
            this.enhanceAllContainers();

            this.isEnhanced = true;
        } catch (error) {
            
}
    }

    /**
     * Ensure enhanced styles are applied
     */
    private ensureEnhancedStyles(): void {
        if (document.getElementById('universal-enhanced-styles')) {
            return; // Already applied
        }

        const style = document.createElement('style');
        style.id = 'universal-enhanced-styles';
        style.textContent = `
            /* UNIVERSAL ENHANCED UI STYLES - Works with any structure */

            /* Enhanced ALL Modals */
            .modal,
            .modal-content,
            .ytc-modal,
            .ytc-modal-content,
            div[style*="position: fixed"][style*="z-index"],
            div[style*="background"],
            body > div:not(.workspace) {
                border-radius: 16px !important;
                box-shadow: 0 25px 50px rgba(0,0,0,0.25) !important;
                backdrop-filter: blur(20px) !important;
                border: 1px solid var(--background-modifier-border) !important;
                animation: universalModalEntrance 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
            }

            @keyframes universalModalEntrance {
                0% {
                    opacity: 0;
                    transform: scale(0.8) translateY(30px);
                    filter: blur(10px);
                }
                100% {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                    filter: blur(0);
                }
            }

            /* Enhanced ALL Buttons */
            button,
            .ytc-modal-button,
            .mod-cta,
            input[type="button"],
            input[type="submit"] {
                position: relative !important;
                padding: 14px 28px !important;
                border-radius: 12px !important;
                font-weight: 600 !important;
                font-size: 0.95rem !important;
                letter-spacing: 0.3px !important;
                text-transform: uppercase !important;
                border: none !important;
                cursor: pointer !important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                overflow: hidden !important;
                z-index: 1 !important;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1) !important;
                margin: 4px !important;
            }

            button::before,
            .ytc-modal-button::before,
            .mod-cta::before {
                content: '' !important;
                position: absolute !important;
                top: 0 !important;
                left: -100% !important;
                width: 100% !important;
                height: 100% !important;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent) !important;
                transition: left 0.5s !important;
                z-index: -1 !important;
            }

            button:hover::before,
            .ytc-modal-button:hover::before,
            .mod-cta:hover::before {
                left: 100% !important;
            }

            /* Primary/Cta buttons */
            .mod-cta,
            button:has(> *:contains("Process")),
            button:has(> *:contains("Confirm")),
            button[style*="background: var(--interactive-accent)"],
            button:has(+ button) {
                background: linear-gradient(135deg, var(--interactive-accent), var(--interactive-accent-hover)) !important;
                color: white !important;
                box-shadow: 0 6px 20px rgba(var(--interactive-accent-rgb), 0.3) !important;
            }

            .mod-cta:hover,
            button:has(> *:contains("Process")):hover,
            button:has(> *:contains("Confirm")):hover,
            button[style*="background: var(--interactive-accent)"]:hover,
            button:has(+ button):hover {
                transform: translateY(-3px) scale(1.02) !important;
                box-shadow: 0 12px 30px rgba(var(--interactive-accent-rgb), 0.4) !important;
            }

            /* Secondary buttons */
            button:not(.mod-cta),
            .ytc-modal-button:not(.mod-cta) {
                background: var(--background-modifier-hover) !important;
                color: var(--text-normal) !important;
                border: 2px solid var(--background-modifier-border) !important;
            }

            button:not(.mod-cta):hover {
                background: var(--background-modifier-border) !important;
                transform: translateY(-2px) !important;
                box-shadow: 0 8px 25px rgba(0,0,0,0.1) !important;
            }

            /* Enhanced ALL Inputs */
            input[type="text"],
            input[type="url"],
            input[type="email"],
            input[type="password"],
            input[type="search"],
            textarea,
            select,
            .ytc-modal-input {
                width: 100% !important;
                padding: 16px 20px !important;
                border: 2px solid var(--background-modifier-border) !important;
                border-radius: 12px !important;
                font-size: 1rem !important;
                background: var(--background-primary) !important;
                color: var(--text-normal) !important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.06) !important;
                outline: none !important;
                margin: 8px 0 !important;
                box-sizing: border-box !important;
            }

            input:focus,
            textarea:focus,
            select:focus,
            .ytc-modal-input:focus {
                border-color: var(--interactive-accent) !important;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.06), 0 0 0 4px rgba(var(--interactive-accent-rgb), 0.15) !important;
                transform: translateY(-1px) !important;
            }

            input::placeholder,
            textarea::placeholder,
            .ytc-modal-input::placeholder {
                color: var(--text-muted) !important;
                font-style: italic !important;
            }

            /* Enhanced Labels and Text */
            label,
            h2,
            h3,
            .modal-title,
            .ytc-modal-header {
                font-weight: 600 !important;
                margin-bottom: 12px !important;
                color: var(--text-normal) !important;
                font-size: 1.1rem !important;
                text-transform: uppercase !important;
                letter-spacing: 0.5px !important;
            }

            h2.modal-title,
            .ytc-modal-header {
                font-size: 1.5rem !important;
                background: linear-gradient(135deg, var(--text-normal), var(--text-accent)) !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                background-clip: text !important;
            }

            /* Enhanced Containers */
            .modal-content > div,
            .ytc-modal-content > div,
            body > div:not(.workspace) > div {
                margin-bottom: 20px !important;
                padding: 16px !important;
                border-radius: 8px !important;
                background: var(--background-secondary) !important;
            }

            .modal-content > div:last-child,
            .ytc-modal-content > div:last-child,
            body > div:not(.workspace) > div:last-child {
                margin-bottom: 0 !important;
                background: transparent !important;
                padding: 0 !important;
            }

            /* Button containers */
            div:has(> button:last-child),
            .modal-content > div:has(> button),
            .ytc-modal-content > div:has(> .ytc-modal-button) {
                display: flex !important;
                gap: 12px !important;
                justify-content: flex-end !important;
                margin-top: 24px !important;
                padding-top: 20px !important;
                border-top: 1px solid var(--background-modifier-border) !important;
                background: transparent !important;
            }

            /* Hover effects for all interactive elements */
            button:hover,
            input:hover,
            textarea:hover,
            select:hover {
                transform: translateY(-1px) !important;
            }

            /* Loading states */
            .loading,
            button:disabled {
                opacity: 0.6 !important;
                cursor: not-allowed !important;
                position: relative !important;
            }

            .loading::after,
            button:disabled::after {
                content: '' !important;
                position: absolute !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                width: 20px !important;
                height: 20px !important;
                border: 3px solid transparent !important;
                border-top: 3px solid currentColor !important;
                border-radius: 50% !important;
                animation: universalSpin 1s linear infinite !important;
            }

            @keyframes universalSpin {
                0% { transform: translate(-50%, -50%) rotate(0deg); }
                100% { transform: translate(-50%, -50%) rotate(360deg); }
            }

            /* Mobile responsiveness */
            @media (max-width: 768px) {
                .modal,
                .modal-content {
                    margin: 10px !important;
                    max-width: calc(100vw - 20px) !important;
                    max-height: calc(100vh - 20px) !important;
                    border-radius: 12px !important;
                    padding: 20px !important;
                }

                button,
                .ytc-modal-button {
                    padding: 12px 20px !important;
                    font-size: 0.9rem !important;
                }

                input,
                textarea,
                select {
                    padding: 14px 16px !important;
                }

                div:has(> button:last-child),
                .modal-content > div:has(> button) {
                    flex-direction: column !important;
                }
            }

            /* High contrast mode */
            @media (prefers-contrast: high) {
                button,
                .ytc-modal-button {
                    border: 2px solid var(--text-normal) !important;
                }

                input,
                textarea,
                select,
                .ytc-modal-input {
                    border-width: 2px !important;
                }

                .modal,
                .ytc-modal {
                    border: 2px solid var(--text-normal) !important;
                }
            }

            /* Reduced motion support */
            @media (prefers-reduced-motion: reduce) {
                *,
                *::before,
                *::after {
                    animation: none !important;
                    transition: none !important;
                }

                button:hover,
                input:hover,
                textarea:hover {
                    transform: none !important;
                }
            }
        `;

        document.head.appendChild(style);
        
}

    /**
     * Enhance all modal elements - catch-all approach
     */
    private enhanceAllModals(): void {
        // Find ANY element that could be a modal
        const potentialModals = document.querySelectorAll(`
            .modal,
            .ytc-modal,
            div[style*="position: fixed"],
            div[style*="z-index: 10"],
            div[style*="background: var(--background-primary)"],
            body > div:not(.workspace):not(.workspace-leaf):not(.workspace-split)
        `);

        potentialModals.forEach(modal => {
            const element = modal as HTMLElement;

            // Skip if this is definitely not a modal
            if (this.isNotAModal(element)) {
                return;
            }

            // Add enhanced classes
            element.classList.add('universal-enhanced-modal');

            // Add enhanced attributes for debugging
            if (!element.hasAttribute('data-universal-enhanced')) {
                element.setAttribute('data-universal-enhanced', 'true');
            }
        });
    }

    /**
     * Check if element is definitely NOT a modal
     */
    private isNotAModal(element: HTMLElement): boolean {
        // Skip workspace elements
        if (element.closest('.workspace')) {
            return true;
        }

        // Skip very small elements
        const rect = element.getBoundingClientRect();
        if (rect.width < 200 || rect.height < 100) {
            return true;
        }

        // Skip elements that are clearly not modals
        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
            return true;
        }

        return false;
    }

    /**
     * Enhance all buttons
     */
    private enhanceAllButtons(): void {
        const buttons = document.querySelectorAll(`
            button,
            .ytc-modal-button,
            .mod-cta,
            input[type="button"],
            input[type="submit"]
        `);

        buttons.forEach(button => {
            const element = button as HTMLElement;

            if (!element.hasAttribute('data-universal-enhanced')) {
                element.classList.add('universal-enhanced-button');
                element.setAttribute('data-universal-enhanced', 'true');
            }
        });
    }

    /**
     * Enhance all inputs
     */
    private enhanceAllInputs(): void {
        const inputs = document.querySelectorAll(`
            input[type="text"],
            input[type="url"],
            input[type="email"],
            input[type="password"],
            input[type="search"],
            textarea,
            select,
            .ytc-modal-input
        `);

        inputs.forEach(input => {
            const element = input as HTMLElement;

            if (!element.hasAttribute('data-universal-enhanced')) {
                element.classList.add('universal-enhanced-input');
                element.setAttribute('data-universal-enhanced', 'true');
            }
        });
    }

    /**
     * Enhance all containers
     */
    private enhanceAllContainers(): void {
        const containers = document.querySelectorAll(`
            .modal-content,
            .ytc-modal-content,
            div:has(> button),
            div:has(> input),
            div:has(> label)
        `);

        containers.forEach(container => {
            const element = container as HTMLElement;

            if (!element.hasAttribute('data-universal-enhanced')) {
                element.classList.add('universal-enhanced-container');
                element.setAttribute('data-universal-enhanced', 'true');
            }
        });
    }

    /**
     * Force enhancement right now
     */
    forceEnhancement(): void {
        
this.enhanceAllUI();

        // Log enhanced elements for debugging
        const enhancedModals = document.querySelectorAll('[data-universal-enhanced="true"]');
        const enhancedButtons = document.querySelectorAll('.universal-enhanced-button');
        const enhancedInputs = document.querySelectorAll('.universal-enhanced-input');

        
// Show notification
        if (typeof window !== 'undefined' && window.app) {
            const { Notice } = require('obsidian');
            new Notice(`✨ Enhanced UI applied to ${enhancedModals.length + enhancedButtons.length + enhancedInputs.length} elements`);
        }
    }

    /**
     * Check if enhancement is active
     */
    isEnhancementActive(): boolean {
        return this.isEnhanced && document.getElementById('universal-enhanced-styles') !== null;
    }

    /**
     * Cleanup
     */
    destroy(): void {
        if (this.enhancementTimeout) {
            clearInterval(this.enhancementTimeout);
            this.enhancementTimeout = null;
        }

        // Remove enhanced styles
        const styles = document.getElementById('universal-enhanced-styles');
        if (styles) {
            styles.remove();
        }

        this.isEnhanced = false;
        
}
}

// Export singleton instance
export const universalUIEnhancer = UniversalUIEnhancer.getInstance();