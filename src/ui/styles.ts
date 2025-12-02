
/**
 * Modern Design System for YouTube Clipper Plugin
 * Comprehensive CSS variables, animations, and utility classes
 */

// CSS Variables for theming
export const CSSVariables = `
    /* Primary Colors */
    --yt-color-primary: 255, 87, 51;
    --yt-color-secondary: 100, 149, 237;
    --yt-color-accent: 138, 43, 226;

    /* Semantic Colors */
    --yt-color-success: 34, 197, 94;
    --yt-color-warning: 251, 146, 60;
    --yt-color-error: 239, 68, 68;
    --yt-color-info: 59, 130, 246;

    /* Neutral Colors */
    --yt-color-gray-50: 249, 250, 251;
    --yt-color-gray-100: 243, 244, 246;
    --yt-color-gray-200: 229, 231, 235;
    --yt-color-gray-300: 203, 213, 225;
    --yt-color-gray-400: 148, 163, 184;
    --yt-color-gray-500: 100, 116, 139;
    --yt-color-gray-600: 71, 85, 105;
    --yt-color-gray-700: 51, 65, 85;
    --yt-color-gray-800: 30, 41, 59;
    --yt-color-gray-900: 15, 23, 42;

    /* Brand Colors */
    --yt-color-youtube-red: 255, 0, 0;
    --yt-color-youtube-dark: 196, 0, 0;

    /* Spacing Scale */
    --yt-space-1: 4px;
    --yt-space-2: 8px;
    --yt-space-3: 12px;
    --yt-space-4: 16px;
    --yt-space-5: 20px;
    --yt-space-6: 24px;
    --yt-space-8: 32px;
    --yt-space-10: 40px;
    --yt-space-12: 48px;
    --yt-space-16: 64px;
    --yt-space-20: 80px;
    --yt-space-24: 96px;

    /* Border Radius */
    --yt-radius-sm: 4px;
    --yt-radius-md: 6px;
    --yt-radius-lg: 8px;
    --yt-radius-xl: 12px;
    --yt-radius-2xl: 16px;
    --yt-radius-full: 9999px;

    /* Shadows */
    --yt-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
    --yt-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
    --yt-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
    --yt-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
    --yt-shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04);
    --yt-shadow-2xl: 0 25px 50px rgba(0, 0, 0, 0.25);

    /* Transitions */
    --yt-transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
    --yt-transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
    --yt-transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);

    /* Typography Scale */
    --yt-font-size-xs: 12px;
    --yt-font-size-sm: 14px;
    --yt-font-size-base: 16px;
    --yt-font-size-lg: 18px;
    --yt-font-size-xl: 20px;
    --yt-font-size-2xl: 24px;
    --yt-font-size-3xl: 30px;
    --yt-font-size-4xl: 36px;

    /* Font Weights */
    --yt-font-weight-light: 300;
    --yt-font-weight-normal: 400;
    --yt-font-weight-medium: 500;
    --yt-font-weight-semibold: 600;
    --yt-font-weight-bold: 700;

    /* Line Heights */
    --yt-line-height-tight: 1.25;
    --yt-line-height-normal: 1.5;
    --yt-line-height-relaxed: 1.6;

    /* Z-Index Scale */
    --yt-z-index-dropdown: 1000;
    --yt-z-index-sticky: 1020;
    --yt-z-index-fixed: 1030;
    --yt-z-index-modal-backdrop: 1040;
    --yt-z-index-modal: 1050;
    --yt-z-index-popover: 1060;
    --yt-z-index-tooltip: 1070;
    --yt-z-index-toast: 1080;
`;

export const Animations = `
    /* Keyframe Animations */
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    @keyframes bounce {
        0%, 20%, 53%, 80%, 100% {
            transform: translate3d(0, 0, 0);
        }
        40%, 43% {
            transform: translate3d(0, -8px, 0);
        }
        70% {
            transform: translate3d(0, -4px, 0);
        }
        90% {
            transform: translate3d(0, -2px, 0);
        }
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }

    @keyframes slideInUp {
        from {
            transform: translateY(100%);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }

    @keyframes slideInDown {
        from {
            transform: translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }

    @keyframes slideInLeft {
        from {
            transform: translateX(-100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes scaleIn {
        from {
            transform: scale(0.8);
            opacity: 0;
        }
        to {
            transform: scale(1);
            opacity: 1;
        }
    }

    @keyframes shimmer {
        0% {
            background-position: -200% 0;
        }
        100% {
            background-position: 200% 0;
        }
    }

    @keyframes gradientShift {
        0%, 100% {
            background-position: 0% 50%;
        }
        50% {
            background-position: 100% 50%;
        }
    }
`;

export const ComponentStyles = `
    /* Base Component Styles */
    .yt-button {
        font-family: var(--font-ui-medium);
        font-weight: 500;
        font-size: var(--yt-font-size-sm);
        line-height: var(--yt-line-height-tight);
        border: none;
        border-radius: var(--yt-radius-md);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--yt-space-2);
        transition: all var(--yt-transition-base);
        outline: none;
        position: relative;
        overflow: hidden;
        user-select: none;
        text-decoration: none;
        background: none;
        white-space: nowrap;
    }

    .yt-button:hover:not(.yt-button--disabled) {
        transform: translateY(-1px);
        box-shadow: var(--yt-shadow-md);
    }

    .yt-button:active:not(.yt-button--disabled) {
        transform: translateY(0);
        box-shadow: var(--yt-shadow-sm);
    }

    .yt-button:focus-visible {
        outline: 2px solid var(--yt-color-accent);
        outline-offset: 2px;
    }

    .yt-button--primary {
        background: linear-gradient(135deg, rgb(var(--yt-color-primary)), rgb(var(--yt-color-secondary)));
        color: white;
        box-shadow: var(--yt-shadow);
    }

    .yt-button--primary:hover {
        background: linear-gradient(135deg, color(rgb(var(--yt-color-primary)) / 0.9), color(rgb(var(--yt-color-secondary)) / 0.9));
    }

    .yt-button--secondary {
        background: rgba(var(--yt-color-gray-100), 0.8);
        color: rgb(var(--yt-color-gray-800));
        border: 1px solid rgba(var(--yt-color-gray-300), 0.5);
    }

    .yt-button--secondary:hover {
        background: rgba(var(--yt-color-gray-200), 0.9);
    }

    .yt-button--ghost {
        background: transparent;
        color: rgb(var(--yt-color-gray-600));
    }

    .yt-button--ghost:hover {
        background: rgba(var(--yt-color-gray-100), 0.5);
    }

    .yt-button--danger {
        background: linear-gradient(135deg, rgb(var(--yt-color-error)), color(rgb(var(--yt-color-error)) / 0.8));
        color: white;
    }

    .yt-button--danger:hover {
        background: linear-gradient(135deg, color(rgb(var(--yt-color-error)) / 0.9), color(rgb(var(--yt-color-error)) / 0.7));
    }

    .yt-button--small {
        padding: var(--yt-space-2) var(--yt-space-3);
        font-size: var(--yt-font-size-xs);
        min-height: 32px;
    }

    .yt-button--medium {
        padding: var(--yt-space-3) var(--yt-space-4);
        font-size: var(--yt-font-size-sm);
        min-height: 40px;
    }

    .yt-button--large {
        padding: var(--yt-space-3) var(--yt-space-6);
        font-size: var(--yt-font-size-base);
        min-height: 48px;
    }

    .yt-button--full-width {
        width: 100%;
    }

    .yt-button--disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
    }

    .yt-button--loading {
        color: transparent;
    }

    .yt-button-icon {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .yt-button-content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--yt-space-2);
    }

    .yt-spinner {
        display: inline-block;
        animation: spin 1s linear infinite;
    }

    /* Input Styles */
    .yt-input-container {
        display: flex;
        flex-direction: column;
        gap: var(--yt-space-2);
    }

    .yt-input-label {
        font-size: var(--yt-font-size-sm);
        font-weight: 500;
        color: rgb(var(--yt-color-gray-700));
        margin-bottom: var(--yt-space-1);
    }

    .yt-input {
        padding: var(--yt-space-3) var(--yt-space-4);
        border: 1px solid rgba(var(--yt-color-gray-300), 0.8);
        border-radius: var(--yt-radius-md);
        font-size: var(--yt-font-size-sm);
        line-height: var(--yt-line-height-normal);
        transition: all var(--yt-transition-base);
        background: rgba(var(--yt-color-gray-50), 0.5);
        color: rgb(var(--yt-color-gray-900));
    }

    .yt-input:focus {
        outline: none;
        border-color: rgb(var(--yt-color-accent));
        box-shadow: 0 0 0 3px rgba(var(--yt-color-accent) / 255, 0.1);
        background: rgba(255, 255, 255, 0.9);
    }

    .yt-input::placeholder {
        color: rgb(var(--yt-color-gray-400));
    }

    .yt-input--error {
        border-color: rgb(var(--yt-color-error));
        box-shadow: 0 0 0 3px rgba(var(--yt-color-error) / 255, 0.1);
    }

    .yt-input--disabled {
        background: rgba(var(--yt-color-gray-100), 0.5);
        color: rgb(var(--yt-color-gray-500));
        cursor: not-allowed;
    }

    .yt-input-error {
        font-size: var(--yt-font-size-xs);
        color: rgb(var(--yt-color-error));
        margin-top: var(--yt-space-1);
    }

    .yt-input-helper {
        font-size: var(--yt-font-size-xs);
        color: rgb(var(--yt-color-gray-500));
        margin-top: var(--yt-space-1);
    }

    /* Card Styles */
    .yt-card {
        border-radius: var(--yt-radius-lg);
        border: 1px solid rgba(var(--yt-color-gray-200), 0.8);
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        box-shadow: var(--yt-shadow);
        transition: all var(--yt-transition-base);
        overflow: hidden;
    }

    .yt-card:hover {
        box-shadow: var(--yt-shadow-md);
        transform: translateY(-2px);
    }

    .yt-card--elevated {
        box-shadow: var(--yt-shadow-lg);
        border: 1px solid rgba(var(--yt-color-gray-200), 0.3);
    }

    .yt-card--outlined {
        border: 2px solid rgba(var(--yt-color-accent), 0.3);
        box-shadow: none;
    }

    .yt-card--interactive {
        cursor: pointer;
        user-select: none;
    }

    .yt-card--interactive:hover {
        transform: translateY(-4px);
        box-shadow: var(--yt-shadow-xl);
    }

    .yt-card--small {
        padding: var(--yt-space-3);
    }

    .yt-card--medium {
        padding: var(--yt-space-4);
    }

    .yt-card--large {
        padding: var(--yt-space-6);
    }

    /* Toast Styles */
    .yt-toast-container {
        position: fixed;
        top: var(--yt-space-5);
        right: var(--yt-space-5);
        z-index: var(--yt-z-index-toast);
        display: flex;
        flex-direction: column;
        gap: var(--yt-space-2);
        pointer-events: none;
    }

    .yt-toast {
        display: flex;
        align-items: center;
        gap: var(--yt-space-3);
        padding: var(--yt-space-3) var(--yt-space-4);
        border-radius: var(--yt-radius-lg);
        font-size: var(--yt-font-size-sm);
        font-weight: 500;
        line-height: var(--yt-line-height-tight);
        min-width: 300px;
        max-width: 500px;
        backdrop-filter: blur(12px);
        pointer-events: auto;
        border-left: 4px solid;
        transform: translateX(100%);
        opacity: 0;
        transition: all var(--yt-transition-slow);
        box-shadow: var(--yt-shadow-lg);
    }

    .yt-toast--info {
        background: rgba(255, 255, 255, 0.95);
        color: rgb(var(--yt-color-gray-800));
        border-left-color: rgb(var(--yt-color-info));
    }

    .yt-toast--success {
        background: rgba(255, 255, 255, 0.95);
        color: rgb(var(--yt-color-gray-800));
        border-left-color: rgb(var(--yt-color-success));
    }

    .yt-toast--warning {
        background: rgba(255, 255, 255, 0.95);
        color: rgb(var(--yt-color-gray-800));
        border-left-color: rgb(var(--yt-color-warning));
    }

    .yt-toast--error {
        background: rgba(255, 255, 255, 0.95);
        color: rgb(var(--yt-color-gray-800));
        border-left-color: rgb(var(--yt-color-error));
    }

    .yt-toast-icon {
        flex-shrink: 0;
        font-size: 18px;
        line-height: 1;
    }

    .yt-toast-message {
        flex: 1;
        min-width: 0;
    }

    .yt-toast-action {
        flex-shrink: 0;
        padding: var(--yt-space-1) var(--yt-space-2);
        border-radius: var(--yt-radius-sm);
        background: rgba(var(--yt-color-gray-100), 0.8);
        color: rgb(var(--yt-color-gray-700));
        font-size: var(--yt-font-size-xs);
        font-weight: 500;
        border: 1px solid rgba(var(--yt-color-gray-300), 0.5);
        cursor: pointer;
        transition: all var(--yt-transition-fast);
    }

    .yt-toast-action:hover {
        background: rgba(var(--yt-color-gray-200), 0.9);
    }

    .yt-toast-dismiss {
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        border-radius: var(--yt-radius-full);
        background: transparent;
        border: none;
        color: rgb(var(--yt-color-gray-500));
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all var(--yt-transition-fast);
        margin-left: var(--yt-space-2);
        opacity: 0.7;
    }

    .yt-toast-dismiss:hover {
        opacity: 1;
        background: rgba(var(--yt-color-gray-100), 0.5);
    }

    /* Progress Bar Styles */
    .yt-progress-container {
        width: 100%;
    }

    .yt-progress-label {
        font-size: var(--yt-font-size-xs);
        font-weight: 500;
        color: rgb(var(--yt-color-gray-600));
        margin-bottom: var(--yt-space-2);
        text-align: center;
    }

    .yt-progress {
        width: 100%;
        height: 8px;
        background: rgba(var(--yt-color-gray-200), 0.8);
        border-radius: var(--yt-radius-full);
        overflow: hidden;
    }

    .yt-progress-bar {
        height: 100%;
        width: 0%;
        transition: width var(--yt-transition-base);
        position: relative;
        background: rgba(var(--yt-color-gray-300), 0.3);
    }

    .yt-progress-fill {
        height: 100%;
        width: 100%;
        background: linear-gradient(90deg, rgb(var(--yt-color-primary)), rgb(var(--yt-color-secondary)));
        border-radius: var(--yt-radius-full);
        position: relative;
    }

    .yt-progress-bar--indeterminate {
        width: 100%;
        background: linear-gradient(90deg,
            transparent 0%,
            rgba(var(--yt-color-primary), 0.3) 20%,
            rgba(var(--yt-color-primary), 0.5) 50%,
            rgba(var(--yt-color-primary), 0.3) 80%,
            transparent 100%);
        animation: shimmer 2s infinite linear;
    }

    /* Loading Spinner Styles */
    .yt-loading-spinner {
        display: inline-block;
        animation: spin 1s linear infinite;
    }

    /* Utility Classes */
    .yt-sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    .yt-text-center { text-align: center; }
    .yt-text-left { text-align: left; }
    .yt-text-right { text-align: right; }
    .yt-text-justify { text-align: justify; }

    .yt-flex { display: flex; }
    .yt-inline-flex { display: inline-flex; }
    .yt-grid { display: grid; }
    .yt-block { display: block; }
    .yt-inline-block { display: inline-block; }
    .yt-hidden { display: none; }

    .yt-items-start { align-items: flex-start; }
    .yt-items-center { align-items: center; }
    .yt-items-end { align-items: flex-end; }
    .yt-items-stretch { align-items: stretch; }

    .yt-justify-start { justify-content: flex-start; }
    .yt-justify-center { justify-content: center; }
    .yt-justify-end { justify-content: flex-end; }
    .yt-justify-between { justify-content: space-between; }
    .yt-justify-around { justify-content: space-around; }
    .yt-justify-evenly { justify-content: space-evenly; }

    .yt-gap-1 { gap: var(--yt-space-1); }
    .yt-gap-2 { gap: var(--yt-space-2); }
    .yt-gap-3 { gap: var(--yt-space-3); }
    .yt-gap-4 { gap: var(--yt-space-4); }
    .yt-gap-5 { gap: var(--yt-space-5); }
    .yt-gap-6 { gap: var(--yt-space-6); }
    .yt-gap-8 { gap: var(--yt-space-8); }

    .yt-m-0 { margin: 0; }
    .yt-m-1 { margin: var(--yt-space-1); }
    .yt-m-2 { margin: var(--yt-space-2); }
    .yt-m-3 { margin: var(--yt-space-3); }
    .yt-m-4 { margin: var(--yt-space-4); }

    .yt-p-0 { padding: 0; }
    .yt-p-1 { padding: var(--yt-space-1); }
    .yt-p-2 { padding: var(--yt-space-2); }
    .yt-p-3 { padding: var(--yt-space-3); }
    .yt-p-4 { padding: var(--yt-space-4); }

    .yt-w-full { width: 100%; }
    .yt-h-full { height: 100%; }
    .yt-min-h-screen { min-height: 100vh; }

    .yt-rounded { border-radius: var(--yt-radius-md); }
    .yt-rounded-sm { border-radius: var(--yt-radius-sm); }
    .yt-rounded-lg { border-radius: var(--yt-radius-lg); }
    .yt-rounded-xl { border-radius: var(--yt-radius-xl); }
    .yt-rounded-full { border-radius: var(--yt-radius-full); }

    .yt-shadow-sm { box-shadow: var(--yt-shadow-sm); }
    .yt-shadow { box-shadow: var(--yt-shadow); }
    .yt-shadow-md { box-shadow: var(--yt-shadow-md); }
    .yt-shadow-lg { box-shadow: var(--yt-shadow-lg); }
    .yt-shadow-xl { box-shadow: var(--yt-shadow-xl); }

    .yt-transition { transition: var(--yt-transition-base); }
    .yt-transition-fast { transition: var(--yt-transition-fast); }
    .yt-transition-slow { transition: var(--yt-transition-slow); }
    .yt-transition-none { transition: none; }
`;

/**
 * Style Manager for injecting and managing styles
 */
export class StyleManager {
    private static isInjected = false;

    static inject(): void {
        if (this.isInjected) return;

        const styleElement = document.createElement('style');
        styleElement.id = 'yt-clipper-styles';
        styleElement.textContent = CSSVariables + Animations + ComponentStyles;

        document.head.appendChild(styleElement);
        this.isInjected = true;
    }

    static remove(): void {
        const styleElement = document.getElementById('yt-clipper-styles');
        if (styleElement) {
            styleElement.remove();
            this.isInjected = false;
        }
    }

    static updateVariables(variables: Record<string, string>): void {
        if (!this.isInjected) return;

        const styleElement = document.getElementById('yt-clipper-styles');
        if (!styleElement) return;

        const cssText = styleElement.textContent;
        let updatedCSS = cssText;

        Object.entries(variables).forEach(([key, value]) => {
            const cssVar = key.startsWith('--') ? key : `--${key}`;
            const regex = new RegExp(`${cssVar}:\\s*[^;]+;`, 'g');
            updatedCSS = updatedCSS.replace(regex, `${cssVar}: ${value};`);
        });

        styleElement.textContent = updatedCSS;
    }

    static addClass(className: string, styles: Record<string, string>): void {
        if (!this.isInjected) return;

        const styleElement = document.getElementById('yt-clipper-styles');
        if (!styleElement) return;

        const newStyles = Object.entries(styles)
            .map(([prop, value]) => `${prop}: ${value}`)
            .join('; ');

        styleElement.textContent += `\n.${className} { ${newStyles} }`;
    }
}

// Utility for generating dynamic styles
export const StyleUtils = {
    // Create gradient background
    gradient: (colors: string[], direction: string = 'to right') => {
        return `linear-gradient(${direction}, ${colors.join(', ')})`;
    },

    // Create rgba color
    rgba: (color: string, alpha: number) => {
        return `rgba(${color}, ${alpha})`;
    },

    // Create shadow
    shadow: (x: number, y: number, blur: number, spread: number, color: string, alpha: number = 1) => {
        return `${x}px ${y}px ${blur}px ${spread}px ${this.rgba(color, alpha)}`;
    },

    // Create responsive media query
    media: (breakpoint: string, styles: string) => {
        return `@media (${breakpoint}) { ${styles} }`;
    },

    // Create keyframe animation
    keyframe: (name: string, frames: Record<number, Record<string, string>>) => {
        const frameEntries = Object.entries(frames)
            .map(([percent, styles]) => {
                const styleEntries = Object.entries(styles)
                    .map(([prop, value]) => `${prop}: ${value}`)
                    .join('; ');
                return `${percent}% { ${styleEntries} }`;
            })
            .join('\n');

        return `@keyframes ${name} {\n${frameEntries}\n}`;
    }
};