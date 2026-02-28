# Vibe-HR TDD 도입 가이드

## 목적
- 버그를 "사후 수정"이 아니라 "재발 방지 가능한 테스트"로 전환
- 핵심 비즈니스 로직(서비스/유틸)의 회귀를 배포 전에 차단

## 기본 원칙
1. **Red → Green → Refactor** 순서를 반드시 지킨다.
2. 버그 수정은 **재현 테스트를 먼저** 작성한다.
3. 테스트 없는 기능 코드는 원칙적으로 머지하지 않는다(긴급 핫픽스 예외).
4. UI 렌더링보다 **순수 로직 테스트**를 우선한다.

## 적용 범위(1차)
- Backend: `app/services/*`의 순수 함수/비즈니스 규칙
- Frontend: `src/lib/*`의 포맷/정규화/매핑 로직

## 작업 체크리스트
- [ ] 실패 테스트 먼저 작성 (Red)
- [ ] 최소 코드로 통과 (Green)
- [ ] 중복 제거/가독성 리팩터링 (Refactor)
- [ ] 로컬 테스트 전체 통과
- [ ] PR 설명에 "추가한 테스트 케이스" 명시

## 테스트 명령어
### Frontend
```bash
cd frontend
npm run test
```

### Backend
```bash
cd backend
python3 -m pytest -q
```

## CI 게이트
- GitHub Actions `deploy.yml`에서 `test` 잡이 성공해야 `deploy`가 실행된다.
- 즉, 테스트 실패 시 배포 자동 차단.

## 작성 규칙
- 테스트 파일명: `test_*.py`, `*.test.ts`
- 테스트 이름은 행위 중심으로 작성
  - 예) `normalizeMenuIconName returns null for unknown icon`
- 하드코딩 값은 "도메인 의미"가 보이게 작성

## 우선 추가할 권장 테스트
1. 직원 페이징/필터 파라미터 경계값
2. 아이콘 normalize/alias 변환
3. 출근 상태 라벨/시간 포맷 변환
4. 배치 저장 시 atomic 보장(실패 시 롤백)
