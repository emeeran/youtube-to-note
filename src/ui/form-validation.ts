import { a11y } from './accessibility';
import { StyleManager } from './constants/index';


/**
 * Validation rule types
 */
export interface ValidationRule {
    name: string;
    validate: (value: any) => boolean;
    message: string;
    async?: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Form field configuration
 */
export interface FormField {
    element: HTMLElement;
    name: string;
    rules: ValidationRule[];
    required?: boolean;
    debounceMs?: number;
    validateOnBlur?: boolean;
    validateOnChange?: boolean;
    customValidator?: (value: any) => Promise<ValidationResult>;
}

/**
 * Advanced form validation system
 */
export class FormValidationManager {
    private static instance: FormValidationManager;
    private forms: Map<HTMLElement, FormField[]> = new Map();
    private validationStates: Map<string, ValidationResult> = new Map();
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private submitHandlers: Map<HTMLElement, () => Promise<boolean>> = new Map();

    private constructor() {
        this.initializeValidationStyles();
        this.setupGlobalValidationHandlers();
    }

    static getInstance(): FormValidationManager {
        if (!FormValidationManager.instance) {
            FormValidationManager.instance = new FormValidationManager();
        }
        return FormValidationManager.instance;
    }

    /**
     * Initialize validation styles
     */
    private initializeValidationStyles(): void {
        const validationCSS = `
            /* Form validation base styles */
            .yt-form-field {
                position: relative;
                margin-bottom: 16px;
            }

            .yt-form-label {
                display: block;
                margin-bottom: 4px;
                font-weight: 500;
                color: var(--text-normal);
            }

            .yt-form-label.required::after {
                content: ' *';
                color: var(--text-error);
            }

            /* Input validation states */
            .yt-form-input {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 4px;
                background: var(--background-primary);
                color: var(--text-normal);
                font-size: 14px;
                transition: border-color 0.2s ease, box-shadow 0.2s ease;
            }

            .yt-form-input:focus {
                outline: none;
                border-color: var(--interactive-accent);
                box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2);
            }

            .yt-form-input.valid {
                border-color: var(--text-success);
                background: rgba(var(--text-success-rgb), 0.05);
            }

            .yt-form-input.invalid {
                border-color: var(--text-error);
                background: rgba(var(--text-error-rgb), 0.05);
            }

            .yt-form-input.warning {
                border-color: var(--text-warning);
                background: rgba(var(--text-warning-rgb), 0.05);
            }

            /* Validation indicators */
            .yt-validation-indicator {
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                font-size: 12px;
                opacity: 0;
                transition: opacity 0.2s ease;
            }

            .yt-validation-indicator.show {
                opacity: 1;
            }

            .yt-validation-indicator.success {
                background: var(--text-success);
                color: white;
            }

            .yt-validation-indicator.error {
                background: var(--text-error);
                color: white;
            }

            .yt-validation-indicator.warning {
                background: var(--text-warning);
                color: white;
            }

            /* Validation messages */
            .yt-validation-message {
                margin-top: 4px;
                font-size: 12px;
                line-height: 1.4;
                opacity: 0;
                transform: translateY(-5px);
                transition: opacity 0.2s ease, transform 0.2s ease;
            }

            .yt-validation-message.show {
                opacity: 1;
                transform: translateY(0);
            }

            .yt-validation-message.error {
                color: var(--text-error);
            }

            .yt-validation-message.warning {
                color: var(--text-warning);
            }

            .yt-validation-message.success {
                color: var(--text-success);
            }

            /* Form field groups */
            .yt-form-group {
                margin-bottom: 20px;
            }

            .yt-form-group-title {
                font-weight: 600;
                margin-bottom: 12px;
                color: var(--text-normal);
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .yt-form-group-description {
                font-size: 12px;
                color: var(--text-muted);
                margin-bottom: 12px;
                line-height: 1.4;
            }

            /* Error summary */
            .yt-validation-summary {
                background: rgba(var(--text-error-rgb), 0.1);
                border: 1px solid var(--text-error);
                border-radius: 4px;
                padding: 12px;
                margin-bottom: 16px;
            }

            .yt-validation-summary-title {
                font-weight: 600;
                color: var(--text-error);
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .yt-validation-summary-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .yt-validation-summary-item {
                color: var(--text-error);
                font-size: 14px;
                margin-bottom: 4px;
                padding-left: 16px;
                position: relative;
            }

            .yt-validation-summary-item::before {
                content: '•';
                position: absolute;
                left: 4px;
            }

            /* Progress indicator */
            .yt-validation-progress {
                height: 2px;
                background: var(--background-modifier-border);
                border-radius: 1px;
                overflow: hidden;
                margin: 8px 0;
            }

            .yt-validation-progress-bar {
                height: 100%;
                background: var(--interactive-accent);
                border-radius: 1px;
                transition: width 0.3s ease;
            }

            /* Required field indicator */
            .yt-required-hint {
                font-size: 11px;
                color: var(--text-muted);
                margin-top: 4px;
            }

            /* Character counter */
            .yt-character-counter {
                font-size: 11px;
                color: var(--text-muted);
                text-align: right;
                margin-top: 2px;
                transition: color 0.2s ease;
            }

            .yt-character-counter.warning {
                color: var(--text-warning);
            }

            .yt-character-counter.error {
                color: var(--text-error);
            }

            /* Password strength indicator */
            .yt-password-strength {
                display: flex;
                gap: 4px;
                margin-top: 4px;
            }

            .yt-password-strength-bar {
                flex: 1;
                height: 3px;
                background: var(--background-modifier-border);
                border-radius: 1.5px;
                transition: background 0.2s ease;
            }

            .yt-password-strength-bar.active.weak {
                background: var(--text-error);
            }

            .yt-password-strength-bar.active.medium {
                background: var(--text-warning);
            }

            .yt-password-strength-bar.active.strong {
                background: var(--text-success);
            }

            /* Async validation loading */
            .yt-validation-loading {
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                width: 16px;
                height: 16px;
                opacity: 0;
                transition: opacity 0.2s ease;
            }

            .yt-validation-loading.show {
                opacity: 1;
            }

            .yt-validation-spinner {
                width: 100%;
                height: 100%;
                border: 2px solid var(--background-modifier-border);
                border-top: 2px solid var(--interactive-accent);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            /* Form submission states */
            .yt-form-submitting {
                position: relative;
                pointer-events: none;
                opacity: 0.7;
            }

            .yt-form-submitting::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 20px;
                height: 20px;
                border: 2px solid transparent;
                border-top: 2px solid var(--interactive-accent);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            /* Validation animations */
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }

            .yt-form-input.invalid {
                animation: shake 0.3s ease;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            /* Accessibility improvements */
            .yt-form-input[aria-invalid="true"] {
                border-color: var(--text-error);
            }

            .yt-form-input[aria-describedby] {
                border-color: var(--interactive-accent);
            }

            /* High contrast mode support */
            @media (prefers-contrast: high) {
                .yt-form-input {
                    border-width: 2px;
                }

                .yt-validation-message {
                    font-weight: 600;
                }
            }

            /* Reduced motion support */
            @media (prefers-reduced-motion: reduce) {
                .yt-form-input,
                .yt-validation-message,
                .yt-validation-indicator,
                .yt-validation-loading {
                    transition: none;
                }

                .yt-form-input.invalid {
                    animation: none;
                }

                .yt-validation-spinner {
                    animation: none;
                }
            }
        `;

        StyleManager.addClass('form-validation', {
            'root': validationCSS
        });
    }

    /**
     * Setup global validation handlers
     */
    private setupGlobalValidationHandlers(): void {
        // Handle form submission
        document.addEventListener('submit', async (e) => {
            const form = e.target as HTMLFormElement;
            if (form.classList.contains('yt-validate-form')) {
                e.preventDefault();
                await this.handleFormSubmission(form);
            }
        });

        // Handle field validation on blur
        document.addEventListener('blur', (e) => {
            const element = e.target as HTMLElement;
            if (element.classList.contains('yt-form-input')) {
                this.handleFieldValidation(element, 'blur');
            }
        }, true);

        // Handle field validation on input
        document.addEventListener('input', (e) => {
            const element = e.target as HTMLElement;
            if (element.classList.contains('yt-form-input')) {
                this.handleFieldValidation(element, 'input');
            }
        }, true);
    }

    /**
     * Register form for validation
     */
    registerForm(form: HTMLElement, fields: FormField[], submitHandler?: () => Promise<boolean>): void {
        this.forms.set(form, fields);

        if (submitHandler) {
            this.submitHandlers.set(form, submitHandler);
        }

        // Setup field elements
        fields.forEach(field => this.setupFieldElement(field));

        // Add form validation class
        form.classList.add('yt-validate-form');
    }

    /**
     * Setup individual field element
     */
    private setupFieldElement(field: FormField): void {
        const { element, name, rules, required } = field;

        // Add ARIA attributes
        element.setAttribute('aria-label', name);
        element.setAttribute('aria-required', String(required || false));

        // Create validation indicator
        const indicator = document.createElement('div');
        indicator.className = 'yt-validation-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        element.parentElement?.appendChild(indicator);

        // Create validation message container
        const messageContainer = document.createElement('div');
        messageContainer.className = 'yt-validation-message';
        messageContainer.setAttribute('aria-live', 'polite');
        messageContainer.setAttribute('aria-atomic', 'true');
        element.parentElement?.appendChild(messageContainer);

        // Set up field-specific validation
        this.setupFieldValidation(field);
    }

    /**
     * Setup field-specific validation logic
     */
    private setupFieldValidation(field: FormField): void {
        const { element, name, rules, debounceMs = 300 } = field;

        // Store field reference for validation
        (element as any).validationField = field;

        // Add change handler for immediate validation
        if (field.validateOnChange) {
            element.addEventListener('change', () => {
                this.validateField(name, element);
            });
        }

        // Add blur handler
        if (field.validateOnBlur !== false) {
            element.addEventListener('blur', () => {
                this.validateField(name, element);
            });
        }
    }

    /**
     * Handle field validation events
     */
    private async handleFieldValidation(element: HTMLElement, eventType: 'input' | 'blur'): Promise<void> {
        const field = (element as any).validationField as FormField;
        if (!field) return;

        // Skip input validation if not configured
        if (eventType === 'input' && !field.validateOnChange) return;

        // Debounce input validation
        if (eventType === 'input') {
            const timerId = this.debounceTimers.get(field.name);
            if (timerId) {
                clearTimeout(timerId);
            }

            const newTimerId = setTimeout(() => {
                this.validateField(field.name, element);
            }, field.debounceMs || 300);

            this.debounceTimers.set(field.name, newTimerId);
            return;
        }

        // Immediate validation for blur events
        await this.validateField(field.name, element);
    }

    /**
     * Validate individual field
     */
    async validateField(fieldName: string, element: HTMLElement): Promise<ValidationResult> {
        const field = (element as any).validationField as FormField;
        if (!field) {
            return { isValid: true, errors: [], warnings: [] };
        }

        const value = this.getFieldValue(element);
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // Show loading state for async validation
        this.showValidationLoading(element, true);

        try {
            // Check required field
            if (field.required && this.isEmpty(value)) {
                result.isValid = false;
                result.errors.push(`${field.name} is required`);
            }

            // Run validation rules
            for (const rule of field.rules) {
                if (!result.isValid && !rule.async) break; // Stop sync validation on first error

                try {
                    const isValid = rule.validate(value);
                    if (!isValid) {
                        result.isValid = false;
                        result.errors.push(rule.message);
                    }
                } catch (error) {
                    result.warnings.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            // Run custom validator
            if (field.customValidator) {
                const customResult = await field.customValidator(value);
                result.errors.push(...customResult.errors);
                result.warnings.push(...customResult.warnings);
                if (!customResult.isValid) {
                    result.isValid = false;
                }
            }

        } catch (error) {
            result.isValid = false;
            result.errors.push('Validation failed due to an error');
        } finally {
            // Hide loading state
            this.showValidationLoading(element, false);
        }

        // Store validation state
        this.validationStates.set(fieldName, result);

        // Update UI
        this.updateFieldUI(element, result);

        // Announce to screen readers
        if (result.errors.length > 0) {
            a11y.announce(`Validation error in ${field.name}: ${result.errors.join(', ')}`, 'assertive');
        }

        return result;
    }

    /**
     * Update field UI based on validation result
     */
    private updateFieldUI(element: HTMLElement, result: ValidationResult): void {
        const parent = element.parentElement;
        if (!parent) return;

        // Update input classes
        element.classList.remove('valid', 'invalid', 'warning');
        if (result.isValid) {
            element.classList.add('valid');
        } else {
            element.classList.add('invalid');
        }

        if (result.warnings.length > 0 && result.isValid) {
            element.classList.add('warning');
        }

        // Update ARIA attributes
        element.setAttribute('aria-invalid', String(!result.isValid));
        element.setAttribute('aria-describedby', element.getAttribute('aria-describedby') || '');

        // Update validation indicator
        const indicator = parent.querySelector('.yt-validation-indicator') as HTMLElement;
        if (indicator) {
            indicator.classList.remove('show', 'success', 'error', 'warning');

            if (result.isValid && result.warnings.length === 0) {
                indicator.classList.add('show', 'success');
                indicator.textContent = '✓';
            } else if (!result.isValid) {
                indicator.classList.add('show', 'error');
                indicator.textContent = '✗';
            } else if (result.warnings.length > 0) {
                indicator.classList.add('show', 'warning');
                indicator.textContent = '⚠';
            }
        }

        // Update validation message
        const messageContainer = parent.querySelector('.yt-validation-message') as HTMLElement;
        if (messageContainer) {
            messageContainer.classList.remove('show', 'error', 'warning', 'success');
            messageContainer.textContent = '';

            if (result.errors.length > 0) {
                messageContainer.classList.add('show', 'error');
                messageContainer.textContent = result.errors[0];
            } else if (result.warnings.length > 0) {
                messageContainer.classList.add('show', 'warning');
                messageContainer.textContent = result.warnings[0];
            } else if (result.isValid) {
                messageContainer.classList.add('show', 'success');
                messageContainer.textContent = 'Valid';
            }
        }
    }

    /**
     * Show/hide validation loading indicator
     */
    private showValidationLoading(element: HTMLElement, show: boolean): void {
        const parent = element.parentElement;
        if (!parent) return;

        let loadingIndicator = parent.querySelector('.yt-validation-loading') as HTMLElement;
        if (!loadingIndicator) {
            loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'yt-validation-loading';
            loadingIndicator.innerHTML = '<div class="yt-validation-spinner"></div>';
            parent.appendChild(loadingIndicator);
        }

        if (show) {
            loadingIndicator.classList.add('show');
        } else {
            loadingIndicator.classList.remove('show');
        }
    }

    /**
     * Handle form submission
     */
    private async handleFormSubmission(form: HTMLElement): Promise<void> {
        const fields = this.forms.get(form);
        if (!fields) return;

        // Validate all fields
        const results = await Promise.all(
            fields.map(field => this.validateField(field.name, field.element))
        );

        const isFormValid = results.every(result => result.isValid);

        if (isFormValid) {
            // Show submitting state
            form.classList.add('yt-form-submitting');

            try {
                const submitHandler = this.submitHandlers.get(form);
                if (submitHandler) {
                    const success = await submitHandler();
                    if (!success) {
                        this.showFormError(form, 'Form submission failed');
                    }
                }
            } catch (error) {
                this.showFormError(form, error instanceof Error ? error.message : 'Unknown error');
            } finally {
                // Remove submitting state
                form.classList.remove('yt-form-submitting');
            }
        } else {
            // Show validation summary
            this.showValidationSummary(form, results);
            this.focusFirstError(fields, results);
        }
    }

    /**
     * Show form validation summary
     */
    private showValidationSummary(form: HTMLElement, results: ValidationResult[]): void {
        // Remove existing summary
        const existingSummary = form.querySelector('.yt-validation-summary');
        if (existingSummary) {
            existingSummary.remove();
        }

        // Collect all errors
        const allErrors: string[] = [];
        results.forEach((result, index) => {
            result.errors.forEach(error => {
                allErrors.push(error);
            });
        });

        if (allErrors.length === 0) return;

        // Create summary element
        const summary = document.createElement('div');
        summary.className = 'yt-validation-summary';
        summary.setAttribute('role', 'alert');
        summary.innerHTML = `
            <div class="yt-validation-summary-title">
                <span>⚠️</span>
                <span>Please correct the following errors:</span>
            </div>
            <ul class="yt-validation-summary-list">
                ${allErrors.map(error => `<li class="yt-validation-summary-item">${error}</li>`).join('')}
            </ul>
        `;

        // Insert at the top of the form
        form.insertBefore(summary, form.firstChild);

        // Announce to screen readers
        a11y.announce(`Form has ${allErrors.length} validation errors`, 'assertive');
    }

    /**
     * Focus first field with error
     */
    private focusFirstError(fields: FormField[], results: ValidationResult[]): void {
        const errorIndex = results.findIndex(result => !result.isValid);
        if (errorIndex !== -1 && fields[errorIndex]) {
            fields[errorIndex].element.focus();
        }
    }

    /**
     * Show form error
     */
    private showFormError(form: HTMLElement, message: string): void {
        // Remove existing error
        const existingError = form.querySelector('.yt-form-error');
        if (existingError) {
            existingError.remove();
        }

        // Create error element
        const error = document.createElement('div');
        error.className = 'yt-validation-summary';
        error.setAttribute('role', 'alert');
        error.innerHTML = `
            <div class="yt-validation-summary-title">
                <span>❌</span>
                <span>Error:</span>
            </div>
            <div>${message}</div>
        `;

        // Insert at the top of the form
        form.insertBefore(error, form.firstChild);

        // Announce to screen readers
        a11y.announce(`Form error: ${message}`, 'assertive');
    }

    /**
     * Get field value
     */
    private getFieldValue(element: HTMLElement): any {
        if (element instanceof HTMLInputElement) {
            switch (element.type) {
                case 'checkbox':
                    return element.checked;
                case 'number':
                    return element.valueAsNumber;
                case 'date':
                    return element.valueAsDate;
                default:
                    return element.value;
            }
        } else if (element instanceof HTMLTextAreaElement) {
            return element.value;
        } else if (element instanceof HTMLSelectElement) {
            return element.value;
        } else {
            return (element as any).value || '';
        }
    }

    /**
     * Check if value is empty
     */
    private isEmpty(value: any): boolean {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim() === '';
        if (typeof value === 'boolean') return false;
        return false;
    }

    /**
     * Clear validation for form
     */
    clearFormValidation(form: HTMLElement): void {
        const fields = this.forms.get(form);
        if (!fields) return;

        fields.forEach(field => {
            this.clearFieldValidation(field.element);
        });

        // Remove validation summary
        const summary = form.querySelector('.yt-validation-summary');
        if (summary) {
            summary.remove();
        }

        // Clear validation states
        this.validationStates.clear();
    }

    /**
     * Clear validation for field
     */
    private clearFieldValidation(element: HTMLElement): void {
        const parent = element.parentElement;
        if (!parent) return;

        // Remove validation classes
        element.classList.remove('valid', 'invalid', 'warning');

        // Remove ARIA attributes
        element.removeAttribute('aria-invalid');
        element.removeAttribute('aria-describedby');

        // Hide validation indicator
        const indicator = parent.querySelector('.yt-validation-indicator');
        if (indicator) {
            indicator.classList.remove('show');
        }

        // Hide validation message
        const messageContainer = parent.querySelector('.yt-validation-message');
        if (messageContainer) {
            messageContainer.classList.remove('show');
            messageContainer.textContent = '';
        }

        // Hide loading indicator
        const loadingIndicator = parent.querySelector('.yt-validation-loading');
        if (loadingIndicator) {
            loadingIndicator.classList.remove('show');
        }
    }

    /**
     * Unregister form
     */
    unregisterForm(form: HTMLElement): void {
        this.clearFormValidation(form);
        this.forms.delete(form);
        this.submitHandlers.delete(form);
        form.classList.remove('yt-validate-form');
    }

    /**
     * Get validation state for field
     */
    getValidationState(fieldName: string): ValidationResult | undefined {
        return this.validationStates.get(fieldName);
    }

    /**
     * Check if form is valid
     */
    isFormValid(form: HTMLElement): boolean {
        const fields = this.forms.get(form);
        if (!fields) return true;

        return fields.every(field => {
            const state = this.validationStates.get(field.name);
            return state?.isValid !== false;
        });
    }

    /**
     * Create built-in validation rules
     */
    static createRules() {
        return {
            required: (message?: string): ValidationRule => ({
                name: 'required',
                validate: (value: any) => value !== null && value !== undefined && value !== '',
                message: message || 'This field is required'
            }),

            minLength: (min: number, message?: string): ValidationRule => ({
                name: 'minLength',
                validate: (value: any) => !value || value.length >= min,
                message: message || `Must be at least ${min} characters`
            }),

            maxLength: (max: number, message?: string): ValidationRule => ({
                name: 'maxLength',
                validate: (value: any) => !value || value.length <= max,
                message: message || `Must be no more than ${max} characters`
            }),

            email: (message?: string): ValidationRule => ({
                name: 'email',
                validate: (value: any) => {
                    if (!value) return true; // Optional field
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    return emailRegex.test(value);
                },
                message: message || 'Must be a valid email address'
            }),

            url: (message?: string): ValidationRule => ({
                name: 'url',
                validate: (value: any) => {
                    if (!value) return true; // Optional field
                    try {
                        new URL(value);
                        return true;
                    } catch {
                        return false;
                    }
                },
                message: message || 'Must be a valid URL'
            }),

            pattern: (regex: RegExp, message?: string): ValidationRule => ({
                name: 'pattern',
                validate: (value: any) => !value || regex.test(value),
                message: message || 'Invalid format'
            }),

            min: (min: number, message?: string): ValidationRule => ({
                name: 'min',
                validate: (value: any) => !value || Number(value) >= min,
                message: message || `Must be at least ${min}`
            }),

            max: (max: number, message?: string): ValidationRule => ({
                name: 'max',
                validate: (value: any) => !value || Number(value) <= max,
                message: message || `Must be no more than ${max}`
            }),

            async: (validator: (value: any) => Promise<boolean>, message: string): ValidationRule => ({
                name: 'async',
                validate: async (value: any) => {
                    try {
                        return await validator(value);
                    } catch {
                        return false;
                    }
                },
                message,
                async: true
            })
        };
    }
}

// Export singleton instance
export const formValidationManager = FormValidationManager.getInstance();

// Export utility functions
export const formValidation = {
    registerForm: (form: HTMLElement, fields: FormField[], submitHandler?: () => Promise<boolean>) =>
        formValidationManager.registerForm(form, fields, submitHandler),
    unregisterForm: (form: HTMLElement) => formValidationManager.unregisterForm(form),
    clearForm: (form: HTMLElement) => formValidationManager.clearFormValidation(form),
    validateField: (fieldName: string, element: HTMLElement) => formValidationManager.validateField(fieldName, element),
    getValidationState: (fieldName: string) => formValidationManager.getValidationState(fieldName),
    isFormValid: (form: HTMLElement) => formValidationManager.isFormValid(form),
    createRules: () => FormValidationManager.createRules()
};