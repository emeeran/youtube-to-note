import { DOMUtils } from '../../dom';
import { MODAL_CSS_CLASSES, TIMEOUTS } from '../../constants/index';
import { ModalEvents } from '../../types';
import { App, Modal } from 'obsidian';
import { logger } from '../../services/logger';

/**
 * Base modal class with shared functionality and consistent styling
 * Designed to prevent conflicts with other plugin modals
 *
 * Every visual property (including the old inline `z-index` / input padding /
 * `#ffa500` heading) lives in `styles.css` under the `ytc-modal*` classes from
 * `MODAL_CSS_CLASSES`; this class only attaches classes and attributes.
 */

export abstract class BaseModal extends Modal {
    protected events: Partial<ModalEvents> = {};
    private isDisposed = false;

    constructor(app: App) {
        super(app);
        this.setupModalStyling();
        this.setupConflictPrevention();
    }

    /**
     * Set up base modal styling for consistency
     */
    private setupModalStyling(): void {
        // Adds `ytc-modal` (see `.ytc-modal` in styles.css for display/z-index)
        DOMUtils.setupModalStyling(this.modalEl);

        // Add unique CSS class to prevent conflicts
        this.contentEl.addClass(MODAL_CSS_CLASSES.content);
    }

    /**
     * Set up conflict prevention measures
     */
    private setupConflictPrevention(): void {
        // Add unique attribute for identification
        this.modalEl.setAttribute('data-plugin', 'youtube-clipper');

        // Stacking above other plugins' overlays is owned by `.ytc-modal` in styles.css.
    }

    /**
     * Create standardized modal header with conflict prevention
     */
    protected createHeader(text: string): HTMLHeadingElement {
        // `ytc-modal-header` (theme-accent colour, sizing) is attached by DOMUtils.
        return DOMUtils.createModalHeader(this.contentEl, text);
    }

    /**
     * Create standardized modal message
     */
    protected createMessage(text: string): HTMLParagraphElement {
        return DOMUtils.createModalMessage(this.contentEl, text);
    }

    /**
     * Create standardized button container
     */
    protected createButtonContainer(): HTMLDivElement {
        return DOMUtils.createButtonContainer(this.contentEl);
    }

    /**
     * Create standardized button with conflict prevention and accessibility
     */
    protected createButton(
        container: HTMLElement,
        text: string,
        isPrimary = false,
        onClick?: () => void,
    ): HTMLButtonElement {
        const button = DOMUtils.createStyledButton(container, text, isPrimary, onClick);

        // Add unique data attribute
        button.setAttribute('data-plugin', 'youtube-clipper');

        // Accessibility: add role and aria-label
        button.setAttribute('role', 'button');
        if (!button.getAttribute('aria-label')) {
            button.setAttribute('aria-label', text);
        }

        return button;
    }

    /**
     * Create standardized input with conflict prevention and accessibility
     */
    protected createInput(container: HTMLElement, type: string, placeholder?: string): HTMLInputElement {
        const input = container.createEl('input', {
            type,
            placeholder,
        });

        // Styling (width/padding/border) comes from `.ytc-modal-input` in styles.css
        input.addClass(MODAL_CSS_CLASSES.input);
        input.setAttribute('data-plugin', 'youtube-clipper');

        // Accessibility: add ARIA labels if placeholder exists
        if (placeholder) {
            input.setAttribute('aria-label', placeholder);
        }

        return input;
    }

    /**
     * Set up keyboard event handlers
     */
    protected setupKeyHandlers(onEnter: () => void | Promise<void>, onEscape?: () => void | Promise<void>): void {
        const wrappedOnEnter = async () => {
            try {
                await onEnter();
            } catch (error) {
                // Submit handlers surface their own Notices; log so failures are never invisible.
                logger.warn(
                    `Modal Enter handler failed: ${error instanceof Error ? error.message : String(error)}`,
                    'Modal',
                );
            }
        };

        const wrappedOnEscape = onEscape
            ? async () => {
                  try {
                      await onEscape();
                  } catch (error) {
                      logger.warn(
                          `Modal Escape handler failed: ${error instanceof Error ? error.message : String(error)}`,
                          'Modal',
                      );
                  }
              }
            : undefined;

        DOMUtils.setupModalKeyHandlers(this.contentEl, wrappedOnEnter, wrappedOnEscape);
    }

    /**
     * Focus element with delay for better UX
     */
    protected focusElement(element: HTMLElement, delay = TIMEOUTS.FOCUS_DELAY): void {
        setTimeout(() => {
            element.focus();
        }, delay);
    }

    /**
     * Set up event handlers
     */
    protected setEvents(events: Partial<ModalEvents>): void {
        this.events = events;
    }

    /**
     * Show custom styled confirmation dialog before closing
     * This uses our custom ConfirmationModal instead of the native browser confirm()
     * for better accessibility and UX.
     *
     * Note: This is now synchronous for backwards compatibility with existing callers,
     * but returns a boolean immediately. For async confirmation with proper modal,
     * use showConfirmationModal() instead.
     */
    protected confirmClose(message: string): boolean {
        // For backward compatibility, return a synchronous value.
        // However, in practice, you should use showConfirmationModal() for the full async experience.
        // This fallback uses native confirm() only if needed.
        // eslint-disable-next-line no-alert
        return confirm(message);
    }

    /**
     * Show a custom accessible confirmation modal and wait for user response.
     * Preferred method for confirmation dialogs (async, fully accessible).
     */
    protected async showConfirmationModal(
        title: string,
        message: string,
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        isDangerous = false,
    ): Promise<boolean> {
        const { ConfirmationModal } = await import('./confirmation-modal');
        const modal = new ConfirmationModal(this.app, {
            title,
            message,
            confirmText,
            cancelText,
            isDangerous,
        });
        return modal.openAndWait();
    }

    /**
     * Force modal visibility (for stubborn modals)
     *
     * Styling is declarative now, so this only re-asserts the modal class —
     * useful when the modal is opened from inside another modal.
     */
    protected forceVisible(): void {
        setTimeout(() => {
            DOMUtils.setupModalStyling(this.modalEl);
        }, TIMEOUTS.REPAINT_DELAY);
    }

    /**
     * Clean up on close with proper disposal
     */
    onClose(): void {
        if (this.isDisposed) {
            return;
        }

        // Mark as disposed to prevent double cleanup
        this.isDisposed = true;

        // Clear content
        const { contentEl } = this;
        contentEl.empty();

        // Remove unique classes and attributes
        this.modalEl.removeClass(MODAL_CSS_CLASSES.modal);
        this.modalEl.removeAttribute('data-plugin');
    }

    /**
     * Abstract method for modal content creation
     */
    abstract onOpen(): void;
}
