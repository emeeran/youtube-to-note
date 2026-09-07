import { DOMUtilsInterface, StyleObject } from './types';
import { MODAL_CSS_CLASSES } from './constants/index';

/**
 * DOM manipulation utilities to eliminate code duplication
 *
 * Presentation is owned by `styles.css`: the helpers below only attach the
 * semantic classes from `MODAL_CSS_CLASSES`. `applyStyles` stays available for
 * genuinely dynamic values (positions, measured widths, progress), not for
 * static styling.
 */

export class DOMUtils implements DOMUtilsInterface {
    /**
     * Apply styles to an HTML element.
     *
     * Reserved for runtime-computed values; static appearance belongs in
     * `styles.css` behind a class from `MODAL_CSS_CLASSES`.
     */
    static applyStyles(element: HTMLElement, styles: StyleObject): void {
        Object.assign(element.style, styles);
    }

    /**
     * Create a standardized button container
     */
    static createButtonContainer(parent: HTMLElement): HTMLDivElement {
        return parent.createDiv(MODAL_CSS_CLASSES.buttonContainer);
    }

    /**
     * Create a styled button with consistent appearance
     */
    static createStyledButton(
        container: HTMLElement,
        text: string,
        isPrimary = false,
        onClick?: () => void,
    ): HTMLButtonElement {
        const button = container.createEl('button', {
            text,
            cls: isPrimary ? `${MODAL_CSS_CLASSES.button} mod-cta` : MODAL_CSS_CLASSES.button,
        });

        if (onClick) {
            button.addEventListener('click', onClick);
        }

        return button;
    }

    /**
     * Set up modal base styling for consistency
     */
    static setupModalStyling(modalEl: HTMLElement): void {
        // `display` and `z-index` come from `.ytc-modal` in styles.css.
        modalEl.addClass(MODAL_CSS_CLASSES.modal);
    }

    /**
     * Create a header element with consistent styling
     */
    static createModalHeader(parent: HTMLElement, text: string): HTMLHeadingElement {
        return parent.createEl('h2', { text, cls: MODAL_CSS_CLASSES.header });
    }

    /**
     * Create a message paragraph with consistent styling
     */
    static createModalMessage(parent: HTMLElement, text: string): HTMLParagraphElement {
        return parent.createEl('p', { text, cls: MODAL_CSS_CLASSES.message });
    }

    /**
     * Set up keyboard event handlers for modals
     */
    static setupModalKeyHandlers(element: HTMLElement, onEnter: () => void, onEscape?: () => void): void {
        element.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                onEnter();
            }
            if (e.key === 'Escape' && onEscape) {
                e.preventDefault();
                e.stopPropagation();
                onEscape();
            }
        });
    }

    // Instance methods implementing interface
    applyStyles(element: HTMLElement, styles: StyleObject): void {
        DOMUtils.applyStyles(element, styles);
    }

    createButtonContainer(parent: HTMLElement): HTMLDivElement {
        return DOMUtils.createButtonContainer(parent);
    }

    createStyledButton(
        container: HTMLElement,
        text: string,
        isPrimary = false,
        onClick?: () => void,
    ): HTMLButtonElement {
        return DOMUtils.createStyledButton(container, text, isPrimary, onClick);
    }
}
