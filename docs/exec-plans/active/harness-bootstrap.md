Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: 2026-03-22
Confidence: Medium

# Harness Bootstrap Plan

## 목표
Vibe-HR에 맞는 agentic harness 1~6 Layer를 repo와 실제 운영 흐름에 정착시킨다.

## 현재 상태
- Discovery / Governance / Core canonical docs: 정리됨
- Tool adapters: Codex/OMX + Claude + guardrails + risk-path script 적용됨
- Execution protocol: 실제 pilot과 연결됨
- Eval harness: 문서화 완료, 반복 데이터 축적 단계
- 자동배포: 비활성화됨
- 수동 배포: 운영 기본값으로 전환됨

## 단계별 계획
- [x] Layer 1 Discovery Packet 생성
- [x] Layer 2 Governance 정리
- [x] Layer 3 Core canonical docs 생성
- [x] Layer 4 Tool adapters / enforcement 초안 및 적용
- [x] Layer 5 Execution protocol 문서화 및 pilot 적용
- [x] Layer 6 Eval summary skeleton 생성
- [ ] pilot 3개 화면 수동 검증 완료
- [ ] baseline `validate:grid` 정리
- [ ] Layer 6 strong-signal 평가 누적

## 성공 기준
- source of truth가 정리됨
- 승인 정책과 자동화 경계가 정의됨
- 실행/검증/기록 루프가 실제로 사용됨
- 수동 배포 기반으로 사람이 확인 가능한 상태를 유지함
- cron이 workflow 1~10 기준으로 상태 점검과 작은 개선을 수행함
