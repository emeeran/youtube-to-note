/**
 * URL Input Component
 * Reusable URL input with paste, validation, and clear functionality
 */

export interface URLInputOptions {
  placeholder?: string;
  initialUrl?: string;
  onPaste?: () => void;
  onClear?: () => void;
  onInput?: (url: string) => void;
  showPasteButton?: boolean;
  showClearButton?: boolean;
}

export class URLInputComponent {
    private container: HTMLDivElement;
    private input: HTMLInputElement;
    private pasteButton?: HTMLButtonElement;
    private clearButton?: HTMLButtonElement;
    private validationMessage?: HTMLDivElement;

    constructor(private parent: HTMLElement, private options: URLInputOptions = {}) {
        this.container = this.createContainer();
        this.createInput();
        this.createButtons();
        this.createValidationMessage();

        if (options.initialUrl) {
            this.setUrl(options.initialUrl);
        }

        parent.appendChild(this.container);
    }

    private createContainer(): HTMLDivElement {
        const container = document.createElement('div');
        container.style.cssText = `
      margin: 4px 0;
      position: relative;
    `;
        return container;
    }

    private createInput(): void {
        const inputWrapper = this.container.createDiv();
        inputWrapper.style.cssText = `
      position: relative;
      display: flex;
      align-items: center;
      gap: 4px;
    `;

        this.input = inputWrapper.createEl('input');
        this.input.type = 'url';
        this.input.placeholder = this.options.placeholder ?? 'Paste URL...';
        this.input.style.cssText = `
      flex: 1;
      padding: 6px 8px;
      border: 1px solid var(--background-modifier-border);
      border-radius: 4px;
      font-size: 0.85rem;
      background: var(--background-primary);
      color: var(--text-normal);
      transition: all 0.2s ease;
      outline: none;
    `;

        // Focus effects
        this.input.addEventListener('focus', () => {
            this.input.style.borderColor = 'var(--interactive-accent)';
            this.input.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.2)';
        });

        this.input.addEventListener('blur', () => {
            this.input.style.borderColor = 'var(--background-modifier-border)';
            this.input.style.boxShadow = 'none';
        });

        this.input.addEventListener('input', () => {
            if (this.options.onInput) {
                this.options.onInput(this.input.value);
            }
        });
    }

    private createButtons(): void {
        const inputWrapper = this.container.querySelector('div');

        if (this.options.showPasteButton !== false) {
            this.pasteButton = inputWrapper!.createEl('button');
            this.pasteButton.innerHTML = '📋';
            this.pasteButton.style.cssText = `
        padding: 6px;
        background: var(--interactive-accent);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8rem;
        transition: all 0.2s ease;
        color: white;
        flex-shrink: 0;
      `;

            this.pasteButton.addEventListener('click', () => {
                if (this.options.onPaste) {
                    this.options.onPaste();
                }
            });

            this.pasteButton.addEventListener('mouseenter', () => {
        this.pasteButton!.style.background = 'var(--interactive-accent-hover)';
            });

            this.pasteButton.addEventListener('mouseleave', () => {
        this.pasteButton!.style.background = 'var(--interactive-accent)';
            });
        }

        if (this.options.showClearButton) {
            this.clearButton = inputWrapper!.createEl('button');
            this.clearButton.innerHTML = '✕';
            this.clearButton.style.cssText = `
        padding: 6px;
        background: var(--background-modifier-error);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8rem;
        color: white;
        flex-shrink: 0;
      `;

            this.clearButton.addEventListener('click', () => {
                if (this.options.onClear) {
                    this.options.onClear();
                }
                this.clear();
            });
        }
    }

    private createValidationMessage(): void {
        this.validationMessage = this.container.createDiv();
        this.validationMessage.style.cssText = `
      margin-top: 2px;
      padding: 2px 4px;
      font-size: 0.7rem;
      color: var(--text-muted);
      border-radius: 3px;
    `;
    }

    getValue(): string {
        return this.input.value;
    }

    setUrl(url: string): void {
        this.input.value = url;
    }

    clear(): void {
        this.input.value = '';
    }

    focus(): void {
        this.input.focus();
    }

    setValidation(message: string, type: 'error' | 'warning' | 'info' = 'info'): void {
        if (!this.validationMessage) return;

        this.validationMessage.textContent = message;
        this.validationMessage.style.color = type === 'error'
            ? 'var(--text-error)'
            : type === 'warning'
                ? 'var(--text-warning)'
                : 'var(--text-muted)';
    }

    clearValidation(): void {
        if (this.validationMessage) {
            this.validationMessage.textContent = '';
        }
    }

    getElement(): HTMLDivElement {
        return this.container;
    }

    getInput(): HTMLInputElement {
        return this.input;
    }
}
