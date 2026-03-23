# Codex CLI + OMX 셋업 가이드

> 이 프로젝트는 [oh-my-codex (OMX)](https://github.com/Yeachan-Heo/oh-my-codex)로
> 멀티에이전트 오케스트레이션을 지원합니다.

## 빠른 시작 (새 머신에서 pull 후)

```bash
# 1. OMX 설치
npm install -g oh-my-codex

# 2. 프로젝트에 OMX 셋업 (MCP 경로 등 머신별 설정 자동 갱신)
cd vibe-hr
omx setup --scope project

# 3. 설치 확인
omx doctor
```

> `omx setup`은 `.codex/config.toml`의 MCP 서버 경로를 현재 머신에 맞게 갱신합니다.
> 프롬프트, 스킬, 에이전트 설정은 이미 레포에 포함되어 있어 보존됩니다.

## 구조

```
.codex/
├── config.toml          # Codex CLI 설정 (모델, MCP, 기능 플래그)
├── prompts/             # 20개 역할 프롬프트 (architect, executor, ...)
├── skills/              # 24+4 스킬 (OMX 내장 + Vibe-HR 전용)
│   ├── ralph/           # 끈기 루프
│   ├── autopilot/       # 자율 파이프라인
│   ├── team/            # 멀티에이전트 팀 모드
│   ├── vibe-validate/   # [VH] 전체 검증 파이프라인
│   ├── vibe-payroll/    # [VH] 급여 안전 가드 (R3)
│   ├── vibe-grid/       # [VH] AG Grid 표준 가드 (R2)
│   └── vibe-permission/ # [VH] 권한 안전 가드 (R2)
└── agents/              # 20개 서브에이전트 TOML 설정

.omx/
├── hud-config.json      # HUD 표시 설정
├── setup-scope.json     # setup scope 기록
├── state/               # (런타임, gitignored)
├── logs/                # (런타임, gitignored)
└── plans/               # (런타임, gitignored)
```

## 모델 라우팅

| 역할 | 모델 | 용도 |
|------|------|------|
| Frontier (리더) | `gpt-5.3-codex` | 설계, 조율, 고난도 추론 |
| Spark (탐색/경량) | `gpt-5.3-codex-spark` | 파일 탐색, 빠른 분류 |
| Standard (서브에이전트) | `gpt-5.3-codex` | 구현, 디버깅, 테스트 |

## Vibe-HR 전용 스킬

| 키워드 | 스킬 | 설명 |
|--------|------|------|
| `$vibe-validate` / `전체검증` | vibe-validate | pytest → grid validate → lint → tsc → build |
| `$vibe-payroll` / `급여변경` | vibe-payroll | R3 급여 코드 안전 가드 |
| `$vibe-grid` / `그리드수정` | vibe-grid | R2 AG Grid 표준 가드 |
| `$vibe-permission` / `권한변경` | vibe-permission | R2 메뉴/액션 권한 가드 |

## 사용법

```
# Codex CLI에서 스킬 호출
$ralph 이 기능 끝까지 완성해줘
$autopilot 로그인 페이지 만들어줘
$team 프론트엔드와 백엔드 동시에 작업해줘
$vibe-validate
$vibe-payroll 야간수당 계산 로직 수정

# 역할 프롬프트 호출
/prompts:architect 시스템 설계 검토
/prompts:executor 코드 구현
/prompts:verifier 검증
```

## 팀 모드

```bash
# 팀 상태 확인
omx team status

# 팀 시작 (Codex 세션 내에서)
$team 프론트엔드 직원 목록 + 백엔드 API 동시 작업
```

팀 모드는 tmux 기반으로 여러 Codex 워커를 git worktree에서 병렬 실행합니다.
