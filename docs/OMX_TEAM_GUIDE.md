# VIBE-HR OMX Team Guide

## 목적
팀원이 동일한 OMX/Codex 개발 환경에서 VIBE-HR을 작업하도록 표준 절차를 정의한다.

---

## 1) 공통 전제
- OS: macOS / Linux / Windows(WSL 권장)
- Node.js: **22.x 이상**
- Git 최신 상태
- Codex + OMX 버전 고정(아래 명령 사용)

---

## 2) 1회 설치 (글로벌)

```bash
npm i -g @openai/codex@0.114.0 oh-my-codex@0.8.12
codex --version
omx --version
```

버전이 다르면 팀 리드와 먼저 맞춘다.

---

## 3) 레포 최초 세팅 (프로젝트 단위)

```bash
git fetch --all --prune
git checkout main
git pull --ff-only origin main

# repo root: vibe-hr
omx setup --scope project --dry-run
omx setup --scope project
omx doctor
omx doctor --team
```

정상 기준:
- `omx doctor`: All checks passed
- `omx doctor --team`: no issues

---

## 4) 생성/동작 구조 이해
`omx setup --scope project` 실행 시 로컬에 아래가 생성된다.

- `.codex/` : Codex 설정/프롬프트
- `.agents/` : OMX skills
- `.omx/` : 런타임 상태/에이전트 정의/플랜/로그

> 이 디렉터리들은 로컬 런타임 산출물이며 `.gitignore`로 버전관리 제외된다.

---

## 5) AGENTS.md 운영 규칙 (중요)
현재 AGENTS.md는 아래 2개를 동시에 가진다.

1. OMX 오케스트레이션 규칙(팀/키워드/워크플로)
2. VIBE-HR 프로젝트 수동 규칙 (`<!-- OMX:AGENTS-MANUAL:START --> ...`)

수동 규칙에는 반드시 아래가 포함되어야 한다.
- AG Grid 선행 읽기 순서
- 표준 toolbar 순서
- `validate:grid` 선실행
- FE/BE 계약 동시 확인
- `MENU_ACTION_PERMISSION_PLAN.md` 정합성 확인

---

## 6) 일일 작업 시작 루틴 (팀 공통)

```bash
git fetch --all --prune
git checkout main
git pull --ff-only origin main
omx doctor
```

작업 후 최소 검증:
- AG Grid 화면 변경: `cd frontend && npm run validate:grid && npm run lint && npm run build`
- Backend 변경: 해당 FastAPI 테스트 또는 서비스 기동 검증

---

## 7) 권장 실행 흐름
- 큰 작업: `architect -> planner -> executor -> verifier`
- Team 실행은 범위/수용기준/영향파일 확정 후 시작
- 항상 vertical slice 단위(화면+API+QA+docs)로 진행

---

## 8) 문제 발생 시 체크
1. `omx doctor` / `omx doctor --team`
2. Node 버전 확인 (`node -v`)
3. OMX/Codex 버전 확인
4. AGENTS.md 수동 블록 누락 여부 확인
5. 필요시 재적용:

```bash
omx setup --scope project
omx doctor
```

---

## 9) 절대 금지
- AG Grid 규칙 무시한 화면 커스텀 구현
- `validate:grid` 생략 후 PR
- FE/BE 계약 변경 단독 반영
- 대규모 무분별 리라이트(도메인 slice 없이)
