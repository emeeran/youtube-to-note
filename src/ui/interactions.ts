import { AnimationManager } from './animations';
import { StyleManager } from './constants/index';


/**
 * Interactive feedback and micro-interactions system
 */
export class InteractionManager {
    private static instance: InteractionManager;
    private rippleElements: Set<HTMLElement> = new Set();
    private magneticElements: Set<HTMLElement> = new Set();
    private tiltElements: Set<HTMLElement> = new Set();
    private hoverElements: Set<HTMLElement> = new Set();
    private pressedElements: Set<HTMLElement> = new Set();
    private longPressElements: Set<HTMLElement> = new Set();
    private swipeElements: Set<HTMLElement> = new Set();

    private constructor() {
        this.initializeInteractionStyles();
        this.setupGlobalInteractionHandlers();
    }

    static getInstance(): InteractionManager {
        if (!InteractionManager.instance) {
            InteractionManager.instance = new InteractionManager();
        }
        return InteractionManager.instance;
    }

    /**
     * Initialize interaction styles
     */
    private initializeInteractionStyles(): void {
        const interactionCSS = `
            /* Interactive feedback base styles */
            .yt-interactive {
                position: relative;
                overflow: hidden;
                user-select: none;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }

            /* Hover states */
            .yt-hover-lift:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }

            .yt-hover-grow:hover {
                transform: scale(1.05);
            }

            .yt-hover-shrink:hover {
                transform: scale(0.95);
            }

            .yt-hover-rotate:hover {
                transform: rotate(5deg);
            }

            .yt-hover-glow:hover {
                box-shadow: 0 0 20px var(--interactive-accent);
            }

            /* Active states */
            .yt-active-pulse:active {
                animation: active-pulse 0.3s ease;
            }

            .yt-active-bounce:active {
                animation: active-bounce 0.3s ease;
            }

            .yt-active-shrink:active {
                transform: scale(0.95);
                transition: transform 0.1s ease;
            }

            /* Focus states */
            .yt-focus-ring:focus {
                outline: none;
                box-shadow: 0 0 0 3px var(--interactive-accent);
            }

            .yt-focus-glow:focus {
                animation: focus-glow 2s ease infinite;
            }

            /* Loading states */
            .yt-loading-shimmer {
                background: linear-gradient(
                    90deg,
                    var(--background-secondary) 0%,
                    var(--background-modifier-hover) 50%,
                    var(--background-secondary) 100%
                );
                background-size: 200% 100%;
                animation: shimmer 1.5s ease infinite;
            }

            .yt-loading-dots::after {
                content: '';
                animation: loading-dots 1.5s ease infinite;
            }

            /* Success states */
            .yt-success-checkmark {
                position: relative;
            }

            .yt-success-checkmark::after {
                content: '✓';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0);
                color: var(--text-success);
                font-weight: bold;
                animation: checkmark-pop 0.4s ease forwards;
            }

            /* Error states */
            .yt-error-shake {
                animation: error-shake 0.5s ease;
            }

            .yt-error-pulse {
                animation: error-pulse 1s ease infinite;
            }

            /* Progress indicators */
            .yt-progress-indeterminate {
                position: relative;
                overflow: hidden;
            }

            .yt-progress-indeterminate::after {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(
                    90deg,
                    transparent,
                    var(--interactive-accent),
                    transparent
                );
                animation: progress-slide 2s ease infinite;
            }

            /* Ripple effect container */
            .yt-ripple-container {
                position: relative;
                overflow: hidden;
            }

            .yt-ripple {
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.6);
                transform: scale(0);
                animation: ripple-effect 0.6s ease-out;
                pointer-events: none;
            }

            /* Magnetic effect */
            .yt-magnetic {
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }

            /* 3D tilt effect */
            .yt-tilt-3d {
                transform-style: preserve-3d;
                transition: transform 0.2s ease;
            }

            /* Swipe hints */
            .yt-swipe-hint::after {
                content: '→';
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                color: var(--text-muted);
                animation: swipe-hint 2s ease infinite;
            }

            /* Floating action button */
            .yt-fab {
                position: fixed;
                bottom: 24px;
                right: 24px;
                width: 56px;
                height: 56px;
                border-radius: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--interactive-accent);
                color: white;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                cursor: pointer;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
                z-index: 1000;
            }

            .yt-fab:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
            }

            .yt-fab:active {
                transform: scale(0.95);
            }

            /* Tooltip */
            .yt-tooltip {
                position: absolute;
                background: var(--background-secondary);
                color: var(--text-normal);
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                z-index: 1001;
                pointer-events: none;
                opacity: 0;
                transform: translateY(5px);
                transition: opacity 0.2s ease, transform 0.2s ease;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            }

            .yt-tooltip.show {
                opacity: 1;
                transform: translateY(0);
            }

            .yt-tooltip::before {
                content: '';
                position: absolute;
                bottom: -4px;
                left: 50%;
                transform: translateX(-50%);
                width: 0;
                height: 0;
                border-left: 4px solid transparent;
                border-right: 4px solid transparent;
                border-top: 4px solid var(--background-secondary);
            }

            /* Skeleton loading */
            .yt-skeleton {
                background: linear-gradient(
                    90deg,
                    var(--background-secondary) 0%,
                    var(--background-modifier-hover) 50%,
                    var(--background-secondary) 100%
                );
                background-size: 200% 100%;
                animation: skeleton-shimmer 1.5s ease infinite;
                border-radius: 4px;
            }

            .yt-skeleton-text {
                height: 16px;
                margin: 4px 0;
            }

            .yt-skeleton-text.large {
                height: 24px;
            }

            .yt-skeleton-text.small {
                height: 12px;
            }

            .yt-skeleton-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
            }

            .yt-skeleton-button {
                height: 36px;
                width: 120px;
                border-radius: 4px;
            }

            /* Keyframe animations */
            @keyframes active-pulse {
                0% { transform: scale(1); }
                50% { transform: scale(0.95); }
                100% { transform: scale(1); }
            }

            @keyframes active-bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-3px); }
            }

            @keyframes focus-glow {
                0%, 100% { box-shadow: 0 0 0 3px var(--interactive-accent); }
                50% { box-shadow: 0 0 0 6px var(--interactive-accent); }
            }

            @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }

            @keyframes loading-dots {
                0%, 20% { content: '.'; }
                40% { content: '..'; }
                60%, 100% { content: '...'; }
            }

            @keyframes checkmark-pop {
                0% { transform: translate(-50%, -50%) scale(0) rotate(-45deg); }
                50% { transform: translate(-50%, -50%) scale(1.2) rotate(10deg); }
                100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); }
            }

            @keyframes error-shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
                20%, 40%, 60%, 80% { transform: translateX(2px); }
            }

            @keyframes error-pulse {
                0%, 100% { background-color: var(--background-secondary); }
                50% { background-color: rgba(255, 0, 0, 0.1); }
            }

            @keyframes progress-slide {
                0% { left: -100%; }
                100% { left: 100%; }
            }

            @keyframes ripple-effect {
                0% {
                    transform: scale(0);
                    opacity: 0.8;
                }
                100% {
                    transform: scale(2);
                    opacity: 0;
                }
            }

            @keyframes swipe-hint {
                0%, 100% { transform: translateY(-50%) translateX(0); opacity: 0.3; }
                50% { transform: translateY(-50%) translateX(5px); opacity: 1; }
            }

            @keyframes skeleton-shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }

            /* Reduced motion support */
            @media (prefers-reduced-motion: reduce) {
                .yt-interactive,
                .yt-hover-lift,
                .yt-hover-grow,
                .yt-hover-shrink,
                .yt-hover-rotate,
                .yt-magnetic,
                .yt-tilt-3d,
                .yt-fab {
                    transition: none !important;
                    animation: none !important;
                }

                .yt-loading-shimmer,
                .yt-skeleton {
                    animation: none !important;
                    background: var(--background-secondary) !important;
                }
            }
        `;

        StyleManager.addClass('interactions', {
            'root': interactionCSS
        });
    }

    /**
     * Setup global interaction handlers
     */
    private setupGlobalInteractionHandlers(): void {
        // Handle escape key for closing interactive elements
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllTooltips();
            }
        });

        // Handle click outside for closing dropdowns/tooltips
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.yt-tooltip') && !target.closest('[data-tooltip]')) {
                this.closeAllTooltips();
            }
        });
    }

    /**
     * Add ripple effect to element
     */
    addRippleEffect(element: HTMLElement): void {
        if (this.rippleElements.has(element)) return;

        element.classList.add('yt-ripple-container');
        this.rippleElements.add(element);

        const handleRipple = (e: MouseEvent | TouchEvent) => {
            const rect = element.getBoundingClientRect();
            let clientX: number, clientY: number;

            if ('touches' in e) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            const ripple = document.createElement('span');
            ripple.className = 'yt-ripple';

            const size = Math.max(rect.width, rect.height);
            const x = clientX - rect.left - size / 2;
            const y = clientY - rect.top - size / 2;

            ripple.style.width = `${size}px`;
            ripple.style.height = `${size}px`;
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;

            element.appendChild(ripple);

            // Remove ripple after animation
            setTimeout(() => {
                if (ripple.parentNode) {
                    ripple.parentNode.removeChild(ripple);
                }
            }, 600);
        };

        element.addEventListener('click', handleRipple);
        element.addEventListener('touchstart', handleRipple, { passive: true });

        // Store handler for cleanup
        (element as any).rippleHandler = handleRipple;
    }

    /**
     * Remove ripple effect from element
     */
    removeRippleEffect(element: HTMLElement): void {
        if (!this.rippleElements.has(element)) return;

        element.classList.remove('yt-ripple-container');
        this.rippleElements.delete(element);

        if ((element as any).rippleHandler) {
            element.removeEventListener('click', (element as any).rippleHandler);
            element.removeEventListener('touchstart', (element as any).rippleHandler);
            delete (element as any).rippleHandler;
        }

        // Remove any existing ripples
        const ripples = element.querySelectorAll('.yt-ripple');
        ripples.forEach(ripple => ripple.remove());
    }

    /**
     * Add magnetic effect to element
     */
    addMagneticEffect(element: HTMLElement, strength = 0.3): void {
        if (this.magneticElements.has(element)) return;

        element.classList.add('yt-magnetic');
        this.magneticElements.add(element);

        const handleMouseMove = (e: MouseEvent) => {
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const deltaX = (e.clientX - centerX) * strength;
            const deltaY = (e.clientY - centerY) * strength;

            element.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.05)`;
        };

        const handleMouseLeave = () => {
            element.style.transform = 'translate(0, 0) scale(1)';
        };

        element.addEventListener('mousemove', handleMouseMove);
        element.addEventListener('mouseleave', handleMouseLeave);

        // Store handlers for cleanup
        (element as any).magneticHandlers = { handleMouseMove, handleMouseLeave };
    }

    /**
     * Remove magnetic effect from element
     */
    removeMagneticEffect(element: HTMLElement): void {
        if (!this.magneticElements.has(element)) return;

        element.classList.remove('yt-magnetic');
        this.magneticElements.delete(element);

        if ((element as any).magneticHandlers) {
            const { handleMouseMove, handleMouseLeave } = (element as any).magneticHandlers;
            element.removeEventListener('mousemove', handleMouseMove);
            element.removeEventListener('mouseleave', handleMouseLeave);
            delete (element as any).magneticHandlers;
        }

        element.style.transform = '';
    }

    /**
     * Add 3D tilt effect to element
     */
    addTilt3DEffect(element: HTMLElement, intensity = 1): void {
        if (this.tiltElements.has(element)) return;

        element.classList.add('yt-tilt-3d');
        this.tiltElements.add(element);

        const handleMouseMove = (e: MouseEvent) => {
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const mouseX = (e.clientX - centerX) / (rect.width / 2);
            const mouseY = (e.clientY - centerY) / (rect.height / 2);

            const rotateX = mouseY * 20 * intensity;
            const rotateY = mouseX * -20 * intensity;

            element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05)`;
        };

        const handleMouseLeave = () => {
            element.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1)';
        };

        element.addEventListener('mousemove', handleMouseMove);
        element.addEventListener('mouseleave', handleMouseLeave);

        // Store handlers for cleanup
        (element as any).tiltHandlers = { handleMouseMove, handleMouseLeave };
    }

    /**
     * Remove 3D tilt effect from element
     */
    removeTilt3DEffect(element: HTMLElement): void {
        if (!this.tiltElements.has(element)) return;

        element.classList.remove('yt-tilt-3d');
        this.tiltElements.delete(element);

        if ((element as any).tiltHandlers) {
            const { handleMouseMove, handleMouseLeave } = (element as any).tiltHandlers;
            element.removeEventListener('mousemove', handleMouseMove);
            element.removeEventListener('mouseleave', handleMouseLeave);
            delete (element as any).tiltHandlers;
        }

        element.style.transform = '';
    }

    /**
     * Add hover effects to element
     */
    addHoverEffect(element: HTMLElement, effect: 'lift' | 'grow' | 'shrink' | 'rotate' | 'glow'): void {
        if (this.hoverElements.has(element)) return;

        element.classList.add(`yt-hover-${effect}`);
        this.hoverElements.add(element);
    }

    /**
     * Remove hover effects from element
     */
    removeHoverEffect(element: HTMLElement): void {
        if (!this.hoverElements.has(element)) return;

        const hoverClasses = [
            'yt-hover-lift',
            'yt-hover-grow',
            'yt-hover-shrink',
            'yt-hover-rotate',
            'yt-hover-glow'
        ];

        hoverClasses.forEach(className => element.classList.remove(className));
        this.hoverElements.delete(element);
    }

    /**
     * Add pressed effect to element
     */
    addPressedEffect(element: HTMLElement, effect: 'pulse' | 'bounce' | 'shrink'): void {
        if (this.pressedElements.has(element)) return;

        element.classList.add(`yt-active-${effect}`);
        this.pressedElements.add(element);
    }

    /**
     * Remove pressed effect from element
     */
    removePressedEffect(element: HTMLElement): void {
        if (!this.pressedElements.has(element)) return;

        const activeClasses = [
            'yt-active-pulse',
            'yt-active-bounce',
            'yt-active-shrink'
        ];

        activeClasses.forEach(className => element.classList.remove(className));
        this.pressedElements.delete(element);
    }

    /**
     * Add long press detection to element
     */
    addLongPress(element: HTMLElement, callback: () => void, duration = 500): void {
        if (this.longPressElements.has(element)) return;

        let timeoutId: NodeJS.Timeout;

        const handleStart = () => {
            timeoutId = setTimeout(() => {
                callback();
                AnimationManager.vibrate(50); // Haptic feedback
            }, duration);
        };

        const handleEnd = () => {
            clearTimeout(timeoutId);
        };

        element.addEventListener('mousedown', handleStart);
        element.addEventListener('mouseup', handleEnd);
        element.addEventListener('mouseleave', handleEnd);
        element.addEventListener('touchstart', handleStart, { passive: true });
        element.addEventListener('touchend', handleEnd, { passive: true });
        element.addEventListener('touchcancel', handleEnd, { passive: true });

        this.longPressElements.add(element);

        // Store handlers for cleanup
        (element as any).longPressHandlers = { handleStart, handleEnd };
    }

    /**
     * Remove long press detection from element
     */
    removeLongPress(element: HTMLElement): void {
        if (!this.longPressElements.has(element)) return;

        if ((element as any).longPressHandlers) {
            const { handleStart, handleEnd } = (element as any).longPressHandlers;
            element.removeEventListener('mousedown', handleStart);
            element.removeEventListener('mouseup', handleEnd);
            element.removeEventListener('mouseleave', handleEnd);
            element.removeEventListener('touchstart', handleStart);
            element.removeEventListener('touchend', handleEnd);
            element.removeEventListener('touchcancel', handleEnd);
            delete (element as any).longPressHandlers;
        }

        this.longPressElements.delete(element);
    }

    /**
     * Add swipe detection to element
     */
    addSwipeDetection(element: HTMLElement, handlers: {
        onSwipeLeft?: () => void;
        onSwipeRight?: () => void;
        onSwipeUp?: () => void;
        onSwipeDown?: () => void;
    }, threshold = 50): void {
        if (this.swipeElements.has(element)) return;

        let startX: number, startY: number;

        const handleStart = (e: TouchEvent) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        };

        const handleEnd = (e: TouchEvent) => {
            if (!startX || !startY) return;

            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;

            const deltaX = endX - startX;
            const deltaY = endY - startY;

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (Math.abs(deltaX) > threshold) {
                    if (deltaX > 0) {
                        handlers.onSwipeRight?.();
                    } else {
                        handlers.onSwipeLeft?.();
                    }
                }
            } else {
                if (Math.abs(deltaY) > threshold) {
                    if (deltaY > 0) {
                        handlers.onSwipeDown?.();
                    } else {
                        handlers.onSwipeUp?.();
                    }
                }
            }

            startX = 0;
            startY = 0;
        };

        element.addEventListener('touchstart', handleStart, { passive: true });
        element.addEventListener('touchend', handleEnd, { passive: true });

        this.swipeElements.add(element);

        // Store handlers for cleanup
        (element as any).swipeHandlers = { handleStart, handleEnd };
    }

    /**
     * Remove swipe detection from element
     */
    removeSwipeDetection(element: HTMLElement): void {
        if (!this.swipeElements.has(element)) return;

        if ((element as any).swipeHandlers) {
            const { handleStart, handleEnd } = (element as any).swipeHandlers;
            element.removeEventListener('touchstart', handleStart);
            element.removeEventListener('touchend', handleEnd);
            delete (element as any).swipeHandlers;
        }

        this.swipeElements.delete(element);
    }

    /**
     * Show tooltip for element
     */
    showTooltip(element: HTMLElement, text: string, position: 'top' | 'bottom' | 'left' | 'right' = 'top'): void {
        let tooltip = element.querySelector('.yt-tooltip') as HTMLElement;
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'yt-tooltip';
            element.appendChild(tooltip);
        }

        tooltip.textContent = text;

        // Position tooltip
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        switch (position) {
            case 'top':
                tooltip.style.bottom = `${rect.height + 8}px`;
                tooltip.style.left = '50%';
                tooltip.style.transform = 'translateX(-50%)';
                break;
            case 'bottom':
                tooltip.style.top = `${rect.height + 8}px`;
                tooltip.style.left = '50%';
                tooltip.style.transform = 'translateX(-50%)';
                break;
            case 'left':
                tooltip.style.right = `${rect.width + 8}px`;
                tooltip.style.top = '50%';
                tooltip.style.transform = 'translateY(-50%)';
                break;
            case 'right':
                tooltip.style.left = `${rect.width + 8}px`;
                tooltip.style.top = '50%';
                tooltip.style.transform = 'translateY(-50%)';
                break;
        }

        // Add position class for arrow
        tooltip.className = `yt-tooltip show ${position}`;
    }

    /**
     * Hide tooltip for element
     */
    hideTooltip(element: HTMLElement): void {
        const tooltip = element.querySelector('.yt-tooltip') as HTMLElement;
        if (tooltip) {
            tooltip.classList.remove('show');
        }
    }

    /**
     * Close all tooltips
     */
    private closeAllTooltips(): void {
        const tooltips = document.querySelectorAll('.yt-tooltip.show');
        tooltips.forEach(tooltip => {
            tooltip.classList.remove('show');
        });
    }

    /**
     * Show success feedback
     */
    showSuccessFeedback(element: HTMLElement): void {
        element.classList.add('yt-success-checkmark');
        setTimeout(() => {
            element.classList.remove('yt-success-checkmark');
        }, 1000);
    }

    /**
     * Show error feedback
     */
    showErrorFeedback(element: HTMLElement, type: 'shake' | 'pulse' = 'shake'): void {
        element.classList.add(`yt-error-${type}`);
        setTimeout(() => {
            element.classList.remove(`yt-error-${type}`);
        }, type === 'shake' ? 500 : 2000);
    }

    /**
     * Create skeleton loading element
     */
    createSkeleton(type: 'text' | 'avatar' | 'button', size: 'small' | 'normal' | 'large' = 'normal'): HTMLElement {
        const skeleton = document.createElement('div');
        skeleton.className = `yt-skeleton yt-skeleton-${type}`;

        if (type === 'text' && size !== 'normal') {
            skeleton.classList.add(size);
        }

        return skeleton;
    }

    /**
     * Create floating action button
     */
    createFAB(icon: string, onClick: () => void): HTMLElement {
        const fab = document.createElement('button');
        fab.className = 'yt-fab';
        fab.innerHTML = icon;
        fab.onclick = onClick;

        // Add ripple effect
        this.addRippleEffect(fab);

        return fab;
    }

    /**
     * Cleanup all interaction handlers
     */
    destroy(): void {
        // Clear all tracked elements
        this.rippleElements.clear();
        this.magneticElements.clear();
        this.tiltElements.clear();
        this.hoverElements.clear();
        this.pressedElements.clear();
        this.longPressElements.clear();
        this.swipeElements.clear();

        // Remove all tooltips
        this.closeAllTooltips();
    }
}

// Export singleton instance
export const interactionManager = InteractionManager.getInstance();

// Export utility functions
export const interactions = {
    addRipple: (element: HTMLElement) => interactionManager.addRippleEffect(element),
    removeRipple: (element: HTMLElement) => interactionManager.removeRippleEffect(element),
    addMagnetic: (element: HTMLElement, strength?: number) => interactionManager.addMagneticEffect(element, strength),
    removeMagnetic: (element: HTMLElement) => interactionManager.removeMagneticEffect(element),
    addTilt3D: (element: HTMLElement, intensity?: number) => interactionManager.addTilt3DEffect(element, intensity),
    removeTilt3D: (element: HTMLElement) => interactionManager.removeTilt3DEffect(element),
    addHover: (element: HTMLElement, effect: 'lift' | 'grow' | 'shrink' | 'rotate' | 'glow') =>
        interactionManager.addHoverEffect(element, effect),
    removeHover: (element: HTMLElement) => interactionManager.removeHoverEffect(element),
    addPressed: (element: HTMLElement, effect: 'pulse' | 'bounce' | 'shrink') =>
        interactionManager.addPressedEffect(element, effect),
    removePressed: (element: HTMLElement) => interactionManager.removePressedEffect(element),
    addLongPress: (element: HTMLElement, callback: () => void, duration?: number) =>
        interactionManager.addLongPress(element, callback, duration),
    removeLongPress: (element: HTMLElement) => interactionManager.removeLongPress(element),
    addSwipe: (element: HTMLElement, handlers: {
        onSwipeLeft?: () => void;
        onSwipeRight?: () => void;
        onSwipeUp?: () => void;
        onSwipeDown?: () => void;
    }, threshold?: number) => interactionManager.addSwipeDetection(element, handlers, threshold),
    removeSwipe: (element: HTMLElement) => interactionManager.removeSwipeDetection(element),
    showTooltip: (element: HTMLElement, text: string, position?: 'top' | 'bottom' | 'left' | 'right') =>
        interactionManager.showTooltip(element, text, position),
    hideTooltip: (element: HTMLElement) => interactionManager.hideTooltip(element),
    showSuccess: (element: HTMLElement) => interactionManager.showSuccessFeedback(element),
    showError: (element: HTMLElement, type?: 'shake' | 'pulse') => interactionManager.showErrorFeedback(element, type),
    createSkeleton: (type: 'text' | 'avatar' | 'button', size?: 'small' | 'normal' | 'large') =>
        interactionManager.createSkeleton(type, size),
    createFAB: (icon: string, onClick: () => void) => interactionManager.createFAB(icon, onClick)
};