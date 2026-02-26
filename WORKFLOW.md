# VIBE-HR WORKFLOW.md

VIBE-HR 작업은 기본적으로 **Frontend / Backend / QA 분업**으로 진행한다.

---

## 0) 시작 전 체크 (필수)
1. `git fetch --all`
2. `git checkout main`
3. `git pull --ff-only origin main`
4. `AGENTS.md` 확인
5. `config/grid-screens.json` 확인
6. `docs/GRID_SCREEN_STANDARD.md` 확인
7. `docs/MENU_ACTION_PERMISSION_PLAN.md` 확인

---

## 1) 분업 역할

### Frontend
- 화면/컴포넌트/상호작용 구현
- AG Grid 표준(7버튼/상태컬럼/조회초기화) 적용
- 템플릿 다운로드/업로드/다운로드(XLSX) 연결

### Backend
- 저장 파이프라인 API 정리
- 저장 처리 순서 고정: **DELETE → UPDATE → INSERT**
- 액션 권한(메뉴권한 + 버튼권한) 검증 API 제공

### QA
- 화면별 시나리오 테스트
- 조회 시 상태 초기화 검증
- 입력/복사/삭제체크/저장 일괄처리 검증
- 전체 다운로드(페이징 무관) 검증

---

## 2) 표준 개발 순서
1. 정책/레지스트리 먼저 반영 (`GRID_SCREEN`, registry)
2. 공통 컴포넌트 적용
3. 화면별 이벤트 바인딩
4. API 연동 및 저장 순서 검증
5. lint/build/실행 테스트
6. 문서 동기화 + 커밋/푸시

---

## 3) AG Grid 표준 7버튼 적용 순서 (현재)
1. `/hr/employee`
2. `/settings/common-codes`
3. `/org/departments`

---

## 4) 완료 기준 (Definition of Done)
- [ ] `npm run validate:grid` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run build` 통과
- [ ] 표준 7버튼 순서/동작 일치
- [ ] 저장 순서 DELETE→UPDATE→INSERT 확인
- [ ] docs 반영 완료
- [ ] main push 완료

---

## 5) 참고
- AG Grid 표준: `docs/GRID_SCREEN_STANDARD.md`
- 액션 권한 설계: `docs/MENU_ACTION_PERMISSION_PLAN.md`
- 대상 레지스트리: `config/grid-screens.json`
