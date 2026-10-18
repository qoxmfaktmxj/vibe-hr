# 세 업무 화면 실제 적용 결과

날짜: 2026-10-18
상태: 요청한 세 화면의 로컬 구현과 검증 완료. 커밋, 푸시, 배포는 수행하지 않았다.
승인: 사용자가 비교안의 추천 방향을 공통 디자인으로 확정하고 사원관리, 결재 상세, 인사기본 순서의 구현과 명시적 일괄 저장을 요청했다.
위험도: R2. 공통 그리드 표현과 인사 이력 API를 포함하며 기존 인증/권한 정책과 DB 구조는 유지한다.

## 실제 적용

| 화면 | 결과 | 저장 기준 |
| --- | --- | --- |
| 사원관리 | 검색 라벨, 제목, 검색 버튼 정렬, 여백과 보조 도구를 정리 | 기존 atomic batch 유지, 변경 건수와 저장 후 반영, 저장을 다운로드 앞에 배치 |
| 결재 상세 | 기존 그리드 옆에 선택 문서와 결재 진행 표시, 좁은 화면에서 목록/상세 전환 | 승인/반려는 기존 확인창과 업무 API 사용, 문서별 결과를 명확히 표시 |
| 인사기본 | 재직/추가 정보 섹션과 8개 이력 탭의 공통 그리드 | 기본정보 폼 저장, 직원 한 명의 현재 이력 분류를 단일 트랜잭션으로 일괄 저장 |

실제 적용 화면 보기: `frontend/output/common-screen-rollout-20261018/index.html`

밝음/어두움과 모바일 캡처, 인사 이력 그리드를 제공한다. 실제 제품 코드를 배포용 빌드로 실행했으며 화면 데이터는 격리된 합성 테스트 데이터다. 기존 비교용 시안은 그대로 보존했다.

## 변경 파일

- 사원관리: `employee-master-manager.tsx`, `employee-master-search-section.tsx`
- 인사기본: `hr-basic-workspace.tsx`, `hr-basic-tabs.tsx`, `hr-employee-header.tsx`, `lib/hr/hr-basic.ts`, `app/hr/basic/page.tsx`
- 결재: `hri-task-board.tsx`, `hri-task-detail.tsx`, `hri-form-detail.tsx`, `hri-application-hub.tsx`
- 공통: `manager-layout.tsx`, `grid-toolbar-actions.tsx`, `readonly-grid-manager.tsx`, `use-unsaved-navigation.tsx`, `app-shell.tsx`, `workspace-navigator.tsx`, `globals.css`
- API: `app/api/hr/basic/[employeeId]/records/batch/route.ts`, `HrController.java`, `HrRequests.java`, `HrApplicationService.java`
- 등록/검증: `config/grid-screens.json`, `playwright.common-design.config.ts`, `common-design.spec.ts`, 합성 backend fixture, HR Java 계약과 PostgreSQL 검사

## 저장 계약

`POST /api/hr/basic/{employeeId}/records/batch`를 Spring의 같은 경로 `/api/v1/hr/basic/{employee_id}/records/batch`로 전달한다. 요청은 `category`, `items`, `delete_ids`로 구성한다. 새 행의 id는 null이다. 응답에는 저장된 분류의 행과 입력/수정/삭제 건수가 포함된다.

기존 HR 역할 기준을 적용한다. 직원 쓰기 잠금과 직원/분류 소유권, 중복 ID를 확인한 뒤 하나의 트랜잭션으로 저장한다. 일부 행이 DB 제약을 위반해도 앞서 수행한 변경까지 롤백된다. 저장 실패 시 클라이언트 초안은 유지된다. 삭제 표시는 저장 전 해제할 수 있다.

기본 정보의 선택 필드는 null을 보내 지울 수 있다. 생략한 필드는 유지한다. 필수 성명과 입사일은 프론트에서 검증한다. 기존 프로필과 이력 테이블을 그대로 사용한다.

## 검증 결과

- `npm run validate:grid`: 통과. 인사기본 신규 등록 포함.
- `npm run lint`: 통과. 마지막 모바일 여백 수정은 해당 파일과 테스트의 ESLint를 다시 확인했다.
- `npm run test`: 305개 통과.
- `playwright.common-design.config.ts`: 18개 통과. 기존 사원관리 8개, 기존 결재 5개, 새 공통 디자인 5개를 포함한다.
- 후속 키보드 상세 선택/기존 일괄 결재 4개 재검증 통과. 마지막 모바일 버튼 겹침 수정 후 상세 검사 2개 재검증 통과.
- `npm run test:ui:full`: 기존 58개 통과. 위 18개와 합쳐 브라우저 검사 76개를 검증했다.
- `npm run build`: 최종 수정 후 통과. TypeScript 포함.
- `gradlew test --tests com.vibehr.hr.*`: 22개 통과.
- `integrationTest --tests com.vibehr.hr.HrPostgreSqlSchemaIntegrationTest`: 실제 PostgreSQL 검사 30개 통과. 8개 이력 분류, 저장 원자성, 잘못된 분류/중복 ID, 선택 프로필 필드 삭제를 포함한다.
- 화면: 세 화면의 1440px와 390px에서 문서 가로 넘침 없음. 밝음/어두움과 한국어를 시각적으로 확인했다. 모바일 결재 버튼은 메뉴/챗봇에 가려지지 않는지 실제 hit test로 검증했다.

초기 검사에서 새 batch DTO의 기존 계약 상속과 route 개수 검사를 맞췄다. 브라우저 검사에서 일반 alert/status 탐색이 Next의 안내 요소까지 포함하던 문제는 대상 문구로 범위를 좁혔다. 모바일 처리 결과가 숨겨지던 문제와 하단 고정 버튼 겹침은 제품 코드에서 수정했다.

## 단순화와 남은 범위

인사기본의 두 HTML 표와 개별 카드 색상, 행별 즉시 추가/저장/삭제 코드를 제거하고 기존 공통 그리드 상태/페이지/도구 모듈을 사용했다. 결재 문서 내용 렌더러는 기존 신청서 화면과 공유한다. 새 의존성은 추가하지 않았다.

인사 이력의 페이지 이동은 기존 직원 상세 응답을 이용한 로컬 50행 방식이다. 그리드 표준에 단일 직원 상세 예외로 명시했다. 앱 내 메뉴/업무 탭/빠른 이동과 직원/이력 탭/조회 변경은 미저장 확인창으로 보호한다. 브라우저 자체의 뒤로/앞으로 기록은 가로채지 않는다. 새로고침과 창 닫기는 unload 경고를 사용한다. 버전 토큰을 이용한 동시 편집 충돌 검사는 추가하지 않았다.

프론트와 Spring을 함께 배포해야 새 batch를 사용할 수 있다. 전체 HTML 표 분류에서 나머지 전환 대상 9개는 후속 범위다. 랜딩은 내부 화면 정리 이후에 진행한다. 기존 물결 배경, 배포 설정과 관련 없는 작업 디렉터리 변경은 보존했다.
