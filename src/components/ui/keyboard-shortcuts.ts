/**
 * Keyboard Shortcuts Manager
 */

export interface Shortcut {
    id: string;
    key: string;
    modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[];
    description: string;
    action: () => void;
    enabled?: boolean;
}

export class KeyboardShortcutManager {
    private shortcuts: Map<string, Shortcut> = new Map();
    private enabled: boolean = true;

    register(shortcut: Shortcut): void {
        this.shortcuts.set(shortcut.id, { ...shortcut, enabled: true });
    }

    unregister(id: string): void {
        this.shortcuts.delete(id);
    }

    update(id: string, updates: Partial<Shortcut>): void {
        const shortcut = this.shortcuts.get(id);
        if (shortcut) {
            this.shortcuts.set(id, { ...shortcut, ...updates });
        }
    }

    enable(id: string): void {
        const shortcut = this.shortcuts.get(id);
        if (shortcut) {
            shortcut.enabled = true;
        }
    }

    disable(id: string): void {
        const shortcut = this.shortcuts.get(id);
        if (shortcut) {
            shortcut.enabled = false;
        }
    }

    handleKeydown(event: KeyboardEvent): boolean {
        if (!this.enabled) return false;

        for (const shortcut of this.shortcuts.values()) {
            if (shortcut.enabled && this.matchesShortcut(event, shortcut)) {
                shortcut.action();
                event.preventDefault();
                return true;
            }
        }

        return false;
    }

    private matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
        if (event.key !== shortcut.key) return false;

        if (shortcut.modifiers) {
            const hasCtrl = shortcut.modifiers.includes('ctrl');
            const hasAlt = shortcut.modifiers.includes('alt');
            const hasShift = shortcut.modifiers.includes('shift');
            const hasMeta = shortcut.modifiers.includes('meta');

            return (
                (hasCtrl === event.ctrlKey) &&
                (hasAlt === event.altKey) &&
                (hasShift === event.shiftKey) &&
                (hasMeta === event.metaKey)
            );
        }

        return true;
    }

    enableAll(): void {
        this.enabled = true;
    }

    disableAll(): void {
        this.enabled = false;
    }

    getShortcuts(): Shortcut[] {
        return Array.from(this.shortcuts.values());
    }

    clear(): void {
        this.shortcuts.clear();
    }
}

export const keyboardManager = new KeyboardShortcutManager();

// Default shortcuts
export const DEFAULT_SHORTCUTS: Omit<Shortcut, 'action'>[] = [
    {
        id: 'open-yt-clipper',
        key: 'y',
        modifiers: ['ctrl', 'shift'],
        description: 'Open YouTube Clipper',
    },
    {
        id: 'process-video',
        key: 'Enter',
        modifiers: ['ctrl'],
        description: 'Process Video',
    },
    {
        id: 'close-modal',
        key: 'Escape',
        description: 'Close Modal',
    },
];
