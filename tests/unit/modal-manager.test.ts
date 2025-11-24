/**
 * Modal Manager unit tests
 */

import { ModalManager } from '../../src/services/modal-manager';

describe('ModalManager', () => {
    let modalManager: ModalManager;
    let mockOpenModalFn: jest.Mock;
    let mockOnClose: jest.Mock;

    beforeEach(() => {
        modalManager = new ModalManager();
        mockOpenModalFn = jest.fn().mockResolvedValue('modal result');
        mockOnClose = jest.fn();
    });

    describe('modal state management', () => {
        it('should start with no modal open', () => {
            expect(modalManager.isModalOpen()).toBe(false);
            expect(modalManager.getState()).toEqual({
                isModalOpen: false,
                pendingModalUrl: undefined,
                lastCallId: undefined
            });
        });

        it('should allow opening modal when none is open', () => {
            const { canOpen } = modalManager.canOpenModal();
            expect(canOpen).toBe(true);
        });

        it('should reject opening modal when one is already open', async () => {
            // Open first modal
            modalManager.openModal('url1', mockOpenModalFn);
            expect(modalManager.isModalOpen()).toBe(true);

            // Try to open second modal
            const { canOpen, reason } = modalManager.canOpenModal('url2');
            expect(canOpen).toBe(false);
            expect(reason).toBe('Modal already open with different URL');
        });

        it('should allow updating pending URL when different URL provided', async () => {
            modalManager.openModal('url1', mockOpenModalFn);

            const { canOpen } = modalManager.canOpenModal('url2');
            expect(canOpen).toBe(false);
            expect(modalManager.getPendingModalUrl()).toBe('url2');
        });
    });

    describe('opening modals', () => {
        it('should open modal successfully', async () => {
            const result = await modalManager.openModal('test-url', mockOpenModalFn, mockOnClose);

            expect(result).toBe('modal result');
            expect(mockOpenModalFn).toHaveBeenCalledTimes(1);
            expect(modalManager.isModalOpen()).toBe(true);
            expect(modalManager.getPendingModalUrl()).toBe('test-url');
        });

        it('should handle null/undefined URLs', async () => {
            const result = await modalManager.openModal(undefined, mockOpenModalFn);

            expect(result).toBe('modal result');
            expect(modalManager.getPendingModalUrl()).toBeUndefined();
        });

        it('should reject modal opening when already open with different URL', async () => {
            // First modal
            modalManager.openModal('url1', mockOpenModalFn);

            // Second modal with different URL
            const result = await modalManager.openModal('url2', mockOpenModalFn);

            expect(result).toBeNull();
            expect(mockOpenModalFn).toHaveBeenCalledTimes(1); // Only called once
        });

        it('should reject modal opening when already open with same URL', async () => {
            // First modal
            modalManager.openModal('url1', mockOpenModalFn);

            // Second modal with same URL
            const result = await modalManager.openModal('url1', mockOpenModalFn);

            expect(result).toBeNull();
            expect(mockOpenModalFn).toHaveBeenCalledTimes(1); // Only called once
        });

        it('should handle modal opening errors', async () => {
            const error = new Error('Modal failed to open');
            mockOpenModalFn.mockRejectedValue(error);

            await expect(modalManager.openModal('test-url', mockOpenModalFn)).rejects.toThrow('Modal failed to open');
            expect(modalManager.isModalOpen()).toBe(false);
        });
    });

    describe('modal closing', () => {
        it('should reset state when modal closes', async () => {
            await modalManager.openModal('test-url', mockOpenModalFn, mockOnClose);

            // Simulate modal close
            mockOnClose();

            expect(modalManager.isModalOpen()).toBe(false);
            expect(modalManager.getPendingModalUrl()).toBeUndefined();
        });

        it('should handle close errors gracefully', async () => {
            const errorOnClose = jest.fn(() => {
                throw new Error('Close error');
            });

            await modalManager.openModal('test-url', mockOpenModalFn, errorOnClose);

            // Should not throw
            expect(() => errorOnClose()).not.toThrow();

            // State should still be reset
            expect(modalManager.isModalOpen()).toBe(false);
        });
    });

    describe('state management', () => {
        it('should reset modal state manually', async () => {
            await modalManager.openModal('test-url', mockOpenModalFn);
            expect(modalManager.isModalOpen()).toBe(true);

            modalManager.resetModalState();
            expect(modalManager.isModalOpen()).toBe(false);
            expect(modalManager.getPendingModalUrl()).toBeUndefined();
        });

        it('should force reset modal state', async () => {
            await modalManager.openModal('test-url', mockOpenModalFn);
            expect(modalManager.getState().lastCallId).toBeDefined();

            modalManager.forceResetModalState();

            const state = modalManager.getState();
            expect(state).toEqual({
                isModalOpen: false,
                pendingModalUrl: undefined,
                lastCallId: undefined
            });
        });

        it('should clone state when getting', () => {
            const state1 = modalManager.getState();
            const state2 = modalManager.getState();
            expect(state1).not.toBe(state2); // Different objects
            expect(state1).toEqual(state2); // Same values
        });
    });

    describe('clear method', () => {
        it('should clear all modal state', async () => {
            await modalManager.openModal('test-url', mockOpenModalFn);
            expect(modalManager.isModalOpen()).toBe(true);

            modalManager.clear();
            expect(modalManager.isModalOpen()).toBe(false);
            expect(modalManager.getPendingModalUrl()).toBeUndefined();
            expect(modalManager.getState().lastCallId).toBeUndefined();
        });
    });
});