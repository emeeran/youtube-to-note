import { a11y } from './accessibility';
import { StyleManager } from './constants/index';


/**
 * Loading state types
 */
export type LoadingType = 'spinner' | 'dots' | 'bars' | 'pulse' | 'skeleton' | 'shimmer' | 'progress';

export interface LoadingConfig {
    type: LoadingType;
    size?: 'small' | 'medium' | 'large';
    color?: string;
    speed?: 'slow' | 'normal' | 'fast';
    text?: string;
    progress?: number;
    overlay?: boolean;
    backdrop?: boolean;
}

/**
 * Advanced loading states and skeleton screens system
 */
export class LoadingStateManager {
    private static instance: LoadingStateManager;
    private activeLoaders: Map<string, HTMLElement> = new Map();
    private skeletonScreens: Map<string, HTMLElement> = new Map();
    private progressBars: Map<string, HTMLElement> = new Map();

    private constructor() {
        this.initializeLoadingStyles();
    }

    static getInstance(): LoadingStateManager {
        if (!LoadingStateManager.instance) {
            LoadingStateManager.instance = new LoadingStateManager();
        }
        return LoadingStateManager.instance;
    }

    /**
     * Initialize loading state styles
     */
    private initializeLoadingStyles(): void {
        const loadingCSS = `
            /* Loading states base styles */
            .yt-loading {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                position: relative;
            }

            .yt-loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(var(--background-primary-rgb), 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                backdrop-filter: blur(2px);
            }

            .yt-loading-backdrop {
                background: rgba(0, 0, 0, 0.5);
            }

            /* Size variants */
            .yt-loading.small {
                width: 16px;
                height: 16px;
            }

            .yt-loading.medium {
                width: 24px;
                height: 24px;
            }

            .yt-loading.large {
                width: 32px;
                height: 32px;
            }

            /* Loading spinner */
            .yt-spinner {
                width: 100%;
                height: 100%;
                border: 2px solid var(--background-modifier-border);
                border-top: 2px solid var(--interactive-accent);
                border-radius: 50%;
                animation: yt-spinner-spin 1s linear infinite;
            }

            .yt-spinner.slow {
                animation-duration: 2s;
            }

            .yt-spinner.fast {
                animation-duration: 0.5s;
            }

            @keyframes yt-spinner-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            /* Loading dots */
            .yt-dots {
                display: flex;
                gap: 4px;
                width: 100%;
                height: 100%;
                align-items: center;
                justify-content: center;
            }

            .yt-dots-dot {
                width: 25%;
                height: 25%;
                background: var(--interactive-accent);
                border-radius: 50%;
                animation: yt-dots-bounce 1.4s ease-in-out infinite both;
            }

            .yt-dots-dot:nth-child(1) { animation-delay: -0.32s; }
            .yt-dots-dot:nth-child(2) { animation-delay: -0.16s; }

            @keyframes yt-dots-bounce {
                0%, 80%, 100% {
                    transform: scale(0.8);
                    opacity: 0.5;
                }
                40% {
                    transform: scale(1);
                    opacity: 1;
                }
            }

            /* Loading bars */
            .yt-bars {
                display: flex;
                gap: 3px;
                width: 100%;
                height: 100%;
                align-items: flex-end;
                justify-content: center;
            }

            .yt-bars-bar {
                width: 20%;
                background: var(--interactive-accent);
                border-radius: 2px;
                animation: yt-bars-stretch 1.2s ease-in-out infinite;
            }

            .yt-bars-bar:nth-child(1) { animation-delay: -1.2s; }
            .yt-bars-bar:nth-child(2) { animation-delay: -1.1s; }
            .yt-bars-bar:nth-child(3) { animation-delay: -1.0s; }
            .yt-bars-bar:nth-child(4) { animation-delay: -0.9s; }
            .yt-bars-bar:nth-child(5) { animation-delay: -0.8s; }

            @keyframes yt-bars-stretch {
                0%, 40%, 100% {
                    transform: scaleY(0.4);
                }
                20% {
                    transform: scaleY(1);
                }
            }

            /* Loading pulse */
            .yt-pulse {
                width: 100%;
                height: 100%;
                background: var(--interactive-accent);
                border-radius: 50%;
                animation: yt-pulse-scale 1.5s ease-in-out infinite;
            }

            @keyframes yt-pulse-scale {
                0% {
                    transform: scale(0.8);
                    opacity: 0.5;
                }
                50% {
                    transform: scale(1.1);
                    opacity: 0.8;
                }
                100% {
                    transform: scale(0.8);
                    opacity: 0.5;
                }
            }

            /* Skeleton screens */
            .yt-skeleton {
                background: linear-gradient(
                    90deg,
                    var(--background-secondary) 0%,
                    var(--background-modifier-hover) 50%,
                    var(--background-secondary) 100%
                );
                background-size: 200% 100%;
                animation: yt-skeleton-shimmer 1.5s ease-in-out infinite;
                border-radius: 4px;
            }

            @keyframes yt-skeleton-shimmer {
                0% {
                    background-position: -200% 0;
                }
                100% {
                    background-position: 200% 0;
                }
            }

            /* Skeleton variants */
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

            .yt-skeleton-title {
                height: 28px;
                width: 60%;
                margin: 8px 0;
            }

            .yt-skeleton-paragraph {
                margin: 16px 0;
            }

            .yt-skeleton-paragraph .yt-skeleton-text:not(:last-child) {
                margin-bottom: 8px;
            }

            .yt-skeleton-paragraph .yt-skeleton-text:last-child {
                width: 80%;
            }

            .yt-skeleton-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
            }

            .yt-skeleton-avatar.large {
                width: 60px;
                height: 60px;
            }

            .yt-skeleton-avatar.small {
                width: 32px;
                height: 32px;
            }

            .yt-skeleton-button {
                height: 36px;
                width: 120px;
                border-radius: 4px;
            }

            .yt-skeleton-card {
                padding: 16px;
                border-radius: 8px;
                margin: 8px 0;
            }

            .yt-skeleton-card-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
            }

            .yt-skeleton-card-content {
                margin: 12px 0;
            }

            .yt-skeleton-list {
                margin: 8px 0;
            }

            .yt-skeleton-list-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 0;
                border-bottom: 1px solid var(--background-modifier-border);
            }

            .yt-skeleton-list-item:last-child {
                border-bottom: none;
            }

            .yt-skeleton-image {
                aspect-ratio: 16/9;
                width: 100%;
            }

            .yt-skeleton-thumbnail {
                width: 80px;
                height: 60px;
                border-radius: 4px;
            }

            /* Progress bars */
            .yt-progress {
                width: 100%;
                height: 4px;
                background: var(--background-modifier-border);
                border-radius: 2px;
                overflow: hidden;
                position: relative;
            }

            .yt-progress.large {
                height: 8px;
                border-radius: 4px;
            }

            .yt-progress-bar {
                height: 100%;
                background: var(--interactive-accent);
                border-radius: inherit;
                transition: width 0.3s ease;
                position: relative;
            }

            .yt-progress-bar.animated {
                animation: yt-progress-pulse 2s ease-in-out infinite;
            }

            @keyframes yt-progress-pulse {
                0% { opacity: 0.8; }
                50% { opacity: 1; }
                100% { opacity: 0.8; }
            }

            .yt-progress-indeterminate {
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                background: linear-gradient(
                    90deg,
                    transparent,
                    var(--interactive-accent),
                    transparent
                );
                animation: yt-progress-slide 1.5s ease-in-out infinite;
            }

            @keyframes yt-progress-slide {
                0% {
                    left: -100%;
                    width: 100%;
                }
                100% {
                    left: 100%;
                    width: 100%;
                }
            }

            /* Loading text with spinner */
            .yt-loading-text {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                color: var(--text-muted);
            }

            .yt-loading-text .yt-spinner {
                width: 16px;
                height: 16px;
            }

            /* Full page loading */
            .yt-loading-page {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: var(--background-primary);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            }

            .yt-loading-page-icon {
                width: 48px;
                height: 48px;
                margin-bottom: 16px;
            }

            .yt-loading-page-text {
                font-size: 16px;
                color: var(--text-normal);
                margin-bottom: 8px;
            }

            .yt-loading-page-subtext {
                font-size: 14px;
                color: var(--text-muted);
            }

            /* Content placeholders */
            .yt-content-placeholder {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 32px;
                text-align: center;
                color: var(--text-muted);
            }

            .yt-content-placeholder-icon {
                font-size: 48px;
                margin-bottom: 16px;
                opacity: 0.5;
            }

            .yt-content-placeholder-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 8px;
                color: var(--text-normal);
            }

            .yt-content-placeholder-text {
                font-size: 14px;
                line-height: 1.4;
            }

            /* Loading states for form elements */
            .yt-form-loading {
                position: relative;
                pointer-events: none;
                opacity: 0.7;
            }

            .yt-form-loading::after {
                content: '';
                position: absolute;
                top: 50%;
                right: 12px;
                transform: translateY(-50%);
                width: 16px;
                height: 16px;
                border: 2px solid var(--background-modifier-border);
                border-top: 2px solid var(--interactive-accent);
                border-radius: 50%;
                animation: yt-spinner-spin 1s linear infinite;
            }

            /* Button loading states */
            .yt-button-loading {
                position: relative;
                pointer-events: none;
                color: transparent !important;
            }

            .yt-button-loading::after {
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
                animation: yt-spinner-spin 1s linear infinite;
            }

            /* Card loading states */
            .yt-card-loading {
                position: relative;
                overflow: hidden;
            }

            .yt-card-loading::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(
                    90deg,
                    transparent,
                    rgba(var(--interactive-accent-rgb), 0.1),
                    transparent
                );
                animation: yt-card-shimmer 1.5s ease-in-out infinite;
                z-index: 1;
            }

            @keyframes yt-card-shimmer {
                0% {
                    left: -100%;
                }
                100% {
                    left: 100%;
                }
            }

            /* Staggered animations for multiple loaders */
            .yt-loading-staggered .yt-spinner:nth-child(1) { animation-delay: 0s; }
            .yt-loading-staggered .yt-spinner:nth-child(2) { animation-delay: 0.1s; }
            .yt-loading-staggered .yt-spinner:nth-child(3) { animation-delay: 0.2s; }
            .yt-loading-staggered .yt-spinner:nth-child(4) { animation-delay: 0.3s; }

            /* Responsive loading states */
            @media (max-width: 768px) {
                .yt-loading-page {
                    padding: 20px;
                }

                .yt-loading-page-icon {
                    width: 36px;
                    height: 36px;
                    margin-bottom: 12px;
                }

                .yt-loading-page-text {
                    font-size: 14px;
                }

                .yt-loading-page-subtext {
                    font-size: 12px;
                }
            }

            /* High contrast mode support */
            @media (prefers-contrast: high) {
                .yt-spinner {
                    border-width: 3px;
                }

                .yt-progress {
                    border: 1px solid var(--text-normal);
                }
            }

            /* Reduced motion support */
            @media (prefers-reduced-motion: reduce) {
                .yt-spinner,
                .yt-dots-dot,
                .yt-bars-bar,
                .yt-pulse,
                .yt-skeleton,
                .yt-progress-bar.animated,
                .yt-progress-indeterminate,
                .yt-card-loading::before {
                    animation: none;
                }

                .yt-skeleton {
                    background: var(--background-secondary);
                }
            }
        `;

        StyleManager.addClass('loading-states', {
            'root': loadingCSS
        });
    }

    /**
     * Create loading element
     */
    createLoader(config: LoadingConfig): HTMLElement {
        const container = document.createElement('div');
        container.className = `yt-loading ${config.size || 'medium'}`;

        let loaderElement: HTMLElement;

        switch (config.type) {
            case 'spinner':
                loaderElement = this.createSpinner(config);
                break;
            case 'dots':
                loaderElement = this.createDots(config);
                break;
            case 'bars':
                loaderElement = this.createBars(config);
                break;
            case 'pulse':
                loaderElement = this.createPulse(config);
                break;
            case 'progress':
                loaderElement = this.createProgressBar(config);
                break;
            default:
                loaderElement = this.createSpinner(config);
        }

        container.appendChild(loaderElement);

        if (config.text) {
            const textElement = document.createElement('div');
            textElement.className = 'yt-loading-text';
            textElement.textContent = config.text;
            container.appendChild(textElement);
        }

        if (config.overlay) {
            const overlay = document.createElement('div');
            overlay.className = `yt-loading-overlay ${config.backdrop ? 'backdrop' : ''}`;
            overlay.appendChild(container);
            return overlay;
        }

        return container;
    }

    /**
     * Create spinner loader
     */
    private createSpinner(config: LoadingConfig): HTMLElement {
        const spinner = document.createElement('div');
        spinner.className = `yt-spinner ${config.speed || 'normal'}`;

        if (config.color) {
            spinner.style.borderTopColor = config.color;
        }

        return spinner;
    }

    /**
     * Create dots loader
     */
    private createDots(config: LoadingConfig): HTMLElement {
        const dots = document.createElement('div');
        dots.className = 'yt-dots';

        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'yt-dots-dot';

            if (config.color) {
                dot.style.background = config.color;
            }

            dots.appendChild(dot);
        }

        return dots;
    }

    /**
     * Create bars loader
     */
    private createBars(config: LoadingConfig): HTMLElement {
        const bars = document.createElement('div');
        bars.className = 'yt-bars';

        for (let i = 0; i < 5; i++) {
            const bar = document.createElement('div');
            bar.className = 'yt-bars-bar';

            if (config.color) {
                bar.style.background = config.color;
            }

            bars.appendChild(bar);
        }

        return bars;
    }

    /**
     * Create pulse loader
     */
    private createPulse(config: LoadingConfig): HTMLElement {
        const pulse = document.createElement('div');
        pulse.className = 'yt-pulse';

        if (config.color) {
            pulse.style.background = config.color;
        }

        return pulse;
    }

    /**
     * Create progress bar
     */
    private createProgressBar(config: LoadingConfig): HTMLElement {
        const progress = document.createElement('div');
        progress.className = `yt-progress ${config.size === 'large' ? 'large' : ''}`;

        const progressBar = document.createElement('div');
        progressBar.className = 'yt-progress-bar';

        if (config.progress !== undefined) {
            progressBar.style.width = `${config.progress}%`;
        }

        if (config.color) {
            progressBar.style.background = config.color;
        }

        progress.appendChild(progressBar);

        // Add indeterminate animation if no progress specified
        if (config.progress === undefined) {
            const indeterminate = document.createElement('div');
            indeterminate.className = 'yt-progress-indeterminate';
            progress.appendChild(indeterminate);
        } else {
            progressBar.classList.add('animated');
        }

        return progress;
    }

    /**
     * Create skeleton screen
     */
    createSkeleton(type: 'text' | 'card' | 'list' | 'avatar' | 'button' | 'image', options: any = {}): HTMLElement {
        const skeleton = document.createElement('div');
        skeleton.className = 'yt-skeleton';

        switch (type) {
            case 'text':
                return this.createTextSkeleton(options);
            case 'card':
                return this.createCardSkeleton(options);
            case 'list':
                return this.createListSkeleton(options);
            case 'avatar':
                return this.createAvatarSkeleton(options);
            case 'button':
                return this.createButtonSkeleton(options);
            case 'image':
                return this.createImageSkeleton(options);
            default:
                return this.createTextSkeleton(options);
        }
    }

    /**
     * Create text skeleton
     */
    private createTextSkeleton(options: { lines?: number; title?: boolean } = {}): HTMLElement {
        const container = document.createElement('div');
        container.className = 'yt-skeleton-paragraph';

        if (options.title) {
            const title = document.createElement('div');
            title.className = 'yt-skeleton yt-skeleton-title';
            container.appendChild(title);
        }

        const lines = options.lines || 3;
        for (let i = 0; i < lines; i++) {
            const line = document.createElement('div');
            line.className = 'yt-skeleton yt-skeleton-text';
            container.appendChild(line);
        }

        return container;
    }

    /**
     * Create card skeleton
     */
    private createCardSkeleton(options: { hasAvatar?: boolean; lines?: number } = {}): HTMLElement {
        const card = document.createElement('div');
        card.className = 'yt-skeleton yt-skeleton-card';

        // Header
        const header = document.createElement('div');
        header.className = 'yt-skeleton-card-header';

        if (options.hasAvatar) {
            const avatar = document.createElement('div');
            avatar.className = 'yt-skeleton yt-skeleton-avatar';
            header.appendChild(avatar);
        }

        const title = document.createElement('div');
        title.className = 'yt-skeleton yt-skeleton-title';
        header.appendChild(title);

        card.appendChild(header);

        // Content
        const content = document.createElement('div');
        content.className = 'yt-skeleton-card-content';
        content.appendChild(this.createTextSkeleton({ lines: options.lines || 2 }));
        card.appendChild(content);

        return card;
    }

    /**
     * Create list skeleton
     */
    private createListSkeleton(options: { items?: number; hasAvatar?: boolean } = {}): HTMLElement {
        const list = document.createElement('div');
        list.className = 'yt-skeleton-list';

        const items = options.items || 3;
        for (let i = 0; i < items; i++) {
            const item = document.createElement('div');
            item.className = 'yt-skeleton-list-item';

            if (options.hasAvatar) {
                const avatar = document.createElement('div');
                avatar.className = 'yt-skeleton yt-skeleton-avatar small';
                item.appendChild(avatar);
            }

            const text = document.createElement('div');
            text.className = 'yt-skeleton yt-skeleton-text';
            text.style.width = `${60 + Math.random() * 40}%`;
            item.appendChild(text);

            list.appendChild(item);
        }

        return list;
    }

    /**
     * Create avatar skeleton
     */
    private createAvatarSkeleton(options: { size?: 'small' | 'medium' | 'large' } = {}): HTMLElement {
        const avatar = document.createElement('div');
        avatar.className = `yt-skeleton yt-skeleton-avatar ${options.size || ''}`;
        return avatar;
    }

    /**
     * Create button skeleton
     */
    private createButtonSkeleton(): HTMLElement {
        const button = document.createElement('div');
        button.className = 'yt-skeleton yt-skeleton-button';
        return button;
    }

    /**
     * Create image skeleton
     */
    private createImageSkeleton(): HTMLElement {
        const image = document.createElement('div');
        image.className = 'yt-skeleton yt-skeleton-image';
        return image;
    }

    /**
     * Show loading state for element
     */
    showLoading(element: HTMLElement, config: LoadingConfig, id?: string): string {
        const loaderId = id || `loader_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Remove existing loader
        this.hideLoading(loaderId);

        const loader = this.createLoader(config);
        loader.setAttribute('data-loader-id', loaderId);

        if (config.overlay) {
            // Position overlay relative to element
            const rect = element.getBoundingClientRect();
            element.style.position = element.style.position || 'relative';
            element.appendChild(loader);

            // Announce to screen readers
            if (config.text) {
                a11y.announce(config.text, 'polite');
            }
        } else {
            // Replace element content with loader
            const originalContent = element.innerHTML;
            (element as any).ytOriginalContent = originalContent;
            element.innerHTML = '';
            element.appendChild(loader);
        }

        this.activeLoaders.set(loaderId, loader);
        return loaderId;
    }

    /**
     * Hide loading state
     */
    hideLoading(loaderId: string): void {
        const loader = this.activeLoaders.get(loaderId);
        if (!loader) return;

        // Restore original content if available
        const parent = loader.parentElement;
        if (parent && (parent as any).ytOriginalContent) {
            parent.innerHTML = (parent as any).ytOriginalContent;
            delete (parent as any).ytOriginalContent;
        } else {
            loader.remove();
        }

        this.activeLoaders.delete(loaderId);
    }

    /**
     * Update progress bar
     */
    updateProgress(loaderId: string, progress: number): void {
        const loader = this.activeLoaders.get(loaderId);
        if (!loader) return;

        const progressBar = loader.querySelector('.yt-progress-bar') as HTMLElement;
        if (progressBar) {
            progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;

            // Remove indeterminate animation
            const indeterminate = loader.querySelector('.yt-progress-indeterminate');
            if (indeterminate) {
                indeterminate.remove();
            }

            progressBar.classList.add('animated');
        }
    }

    /**
     * Show skeleton screen
     */
    showSkeleton(element: HTMLElement, type: 'text' | 'card' | 'list' | 'avatar' | 'button' | 'image', options: any = {}, id?: string): string {
        const skeletonId = id || `skeleton_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Remove existing skeleton
        this.hideSkeleton(skeletonId);

        const skeleton = this.createSkeleton(type, options);
        skeleton.setAttribute('data-skeleton-id', skeletonId);

        // Store original content
        (element as any).ytOriginalContent = element.innerHTML;
        element.innerHTML = '';
        element.appendChild(skeleton);

        this.skeletonScreens.set(skeletonId, skeleton);
        return skeletonId;
    }

    /**
     * Hide skeleton screen
     */
    hideSkeleton(skeletonId: string): void {
        const skeleton = this.skeletonScreens.get(skeletonId);
        if (!skeleton) return;

        const parent = skeleton.parentElement;
        if (parent && (parent as any).ytOriginalContent) {
            parent.innerHTML = (parent as any).ytOriginalContent;
            delete (parent as any).ytOriginalContent;
        }

        this.skeletonScreens.delete(skeletonId);
    }

    /**
     * Show full page loading
     */
    showPageLoading(text?: string, subtext?: string): HTMLElement {
        // Remove existing page loader
        this.hidePageLoading();

        const pageLoader = document.createElement('div');
        pageLoader.className = 'yt-loading-page';
        pageLoader.id = 'yt-page-loader';

        const icon = this.createSpinner({ type: 'spinner', size: 'large' });
        icon.className = 'yt-loading-page-icon';

        if (text) {
            const textElement = document.createElement('div');
            textElement.className = 'yt-loading-page-text';
            textElement.textContent = text;
            pageLoader.appendChild(textElement);
        }

        if (subtext) {
            const subtextElement = document.createElement('div');
            subtextElement.className = 'yt-loading-page-subtext';
            subtextElement.textContent = subtext;
            pageLoader.appendChild(subtextElement);
        }

        pageLoader.appendChild(icon);

        document.body.appendChild(pageLoader);

        // Announce to screen readers
        if (text) {
            a11y.announce(text, 'polite');
        }

        return pageLoader;
    }

    /**
     * Hide full page loading
     */
    hidePageLoading(): void {
        const pageLoader = document.getElementById('yt-page-loader');
        if (pageLoader) {
            pageLoader.remove();
        }
    }

    /**
     * Show content placeholder
     */
    showPlaceholder(element: HTMLElement, icon: string, title: string, text: string): void {
        const placeholder = document.createElement('div');
        placeholder.className = 'yt-content-placeholder';

        const iconElement = document.createElement('div');
        iconElement.className = 'yt-content-placeholder-icon';
        iconElement.textContent = icon;

        const titleElement = document.createElement('div');
        titleElement.className = 'yt-content-placeholder-title';
        titleElement.textContent = title;

        const textElement = document.createElement('div');
        textElement.className = 'yt-content-placeholder-text';
        textElement.textContent = text;

        placeholder.appendChild(iconElement);
        placeholder.appendChild(titleElement);
        placeholder.appendChild(textElement);

        // Store original content
        (element as any).ytOriginalContent = element.innerHTML;
        element.innerHTML = '';
        element.appendChild(placeholder);
    }

    /**
     * Hide content placeholder
     */
    hidePlaceholder(element: HTMLElement): void {
        if ((element as any).ytOriginalContent) {
            element.innerHTML = (element as any).ytOriginalContent;
            delete (element as any).ytOriginalContent;
        }
    }

    /**
     * Add loading state to button
     */
    setButtonLoading(button: HTMLElement, loading: boolean, text?: string): void {
        if (loading) {
            button.classList.add('yt-button-loading');
            (button as any).ytOriginalText = button.textContent;
            if (text) {
                button.textContent = text;
            }
        } else {
            button.classList.remove('yt-button-loading');
            if ((button as any).ytOriginalText) {
                button.textContent = (button as any).ytOriginalText;
                delete (button as any).ytOriginalText;
            }
        }
    }

    /**
     * Add loading state to form
     */
    setFormLoading(form: HTMLElement, loading: boolean): void {
        if (loading) {
            form.classList.add('yt-form-loading');
        } else {
            form.classList.remove('yt-form-loading');
        }
    }

    /**
     * Add loading state to card
     */
    setCardLoading(card: HTMLElement, loading: boolean): void {
        if (loading) {
            card.classList.add('yt-card-loading');
        } else {
            card.classList.remove('yt-card-loading');
        }
    }

    /**
     * Get active loaders count
     */
    getActiveLoadersCount(): number {
        return this.activeLoaders.size;
    }

    /**
     * Check if any loaders are active
     */
    hasActiveLoaders(): boolean {
        return this.activeLoaders.size > 0;
    }

    /**
     * Hide all loaders
     */
    hideAllLoaders(): void {
        this.activeLoaders.forEach((_, id) => {
            this.hideLoading(id);
        });
        this.skeletonScreens.forEach((_, id) => {
            this.hideSkeleton(id);
        });
        this.hidePageLoading();
    }

    /**
     * Cleanup loading manager
     */
    destroy(): void {
        this.hideAllLoaders();
        this.activeLoaders.clear();
        this.skeletonScreens.clear();
        this.progressBars.clear();
    }
}

// Export singleton instance
export const loadingStateManager = LoadingStateManager.getInstance();

// Export utility functions
export const loadingStates = {
    show: (element: HTMLElement, config: LoadingConfig, id?: string) =>
        loadingStateManager.showLoading(element, config, id),
    hide: (loaderId: string) => loadingStateManager.hideLoading(loaderId),
    updateProgress: (loaderId: string, progress: number) => loadingStateManager.updateProgress(loaderId, progress),
    showSkeleton: (element: HTMLElement, type: 'text' | 'card' | 'list' | 'avatar' | 'button' | 'image', options?: any, id?: string) =>
        loadingStateManager.showSkeleton(element, type, options, id),
    hideSkeleton: (skeletonId: string) => loadingStateManager.hideSkeleton(skeletonId),
    showPage: (text?: string, subtext?: string) => loadingStateManager.showPageLoading(text, subtext),
    hidePage: () => loadingStateManager.hidePageLoading(),
    showPlaceholder: (element: HTMLElement, icon: string, title: string, text: string) =>
        loadingStateManager.showPlaceholder(element, icon, title, text),
    hidePlaceholder: (element: HTMLElement) => loadingStateManager.hidePlaceholder(element),
    setButtonLoading: (button: HTMLElement, loading: boolean, text?: string) =>
        loadingStateManager.setButtonLoading(button, loading, text),
    setFormLoading: (form: HTMLElement, loading: boolean) => loadingStateManager.setFormLoading(form, loading),
    setCardLoading: (card: HTMLElement, loading: boolean) => loadingStateManager.setCardLoading(card, loading),
    create: (config: LoadingConfig) => loadingStateManager.createLoader(config),
    createSkeleton: (type: 'text' | 'card' | 'list' | 'avatar' | 'button' | 'image', options?: any) =>
        loadingStateManager.createSkeleton(type, options),
    getActiveCount: () => loadingStateManager.getActiveLoadersCount(),
    hasActive: () => loadingStateManager.hasActiveLoaders(),
    hideAll: () => loadingStateManager.hideAllLoaders()
};