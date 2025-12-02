import { performanceMonitor, performanceTrack } from '../../utils/performance-monitor';

/**
 * React-like memoization utilities for Obsidian components
 * Provides memo, useMemo, useCallback, and debouncing optimizations
 */

// Cache for memoized components
const memoCache = new WeakMap<any, {
    props: any;
    result: any;
    timestamp: number;
}>();

// Cache for memoized values
const valueCache = new Map<string, {
    value: any;
    dependencies: any[];
    timestamp: number;
}>();

// Default TTL for memoized items (5 minutes)
const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * Memoize a component to prevent unnecessary re-renders
 * Similar to React.memo
 */
export function memo<T extends (...args: any[]) => any>(
    component: T,
    areEqual?: (prevProps: any, nextProps: any) => boolean
): T {
    return ((props: any) => {
        const cacheKey = component;
        const cached = memoCache.get(cacheKey);

        // Check if we have cached result and props haven't changed
        if (cached && (Date.now() - cached.timestamp) < DEFAULT_TTL) {
            const propsEqual = areEqual
                ? areEqual(cached.props, props)
                : shallowEqual(cached.props, props);

            if (propsEqual) {
                return cached.result;
            }
        }

        // Compute new result
        const result = component(props);

        // Cache the result
        memoCache.set(cacheKey, {
            props: { ...props }, // Shallow copy to avoid mutations
            result,
            timestamp: Date.now()
        });

        return result;
    }) as T;
}

/**
 * Memoize a value with dependency tracking
 * Similar to React.useMemo
 */
export function useMemo<T>(
    factory: () => T,
    dependencies: any[],
    key?: string
): T {
    const cacheKey = key || generateKeyFromFactory(factory);
    const cached = valueCache.get(cacheKey);

    // Check if dependencies have changed
    if (cached && (Date.now() - cached.timestamp) < DEFAULT_TTL) {
        if (dependenciesEqual(cached.dependencies, dependencies)) {
            return cached.value;
        }
    }

    // Compute new value
    const value = factory();

    // Cache the value
    valueCache.set(cacheKey, {
        value,
        dependencies: [...dependencies], // Shallow copy
        timestamp: Date.now()
    });

    return value;
}

/**
 * Memoize a callback function
 * Similar to React.useCallback
 */
export function useCallback<T extends (...args: any[]) => any>(
    callback: T,
    dependencies: any[],
    key?: string
): T {
    return useMemo(() => callback, dependencies, key);
}

/**
 * Debounce a function call
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number,
    key?: string
): T {
    let timeoutId: NodeJS.Timeout | null = null;

    return ((...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            func(...args);
        }, delay);
    }) as T;
}

/**
 * Throttle a function call
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
): T {
    let lastCall = 0;

    return ((...args: Parameters<T>) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            return func(...args);
        }
    }) as T;
}

/**
 * Create a stable reference that doesn't change
 */
export function useStatic<T>(value: T): T {
    return useMemo(() => value, []);
}

/**
 * Memoize expensive computations with performance tracking
 */
export function useMemoWithTracking<T>(
    name: string,
    factory: () => T,
    dependencies: any[]
): T {
    return performanceMonitor.measureOperation(
        `useMemo-${name}`,
        () => useMemo(factory, dependencies, name),
        { operation: 'useMemo', name }
    );
}

/**
 * Virtual scrolling utility for large lists
 */
export function createVirtualList<T>(
    items: T[],
    itemHeight: number,
    containerHeight: number,
    renderItem: (item: T, index: number) => HTMLElement
): {
    container: HTMLElement;
    scrollToIndex: (index: number) => void;
    updateItems: (newItems: T[]) => void;
} {
    const container = document.createElement('div');
    container.style.height = `${containerHeight}px`;
    container.style.overflow = 'auto';

    const innerContainer = document.createElement('div');
    innerContainer.style.height = `${items.length * itemHeight}px`;
    innerContainer.style.position = 'relative';
    container.appendChild(innerContainer);

    let visibleItems: HTMLElement[] = [];
    let scrollTop = 0;

    function updateVisibleItems() {
        // Remove old items
        visibleItems.forEach(item => item.remove());
        visibleItems = [];

        // Calculate visible range
        const startIndex = Math.floor(scrollTop / itemHeight);
        const endIndex = Math.min(
            startIndex + Math.ceil(containerHeight / itemHeight) + 1,
            items.length
        );

        // Render visible items
        for (let i = startIndex; i < endIndex; i++) {
            const itemElement = renderItem(items[i], i);
            itemElement.style.position = 'absolute';
            itemElement.style.top = `${i * itemHeight}px`;
            itemElement.style.height = `${itemHeight}px`;
            innerContainer.appendChild(itemElement);
            visibleItems.push(itemElement);
        }
    }

    container.addEventListener('scroll', throttle(() => {
        scrollTop = container.scrollTop;
        updateVisibleItems();
    }, 16)); // ~60fps

    function scrollToIndex(index: number) {
        scrollTop = index * itemHeight;
        container.scrollTop = scrollTop;
        updateVisibleItems();
    }

    function updateItems(newItems: T[]) {
        items = newItems;
        innerContainer.style.height = `${items.length * itemHeight}px`;
        updateVisibleItems();
    }

    // Initial render
    updateVisibleItems();

    return {
        container,
        scrollToIndex,
        updateItems
    };
}

/**
 * Shallow equality check
 */
function shallowEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (!obj1 || !obj2) return false;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
        if (obj1[key] !== obj2[key]) return false;
    }

    return true;
}

/**
 * Check if dependencies are equal
 */
function dependenciesEqual(deps1: any[], deps2: any[]): boolean {
    if (deps1.length !== deps2.length) return false;
    return deps1.every((dep, i) => dep === deps2[i]);
}

/**
 * Generate cache key from factory function
 */
function generateKeyFromFactory(factory: Function): string {
    return factory.toString().slice(0, 100); // First 100 chars of function
}

/**
 * Clear memoization caches
 */
export function clearMemoizationCache(): void {
    memoCache.clear();
    valueCache.clear();
}

/**
 * Get cache statistics
 */
export function getMemoizationStats(): {
    componentCacheSize: number;
    valueCacheSize: number;
    oldestEntry: number | null;
} {
    let oldestTimestamp: number | null = null;

    for (const cached of valueCache.values()) {
        if (!oldestTimestamp || cached.timestamp < oldestTimestamp) {
            oldestTimestamp = cached.timestamp;
        }
    }

    return {
        componentCacheSize: memoCache.size || 0,
        valueCacheSize: valueCache.size,
        oldestEntry: oldestTimestamp
    };
}

/**
 * Performance decorator for component methods
 */
export function trackComponentPerformance(options: {
    component?: string;
    logSlowOperations?: boolean;
    threshold?: number;
} = {}) {
    return performanceTrack({
        category: 'component',
        logErrors: true,
        includeArgs: false
    });
}

/**
 * Optimized event listener that prevents memory leaks
 */
export function addOptimizedEventListener<
    K extends keyof HTMLElementEventMap
>(
    element: HTMLElement,
    event: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions
): () => void {
    element.addEventListener(event, handler, options);

    // Return cleanup function
    return () => {
        element.removeEventListener(event, handler, options);
    };
}

/**
 * Batch DOM updates to reduce layout thrashing
 */
export function batchDOMUpdates(updates: (() => void)[]): void {
    // Use requestAnimationFrame to batch updates
    requestAnimationFrame(() => {
        updates.forEach(update => update());
    });
}

/**
 * Create a ResizeObserver with automatic cleanup
 */
export function createOptimizedResizeObserver(
    callback: (entries: ResizeObserverEntry[]) => void
): {
    observer: ResizeObserver;
    observe: (element: Element) => void;
    disconnect: () => void;
} {
    const observer = new ResizeObserver(
        throttle(callback, 16) // Throttle to ~60fps
    );

    return {
        observer,
        observe: (element: Element) => observer.observe(element),
        disconnect: () => observer.disconnect()
    };
}