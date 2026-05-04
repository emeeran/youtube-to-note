import { logger } from './logger';

/**
 * Modal state tracking — prevents duplicate modal openings
 */

export interface ModalState {
    isModalOpen: boolean;
    pendingModalUrl?: string;
    lastCallId?: string;
}

export class ModalManager {
    private state: ModalState = { isModalOpen: false };

    public getState(): ModalState {
        return { ...this.state };
    }

    public isModalOpen(): boolean {
        return this.state.isModalOpen;
    }

    public clear(): void {
        this.state = { isModalOpen: false };
        logger.info('Modal manager cleared', 'ModalManager');
    }
}
