# Visual Prototypes

Throwaway HTML mocks used to review and compare visual styling **before**
touching `extension/`. Built and reviewed via the `skills/visual-prototype/`
skill (headless Chrome screenshots + pixel checks).

Rules:

- One self-contained `.html` per comparison sheet (inline styles, no external
  assets, system fonts only).
- Copy real tokens from `extension/popup.html` / `theme-data.js` / `aero.css`
  — never improvise colors.
- These are working artifacts: safe to delete once a variant is chosen and
  shipped. Commit them only when a prototype round is worth keeping as
  reference.
