/**
 * Service Locator - Dependency Inversion Principle Implementation
 * Provides dependency injection container and service registration
 * High-level modules depend on abstractions, not concrete implementations
 */

import { ILogger } from '../interfaces/isp-interfaces';

/**
 * Service descriptor interface
 */
export interface ServiceDescriptor {
    name: string;
    factory: () => any;
    singleton: boolean;
    instance?: any;
    dependencies?: string[];
}

/**
 * Service locator interface
 */
export interface IServiceLocator {
    register<T>(name: string, factory: () => T, singleton?: boolean): void;
    registerInstance<T>(name: string, instance: T): void;
    get<T>(name: string): T;
    has(name: string): boolean;
    clear(): void;
    getRegisteredServices(): string[];
}

/**
 * Concrete service locator implementation
 */
export class ServiceLocator implements IServiceLocator {
    private services = new Map<string, ServiceDescriptor>();
    private logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    /**
     * Register a service factory
     */
    register<T>(name: string, factory: () => T, singleton: boolean = true): void {
        if (this.services.has(name)) {
            this.logger.warn(`Service ${name} is already registered, overwriting`, 'ServiceLocator');
        }

        const descriptor: ServiceDescriptor = {
            name,
            factory,
            singleton
        };

        this.services.set(name, descriptor);
        this.logger.debug(`Registered service: ${name}`, 'ServiceLocator', { singleton });
    }

    /**
     * Register a service instance
     */
    registerInstance<T>(name: string, instance: T): void {
        if (this.services.has(name)) {
            this.logger.warn(`Service ${name} is already registered, overwriting`, 'ServiceLocator');
        }

        const descriptor: ServiceDescriptor = {
            name,
            factory: () => instance,
            singleton: true,
            instance
        };

        this.services.set(name, descriptor);
        this.logger.debug(`Registered service instance: ${name}`, 'ServiceLocator');
    }

    /**
     * Get a service instance
     */
    get<T>(name: string): T {
        const descriptor = this.services.get(name);
        if (!descriptor) {
            throw new Error(`Service ${name} is not registered`);
        }

        // Return existing instance for singletons
        if (descriptor.singleton && descriptor.instance) {
            return descriptor.instance as T;
        }

        // Create new instance
        const instance = descriptor.factory();

        // Store for singletons
        if (descriptor.singleton) {
            descriptor.instance = instance;
        }

        this.logger.debug(`Resolved service: ${name}`, 'ServiceLocator', { singleton: descriptor.singleton });
        return instance as T;
    }

    /**
     * Check if a service is registered
     */
    has(name: string): boolean {
        return this.services.has(name);
    }

    /**
     * Clear all services
     */
    clear(): void {
        const count = this.services.size;
        this.services.clear();
        this.logger.info(`Cleared ${count} services`, 'ServiceLocator');
    }

    /**
     * Get all registered service names
     */
    getRegisteredServices(): string[] {
        return Array.from(this.services.keys());
    }

    /**
     * Create a service with dependencies
     */
    createWithDependencies<T>(
        name: string,
        factory: (locator: IServiceLocator) => T,
        dependencies: string[] = [],
        singleton: boolean = true
    ): void {
        this.register(name, () => factory(this), singleton);
    }
}

/**
 * Global service locator instance
 */
let globalServiceLocator: IServiceLocator | null = null;

/**
 * Initialize global service locator
 */
export function initializeServiceLocator(logger: ILogger): IServiceLocator {
    globalServiceLocator = new ServiceLocator(logger);
    logger.info('Global service locator initialized', 'ServiceLocator');
    return globalServiceLocator;
}

/**
 * Get global service locator
 */
export function getServiceLocator(): IServiceLocator {
    if (!globalServiceLocator) {
        throw new Error('Service locator not initialized. Call initializeServiceLocator first.');
    }
    return globalServiceLocator;
}

/**
 * Convenience function to register a service
 */
export function registerService<T>(name: string, factory: () => T, singleton?: boolean): void {
    getServiceLocator().register(name, factory, singleton);
}

/**
 * Convenience function to register a service instance
 */
export function registerServiceInstance<T>(name: string, instance: T): void {
    getServiceLocator().registerInstance(name, instance);
}

/**
 * Convenience function to get a service
 */
export function getService<T>(name: string): T {
    return getServiceLocator().get<T>(name);
}