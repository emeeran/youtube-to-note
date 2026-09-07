/**
 * Semantic CSS class names for the shared modal family (BaseModal and friends).
 *
 * Appearance lives entirely in `styles.css` (Obsidian guideline: build with
 * `createEl({ cls })` and let the stylesheet style it — never write `style=`
 * attributes for static presentation). This constant is the single source of
 * truth for those class names so `src/dom.ts` and `BaseModal` cannot drift.
 *
 * Colors are theme-owned: the header previously hardcoded `#ffa500` here and is
 * now driven by Obsidian's `--text-accent` in `styles.css`.
 */
export const MODAL_CSS_CLASSES = {
    /** Obsidian `.modal` element — `display`/`z-index` are set by `.ytc-modal` in styles.css. */
    modal: 'ytc-modal',
    /** Modal heading (`<h2>`). */
    header: 'ytc-modal-header',
    /** Modal body copy (`<p>`). */
    message: 'ytc-modal-message',
    /** Obsidian `.modal-content` element. */
    content: 'ytc-modal-content',
    /** Right-aligned flex row holding a modal's action buttons. */
    buttonContainer: 'ytc-modal-button-container',
    /** A single action button (`mod-cta` is layered on top for primary buttons). */
    button: 'ytc-modal-button',
    /** A single-line text input. */
    input: 'ytc-modal-input',
} as const;
