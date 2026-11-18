# Rust 전환 검증 기록

기준 Spring 체크아웃은 `75b94e868d2eea94689f840c3bce495ab5f5f5c5`이다. 현재 컨트롤러에서 추출한 290개 동작을 기준으로 삼았다. 기존 UI가 호출하는 API와 Spring 프레임워크가 제공하던 운영 경로도 별도로 대조한다. [요청 흐름과 롤백 설계](architecture.md), [현재 기능 목록](inventory.md)

## 도메인별 근거

| 범위 | Spring 컨트롤러 동작 수 | 확인한 내용과 재현 방법 |
| --- | ---: | --- |
| 인증 | 7 | 기존 비밀번호와 세션 갱신, 사칭 권한, 비활성 계정, 소셜 계정 생성, 동시 가입, 서명 재사용, 한도 및 롤백. `backend-rust/src/security/tests.rs` 및 격리 HTTP 비교 |
| 인사와 퇴직 | 44 | 인사 기본정보 이력, 명부 일괄 저장, 합격자 채용, 발령 확정, 퇴직 취소, 퇴직금과 세금. [인사 HTTP 비교](../../scripts/rust-migration/hr-parity.py) |
| 조직 | 35 | 조직 트리, 인력 조회, 개편 미리보기와 적용, 중복 적용, 이력과 시퀀스. [업무 비교](../../scripts/rust-migration/business-parity.mjs) |
| 급여 | 41 | 대상자 스냅샷, 수당과 공제, 반올림, 계산 및 재계산, 마감, 전표, 지급, 본인 명세서, 한글 PDF와 CSV. [급여 비교](../../scripts/rust-migration/payroll-parity.py) |
| 근태와 휴가 | 36 | 근무표, 출퇴근, 교정, 연차, 승인과 취소, 월 마감과 재오픈, 급여 입력과 리포트. [근태 비교](../../scripts/rust-migration/time-parity.py), [동시 처리 및 롤백](../../backend-rust/tests/time_concurrency.rs) |
| 신청과 결재 | 16 | 양식별 상세 값, 처리 권한, 제출과 반려, 재신청, 수신, 첨부 조건, 복리후생 반영. [신청 비교](../../scripts/rust-migration/payroll-parity.py) |
| 복리후생 | 8 | 복리후생 종류 일괄 저장, 신청자별 목록, 승인과 철회, 승인 금액. [복리후생 비교](../../scripts/rust-migration/payroll-parity.py) |
| 경영관리 | 43 | 회사별 요청번호, 프로젝트와 문의, 인프라 및 외주 관리, 월 보고와 상태 전환. [업무 비교](../../scripts/rust-migration/business-parity.mjs) |
| 평가 | 10 | 평가 기준과 결과, 대상자 일괄 수정, 변경 이력의 시간 표현. [업무 비교](../../scripts/rust-migration/business-parity.mjs) |
| 교육 | 12 | 교육 자료별 조회와 일괄 저장, 생성 작업, 신청, 승인, 철회, 사이버 교육 반영. [업무 비교](../../scripts/rust-migration/business-parity.mjs) |
| 메뉴와 권한 | 18 | 메뉴 트리, 역할 저장과 삭제 제한, 메뉴 매핑, 역할별 동작 권한, 미등록 ID 롤백. [설정 비교](../../scripts/rust-migration/settings-parity.py) |
| 공통코드 | 9 | 그룹과 항목 검색, 수정, 중복 처리, 참조 무결성, 공개 옵션. [설정 비교](../../scripts/rust-migration/settings-parity.py) |
| 시스템 설정과 대시보드 | 3 | 로그인 정책과 기록, 정책 범위 검증, 한국 영업일자 대시보드 집계. [설정 비교](../../scripts/rust-migration/settings-parity.py) |
| 운영 HTTP | 8 | 상태 확인과 DB 장애 응답, 문서 페이지의 GET 및 HEAD. 공개 OpenAPI의 284개 동작과 361개 스키마를 Spring 실행 결과와 대조. [OpenAPI 비교](../../scripts/rust-migration/openapi-contract.mjs) |

## 운영 전환 전 판단할 사항

1. 신규 소셜 계정에는 사용자가 승인한 무작위 로컬 자격 증명을 적용했다. 기존 계정 해시는 보존한다.
2. 정상 입력에서 Spring이 500을 반환하던 합격자 신규 등록, 공통코드 필터 조회, 신규 연도의 교육 일정 생성은 업무 의도대로 처리한다. [합격자 등록 차이](hr-differences.md), [공통코드 및 교육 차이](business-differences.md)
3. PostgreSQL 논리 덤프를 그대로 복원하면 일부 제약식이 다른 문자열로 표현될 수 있다. 엄격한 카탈로그 검증을 유지한다. 운영 복구에 사용할 백업은 실제 복원 방식으로 Flyway 체크섬과 스키마 검증을 통과시켜야 한다.
4. 운영 트래픽 전환은 별도 승인 대상이다. 이전 릴리스와 동일한 DB 스키마에서 Spring으로 돌아갈 수 있는지 격리 환경에서 리허설한다. [배포 리허설](../../scripts/ci/rehearse-rust-promotion.sh)
5. 기존 Next.js 16.4.1의 개발 서버가 보안 권고를 출력했다. 프론트엔드 의존성 업그레이드는 이번 백엔드 전환 범위 밖이다. 로컬 릴리스 검증은 격리 서버에서 수행했다.

OpenAPI 3.1 문서는 기존 계약을 캡처해 Rust 바이너리에 포함했다. 계약 파일을 비교하는 검사와 실제 HTTP 요청, DB 결과를 비교하는 검사를 각각 실행한다. 문서 뷰어의 JS와 CSS도 로컬에서 제공한다. Spring의 문서 HTML이 가리키던 Swagger CSS 경로가 기준 환경에서 404를 반환한 것을 확인했고, Rust에는 같은 버전의 자산을 제공했다.

## 검증 범위

Spring 기준 테스트는 단위 219건, PostgreSQL 통합 109건, 마이그레이션 20건에서 실패와 건너뜀 없이 통과했다. 실제 HTTP 비교는 동일한 시드로 시작한 두 DB를 사용했다. 조회 결과, 오류, DB 쓰기와 제약을 확인하고 독립 실행으로 생기는 타임스탬프 차이는 허용 범위를 검사한다.

[Rust 릴리스 CI](../../scripts/ci/verify-rust.sh)를 독립된 소스에서 처음부터 끝까지 실행해 종료 코드 0을 확인했다. Rust 포맷, 모든 타깃의 Clippy 경고 검사와 릴리스 빌드가 통과했다. PostgreSQL 및 PDF 테스트를 명시적으로 포함해 Rust 테스트 36건을 실행했고 실패와 건너뜀은 0건이었다. 세 권한 유형의 조회 372쌍과 업무 시나리오를 합쳐 HTTP 요청 868쌍을 비교했다. 신규 외부 합격자 등록은 별도의 기준 결함 시나리오로 검증했다. 전체 실행 로그의 SHA-256은 `bee3ac36928422cd21d41231c7d5c13251d4136fad09291ef168c3e2c188091f`이다.

기존 전달 검증에서는 Node 테스트 56건과 Python 테스트 8건, Spring 컨테이너 기동, Flyway 및 역사적 마이그레이션 검증을 통과했다. GitHub Actions 워크플로 세 개는 actionlint와 ShellCheck를 통과했다. 프론트엔드 정적 검증에서는 AG Grid 등록 화면 76개, ESLint, Vitest 312건, 프로덕션 빌드와 TypeScript 검사를 확인했다.

프론트의 목 테스트는 그리드, 키보드, 메뉴와 화면 이동을 검사한다. 별도의 [실제 BFF 브라우저 검증](../../scripts/rust-migration/verify-live.ps1)은 새로운 PostgreSQL, Flyway 및 Rust 서버를 생성한다. 브라우저가 실제 로그인 폼을 거쳐 얻은 세션으로 업무를 처리한다. 화면별로 API 응답을 대체하는 테스트는 해당 도메인의 DB 쓰기 증거에서 제외한다.

| 검증 | 결과 |
| --- | --- |
| 실제 급여와 퇴직 | 격리 브라우저에서 급여 계산, 지급, 양쪽 전표 확인, 본인 PDF 조회, 퇴직 확정과 퇴직금 검토를 통과했다. |
| 실제 근태에서 지급까지 | 반일 휴가와 근무를 함께 보존했고, 월 마감의 휴가 합계는 2.5일이었다. 승인 무급휴가 공제 80,000원과 독립 수동 공제 10,000원을 구분한 후 최종 지급까지 확인했다. |
| BFF 및 화면 흐름 | 최종 `rust-live-f05d9c`에서 금융 3건과 업무 화면 48건을 통과했다. 사원 그리드에서 검색하고 이름을 편집했을 때 명시적 저장 전에는 DB 값이 그대로였고, 저장 후 DB와 새로고침한 화면이 일치했다. 실제 합격자 채용과 발령도 확인했다. 금융 3건 중 1건은 읽기 응답을 대체한 대화상자 검증이고, 일부 화면은 UI 계약 검증이다. |
| 배포 이미지 연동 | 프로덕션 Next.js 이미지와 Rust 릴리스 이미지를 함께 실행했다. 로컬 TLS 프록시를 거친 로그인, 세션 쿠키 재사용, 본인 정보와 사원 목록 조회가 PostgreSQL 데이터와 일치했다. |
| 격리 화면 및 렌더링 | 19개 설정에서 중복을 포함해 247건을 실행했다. 정지 화면, 모션 캡처, Windows D3D11 렌더링 결과는 [UI 검증 기록](synthetic-ui-proof.md)에 있다. |
| 배포 복구 | 격리 PostgreSQL 16에서 이전 Spring 이미지, Rust 이미지, 이전 Spring 이미지 순서로 전환했다. Rust에서 생성한 역할 ID와 이름을 롤백 후 기존 세션으로 조회했다. |
