/**
 * DOM utility functions
 */

/**
 * Create element with attributes and children
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attributes?: Record<string, string | boolean>,
    children?: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);

    if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
            if (value === true) {
                element.setAttribute(key, '');
            } else if (value !== false) {
                element.setAttribute(key, String(value));
            }
        });
    }

    if (children) {
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child) {
                element.appendChild(child);
            }
        });
    }

    return element;
}

/**
 * Add ARIA attributes to element
 */
export function addAriaAttributes(
    element: HTMLElement,
    attributes: Record<string, string>
): void {
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(`aria-${key}`, value);
    });
}

/**
 * Add accessibility role to element
 */
export function setRole(element: HTMLElement, role: string): void {
    element.setAttribute('role', role);
}

/**
 * Make element focusable
 */
export function makeFocusable(element: HTMLElement, tabIndex: number = 0): void {
    element.setAttribute('tabindex', String(tabIndex));
}

/**
 * Add keyboard navigation handler
 */
export function addKeyboardHandler(
    element: HTMLElement,
    handler: (event: KeyboardEvent) => void
): void {
    element.addEventListener('keydown', handler);
}

/**
 * Add click handler with keyboard support
 */
export function addAccessibleClick(
    element: HTMLElement,
    handler: () => void
): void {
    element.addEventListener('click', handler);
    element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handler();
        }
    });
}

/**
 * Check if element is visible
 */
export function isVisible(element: HTMLElement): boolean {
    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

/**
 * Find first focusable element in container
 */
export function findFirstFocusable(container: HTMLElement): HTMLElement | null {
    const focusableSelectors = [
        'button:not([disabled])',
        '[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    return container.querySelector(focusableSelectors);
}

/**
 * Trap focus within element (for modals)
 */
export function trapFocus(element: HTMLElement): () => void {
    const focusableElements = element.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handler = (event: KeyboardEvent) => {
        if (event.key !== 'Tab') return;

        if (event.shiftKey) {
            if (document.activeElement === firstElement) {
                event.preventDefault();
                lastElement?.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                event.preventDefault();
                firstElement?.focus();
            }
        }
    };

    element.addEventListener('keydown', handler);

    // Return cleanup function
    return () => element.removeEventListener('keydown', handler);
}

/**
 * Scroll element into view smoothly
 */
export function scrollIntoView(element: HTMLElement): void {
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
