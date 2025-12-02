
/**
 * Direct UI Enhancer - Injects enhanced styles directly
 * Works immediately by adding CSS that targets existing elements
 */

export class DirectEnhancer {
    private static instance: DirectEnhancer;
    private isInjected = false;

    private constructor() {
        this.injectEnhancedStyles();
        this.setupMutationObserver();
    }

    static getInstance(): DirectEnhancer {
        if (!DirectEnhancer.instance) {
            DirectEnhancer.instance = new DirectEnhancer();
        }
        return DirectEnhancer.instance;
    }

    /**
     * Inject enhanced CSS directly into the document
     */
    private injectEnhancedStyles(): void {
        if (this.isInjected) return;

        const style = document.createElement('style');
        style.id = 'direct-enhanced-styles';
        style.textContent = `
            /* ======== ENHANCED UI STYLES ======== */

            /* Enhance ALL modals and popup dialogs */
            .modal,
            .modal-content,
            .ytc-modal,
            .ytc-modal-content,
            .is-modal,
            .is-popout,
            .menu,
            .suggestion-container,
            div[style*="position: fixed"]:not(.workspace):not(.workspace-split):not(.workspace-leaf),
            body > div:not(.workspace):not(.workspace-split):not(.workspace-leaf):not(.status-bar):not(.titlebar):not(.left-ribbon):not(.right-ribbon):not(.prompt-results) {
                border-radius: 16px !important;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25) !important;
                border: 1px solid var(--background-modifier-border) !important;
                background: var(--background-primary) !important;
                backdrop-filter: blur(10px) !important;
                animation: directModalFade 0.3s ease-out !important;
                z-index: 1000 !important;
            }

            @keyframes directModalFade {
                from {
                    opacity: 0;
                    transform: scale(0.9) translateY(20px);
                    filter: blur(5px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                    filter: blur(0);
                }
            }

            /* Enhanced ALL buttons */
            button,
            .ytc-modal-button,
            .mod-cta,
            .mod-cta:hover,
            .clickable-icon,
            .clickable-icon:hover,
            .navigation-file,
            .tree-item-self,
            .suggestion-item,
            .prompt-instructions,
            .prompt-result,
            div[onclick],
            span[onclick] {
                border-radius: 10px !important;
                font-weight: 600 !important;
                transition: all 0.2s ease !important;
                cursor: pointer !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
                position: relative !important;
                overflow: hidden !important;
                z-index: 1 !important;
            }

            button:hover,
            .ytc-modal-button:hover,
            .mod-cta:hover,
            .clickable-icon:hover,
            .tree-item-self:hover,
            .suggestion-item:hover {
                transform: translateY(-2px) !important;
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15) !important;
            }

            button:active,
            .ytc-modal-button:active,
            .mod-cta:active,
            .clickable-icon:active {
                transform: translateY(0) scale(0.98) !important;
                transition: transform 0.1s ease !important;
            }

            /* Primary buttons */
            .mod-cta,
            .mod-cta:hover,
            button[class*="primary"],
            button[style*="background: var(--interactive-accent)"] {
                background: linear-gradient(135deg, var(--interactive-accent), #2563eb) !important;
                color: white !important;
                border: none !important;
            }

            .mod-cta:hover,
            button[class*="primary"]:hover,
            button[style*="background: var(--interactive-accent)"]:hover {
                background: linear-gradient(135deg, #3b82f6, #1d4ed8) !important;
                transform: translateY(-3px) scale(1.02) !important;
                box-shadow: 0 12px 30px rgba(37, 99, 235, 0.4) !important;
            }

            /* Secondary buttons */
            button:not(.mod-cta),
            .ytc-modal-button:not(.mod-cta),
            button[class*="secondary"] {
                background: var(--background-modifier-hover) !important;
                color: var(--text-normal) !important;
                border: 1px solid var(--background-modifier-border) !important;
            }

            button:not(.mod-cta):hover,
            .ytc-modal-button:not(.mod-cta):hover,
            button[class*="secondary"]:hover {
                background: var(--background-modifier-border) !important;
            }

            /* Enhanced ALL inputs */
            input,
            textarea,
            select,
            .ytc-modal-input,
            .prompt-input,
            input[type="text"],
            input[type="url"],
            input[type="email"],
            input[type="password"],
            input[type="search"],
            .search-input-container input {
                border-radius: 8px !important;
                border: 2px solid var(--background-modifier-border) !important;
                background: var(--background-primary) !important;
                color: var(--text-normal) !important;
                padding: 12px 16px !important;
                font-size: 14px !important;
                transition: all 0.2s ease !important;
                outline: none !important;
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.06) !important;
            }

            input:focus,
            textarea:focus,
            select:focus,
            .ytc-modal-input:focus,
            .prompt-input:focus {
                border-color: var(--interactive-accent) !important;
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.06), 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.15) !important;
                transform: translateY(-1px) !important;
            }

            input::placeholder,
            textarea::placeholder,
            .ytc-modal-input::placeholder,
            .prompt-input::placeholder {
                color: var(--text-muted) !important;
                font-style: italic !important;
            }

            /* Enhanced labels and headers */
            label,
            h2,
            h3,
            .modal-title,
            .ytc-modal-header,
            .setting-item-info,
            .setting-item-name {
                font-weight: 600 !important;
                color: var(--text-normal) !important;
                margin-bottom: 8px !important;
            }

            .modal-title,
            .ytc-modal-header,
            h2.modal-title,
            h2.ytc-modal-header {
                font-size: 1.3rem !important;
                text-align: center !important;
                margin-bottom: 20px !important;
            }

            /* Enhanced content containers */
            .modal-content > *,
            .ytc-modal-content > *,
            .prompt-result,
            .prompt-instructions {
                margin-bottom: 16px !important;
                padding: 8px 0 !important;
            }

            /* Button containers - align buttons to the right */
            .modal-content > div:has(> button),
            .ytc-modal-content > div:has(> .ytc-modal-button),
            .prompt-result:has(> button),
            .modal-buttons,
            .modal-button-container {
                display: flex !important;
                gap: 12px !important;
                justify-content: flex-end !important;
                margin-top: 20px !important;
                padding-top: 16px !important;
                border-top: 1px solid var(--background-modifier-border) !important;
            }

            /* Special YouTube clipper enhancements */
            .ytc-modal-input {
                font-size: 16px !important;
                padding: 16px !important;
            }

            .ytc-modal-header {
                text-align: center !important;
                margin-bottom: 24px !important;
                padding-bottom: 16px !important;
                border-bottom: 2px solid var(--background-modifier-border) !important;
            }

            /* ribbon icon enhancement */
            .workspace-ribbon.mod-left .clickable-icon {
                margin: 4px !important;
                border-radius: 8px !important;
                padding: 8px !important;
            }

            .workspace-ribbon.mod-left .clickable-icon:hover {
                background: var(--background-modifier-hover) !important;
            }

            /* suggestions and dropdowns */
            .suggestion-container,
            .suggestion-item,
            .prompt-instructions,
            .prompt-result {
                background: var(--background-primary) !important;
                border: 1px solid var(--background-modifier-border) !important;
                border-radius: 8px !important;
                padding: 12px !important;
                margin: 4px 0 !important;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
            }

            .suggestion-item:hover {
                background: var(--background-modifier-hover) !important;
                border-color: var(--interactive-accent) !important;
            }

            /* Loading states */
            .loading,
            .is-loading,
            button:disabled {
                opacity: 0.6 !important;
                cursor: not-allowed !important;
                position: relative !important;
            }

            .loading::after,
            .is-loading::after,
            button:disabled::after {
                content: '' !important;
                position: absolute !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                width: 16px !important;
                height: 16px !important;
                border: 2px solid transparent !important;
                border-top: 2px solid var(--text-accent) !important;
                border-radius: 50% !important;
                animation: directSpin 1s linear infinite !important;
            }

            @keyframes directSpin {
                0% { transform: translate(-50%, -50%) rotate(0deg); }
                100% { transform: translate(-50%, -50%) rotate(360deg); }
            }

            /* Success states */
            .mod-success,
            .success {
                background: linear-gradient(135deg, var(--text-success), #16a34a) !important;
                color: white !important;
            }

            /* Error states */
            .mod-error,
            .error {
                background: linear-gradient(135deg, var(--text-error), #dc2626) !important;
                color: white !important;
            }

            /* Warning states */
            .mod-warning,
            .warning {
                background: linear-gradient(135deg, var(--text-warning), #f59e0b) !important;
                color: white !important;
            }

            /* Mobile responsiveness */
            @media (max-width: 768px) {
                .modal,
                .modal-content,
                .ytc-modal,
                .ytc-modal-content {
                    margin: 10px !important;
                    max-width: calc(100vw - 20px) !important;
                    max-height: calc(100vh - 20px) !important;
                    border-radius: 12px !important;
                    padding: 16px !important;
                }

                button,
                .ytc-modal-button,
                .mod-cta {
                    padding: 10px 20px !important;
                    font-size: 14px !important;
                }

                input,
                textarea,
                select,
                .ytc-modal-input {
                    padding: 12px 14px !important;
                    font-size: 14px !important;
                }

                .modal-content > div:has(> button),
                .ytc-modal-content > div:has(> .ytc-modal-button) {
                    flex-direction: column !important;
                    gap: 8px !important;
                }
            }

            /* High contrast mode */
            @media (prefers-contrast: high) {
                button,
                .ytc-modal-button,
                .mod-cta,
                input,
                textarea,
                select {
                    border-width: 2px !important;
                    border-color: var(--text-normal) !important;
                }

                .modal,
                .modal-content,
                .ytc-modal,
                .ytc-modal-content {
                    border-width: 2px !important;
                    border-color: var(--text-normal) !important;
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
                input:focus {
                    transform: none !important;
                }
            }

            /* Success/error indicators */
            .mod-cta.success {
                background: linear-gradient(135deg, #10b981, #059669) !important;
            }

            .mod-cta.error {
                background: linear-gradient(135deg, #ef4444, #dc2626) !important;
            }

            /* Highlight active elements */
            :focus,
            :focus-visible {
                outline: 2px solid var(--interactive-accent) !important;
                outline-offset: 2px !important;
                border-radius: 6px !important;
            }

            /* Ensure content is visible */
            .modal-content,
            .ytc-modal-content,
            .modal-title,
            .ytc-modal-header,
            .setting-item-info,
            .setting-item-name {
                opacity: 1 !important;
                visibility: visible !important;
            }

            /* Make sure inputs are visible */
            input[type="text"],
            input[type="url"],
            input[type="email"],
            input[type="password"],
            input[type="search"],
            textarea,
            select,
            .ytc-modal-input {
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
            }

            /* Make buttons visible */
            button,
            .ytc-modal-button,
            .mod-cta {
                opacity: 1 !important;
                visibility: visible !important;
                display: inline-block !important;
                cursor: pointer !important;
            }
        `;

        document.head.appendChild(style);
        this.isInjected = true;
        
}

    /**
     * Setup mutation observer to catch new elements
     */
    private setupMutationObserver(): void {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Force re-enhancement after a short delay
                        setTimeout(() => {
                            this.forceEnhancement();
                        }, 50);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Force enhancement of all current elements
     */
    forceEnhancement(): void {
        // Add enhanced classes to all elements
        document.querySelectorAll('.modal, .modal-content, .ytc-modal, .ytc-modal-content').forEach((el) => {
            el.classList.add('direct-enhanced');
        });

        document.querySelectorAll('button, .ytc-modal-button, .mod-cta').forEach((el) => {
            el.classList.add('direct-enhanced-button');
        });

        document.querySelectorAll('input, textarea, select, .ytc-modal-input').forEach((el) => {
            el.classList.add('direct-enhanced-input');
        });

        // Log what was enhanced
        const modals = document.querySelectorAll('.direct-enhanced').length;
        const buttons = document.querySelectorAll('.direct-enhanced-button').length;
        const inputs = document.querySelectorAll('.direct-enhanced-input').length;

        if (modals > 0 || buttons > 0 || inputs > 0) {
            
}
    }

    /**
     * Clean up
     */
    destroy(): void {
        const styles = document.getElementById('direct-enhanced-styles');
        if (styles) {
            styles.remove();
            this.isInjected = false;
        }
    }
}

export const directEnhancer = DirectEnhancer.getInstance();