package com.vibehr.hr;

import java.math.BigDecimal;
import java.math.MathContext;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;

/** The persistence schema is double precision; calculations use DECIMAL128 then return the legacy double representation. */
final class HrSeveranceMath {
    static final int MIN_SERVICE_DAYS = 365;
    private static final MathContext LEGACY_CONTEXT = MathContext.DECIMAL128;
    private HrSeveranceMath() { }

    static int serviceDays(LocalDate hire, LocalDate retire) { return Math.toIntExact(ChronoUnit.DAYS.between(hire, retire) + 1); }
    static LocalDate[] averageWagePeriod(LocalDate retire) {
        LocalDate end = retire.minusDays(1);
        return new LocalDate[] { end.minusMonths(3).plusDays(1), end };
    }
    static int baseDays(LocalDate from, LocalDate to) { return Math.toIntExact(ChronoUnit.DAYS.between(from, to) + 1); }
    static boolean overlapsMonth(String yearMonth, LocalDate from, LocalDate to) {
        YearMonth month = YearMonth.parse(yearMonth);
        return !month.atEndOfMonth().isBefore(from) && !month.atDay(1).isAfter(to);
    }
    static double severance(double averageDailyWage, int serviceDays) {
        if (serviceDays < MIN_SERVICE_DAYS) return 0d;
        double serviceRatio = divide(serviceDays, 365d);
        return multiply(multiply(averageDailyWage, 30d), serviceRatio);
    }
    static double taxableBase(double finalAmount, int serviceDays) {
        int years = serviceYears(serviceDays);
        if (serviceDays < MIN_SERVICE_DAYS || finalAmount <= 0d) return 0d;
        double deduction = serviceDeduction(years);
        double conversion = divide(multiply(Math.max(subtract(finalAmount, deduction), 0d), 12d), years);
        return Math.max(subtract(conversion, conversionDeduction(conversion)), 0d);
    }
    static Map<String, Object> tax(double finalAmount, int serviceDays, double ratePercent, double quickDeduction, Integer bracketYear, String warning) {
        int years = serviceYears(serviceDays);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("service_years", years);
        if (serviceDays < MIN_SERVICE_DAYS || finalAmount <= 0d) {
            for (String key : new String[] { "service_year_deduction", "conversion_income", "conversion_income_deduction", "taxable_base", "base_tax_rate", "quick_deduction", "converted_calculated_tax", "income_tax", "local_income_tax" }) result.put(key, 0d);
            result.put("net_severance", finalAmount); result.put("tax_table_year", null); result.put("warning", null); return result;
        }
        double deduction = serviceDeduction(years);
        double conversion = divide(multiply(Math.max(subtract(finalAmount, deduction), 0d), 12d), years);
        double conversionDeduction = conversionDeduction(conversion);
        double taxable = Math.max(subtract(conversion, conversionDeduction), 0d);
        double calculated = Math.max(subtract(multiply(taxable, divide(ratePercent, 100d)), quickDeduction), 0d);
        double incomeTax = multiply(divide(calculated, 12d), years);
        double localTax = multiply(incomeTax, .1d);
        result.put("service_year_deduction", deduction); result.put("conversion_income", conversion);
        result.put("conversion_income_deduction", conversionDeduction); result.put("taxable_base", taxable);
        result.put("base_tax_rate", ratePercent); result.put("quick_deduction", quickDeduction); result.put("converted_calculated_tax", calculated);
        result.put("income_tax", incomeTax); result.put("local_income_tax", localTax); result.put("net_severance", subtract(subtract(finalAmount, incomeTax), localTax));
        result.put("tax_table_year", 2026); result.put("bracket_year", bracketYear); result.put("warning", warning);
        return result;
    }
    private static int serviceYears(int serviceDays) { return serviceDays <= 0 ? 0 : Math.max(1, (int) Math.ceil(serviceDays / 365d)); }
    private static double serviceDeduction(int years) {
        if (years <= 5) return multiply(years, 1_000_000d);
        if (years <= 10) return 5_000_000d + (years - 5) * 2_000_000d;
        if (years <= 20) return 15_000_000d + (years - 10) * 2_500_000d;
        return 40_000_000d + (years - 20) * 3_000_000d;
    }
    private static double conversionDeduction(double value) {
        if (value <= 8_000_000d) return value;
        if (value <= 70_000_000d) return add(8_000_000d, multiply(subtract(value, 8_000_000d), .6d));
        if (value <= 100_000_000d) return add(45_200_000d, multiply(subtract(value, 70_000_000d), .55d));
        if (value <= 300_000_000d) return add(61_700_000d, multiply(subtract(value, 100_000_000d), .45d));
        return add(151_700_000d, multiply(subtract(value, 300_000_000d), .35d));
    }
    private static double add(double left, double right) { return exact(left).add(exact(right)).doubleValue(); }
    private static double subtract(double left, double right) { return exact(left).subtract(exact(right)).doubleValue(); }
    private static double multiply(double left, double right) { return exact(left).multiply(exact(right)).doubleValue(); }
    private static double divide(double left, double right) { return exact(left).divide(exact(right), LEGACY_CONTEXT).doubleValue(); }
    private static BigDecimal exact(double value) { return new BigDecimal(value); }
}
