/**
 * Simple UI Integration Layer
 * Provides basic enhanced UI functionality without requiring complex modal updates
 */

import { uiSystem } from './ui';

/**
 * Initialize enhanced UI for the plugin
 */
export async function initializeEnhancedUI(): Promise<void> {
    try {
        console.log('[YouTube Clipper] Initializing enhanced UI...');
        await uiSystem.initialize();
        console.log('[YouTube Clipper] Enhanced UI initialized successfully');

        // Add enhanced UI class to body
        document.body.classList.add('yt-enhanced-ui-active');

        return;
    } catch (error) {
        console.warn('[YouTube Clipper] Enhanced UI initialization failed:', error);
        // Continue without enhanced UI
    }
}

/**
 * Apply enhanced UI styling to existing elements
 */
export function enhanceExistingElements(): void {
    if (!uiSystem.isReady()) {
        return;
    }

    // Enhance all modals
    const modals = document.querySelectorAll('.ytc-modal');
    modals.forEach(modal => {
        uiSystem.enhanceModal(modal as HTMLElement);
    });

    // Enhance all buttons
    const buttons = document.querySelectorAll('.ytc-modal-button');
    buttons.forEach(button => {
        button.classList.add('yt-enhanced-ui-button');

        // Add hover effects
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-1px)';
            button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '';
        });
    });

    // Enhance all inputs
    const inputs = document.querySelectorAll('.ytc-modal-input');
    inputs.forEach(input => {
        input.classList.add('yt-enhanced-ui-input');

        // Add focus effects
        input.addEventListener('focus', () => {
            input.style.borderColor = 'var(--interactive-accent)';
            input.style.boxShadow = '0 0 0 3px rgba(var(--interactive-accent-rgb), 0.1)';
        });

        input.addEventListener('blur', () => {
            input.style.borderColor = '';
            input.style.boxShadow = '';
        });
    });
}

/**
 * Add enhanced UI CSS styles
 */
export function addEnhancedUIStyles(): void {
    const style = document.createElement('style');
    style.id = 'yt-enhanced-ui-styles';
    style.textContent = `
        /* Enhanced UI Base Styles */
        .yt-enhanced-ui-active {
            --enhanced-transition: all 0.2s ease;
        }

        /* Enhanced Modal Styles */
        .ytc-modal.yt-enhanced {
            border-radius: 12px !important;
            box-shadow: 0 20px 40px rgba(0,0,0,0.15) !important;
            backdrop-filter: blur(10px) !important;
            animation: modalFadeIn 0.3s ease !important;
        }

        @keyframes modalFadeIn {
            from {
                opacity: 0;
                transform: scale(0.95) translateY(10px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }

        /* Enhanced Button Styles */
        .yt-enhanced-ui-button {
            transition: var(--enhanced-transition) !important;
            border-radius: 8px !important;
            font-weight: 500 !important;
        }

        .yt-enhanced-ui-button.primary {
            background: linear-gradient(135deg, var(--interactive-accent), var(--interactive-accent-hover)) !important;
            border: none !important;
            color: white !important;
        }

        .yt-enhanced-ui-button.primary:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 8px 20px rgba(var(--interactive-accent-rgb), 0.3) !important;
        }

        .yt-enhanced-ui-button.secondary {
            background: var(--background-modifier-hover) !important;
            border: 1px solid var(--background-modifier-border) !important;
        }

        .yt-enhanced-ui-button.secondary:hover {
            background: var(--background-modifier-border) !important;
            transform: translateY(-1px) !important;
        }

        /* Enhanced Input Styles */
        .yt-enhanced-ui-input {
            transition: var(--enhanced-transition) !important;
            border-radius: 8px !important;
            border: 2px solid var(--background-modifier-border) !important;
            font-size: 14px !important;
        }

        .yt-enhanced-ui-input:focus {
            outline: none !important;
            border-color: var(--interactive-accent) !important;
            box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.1) !important;
        }

        /* Enhanced Container Styles */
        .ytc-modal-content.yt-enhanced {
            padding: 24px !important;
            animation: contentSlideIn 0.3s ease 0.1s both !important;
        }

        @keyframes contentSlideIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        /* Enhanced Header Styles */
        .ytc-modal-header.yt-enhanced {
            margin-bottom: 20px !important;
            padding-bottom: 16px !important;
            border-bottom: 2px solid var(--background-modifier-border) !important;
        }

        /* Mobile Optimizations */
        @media (max-width: 768px) {
            .ytc-modal.yt-enhanced {
                margin: 20px !important;
                max-width: calc(100vw - 40px) !important;
                max-height: calc(100vh - 40px) !important;
            }

            .ytc-modal-content.yt-enhanced {
                padding: 16px !important;
            }

            .yt-enhanced-ui-button {
                padding: 10px 20px !important;
                font-size: 13px !important;
            }
        }

        /* Accessibility Improvements */
        @media (prefers-reduced-motion: reduce) {
            .yt-enhanced-ui-button,
            .yt-enhanced-ui-input,
            .ytc-modal.yt-enhanced,
            .ytc-modal-content.yt-enhanced {
                transition: none !important;
                animation: none !important;
            }

            .yt-enhanced-ui-button:hover {
                transform: none !important;
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
        }

        /* Loading States */
        .yt-enhanced-ui-button.loading {
            position: relative;
            color: transparent !important;
            pointer-events: none;
        }

        .yt-enhanced-ui-button.loading::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 16px;
            height: 16px;
            border: 2px solid currentColor;
            border-top: 2px solid transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
        }

        /* Success/Error States */
        .yt-enhanced-ui-button.success {
            background: var(--text-success) !important;
            border-color: var(--text-success) !important;
        }

        .yt-enhanced-ui-button.error {
            background: var(--text-error) !important;
            border-color: var(--text-error) !important;
        }
    `;

    // Only add styles if they don't exist yet
    if (!document.getElementById('yt-enhanced-ui-styles')) {
        document.head.appendChild(style);
    }
}

/**
 * Clean up enhanced UI
 */
export function cleanupEnhancedUI(): void {
    try {
        uiSystem.destroy();

        // Remove enhanced UI class
        document.body.classList.remove('yt-enhanced-ui-active');

        // Remove enhanced UI styles
        const styles = document.getElementById('yt-enhanced-ui-styles');
        if (styles) {
            styles.remove();
        }

        console.log('[YouTube Clipper] Enhanced UI cleaned up');
    } catch (error) {
        console.warn('[YouTube Clipper] Enhanced UI cleanup failed:', error);
    }
}