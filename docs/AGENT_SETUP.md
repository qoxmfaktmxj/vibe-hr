# 에이전트 오케스트레이션 셋업 가이드

> Vibe-HR은 **Codex CLI (OMX)** 와 **Claude Code (OMC)** 두 플랫폼에서
> 멀티에이전트 오케스트레이션을 지원합니다.

---

## 🔷 Claude Code — oh-my-claudecode (OMC)

### 빠른 시작

```bash
# 1. OMC CLI 도구 설치
npm i -g oh-my-claude-sisyphus@latest

# 2. 에이전트/스킬/HUD 설치 (전역 ~/.claude/)
omc install

# 3. Claude Code 시작 후 프로젝트 설정
claude
# Claude Code 세션 안에서:
/omc-default          # 프로젝트 레벨 설정
```

### 설치 구조 (전역)

OMC는 OMX와 달리 **전역 설치** 방식입니다. `~/.claude/`에 설치되어 모든 프로젝트에서 사용 가능합니다.

```
~/.claude/
├── CLAUDE.md            # OMC 오케스트레이션 규칙 (자동 생성)
├── agents/              # 19개 에이전트 정의
│   ├── architect.md     # 아키텍처 분석 (Opus)
│   ├── executor.md      # 코드 구현 (Sonnet)
│   ├── explore.md       # 코드 탐색 (Haiku)
│   ├── planner.md       # 작업 계획 (Opus)
│   ├── verifier.md      # 검증 (Sonnet)
│   └── ...
├── hud/                 # HUD 상태 표시
│   └── omc-hud.mjs
└── settings.json        # 설정 (hooks, HUD, permissions)
```

### 모델 라우팅

| 티어 | 모델 | 용도 |
|------|------|------|
| LOW | Haiku | 빠른 탐색, 간단한 질의 |
| MEDIUM | Sonnet | 표준 구현, 디버깅, 테스트 |
| HIGH | Opus | 아키텍처, 심층 분석, 보안 리뷰 |

> Max 구독자는 전부 Opus로 통일해도 됩니다.

### 주요 명령어 (Claude Code 세션 내)

| 명령 | 효과 |
|------|------|
| `ralph 끝까지 완성해줘` | 끈기 루프 — 완료까지 반복 |
| `autopilot 기능 빌드해줘` | 자율 파이프라인 (계획→구현→검증) |
| `/team 3:executor "TS에러 수정"` | 팀 모드 — 3명 병렬 워커 |
| `ulw 전체 리팩토링` | 최대 병렬 실행 |
| `ccg 이 설계 검토해줘` | 크로스 프로바이더 (Claude+Codex+Gemini) |
| `deep interview` | 소크라테스식 요구사항 인터뷰 |
| `cancelomc` | 활성 모드 취소 |

### 팀 모드 (tmux 필요)

```bash
# 셸에서 팀 관리
omc team 3:executor "TS 에러 전부 수정"
omc team status
omc team shutdown

# Claude Code 세션 내에서
/team 2:executor "FE+BE 동시 작업"
```

> ⚠️ Windows에서는 WSL2 + tmux 또는 `psmux` 필요

---

## 🟧 Codex CLI — oh-my-codex (OMX)

### 빠른 시작

```bash
# 1. OMX 설치
npm install -g oh-my-codex

# 2. 프로젝트 셋업 (MCP 경로 자동 갱신)
cd vibe-hr
omx setup --scope project

# 3. 설치 확인
omx doctor
```

### 설치 구조 (프로젝트 스코프, 레포에 포함)

```
.codex/
├── config.toml          # 모델, MCP, 기능 플래그
├── prompts/             # 20개 역할 프롬프트
├── skills/              # 24+4 스킬 (OMX 내장 + Vibe-HR 전용)
│   ├── vibe-validate/   # [VH] 전체 검증 파이프라인
│   ├── vibe-payroll/    # [VH] 급여 안전 가드 (R3)
│   ├── vibe-grid/       # [VH] AG Grid 표준 가드 (R2)
│   └── vibe-permission/ # [VH] 권한 안전 가드 (R2)
└── agents/              # 20개 서브에이전트 TOML

AGENTS.md                # OMX 오케스트레이션 브레인 (프로젝트 루트)
```

### 모델 라우팅

| 역할 | 모델 |
|------|------|
| 전체 통일 | `gpt-5.4` (Pro 구독) |

### 주요 명령어 (Codex 세션 내)

| 명령 | 효과 |
|------|------|
| `$ralph 끝까지 완성해줘` | 끈기 루프 |
| `$autopilot 기능 빌드` | 자율 파이프라인 |
| `$team FE+BE 동시 작업` | 팀 모드 |
| `$vibe-validate` | 전체 검증 (pytest→grid→lint→tsc→build) |
| `$vibe-payroll 급여 수정` | R3 급여 안전 가드 |
| `/prompts:architect` | 아키텍처 역할 호출 |

---

## 🔀 OMC vs OMX 비교

| 항목 | OMC (Claude Code) | OMX (Codex CLI) |
|------|:---:|:---:|
| 설치 방식 | 전역 (`~/.claude/`) | 프로젝트 (`.codex/`) |
| 에이전트 수 | 19개 | 20개 |
| 스킬 수 | 40+ | 24+4 |
| 팀 모드 | ✅ (tmux) | ✅ (tmux) |
| 크로스 프로바이더 | ✅ (Claude+Codex+Gemini) | ❌ |
| MCP 서버 | ✅ | ✅ (5개) |
| 모델 라우팅 | Haiku/Sonnet/Opus | 통일(gpt-5.4) |
| 레포 포함 | ❌ (전역 설치) | ✅ (프로젝트 커밋) |
| pull 후 필요 작업 | `omc install` | `omx setup --scope project` |

---

## Vibe-HR 전용 스킬 (Codex OMX)

| 키워드 | 설명 |
|--------|------|
| `$vibe-validate` / `전체검증` | pytest → grid validate → lint → tsc → build |
| `$vibe-payroll` / `급여변경` | R3 급여 코드 안전 가드 |
| `$vibe-grid` / `그리드수정` | R2 AG Grid 표준 가드 |
| `$vibe-permission` / `권한변경` | R2 메뉴/액션 권한 가드 |
