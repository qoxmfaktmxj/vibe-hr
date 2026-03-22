Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: 2026-03-22
Confidence: Medium

# RELIABILITY.md

## 목적
런타임 안정성, 장애 복구, 수동 배포 운영 기준을 정의한다.

## 현재 운영 기본값
- 자동배포 비활성화
- 수동 검토 후 수동 배포
- deploy 후 health 확인 필수
- backend boot blocker 발견 시 기능 작업보다 복구 우선

## 안정성 목표
- 로그인 가능 상태 유지
- 핵심 화면 진입 가능 상태 유지
- 저장/조회/삭제 등 기본 업무 경로가 동작해야 함

## 실패 처리 원칙
- runtime crash: 즉시 원인 파악 후 복구 우선
- deploy blocker: baseline failure와 current-task failure를 분리
- 기능 추가보다 서비스 복구 우선

## 롤백/복구 원칙
- 새 배포가 서비스를 깨면 원인 fix 또는 이전 안정 상태로 복구
- backend 부팅 실패는 최우선 blocker로 처리
- 모든 복구 작업은 ledger에 남김
