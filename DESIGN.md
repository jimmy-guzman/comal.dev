# Design principles

## Text casing

Three tiers, each with a distinct role:

**UPPERCASE** for structural section labels. These are static, non-sentence strings that orient the user within a layout — `h1`–`h4` section labels, sidebar group labels, named section spans (e.g. `INSTRUCTIONS`, `TOOLS`).

**Sentence case** for contextual headings and body content. Contextual headings are titles that read as natural language or reference dynamic content — `CardTitle`, `AlertDialogTitle`, `ConversationEmptyState` title, `DialogTitle`. Body content is any descriptive prose — `CardDescription`, `AlertDialogDescription`, `p`, `ItemDescription`, `AlertDescription`.

**lowercase** for UI elements. Everything a user acts on or reads as a control — buttons, labels, placeholders, badges, nav items, tooltips, `aria-label`, `FieldLabel`, `FieldDescription`, `CommandEmpty`, dropdown items, status labels, toast messages, validation errors.

Proper nouns (e.g. GitHub) keep their standard casing at every tier.

## Icons

Use text labels for actions, navigation, and status. Icons should only appear when they add meaning that text cannot.

An icon paired with a label that says the same thing wastes space. Icons without labels make users guess. When icons are rare, the ones that do appear actually mean something.

### When to use an icon

- It is universally understood on its own (e.g. a close `x`)
- Space genuinely rules out a label

### When not to use an icon

- There is already a text label that describes the action
- You are using it for decoration

Any icon used without a visible label needs an accessible name via `aria-label` or `title`.

If there is doubt, use text.
