# 급여 → 회계전표(Voucher/GL) 모듈 설계 (v0.1)

- Date: 2026-07-08
- Status: draft (R3 — 구현 전 명시적 승인 필요)
- Risk Class: R3 (급여 시맨틱 연결 + DB 신규 테이블)
- Owner: kms
- 근거: 2026-07-08 E2E 감사에서 HR 라이프사이클의 유일한 완전 단절점으로 확인 (급여 `paid` 이후 회계 연계 없음. voucher/journal/GL 관련 엔드포인트·테이블 0개)

## 1. 목표 / 비목표

**목표**
- 급여 run 마감 시점의 회계전표(분개) 자동 생성: 비용 인식(차변) + 공제·미지급 부채(대변)
- 전표는 초안(draft) 생성 → 검토 → 확정(confirmed) 워크플로우
- 계정 매핑이 없는 급여 항목은 전표 생성을 차단하고 누락 리포트 제공

**비목표 (Phase 1 제외)**
- 외부 ERP/회계시스템 전송(IF), 지급 시점의 은행 지급 전표, 원천세 신고 연계, 다통화

## 2. 현행 데이터 근거 (entities.py)

- `pay_payroll_run_items`: item_code, item_name, **direction(earning|deduction)**, amount, tax_type — 전표 라인의 원천
- `pay_payroll_runs`: status draft→calculated→closed→paid (closed에서 스냅샷 고정됨)
- `pay_allowance_deductions`: 급여 항목 마스터 (code 유니크)
- `org_departments.cost_center_code`: 이미 존재 — 부서별 집계에 사용 가능

## 3. 신규 테이블 (4개)

```
gl_accounts                       # 계정과목 마스터
  id, code(uq), name, account_type(expense|liability|asset|equity|revenue),
  is_active, sort_order, created_at, updated_at

pay_gl_mappings                   # 급여항목 → 계정 매핑
  id, pay_item_code(uq w/ effective_from), gl_account_code(fk gl_accounts.code),
  effective_from(date), note, is_active, created_at, updated_at
  # direction은 run item에서 오므로 저장 안 함. earning→차변, deduction→대변 규칙 고정.

pay_vouchers                      # 전표 헤더
  id, voucher_no(uq, 예: PV-202607-0001), run_id(fk pay_payroll_runs, uq),
  voucher_date, status(draft|confirmed|cancelled),
  total_debit, total_credit, summary,
  created_by, confirmed_by, confirmed_at, created_at, updated_at

pay_voucher_lines                 # 전표 라인 (분개)
  id, voucher_id(fk), line_no, gl_account_code, cost_center_code(nullable),
  debit_amount, credit_amount, summary(적요: "2026-07 정기급여 기본급" 등),
  source_item_code, created_at
```

## 4. 분개 규칙 (Phase 1 고정 규칙)

run의 모든 `pay_payroll_run_items`를 (item_code, cost_center) 단위로 집계:

| 원천 | 차변 | 대변 |
|---|---|---|
| earning 항목 합계 | 매핑된 비용계정 (예: 급여비용) | — |
| deduction 항목 합계 | — | 매핑된 부채계정 (예: 소득세예수금, 국민연금예수금, 사내대출상환) |
| 순지급액 (gross − deductions) | — | **미지급급여** (시스템 설정 계정, `pay_gl_settings` 없이 gl_accounts에 `is_net_pay_account` 플래그 1개로 지정) |

- 검증: Σ차변 == Σ대변 아니면 생성 실패 (반올림 차이는 1원 미만 허용 후 조정 라인)
- 매핑 누락 item_code 존재 시: 전표 미생성 + 누락 목록 응답

## 5. 흐름 연결 (급여 시맨틱 — R3 핵심 승인 지점)

```
pay run close (status=closed)
  └─ [신규] POST /api/v1/pay/vouchers/generate {run_id}   # 수동 트리거 (Phase 1은 자동 훅 없음)
       └─ draft 전표 생성 (기존 draft 있으면 재생성 confirm 전만 허용)
전표 검토 → POST /api/v1/pay/vouchers/{id}/confirm
run이 cancel/재계산되면 → 연결 전표 draft는 자동 cancelled
```

**의도적 결정**: payroll_phase2_service(보호 경로)에 훅을 심지 않고 별도 voucher 서비스가 run을 **읽기만** 한다. 급여 계산 로직 무수정 → R3 표면적 최소화. 자동 생성 훅은 Phase 2에서 재평가.

## 6. API (신규 라우터 backend/app/api/pay_voucher.py)

```
GET/POST           /api/v1/pay/gl-accounts          (+batch)
GET/POST           /api/v1/pay/gl-mappings          (+batch)
POST               /api/v1/pay/vouchers/generate    {run_id}
GET                /api/v1/pay/vouchers             ?year_month=&status=
GET                /api/v1/pay/vouchers/{id}        (헤더+라인)
POST               /api/v1/pay/vouchers/{id}/confirm
POST               /api/v1/pay/vouchers/{id}/cancel
GET                /api/v1/pay/vouchers/mapping-gaps ?run_id=   # 매핑 누락 사전 점검
```

액션 권한: menu/action permission 체계 준수 (query/save + confirm은 서버 검증 필수).

## 7. 화면 (3개 — VibeGrid 기반)

| registryKey | variant | 내용 |
|---|---|---|
| `payroll.gl-accounts` | crud | 계정과목 마스터 관리 |
| `payroll.gl-mappings` | crud | 급여항목→계정 매핑 (누락 항목 하이라이트) |
| `payroll.vouchers` | workflow | 전표 목록 + 생성/확정/취소, 라인 상세 패널 |

## 8. 시드 / 더미

- gl_accounts 기본 12종 (급여비용, 상여비용, 미지급급여, 예수금 4종: 소득세/지방소득세/4대보험, 사내대출채권 등)
- 기존 급여 항목 코드 전량 매핑 시드 → 데모에서 즉시 전표 생성 가능하게

## 9. 테스트 전략

- 유닛: 분개 집계(차대평형, 반올림 조정, 매핑 누락 차단), confirm/cancel 상태 전이, run 재계산 시 draft 무효화
- E2E: 기존 `e2e_lifecycle` 흐름 끝에 전표 생성→확정 스텝 추가 (라이프사이클 단절 해소 검증)
- 스키마: Alembic 도입(별도 계획) 전이면 init_db 패치 패턴으로 테이블 생성은 create_all에 위임

## 10. 승인 요청 사항 (R3)

1. Phase 1 범위(마감 시 미지급 전표만, 수동 트리거) 승인
2. 분개 규칙 §4 (earning→비용, deduction→예수금, 순액→미지급급여) 승인
3. 집계 단위: 전사 vs cost_center별 — **cost_center별 기본** 제안
4. 테이블 4종 신규 생성 (DB 스키마 = R3)
