Status: Draft
Owner: 석
Canonical: Yes
Source of Truth: This file
Last Verified: 2026-03-22
Confidence: Medium

# Core Beliefs

## 기본 신념
- 근거 없는 구조 상정보다 repo와 실제 흐름을 우선한다.
- grid는 사원관리 패턴을 기준으로 삼되, 기능 완성도를 더 우선한다.
- 자동화는 위험도와 검증 수준을 넘지 않아야 한다.
- 테스트와 브라우저 확인 없이 완료를 주장하지 않는다.
- 새 화면은 DB 기반 메뉴/권한 진입까지 닫혀야 의미가 있다.

## 절대 깨면 안 되는 원칙
- auth/payroll/schema/deploy를 승인 없이 자동 변경하지 않는다.
- canonical source를 tool-specific 문서가 대체하지 않는다.
- baseline 실패를 현재 작업 실패로 오판하지 않는다.
- 사람이 확인할 수 없는 상태로 배포를 끝내지 않는다.
