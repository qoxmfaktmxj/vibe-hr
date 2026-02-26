# 메뉴권한 + 화면 액션권한 통합 계획

## 목표
메뉴 진입 권한과 화면 액션(버튼) 권한을 분리해 통제한다.

## 1. 권한 모델

### 1) 메뉴 권한 (기존)
- 메뉴 접근 여부 제어

### 2) 액션 권한 (신규)
- 버튼 단위 제어
- 표준 액션 코드:
  - `query`
  - `create`
  - `copy`
  - `template_download`
  - `upload`
  - `save`
  - `download`

## 2. DB 스키마 제안

### app_menu_actions
- id
- menu_id (FK app_menus)
- action_code
- enabled_default
- created_at, updated_at

### app_role_menu_actions
- id
- role_id (FK auth_roles)
- menu_id (FK app_menus)
- action_code
- allowed
- created_at, updated_at

## 3. API
- `GET /api/v1/menus/actions/tree` : 메뉴 + 액션 권한 트리
- `PUT /api/v1/menus/actions/roles/{roleId}` : 역할별 액션 권한 저장
- `GET /api/v1/menus/actions/roles/{roleId}` : 역할별 액션 권한 조회

## 4. 프론트 적용
- 로그인/권한 로드 시 메뉴 + 액션 권한 수신
- AG Grid 툴바는 `allowedActions` 기준으로 버튼 표시/비활성
- 비권한 버튼 클릭 차단

## 5. 서버 보안
- 저장/업로드/다운로드 등 액션별 API에 권한 검증 필수
- UI 비노출만으로 보안 대체 금지

## 6. 단계별 적용
1) 사원/공통코드/조직코드 3화면에 액션 권한 적용
2) 메뉴권한관리 UI에 액션 매트릭스 탭 추가
3) 나머지 AG Grid 화면 순차 편입
