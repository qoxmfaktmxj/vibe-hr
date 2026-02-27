# AG Grid/Save/AppShell 개선 실행 계획

## 목적
- 공용 번들에서 AG Grid 의존성을 제거해 초기 로드 부담을 낮춘다.
- AG Grid 모듈 주입 경로를 화면 전용 Provider로 표준화한다.
- 대량 저장 시 순차 요청을 동시성 제한 병렬 처리로 전환해 체감 성능을 개선한다.
- `validate:grid` 누락 케이스를 줄이고 금지 패턴 재도입을 차단한다.
- AppShell 탭 라벨 계산 비용을 줄여 메뉴 변경/탭 많은 상황의 렌더 부담을 낮춘다.

## 실행 순서(고정)
1. AG Grid 전용 Provider 추가 및 화면 레이아웃 결합
2. Appointment Code/Record의 `ModuleRegistry` 제거
3. 공용 Providers에서 `AgGridProvider` 제거
4. 저장 로직 병렬화 유틸 추가 및 대상 Manager 반영
5. `validate:grid` 강화(역방향 스캔 + 금지 토큰 검사)
6. AppShell 탭 라벨 인덱싱(Map) 적용
7. 자동 검증 실행 및 수동 점검

## 단계별 상세 작업

### 1) AG Grid 전용 Provider 추가 및 결합
- 신규 파일: `frontend/src/components/grid/ag-grid-modules-provider.tsx`
  - `AgGridProvider` + `AG_GRID_SHARED_MODULES`를 캡슐화
- 수정: `frontend/src/components/grid/manager-layout.tsx`
  - `ManagerPageShell` 최상단에 `AgGridModulesProvider` 적용
- 수정: `frontend/src/components/settings/common-code-manager.tsx`
  - legacy 화면이므로 컴포넌트 루트를 `AgGridModulesProvider`로 래핑

완료 기준
- `AgGridReact`를 쓰는 standard-v2 화면은 `ManagerPageShell` 경유로 모듈이 주입된다.
- legacy `CommonCodeManager`도 동일 Provider를 경유한다.

### 2) Appointment 화면 ModuleRegistry 제거
- 수정: `frontend/src/components/hr/hr-appointment-record-manager.tsx`
- 수정: `frontend/src/components/hr/hr-appointment-code-manager.tsx`
  - `AllCommunityModule`, `ModuleRegistry` import 제거
  - `registerModules` 관련 블록 제거

완료 기준
- 두 파일에 `ModuleRegistry` 문자열이 남지 않는다.

### 3) 공용 Providers 정리
- 수정: `frontend/src/components/providers.tsx`
  - `AgGridProvider`/`AG_GRID_SHARED_MODULES` import 제거
  - JSX에서 AG Grid 래퍼 제거
  - `AuthProvider`, `MenuProvider`, `Toaster`만 유지

완료 기준
- 전역 Providers에서 AG Grid 관련 import/사용이 없다.

### 4) 저장 로직 병렬화
- 신규 파일: `frontend/src/lib/utils/run-concurrent.ts`
  - `runConcurrent`, `runConcurrentOrThrow` 제공
  - 기본 동시성 6
- 수정 대상(1차):
  - `frontend/src/components/hr/hr-appointment-record-manager.tsx`
  - `frontend/src/components/hr/hr-appointment-code-manager.tsx`
  - `frontend/src/components/org/organization-manager.tsx`
  - `frontend/src/components/hr/hr-admin-record-manager.tsx`
  - 삭제 -> 수정 -> 입력 순서는 유지하고 그룹 내부만 병렬 실행

완료 기준
- 대상 `saveAll`에서 `for...of` 순차 fetch가 사라지고 concurrency 유틸을 사용한다.

### 5) validate:grid 강화
- 수정: `frontend/scripts/validate-grid-screens.mjs`
  - 역방향 스캔: `frontend/src/components/**/*.tsx` 중 `AgGridReact` 포함 파일 탐지
  - registry 미등록 `AgGridReact` 파일 발견 시 실패
  - registry의 `componentFile`에 `ModuleRegistry` 포함 시 실패

완료 기준
- "AgGridReact 사용 + registry 누락" 케이스를 잡는다.
- 등록된 화면에서 `ModuleRegistry` 재도입을 차단한다.

### 6) AppShell 라벨 인덱싱
- 수정: `frontend/src/components/layout/app-shell.tsx`
  - 재귀 `findMenuLabel` 제거
  - `buildMenuLabelIndex` + `useMemo(Map)` 도입
  - `resolveLabel`과 탭 필터링을 Map 조회 기반으로 전환

완료 기준
- 탭 라벨 조회가 O(1)로 동작한다.

## 검증 계획

자동 검증
- `cd frontend && npm run validate:grid`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`

수동 점검
- `/login` 진입 시 AG Grid 관련 chunk 비로딩 확인
- Grid 화면 진입 시 모듈 Provider 정상 동작 확인
- Appointment code/record 화면 그리드 정상 렌더 확인
- 다건 저장 시 기존 대비 체감 속도/프리징 개선 확인
- 탭 다수 상태에서 메뉴 변경/이동 시 반응성 확인

## 진행 체크리스트
- [x] 1) Provider 추가/결합
- [x] 2) Appointment ModuleRegistry 제거
- [x] 3) Global Providers 정리
- [x] 4) saveAll 병렬화
- [x] 5) validate:grid 강화
- [x] 6) AppShell 인덱싱
- [x] 7) validate/grid lint build 검증
