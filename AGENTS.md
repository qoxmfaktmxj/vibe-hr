# VIBE-HR AGENT RULES

## Mandatory pre-check before AG Grid work
When creating or modifying AG Grid screens, ALWAYS read in this order:
1. `config/grid-screens.json`
2. `docs/GRID_SCREEN_STANDARD.md`
3. Target screen page/component files

If the target is AG Grid-based, you MUST:
- keep the standard toolbar order
- declare `GRID_SCREEN` metadata in page file
- register/update entry in `config/grid-screens.json`
- run `npm run validate:grid` before lint/build

## Standard toolbar order
조회 → 입력 → 복사 → 양식다운로드 → 업로드 → 저장 → 다운로드
