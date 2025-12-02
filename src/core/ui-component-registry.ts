/**
 * UI Component Registry - Single Responsibility: UI component management
 * Handles registration, creation, and cleanup of UI elements
 */

import { App, TFile, WorkspaceLeaf } from 'obsidian';
import { logger } from '../services/logger';
import { MESSAGES } from '../constants/index';

export interface UIComponentConfig {
    addRibbonIcon?: boolean;
    addCommands?: boolean;
}

export class UIComponentRegistry {
    private ribbonIcon?: HTMLElement | null = null;
    private activeOperationCount = 0;

    constructor(
        private app: App,
        private config: UIComponentConfig = { addRibbonIcon: true, addCommands: true }
    ) {}

    /**
     * Register all UI components
     */
    registerComponents(): void {
        if (this.config.addRibbonIcon) {
            this.registerRibbonIcon();
        }

        if (this.config.addCommands) {
            this.registerCommands();
        }

        logger.info('UI components registered successfully', 'UIComponentRegistry');
    }

    /**
     * Clean up all UI components
     */
    cleanup(): void {
        this.removeRibbonIcon();
        logger.info('UI components cleaned up successfully', 'UIComponentRegistry');
    }

    /**
     * Execute an operation safely with operation counting
     */
    async safeOperation<T>(
        operation: () => Promise<T>,
        operationName: string
    ): Promise<T | undefined> {
        this.activeOperationCount++;

        try {
            logger.debug(`Starting operation: ${operationName}`, 'UIComponentRegistry', {
                activeOperations: this.activeOperationCount
            });

            return await operation();
        } catch (error) {
            logger.error(`Operation failed: ${operationName}`, 'UIComponentRegistry', {
                error: error instanceof Error ? error.message : String(error)
            });
            return undefined;
        } finally {
            this.activeOperationCount--;
            logger.debug(`Completed operation: ${operationName}`, 'UIComponentRegistry', {
                activeOperations: this.activeOperationCount
            });
        }
    }

    /**
     * Get current operation count
     */
    getActiveOperationCount(): number {
        return this.activeOperationCount;
    }

    /**
     * Check if operations are in progress
     */
    hasActiveOperations(): boolean {
        return this.activeOperationCount > 0;
    }

    private registerRibbonIcon(): void {
        try {
            this.ribbonIcon = this.addRibbonIcon(
                'play-circle',
                MESSAGES.UI.ICON_TOOLTIP,
                (evt: MouseEvent) => {
                    this.safeOperation(
                        () => this.handleRibbonIconClick(),
                        'Ribbon icon click'
                    );
                }
            );
        } catch (error) {
            logger.warn('Failed to register ribbon icon', 'UIComponentRegistry', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private registerCommands(): void {
        try {
            this.addCommand({
                id: 'open-youtube-clipper',
                name: MESSAGES.COMMANDS.OPEN_CLIPPER,
                callback: () => {
                    this.safeOperation(
                        () => this.handleOpenCommand(),
                        'Open command'
                    );
                }
            });

            this.addCommand({
                id: 'process-clipboard-url',
                name: MESSAGES.COMMANDS.PROCESS_CLIPBOARD,
                callback: () => {
                    this.safeOperation(
                        () => this.handleClipboardCommand(),
                        'Clipboard command'
                    );
                }
            });
        } catch (error) {
            logger.warn('Failed to register commands', 'UIComponentRegistry', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private removeRibbonIcon(): void {
        if (this.ribbonIcon) {
            this.ribbonIcon.remove();
            this.ribbonIcon = null;
        }
    }

    private async handleRibbonIconClick(): Promise<void> {
        // This will be implemented by the main plugin class
        // Using dependency injection pattern
        logger.debug('Ribbon icon clicked', 'UIComponentRegistry');
    }

    private async handleOpenCommand(): Promise<void> {
        // This will be implemented by the main plugin class
        logger.debug('Open command executed', 'UIComponentRegistry');
    }

    private async handleClipboardCommand(): Promise<void> {
        // This will be implemented by the main plugin class
        logger.debug('Clipboard command executed', 'UIComponentRegistry');
    }

    // These methods are expected to be available from the plugin context
    private addRibbonIcon(icon: string, tooltip: string, callback: (evt: MouseEvent) => void): HTMLElement {
        // @ts-ignore - Obsidian plugin method
        return (this as any).addRibbonIcon(icon, tooltip, callback);
    }

    private addCommand(command: { id: string; name: string; callback: () => void }): void {
        // @ts-ignore - Obsidian plugin method
        return (this as any).addCommand(command);
    }
}