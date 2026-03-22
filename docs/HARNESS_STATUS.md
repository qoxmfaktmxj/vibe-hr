Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: 2026-03-22
Confidence: Medium

# HARNESS_STATUS.md

## 목적
Vibe-HR의 Agentic Harness Layer 1~6 진행 상태와 남은 보강 포인트를 한눈에 점검하기 위한 상태판이다. 이 문서는 각 Layer의 완료 정의와 현재 상태를 연결한다.

## 현재 요약
- Layer 1: 완료
- Layer 2: 완료
- Layer 3: 완료(핵심 canonical docs + support docs 기준)
- Layer 4: 완료(실사용 adapter + warning guardrails 기준)
- Layer 5: 완료(실행 규약 문서 + 실제 pilot 실행/ledger 사용 기준)
- Layer 6: 준비 완료 / 운영 대기 (평가 문서와 기준은 완료, 반복 task 데이터 축적 중)

## Layer 1 — Bootstrap
### 목적
프로젝트 진단과 하네스 설계 출발점 확보

### 완료 기준
- Discovery Packet 존재
- 프로젝트 유형, 리스크, 범위, 미해결점 정리

### 현재 상태
- 상태: 완료
- 근거 문서:
  - `docs/harness/DISCOVERY_PACKET.md`
  - `docs/에이전트시스템설명/01_BOOTSTRAP_PROMPT.md`

## Layer 2 — Governance
### 목적
승인 정책, 위험도, 자동화 경계, 운영 모드 정의

### 완료 기준
- governance scope 확정
- approval matrix 존재
- quality score 해석 기준 존재
- canonical source map 존재

### 현재 상태
- 상태: 완료
- 근거 문서:
  - `docs/GOVERNANCE.md`
  - `docs/QUALITY_SCORE.md`
  - `docs/SECURITY.md`
  - `docs/OBSERVABILITY.md`
  - `docs/에이전트시스템설명/02_GOVERNANCE_SPEC.md`

## Layer 3 — Artifacts
### 목적
실제 repo에 넣을 canonical docs와 skeleton 정리

### 완료 기준
- 핵심 canonical docs 존재
- 메타데이터 규칙 적용
- projection과 canonical 구분됨

### 현재 상태
- 상태: 완료
- 핵심 문서:
  - `docs/ARCHITECTURE.md`
  - `docs/TEST_STRATEGY.md`
  - `docs/TASK_LEDGER.md`
  - `docs/EXECUTION_PROTOCOL.md`
  - `docs/evals/EVAL_SUMMARY.md`
- support 문서:
  - `docs/QUALITY_SCORE.md`
  - `docs/SECURITY.md`
  - `docs/OBSERVABILITY.md`
  - `docs/SUB_AGENTS.md`
  - `docs/SKILLS_INDEX.md`
  - `docs/exec-plans/active/harness-bootstrap.md`

## Layer 4 — Tool Adapters
### 목적
canonical 규칙을 실제 도구/adapter/enforcement로 투영

### 완료 기준
- Codex/OMX surface 존재
- Claude projection 존재
- changed-path guardrail 존재
- CI/workflow gate 존재
- warning/hard-gate 정책 결정됨

### 현재 상태
- 상태: 완료
- 근거:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `scripts/check-risk-paths.py`
  - `.github/workflows/guardrails.yml`
- 운영 결정:
  - guardrails는 현재 warning-oriented
  - 자동 deploy는 비활성화, 수동 dispatch만 사용

## Layer 5 — Execution Protocol
### 목적
실행 입력 계약, 분해 기준, 검증 루프, 실패 처리, completion evidence 규약 제공

### 완료 기준
- 실행 규약 문서 존재
- execution plan 사용 중
- task ledger에 실제 실행 기록 존재
- 실패 유형이 기록됨

### 현재 상태
- 상태: 완료
- 근거:
  - `docs/EXECUTION_PROTOCOL.md`
  - `docs/exec-plans/active/menu-action-permission-pilot-v0.1.md`
  - `docs/TASK_LEDGER.md`
- 최근 실제 적용:
  - 메뉴 액션 권한 pilot
  - backend boot blocker 복구
  - frontend/manual deploy 경로 조정

## Layer 6 — Eval Harness
### 목적
반복 작업 로그를 기반으로 운영 판단과 정책 조정 근거 제공

### 완료 기준
- eval summary 문서 존재
- ledger를 data source로 사용
- segmentation/metric/policy adjustment 기준 존재

### 현재 상태
- 상태: 준비 완료 / 운영 대기
- 근거:
  - `docs/evals/EVAL_SUMMARY.md`
  - `docs/TASK_LEDGER.md`
- 비고:
  - 평가 체계는 준비 완료
  - 다만 의미 있는 반복 task가 더 쌓여야 strong signal 분석 가능

## 남은 운영 과제
1. pilot 3개 화면 수동 검증 완료 기록
2. baseline `validate:grid` 실패 화면 정리
3. 평가용 ledger entry 누적
4. 20분 cron 결과의 Layer 6 반영 주기 확정
