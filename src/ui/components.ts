import { Component, Modal, Notice, Setting } from 'obsidian';

export interface UIComponentProps {
    className?: string;
    children?: any;
    style?: Record<string, string>;
    onClick?: () => void;
    onHover?: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
}

export interface ButtonProps extends UIComponentProps {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'small' | 'medium' | 'large';
    disabled?: boolean;
    loading?: boolean;
    icon?: string;
    fullWidth?: boolean;
    tooltip?: string;
}

export interface InputProps extends UIComponentProps {
    type?: 'text' | 'email' | 'password' | 'url' | 'search';
    placeholder?: string;
    value?: string;
    defaultValue?: string;
    label?: string;
    error?: string;
    helper?: string;
    required?: boolean;
    disabled?: boolean;
    maxLength?: number;
    autoComplete?: string;
}

export interface CardProps extends UIComponentProps {
    variant?: 'default' | 'elevated' | 'outlined';
    padding?: 'small' | 'medium' | 'large';
    interactive?: boolean;
    hover?: boolean;
}

export interface ToastConfig {
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    duration?: number;
    action?: {
        label: string;
        callback: () => void;
    };
    dismissible?: boolean;
    icon?: string;
}

/**
 * Modern Button Component
 */
export class Button {
    static create(props: ButtonProps): HTMLElement {
        const button = document.createElement('button');
        button.className = this.getCSSClasses(props);

        // Set styles
        Object.assign(button.style, this.getStyles(props));

        // Add content
        if (props.icon) {
            const icon = document.createElement('span');
            icon.className = 'yt-button-icon';
            icon.textContent = props.icon;
            button.appendChild(icon);
        }

        if (props.children || props.loading) {
            const content = document.createElement('span');
            content.className = 'yt-button-content';

            if (props.loading) {
                const spinner = this.createSpinner();
                content.appendChild(spinner);
            } else {
                content.textContent = props.children;
            }

            button.appendChild(content);
        }

        // Add event listeners
        if (props.onClick) {
            button.addEventListener('click', props.onClick);
        }

        if (props.onHover) {
            button.addEventListener('mouseenter', props.onHover);
            button.addEventListener('mouseleave', () => {});
        }

        // Add tooltip
        if (props.tooltip) {
            button.setAttribute('aria-label', props.tooltip);
            button.setAttribute('title', props.tooltip);
        }

        return button;
    }

    private static getCSSClasses(props: ButtonProps): string {
        const classes = ['yt-button'];

        classes.push(`yt-button--${props.variant || 'primary'}`);
        classes.push(`yt-button--${props.size || 'medium'}`);

        if (props.disabled) classes.push('yt-button--disabled');
        if (props.loading) classes.push('yt-button--loading');
        if (props.fullWidth) classes.push('yt-button--full-width');
        if (props.className) classes.push(props.className);

        return classes.join(' ');
    }

    private static getStyles(props: ButtonProps): Record<string, string> {
        const baseStyles = {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
            fontFamily: 'var(--font-ui-medium)',
            fontWeight: '500',
            fontSize: '14px',
            lineHeight: '1.2',
            border: 'none',
            cursor: props.disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            outline: 'none',
            position: 'relative',
            overflow: 'hidden',
            gap: '6px',
            userSelect: 'none',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale'
        };

        const variantStyles = this.getVariantStyles(props.variant || 'primary');
        const sizeStyles = this.getSizeStyles(props.size || 'medium');

        return { ...baseStyles, ...variantStyles, ...sizeStyles };
    }

    private static getVariantStyles(variant: string): Record<string, string> {
        const variants = {
            primary: {
                backgroundColor: 'var(--interactive-accent)',
                color: 'var(--text-on-accent)',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)'
            },
            secondary: {
                backgroundColor: 'var(--background-modifier-hover)',
                color: 'var(--text-normal)',
                border: '1px solid var(--background-modifier-border)'
            },
            ghost: {
                backgroundColor: 'transparent',
                color: 'var(--text-muted)'
            },
            danger: {
                backgroundColor: 'var(--color-red)',
                color: 'white'
            }
        };

        return variants[variant as keyof typeof variants] || variants.primary;
    }

    private static getSizeStyles(size: string): Record<string, string> {
        const sizes = {
            small: {
                padding: '6px 12px',
                fontSize: '12px',
                minHeight: '32px'
            },
            medium: {
                padding: '8px 16px',
                fontSize: '14px',
                minHeight: '40px'
            },
            large: {
                padding: '12px 24px',
                fontSize: '16px',
                minHeight: '48px'
            }
        };

        return sizes[size as keyof typeof sizes] || sizes.medium;
    }

    private static createSpinner(): HTMLElement {
        const spinner = document.createElement('div');
        spinner.className = 'yt-spinner';
        spinner.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; animation: spin 1s linear infinite;">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
        `;
        return spinner;
    }
}

/**
 * Modern Input Component
 */
export class Input {
    static create(props: InputProps): HTMLElement {
        const container = document.createElement('div');
        container.className = 'yt-input-container';

        if (props.label) {
            const label = document.createElement('label');
            label.className = 'yt-input-label';
            label.textContent = props.label;
            label.setAttribute('for', this.generateId());
            container.appendChild(label);
        }

        const input = document.createElement('input');
        input.className = this.getCSSClasses(props);
        input.type = props.type || 'text';

        if (props.value !== undefined) input.value = props.value;
        if (props.defaultValue) input.defaultValue = props.defaultValue;
        if (props.placeholder) input.placeholder = props.placeholder;
        if (props.maxLength) input.maxLength = props.maxLength;
        if (props.required) input.required = props.required;
        if (props.disabled) input.disabled = props.disabled;
        if (props.autoComplete) input.autoComplete = props.autoComplete;

        container.appendChild(input);

        if (props.error) {
            const error = document.createElement('div');
            error.className = 'yt-input-error';
            error.textContent = props.error;
            container.appendChild(error);
        }

        if (props.helper) {
            const helper = document.createElement('div');
            helper.className = 'yt-input-helper';
            helper.textContent = props.helper;
            container.appendChild(helper);
        }

        // Add event listeners
        if (props.onClick) input.addEventListener('click', props.onClick);
        if (props.onFocus) input.addEventListener('focus', props.onFocus);
        if (props.onBlur) input.addEventListener('blur', props.onBlur);

        return container;
    }

    private static getCSSClasses(props: InputProps): string {
        const classes = ['yt-input'];

        if (props.error) classes.push('yt-input--error');
        if (props.disabled) classes.push('yt-input--disabled');
        if (props.className) classes.push(props.className);

        return classes.join(' ');
    }

    private static generateId(): string {
        return `yt-input-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * Modern Card Component
 */
export class Card {
    static create(props: CardProps): HTMLElement {
        const card = document.createElement('div');
        card.className = this.getCSSClasses(props);

        // Set styles
        Object.assign(card.style, this.getStyles(props));

        if (props.children) {
            card.appendChild(typeof props.children === 'string' ?
                document.createTextNode(props.children) : props.children);
        }

        // Add interactive hover effects
        if (props.interactive) {
            card.style.cursor = 'pointer';
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-2px)';
                card.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = this.getBoxShadow(props);
            });

            if (props.onClick) {
                card.addEventListener('click', props.onClick);
            }
        }

        return card;
    }

    private static getCSSClasses(props: CardProps): string {
        const classes = ['yt-card'];

        classes.push(`yt-card--${props.variant || 'default'}`);
        classes.push(`yt-card--${props.padding || 'medium'}`);

        if (props.interactive) classes.push('yt-card--interactive');
        if (props.hover) classes.push('yt-card--hover');
        if (props.className) classes.push(props.className);

        return classes.join(' ');
    }

    private static getStyles(props: CardProps): Record<string, string> {
        const baseStyles = {
            borderRadius: '8px',
            backgroundColor: 'var(--background-primary)',
            border: '1px solid var(--background-modifier-border)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            fontFamily: 'var(--font-ui-medium)',
            color: 'var(--text-normal)',
            position: 'relative',
            overflow: 'hidden'
        };

        const variantStyles = this.getVariantStyles(props.variant || 'default');
        const paddingStyles = this.getPaddingStyles(props.padding || 'medium');

        return { ...baseStyles, ...variantStyles, ...paddingStyles };
    }

    private static getVariantStyles(variant: string): Record<string, string> {
        const variants = {
            default: {
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)'
            },
            elevated: {
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1), 0 6px 10px rgba(0, 0, 0, 0.08)'
            },
            outlined: {
                border: '2px solid var(--interactive-accent)',
                boxShadow: 'none'
            }
        };

        return variants[variant as keyof typeof variants] || variants.default;
    }

    private static getPaddingStyles(padding: string): Record<string, string> {
        const paddings = {
            small: { padding: '12px' },
            medium: { padding: '16px' },
            large: { padding: '24px' }
        };

        return paddings[padding as keyof typeof paddings] || paddings.medium;
    }

    private static getBoxShadow(props: CardProps): string {
        const variant = props.variant || 'default';
        if (variant === 'elevated') {
            return '0 10px 25px rgba(0, 0, 0, 0.1), 0 6px 10px rgba(0, 0, 0, 0.08)';
        }
        return '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)';
    }
}

/**
 * Toast Notification Manager
 */
export class ToastManager {
    private static container: HTMLElement | null = null;
    private static toasts: HTMLElement[] = [];

    static show(config: ToastConfig): HTMLElement {
        this.ensureContainer();

        const toast = this.createToast(config);
        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Auto-dismiss
        if (config.duration !== 0) {
            setTimeout(() => this.remove(toast), config.duration || 5000);
        }

        // Animate in
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        });

        return toast;
    }

    private static ensureContainer(): void {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'yt-toast-container';
            this.container.id = 'yt-toast-container';

            // Add styles
            Object.assign(this.container.style, {
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: '99999',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                pointerEvents: 'none'
            });

            document.body.appendChild(this.container);
        }
    }

    private static createToast(config: ToastConfig): HTMLElement {
        const toast = document.createElement('div');
        toast.className = `yt-toast yt-toast--${config.type || 'info'}`;

        // Add icon
        if (config.icon) {
            const icon = document.createElement('span');
            icon.className = 'yt-toast-icon';
            icon.textContent = config.icon;
            toast.appendChild(icon);
        }

        // Add message
        const message = document.createElement('span');
        message.className = 'yt-toast-message';
        message.textContent = config.message;
        toast.appendChild(message);

        // Add action button
        if (config.action) {
            const action = document.createElement('button');
            action.className = 'yt-toast-action';
            action.textContent = config.action.label;
            action.addEventListener('click', (e) => {
                e.stopPropagation();
                config.action.callback();
                this.remove(toast);
            });
            toast.appendChild(action);
        }

        // Add dismiss button
        if (config.dismissible !== false) {
            const dismiss = document.createElement('button');
            dismiss.className = 'yt-toast-dismiss';
            dismiss.innerHTML = '×';
            dismiss.addEventListener('click', (e) => {
                e.stopPropagation();
                this.remove(toast);
            });
            toast.appendChild(dismiss);
        }

        // Set styles
        Object.assign(toast.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            minWidth: '300px',
            maxWidth: '500px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            borderLeft: '4px solid',
            transform: 'translateX(100%)',
            opacity: '0',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'pointer',
            pointerEvents: 'auto',
            backdropFilter: 'blur(8px)',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale'
        });

        // Set type-specific styles
        this.setToastStyles(toast, config.type || 'info');

        return toast;
    }

    private static setToastStyles(toast: HTMLElement, type: string): void {
        const styles = {
            info: {
                backgroundColor: 'var(--background-primary)',
                borderLeftColor: 'var(--color-blue)',
                color: 'var(--text-normal)'
            },
            success: {
                backgroundColor: 'var(--background-primary)',
                borderLeftColor: 'var(--color-green)',
                color: 'var(--text-normal)'
            },
            warning: {
                backgroundColor: 'var(--background-primary)',
                borderLeftColor: 'var(--color-orange)',
                color: 'var(--text-normal)'
            },
            error: {
                backgroundColor: 'var(--background-primary)',
                borderLeftColor: 'var(--color-red)',
                color: 'var(--text-normal)'
            }
        };

        Object.assign(toast.style, styles[type as keyof typeof styles] || styles.info);
    }

    static remove(toast: HTMLElement): void {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            const index = this.toasts.indexOf(toast);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
        }, 300);
    }

    static clear(): void {
        this.toasts.forEach(toast => this.remove(toast));
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
            this.container = null;
        }
    }
}

/**
 * Loading Spinner Component
 */
export class LoadingSpinner {
    static create(size: 'small' | 'medium' | 'large' = 'medium'): HTMLElement {
        const spinner = document.createElement('div');
        spinner.className = 'yt-loading-spinner';
        spinner.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
        `;

        const sizes = {
            small: { width: '16px', height: '16px' },
            medium: { width: '24px', height: '24px' },
            large: { width: '32px', height: '32px' }
        };

        Object.assign(spinner.style, {
            display: 'inline-block',
            animation: 'spin 1s linear infinite',
            ...sizes[size]
        });

        return spinner;
    }
}

/**
 * Progress Bar Component
 */
export class ProgressBar {
    static create(max: number, showLabel: boolean = true): HTMLElement {
        const container = document.createElement('div');
        container.className = 'yt-progress-container';

        if (showLabel) {
            const label = document.createElement('div');
            label.className = 'yt-progress-label';
            label.textContent = '0%';
            container.appendChild(label);
        }

        const progress = document.createElement('div');
        progress.className = 'yt-progress';
        progress.innerHTML = `
            <div class="yt-progress-bar" style="width: 0%">
                <div class="yt-progress-fill"></div>
            </div>
        `;

        container.appendChild(progress);

        const progressBar = progress.querySelector('.yt-progress-bar') as HTMLElement;
        const fill = progress.querySelector('.yt-progress-fill') as HTMLElement;
        const labelElement = showLabel ? container.querySelector('.yt-progress-label') as HTMLElement : null;

        return {
            container,
            progressBar,
            fill,
            label: labelElement,
            update: (value: number, text?: string) => {
                const percentage = Math.min(100, Math.max(0, (value / max) * 100));
                progressBar.style.width = `${percentage}%`;
                if (labelElement) {
                    labelElement.textContent = text !== undefined ? text : `${Math.round(percentage)}%`;
                }
            },
            setIndeterminate: () => {
                progressBar.style.width = '100%';
                progressBar.classList.add('yt-progress-bar--indeterminate');
                if (fill) {
                    fill.style.display = 'none';
                }
            }
        } as any;
    }
}

/**
 * Utility Functions
 */
export const UIUtils = {
    /**
     * Create a debounced function
     */
    debounce: <T extends (...args: any[]) => any>(fn: T, delay: number) => {
        let timeoutId: number;
        return ((...args: Parameters<T>) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delay);
        }) as T;
    },

    /**
     * Create a throttled function
     */
    throttle: <T extends (...args: any[]) => any>(fn: T, limit: number) => {
        let inThrottle = false;
        return ((...args: Parameters<T>) => {
            if (!inThrottle) {
                fn(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }) as T;
    },

    /**
     * Create a delay
     */
    delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

    /**
     * Animate element properties
     */
    animate: (element: HTMLElement, properties: Record<string, string>, duration: number = 300) => {
        return new Promise(resolve => {
            element.style.transition = `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
            Object.assign(element.style, properties);

            const handleTransitionEnd = () => {
                element.removeEventListener('transitionend', handleTransitionEnd);
                resolve(element);
            };

            element.addEventListener('transitionend', handleTransitionEnd);
        });
    }
};