use bigdecimal::num_bigint::BigInt;
use bigdecimal::{BigDecimal, ToPrimitive};
use std::collections::HashMap;
use std::str::FromStr;

/// PayrollService.money constructs BigDecimal from the exact binary float.
/// Multiplying a float by 100 first can introduce a second rounding.
pub fn money(value: f64) -> f64 {
    let result: f64 = format!("{value:.2}").parse().expect("formatted an f64");
    if result == 0.0 { 0.0 } else { result }
}

pub fn whole_won(value: f64) -> f64 {
    let result = value.round_ties_even();
    if result == 0.0 { 0.0 } else { result }
}

/// Unpaid leave uses the decimal representation of the monthly salary,
/// accumulates minutes for the month, and rounds once to whole won.
pub fn unpaid_amount(salary: &BigDecimal, minutes: i64) -> f64 {
    if minutes <= 0 || salary <= &BigDecimal::from(0) {
        return 0.0;
    }
    let (mut numerator, scale) = salary.as_bigint_and_exponent();
    numerator *= minutes;
    let mut denominator = BigInt::from(209 * 60);
    if scale > 0 {
        denominator *= BigInt::from(10).pow(scale as u32);
    } else if scale < 0 {
        numerator *= BigInt::from(10).pow((-scale) as u32);
    }
    let mut rounded = &numerator / &denominator;
    let twice_remainder = (numerator % &denominator) * 2;
    if twice_remainder > denominator
        || (twice_remainder == denominator && &rounded % 2 == BigInt::from(1))
    {
        rounded += 1;
    }
    rounded.to_f64().unwrap_or(f64::INFINITY)
}

#[derive(Debug)]
pub struct TaxRate {
    pub rate_type: String,
    pub employee_rate: Option<f64>,
    pub min_limit: Option<i32>,
    pub max_limit: Option<i32>,
}

#[derive(Debug)]
pub struct IncomeBracket {
    pub annual_from: i32,
    pub annual_to: Option<i32>,
    pub rate: f64,
    pub quick_deduction: f64,
}

#[derive(Debug)]
pub struct Definition {
    pub name: String,
    pub tax_type: String,
    pub calculation_type: String,
}

pub struct Variable {
    pub code: String,
    pub direction: String,
    pub amount: f64,
}

pub struct Welfare {
    pub benefit_code: String,
    pub benefit_name: Option<String>,
    pub master_name: Option<String>,
    pub pay_item_code: Option<String>,
    pub deduction: bool,
    pub requested: i64,
    pub approved: Option<i64>,
}

#[derive(Debug, PartialEq)]
pub struct RunItem {
    pub code: String,
    pub name: Option<String>,
    pub direction: String,
    pub amount: f64,
    pub tax_type: String,
    pub calculation_type: String,
    pub source: &'static str,
}

#[derive(Debug, Default)]
pub struct EmployeeResult {
    pub items: Vec<RunItem>,
    pub warnings: Vec<String>,
    pub gross: f64,
    pub taxable: f64,
    pub non_taxable: f64,
    pub deductions: f64,
    pub net: f64,
}

pub struct PayMasters {
    pub definitions: HashMap<String, Definition>,
    pub rates: Vec<TaxRate>,
    // The Spring query orders by the start of the annual bracket.
    pub brackets: Vec<IncomeBracket>,
}

impl EmployeeResult {
    fn add(&mut self, mut item: RunItem) {
        if item.direction == "earning" {
            self.gross += item.amount;
            if item.tax_type == "non-taxable" {
                self.non_taxable += item.amount;
            } else {
                self.taxable += item.amount;
            }
        } else {
            self.deductions += item.amount;
        }
        item.amount = money(item.amount);
        self.items.push(item);
    }
}

impl PayMasters {
    fn rate(&self, korean: &str, english: &str) -> Option<&TaxRate> {
        self.rates.iter().find(|row| {
            let name = row.rate_type.replace(' ', "").to_lowercase();
            name.contains(korean) || name.contains(english)
        })
    }

    fn apply_statutory(&self, result: &mut EmployeeResult) {
        let pension = self.rate("국민연금", "pension");
        let health = self.rate("건강보험", "health");
        let care = self.rate("장기요양", "long_term_care");
        let employment = self.rate("고용보험", "employment");
        let income = self.rate("소득세", "income_tax");
        let missing: Vec<_> = [
            ("국민연금", pension),
            ("건강보험", health),
            ("장기요양", care),
            ("고용보험", employment),
        ]
        .into_iter()
        .filter_map(|(name, rate)| rate.is_none().then_some(name))
        .collect();
        if !missing.is_empty() {
            result
                .warnings
                .push(format!("missing tax rate master: {}", missing.join(", ")));
        }
        let taxable = result.taxable;
        let contribution = |rate| money(rate_base(taxable, rate) * percent(rate) / 100.0);
        let health_amount = contribution(health);
        let care_amount = if health_amount > 0.0 && percent(health) > 0.0 && percent(care) > 0.0 {
            money(health_amount * percent(care) / percent(health))
        } else {
            contribution(care)
        };
        let (income_amount, warning) = self.income_tax(rate_base(taxable, income), income);
        if let Some(warning) = warning {
            result.warnings.push(warning.to_owned());
        }
        for (code, name, tax_type, amount) in [
            ("PEN", "국민연금", "insurance", contribution(pension)),
            ("HIN", "건강보험", "insurance", health_amount),
            ("LTC", "장기요양", "insurance", care_amount),
            ("EMP", "고용보험", "insurance", contribution(employment)),
            ("ITX", "소득세", "tax", income_amount),
            ("LTX", "지방소득세", "tax", money(income_amount * 0.1)),
        ] {
            if amount > 0.0 {
                let definition = self.definitions.get(code);
                result.add(RunItem {
                    code: code.to_owned(),
                    name: Some(definition.map_or(name, |d| &d.name).to_owned()),
                    direction: "deduction".into(),
                    amount,
                    tax_type: definition.map_or(tax_type, |d| &d.tax_type).to_owned(),
                    calculation_type: definition
                        .map_or("formula", |d| &d.calculation_type)
                        .to_owned(),
                    source: "system",
                });
            }
        }
    }

    fn income_tax(&self, taxable: f64, fallback: Option<&TaxRate>) -> (f64, Option<&'static str>) {
        if taxable <= 0.0 {
            return (0.0, None);
        }
        let annual = taxable * 12.0;
        for bracket in &self.brackets {
            if annual >= f64::from(bracket.annual_from)
                && bracket
                    .annual_to
                    .is_none_or(|limit| annual <= f64::from(limit))
            {
                let liability = (annual * bracket.rate / 100.0 - bracket.quick_deduction).max(0.0);
                return (money(liability / 12.0), None);
            }
        }
        match fallback {
            Some(rate) => (
                money(rate_base(taxable, fallback) * percent(Some(rate)) / 100.0),
                Some("income tax bracket master missing; legacy flat tax rate used"),
            ),
            None => (0.0, Some("income tax bracket master missing")),
        }
    }

    pub fn calculate_employee(
        &self,
        base_salary: f64,
        approved_minutes: i64,
        review_names: &[String],
        variables: &[Variable],
        benefits: &[Welfare],
    ) -> EmployeeResult {
        let mut result = EmployeeResult::default();
        result.add(RunItem {
            code: "BSC".into(),
            name: Some("기본급".into()),
            amount: base_salary,
            direction: "earning".into(),
            tax_type: "taxable".into(),
            calculation_type: "fixed".into(),
            source: "snapshot",
        });
        if !review_names.is_empty() {
            result
                .warnings
                .push(format!("payroll events: {}", review_names.join(", ")));
        }
        for variable in variables {
            let definition = self.definitions.get(&variable.code);
            result.add(RunItem {
                code: variable.code.clone(),
                name: Some(definition.map_or(&variable.code, |d| &d.name).clone()),
                direction: variable.direction.clone(),
                amount: variable.amount,
                tax_type: definition.map_or("taxable", |d| &d.tax_type).to_owned(),
                calculation_type: definition
                    .map_or("manual", |d| &d.calculation_type)
                    .to_owned(),
                source: "variable",
            });
        }
        if approved_minutes > 0 {
            let salary =
                BigDecimal::from_str(&base_salary.to_string()).expect("finite snapshot salary");
            let unpaid = unpaid_amount(&salary, approved_minutes);
            if unpaid > 0.0 {
                result.add(RunItem {
                    code: "TIM_UNPAID".into(),
                    name: Some("무급휴가공제".into()),
                    direction: "deduction".into(),
                    amount: unpaid,
                    tax_type: "tax".into(),
                    calculation_type: "hourly".into(),
                    source: "tim_leave",
                });
            }
        }
        for benefit in benefits {
            let amount = benefit
                .approved
                .filter(|v| *v != 0)
                .unwrap_or(benefit.requested);
            if amount <= 0 {
                continue;
            }
            let code = benefit
                .pay_item_code
                .as_ref()
                .filter(|code| !code.trim().is_empty())
                .unwrap_or(&benefit.benefit_code);
            let definition = self.definitions.get(code);
            let name = definition
                .map(|d| &d.name)
                .or_else(|| {
                    benefit
                        .benefit_name
                        .as_ref()
                        .filter(|name| !name.trim().is_empty())
                })
                .or(benefit.master_name.as_ref());
            let tax_type = if benefit.deduction { "tax" } else { "taxable" };
            result.add(RunItem {
                code: code.clone(),
                name: name.cloned(),
                direction: if benefit.deduction {
                    "deduction"
                } else {
                    "earning"
                }
                .into(),
                amount: amount as f64,
                tax_type: definition.map_or(tax_type, |d| &d.tax_type).to_owned(),
                calculation_type: definition
                    .map_or("fixed", |d| &d.calculation_type)
                    .to_owned(),
                source: "welfare",
            });
        }
        self.apply_statutory(&mut result);
        result.net = money(result.gross - result.deductions);
        if result.net < 0.0 {
            result.warnings.push("net_pay is negative".into());
        }
        result.gross = money(result.gross);
        result.taxable = money(result.taxable);
        result.non_taxable = money(result.non_taxable);
        result.deductions = money(result.deductions);
        result
    }
}

fn percent(row: Option<&TaxRate>) -> f64 {
    row.and_then(|r| r.employee_rate).unwrap_or_default()
}

fn rate_base(mut amount: f64, rate: Option<&TaxRate>) -> f64 {
    if amount <= 0.0 {
        return 0.0;
    }
    if let Some(min) = rate.and_then(|r| r.min_limit) {
        amount = amount.max(f64::from(min));
    }
    if let Some(max) = rate.and_then(|r| r.max_limit) {
        amount = amount.min(f64::from(max));
    }
    money(amount)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn masters() -> PayMasters {
        PayMasters {
            definitions: HashMap::new(),
            rates: vec![],
            brackets: vec![],
        }
    }

    #[test]
    fn legacy_double_money_uses_binary_half_even() {
        for (value, expected) in [
            (1.005, 1.0),
            (2.345, 2.35),
            (2.355, 2.35),
            (123.455, 123.45),
            (0.125, 0.12),
            (0.375, 0.38),
            (-2.355, -2.35),
        ] {
            assert_eq!(money(value), expected);
        }
        assert_eq!(whole_won(12.5), 12.0);
        assert_eq!(whole_won(13.5), 14.0);
    }

    #[test]
    fn automatic_monthly_unpaid_uses_decimal_half_even() {
        for (salary, minutes, expected) in [
            ("209", 30, 0.0),
            ("627", 30, 2.0),
            ("2090", 30, 5.0),
            ("2.09e6", 480, 80000.0),
            ("125.4", 50, 0.0),
            ("376.2", 50, 2.0),
            ("300", 0, 0.0),
        ] {
            assert_eq!(unpaid_amount(&salary.parse().unwrap(), minutes), expected);
        }
    }

    #[test]
    fn manual_and_automatic_unpaid_are_independent() {
        let variable = Variable {
            code: "MANUAL".into(),
            direction: "deduction".into(),
            amount: 5000.0,
        };
        let masters = masters();
        let pay =
            masters.calculate_employee(2090000.0, 480, &[], std::slice::from_ref(&variable), &[]);
        assert_eq!(
            (pay.gross, pay.taxable, pay.deductions, pay.net),
            (2090000.0, 2090000.0, 85000.0, 2005000.0)
        );
        assert_eq!(
            pay.items
                .iter()
                .find(|i| i.code == "TIM_UNPAID")
                .unwrap()
                .source,
            "tim_leave"
        );
        let cancelled = masters.calculate_employee(2090000.0, 0, &[], &[variable], &[]);
        assert_eq!(cancelled.deductions, 5000.0);
        assert!(cancelled.items.iter().all(|i| i.code != "TIM_UNPAID"));
    }

    #[test]
    fn welfare_golden_totals_and_review_order_match_spring() {
        let mut masters = masters();
        masters.definitions.insert(
            "MEAL".into(),
            Definition {
                name: "식대".into(),
                tax_type: "non-taxable".into(),
                calculation_type: "fixed".into(),
            },
        );
        let benefits = [
            Welfare {
                benefit_code: "MEAL_BENEFIT".into(),
                benefit_name: None,
                master_name: None,
                pay_item_code: Some("MEAL".into()),
                deduction: false,
                requested: 180,
                approved: Some(200),
            },
            Welfare {
                benefit_code: "LOAN".into(),
                benefit_name: Some("사내대출상환".into()),
                master_name: None,
                pay_item_code: None,
                deduction: true,
                requested: 50,
                approved: None,
            },
        ];
        let pay = masters.calculate_employee(
            1100.0,
            0,
            &["기본급 변경".into(), "무급휴가 승인".into()],
            &[],
            &benefits,
        );
        assert_eq!(
            (
                pay.gross,
                pay.deductions,
                pay.net,
                pay.taxable,
                pay.non_taxable
            ),
            (1300.0, 50.0, 1250.0, 1100.0, 200.0)
        );
        assert_eq!(
            pay.warnings,
            [
                "payroll events: 기본급 변경, 무급휴가 승인",
                "missing tax rate master: 국민연금, 건강보험, 장기요양, 고용보험",
                "income tax bracket master missing"
            ]
        );
    }

    #[test]
    fn brackets_are_inclusive_and_health_cap_affects_long_term_care() {
        let mut masters = masters();
        for (name, percent, cap) in [
            ("PENSION", 3.0, None),
            ("건강 보험", 4.0, Some(1000)),
            ("long_term_care", 0.4, None),
            ("employment", 1.0, None),
            ("income_tax", 9.0, None),
        ] {
            masters.rates.push(TaxRate {
                rate_type: name.into(),
                employee_rate: Some(percent),
                min_limit: None,
                max_limit: cap,
            });
        }
        masters.brackets.push(IncomeBracket {
            annual_from: 0,
            annual_to: Some(24000),
            rate: 10.0,
            quick_deduction: 120.0,
        });
        let pay = masters.calculate_employee(2000.0, 0, &[], &[], &[]);
        let items: Vec<_> = pay
            .items
            .iter()
            .map(|i| (i.code.as_str(), i.amount))
            .collect();
        assert_eq!(
            items,
            [
                ("BSC", 2000.0),
                ("PEN", 60.0),
                ("HIN", 40.0),
                ("LTC", 4.0),
                ("EMP", 20.0),
                ("ITX", 190.0),
                ("LTX", 19.0)
            ]
        );
        assert!(pay.warnings.is_empty());
        let fallback = masters.calculate_employee(2001.0, 0, &[], &[], &[]);
        assert_eq!(
            fallback.warnings,
            ["income tax bracket master missing; legacy flat tax rate used"]
        );
        assert_eq!(
            fallback
                .items
                .iter()
                .find(|i| i.code == "ITX")
                .unwrap()
                .amount,
            180.09
        );
    }
}
