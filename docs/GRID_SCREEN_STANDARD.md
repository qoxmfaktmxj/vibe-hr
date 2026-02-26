# GRID SCREEN STANDARD (standard-v1)

AG Grid 기반 화면은 아래 표준을 반드시 준수한다.

## 1) 적용 대상 판정
아래 3개를 모두 만족해야 "AG Grid 표준 화면"으로 인정한다.
1. `AgGridReact` 사용
2. 페이지 파일에 `GRID_SCREEN` 메타 선언
3. `config/grid-screens.json`에 등록

## 2) 페이지 메타 규칙
페이지 파일(`src/app/**/page.tsx`)에 아래를 선언한다.

```ts
export const GRID_SCREEN = {
  engine: "ag-grid",
  profile: "standard-v1",
  registryKey: "hr.employee",
} as const;
```

- `registryKey`는 `config/grid-screens.json` key와 동일해야 한다.

## 3) 표준 버튼 순서
`조회 → 입력 → 복사 → 양식다운로드 → 업로드 → 저장 → 다운로드`

- 화면별 특화 버튼은 우측에 추가 가능
- 공통 버튼 순서/명칭은 변경 금지

## 4) 표준 동작
- 조회: 그리드/편집 상태/선택 상태 초기화
- 입력: 신규 행 추가, 상태=입력
- 복사: 선택 행 하단에 신규 복제, 상태=입력
- 양식다운로드: 화면 컬럼 기반 xlsx 템플릿
- 업로드: 템플릿 헤더 매핑 후 입력 상태로 반영, 기존 그리드 데이터 초기화
- 저장: 삭제/수정/입력 일괄 처리, 서버 처리 순서 `DELETE → UPDATE → INSERT`
- 다운로드: 전체 데이터 xlsx 다운로드(현재 페이지만 금지)

## 5) 권한
- 메뉴 접근 권한과 버튼 실행 권한은 분리 가능하도록 설계
- UI 숨김만으로 끝내지 않고 서버 API 권한 검증 필수

## 6) 검증
- `npm run validate:grid`
- `npm run lint`
- `npm run build`
