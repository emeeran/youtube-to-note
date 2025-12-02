import { StyleManager } from './constants';


export interface AnimationConfig {
    duration?: number;
    easing?: string;
    delay?: number;
    iterations?: number | 'infinite';
    direction?: 'normal' | 'reverse' | 'alternate';
    fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
}

export interface TransitionConfig extends AnimationConfig {
    properties?: string[];
    property?: string;
}

/**
 * Advanced Animation Manager
 */
export class AnimationManager {
    private static activeAnimations = new Set<string>();
    private static animationQueue: Array<() => void> = [];

    /**
     * Animate element properties
     */
    static animate(
        element: HTMLElement,
        properties: Record<string, any>,
        config: AnimationConfig = {}
    ): Promise<void> {
        return new Promise((resolve) => {
            const {
                duration = 300,
                easing = 'ease-out',
                delay = 0,
                fillMode = 'forwards'
            } = config;

            // Set initial state
            Object.assign(element.style, properties);

            // Set transition
            const transitionProperties = Object.keys(properties)
                .map(prop => `${this.kebabCase(prop)}`)
                .join(', ');

            element.style.transition = `${transitionProperties} ${duration}ms ${easing} ${delay}ms`;
            element.style.transitionProperty = 'all';
            element.style.transitionDuration = `${duration}ms`;
            element.style.transitionTimingFunction = easing;
            element.style.transitionDelay = `${delay}ms`;
            element.style.animationFillMode = fillMode;

            // Force reflow
            element.offsetHeight;

            // Add to active animations
            const animationId = this.generateAnimationId(element);
            this.activeAnimations.add(animationId);

            // Resolve after animation completes
            const handleTransitionEnd = () => {
                element.removeEventListener('transitionend', handleTransitionEnd);
                this.activeAnimations.delete(animationId);
                resolve();
            };

            element.addEventListener('transitionend', handleTransitionEnd);
        });
    }

    /**
     * Add stagger animation to multiple elements
     */
    static staggerAnimate(
        elements: HTMLElement[],
        properties: Record<string, any>,
        config: AnimationConfig & { stagger?: number } = {}
    ): Promise<void[]> {
        const { stagger = 100, ...animationConfig } = config;

        return Promise.all(
            elements.map((element, index) => {
                const delayedConfig = { ...animationConfig, delay: (animationConfig.delay || 0) + (index * stagger) };
                return this.animate(element, properties, delayedConfig);
            })
        );
    }

    /**
     * Create fade in animation
     */
    static fadeIn(element: HTMLElement, duration = 300): Promise<void> {
        return this.animate(element, {
            opacity: 1,
            transform: 'translateY(0)'
        }, { duration });
    }

    /**
     * Create fade out animation
     */
    static fadeOut(element: HTMLElement, duration = 300): Promise<void> {
        return this.animate(element, {
            opacity: 0,
            transform: 'translateY(-10px)'
        }, { duration });
    }

    /**
     * Create slide up animation
     */
    static slideUp(element: HTMLElement, duration = 300): Promise<void> {
        return this.animate(element, {
            transform: 'translateY(0)',
            opacity: 1
        }, { duration });
    }

    /**
     * Create slide down animation
     */
    static slideDown(element: HTMLElement, duration = 300): Promise<void> {
        return this.animate(element, {
            transform: 'translateY(0)',
            opacity: 1
        }, { duration });
    }

    /**
     * Create slide in from left
     */
    static slideInLeft(element: HTMLElement, duration = 300): Promise<void> {
        return this.animate(element, {
            transform: 'translateX(0)',
            opacity: 1
        }, { duration });
    }

    /**
     * Create slide in from right
     */
    static slideInRight(element: HTMLElement, duration = 300): Promise<void> {
        return this.animate(element, {
            transform: 'translateX(0)',
            opacity: 1
        }, { duration });
    }

    /**
     * Create scale in animation
     */
    static scaleIn(element: HTMLElement, duration = 300): Promise<void> {
        return this.animate(element, {
            transform: 'scale(1)',
            opacity: 1
        }, { duration });
    }

    /**
     * Create bounce animation
     */
    static bounce(element: HTMLElement, duration = 600): Promise<void> {
        element.style.animation = `bounce ${duration}ms ease-out`;
        return new Promise(resolve => {
            element.addEventListener('animationend', () => {
                element.style.animation = '';
                resolve();
            }, { once: true });
        });
    }

    /**
     * Create pulse animation
     */
    static pulse(element: HTMLElement, duration = 1000): Promise<void> {
        element.style.animation = `pulse ${duration}ms ease-in-out infinite`;
        return new Promise(resolve => {
            // Pulse animations run infinitely, so resolve after first iteration
            setTimeout(resolve, duration);
        });
    }

    /**
     * Create shake animation for errors
     */
    static shake(element: HTMLElement, intensity = 1): Promise<void> {
        const duration = 500 / intensity;
        element.style.animation = `shake ${duration}ms ease-in-out`;
        return new Promise(resolve => {
            element.addEventListener('animationend', () => {
                element.style.animation = '';
                    resolve();
                }, { once: true });
        });
    }

    /**
     * Create highlight animation
     */
    static highlight(element: HTMLElement, color = 'yellow'): Promise<void> {
        const originalBackground = element.style.backgroundColor;
        const originalBorder = element.style.borderColor;

        return this.animate(element, {
            backgroundColor: color,
            borderColor: color
        }, { duration: 150 })
            .then(() => {
                return this.animate(element, {
                    backgroundColor: originalBackground,
                    borderColor: originalBorder
                }, { duration: 150 });
            });
    }

    /**
     * Create ripple effect
     */
    static createRipple(event: MouseEvent, element: HTMLElement): void {
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        const ripple = document.createElement('span');
        ripple.className = 'yt-ripple';
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.6);
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            transform: scale(0);
            animation: ripple-animation 0.6s ease-out;
            pointer-events: none;
        `;

        element.appendChild(ripple);

        // Remove after animation
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    }

    /**
     * Create loading shimmer effect
     */
    static shimmer(element: HTMLElement, duration = 2000): void {
        element.style.backgroundImage = `linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.1) 0%,
            rgba(255, 255, 255, 0.3) 20%,
            rgba(255, 255, 255, 0.1) 40%,
            rgba(255, 255, 255, 0.1) 100%
        )`;
        element.style.backgroundSize = '200% 100%';
        element.style.animation = `shimmer ${duration}ms linear infinite`;

        setTimeout(() => {
            element.style.backgroundImage = '';
            element.style.animation = '';
        }, duration);
    }

    /**
     * Create typing effect for text
     */
    static typeText(element: HTMLElement, text: string, speed = 50): Promise<void> {
        return new Promise(resolve => {
            element.textContent = '';
            element.style.borderRight = '2px solid transparent';

            let index = 0;
            const typeInterval = setInterval(() => {
                if (index < text.length) {
                    element.textContent += text[index];
                    index++;
                } else {
                    clearInterval(typeInterval);
                    element.style.borderRight = '2px solid transparent';
                    resolve();
                }
            }, speed);
        });
    }

    /**
     * Create morphing animation between shapes
     */
    static morph(
        element: HTMLElement,
        fromPath: string,
        toPath: string,
        duration = 500
    ): Promise<void> {
        // This would require SVG morphing implementation
        // For now, we'll use CSS transforms
        return this.animate(element, {
            transform: `scale(1) rotate(0deg)`,
            clipPath: toPath
        }, { duration });
    }

    /**
     * Create parallax effect
     */
    static parallax(element: HTMLElement, intensity = 0.5): void {
        let ticking = false;
        let lastTime = 0;

        const handleScroll = () => {
            if (!ticking) {
                requestAnimationFrame((currentTime) => {
                    const rect = element.getBoundingClientRect();
                    const speed = 0.5;
                    const yPos = rect.top * intensity;

                    element.style.transform = `translateY(${yPos}px)`;
                    ticking = false;
                    lastTime = currentTime;
                });
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
    }

    /**
     * Create magnetic effect for buttons
     */
    static magnetic(element: HTMLElement, strength = 0.3): void {
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
    }

    /**
     * Create 3D tilt effect for cards
     */
    static tilt3D(element: HTMLElement, intensity = 1): void {
        const handleMouseMove = (e: MouseEvent) => {
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = element.top + rect.height / 2;

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
    }

    /**
     * Cancel all animations for an element
     */
    static cancelAnimations(element: HTMLElement): void {
        element.style.animation = '';
        element.style.transition = '';

        // Remove all transition properties
        element.style.transitionProperty = '';
        element.style.transitionDuration = '';
        element.style.transitionTimingFunction = '';
        element.style.transitionDelay = '';
    }

    /**
     * Generate unique animation ID
     */
    private static generateAnimationId(element: HTMLElement): string {
        return `anim_${Date.now()}_${element.tagName.toLowerCase()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Queue animation for later execution
     */
    static queue(animation: () => void): void {
        this.animationQueue.push(animation);
    }

    /**
     * Process queued animations
     */
    static processQueue(): Promise<void> {
        if (this.animationQueue.length === 0) return Promise.resolve();

        const animations = [...this.animationQueue];
        this.animationQueue = [];

        return animations.reduce((promise, animation) => {
            return promise.then(() => animation());
        }, Promise.resolve());
    }

    /**
     * Pause all animations
     */
    static pause(): void {
        document.querySelectorAll('[style*="transition"]').forEach(element => {
            (element as HTMLElement).style.animationPlayState = 'paused';
        });
    }

    /**
     * Resume all paused animations
     */
    static resume(): void {
        document.querySelectorAll('[style*="transition"]').forEach(element => {
            (element as HTMLElement).style.animationPlayState = 'running';
        });
    }

    /**
     * Add custom keyframe animation
     */
    static addKeyframe(
        name: string,
        keyframes: Record<number, Record<string, string>>
    ): void {
        const keyframeCSS = Object.entries(keyframes)
            .map(([percent, styles]) => {
                const styleEntries = Object.entries(styles)
                    .map(([prop, value]) => `${prop}: ${value}`)
                    .join('; ');
                return `${percent}% { ${styleEntries} }`;
            })
            .join('\n');

        const cssRule = `@keyframes ${name} {\n${keyframeCSS}\n}`;
        StyleManager.addClass('keyframes', {
            [name]: cssRule
        });
    }

    /**
     * Create spring animation
     */
    static spring(
        element: HTMLElement,
        targetStyles: Record<string, any>,
        config: { tension?: number; friction?: number } = {}
    ): Promise<void> {
        const { tension = 300, friction = 10 } = config;

        // Simple spring implementation
        return new Promise(resolve => {
            const startStyles: Record<string, any> = {};
            const endStyles: Record<string, any> = {};

            Object.keys(targetStyles).forEach(key => {
                startStyles[key] = element.style.getPropertyValue(key);
                endStyles[key] = targetStyles[key];
            });

            let startTime: number | null = null;
            let animationId: number;

            const animate = (currentTime: number) => {
                if (!startTime) startTime = currentTime;
                const elapsed = currentTime - startTime;

                // Simple spring physics
                const progress = Math.min(elapsed / 300, 1); // 300ms target duration

                // Damped spring formula
                const springProgress = 1 - Math.exp(-tension * progress / 100);
                const dampingProgress = Math.exp(-friction * progress / 10);

                const currentProgress = springProgress * (1 - dampingProgress) + dampingProgress;

                Object.keys(targetStyles).forEach(key => {
                    const startValue = parseFloat(startStyles[key] || '0');
                    const endValue = parseFloat(endStyles[key] || '0');
                    const currentValue = startValue + (endValue - startValue) * currentProgress;

                    element.style.setProperty(key, `${currentValue}${key.includes('color') ? '' : 'px'}`);
                });

                if (progress < 1) {
                    animationId = requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };

            animationId = requestAnimationFrame(animate);
        });
    }
}

// Add custom CSS for animations
StyleManager.addClass('ripple-animation', {
    '0%': {
        transform: 'scale(0)',
        opacity: '0.8'
    },
    '50%': {
        opacity: 0.4
    },
    '100%': {
        transform: 'scale(2)',
        opacity: '0'
    }
});

StyleManager.addClass('shake', {
    '0%, 100%': {
        transform: 'translateX(0)'
    },
    '10%, 30%, 50%, 70%, 90%': {
        transform: 'translateX(-2px)'
    },
    '20%, 40%, 60%, 80%': {
        transform: 'translateX(2px)'
    }
});

// Export animation utilities
export const AnimationUtils = {
    /**
     * Create entrance animation
     */
    entrance: (element: HTMLElement, type: 'fade' | 'slide' | 'scale' | 'bounce' = 'fade'): Promise<void> => {
        switch (type) {
            case 'fade':
                return AnimationManager.fadeIn(element);
            case 'slide':
                return AnimationManager.slideUp(element);
            case 'scale':
                return AnimationManager.scaleIn(element);
            case 'bounce':
                return AnimationManager.bounce(element);
            default:
                return AnimationManager.fadeIn(element);
        }
    },

    /**
     * Create exit animation
     */
    exit: (element: HTMLElement, type: 'fade' | 'slide' | 'scale' = 'fade'): Promise<void> => {
        switch (type) {
            case 'fade':
                return AnimationManager.fadeOut(element);
            case 'slide':
                return AnimationManager.animate(element, {
                    transform: 'translateY(-20px)',
                    opacity: 0
                });
            case 'scale':
                return AnimationManager.animate(element, {
                    transform: 'scale(0.8)',
                    opacity: 0
                });
            default:
                return AnimationManager.fadeOut(element);
        }
    },

    /**
     * Create staggered entrance for multiple elements
     */
    staggerEntrance: (
        elements: HTMLElement[],
        type: 'fade' | 'slide' | 'scale' = 'fade',
        stagger = 100
    ): Promise<void[]> => {
        return AnimationManager.staggerAnimate(
            elements,
            {
                opacity: 1,
                transform: type === 'slide' ? 'translateY(0)' : type === 'scale' ? 'scale(1)' : undefined
            },
            { stagger }
        );
    },

    /**
     * Create smooth height animation
     */
    smoothHeight: (element: HTMLElement, targetHeight: number, duration = 300): Promise<void> => {
        const startHeight = element.offsetHeight;
        return AnimationManager.animate(element, {
            height: `${targetHeight}px`,
            maxHeight: `${targetHeight}px`
        }, { duration });
    },

    /**
     * Create smooth width animation
     */
    smoothWidth: (element: HTMLElement, targetWidth: number, duration = 300): Promise<void> => {
        const startWidth = element.offsetWidth;
        return AnimationManager.animate(element, {
            width: `${targetWidth}px`,
            maxWidth: `${targetWidth}px`
        }, { duration });
    }
};