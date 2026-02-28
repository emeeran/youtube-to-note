/**
 * ProviderCard - Card-based component for API provider configuration
 *
 * Features:
 * - Visual status indicator
 * - Key strength visualization
 * - Quick test button
 * - Password visibility toggle
 */

const CSS_PREFIX = 'ytc-settings';

export type ProviderStatus = 'valid' | 'invalid' | 'testing' | 'untested';
export type KeyStrength = 'weak' | 'medium' | 'strong' | 'none';

export interface ProviderCardOptions {
    /** Provider identifier */
    id: string;
    /** Display name */
    name: string;
    /** Icon emoji or character */
    icon: string;
    /** Description text */
    description: string;
    /** Placeholder text for input */
    placeholder: string;
    /** Current API key value (masked) */
    value?: string;
    /** Current status */
    status?: ProviderStatus;
    /** Key strength indicator */
    keyStrength?: KeyStrength;
    /** Whether this is an optional key */
    optional?: boolean;
    /** Link to get API key */
    getKeyUrl?: string;
    /** Callback when key changes */
    onChange?: (value: string) => void;
    /** Callback when test button clicked */
    onTest?: () => Promise<void>;
}

/**
 * Provider card component for API key configuration
 *
 * @example
 * ```typescript
 * const card = new ProviderCard({
 *     id: 'gemini',
 *     name: 'Google Gemini',
 *     icon: '✨',
 *     description: 'Primary AI provider for video analysis',
 *     placeholder: 'Enter your Gemini API key (AIzaSy...)',
 *     getKeyUrl: 'https://aistudio.google.com/apikey',
 *     onTest: async () => { ... }
 * });
 *
 * container.appendChild(card.render());
 * ```
 */
export class ProviderCard {
    private cardEl: HTMLElement | null = null;
    private inputEl: HTMLInputElement | null = null;
    private statusEl: HTMLElement | null = null;
    private testBtnEl: HTMLButtonElement | null = null;
    private status: ProviderStatus;
    private isVisible = false;

    constructor(private readonly options: ProviderCardOptions) {
        this.status = options.status ?? 'untested';
    }

    /**
     * Render the provider card
     */
    render(): HTMLElement {
        this.cardEl = document.createElement('div');
        this.cardEl.className = `${CSS_PREFIX}-provider-card`;
        this.cardEl.setAttribute('data-provider-id', this.options.id);

        this.renderHeader();
        this.renderDescription();
        this.renderInputGroup();
        this.renderKeyStrength();
        this.renderGetKeyLink();

        return this.cardEl;
    }

    /**
     * Render the card header with icon, name, and status
     */
    private renderHeader(): void {
        const header = this.cardEl.createDiv({ cls: `${CSS_PREFIX}-provider-header` });

        header.createSpan({
            cls: `${CSS_PREFIX}-provider-icon`,
            text: this.options.icon,
        });

        header.createSpan({
            cls: `${CSS_PREFIX}-provider-name`,
            text: this.options.name,
        });

        this.statusEl = header.createDiv({
            cls: `${CSS_PREFIX}-provider-status ${this.status}`,
            attr: { 'aria-live': 'polite' },
        });
        this.updateStatusDisplay();
    }

    /**
     * Render the description
     */
    private renderDescription(): void {
        this.cardEl.createDiv({
            cls: `${CSS_PREFIX}-provider-desc`,
            text: this.options.description,
        });
    }

    /**
     * Render the input group with API key input and buttons
     */
    private renderInputGroup(): void {
        const inputGroup = this.cardEl.createDiv({
            cls: `${CSS_PREFIX}-provider-input-group`,
        });

        this.inputEl = inputGroup.createEl('input', {
            attr: {
                type: 'password',
                placeholder: this.options.placeholder,
                value: this.options.value ?? '',
                autocomplete: 'off',
                'aria-label': `${this.options.name} API Key`,
            },
        });
        this.inputEl.style.flex = '1';

        const toggleBtn = inputGroup.createEl('button', {
            cls: `${CSS_PREFIX}-password-toggle`,
            text: '\u{1F441}\uFE0F',
            attr: {
                type: 'button',
                'aria-label': 'Toggle password visibility',
                title: 'Show key',
            },
        });
        toggleBtn.addEventListener('click', () => this.toggleVisibility());

        this.testBtnEl = inputGroup.createEl('button', {
            cls: `${CSS_PREFIX}-validate-btn`,
            text: '\u2713 Test',
            attr: {
                type: 'button',
                'aria-label': `Test ${this.options.name} connection`,
            },
        });
        this.testBtnEl.addEventListener('click', () => this.handleTest());

        this.inputEl.addEventListener('input', () => {
            const value = this.inputEl?.value ?? '';
            this.options.onChange?.(value);
            this.updateKeyStrength(value);
        });
    }

    /**
     * Render the key strength indicator
     */
    private renderKeyStrength(): void {
        if (this.options.keyStrength === 'none') {
            return;
        }
        const strengthEl = this.cardEl.createDiv({
            cls: `${CSS_PREFIX}-key-strength ${this.options.keyStrength ?? 'none'}`,
        });
        for (let i = 0; i < 3; i++) {
            strengthEl.createDiv({ cls: `${CSS_PREFIX}-key-strength-bar` });
        }
    }

    /**
     * Render the "Get Key" link
     */
    private renderGetKeyLink(): void {
        if (!this.options.getKeyUrl) {
            return;
        }
        const linkEl = this.cardEl.createDiv({
            cls: `${CSS_PREFIX}-provider-link`,
            attr: { style: 'margin-top: 8px; font-size: 0.8rem;' },
        });
        linkEl.createEl('a', {
            text: `Get ${this.options.name} API key \u2197\uFE0F`,
            attr: {
                href: this.options.getKeyUrl,
                target: '_blank',
                rel: 'noopener noreferrer',
            },
        });
    }

    /**
     * Get the current input value
     */
    getValue(): string {
        return this.inputEl?.value ?? '';
    }

    /**
     * Set the input value
     */
    setValue(value: string): void {
        if (this.inputEl) {
            this.inputEl.value = value;
        }
    }

    /**
     * Update the provider status
     */
    setStatus(status: ProviderStatus): void {
        this.status = status;
        this.updateStatusDisplay();
    }

    /**
     * Get current status
     */
    getStatus(): ProviderStatus {
        return this.status;
    }

    /**
     * Update status display
     */
    private updateStatusDisplay(): void {
        if (!this.statusEl) return;

        // Update class
        this.statusEl.className = `${CSS_PREFIX}-provider-status ${this.status}`;

        // Update text and icon
        const statusConfig: Record<ProviderStatus, { text: string; icon: string }> = {
            valid: { text: 'Valid', icon: '\u2713' }, // ✓
            invalid: { text: 'Invalid', icon: '\u2717' }, // ✗
            testing: { text: 'Testing...', icon: '\u231B' }, // ⏳
            untested: { text: 'Untested', icon: '\u2022' }, // •
        };

        const config = statusConfig[this.status];
        this.statusEl.textContent = `${config.icon} ${config.text}`;
    }

    /**
     * Toggle password visibility
     */
    private toggleVisibility(): void {
        this.isVisible = !this.isVisible;

        if (this.inputEl) {
            this.inputEl.type = this.isVisible ? 'text' : 'password';
        }

        // Update button
        const toggleBtn = this.cardEl?.querySelector(`.${CSS_PREFIX}-password-toggle`);
        if (toggleBtn) {
            toggleBtn.textContent = this.isVisible ? '\u{1F648}' : '\u{1F441}\uFE0F'; // 🙈 / 👁️
            (toggleBtn as HTMLElement).title = this.isVisible ? 'Hide key' : 'Show key';
        }
    }

    /**
     * Update key strength indicator based on value
     */
    private updateKeyStrength(value: string): void {
        const strengthEl = this.cardEl?.querySelector(`.${CSS_PREFIX}-key-strength`);
        if (!strengthEl) return;

        let strength: KeyStrength = 'none';

        if (value.length > 0) {
            if (value.length < 20) {
                strength = 'weak';
            } else if (value.length < 35) {
                strength = 'medium';
            } else {
                strength = 'strong';
            }
        }

        strengthEl.className = `${CSS_PREFIX}-key-strength ${strength}`;
    }

    /**
     * Handle test button click
     */
    private async handleTest(): Promise<void> {
        if (!this.testBtnEl) return;

        // Disable button and show loading state
        this.testBtnEl.disabled = true;
        this.testBtnEl.innerHTML = '<span class="ytc-settings-spinner"></span>';
        this.setStatus('testing');

        try {
            if (this.options.onTest) {
                await this.options.onTest();
            }

            // Success state
            this.testBtnEl.textContent = '\u2713 Valid'; // ✓ Valid
            this.testBtnEl.classList.add('is-success');
            this.setStatus('valid');
        } catch (error) {
            // Error state
            this.testBtnEl.textContent = '\u2717 Invalid'; // ✗ Invalid
            this.testBtnEl.classList.add('is-error');
            this.setStatus('invalid');
        }

        // Reset button after delay
        setTimeout(() => {
            if (this.testBtnEl) {
                this.testBtnEl.textContent = '\u2713 Test'; // ✓ Test
                this.testBtnEl.classList.remove('is-success', 'is-error');
                this.testBtnEl.disabled = false;
            }
        }, 3000);
    }

    /**
     * Set loading/test state externally
     */
    setLoading(isLoading: boolean): void {
        if (!this.testBtnEl) return;

        this.testBtnEl.disabled = isLoading;
        if (isLoading) {
            this.testBtnEl.innerHTML = '<span class="ytc-settings-spinner"></span>';
            this.setStatus('testing');
        }
    }

    /**
     * Get the card element
     */
    getElement(): HTMLElement | null {
        return this.cardEl;
    }

    /**
     * Focus the input element
     */
    focus(): void {
        this.inputEl?.focus();
    }

    /**
     * Clean up
     */
    destroy(): void {
        this.cardEl = null;
        this.inputEl = null;
        this.statusEl = null;
        this.testBtnEl = null;
    }
}

/**
 * Factory function to create a provider card
 */
export function createProviderCard(options: ProviderCardOptions): ProviderCard {
    return new ProviderCard(options);
}
