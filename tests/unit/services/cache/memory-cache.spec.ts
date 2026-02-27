/**
 * Unit tests for Memory Cache Service (LRU)
 */

import { MemoryCacheService } from '../../../../src/services/cache/memory-cache';

describe('MemoryCacheService', () => {
    let cache: MemoryCacheService;

    beforeEach(() => {
        cache = new MemoryCacheService({
            maxSize: 5,
            defaultTTL: 1000, // 1 second for faster testing
            cleanupInterval: 0, // Disable auto cleanup for tests
        });
    });

    afterEach(() => {
        cache.destroy();
    });

    describe('basic operations', () => {
        it('should set and get a value', () => {
            cache.set('key1', 'value1');
            expect(cache.get('key1')).toBe('value1');
        });

        it('should return null for missing key', () => {
            expect(cache.get('nonexistent')).toBeNull();
        });

        it('should delete a value', () => {
            cache.set('key1', 'value1');
            expect(cache.delete('key1')).toBe(true);
            expect(cache.get('key1')).toBeNull();
        });

        it('should return false when deleting non-existent key', () => {
            expect(cache.delete('nonexistent')).toBe(false);
        });

        it('should clear all values', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.clear();
            expect(cache.get('key1')).toBeNull();
            expect(cache.get('key2')).toBeNull();
        });
    });

    describe('TTL expiration', () => {
        it('should expire value after TTL', async () => {
            cache.set('key1', 'value1', 100); // 100ms TTL

            expect(cache.get('key1')).toBe('value1');

            await new Promise(resolve => setTimeout(resolve, 150));

            expect(cache.get('key1')).toBeNull();
        });

        it('should use default TTL when not specified', async () => {
            cache.set('key1', 'value1'); // Uses default 1000ms

            expect(cache.get('key1')).toBe('value1');

            await new Promise(resolve => setTimeout(resolve, 1100));

            expect(cache.get('key1')).toBeNull();
        });

        it('should update expiration on set', async () => {
            cache.set('key1', 'value1', 100);
            await new Promise(resolve => setTimeout(resolve, 50));
            cache.set('key1', 'value2', 200); // Reset TTL

            await new Promise(resolve => setTimeout(resolve, 100));

            // Should still exist after original TTL
            expect(cache.get('key1')).toBe('value2');
        });
    });

    describe('LRU eviction', () => {
        it('should evict least recently used when at capacity', () => {
            // Fill cache to capacity
            for (let i = 0; i < 5; i++) {
                cache.set(`key${i}`, `value${i}`);
            }

            // Access key0 to make it recently used
            cache.get('key0');

            // Add new item, should evict key1 (oldest unused)
            cache.set('key6', 'value6');

            expect(cache.get('key0')).toBe('value0'); // Still exists (recently accessed)
            expect(cache.get('key1')).toBeNull(); // Evicted
            expect(cache.get('key6')).toBe('value6'); // New item
        });

        it('should track access order correctly', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');
            cache.set('key4', 'value4');
            cache.set('key5', 'value5');

            // Access in different order
            cache.get('key1');
            cache.get('key3');
            cache.get('key5');

            // Add new item
            cache.set('key6', 'value6');

            // key2 should be evicted (least recently used)
            expect(cache.get('key2')).toBeNull();
            expect(cache.get('key1')).toBe('value1');
            expect(cache.get('key3')).toBe('value3');
            expect(cache.get('key5')).toBe('value5');
        });

        it('should update access order on get', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');
            cache.set('key4', 'value4');
            cache.set('key5', 'value5');

            // Access key1 to make it recently used
            cache.get('key1');

            // Add two new items
            cache.set('key6', 'value6');
            cache.set('key7', 'value7');

            // key2 and key3 should be evicted
            expect(cache.get('key2')).toBeNull();
            expect(cache.get('key3')).toBeNull();
            expect(cache.get('key1')).toBe('value1');
        });
    });

    describe('metrics tracking', () => {
        it('should track hits', () => {
            cache.set('key1', 'value1');
            cache.get('key1');
            cache.get('key1');

            const metrics = cache.getMetrics();
            expect(metrics.hits).toBe(2);
        });

        it('should track misses', () => {
            cache.get('nonexistent');
            cache.get('another');

            const metrics = cache.getMetrics();
            expect(metrics.misses).toBe(2);
        });

        it('should track evictions', () => {
            // Fill cache
            for (let i = 0; i < 10; i++) {
                cache.set(`key${i}`, `value${i}`);
            }

            const metrics = cache.getMetrics();
            expect(metrics.evictions).toBe(5); // 10 items - 5 capacity
        });

        it('should calculate hit rate', () => {
            cache.set('key1', 'value1');
            cache.get('key1'); // hit
            cache.get('key1'); // hit
            cache.get('missing'); // miss

            const metrics = cache.getMetrics();
            expect(metrics.hitRate).toBeCloseTo(0.667, 2);
        });

        it('should track size', () => {
            expect(cache.getMetrics().size).toBe(0);

            cache.set('key1', 'value1');
            expect(cache.getMetrics().size).toBe(1);

            cache.set('key2', 'value2');
            expect(cache.getMetrics().size).toBe(2);

            cache.delete('key1');
            expect(cache.getMetrics().size).toBe(1);
        });
    });

    describe('getStats', () => {
        it('should return extended statistics', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');

            const stats = cache.getStats();

            expect(stats.itemCount).toBe(2);
            expect(stats.metrics).toBeDefined();
        });
    });

    describe('type handling', () => {
        it('should handle object values', () => {
            const obj = { name: 'test', count: 42 };
            cache.set('obj', obj);

            expect(cache.get('obj')).toEqual(obj);
        });

        it('should handle array values', () => {
            const arr = [1, 2, 3, 4, 5];
            cache.set('arr', arr);

            expect(cache.get('arr')).toEqual(arr);
        });

        it('should handle null values', () => {
            cache.set('null', null);

            expect(cache.get('null')).toBeNull();
        });

        it('should handle numeric values', () => {
            cache.set('num', 42);

            expect(cache.get('num')).toBe(42);
        });
    });

    describe('edge cases', () => {
        it('should handle setting same key multiple times', () => {
            cache.set('key1', 'value1');
            cache.set('key1', 'value2');
            cache.set('key1', 'value3');

            expect(cache.get('key1')).toBe('value3');
            expect(cache.getMetrics().size).toBe(1);
        });

        it('should handle empty string key', () => {
            cache.set('', 'empty-key-value');
            expect(cache.get('')).toBe('empty-key-value');
        });

        it('should handle special characters in key', () => {
            cache.set('key:with:special:chars', 'value');
            expect(cache.get('key:with:special:chars')).toBe('value');
        });
    });
});
