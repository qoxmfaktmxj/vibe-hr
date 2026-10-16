Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: 2026-10-16
Confidence: Medium

# Harness Bootstrap Plan

## 목표
Vibe-HR에 맞는 agentic harness 1~6 Layer를 repo와 실제 운영 흐름에 정착시킨다.

## 현재 상태
- Discovery / Governance / Core canonical docs: 정리됨
- Tool adapters: Codex/OMX + Claude + guardrails + risk-path script 적용됨
- Execution protocol: 실제 pilot과 연결됨
- Eval harness: 문서화 완료, 반복 데이터 축적 단계
- 배포 트리거: main push, 매일 08:00 KST 예약, 수동 실행
- 배포 게이트: 동일 SHA의 standalone UI 성공 결과와 backend/image/runtime 검증 필수

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
- 승인 범위와 배포 게이트를 유지하고 실행 결과와 복구 경로를 사람이 확인할 수 있음
- cron이 workflow 1~10 기준으로 상태 점검과 작은 개선을 수행함
