/**
 * Toast Notification System
 */

import { Notice } from 'obsidian';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastConfig {
    message: string;
    type?: ToastType;
    duration?: number;
    timeout?: number;
}

class ToastManager {
    private toasts: Notice[] = [];

    show(config: ToastConfig): Notice {
        const { message, type = 'info', duration = 3000 } = config;

        // Format message with type indicator
        const prefix = this.getPrefix(type);
        const formattedMessage = `${prefix}${message}`;

        const notice = new Notice(formattedMessage, duration);
        this.toasts.push(notice);

        // Clean up old toasts
        setTimeout(() => {
            this.toasts = this.toasts.filter(t => t !== notice);
        }, duration);

        return notice;
    }

    info(message: string, duration?: number): Notice {
        return this.show({ message, type: 'info', duration });
    }

    success(message: string, duration?: number): Notice {
        return this.show({ message, type: 'success', duration });
    }

    warning(message: string, duration?: number): Notice {
        return this.show({ message, type: 'warning', duration });
    }

    error(message: string, duration?: number): Notice {
        return this.show({ message, type: 'error', duration: 5000 });
    }

    private getPrefix(type: ToastType): string {
        const prefixes = {
            info: 'ℹ️ ',
            success: '✅ ',
            warning: '⚠️ ',
            error: '❌ ',
        };
        return prefixes[type] || '';
    }

    clear(): void {
        this.toasts.forEach(toast => toast.hide());
        this.toasts = [];
    }
}

export const toast = new ToastManager();
