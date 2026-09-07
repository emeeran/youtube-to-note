import { logger } from './logger';

/**
 * Modal state tracking — prevents duplicate modal openings
 *
 * The ribbon, the command palette, the clipboard watcher and the obsidian://
 * handler can all ask for the YouTube modal inside the same tick. Stacked
 * modals fight over one keyboard scope, so exactly one may win: opening is
 * claimed with {@link ModalManager.beginOpen} and released from the modal's
 * onClose through its `onModalClosed` option.
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

    /**
     * Claim the single modal slot.
     *
     * Returns `false` when a modal is already open — the caller should surface a
     * Notice and stop instead of opening a second one. Returns `true` (with the
     * flag set) when the caller may go ahead.
     *
     * MUST be paired with {@link ModalManager.notifyClosed}, which the modal
     * calls from onClose; claiming without ever releasing would wedge the flag
     * and block every later open for the rest of the session.
     */
    public beginOpen(): boolean {
        if (this.state.isModalOpen) {
            logger.warn('Modal is already open — ignoring duplicate open request', 'ModalManager');
            return false;
        }
        this.state = { ...this.state, isModalOpen: true };
        logger.debug('Modal slot claimed', 'ModalManager');
        return true;
    }

    /** Release the slot claimed by {@link ModalManager.beginOpen}. */
    public notifyClosed(): void {
        if (!this.state.isModalOpen) return;
        this.state = { ...this.state, isModalOpen: false };
        logger.debug('Modal slot released', 'ModalManager');
    }

    public clear(): void {
        this.state = { isModalOpen: false };
        logger.info('Modal manager cleared', 'ModalManager');
    }
}
