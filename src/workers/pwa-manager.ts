/**
 * Progressive Web App (PWA) Manager for YouTube Clipper
 * Handles service worker registration, offline support, and PWA features
 */

export interface PWAConfig {
    enableOffline: boolean;
    enableBackgroundSync: boolean;
    enablePushNotifications: boolean;
    enableInstallPrompt: boolean;
    cacheStrategy: 'cacheFirst' | 'networkFirst' | 'staleWhileRevalidate';
    version: string;
    updateInterval: number;
}

export interface InstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
}

export interface PWAStats {
    isOnline: boolean;
    serviceWorkerActive: boolean;
    cacheSize: number;
    lastUpdate: number;
    installStatus: 'unsupported' | 'promptable' | 'installed' | 'dismissed';
    backgroundSyncSupported: boolean;
}

export class PWAManager {
    private config: PWAConfig;
    private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
    private isOnline: boolean = navigator.onLine;
    private deferredPrompt: InstallPromptEvent | null = null;
    private updateCallbacks: Array<() => void> = [];
    private syncQueue: Array<{
        id: string;
        type: string;
        data: any;
        retryCount: number;
        timestamp: number;
    }> = [];
    private metrics: PWAStats;

    constructor(config: Partial<PWAConfig> = {}) {
        this.config = {
            enableOffline: true,
            enableBackgroundSync: true,
            enablePushNotifications: false,
            enableInstallPrompt: true,
            cacheStrategy: 'staleWhileRevalidate',
            version: '1.0.0',
            updateInterval: 60000, // 1 minute
            ...config
        };

        this.metrics = this.initializeMetrics();
        this.initializeEventListeners();
    }

    /**
     * Initialize PWA functionality
     */
    async initialize(): Promise<void> {
        try {
            if (this.config.enableOffline) {
                await this.registerServiceWorker();
            }

            if (this.config.enableBackgroundSync) {
                await this.setupBackgroundSync();
            }

            if (this.config.enableInstallPrompt) {
                this.setupInstallPrompt();
            }

            this.checkInstallStatus();
            console.log('[PWA Manager] Initialized successfully');

        } catch (error) {
            console.error('[PWA Manager] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Register service worker
     */
    private async registerServiceWorker(): Promise<void> {
        if (!('serviceWorker' in navigator)) {
            console.warn('[PWA Manager] Service workers not supported');
            return;
        }

        try {
            this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });

            console.log('[PWA Manager] Service worker registered:', this.serviceWorkerRegistration.scope);

            // Handle updates
            this.serviceWorkerRegistration.addEventListener('updatefound', () => {
                const installingWorker = this.serviceWorkerRegistration!.installing;
                if (installingWorker) {
                    installingWorker.addEventListener('statechange', () => {
                        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New worker available
                            this.notifyUpdateAvailable();
                        }
                    });
                }
            });

            // Handle service worker messages
            navigator.serviceWorker.addEventListener('message', (event) => {
                this.handleServiceWorkerMessage(event);
            });

            this.metrics.serviceWorkerActive = true;

        } catch (error) {
            console.error('[PWA Manager] Service worker registration failed:', error);
            this.metrics.serviceWorkerActive = false;
        }
    }

    /**
     * Setup background sync
     */
    private async setupBackgroundSync(): Promise<void> {
        if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
            console.warn('[PWA Manager] Background sync not supported');
            this.metrics.backgroundSyncSupported = false;
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            if (registration.sync) {
                this.metrics.backgroundSyncSupported = true;
                console.log('[PWA Manager] Background sync supported');
            }
        } catch (error) {
            console.warn('[PWA Manager] Background sync setup failed:', error);
            this.metrics.backgroundSyncSupported = false;
        }
    }

    /**
     * Setup install prompt
     */
    private setupInstallPrompt(): void {
        window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();
            this.deferredPrompt = event as InstallPromptEvent;
            this.metrics.installStatus = 'promptable';
            console.log('[PWA Manager] Install prompt available');
        });

        window.addEventListener('appinstalled', () => {
            this.metrics.installStatus = 'installed';
            this.deferredPrompt = null;
            console.log('[PWA Manager] App installed successfully');
        });
    }

    /**
     * Initialize event listeners
     */
    private initializeEventListeners(): void {
        // Network status
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.metrics.isOnline = true;
            this.processSyncQueue();
            console.log('[PWA Manager] Online');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.metrics.isOnline = false;
            console.log('[PWA Manager] Offline');
        });

        // Page visibility
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkForUpdates();
            }
        });
    }

    /**
     * Show install prompt
     */
    async showInstallPrompt(): Promise<boolean> {
        if (!this.deferredPrompt || !this.config.enableInstallPrompt) {
            return false;
        }

        try {
            await this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;

            this.deferredPrompt = null;
            this.metrics.installStatus = outcome === 'accepted' ? 'installed' : 'dismissed';

            console.log(`[PWA Manager] Install prompt ${outcome}`);
            return outcome === 'accepted';
        } catch (error) {
            console.error('[PWA Manager] Install prompt failed:', error);
            return false;
        }
    }

    /**
     * Check if install prompt is available
     */
    canShowInstallPrompt(): boolean {
        return this.deferredPrompt !== null && this.config.enableInstallPrompt;
    }

    /**
     * Request notification permission
     */
    async requestNotificationPermission(): Promise<NotificationPermission> {
        if (!('Notification' in window)) {
            return 'denied';
        }

        if (Notification.permission === 'granted') {
            return 'granted';
        }

        if (Notification.permission === 'denied') {
            return 'denied';
        }

        try {
            const permission = await Notification.requestPermission();
            console.log(`[PWA Manager] Notification permission: ${permission}`);
            return permission;
        } catch (error) {
            console.error('[PWA Manager] Notification request failed:', error);
            return 'denied';
        }
    }

    /**
     * Show notification
     */
    async showNotification(title: string, options?: NotificationOptions): Promise<void> {
        if (!this.config.enablePushNotifications) {
            return;
        }

        const permission = await this.requestNotificationPermission();
        if (permission !== 'granted') {
            return;
        }

        try {
            await new Promise<void>((resolve, reject) => {
                const notification = new Notification(title, {
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/badge-72x72.png',
                    tag: 'yt-clipper',
                    requireInteraction: false,
                    ...options
                });

                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };

                notification.onshow = () => resolve();
                notification.onerror = () => reject(new Error('Notification show failed'));

                // Auto-close after 5 seconds
                setTimeout(() => {
                    notification.close();
                    resolve();
                }, 5000);
            });
        } catch (error) {
            console.error('[PWA Manager] Notification failed:', error);
        }
    }

    /**
     * Add operation to sync queue
     */
    addToSyncQueue(type: string, data: any): string {
        const id = this.generateId();
        this.syncQueue.push({
            id,
            type,
            data,
            retryCount: 0,
            timestamp: Date.now()
        });

        // Try to sync immediately if online
        if (this.isOnline) {
            this.processSyncQueue();
        } else {
            // Register background sync if supported
            this.registerBackgroundSync();
        }

        return id;
    }

    /**
     * Process sync queue
     */
    private async processSyncQueue(): Promise<void> {
        if (!this.isOnline || this.syncQueue.length === 0) {
            return;
        }

        const operationsToProcess = this.syncQueue.splice(0, 5); // Process 5 at a time

        await Promise.allSettled(
            operationsToProcess.map(operation => this.processSyncOperation(operation))
        );
    }

    /**
     * Process individual sync operation
     */
    private async processSyncOperation(operation: any): Promise<void> {
        try {
            // Send to service worker for processing
            if (this.serviceWorkerRegistration?.active) {
                this.serviceWorkerRegistration.active.postMessage({
                    type: 'SYNC_OPERATION',
                    data: operation
                });
            }
        } catch (error) {
            console.error('[PWA Manager] Sync operation failed:', error);

            // Retry logic
            operation.retryCount++;
            if (operation.retryCount < 3) {
                this.syncQueue.push(operation);
            }
        }
    }

    /**
     * Register background sync
     */
    private async registerBackgroundSync(): Promise<void> {
        if (!this.metrics.backgroundSyncSupported || !this.serviceWorkerRegistration) {
            return;
        }

        try {
            await this.serviceWorkerRegistration.sync.register('background-sync');
            console.log('[PWA Manager] Background sync registered');
        } catch (error) {
            console.error('[PWA Manager] Background sync registration failed:', error);
        }
    }

    /**
     * Check for updates
     */
    async checkForUpdates(): Promise<boolean> {
        if (!this.serviceWorkerRegistration) {
            return false;
        }

        try {
            await this.serviceWorkerRegistration.update();
            console.log('[PWA Manager] Checked for updates');
            return true;
        } catch (error) {
            console.error('[PWA Manager] Update check failed:', error);
            return false;
        }
    }

    /**
     * Handle service worker messages
     */
    private handleServiceWorkerMessage(event: ExtendableMessageEvent): void {
        const { type, data } = event.data;

        switch (type) {
            case 'UPDATE_AVAILABLE':
                this.notifyUpdateAvailable();
                break;

            case 'CACHE_STATS':
                this.metrics.cacheSize = data.totalSize || 0;
                break;

            case 'SYNC_COMPLETE':
                this.handleSyncComplete(data);
                break;

            default:
                console.log('[PWA Manager] Service worker message:', type, data);
        }
    }

    /**
     * Notify about update availability
     */
    private notifyUpdateAvailable(): void {
        this.updateCallbacks.forEach(callback => callback());
        this.showNotification('Update Available', {
            body: 'A new version of YouTube Clipper is available',
            actions: [
                {
                    action: 'update',
                    title: 'Update Now'
                }
            ]
        });
    }

    /**
     * Handle sync completion
     */
    private handleSyncComplete(data: any): void {
        console.log('[PWA Manager] Sync completed:', data);
        this.metrics.lastUpdate = Date.now();
    }

    /**
     * Check install status
     */
    private checkInstallStatus(): void {
        if (!('standalone' in window.navigator)) {
            this.metrics.installStatus = 'unsupported';
            return;
        }

        if (window.navigator.standalone) {
            this.metrics.installStatus = 'installed';
        } else if (this.deferredPrompt) {
            this.metrics.installStatus = 'promptable';
        } else {
            this.metrics.installStatus = 'dismissed';
        }
    }

    /**
     * Initialize metrics
     */
    private initializeMetrics(): PWAStats {
        return {
            isOnline: navigator.onLine,
            serviceWorkerActive: false,
            cacheSize: 0,
            lastUpdate: Date.now(),
            installStatus: 'unsupported',
            backgroundSyncSupported: false
        };
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Add update callback
     */
    onUpdate(callback: () => void): void {
        this.updateCallbacks.push(callback);
    }

    /**
     * Remove update callback
     */
    removeUpdateCallback(callback: () => void): void {
        const index = this.updateCallbacks.indexOf(callback);
        if (index > -1) {
            this.updateCallbacks.splice(index, 1);
        }
    }

    /**
     * Get current metrics
     */
    async getMetrics(): Promise<PWAStats> {
        // Update cache size from service worker
        if (this.serviceWorkerRegistration?.active) {
            try {
                this.serviceWorkerRegistration.active.postMessage({
                    type: 'GET_CACHE_STATS'
                });

                // Cache size will be updated in message handler
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.warn('[PWA Manager] Failed to get cache stats:', error);
            }
        }

        return { ...this.metrics };
    }

    /**
     * Get cache statistics
     */
    async getCacheStats(): Promise<Record<string, any>> {
        if (!this.serviceWorkerRegistration?.active) {
            return {};
        }

        return new Promise((resolve) => {
            const messageChannel = new MessageChannel();

            messageChannel.port1.onmessage = (event) => {
                resolve(event.data);
            };

            this.serviceWorkerRegistration!.active!.postMessage({
                type: 'GET_CACHE_STATS'
            }, [messageChannel.port2]);
        });
    }

    /**
     * Clear all caches
     */
    async clearCaches(): Promise<void> {
        if (!this.serviceWorkerRegistration?.active) {
            return;
        }

        return new Promise((resolve) => {
            const messageChannel = new MessageChannel();

            messageChannel.port1.onmessage = () => {
                resolve();
            };

            this.serviceWorkerRegistration!.active!.postMessage({
                type: 'CLEAR_CACHE'
            }, [messageChannel.port2]);
        });
    }

    /**
     * Prefetch resources
     */
    async prefetchResources(urls: string[]): Promise<void> {
        if (!this.serviceWorkerRegistration?.active) {
            return;
        }

        this.serviceWorkerRegistration.active.postMessage({
            type: 'PREFETCH',
            data: { urls }
        });
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.updateCallbacks = [];
        this.syncQueue = [];
        this.deferredPrompt = null;

        if (this.serviceWorkerRegistration) {
            // Don't unregister service worker as it might be used by other tabs
            this.serviceWorkerRegistration = null;
        }
    }
}

// Export singleton instance
export const pwaManager = new PWAManager();