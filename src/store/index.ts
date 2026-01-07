/**
 * Lightweight State Management
 * Simple Redux-like store for managing application state
 */

import { logger } from '../services/logger';

type Listener = () => void;

export interface Action<T = unknown> {
    type: string;
    payload?: T;
}

export type Reducer<S> = (state: S, action: Action<unknown>) => S;

export class Store<S> {
    private state: S;
    private reducer: Reducer<S>;
    private listeners: Set<Listener> = new Set();
    private middleware: Array<
        (store: Store<S>) => (next: (action: Action<unknown>) => void) => (action: Action<unknown>) => void
    > = [];

    constructor(initialState: S, reducer: Reducer<S>) {
        this.state = initialState;
        this.reducer = reducer;
    }

    getState(): S {
        return this.state;
    }

    dispatch(action: Action<unknown>): void {
        // Apply middleware
        let finalDispatch = (action: Action<unknown>) => {
            this.state = this.reducer(this.state, action);
            this.notify();
        };

        for (const mw of this.middleware) {
            const tempDispatch = finalDispatch;
            finalDispatch = mw(this)(tempDispatch);
        }

        finalDispatch(action);
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        this.listeners.forEach(listener => listener());
    }

    use(
        middleware: (
            store: Store<S>
        ) => (next: (action: Action<unknown>) => void) => (action: Action<unknown>) => void
    ): void {
        this.middleware.push(middleware);
    }
}

/**
 * Create a store with initial state and reducer
 */
export function createStore<S>(initialState: S, reducer: Reducer<S>): Store<S> {
    return new Store(initialState, reducer);
}

/**
 * Logger middleware
 */
export function loggerMiddleware(store: Store<unknown>) {
    return (next: (action: Action<unknown>) => void) => (action: Action<unknown>) => {
        logger.debug('Dispatching action', 'Store', { action });
        logger.debug('Previous state', 'Store', { state: store.getState() });
        next(action);
        logger.debug('New state', 'Store', { state: store.getState() });
    };
}

/**
 * Thunk middleware for async actions
 */
export function thunkMiddleware(store: Store<unknown>) {
    return (next: (action: Action<unknown>) => void) => (action: Action<unknown>) => {
        if (typeof action === 'function') {
            return action(store.dispatch, store.getState);
        }
        return next(action);
    };
}
