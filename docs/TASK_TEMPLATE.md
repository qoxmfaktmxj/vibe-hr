# TASK_TEMPLATE.md
## Claude Code 작업 요청 템플릿

아래 형식으로 요청하면 이 저장소에서 작업 정확도가 높아진다.

---

## 1. 작업 제목
예:
- 사원 마스터 그리드 저장 오류 수정
- 급여 실행 상세 조회 API 응답 필드 정리
- 조직관리 화면에 액션 권한 연동 추가

---

## 2. 목표
이 작업으로 무엇을 바꾸고 싶은지 한 문단으로 적는다.

예:
- `/hr/employee` 화면에서 수정 후 저장 시 특정 행이 갱신되지 않는 문제를 해결한다.
- 기존 AG Grid 표준 규칙은 유지하고, 저장 순서 및 dirty-row 보호를 깨지 않는다.

---

## 3. 대상 범위
수정 대상 경로를 명시한다.

예:
- Frontend:
  - `frontend/src/app/hr/employee/page.tsx`
  - `frontend/src/components/hr/employee-master-manager.tsx`
- Backend:
  - `backend-rust/src/hr/employees.rs`
  - `backend-rust/src/hr/forms.rs`
  - `backend-rust/src/hr/schema.rs`

---

## 4. 선행 확인 문서
작업 전에 반드시 다시 볼 문서를 적는다.

예:
- `docs/DEVELOPMENT_PRECHECK.md`
- `AGENTS.md`
- `WORKFLOW.md`
- `config/grid-screens.json`
- `docs/GRID_SCREEN_STANDARD.md`
- `docs/AG_GRID_COMMON_GUIDE.md`
- `docs/MENU_ACTION_PERMISSION_PLAN.md`

---

## 5. 관련 screen / registry 정보
AG Grid 화면이면 반드시 적는다.

예:
- route: `/hr/employee`
- registryKey: `hr.employee`
- profile: `standard-v2`

---

## 6. 기능 요구사항
구체적인 요구사항을 번호로 적는다.

예:
1. 저장 대상 변경행만 정상 반영되어야 한다.
2. `DELETE -> UPDATE -> INSERT` 순서를 유지한다.
3. dirty-row 경고는 기존과 동일하게 유지한다.
4. toolbar 순서는 변경하지 않는다.
5. 권한 없는 사용자는 save 액션이 허용되지 않아야 한다.

---

## 7. 금지사항
이번 작업에서 하면 안 되는 것을 적는다.

예:
- shared grid module을 우회한 화면 전용 toolbar 추가 금지
- `grid-screens.json` 누락 금지
- UI 숨김만으로 권한 처리 금지
- unrelated 리팩터링 금지
- seed 데이터 구조 대규모 변경 금지

---

## 8. 검증 방법
실행해야 하는 검증을 명시한다.

예:
- `npm run validate:grid`
- `npm run lint`
- `npm run test`
- `cargo test --locked`
- 브라우저에서 `/hr/employee` 수동 확인
- 권한 없는 사용자로 save 버튼/호출 차단 확인

---

## 9. 완료 조건
작업 완료를 어떻게 판정할지 적는다.

예:
- 저장 후 재조회 시 변경 내용이 유지된다.
- dirty-row 경고가 정상 동작한다.
- toolbar 순서가 유지된다.
- grid validator 통과
- backend 테스트 통과
- 관련 문서가 필요 시 갱신된다.

---

## 10. Claude Code에게 요구하는 결과 형식
아래 형식으로 결과를 달라고 명시하면 좋다.

예:
1. 변경 요약
2. 수정 파일 목록
3. 영향 범위
4. AG Grid 표준 준수 여부
5. 권한/저장 순서 점검 결과
6. 실행한 검증 명령
7. 남은 리스크 / 후속 제안

---

## 11. 예시 프롬프트
아래는 바로 복붙 가능한 예시다.

```md
작업 제목: 사원 마스터 저장 오류 수정

목표:
`/hr/employee` 화면에서 일부 수정행이 저장 후 재조회 시 반영되지 않는 문제를 해결해 줘.
AG Grid 표준 화면 규칙, toolbar 순서, dirty-row 보호, row status 계약은 유지해야 해.

대상 범위:
- frontend/src/app/hr/employee/page.tsx
- frontend/src/components/hr/employee-master-manager.tsx
- backend-rust/src/hr/employees.rs
- backend-rust/src/hr/forms.rs
- backend-rust/src/hr/schema.rs

선행 확인 문서:
- docs/DEVELOPMENT_PRECHECK.md
- AGENTS.md
- WORKFLOW.md
- config/grid-screens.json
- docs/GRID_SCREEN_STANDARD.md
- docs/AG_GRID_COMMON_GUIDE.md
- docs/MENU_ACTION_PERMISSION_PLAN.md

관련 screen 정보:
- route: /hr/employee
- registryKey: hr.employee
- profile: standard-v2

기능 요구사항:
1. 저장 대상 변경행만 정상 반영
2. DELETE -> UPDATE -> INSERT 순서 유지
3. dirty-row 경고 유지
4. toolbar 순서 유지
5. save 권한 검증 유지

금지사항:
- 화면 전용 toolbar 새로 만들지 말 것
- grid-screens.json 누락 금지
- UI 숨김만으로 권한 처리 금지
- unrelated 리팩터링 금지

검증:
- npm run validate:grid
- npm run lint
- cargo test --locked
- 브라우저 수동 확인

완료 조건:
- 저장 후 재조회 시 데이터 유지
- grid validator 통과
- 관련 테스트 통과

결과 보고 형식:
1. 변경 요약
2. 수정 파일 목록
3. 영향 범위
4. 규칙 점검 결과
5. 검증 결과
6. 남은 리스크
```
