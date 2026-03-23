# $vibe-payroll — Payroll Safety Guard

## Trigger
Keywords: `vibe-payroll`, `payroll change`, `급여변경`, `급여수정`

## Description
Enforces R3-level safety protocols when modifying payroll-related code.
Payroll is the highest-risk domain in Vibe-HR. All changes require explicit approval.

## Protected Paths
- `backend/app/api/payroll_phase2.py`
- `backend/app/services/payroll_phase2_service.py`
- `backend/app/schemas/payroll_phase2.py`
- `backend/app/services/payslip_pdf_service.py`
- `backend/app/services/tim_month_close_service.py` (TIM→PAY pipeline)

## Steps
1. **Risk Assessment**: Identify which protected files are affected.
2. **Approval Gate**: Display the affected files and ask for explicit user approval before any code changes.
3. **Impact Analysis**: Check which payroll calculation paths are affected:
   - Base salary calculation
   - Overtime/night/holiday multipliers (OTX×1.5, NGT×0.5, HDW×1.5, HDO×2.0, HDN×2.0)
   - Tax calculation (income tax brackets)
   - Deduction calculation
   - Net pay calculation
4. **Pre-change Snapshot**: Run `pytest -k payroll` to establish baseline.
5. **Implementation**: Make the approved changes.
6. **Post-change Verification**: Run `pytest -k payroll` again and compare results.
7. **Evidence**: Record in `docs/TASK_LEDGER.md`.

## Rules
- NEVER change payroll multiplier values without explicit approval.
- NEVER modify `calculate_payroll_run()` logic without understanding the full pipeline.
- Always verify that `_generate_pay_variable_inputs()` produces correct amounts.
- Cross-check: base_hourly = base_salary / 209 (법정 월 소정근로시간).

## Completion
Report: changed files, test results before/after, payroll calculation diff if applicable.
