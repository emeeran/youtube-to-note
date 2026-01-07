/**
 * Progress indicator with ETA calculation
 */

export interface ProgressState {
    current: number;
    total: number;
    startTime: number;
    eta?: number;
}

export class ProgressTracker {
    private state: Map<string, ProgressState> = new Map();
    private listeners: Set<(id: string, state: ProgressState) => void> = new Set();

    start(id: string, total: number): void {
        const newState: ProgressState = {
            current: 0,
            total,
            startTime: Date.now(),
        };
        this.state.set(id, newState);
        this.notify(id, newState);
    }

    update(id: string, current: number): void {
        const state = this.state.get(id);
        if (state) {
            state.current = current;
            state.eta = this.calculateETA(state);
            this.notify(id, state);
        }
    }

    increment(id: string, amount: number = 1): void {
        const state = this.state.get(id);
        if (state) {
            this.update(id, state.current + amount);
        }
    }

    complete(id: string): void {
        const state = this.state.get(id);
        if (state) {
            this.update(id, state.total);
        }
    }

    getState(id: string): ProgressState | undefined {
        return this.state.get(id);
    }

    getProgress(id: string): number {
        const state = this.state.get(id);
        if (!state) return 0;
        return Math.min(100, (state.current / state.total) * 100);
    }

    private calculateETA(state: ProgressState): number {
        const elapsed = Date.now() - state.startTime;
        const rate = state.current / elapsed;
        if (rate === 0) return 0;
        const remaining = state.total - state.current;
        return remaining / rate;
    }

    subscribe(listener: (id: string, state: ProgressState) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(id: string, state: ProgressState): void {
        this.listeners.forEach(listener => listener(id, state));
    }

    remove(id: string): void {
        this.state.delete(id);
    }

    clear(): void {
        this.state.clear();
    }
}

export const progressTracker = new ProgressTracker();

/**
 * Format ETA to human readable time
 */
export function formatETA(ms: number): string {
    if (ms === 0) return 'Calculating...';
    if (ms === Infinity) return 'Unknown';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `~${hours}h ${minutes % 60}m remaining`;
    } else if (minutes > 0) {
        return `~${minutes}m ${seconds % 60}s remaining`;
    } else {
        return `~${seconds}s remaining`;
    }
}
