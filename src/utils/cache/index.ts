/**
 * Multi-level cache implementation with LRU eviction
 */

interface CacheEntry<T> {
    value: T;
    timestamp: number;
    accessCount: number;
}

interface LRUNode<K, V> {
    key: K;
    value: V;
    prev?: LRUNode<K, V>;
    next?: LRUNode<K, V>;
}

/**
 * LRU Cache implementation
 */
export class LRUCache<K, V> {
    private capacity: number;
    private cache: Map<K, LRUNode<K, V>> = new Map();
    private head?: LRUNode<K, V>;
    private tail?: LRUNode<K, V>;

    constructor(capacity: number = 100) {
        this.capacity = capacity;
    }

    get(key: K): V | undefined {
        const node = this.cache.get(key);
        if (!node) return undefined;

        // Move to head (most recently used)
        this.moveToHead(node);
        return node.value;
    }

    set(key: K, value: V): void {
        const existing = this.cache.get(key);

        if (existing) {
            existing.value = value;
            this.moveToHead(existing);
        } else {
            const node: LRUNode<K, V> = { key, value };
            this.cache.set(key, node);
            this.addToHead(node);

            if (this.cache.size > this.capacity) {
                this.removeTail();
            }
        }
    }

    has(key: K): boolean {
        return this.cache.has(key);
    }

    delete(key: K): boolean {
        const node = this.cache.get(key);
        if (node) {
            this.removeNode(node);
            this.cache.delete(key);
            return true;
        }
        return false;
    }

    clear(): void {
        this.cache.clear();
        this.head = undefined;
        this.tail = undefined;
    }

    size(): number {
        return this.cache.size;
    }

    private moveToHead(node: LRUNode<K, V>): void {
        this.removeNode(node);
        this.addToHead(node);
    }

    private addToHead(node: LRUNode<K, V>): void {
        node.prev = undefined;
        node.next = this.head;

        if (this.head) {
            this.head.prev = node;
        }

        this.head = node;

        if (!this.tail) {
            this.tail = node;
        }
    }

    private removeNode(node: LRUNode<K, V>): void {
        if (node.prev) {
            node.prev.next = node.next;
        } else {
            this.head = node.next;
        }

        if (node.next) {
            node.next.prev = node.prev;
        } else {
            this.tail = node.prev;
        }
    }

    private removeTail(): void {
        if (this.tail) {
            this.cache.delete(this.tail.key);
            this.removeNode(this.tail);
        }
    }
}

/**
 * Multi-level cache manager
 */
export class MultiLevelCache<K, V> {
    private l1Cache: LRUCache<K, CacheEntry<V>>; // In-memory cache
    private l2Cache?: Map<K, CacheEntry<V>>;     // Persistent cache
    private l1TTL: number;
    private l2TTL: number;

    constructor(
        l1Capacity: number = 100,
        l1TTL: number = 5 * 60 * 1000,    // 5 minutes
        l2TTL: number = 24 * 60 * 60 * 1000, // 24 hours
        l2Cache?: Map<K, CacheEntry<V>>
    ) {
        this.l1Cache = new LRUCache(l1Capacity);
        this.l2Cache = l2Cache;
        this.l1TTL = l1TTL;
        this.l2TTL = l2TTL;
    }

    get(key: K): V | undefined {
        const now = Date.now();

        // Check L1 cache
        const l1Entry = this.l1Cache.get(key);
        if (l1Entry && now - l1Entry.timestamp < this.l1TTL) {
            l1Entry.accessCount++;
            return l1Entry.value;
        }

        // Check L2 cache
        if (this.l2Cache) {
            const l2Entry = this.l2Cache.get(key);
            if (l2Entry && now - l2Entry.timestamp < this.l2TTL) {
                // Promote to L1
                this.l1Cache.set(key, l2Entry);
                return l2Entry.value;
            }
        }

        return undefined;
    }

    set(key: K, value: V): void {
        const entry: CacheEntry<V> = {
            value,
            timestamp: Date.now(),
            accessCount: 1,
        };

        // Set in L1
        this.l1Cache.set(key, entry);

        // Set in L2 if available
        if (this.l2Cache) {
            this.l2Cache.set(key, entry);
        }
    }

    has(key: K): boolean {
        return this.get(key) !== undefined;
    }

    delete(key: K): void {
        this.l1Cache.delete(key);
        this.l2Cache?.delete(key);
    }

    clear(): void {
        this.l1Cache.clear();
        this.l2Cache?.clear();
    }

    /**
     * Warm the cache with frequently accessed data
     */
    async warm(entries: Map<K, V>): Promise<void> {
        for (const [key, value] of entries) {
            this.set(key, value);
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            l1Size: this.l1Cache.size(),
            l2Size: this.l2Cache?.size || 0,
            l1Capacity: (this.l1Cache as any).capacity,
        };
    }
}
