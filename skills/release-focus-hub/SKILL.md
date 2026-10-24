---
name: release-focus-hub
description: "Use when the user asks to release, publish, bump the version, create a new version, or make a release zip for the Focus Hub Chrome extension. Triggers on: release / publish / bump version / new version / create zip / save & push / prepare a release."
---

# Release & Publish Focus Hub

Drive a Focus Hub release end-to-end. The extension is a Chrome MV3 add-on
(vanilla JS, no bundler) whose full source lives in `extension/`. This is the
only blessed path to ship a new version — follow the steps in order.

## 0. Read current state first

- Current version: `manifest.json` → `"version": "x.y.z"`.
- Latest release zip name in `versions/` (e.g. `focus_hub_v_0_1_3.zip`).
- Repo: `git@github.com:sergey-byk0v/focus_hub.git`, branch `main`.
- Check `git status` for uncommitted work **before** bumping.

## 1. Decide the version bump — confirm with user

- **Minor** bump (`X` in `0_X_Y`) — new features (e.g. Focus Music, launch-on-start).
- **Patch** bump (`Y`) — bug fixes (e.g. the re-block-after-reason fix).
Say which one you're doing and confirm before proceeding. Patch/list examples:

| Change type                | Example version |
|----------------------------|-----------------|
| Next patch after v_0_1_3   | v_0_1_4         |
| Next minor after v_0_1_3   | v_0_2_0         |

## 2. Bump version

- Edit `"version"` in `extension/manifest.json`.
- Edit the `Current: \`x.y.z\`` line in `AGENTS.md` to match.

## 3. Commit code BEFORE the zip (mandatory)

```sh
git add extension/ AGENTS.md
git commit -m "Brief description of changes"
git push
```

Only stage intended files. Check `git status` first; do **not** sweep in
unrelated edits (e.g. `.gitignore` changes) unless asked.

## 4. Create the release zip

Zip the entire `extension/` folder into `versions/`, using the next name in
the sequence (past versions: `focus_hub_v_0_1_0 … v_0_1_3`):

```sh
python3 -c "import shutil; shutil.make_archive('versions/focus_hub_v_0_1_4', 'zip', 'extension')"
```

Name follows `focus_hub_v_0_X_Y.zip` where minor features bump `X`, patches bump `Y`.

## 5. Commit the zip + AGENTS.md, then push

```sh
git add versions/ AGENTS.md
git commit -m "Release v_0_X_Y"
git push
```

## 6. Verify + remind to test

- Confirm the zip file exists (`ls -lh versions/focus_hub_v_0_X_Y.zip`).
- Confirm `git status` is clean.
- Remind the user to test in Chrome (load unpacked) before distributing the
  zip: `chrome://extensions/` → Developer Mode → "Load unpacked" → `extension/`.

## Hard rules

- **Always commit the extension code before creating the zip** — never zip
  uncommitted source.
- `versions/` is version-controlled — release zips are tracked, so commit them.
- Update `AGENTS.md` `Current:` version before committing.
- Don't commit secrets, unrelated config churn, or the untracked `slides/`
  directory or `.superpowers/`.

## Storage of this skill

This is a **project** skill — it lives at `.opencode/skill/release-focus-hub/`
and only surfaces inside the Focus Hub repo. It is NOT committed to the
extension source; it's local opencode config for this project.
