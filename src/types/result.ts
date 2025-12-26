/**
 * Result type for error handling
 * Inspired by Rust's Result<T, E> and functional programming patterns
 */

export class Ok<T> {
    constructor(public value: T) {}

    isOk(): this is Ok<T> {
        return true;
    }

    isErr(): this is Err<never> {
        return false;
    }

    map<U>(fn: (value: T) => U): Result<U, never> {
        return new Ok(fn(this.value));
    }

    mapErr<U>(fn: (error: never) => U): Result<T, U> {
        return this as unknown as Result<T, U>;
    }

    unwrap(): T {
        return this.value;
    }

    unwrapOr(_defaultValue: T): T {
        return this.value;
    }

    async unwrapOrPromise(_defaultValue: T): Promise<T> {
        return this.value;
    }
}

export class Err<E> {
    constructor(public error: E) {}

    isOk(): this is Ok<never> {
        return false;
    }

    isErr(): this is Err<E> {
        return true;
    }

    map<U>(fn: (value: never) => U): Result<U, E> {
        return this as unknown as Result<U, E>;
    }

    mapErr<F>(fn: (error: E) => F): Result<never, F> {
        return new Err(fn(this.error));
    }

    unwrap(): never {
        throw this.error;
    }

    unwrapOr<T>(defaultValue: T): T {
        return defaultValue;
    }

    async unwrapOrPromise<T>(defaultValue: T): Promise<T> {
        return defaultValue;
    }
}

export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
    return new Ok(value);
}

export function err<E>(error: E): Err<E> {
    return new Err(error);
}

/**
 * Create Result from try-catch
 */
export function tryCatch<T, E = Error>(fn: () => T): Result<T, E> {
    try {
        return ok(fn());
    } catch (error) {
        return err(error as E);
    }
}

/**
 * Create Result from async try-catch
 */
export async function tryCatchAsync<T, E = Error>(fn: () => Promise<T>): Promise<Result<T, E>> {
    try {
        return ok(await fn());
    } catch (error) {
        return err(error as E);
    }
}

/**
 * Combine multiple Results
 */
export function all<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];

    for (const result of results) {
        if (result.isErr()) {
            return result as Err<E>;
        }
        values.push(result.value);
    }

    return ok(values);
}
