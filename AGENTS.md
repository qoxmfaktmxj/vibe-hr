# VIBE-HR AGENT RULES

## Mandatory pre-check before AG Grid work
When creating or modifying AG Grid screens, ALWAYS read in this exact order:
1. `config/grid-screens.json`
2. `docs/GRID_SCREEN_STANDARD.md`
3. `docs/AG_GRID_COMMON_GUIDE.md`
4. Target screen page/component files

## Hard requirement for all AG Grid screens
If a target screen uses `AgGridReact`, contributors MUST:
- follow `docs/AG_GRID_COMMON_GUIDE.md` without exception
- use shared modules from:
  - `frontend/src/components/grid/*`
  - `frontend/src/lib/grid/*`
- keep the standard toolbar order
- declare `GRID_SCREEN` metadata in page file
- register/update entry in `config/grid-screens.json`
- run `npm run validate:grid` before lint/build

## Standard toolbar order
`query -> create -> copy -> template -> upload -> save -> download`

