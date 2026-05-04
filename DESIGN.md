# Design principles

## Text casing

Three tiers, each with a distinct role:

**UPPERCASE** for structural section labels. These are static, non-sentence strings that orient the user within a layout — `h1`–`h4` section labels, sidebar group labels, named section spans (e.g. `INSTRUCTIONS`, `TOOLS`).

**Sentence case** for contextual headings and body content. Contextual headings are titles that read as natural language or reference dynamic content — `CardTitle`, `AlertDialogTitle`, `ConversationEmptyState` title, `DialogTitle`. Body content is any descriptive prose — `CardDescription`, `AlertDialogDescription`, `p`, `ItemDescription`, `AlertDescription`.

**lowercase** for UI elements. Everything a user acts on or reads as a control — buttons, labels, placeholders, badges, nav items, tooltips, `aria-label`, `FieldLabel`, `FieldDescription`, `CommandEmpty`, dropdown items, status labels, toast messages, validation errors.

Proper nouns (e.g. GitHub) keep their standard casing at every tier.

## Icons

Default to text. Use an icon only when the symbol is universally understood without a label (e.g. a close `x`) or when space genuinely rules a label out.

Do not pair an icon with a label that says the same thing. Do not use icons for decoration. Both patterns add visual noise without adding information.

Any icon without a visible label needs an accessible name via `aria-label` or `title`.
