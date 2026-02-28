/**
 * Tooltip - Lightweight tooltip utility for settings
 *
 * Features:
 * - Auto-positioning (top/bottom)
 * - Hover and focus support
 * - Keyboard accessible
 * - ARIA support
 * - Delay on show/hide
 */

const CSS_PREFIX = 'ytc-settings';
const TOOLTIP_CONTAINER_ID = 'ytc-settings-tooltip-container';

export type TooltipPlacement = 'top' | 'bottom';

export interface TooltipOptions {
    /** Tooltip content (text or HTML) */
    content: string;
    /** Position relative to trigger */
    placement?: TooltipPlacement;
    /** Delay before showing (ms) */
    showDelay?: number;
    /** Delay before hiding (ms) */
    hideDelay?: number;
    /** Whether content is HTML */
    isHtml?: boolean;
}

interface ActiveTooltip {
    element: HTMLElement;
    trigger: HTMLElement;
    hideTimeout: ReturnType<typeof setTimeout> | null;
}

let activeTooltip: ActiveTooltip | null = null;

/**
 * Get or create the tooltip container
 */
function getContainer(): HTMLElement {
    let container = document.getElementById(TOOLTIP_CONTAINER_ID);
    if (!container) {
        container = document.createElement('div');
        container.id = TOOLTIP_CONTAINER_ID;
        container.style.cssText =
            'position: absolute; top: 0; left: 0; width: 100%; pointer-events: none; z-index: 10001;';
        document.body.appendChild(container);
    }
    return container;
}

/**
 * Create a tooltip element
 */
function createTooltipElement(options: TooltipOptions): HTMLElement {
    const tooltip = document.createElement('div');
    tooltip.className = `${CSS_PREFIX}-tooltip`;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('data-placement', options.placement ?? 'top');
    tooltip.style.pointerEvents = 'none';

    if (options.isHtml) {
        tooltip.innerHTML = options.content;
    } else {
        tooltip.textContent = options.content;
    }

    // Arrow
    const arrow = document.createElement('div');
    arrow.className = `${CSS_PREFIX}-tooltip-arrow`;
    tooltip.appendChild(arrow);

    return tooltip;
}

/**
 * Position the tooltip relative to the trigger element
 */
function positionTooltip(tooltip: HTMLElement, trigger: HTMLElement, placement: TooltipPlacement): void {
    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    const spacing = 8;

    let top: number;
    let left: number;

    if (placement === 'top') {
        top = triggerRect.top - tooltipRect.height - spacing;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
    } else {
        top = triggerRect.bottom + spacing;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
    }

    // Keep within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < 10) left = 10;
    if (left + tooltipRect.width > viewportWidth - 10) {
        left = viewportWidth - tooltipRect.width - 10;
    }

    if (placement === 'top' && top < 10) {
        // Flip to bottom
        top = triggerRect.bottom + spacing;
        tooltip.setAttribute('data-placement', 'bottom');
    } else if (placement === 'bottom' && top + tooltipRect.height > viewportHeight - 10) {
        // Flip to top
        top = triggerRect.top - tooltipRect.height - spacing;
        tooltip.setAttribute('data-placement', 'top');
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

/**
 * Show tooltip for a trigger element
 */
function showTooltip(trigger: HTMLElement, options: TooltipOptions): void {
    // Hide any existing tooltip
    hideTooltip();

    const container = getContainer();
    const tooltip = createTooltipElement(options);

    container.appendChild(tooltip);

    // Position after adding to DOM so we can measure
    requestAnimationFrame(() => {
        positionTooltip(tooltip, trigger, options.placement ?? 'top');
    });

    activeTooltip = {
        element: tooltip,
        trigger,
        hideTimeout: null,
    };
}

/**
 * Hide the active tooltip
 */
export function hideTooltip(): void {
    if (activeTooltip) {
        if (activeTooltip.hideTimeout) {
            clearTimeout(activeTooltip.hideTimeout);
        }
        activeTooltip.element.remove();
        activeTooltip = null;
    }
}

/**
 * Attach tooltip to an element
 *
 * @example
 * ```typescript
 * const infoIcon = document.createElement('span');
 * infoIcon.className = 'ytc-settings-info-icon';
 * infoIcon.textContent = '?';
 *
 * attachTooltip(infoIcon, {
 *     content: 'This setting controls...',
 *     placement: 'top'
 * });
 * ```
 */
export function attachTooltip(element: HTMLElement, options: TooltipOptions): void {
    const showDelay = options.showDelay ?? 300;
    const hideDelay = options.hideDelay ?? 100;

    let showTimeout: ReturnType<typeof setTimeout> | null = null;
    let hideTimeout: ReturnType<typeof setTimeout> | null = null;

    const show = (): void => {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }

        if (!showTimeout) {
            showTimeout = setTimeout(() => {
                showTooltip(element, options);
                showTimeout = null;
            }, showDelay);
        }
    };

    const hide = (): void => {
        if (showTimeout) {
            clearTimeout(showTimeout);
            showTimeout = null;
        }

        if (!hideTimeout) {
            hideTimeout = setTimeout(() => {
                hideTooltip();
                hideTimeout = null;
            }, hideDelay);
        }
    };

    // Mouse events
    element.addEventListener('mouseenter', show);
    element.addEventListener('mouseleave', hide);

    // Focus events for keyboard users
    element.addEventListener('focus', show);
    element.addEventListener('blur', hide);

    // Keep tooltip visible when hovering it
    element.addEventListener('mouseenter', () => {
        if (activeTooltip?.hideTimeout) {
            clearTimeout(activeTooltip.hideTimeout);
            activeTooltip.hideTimeout = null;
        }
    });
}

/**
 * Create an info icon with tooltip attached
 *
 * @example
 * ```typescript
 * const infoIcon = createInfoIcon('Enter your API key from provider dashboard');
 * setting.nameEl.appendChild(infoIcon);
 * ```
 */
export function createInfoIcon(tooltipContent: string): HTMLElement {
    const icon = document.createElement('span');
    icon.className = `${CSS_PREFIX}-info-icon`;
    icon.textContent = '?';
    icon.setAttribute('role', 'img');
    icon.setAttribute('aria-label', 'More information');
    icon.setAttribute('tabindex', '0');

    attachTooltip(icon, {
        content: tooltipContent,
        placement: 'top',
    });

    return icon;
}

/**
 * Create a help text element with optional tooltip
 *
 * @example
 * ```typescript
 * const helpEl = createHelpText(
 *     'Configure your API keys for AI providers',
 *     'API keys are stored securely and encrypted'
 * );
 * container.appendChild(helpEl);
 * ```
 */
export function createHelpText(text: string, tooltip?: string): HTMLElement {
    const container = document.createElement('div');
    container.className = `${CSS_PREFIX}-section-desc`;
    container.textContent = text;

    if (tooltip) {
        const infoIcon = createInfoIcon(tooltip);
        container.appendChild(infoIcon);
    }

    return container;
}

/**
 * Dispose of tooltip system
 */
export function disposeTooltips(): void {
    hideTooltip();
    const container = document.getElementById(TOOLTIP_CONTAINER_ID);
    container?.remove();
}
