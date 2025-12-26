/**
 * Array utility functions
 */

/**
 * Check if array is empty
 */
export function isEmpty<T>(arr: T[] | undefined | null): boolean {
    return !arr || arr.length === 0;
}

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

/**
 * Remove duplicates from array
 */
export function unique<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
}

/**
 * Group array by key
 */
export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
    return arr.reduce((result, item) => {
        const group = String(item[key]);
        (result[group] = result[group] || []).push(item);
        return result;
    }, {} as Record<string, T[]>);
}

/**
 * Flatten nested array
 */
export function flatten<T>(arr: T[][]): T[] {
    return arr.flat();
}

/**
 * Shuffle array
 */
export function shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
