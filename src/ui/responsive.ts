import { StyleManager } from './constants/index';


/**
 * Breakpoint definitions for responsive design
 */
export const BREAKPOINTS = {
    xs: '320px',
    sm: '480px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    xxl: '1440px'
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Responsive design utilities and components
 */
export class ResponsiveManager {
    private static instance: ResponsiveManager;
    private mediaQueries: Map<string, MediaQueryList> = new Map();
    private listeners: Map<string, (() => void)[]> = new Map();
    private currentBreakpoint: Breakpoint = 'md';
    private orientation: 'portrait' | 'landscape' = 'landscape';
    private touchCapable = false;

    private constructor() {
        this.initializeMediaQueries();
        this.setupEventListeners();
        this.detectCapabilities();
        this.enhanceMobileExperience();
    }

    static getInstance(): ResponsiveManager {
        if (!ResponsiveManager.instance) {
            ResponsiveManager.instance = new ResponsiveManager();
        }
        return ResponsiveManager.instance;
    }

    /**
     * Initialize media queries for all breakpoints
     */
    private initializeMediaQueries(): void {
        Object.entries(BREAKPOINTS).forEach(([key, value]) => {
            const mediaQuery = window.matchMedia(`(min-width: ${value})`);
            this.mediaQueries.set(key, mediaQuery);
        });

        // Orientation media query
        const orientationQuery = window.matchMedia('(orientation: landscape)');
        this.mediaQueries.set('orientation', orientationQuery);

        // Touch capability
        const touchQuery = window.matchMedia('(hover: none)');
        this.mediaQueries.set('touch', touchQuery);

        // Reduced motion
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.mediaQueries.set('motion', motionQuery);

        // High contrast
        const contrastQuery = window.matchMedia('(prefers-contrast: high)');
        this.mediaQueries.set('contrast', contrastQuery);
    }

    /**
     * Setup event listeners for media query changes
     */
    private setupEventListeners(): void {
        // Listen for breakpoint changes
        Object.entries(BREAKPOINTS).forEach(([key]) => {
            const mediaQuery = this.mediaQueries.get(key);
            if (mediaQuery) {
                mediaQuery.addEventListener('change', () => {
                    this.updateCurrentBreakpoint();
                    this.notifyListeners(key);
                });
            }
        });

        // Listen for orientation changes
        const orientationQuery = this.mediaQueries.get('orientation');
        if (orientationQuery) {
            orientationQuery.addEventListener('change', () => {
                this.orientation = orientationQuery.matches ? 'landscape' : 'portrait';
                this.handleOrientationChange();
                this.notifyListeners('orientation');
            });
        }

        // Listen for capability changes
        const touchQuery = this.mediaQueries.get('touch');
        if (touchQuery) {
            touchQuery.addEventListener('change', () => {
                this.touchCapable = touchQuery.matches;
                this.updateInteractionMode();
                this.notifyListeners('touch');
            });
        }

        // Window resize handler
        window.addEventListener('resize', this.debounce(() => {
            this.handleResize();
            this.notifyListeners('resize');
        }, 250));

        // Initial breakpoint detection
        this.updateCurrentBreakpoint();
        this.orientation = this.mediaQueries.get('orientation')?.matches ? 'landscape' : 'portrait';
        this.touchCapable = this.mediaQueries.get('touch')?.matches || false;
    }

    /**
     * Detect device capabilities
     */
    private detectCapabilities(): void {
        // Detect touch capability
        this.touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // Detect device pixel ratio
        const dpr = window.devicePixelRatio || 1;
        document.documentElement.style.setProperty('--device-pixel-ratio', String(dpr));

        // Detect viewport size
        this.updateViewportMeta();

        // Detect if iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
            document.body.classList.add('yt-ios');
        }

        // Detect if Android
        const isAndroid = /Android/.test(navigator.userAgent);
        if (isAndroid) {
            document.body.classList.add('yt-android');
        }
    }

    /**
     * Update viewport meta tag for mobile
     */
    private updateViewportMeta(): void {
        let viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }

        const scale = 1 / window.devicePixelRatio;
        viewport.content = `width=device-width, initial-scale=${scale}, maximum-scale=${scale}, user-scalable=no`;
    }

    /**
     * Enhance mobile experience
     */
    private enhanceMobileExperience(): void {
        // Add responsive CSS
        this.addResponsiveStyles();

        // Add mobile optimizations
        this.addMobileOptimizations();

        // Add touch enhancements
        this.addTouchEnhancements();
    }

    /**
     * Add responsive CSS styles
     */
    private addResponsiveStyles(): void {
        const responsiveCSS = `
            /* Base responsive styles */
            .yt-responsive {
                width: 100%;
                max-width: 100%;
                box-sizing: border-box;
            }

            /* Container classes */
            .yt-container {
                width: 100%;
                margin: 0 auto;
                padding: 0 16px;
            }

            .yt-container-sm { max-width: 640px; }
            .yt-container-md { max-width: 768px; }
            .yt-container-lg { max-width: 1024px; }
            .yt-container-xl { max-width: 1280px; }
            .yt-container-xxl { max-width: 1440px; }

            /* Grid system */
            .yt-grid {
                display: grid;
                gap: 16px;
                grid-template-columns: repeat(12, 1fr);
            }

            .yt-grid-auto {
                display: grid;
                gap: 16px;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            }

            /* Flex utilities */
            .yt-flex-wrap { flex-wrap: wrap; }
            .yt-flex-nowrap { flex-wrap: nowrap; }
            .yt-flex-column { flex-direction: column; }
            .yt-flex-column-reverse { flex-direction: column-reverse; }

            /* Mobile-first responsive utilities */
            @media (max-width: 479px) {
                .yt-hidden-xs { display: none !important; }
                .yt-visible-xs { display: block !important; }
                .yt-col-xs-12 { grid-column: span 12; }
                .yt-col-xs-6 { grid-column: span 6; }
                .yt-col-xs-4 { grid-column: span 4; }
                .yt-col-xs-3 { grid-column: span 3; }
                .yt-col-xs-2 { grid-column: span 2; }
                .yt-col-xs-1 { grid-column: span 1; }

                .yt-text-xs { font-size: 12px; }
                .yt-p-xs { padding: 8px; }
                .yt-m-xs { margin: 8px; }
                .yt-g-xs { gap: 8px; }

                .yt-stack-xs > * + * { margin-top: 8px; }
            }

            @media (min-width: 480px) and (max-width: 767px) {
                .yt-hidden-sm { display: none !important; }
                .yt-visible-sm { display: block !important; }
                .yt-col-sm-12 { grid-column: span 12; }
                .yt-col-sm-6 { grid-column: span 6; }
                .yt-col-sm-4 { grid-column: span 4; }
                .yt-col-sm-3 { grid-column: span 3; }

                .yt-text-sm { font-size: 14px; }
                .yt-p-sm { padding: 12px; }
                .yt-m-sm { margin: 12px; }
                .yt-g-sm { gap: 12px; }

                .yt-stack-sm > * + * { margin-top: 12px; }
            }

            @media (min-width: 768px) and (max-width: 1023px) {
                .yt-hidden-md { display: none !important; }
                .yt-visible-md { display: block !important; }
                .yt-col-md-8 { grid-column: span 8; }
                .yt-col-md-6 { grid-column: span 6; }
                .yt-col-md-4 { grid-column: span 4; }
                .yt-col-md-3 { grid-column: span 3; }

                .yt-text-md { font-size: 16px; }
                .yt-p-md { padding: 16px; }
                .yt-m-md { margin: 16px; }
                .yt-g-md { gap: 16px; }

                .yt-stack-md > * + * { margin-top: 16px; }
            }

            @media (min-width: 1024px) and (max-width: 1279px) {
                .yt-hidden-lg { display: none !important; }
                .yt-visible-lg { display: block !important; }
                .yt-col-lg-8 { grid-column: span 8; }
                .yt-col-lg-6 { grid-column: span 6; }
                .yt-col-lg-4 { grid-column: span 4; }
                .yt-col-lg-3 { grid-column: span 3; }

                .yt-text-lg { font-size: 18px; }
                .yt-p-lg { padding: 20px; }
                .yt-m-lg { margin: 20px; }
                .yt-g-lg { gap: 20px; }

                .yt-stack-lg > * + * { margin-top: 20px; }
            }

            @media (min-width: 1280px) {
                .yt-hidden-xl { display: none !important; }
                .yt-visible-xl { display: block !important; }
                .yt-col-xl-10 { grid-column: span 10; }
                .yt-col-xl-8 { grid-column: span 8; }
                .yt-col-xl-6 { grid-column: span 6; }
                .yt-col-xl-4 { grid-column: span 4; }

                .yt-text-xl { font-size: 20px; }
                .yt-p-xl { padding: 24px; }
                .yt-m-xl { margin: 24px; }
                .yt-g-xl { gap: 24px; }

                .yt-stack-xl > * + * { margin-top: 24px; }
            }

            /* Orientation-specific styles */
            @media (orientation: portrait) {
                .yt-landscape-only { display: none !important; }
                .yt-portrait-only { display: block !important; }
            }

            @media (orientation: landscape) {
                .yt-portrait-only { display: none !important; }
                .yt-landscape-only { display: block !important; }
            }

            /* High-DPI displays */
            @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
                .yt-border-sharp {
                    border-width: 0.5px;
                }
            }

            /* Touch device optimizations */
            @media (hover: none) {
                .yt-button {
                    min-height: 44px;
                    min-width: 44px;
                }

                .yt-clickable {
                    min-height: 44px;
                    min-width: 44px;
                }

                .yt-input {
                    min-height: 44px;
                    font-size: 16px; /* Prevent zoom on iOS */
                }
            }

            /* Reduced motion */
            @media (prefers-reduced-motion: reduce) {
                .yt-transition {
                    transition: none !important;
                }

                .yt-animation {
                    animation: none !important;
                }
            }

            /* High contrast mode */
            @media (prefers-contrast: high) {
                .yt-card {
                    border: 2px solid var(--text-normal) !important;
                }

                .yt-button {
                    border: 2px solid var(--text-normal) !important;
                }
            }
        `;

        StyleManager.addClass('responsive', {
            'root': responsiveCSS
        });
    }

    /**
     * Add mobile-specific optimizations
     */
    private addMobileOptimizations(): void {
        // Optimize for mobile viewport
        const mobileCSS = `
            /* Mobile viewport optimizations */
            .workspace-split {
                overflow-x: auto;
            }

            .yt-mobile-scroll {
                -webkit-overflow-scrolling: touch;
                scroll-behavior: smooth;
            }

            /* Safe area support for notched devices */
            .yt-safe-area {
                padding: env(safe-area-inset-top) env(safe-area-inset-right)
                          env(safe-area-inset-bottom) env(safe-area-inset-left);
            }

            .yt-safe-area-top {
                padding-top: env(safe-area-inset-top);
            }

            .yt-safe-area-bottom {
                padding-bottom: env(safe-area-inset-bottom);
            }

            /* Mobile modal optimizations */
            @media (max-width: 767px) {
                .yt-modal {
                    width: 95vw !important;
                    max-width: none !important;
                    margin: 20px !important;
                    max-height: calc(100vh - 40px) !important;
                    border-radius: 16px !important;
                }

                .yt-modal-content {
                    max-height: calc(100vh - 120px) !important;
                    overflow-y: auto !important;
                    -webkit-overflow-scrolling: touch !important;
                }

                /* Full-screen mobile modals */
                .yt-modal-fullscreen {
                    width: 100vw !important;
                    height: 100vh !important;
                    max-width: none !important;
                    max-height: none !important;
                    margin: 0 !important;
                    border-radius: 0 !important;
                }
            }

            /* Mobile navigation */
            @media (max-width: 767px) {
                .yt-nav-mobile {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: var(--background-primary);
                    border-top: 1px solid var(--background-modifier-border);
                    padding: 8px 0;
                    z-index: 1000;
                    display: flex;
                    justify-content: space-around;
                }

                .yt-nav-mobile-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 8px;
                    min-width: 60px;
                    text-decoration: none;
                    color: var(--text-muted);
                }

                .yt-nav-mobile-item.active {
                    color: var(--interactive-accent);
                }

                .yt-nav-mobile-icon {
                    width: 24px;
                    height: 24px;
                    margin-bottom: 4px;
                }

                .yt-nav-mobile-label {
                    font-size: 11px;
                    line-height: 1;
                }
            }
        `;

        StyleManager.addClass('mobile-optimizations', {
            'root': mobileCSS
        });
    }

    /**
     * Add touch interaction enhancements
     */
    private addTouchEnhancements(): void {
        const touchCSS = `
            /* Touch feedback */
            .yt-touch-feedback {
                position: relative;
                overflow: hidden;
            }

            .yt-touch-feedback::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.3);
                transform: translate(-50%, -50%);
                transition: width 0.3s, height 0.3s;
                pointer-events: none;
            }

            .yt-touch-feedback.active::after {
                width: 200px;
                height: 200px;
            }

            /* Touch targets */
            .yt-touch-target {
                min-height: 44px;
                min-width: 44px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            /* Swipeable containers */
            .yt-swipeable {
                touch-action: pan-x;
                user-select: none;
            }

            .yt-swipeable-vertical {
                touch-action: pan-y;
                user-select: none;
            }

            /* Pull to refresh */
            .yt-pull-refresh {
                position: relative;
                min-height: 100vh;
            }

            .yt-pull-refresh-indicator {
                position: absolute;
                top: -60px;
                left: 50%;
                transform: translateX(-50%);
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--background-secondary);
                border-radius: 20px;
                opacity: 0;
                transition: opacity 0.3s, top 0.3s;
            }

            .yt-pull-refresh.pulling .yt-pull-refresh-indicator {
                top: 20px;
                opacity: 1;
            }
        `;

        StyleManager.addClass('touch-enhancements', {
            'root': touchCSS
        });

        // Add touch event listeners
        this.addTouchListeners();
    }

    /**
     * Add touch event listeners
     */
    private addTouchListeners(): void {
        // Touch feedback for buttons
        document.addEventListener('touchstart', (e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('yt-touch-feedback')) {
                target.classList.add('active');
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('yt-touch-feedback')) {
                setTimeout(() => {
                    target.classList.remove('active');
                }, 300);
            }
        }, { passive: true });
    }

    /**
     * Update current breakpoint
     */
    private updateCurrentBreakpoint(): void {
        let currentBreakpoint: Breakpoint = 'xs';

        Object.entries(BREAKPOINTS).reverse().forEach(([key]) => {
            const mediaQuery = this.mediaQueries.get(key);
            if (mediaQuery?.matches) {
                currentBreakpoint = key as Breakpoint;
            }
        });

        if (currentBreakpoint !== this.currentBreakpoint) {
            this.currentBreakpoint = currentBreakpoint;
            document.body.setAttribute('data-breakpoint', currentBreakpoint);
            this.handleBreakpointChange(currentBreakpoint);
        }
    }

    /**
     * Handle breakpoint change
     */
    private handleBreakpointChange(breakpoint: Breakpoint): void {
        // Update container classes
        document.body.classList.remove(`breakpoint-${this.currentBreakpoint}`);
        document.body.classList.add(`breakpoint-${breakpoint}`);

        // Handle specific breakpoint logic
        if (this.isMobile()) {
            this.enableMobileMode();
        } else {
            this.enableDesktopMode();
        }
    }

    /**
     * Handle orientation change
     */
    private handleOrientationChange(): void {
        document.body.classList.remove('orientation-landscape', 'orientation-portrait');
        document.body.classList.add(`orientation-${this.orientation}`);

        // Re-layout components that depend on orientation
        this.relayoutForOrientation();
    }

    /**
     * Handle window resize
     */
    private handleResize(): void {
        // Update viewport height for mobile browsers
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);

        // Update viewport width
        const vw = window.innerWidth * 0.01;
        document.documentElement.style.setProperty('--vw', `${vw}px`);
    }

    /**
     * Enable mobile mode
     */
    private enableMobileMode(): void {
        document.body.classList.add('yt-mobile-mode');
        document.body.classList.remove('yt-desktop-mode');

        // Add mobile navigation
        this.addMobileNavigation();

        // Optimize scroll behavior
        document.documentElement.style.scrollBehavior = 'smooth';
    }

    /**
     * Enable desktop mode
     */
    private enableDesktopMode(): void {
        document.body.classList.add('yt-desktop-mode');
        document.body.classList.remove('yt-mobile-mode');

        // Remove mobile navigation
        this.removeMobileNavigation();
    }

    /**
     * Add mobile navigation
     */
    private addMobileNavigation(): void {
        if (document.querySelector('.yt-nav-mobile')) return;

        const nav = document.createElement('nav');
        nav.className = 'yt-nav-mobile';
        nav.innerHTML = `
            <a href="#" class="yt-nav-mobile-item" data-action="process">
                <div class="yt-nav-mobile-icon">🎬</div>
                <div class="yt-nav-mobile-label">Process</div>
            </a>
            <a href="#" class="yt-nav-mobile-item" data-action="search">
                <div class="yt-nav-mobile-icon">🔍</div>
                <div class="yt-nav-mobile-label">Search</div>
            </a>
            <a href="#" class="yt-nav-mobile-item" data-action="settings">
                <div class="yt-nav-mobile-icon">⚙️</div>
                <div class="yt-nav-mobile-label">Settings</div>
            </a>
            <a href="#" class="yt-nav-mobile-item" data-action="help">
                <div class="yt-nav-mobile-icon">❓</div>
                <div class="yt-nav-mobile-label">Help</div>
            </a>
        `;

        document.body.appendChild(nav);
    }

    /**
     * Remove mobile navigation
     */
    private removeMobileNavigation(): void {
        const nav = document.querySelector('.yt-nav-mobile');
        if (nav) {
            nav.remove();
        }
    }

    /**
     * Update interaction mode based on capabilities
     */
    private updateInteractionMode(): void {
        if (this.touchCapable) {
            document.body.classList.add('yt-touch-mode');
            document.body.classList.remove('yt-mouse-mode');
        } else {
            document.body.classList.add('yt-mouse-mode');
            document.body.classList.remove('yt-touch-mode');
        }
    }

    /**
     * Relayout for orientation change
     */
    private relayoutForOrientation(): void {
        // Trigger custom event for components to handle
        const event = new CustomEvent('orientationchange', {
            detail: { orientation: this.orientation }
        });
        document.dispatchEvent(event);
    }

    /**
     * Notify listeners of media query changes
     */
    private notifyListeners(mediaQuery: string): void {
        const listeners = this.listeners.get(mediaQuery) || [];
        listeners.forEach(listener => listener());
    }

    /**
     * Add media query listener
     */
    addListener(mediaQuery: string, callback: () => void): void {
        if (!this.listeners.has(mediaQuery)) {
            this.listeners.set(mediaQuery, []);
        }
        this.listeners.get(mediaQuery)!.push(callback);
    }

    /**
     * Remove media query listener
     */
    removeListener(mediaQuery: string, callback: () => void): void {
        const listeners = this.listeners.get(mediaQuery);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Debounce function
     */
    private debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
        let timeout: NodeJS.Timeout;
        return (...args: Parameters<T>) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    /**
     * Check if current viewport is mobile
     */
    isMobile(): boolean {
        return this.currentBreakpoint === 'xs' || this.currentBreakpoint === 'sm';
    }

    /**
     * Check if current viewport is tablet
     */
    isTablet(): boolean {
        return this.currentBreakpoint === 'md';
    }

    /**
     * Check if current viewport is desktop
     */
    isDesktop(): boolean {
        return ['lg', 'xl', 'xxl'].includes(this.currentBreakpoint);
    }

    /**
     * Get current breakpoint
     */
    getCurrentBreakpoint(): Breakpoint {
        return this.currentBreakpoint;
    }

    /**
     * Get current orientation
     */
    getOrientation(): 'portrait' | 'landscape' {
        return this.orientation;
    }

    /**
     * Check if device is touch-capable
     */
    isTouchCapable(): boolean {
        return this.touchCapable;
    }

    /**
     * Check if media query matches
     */
    matchesMediaQuery(query: string): boolean {
        return window.matchMedia(query).matches;
    }

    /**
     * Get viewport dimensions
     */
    getViewportSize(): { width: number; height: number } {
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    }

    /**
     * Get safe area insets
     */
    getSafeAreaInsets(): {
        top: number;
        right: number;
        bottom: number;
        left: number;
    } {
        const style = getComputedStyle(document.documentElement);
        return {
            top: parseInt(style.getPropertyValue('env(safe-area-inset-top)') || '0'),
            right: parseInt(style.getPropertyValue('env(safe-area-inset-right)') || '0'),
            bottom: parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || '0'),
            left: parseInt(style.getPropertyValue('env(safe-area-inset-left)') || '0')
        };
    }

    /**
     * Cleanup and destroy responsive manager
     */
    destroy(): void {
        // Remove all listeners
        this.listeners.clear();

        // Remove mobile navigation
        this.removeMobileNavigation();

        // Remove media query listeners
        this.mediaQueries.forEach((mediaQuery) => {
            mediaQuery.removeEventListener?.('change', () => {});
        });
        this.mediaQueries.clear();
    }
}

// Export singleton instance
export const responsiveManager = ResponsiveManager.getInstance();

// Export utility functions
export const responsive = {
    isMobile: () => responsiveManager.isMobile(),
    isTablet: () => responsiveManager.isTablet(),
    isDesktop: () => responsiveManager.isDesktop(),
    getCurrentBreakpoint: () => responsiveManager.getCurrentBreakpoint(),
    getOrientation: () => responsiveManager.getOrientation(),
    isTouchCapable: () => responsiveManager.isTouchCapable(),
    matchesMediaQuery: (query: string) => responsiveManager.matchesMediaQuery(query),
    getViewportSize: () => responsiveManager.getViewportSize(),
    getSafeAreaInsets: () => responsiveManager.getSafeAreaInsets(),
    addListener: (mediaQuery: string, callback: () => void) => responsiveManager.addListener(mediaQuery, callback),
    removeListener: (mediaQuery: string, callback: () => void) => responsiveManager.removeListener(mediaQuery, callback)
};