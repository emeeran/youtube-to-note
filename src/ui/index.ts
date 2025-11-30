/**
 * Enhanced UI System Integration
 *
 * This file serves as the main entry point for the enhanced UI system.
 * It initializes all UI components and provides integration utilities.
 */

// import { ComponentManager } from './components'; // Simple implementation, not needed for now
import { StyleManager } from './styles';
import { AnimationManager } from './animations';
import { AccessibilityManager } from './accessibility';
import { ResponsiveManager } from './responsive';
import { InteractionManager } from './interactions';
import { FormValidationManager } from './form-validation';
import { HelpSystemManager } from './help-system';
import { LoadingStateManager } from './loading-states';
import { ThemeOptimizationManager } from './theme-optimization';

/**
 * Main UI System class that coordinates all UI components
 */
export class UISystem {
    private static instance: UISystem;
    private isInitialized = false;
    private isDestroyed = false;

    private constructor() {}

    static getInstance(): UISystem {
        if (!UISystem.instance) {
            UISystem.instance = new UISystem();
        }
        return UISystem.instance;
    }

    /**
     * Initialize the entire UI system
     */
    async initialize(): Promise<void> {
        if (this.isInitialized || this.isDestroyed) {
            return;
        }

        console.log('[YouTube Clipper UI] Initializing enhanced UI system...');

        try {
            // Initialize core systems in order
            this.initializeThemeSystem();
            this.initializeStyleSystem();
            this.initializeAnimationSystem();
            this.initializeAccessibilitySystem();
            this.initializeResponsiveSystem();
            this.initializeInteractionSystem();
            this.initializeFormValidationSystem();
            this.initializeHelpSystem();
            this.initializeLoadingSystem();
            this.initializeComponentSystem();

            this.isInitialized = true;
            console.log('[YouTube Clipper UI] Enhanced UI system initialized successfully');

            // Announce to screen readers
            this.announce('Enhanced UI system loaded', 'polite');

        } catch (error) {
            console.error('[YouTube Clipper UI] Failed to initialize UI system:', error);
            throw error;
        }
    }

    /**
     * Initialize theme system first (other systems depend on it)
     */
    private initializeThemeSystem(): void {
        console.log('[YouTube Clipper UI] Initializing theme system...');
        // Theme system is auto-initialized via singleton
        // Just ensure it's ready
        ThemeOptimizationManager.getInstance();
        console.log('[YouTube Clipper UI] Theme system initialized');
    }

    /**
     * Initialize style system
     */
    private initializeStyleSystem(): void {
        console.log('[YouTube Clipper UI] Initializing style system...');
        // Style system is auto-initialized via singleton
        StyleManager.addClass('yt-enhanced-ui', {
            'root': `
                /* Base enhanced UI styles */
                .yt-enhanced-ui {
                    /* Ensure proper layering */
                    position: relative;
                    z-index: 1;
                }

                /* Override Obsidian modal styles for enhanced UI */
                .ytc-modal.yt-enhanced {
                    border-radius: 12px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
                    backdrop-filter: blur(10px);
                    max-width: 90vw;
                    max-height: 90vh;
                    overflow: hidden;
                }

                .ytc-modal-content.yt-enhanced {
                    padding: 24px;
                    background: var(--background-primary);
                    border-radius: 12px;
                }

                .ytc-modal-header.yt-enhanced {
                    margin-bottom: 20px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid var(--background-modifier-border);
                }

                /* Enhanced form elements */
                .ytc-modal-input.yt-enhanced {
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid var(--background-modifier-border);
                    border-radius: 8px;
                    font-size: 14px;
                    background: var(--background-primary);
                    color: var(--text-normal);
                    transition: all 0.2s ease;
                    box-sizing: border-box;
                }

                .ytc-modal-input.yt-enhanced:focus {
                    outline: none;
                    border-color: var(--interactive-accent);
                    box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.1);
                }

                .ytc-modal-input.yt-enhanced:invalid {
                    border-color: var(--text-error);
                }

                /* Enhanced buttons */
                .ytc-modal-button.yt-enhanced {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    box-sizing: border-box;
                }

                .ytc-modal-button.yt-enhanced.primary {
                    background: var(--interactive-accent);
                    color: white;
                }

                .ytc-modal-button.yt-enhanced.primary:hover {
                    background: var(--interactive-accent-hover);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(var(--interactive-accent-rgb), 0.3);
                }

                .ytc-modal-button.yt-enhanced.secondary {
                    background: var(--background-modifier-hover);
                    color: var(--text-normal);
                }

                .ytc-modal-button.yt-enhanced.secondary:hover {
                    background: var(--background-modifier-border);
                }

                .ytc-modal-button.yt-enhanced:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                /* Responsive adjustments */
                @media (max-width: 768px) {
                    .ytc-modal.yt-enhanced {
                        max-width: 95vw;
                        max-height: 95vh;
                        margin: 20px;
                    }

                    .ytc-modal-content.yt-enhanced {
                        padding: 16px;
                    }

                    .ytc-modal-button.yt-enhanced {
                        padding: 10px 20px;
                        font-size: 13px;
                    }
                }

                /* Accessibility improvements */
                @media (prefers-reduced-motion: reduce) {
                    .ytc-modal-button.yt-enhanced,
                    .ytc-modal-input.yt-enhanced {
                        transition: none;
                    }

                    .ytc-modal-button.yt-enhanced:hover {
                        transform: none;
                    }
                }

                /* High contrast mode */
                @media (prefers-contrast: high) {
                    .ytc-modal-button.yt-enhanced {
                        border: 2px solid var(--text-normal);
                    }

                    .ytc-modal-input.yt-enhanced {
                        border-width: 2px;
                    }
                }
            `
        });
        console.log('[YouTube Clipper UI] Style system initialized');
    }

    /**
     * Initialize animation system
     */
    private initializeAnimationSystem(): void {
        console.log('[YouTube Clipper UI] Initializing animation system...');
        // Animation system is auto-initialized via singleton
        AnimationManager.getInstance();
        console.log('[YouTube Clipper UI] Animation system initialized');
    }

    /**
     * Initialize accessibility system
     */
    private initializeAccessibilitySystem(): void {
        console.log('[YouTube Clipper UI] Initializing accessibility system...');
        // Accessibility system is auto-initialized via singleton
        AccessibilityManager.getInstance();
        console.log('[YouTube Clipper UI] Accessibility system initialized');
    }

    /**
     * Initialize responsive system
     */
    private initializeResponsiveSystem(): void {
        console.log('[YouTube Clipper UI] Initializing responsive system...');
        // Responsive system is auto-initialized via singleton
        ResponsiveManager.getInstance();
        console.log('[YouTube Clipper UI] Responsive system initialized');
    }

    /**
     * Initialize interaction system
     */
    private initializeInteractionSystem(): void {
        console.log('[YouTube Clipper UI] Initializing interaction system...');
        // Interaction system is auto-initialized via singleton
        InteractionManager.getInstance();
        console.log('[YouTube Clipper UI] Interaction system initialized');
    }

    /**
     * Initialize form validation system
     */
    private initializeFormValidationSystem(): void {
        console.log('[YouTube Clipper UI] Initializing form validation system...');
        // Form validation system is auto-initialized via singleton
        FormValidationManager.getInstance();
        console.log('[YouTube Clipper UI] Form validation system initialized');
    }

    /**
     * Initialize help system
     */
    private initializeHelpSystem(): void {
        console.log('[YouTube Clipper UI] Initializing help system...');
        // Help system is auto-initialized via singleton
        HelpSystemManager.getInstance();
        console.log('[YouTube Clipper UI] Help system initialized');
    }

    /**
     * Initialize loading system
     */
    private initializeLoadingSystem(): void {
        console.log('[YouTube Clipper UI] Initializing loading system...');
        // Loading system is auto-initialized via singleton
        LoadingStateManager.getInstance();
        console.log('[YouTube Clipper UI] Loading system initialized');
    }

    /**
     * Initialize component system
     */
    private initializeComponentSystem(): void {
        console.log('[YouTube Clipper UI] Initializing component system...');
        // Component system is auto-initialized via singleton
        // ComponentManager.getInstance(); // Simplified implementation
        console.log('[YouTube Clipper UI] Component system initialized');
    }

    /**
     * Enhance an existing modal element with enhanced UI
     */
    enhanceModal(modalEl: HTMLElement): void {
        if (!this.isInitialized) {
            console.warn('[YouTube Clipper UI] UI system not initialized, skipping modal enhancement');
            return;
        }

        // Add enhanced UI class
        modalEl.classList.add('yt-enhanced');

        // Find and enhance modal elements
        this.enhanceModalElements(modalEl);

        // Setup enhanced interactions
        this.setupModalInteractions(modalEl);

        // Setup enhanced accessibility
        this.setupModalAccessibility(modalEl);

        console.log('[YouTube Clipper UI] Modal enhanced with enhanced UI');
    }

    /**
     * Enhance modal elements with enhanced UI components
     */
    private enhanceModalElements(modalEl: HTMLElement): void {
        // Enhance modal content
        const contentEl = modalEl.querySelector('.ytc-modal-content');
        if (contentEl) {
            contentEl.classList.add('yt-enhanced');
        }

        // Enhance modal header
        const headerEl = modalEl.querySelector('.ytc-modal-header');
        if (headerEl) {
            headerEl.classList.add('yt-enhanced');
        }

        // Enhance buttons
        const buttons = modalEl.querySelectorAll('.ytc-modal-button');
        buttons.forEach(button => {
            button.classList.add('yt-enhanced');

            // Add ripple effect
            InteractionManager.getInstance().addRippleEffect(button as HTMLElement);

            // Add hover effect
            if (button.classList.contains('primary')) {
                InteractionManager.getInstance().addHoverEffect(button as HTMLElement, 'lift');
            }
        });

        // Enhance inputs
        const inputs = modalEl.querySelectorAll('.ytc-modal-input');
        inputs.forEach(input => {
            input.classList.add('yt-enhanced');

            // Add focus effects
            input.addEventListener('focus', () => {
                AnimationManager.slideIn(input as HTMLElement, 200);
            });
        });

        // Enhance selects
        const selects = modalEl.querySelectorAll('select');
        selects.forEach(select => {
            select.classList.add('yt-enhanced', 'ytc-modal-input');
        });

        // Enhance textareas
        const textareas = modalEl.querySelectorAll('textarea');
        textareas.forEach(textarea => {
            textarea.classList.add('yt-enhanced', 'ytc-modal-input');
        });
    }

    /**
     * Setup enhanced interactions for modal
     */
    private setupModalInteractions(modalEl: HTMLElement): void {
        // Add entrance animation
        AnimationManager.fadeIn(modalEl, 300);

        // Setup magnetic effect for primary buttons
        const primaryButtons = modalEl.querySelectorAll('.ytc-modal-button.primary');
        primaryButtons.forEach(button => {
            InteractionManager.getInstance().addMagneticEffect(button as HTMLElement, 0.2);
        });

        // Setup 3D tilt for modal content
        const contentEl = modalEl.querySelector('.ytc-modal-content');
        if (contentEl) {
            InteractionManager.getInstance().addTilt3DEffect(contentEl as HTMLElement, 0.5);
        }
    }

    /**
     * Setup enhanced accessibility for modal
     */
    private setupModalAccessibility(modalEl: HTMLElement): void {
        // Add focus trap
        AccessibilityManager.getInstance().createFocusTrap(modalEl);

        // Enhance keyboard navigation
        const interactiveElements = modalEl.querySelectorAll('button, input, select, textarea');
        interactiveElements.forEach((element, index) => {
            const htmlElement = element as HTMLElement;

            // Ensure proper tab order
            htmlElement.tabIndex = index === 0 ? 0 : -1;

            // Add ARIA attributes
            if (!htmlElement.getAttribute('aria-label')) {
                const text = htmlElement.textContent || htmlElement.getAttribute('placeholder') || '';
                if (text) {
                    htmlElement.setAttribute('aria-label', text.trim());
                }
            }
        });

        // Announce modal opening
        const title = modalEl.querySelector('.ytc-modal-header')?.textContent || 'Modal opened';
        this.announce(title, 'assertive');
    }

    /**
     * Announce message to screen readers
     */
    private announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
        AccessibilityManager.getInstance().announce(message, priority);
    }

    /**
     * Check if UI system is initialized
     */
    isReady(): boolean {
        return this.isInitialized && !this.isDestroyed;
    }

    /**
     * Get UI system status
     */
    getStatus(): {
        isInitialized: boolean;
        isDestroyed: boolean;
        theme: string;
        isDarkMode: boolean;
        isMobile: boolean;
    } {
        const themeManager = ThemeOptimizationManager.getInstance();
        const responsiveManager = ResponsiveManager.getInstance();

        return {
            isInitialized: this.isInitialized,
            isDestroyed: this.isDestroyed,
            theme: themeManager.getCurrentTheme().name,
            isDarkMode: themeManager.isDarkMode(),
            isMobile: responsiveManager.isMobile()
        };
    }

    /**
     * Cleanup and destroy UI system
     */
    destroy(): void {
        if (this.isDestroyed) {
            return;
        }

        console.log('[YouTube Clipper UI] Destroying enhanced UI system...');

        this.isDestroyed = true;
        this.isInitialized = false;

        // Destroy all UI systems in reverse order
        // ComponentManager.getInstance().destroy(); // Simplified implementation
        LoadingStateManager.getInstance().destroy();
        HelpSystemManager.getInstance().destroy();
        FormValidationManager.getInstance().destroy();
        InteractionManager.getInstance().destroy();
        ResponsiveManager.getInstance().destroy();
        AccessibilityManager.getInstance().destroy();
        AnimationManager.getInstance().destroy();
        ThemeOptimizationManager.getInstance().destroy();
        StyleManager.destroy();

        console.log('[YouTube Clipper UI] Enhanced UI system destroyed');
    }
}

// Export singleton instance
export const uiSystem = UISystem.getInstance();

// Export all UI utilities and managers for convenience
export * from './components';
export * from './styles';
export * from './animations';
export * from './accessibility';
export * from './responsive';
export * from './interactions';
export * from './form-validation';
export * from './help-system';
export * from './loading-states';
export * from './theme-optimization';

// Export easy-to-use utility functions
export const ui = {
    initialize: () => uiSystem.initialize(),
    enhanceModal: (modalEl: HTMLElement) => uiSystem.enhanceModal(modalEl),
    isReady: () => uiSystem.isReady(),
    getStatus: () => uiSystem.getStatus(),
    destroy: () => uiSystem.destroy()
};