# Front-end Design Skills

Vendored design/UI skills for agent-assisted front-end work on Focus Hub
(popup, block page, planner). Each subfolder is a self-contained skill
(`SKILL.md` + optional `LICENSE`/`references/`).

## Source

Upstream: [`nexu-io/open-design`](https://github.com/nexu-io/open-design) (`skills/`),
Apache-2.0 unless a folder ships its own license file (kept alongside):

| Skill | Purpose |
|---|---|
| `frontend-design` | Production-grade interface design; self-contained HTML/CSS/JS output |
| `redesign-skill` | Premium upgrade of existing UI; explicitly supports vanilla CSS |
| `impeccable-design-polish` | Post-build audit: hierarchy, anti-AI-slop, motion, a11y hardening |
| `web-design-guidelines` | Vercel review checklist (layout/type/color/motion/a11y) |
| `emil-design-eng` / `emilkowalski-motion` | Motion & micro-interaction taste with reduced-motion fallbacks |
| `minimalist-skill` | Clean editorial look (Linear-style) |
| `taste-skill` | Anti-slop premium landing/interface direction |
| `color-expert` | OKLCH palette science + contrast/accessibility checks |
| `theme-factory` | 10 preset font/color themes to remix into `THEMES[]` |
| `design-md` | `DESIGN.md` token/visual-rule source of truth |
| `ui-skills` | Opinionated constraints for coherent small UI surfaces |

## Notes

- Auto-discovered by DSH via the `<projectRoot>/.agents/skills` root — no
  manifest registration needed; new/changed skills reach the catalog without
  a restart.
- Repo-scoped only: skills do **not** ship in the release zip (`versions/`
  zips `extension/` only).
