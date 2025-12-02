
/**
 * Modal Enhancer - Automatically applies enhanced UI to all modals
 */

export class ModalEnhancer {
    private static instance: ModalEnhancer;
    private observer: MutationObserver | null = null;
    private enhancementInterval: NodeJS.Timeout | null = null;
    private isEnhanced = false;

    private constructor() {
        this.setupObserver();
        this.setupInterval();
    }

    static getInstance(): ModalEnhancer {
        if (!ModalEnhancer.instance) {
            ModalEnhancer.instance = new ModalEnhancer();
        }
        return ModalEnhancer.instance;
    }

    /**
     * Setup mutation observer to detect new modals
     */
    private setupObserver(): void {
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as Element;

                        // Check if this is a modal or contains modals
                        if (element.classList?.contains('ytc-modal') ||
                            element.classList?.contains('modal') ||
                            element.querySelector('.ytc-modal, .modal')) {
                            this.enhanceModal(element as HTMLElement);
                        }
                    }
                });
            });
        });

        // Start observing the body for added nodes
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Setup interval to periodically check for modals
     */
    private setupInterval(): void {
        this.enhancementInterval = setInterval(() => {
            this.enhanceAllModals();
        }, 500);
    }

    /**
     * Enhance a specific modal element
     */
    private enhanceModal(modalElement: HTMLElement): void {
        if (!modalElement || modalElement.hasAttribute('data-enhanced-ui')) {
            return; // Already enhanced
        }

        try {
            // Mark as enhanced
            modalElement.setAttribute('data-enhanced-ui', 'true');

            // Add enhanced UI classes
            modalElement.classList.add('ytc-modal', 'yt-enhanced');

            // Enhance modal content
            const contentEl = modalElement.querySelector('.modal-content') as HTMLElement;
            if (contentEl) {
                contentEl.classList.add('ytc-modal-content', 'yt-enhanced');
                this.enhanceContent(contentEl);
            }

            // Enhance modal header
            const headerEl = modalElement.querySelector('.modal-content > h2, .modal-header, .ytc-modal-header') as HTMLElement;
            if (headerEl) {
                headerEl.classList.add('ytc-modal-header', 'yt-enhanced');
            }

            
} catch (error) {
            
}
    }

    /**
     * Enhance modal content
     */
    private enhanceContent(contentEl: HTMLElement): void {
        // Enhance all buttons
        const buttons = contentEl.querySelectorAll('button, .ytc-modal-button');
        buttons.forEach(button => {
            const btn = button as HTMLElement;
            btn.classList.add('yt-enhanced-ui-button');

            // Add primary/secondary styling based on existing classes
            if (btn.classList.contains('mod-cta') || btn.classList.contains('primary')) {
                btn.classList.add('primary');
            } else {
                btn.classList.add('secondary');
            }

            // Add hover effects
            this.addButtonEffects(btn);
        });

        // Enhance all inputs
        const inputs = contentEl.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            const inp = input as HTMLElement;
            inp.classList.add('yt-enhanced-ui-input');
            this.addInputEffects(inp);
        });

        // Enhance all labels
        const labels = contentEl.querySelectorAll('label');
        labels.forEach(label => {
            label.classList.add('yt-enhanced-ui-label');
        });
    }

    /**
     * Add hover effects to buttons
     */
    private addButtonEffects(button: HTMLElement): void {
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '';
        });

        button.addEventListener('mousedown', () => {
            button.style.transform = 'translateY(0) scale(0.98)';
        });

        button.addEventListener('mouseup', () => {
            button.style.transform = 'translateY(-2px) scale(1)';
        });
    }

    /**
     * Add focus effects to inputs
     */
    private addInputEffects(input: HTMLElement): void {
        input.addEventListener('focus', () => {
            input.style.borderColor = 'var(--interactive-accent)';
            input.style.boxShadow = '0 0 0 3px rgba(var(--interactive-accent-rgb), 0.1)';
            input.style.outline = 'none';
        });

        input.addEventListener('blur', () => {
            input.style.borderColor = '';
            input.style.boxShadow = '';
            input.style.outline = '';
        });
    }

    /**
     * Enhance all existing modals
     */
    private enhanceAllModals(): void {
        const modals = document.querySelectorAll('.modal, .ytc-modal');
        modals.forEach(modal => {
            this.enhanceModal(modal as HTMLElement);
        });
    }

    /**
     * Force enhancement of current UI
     */
    forceEnhancement(): void {
        
// Add enhanced UI styles if not already present
        this.addEnhancedStyles();

        // Enhance all current modals
        this.enhanceAllModals();

        // Enhance any standalone buttons or inputs
        this.enhanceStandaloneElements();

        
}

    /**
     * Add enhanced UI styles to the document
     */
    private addEnhancedStyles(): void {
        if (document.getElementById('yt-enhanced-ui-styles')) {
            return; // Already added
        }

        const style = document.createElement('style');
        style.id = 'yt-enhanced-ui-styles';
        style.textContent = `
            /* Enhanced Modal Base Styles */
            .ytc-modal.yt-enhanced,
            .modal.yt-enhanced {
                border-radius: 16px !important;
                box-shadow: 0 25px 50px rgba(0,0,0,0.25) !important;
                backdrop-filter: blur(20px) !important;
                border: 1px solid var(--background-modifier-border) !important;
                animation: modalEnhancedEntrance 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
                max-width: 90vw !important;
                max-height: 90vh !important;
            }

            @keyframes modalEnhancedEntrance {
                0% {
                    opacity: 0;
                    transform: scale(0.8) translateY(30px);
                    filter: blur(10px);
                }
                50% {
                    filter: blur(5px);
                }
                100% {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                    filter: blur(0);
                }
            }

            /* Enhanced Modal Content */
            .ytc-modal-content.yt-enhanced,
            .modal-content.yt-enhanced {
                padding: 32px !important;
                animation: contentEnhancedSlideIn 0.5s ease 0.2s both !important;
                background: var(--background-primary) !important;
                border-radius: 16px !important;
            }

            @keyframes contentEnhancedSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(40px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            /* Enhanced Headers */
            .ytc-modal-header.yt-enhanced,
            .modal-header.yt-enhanced {
                margin-bottom: 24px !important;
                padding-bottom: 20px !important;
                border-bottom: 2px solid var(--background-modifier-border) !important;
                font-size: 1.5rem !important;
                font-weight: 600 !important;
                color: var(--text-normal) !important;
                background: linear-gradient(135deg, var(--text-normal), var(--text-accent)) !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                background-clip: text !important;
            }

            /* Enhanced Labels */
            .yt-enhanced-ui-label {
                display: block !important;
                font-weight: 600 !important;
                margin-bottom: 8px !important;
                color: var(--text-normal) !important;
                font-size: 0.95rem !important;
                text-transform: uppercase !important;
                letter-spacing: 0.5px !important;
            }

            /* Enhanced Buttons */
            .yt-enhanced-ui-button {
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
            }

            .yt-enhanced-ui-button::before {
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

            .yt-enhanced-ui-button:hover::before {
                left: 100% !important;
            }

            .yt-enhanced-ui-button.primary {
                background: linear-gradient(135deg, var(--interactive-accent), var(--interactive-accent-hover)) !important;
                color: white !important;
                box-shadow: 0 6px 20px rgba(var(--interactive-accent-rgb), 0.3) !important;
            }

            .yt-enhanced-ui-button.primary:hover {
                transform: translateY(-3px) scale(1.02) !important;
                box-shadow: 0 12px 30px rgba(var(--interactive-accent-rgb), 0.4) !important;
            }

            .yt-enhanced-ui-button.secondary {
                background: var(--background-modifier-hover) !important;
                color: var(--text-normal) !important;
                border: 2px solid var(--background-modifier-border) !important;
                box-shadow: 0 4px 15px rgba(0,0,0,0.05) !important;
            }

            .yt-enhanced-ui-button.secondary:hover {
                background: var(--background-modifier-border) !important;
                transform: translateY(-2px) !important;
                box-shadow: 0 8px 25px rgba(0,0,0,0.1) !important;
            }

            /* Enhanced Inputs */
            .yt-enhanced-ui-input {
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
            }

            .yt-enhanced-ui-input:focus {
                border-color: var(--interactive-accent) !important;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.06), 0 0 0 4px rgba(var(--interactive-accent-rgb), 0.15) !important;
                transform: translateY(-1px) !important;
            }

            .yt-enhanced-ui-input::placeholder {
                color: var(--text-muted) !important;
                font-style: italic !important;
            }

            /* Container spacing */
            .yt-enhanced .ytc-modal-content > div,
            .yt-enhanced .modal-content > div {
                margin-bottom: 20px !important;
            }

            .yt-enhanced .ytc-modal-content > div:last-child,
            .yt-enhanced .modal-content > div:last-child {
                margin-bottom: 0 !important;
            }

            /* Button container styling */
            .yt-enhanced .ytc-modal-content > div:last-child,
            .yt-enhanced .modal-content > div:last-child {
                display: flex !important;
                gap: 12px !important;
                justify-content: flex-end !important;
                margin-top: 24px !important;
                padding-top: 20px !important;
                border-top: 1px solid var(--background-modifier-border) !important;
            }

            /* Mobile Responsiveness */
            @media (max-width: 768px) {
                .ytc-modal.yt-enhanced,
                .modal.yt-enhanced {
                    margin: 10px !important;
                    max-width: calc(100vw - 20px) !important;
                    max-height: calc(100vh - 20px) !important;
                    border-radius: 12px !important;
                }

                .ytc-modal-content.yt-enhanced,
                .modal-content.yt-enhanced {
                    padding: 20px !important;
                }

                .yt-enhanced-ui-button {
                    padding: 12px 20px !important;
                    font-size: 0.9rem !important;
                }

                .yt-enhanced-ui-input {
                    padding: 14px 16px !important;
                }

                .yt-enhanced .ytc-modal-content > div:last-child,
                .yt-enhanced .modal-content > div:last-child {
                    flex-direction: column !important;
                }
            }

            /* High Contrast Mode */
            @media (prefers-contrast: high) {
                .yt-enhanced-ui-button {
                    border: 2px solid var(--text-normal) !important;
                }

                .yt-enhanced-ui-input {
                    border-width: 2px !important;
                }

                .ytc-modal.yt-enhanced,
                .modal.yt-enhanced {
                    border: 2px solid var(--text-normal) !important;
                }
            }

            /* Reduced Motion Support */
            @media (prefers-reduced-motion: reduce) {
                .ytc-modal.yt-enhanced,
                .modal.yt-enhanced,
                .ytc-modal-content.yt-enhanced,
                .modal-content.yt-enhanced,
                .yt-enhanced-ui-button,
                .yt-enhanced-ui-input {
                    animation: none !important;
                    transition: none !important;
                }

                .yt-enhanced-ui-button:hover,
                .yt-enhanced-ui-input:focus {
                    transform: none !important;
                }
            }

            /* Loading State */
            .yt-enhanced-ui-button.loading {
                position: relative !important;
                color: transparent !important;
                pointer-events: none !important;
                cursor: not-allowed !important;
            }

            .yt-enhanced-ui-button.loading::after {
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
                animation: enhancedSpin 1s linear infinite !important;
            }

            @keyframes enhancedSpin {
                0% { transform: translate(-50%, -50%) rotate(0deg); }
                100% { transform: translate(-50%, -50%) rotate(360deg); }
            }

            /* Success/Error States */
            .yt-enhanced-ui-button.success {
                background: linear-gradient(135deg, var(--text-success), #22c55e) !important;
                color: white !important;
            }

            .yt-enhanced-ui-button.error {
                background: linear-gradient(135deg, var(--text-error), #ef4444) !important;
                color: white !important;
            }
        `;

        document.head.appendChild(style);
        this.isEnhanced = true;
        
}

    /**
     * Enhance standalone elements (not in modals)
     */
    private enhanceStandaloneElements(): void {
        // Enhance buttons outside modals
        const standaloneButtons = document.querySelectorAll('button:not([data-enhanced-ui])');
        standaloneButtons.forEach(button => {
            if (!button.closest('.modal, .ytc-modal')) {
                button.classList.add('yt-enhanced-ui-button');
                button.setAttribute('data-enhanced-ui', 'true');
                this.addButtonEffects(button as HTMLElement);
            }
        });

        // Enhance inputs outside modals
        const standaloneInputs = document.querySelectorAll('input:not([data-enhanced-ui]), textarea:not([data-enhanced-ui]), select:not([data-enhanced-ui])');
        standaloneInputs.forEach(input => {
            if (!input.closest('.modal, .ytc-modal')) {
                input.classList.add('yt-enhanced-ui-input');
                input.setAttribute('data-enhanced-ui', 'true');
                this.addInputEffects(input as HTMLElement);
            }
        });
    }

    /**
     * Cleanup enhancer
     */
    destroy(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        if (this.enhancementInterval) {
            clearInterval(this.enhancementInterval);
            this.enhancementInterval = null;
        }

        // Remove enhanced styles
        const styles = document.getElementById('yt-enhanced-ui-styles');
        if (styles) {
            styles.remove();
        }

        this.isEnhanced = false;
        
}
}

// Export singleton instance
export const modalEnhancer = ModalEnhancer.getInstance();