/**
 * Progress Indicator Component
 * Reusable multi-step progress indicator
 */

export interface ProgressStep {
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}

export class ProgressIndicatorComponent {
    private container: HTMLDivElement;
    private steps: Map<string, HTMLLIElement> = new Map();
    private progressBar?: HTMLDivElement;
    private progressText?: HTMLDivElement;

    constructor(private parent: HTMLElement, private stepsList: ProgressStep[] = []) {
        this.container = this.createContainer();
        this.createProgressBar();
        this.createSteps();
        parent.appendChild(this.container);
    }

    private createContainer(): HTMLDivElement {
        const container = document.createElement('div');
        container.style.cssText = `
      margin: 12px 0;
      padding: 8px;
      background: var(--background-secondary);
      border-radius: 4px;
      display: none;
    `;
        return container;
    }

    private createProgressBar(): void {
        const barContainer = this.container.createDiv();
        barContainer.style.cssText = `
      height: 4px;
      background: var(--background-modifier-border);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 8px;
    `;

        this.progressBar = barContainer.createDiv();
        this.progressBar.style.cssText = `
      height: 100%;
      width: 0%;
      background: var(--interactive-accent);
      transition: width 0.3s ease;
      border-radius: 2px;
    `;
    }

    private createSteps(): void {
        const listContainer = this.container.createDiv();
        const ul = listContainer.createEl('ul');
        ul.style.cssText = `
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;

        this.stepsList.forEach((step, _index) => {
            const li = ul.createEl('li');
            li.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.75rem;
        color: var(--text-muted);
        padding: 2px 0;
      `;

            const icon = document.createElement('span');
            icon.textContent = '○';
            icon.className = 'step-icon';

            const label = document.createElement('span');
            label.textContent = step.label;

            li.appendChild(icon);
            li.appendChild(label);

            this.steps.set(step.label, li);
        });
    }

    show(): void {
        this.container.style.display = 'block';
    }

    hide(): void {
        this.container.style.display = 'none';
    }

    updateProgress(currentStep: string, percentage: number): void {
    // Update progress bar
        if (this.progressBar) {
            this.progressBar.style.width = `${percentage}%`;
        }

        // Update step status
        this.updateStepStatus(currentStep, 'active');
    }

    updateStepStatus(stepLabel: string, status: ProgressStep['status']): void {
        const stepElement = this.steps.get(stepLabel);
        if (!stepElement) return;

        const icon = stepElement.querySelector('.step-icon') as HTMLSpanElement;
        if (!icon) return;

        // Reset all steps
        this.steps.forEach((el) => {
            const stepIcon = el.querySelector('.step-icon') as HTMLSpanElement;
            if (stepIcon) {
                stepIcon.textContent = '○';
                stepIcon.style.color = 'var(--text-muted)';
            }
            el.style.color = 'var(--text-muted)';
        });

        // Set current step status
        switch (status) {
            case 'pending':
                icon.textContent = '○';
                icon.style.color = 'var(--text-muted)';
                break;
            case 'active':
                icon.textContent = '⟳';
                icon.style.color = 'var(--interactive-accent)';
                stepElement.style.color = 'var(--text-normal)';
                break;
            case 'complete':
                icon.textContent = '✓';
                icon.style.color = 'var(--text-success)';
                stepElement.style.color = 'var(--text-normal)';
                break;
            case 'error':
                icon.textContent = '✕';
                icon.style.color = 'var(--text-error)';
                stepElement.style.color = 'var(--text-error)';
                break;
        }
    }

    setError(message: string): void {
        if (this.progressText) {
            this.progressText.textContent = message;
            this.progressText.style.color = 'var(--text-error)';
        }
    }

    reset(): void {
        if (this.progressBar) {
            this.progressBar.style.width = '0%';
        }
        this.steps.forEach((el) => {
            const icon = el.querySelector('.step-icon') as HTMLSpanElement;
            if (icon) {
                icon.textContent = '○';
                icon.style.color = 'var(--text-muted)';
            }
            el.style.color = 'var(--text-muted)';
        });
        this.hide();
    }

    getElement(): HTMLDivElement {
        return this.container;
    }
}
