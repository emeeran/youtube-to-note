
/**
 * Simple UI Enhancer - Minimal, working implementation
 */

export class SimpleEnhancer {
    private static instance: SimpleEnhancer;
    private intervalId: NodeJS.Timeout | null = null;

    private constructor() {
        this.startEnhancement();
    }

    static getInstance(): SimpleEnhancer {
        if (!SimpleEnhancer.instance) {
            SimpleEnhancer.instance = new SimpleEnhancer();
        }
        return SimpleEnhancer.instance;
    }

    private startEnhancement(): void {
        // Add enhanced styles immediately
        this.addStyles();

        // Enhance existing elements
        this.enhanceElements();

        // Keep enhancing new elements
        this.intervalId = setInterval(() => {
            this.enhanceElements();
        }, 200);
    }

    private addStyles(): void {
        if (document.getElementById('simple-enhanced-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'simple-enhanced-styles';
        style.textContent = `
            /* Enhanced Modal Styles */
            .modal,
            .modal-content {
                border-radius: 16px !important;
                box-shadow: 0 25px 50px rgba(0,0,0,0.25) !important;
                animation: modalFadeIn 0.3s ease !important;
                border: 1px solid var(--background-modifier-border) !important;
            }

            @keyframes modalFadeIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }

            /* Enhanced Buttons */
            button,
            .ytc-modal-button,
            .mod-cta {
                border-radius: 12px !important;
                font-weight: 600 !important;
                padding: 12px 24px !important;
                border: none !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1) !important;
            }

            button:hover,
            .ytc-modal-button:hover,
            .mod-cta:hover {
                transform: translateY(-2px) !important;
                box-shadow: 0 8px 25px rgba(0,0,0,0.15) !important;
            }

            .mod-cta {
                background: var(--interactive-accent) !important;
                color: white !important;
            }

            .mod-cta:hover {
                background: var(--interactive-accent-hover) !important;
            }

            /* Enhanced Inputs */
            input,
            textarea,
            select,
            .ytc-modal-input {
                border-radius: 8px !important;
                border: 2px solid var(--background-modifier-border) !important;
                padding: 10px 16px !important;
                transition: all 0.2s ease !important;
                outline: none !important;
            }

            input:focus,
            textarea:focus,
            select:focus {
                border-color: var(--interactive-accent) !important;
                box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.2) !important;
            }

            /* Enhanced Content Layout */
            .modal-content > div {
                margin-bottom: 16px !important;
            }

            .modal-content > div:last-child {
                display: flex !important;
                gap: 12px !important;
                justify-content: flex-end !important;
            }
        `;

        document.head.appendChild(style);
        
}

    private enhanceElements(): void {
        // Add enhanced class to modals
        document.querySelectorAll('.modal, .modal-content').forEach((el) => {
            el.classList.add('simple-enhanced');
        });

        // Add enhanced class to buttons
        document.querySelectorAll('button, .ytc-modal-button').forEach((el) => {
            el.classList.add('simple-enhanced-button');
        });

        // Add enhanced class to inputs
        document.querySelectorAll('input, textarea, select, .ytc-modal-input').forEach((el) => {
            el.classList.add('simple-enhanced-input');
        });
    }

    forceEnhancement(): void {
        
this.enhanceElements();
    }

    destroy(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        const styles = document.getElementById('simple-enhanced-styles');
        if (styles) {
            styles.remove();
        }
    }
}

export const simpleEnhancer = SimpleEnhancer.getInstance();