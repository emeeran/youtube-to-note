/**
 * Service Worker for YouTube Clipper Plugin
 * Provides offline capability, asset caching, and performance optimization
 */

// Cache versioning for cache invalidation
const CACHE_VERSION = '1.0.0';
const CACHE_PREFIX = 'yt-clipper-';

// Cache names for different types of resources
const CACHE_NAMES = {
    RUNTIME: `${CACHE_PREFIX}runtime-${CACHE_VERSION}`,
    STATIC: `${CACHE_PREFIX}static-${CACHE_VERSION}`,
    API: `${CACHE_PREFIX}api-${CACHE_VERSION}`,
    IMAGES: `${CACHE_PREFIX}images-${CACHE_VERSION}`,
    MODELS: `${CACHE_PREFIX}models-${CACHE_VERSION}`
};

// Resource patterns for caching
const CACHE_PATTERNS = {
    STATIC: [
        /\.(js|css|woff2?|ttf|eot)$/,
        /\/assets\//,
        /\/icons\//
    ],
    API: [
        /youtube\.com\/oembed/,
        /generativelanguage\.googleapis\.com/,
        /api\.groq\.com/,
        /localhost:11434/
    ],
    IMAGES: [
        /\.(jpg|jpeg|png|gif|webp|svg)$/,
        /ytimg\.com/,
        /i\.ytimg\.com/
    ],
    MODELS: [
        /\/api\/models/,
        /\/models\//
    ]
};

// Time-to-live for different cache types (in milliseconds)
const CACHE_TTL = {
    RUNTIME: 24 * 60 * 60 * 1000,    // 24 hours
    STATIC: 7 * 24 * 60 * 60 * 1000,   // 7 days
    API: 30 * 60 * 1000,               // 30 minutes
    IMAGES: 24 * 60 * 60 * 1000,       // 24 hours
    MODELS: 2 * 60 * 60 * 1000         // 2 hours
};

interface CacheEntry {
    url: string;
    timestamp: number;
    ttl: number;
    size: number;
    response: Response;
    headers: Record<string, string>;
}

interface ServiceWorkerMetrics {
    cacheHits: number;
    cacheMisses: number;
    networkRequests: number;
    backgroundSyncs: number;
    errors: number;
    cacheSize: Record<string, number>;
}

/**
 * Main service worker event handlers
 */
self.addEventListener('install', (event) => {
    console.log('[YT Clipper SW] Installing service worker...');

    event.waitUntil(
        caches.open(CACHE_NAMES.RUNTIME)
            .then((cache) => cache.addAll(getRuntimeAssets()))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    console.log('[YT Clipper SW] Activating service worker...');

    event.waitUntil(
        Promise.all([
            // Clean up old caches
            cleanupOldCaches(),
            // Take control of all pages
            self.clients.claim()
        ])
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension requests
    if (request.url.startsWith('chrome-extension://')) {
        return;
    }

    event.respondWith(
        handleRequest(request)
            .catch((error) => {
                console.error('[YT Clipper SW] Request handling failed:', error);
                return new Response('Service worker error', { status: 500 });
            })
    );
});

self.addEventListener('message', (event) => {
    handleMessage(event);
});

self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        event.waitUntil(handleBackgroundSync());
    }
});

/**
 * Handle incoming requests with intelligent caching
 */
async function handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
        // Check if this is a cacheable request
        if (isCacheableRequest(request)) {
            return await handleCacheableRequest(request);
        }

        // Handle API requests with special caching
        if (isApiRequest(request)) {
            return await handleApiRequest(request);
        }

        // Handle image requests
        if (isImageRequest(request)) {
            return await handleImageRequest(request);
        }

        // Default network-first strategy
        return await networkFirst(request);

    } catch (error) {
        console.error(`[YT Clipper SW] Error handling ${request.url}:`, error);

        // Fallback to cache if available
        return await getFromCache(request) || new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

/**
 * Handle cacheable requests with cache-first strategy
 */
async function handleCacheableRequest(request: Request): Promise<Response> {
    const cache = await caches.open(CACHE_NAMES.STATIC);

    // Try cache first
    const cachedResponse = await cache.match(request);
    if (cachedResponse && !isExpired(cachedResponse)) {
        updateMetrics('cacheHits');
        return cachedResponse;
    }

    // Fetch from network
    updateMetrics('networkRequests');
    const response = await fetch(request);

    if (response.ok) {
        // Cache successful response
        const responseClone = response.clone();
        await cache.put(request, addCacheHeaders(responseClone));
    }

    updateMetrics('cacheMisses');
    return response;
}

/**
 * Handle API requests with network-first strategy and intelligent caching
 */
async function handleApiRequest(request: Request): Promise<Response> {
    const cache = await caches.open(CACHE_NAMES.API);
    const cacheKey = generateCacheKey(request);

    // Try cache first for offline support
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse && !isExpired(cachedResponse)) {
        // Also fetch in background to refresh
        refreshInBackground(request, cacheKey);
        updateMetrics('cacheHits');
        return cachedResponse;
    }

    // Network request
    updateMetrics('networkRequests');
    try {
        const response = await fetch(request);

        if (response.ok) {
            const responseClone = response.clone();
            await cache.put(cacheKey, addApiCacheHeaders(responseClone));
        }

        updateMetrics('cacheMisses');
        return response;

    } catch (error) {
        // Return cached response if available
        if (cachedResponse) {
            updateMetrics('cacheHits');
            return cachedResponse;
        }

        throw error;
    }
}

/**
 * Handle image requests with cache-first strategy and optimization
 */
async function handleImageRequest(request: Request): Promise<Response> {
    const cache = await caches.open(CACHE_NAMES.IMAGES);
    const optimizedRequest = optimizeImageRequest(request);

    // Try cache first
    const cachedResponse = await cache.match(optimizedRequest);
    if (cachedResponse && !isExpired(cachedResponse)) {
        updateMetrics('cacheHits');
        return cachedResponse;
    }

    // Fetch and potentially optimize
    updateMetrics('networkRequests');
    try {
        const response = await fetch(optimizedRequest);

        if (response.ok) {
            const optimizedResponse = await optimizeImageResponse(response);
            await cache.put(optimizedRequest, addImageCacheHeaders(optimizedResponse));
            return optimizedResponse;
        }

        updateMetrics('cacheMisses');
        return response;

    } catch (error) {
        // Try original request if optimized failed
        try {
            const response = await fetch(request);
            if (response.ok) {
                const responseClone = response.clone();
                await cache.put(request, addImageCacheHeaders(responseClone));
            }
            return response;
        } catch {
            // Return cached response if available
            const fallbackResponse = await cache.match(request);
            return fallbackResponse || new Response('Image unavailable', { status: 404 });
        }
    }
}

/**
 * Network-first strategy with cache fallback
 */
async function networkFirst(request: Request): Promise<Response> {
    try {
        updateMetrics('networkRequests');
        const response = await fetch(request);

        // Cache successful responses
        if (response.ok && isCacheableResponse(response)) {
            const cache = await caches.open(getCacheType(request));
            const responseClone = response.clone();
            await cache.put(request, responseClone);
        }

        return response;

    } catch (error) {
        // Fallback to cache
        const cachedResponse = await getFromCache(request);
        if (cachedResponse) {
            updateMetrics('cacheHits');
            return cachedResponse;
        }

        throw error;
    }
}

/**
 * Cache-first strategy with network fallback
 */
async function cacheFirst(request: Request): Promise<Response> {
    const cachedResponse = await getFromCache(request);
    if (cachedResponse && !isExpired(cachedResponse)) {
        updateMetrics('cacheHits');
        return cachedResponse;
    }

    try {
        updateMetrics('networkRequests');
        const response = await fetch(request);

        if (response.ok) {
            const cache = await caches.open(getCacheType(request));
            await cache.put(request, response.clone());
        }

        updateMetrics('cacheMisses');
        return response;

    } catch (error) {
        // Return cached response even if expired
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}

/**
 * Stale-while-revalidate strategy
 */
async function staleWhileRevalidate(request: Request): Promise<Response> {
    const cache = await caches.open(getCacheType(request));
    const cachedResponse = await cache.match(request);

    // Always try to fetch from network in background
    const networkFetch = fetch(request).then(async (response) => {
        if (response.ok) {
            await cache.put(request, response.clone());
        }
        return response;
    });

    // Return cached response immediately if available
    if (cachedResponse) {
        updateMetrics('cacheHits');
        // Don't wait for network, return cached immediately
        networkFetch.catch(() => {}); // Prevent unhandled promise rejection
        return cachedResponse;
    }

    // Wait for network if no cache
    updateMetrics('cacheMisses');
    return networkFetch;
}

/**
 * Determine if a request should be cached
 */
function isCacheableRequest(request: Request): boolean {
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return false;

    // Skip chrome-extension and dev server requests
    if (url.protocol === 'chrome-extension:' || url.hostname === 'localhost') {
        return false;
    }

    // Check static resource patterns
    return CACHE_PATTERNS.STATIC.some(pattern => pattern.test(url.pathname)) ||
           CACHE_PATTERNS.IMAGES.some(pattern => pattern.test(url.href));
}

/**
 * Determine if request is API request
 */
function isApiRequest(request: Request): boolean {
    const url = new URL(request.url);

    return CACHE_PATTERNS.API.some(pattern => pattern.test(url.href)) ||
           url.searchParams.has('api');
}

/**
 * Determine if request is for an image
 */
function isImageRequest(request: Request): boolean {
    const url = new URL(request.url);

    return CACHE_PATTERNS.IMAGES.some(pattern => pattern.test(url.href)) ||
           request.headers.get('Accept')?.includes('image/');
}

/**
 * Determine cache type based on request
 */
function getCacheType(request: Request): string {
    if (isApiRequest(request)) return CACHE_NAMES.API;
    if (isImageRequest(request)) return CACHE_NAMES.IMAGES;
    return CACHE_NAMES.STATIC;
}

/**
 * Generate cache key for API requests
 */
function generateCacheKey(request: Request): Request {
    const url = new URL(request.url);

    // Create a cache key that includes relevant parameters
    const cacheUrl = new URL(url);

    // Remove cache-busting parameters
    cacheUrl.searchParams.delete('_');
    cacheUrl.searchParams.delete('t');
    cacheUrl.searchParams.delete('v');

    return new Request(cacheUrl.toString(), {
        method: request.method,
        headers: request.headers,
        credentials: request.credentials
    });
}

/**
 * Optimize image request for better performance
 */
function optimizeImageRequest(request: Request): Request {
    const url = new URL(request.url);

    // Add optimization parameters
    url.searchParams.set('format', 'webp');
    url.searchParams.set('quality', '80');

    // Request optimized size if not specified
    if (!url.searchParams.has('width') && !url.searchParams.has('height')) {
        url.searchParams.set('width', '800');
    }

    return new Request(url.toString(), {
        method: request.method,
        headers: request.headers,
        credentials: request.credentials
    });
}

/**
 * Optimize image response
 */
async function optimizeImageResponse(response: Response): Promise<Response> {
    // This would involve image processing
    // For now, just return the original response
    // In a real implementation, you could use WebP conversion, resizing, etc.
    return response;
}

/**
 * Add cache headers to response
 */
function addCacheHeaders(response: Response): Response {
    const headers = new Headers(response.headers);

    headers.set('X-Cache', 'HIT');
    headers.set('X-Cache-Date', new Date().toISOString());
    headers.set('Cache-Control', 'public, max-age=3600');

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}

/**
 * Add API-specific cache headers
 */
function addApiCacheHeaders(response: Response): Response {
    const headers = new Headers(response.headers);

    headers.set('X-Cache', 'API-HIT');
    headers.set('X-Cache-Date', new Date().toISOString());
    headers.set('Cache-Control', 'public, max-age=1800'); // 30 minutes

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}

/**
 * Add image-specific cache headers
 */
function addImageCacheHeaders(response: Response): Response {
    const headers = new Headers(response.headers);

    headers.set('X-Cache', 'IMAGE-HIT');
    headers.set('X-Cache-Date', new Date().toISOString());
    headers.set('Cache-Control', 'public, max-age=86400'); // 24 hours

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}

/**
 * Check if cached response is expired
 */
function isExpired(response: Response): boolean {
    const cacheDate = response.headers.get('X-Cache-Date');
    if (!cacheDate) return true;

    const age = Date.now() - new Date(cacheDate).getTime();
    const maxAge = parseInt(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1] || '0');

    return age > maxAge * 1000;
}

/**
 * Check if response should be cached
 */
function isCacheableResponse(response: Response): boolean {
    const contentType = response.headers.get('content-type') || '';

    // Don't cache error responses
    if (!response.ok) return false;

    // Don't cache streaming responses
    if (response.body && response.headers.get('content-type')?.includes('stream')) {
        return false;
    }

    // Cache common content types
    const cacheableTypes = [
        'text/',
        'application/javascript',
        'application/json',
        'image/',
        'font/',
        'audio/',
        'video/'
    ];

    return cacheableTypes.some(type => contentType.startsWith(type));
}

/**
 * Get response from cache
 */
async function getFromCache(request: Request): Promise<Response | null> {
    const cache = await caches.open(getCacheType(request));
    return await cache.match(request);
}

/**
 * Refresh cache in background
 */
async function refreshInBackground(request: Request, cacheKey: Request): Promise<void> {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAMES.API);
            await cache.put(cacheKey, addApiCacheHeaders(response));
        }
    } catch (error) {
        console.warn('[YT Clipper SW] Background refresh failed:', error);
    }
}

/**
 * Clean up old caches
 */
async function cleanupOldCaches(): Promise<void> {
    const cacheNames = await caches.keys();
    const currentCaches = Object.values(CACHE_NAMES);

    await Promise.all(
        cacheNames
            .filter(name => !currentCaches.includes(name))
            .map(name => caches.delete(name))
    );
}

/**
 * Get runtime assets to cache
 */
function getRuntimeAssets(): string[] {
    return [
        // Core assets would be listed here
        // In a real implementation, this would come from the build process
    ];
}

/**
 * Handle background sync
 */
async function handleBackgroundSync(): Promise<void> {
    updateMetrics('backgroundSyncs');

    // Sync any pending operations
    try {
        const pendingOperations = await getPendingOperations();

        for (const operation of pendingOperations) {
            try {
                await processOperation(operation);
                await removePendingOperation(operation.id);
            } catch (error) {
                console.warn('[YT Clipper SW] Operation failed:', error);
            }
        }
    } catch (error) {
        console.error('[YT Clipper SW] Background sync failed:', error);
    }
}

/**
 * Handle messages from clients
 */
function handleMessage(event: ExtendableMessageEvent): void {
    const { type, data } = event.data;

    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;

        case 'GET_CACHE_STATS':
            event.ports[0].postMessage(getCacheStats());
            break;

        case 'CLEAR_CACHE':
            clearAllCaches().then(() => {
                event.ports[0].postMessage({ success: true });
            });
            break;

        case 'PREFETCH':
            prefetchResources(data.urls);
            break;

        default:
            console.warn('[YT Clipper SW] Unknown message type:', type);
    }
}

/**
 * Update service worker metrics
 */
function updateMetrics(type: keyof ServiceWorkerMetrics): void {
    // In a real implementation, this would update a metrics store
    console.log(`[YT Clipper SW] Metric: ${type}`);
}

/**
 * Get cache statistics
 */
async function getCacheStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    for (const [name, cacheName] of Object.entries(CACHE_NAMES)) {
        try {
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();
            stats[name] = {
                count: keys.length,
                urls: keys.map(key => key.url).slice(0, 10) // First 10 URLs
            };
        } catch (error) {
            stats[name] = { error: error.message };
        }
    }

    return stats;
}

/**
 * Clear all caches
 */
async function clearAllCaches(): Promise<void> {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
}

/**
 * Prefetch resources
 */
async function prefetchResources(urls: string[]): Promise<void> {
    const cache = await caches.open(CACHE_NAMES.STATIC);

    await Promise.all(
        urls.map(async (url) => {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    await cache.put(url, response);
                }
            } catch (error) {
                console.warn(`[YT Clipper SW] Failed to prefetch ${url}:`, error);
            }
        })
    );
}

/**
 * Get pending operations for background sync
 */
async function getPendingOperations(): Promise<any[]> {
    // In a real implementation, this would get pending operations from IndexedDB
    return [];
}

/**
 * Process a pending operation
 */
async function processOperation(operation: any): Promise<void> {
    // In a real implementation, this would process the operation
    console.log('[YT Clipper SW] Processing operation:', operation);
}

/**
 * Remove pending operation
 */
async function removePendingOperation(id: string): Promise<void> {
    // In a real implementation, this would remove from IndexedDB
    console.log('[YT Clipper SW] Removed operation:', id);
}

// Export for type checking
declare const self: ServiceWorkerScope;

interface ServiceWorkerScope extends ServiceWorker {
    skipWaiting(): void;
    clients: Clients;
}

export { CACHE_VERSION, CACHE_NAMES };