import { logger } from './logger';

/**
 * Modal management service to prevent duplicate modal openings
 */

export interface ModalState {
    isModalOpen: boolean;
    pendingModalUrl?: string;
    lastCallId?: string;
}

export class ModalManager {
    private state: ModalState = {
        isModalOpen: false,
    };

    /**
     * Check if a modal can be opened safely
     */
    public canOpenModal(url?: string): { canOpen: boolean; reason?: string } {
        if (this.state.isModalOpen) {
            if (url && url !== this.state.pendingModalUrl) {
                return {
                    canOpen: false,
                    reason: 'Modal already open with different URL',
                };
            }
            return {
                canOpen: false,
                reason: 'Modal already open with same URL',
            };
        }
        return { canOpen: true };
    }

    /**
     * Open a modal safely with deduplication
     */
    public async openModal<T>(
        url: string | undefined,
        openModalFn: () => Promise<T>,
        onClose?: () => void
    ): Promise<T | null> {
        const callId = Math.random().toString(36).substring(2, 9);
        this.state.lastCallId = callId;

        logger.info('Modal opening requested', 'ModalManager', {
            callId,
            url,
            currentState: { ...this.state },
        });

        const { canOpen, reason } = this.canOpenModal(url);

        if (!canOpen) {
            logger.warn(`Modal open rejected: ${reason}`, 'ModalManager', {
                callId,
                url,
                reason,
                pendingUrl: this.state.pendingModalUrl,
            });

            // If this is a different URL than the pending one, update it
            if (url && url !== this.state.pendingModalUrl) {
                logger.info('Updating pending modal URL', 'ModalManager', {
                    oldUrl: this.state.pendingModalUrl,
                    newUrl: url,
                });
                this.state.pendingModalUrl = url;
            }

            return null;
        }

        // Mark that we're opening a modal
        this.state.isModalOpen = true;
        this.state.pendingModalUrl = url;

        logger.info('Modal state set to open', 'ModalManager', {
            callId,
            url,
        });

        try {
            // Create enhanced onClose handler
            const enhancedOnClose = () => {
                try {
                    logger.info('Modal onClose triggered', 'ModalManager', {
                        callId,
                        url,
                    });

                    this.resetModalState();

                    if (onClose) {
                        onClose();
                    }
                } catch (error) {
                    logger.error('Error in modal onClose handler', 'ModalManager', {
                        callId,
                        error: error instanceof Error ? error.message : String(error),
                    });
                    // Force reset even if there's an error
                    this.resetModalState();
                }
            };

            // Open the modal
            logger.info('About to open modal', 'ModalManager', {
                callId,
                url,
            });

            const result = await openModalFn();

            // Set up fallback timeout to reset modal state
            const fallbackTimeout = setTimeout(() => {
                if (this.state.isModalOpen && this.state.pendingModalUrl === url) {
                    logger.warn('Fallback modal state reset triggered', 'ModalManager', {
                        callId,
                        url,
                    });
                    this.resetModalState();
                }
            }, 10000);

            // Store timeout for potential cleanup (with safety check)
            if (result && typeof result === 'object') {
                (result as any)._fallbackTimeout = fallbackTimeout;
            } else {
                // If result is not an object, clear the timeout to prevent memory leaks
                logger.debug('Modal result is not an object, clearing fallback timeout', 'ModalManager', {
                    callId,
                    url,
                    resultType: typeof result,
                });
                clearTimeout(fallbackTimeout);
            }

            // Add check to see if modal state changes immediately
            setTimeout(() => {
                logger.debug('Modal state after 100ms', 'ModalManager', {
                    callId,
                    isModalOpen: this.state.isModalOpen,
                });
            }, 100);

            return result;

        } catch (error) {
            logger.error('Error opening modal', 'ModalManager', {
                callId,
                url,
                error: error instanceof Error ? error.message : String(error),
            });

            this.resetModalState();
            throw error;
        }
    }

    /**
     * Reset modal state
     */
    public resetModalState(): void {
        logger.debug('Resetting modal state', 'ModalManager', {
            previousState: { ...this.state },
        });

        this.state.isModalOpen = false;
        this.state.pendingModalUrl = undefined;
    }

    /**
     * Force reset modal state (for cleanup)
     */
    public forceResetModalState(): void {
        logger.warn('Force resetting modal state', 'ModalManager', {
            previousState: { ...this.state },
        });

        this.state = {
            isModalOpen: false,
        };
    }

    /**
     * Get current modal state
     */
    public getState(): ModalState {
        return { ...this.state };
    }

    /**
     * Check if modal is currently open
     */
    public isModalOpen(): boolean {
        return this.state.isModalOpen;
    }

    /**
     * Get pending modal URL
     */
    public getPendingModalUrl(): string | undefined {
        return this.state.pendingModalUrl;
    }

    /**
     * Clear all modal state (for plugin unload)
     */
    public clear(): void {
        this.forceResetModalState();
        logger.info('Modal manager cleared', 'ModalManager');
    }
}