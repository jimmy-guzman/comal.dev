# Design principles

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
