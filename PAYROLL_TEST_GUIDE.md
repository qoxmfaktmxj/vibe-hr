# 보상/급여(CPN) 모듈 - Phase 1 테스트 가이드

이 문서는 Vibe-HR 프로젝트의 보상/급여 모듈 **Phase 1 (급여 기초 정보 설정)**에 대한 테스트 시나리오를 정의합니다.
다음 작업을 이어받는 개발자 또는 AI(에이전트)는 코드를 실행 환경(DB 포함)에 배포한 후, 아래 시나리오에 따라 정상 작동 여부를 반드시 확인해야 합니다.

---

## 🏗️ 1. 사전 준비 (Prerequisites)

1. **DB 환경 리소스 확보**
   - 개발용 PostgreSQL DB 연결 정보를 확인하고 `backend/.env` 파일 내 `DATABASE_URL` 변수에 정확히 설정합니다.
2. **패키지 의존성 확인**
   - `backend/requirements.txt`에 명시된 패키지(예: `psycopg[binary]`)가 설치되어 있어야 합니다.
3. **앱 구동**
   - DB가 준비되면 터미널에서 아래 시퀀스를 실행합니다.
     ```bash
     cd backend
     python scripts/seed_dev_postgres.py
     ```
   - 프론트엔드 구동 (BFF Route 테스트용)
     ```bash
     cd frontend
     npm run dev
     ```

---

## 🧪 2. 테스트 시나리오

### 2.1 DB 스키마 및 초기 데이터 (Seed) 생성 확인
- **목표:** 개발용 DB 초기화 스크립트가 에러 없이 실행되며, Pay 관련 테이블과 행이 알맞게 생성되는지 검증
- **테스트 방법:**
  1. `python scripts/seed_dev_postgres.py` 실행 시 터미널 에러가 없는지 확인
  2. PostgreSQL 클라이언트(DBeaver, pgAdmin 등) 접속 후 아래 테이블이 생성되었는지 확인
     - `pay_payroll_codes` (급여코드)
     - `pay_tax_rates` (세율/4대보험요율)
     - `pay_allowance_deductions` (수당/공제항목)
     - `pay_item_groups` (항목그룹)
     - `pay_item_group_details`
  3. 테이블 내에 `backend/app/bootstrap.py`에서 정의한 시드 데이터(예: 정기급여, 건강보험 요율 3.545% 등)가 정상적으로 들어가 있는지 SQL 조회로 확인

### 2.2 급여코드 관리 화면 (Payroll Code Manager)
- **URL 경로:** `http://localhost:3000/payroll/codes`
- **테스트 방법:**
  1. 화면 접속 시 Seed 데이터에 의해 생성된 '정기급여', '정기상여', '연차수당' 등이 그리드에 표시되는지 확인
  2. [입력] 버튼 클릭 후 신규 급여코드(예: `BONUS_SPECIAL`, `특별상여`) 정보 입력 및 [저장] 클릭
  3. 우측 상단 토스트(알림)에 "저장 완료" 메시지가 정상 출력되는지 확인
  4. 기존 코드의 지급성격을 변경한 뒤 [저장], 수정건수가 1건으로 갱신되는지 확인
  5. 특정 행 삭제 체크박스를 클릭 후 [저장], 목록에서 지워지고 DB에서도 삭제 처리되는지 확인

### 2.3 세율/4대보험 요율 관리 화면 (Payroll Tax Rate Manager)
- **URL 경로:** `http://localhost:3000/payroll/tax-rates`
- **테스트 방법:**
  1. 올해 연도(예: 2026 혹은 2024 등 DB 시드 데이터 기반 연도) 조회 클릭 시 세율 목록 표출 확인
  2. 조회 연도를 빈값으로 두고 돋보기 아이콘을 누르면 전체 연도 데이터가 나타나는지 확인
  3. 특정 항목(예: 예비 국민연금)을 [입력]으로 추가한 후 저장 시 소수점 자리가 정확히 DB에 저장되는지 확인
  4. 엑셀 [다운로드] 버튼 클릭 후 Excel 파일이 정상적으로 열리며 데이터 누락이 없는지 확인

### 2.4 수당/공제항목 관리 화면 (Allowance/Deduction Manager)
- **URL 경로:** `http://localhost:3000/payroll/allowance-deduction-items`
- **테스트 방법:**
  1. 항목코드(예: `BSC`), 항목유형(수당), 과세유형(과세) 등 셀렉트박스 에디터가 정상 작동하는지 확인
  2. [복사] 아이콘 클릭 후 선택된 행이 그대로 새 행으로 '입력' 상태 복제되는지 확인
  3. 새롭게 복제된 행의 항목코드를 겹치지 않게 수정한 뒤 [저장] 시 정상 등록되는지 확인

### 2.5 항목그룹 관리 화면 (Item Group Manager)
- **URL 경로:** `http://localhost:3000/payroll/item-groups`
- **테스트 방법:**
  1. 사무직, 생산직 등 직군별/형태별 그룹 목록 확인
  2. [입력] ➔ 그룹코드(예: `GR-TEMP`), 이름(`계약직 그룹`) 추가 및 저장 테스트

---

## 🚫 3. 예상되는 이슈 및 트러블슈팅

1. **`psycopg` 모듈 누락 에러**
   - 오류: `ModuleNotFoundError: No module named 'psycopg'`
   - 조치: `python -m pip install psycopg[binary]` 재실행
2. **AG Grid 로딩 무한 스피너 또는 "로딩 실패" 알림**
   - 원인: BFF Route 연결 실패 (FastAPI 백엔드가 안켜져 있음)
   - 조치: `main.py` 구동 터미널 로그를 열어 Backend 에러(`500 Internal Server Error`)가 있는지 확인. `uvicorn` 실행 필요.
3. **AG Grid `id: null` 에러 방지**
   - TypeScript 린트 에러를 방지하기 위해 생성 시 임시 부여되는 `-1`, `-2` ID 기반으로 작동하며, 저장 시 `BatchRequest` 에 `undefined`를 넘기는 구조로 변경되었습니다. (프론트엔드 `.tsx` 코드 내 주석 참조)
