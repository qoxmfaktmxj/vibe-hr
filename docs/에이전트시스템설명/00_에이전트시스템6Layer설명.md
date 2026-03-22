---
layout: post
title: "AI 에이전트 실전 운영 6-Layer 패키지: Bootstrap→Governance→Artifacts→Tool Adapters→Execution→Evaluation"
date: 2026-03-20 23:12:00 +0900
categories: [ai]
tags: [ai, agentic-engineering, harness-engineering, governance, prompt, templates, tool-adapters, execution, evaluation]
---

# AI 에이전트 실전 운영 6-Layer 패키지

이 글은 AI 에이전트를 단순 프롬프트 수준이 아니라, 실제 운영 가능한 체계로 도입하기 위한 **6개 레이어 패키지**를 안내합니다.

핵심은 다음입니다.

**발견(Discovery) → 규칙(Governance) → 표준 산출물(Artifacts) → 강제(Adapters) → 실행(Execution) → 평가(Evaluation)**

즉, 설계 → 실행 → 피드백까지 이어지는 **닫힌 루프(Closed Loop)** 를 만드는 것이 목적입니다.

---

## 구성 파일 (다운로드)

아래 6개 파일을 순서대로 사용합니다.

### Layer 1 — Bootstrap

- **01_BOOTSTRAP_PROMPT.md**
  - 첫 접점 프롬프트
  - Discovery 질문, 근거 태그, Discovery Packet 생성
  - 다음 단계(Handoff) 포함
  - [GitHub 문서 열기](https://raw.githubusercontent.com/qoxmfaktmxj/qoxmfaktmxj.github.io/main/assets/file/01_BOOTSTRAP_PROMPT.md)

### Layer 2 — Governance

- **02_GOVERNANCE_SPEC.md**
  - 운영 헌법 / 가드레일
  - 위험도(R0~R3), 승인 정책, 품질 점수
  - sub-agent, skill/hook 설계 기준
  - [GitHub 문서 열기](https://raw.githubusercontent.com/qoxmfaktmxj/qoxmfaktmxj.github.io/main/assets/file/02_GOVERNANCE_SPEC.md)

### Layer 3 — Artifacts

- **03_ARTIFACT_TEMPLATES.md**
  - canonical 문서 생성 템플릿
  - AGENTS.md, ARCHITECTURE.md, TEST_STRATEGY.md 등
  - [GitHub 문서 열기](https://raw.githubusercontent.com/qoxmfaktmxj/qoxmfaktmxj.github.io/main/assets/file/03_ARTIFACT_TEMPLATES.md)

### Layer 4 — Tool Adapters

- **04_TOOL_ADAPTERS.md**
  - 도구별 투영 및 강제
  - Claude / Cursor / CI / hooks / CODEOWNERS 적용
  - [GitHub 문서 열기](https://raw.githubusercontent.com/qoxmfaktmxj/qoxmfaktmxj.github.io/main/assets/file/04_TOOL_ADAPTERS.md)

### Layer 5 — Execution (신규)

- **05_EXECUTION_PROTOCOL.md**
  - 실제 작업 수행 규약
  - 실행 루프, 실패 분류, retry / rollback / stop 규칙
  - Completion Evidence 및 Task Ledger 정의
  - [GitHub 문서 열기](https://raw.githubusercontent.com/qoxmfaktmxj/qoxmfaktmxj.github.io/main/assets/file/05_EXECUTION_PROTOCOL.md)

### Layer 6 — Evaluation (신규)

- **06_EVAL_HARNESS.md**
  - 실행 성과 측정 및 피드백 루프
  - Task Ledger 기반 최소 계측
  - 자동화 범위 조정 근거 제공
  - [GitHub 문서 열기](https://raw.githubusercontent.com/qoxmfaktmxj/qoxmfaktmxj.github.io/main/assets/file/06_EVAL_HARNESS.md)

---

## 설계 원칙 요약

- Canonical source는 **Layer 3 (Artifacts)**
- Layer 4는 **Projection (도구별 투영)**
- Layer 5~6은 **운영 루프 (실행 + 평가)**
- 모든 단계에서 근거 태그 유지
  - `[Observed] [User-stated] [Derived] [Assumption] [Proposal] [Missing]`

---

## 사용 방법 (중요)

### Phase 1 — Setup (1회 수행)

1. `01_BOOTSTRAP_PROMPT.md` 실행 → Discovery Packet 생성
2. `02_GOVERNANCE_SPEC.md` 적용 → Governance 확정
3. `03_ARTIFACT_TEMPLATES.md` → canonical 문서 생성
4. `04_TOOL_ADAPTERS.md` → enforcement 구성

👉 여기까지가 **설계 및 환경 구축 단계**

### Phase 2 — Run Loop (반복 수행)

1. `05_EXECUTION_PROTOCOL.md` → 실제 작업 실행
2. `06_EVAL_HARNESS.md` → 결과 평가 및 정책 조정

👉 `05 → 06`을 반복하면서 시스템이 점진적으로 개선됩니다.

---

## 핵심 차이

이 패키지는 아래 방식과 다릅니다.

- ❌ 단순 프롬프트 기반 개발
- ❌ 한 번 실행하고 끝나는 구조

대신 다음을 제공합니다.

- ✅ 실행 표준 + 실패 대응 규약
- ✅ 작업 성과 측정 + 피드백 루프
- ✅ 자동화 범위 점진 확장 근거

즉,

> “AI가 코드를 생성하는 구조”가 아니라
> “AI가 지속적으로 개선되는 운영 시스템”을 만드는 구조입니다.

---

## 한 줄 요약

**01~04는 설계, 05~06은 운영이다.**

둘이 합쳐져야 진짜 Agentic System이다.
