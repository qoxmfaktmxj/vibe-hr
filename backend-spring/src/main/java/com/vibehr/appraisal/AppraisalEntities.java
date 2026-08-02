package com.vibehr.appraisal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

@Entity(name = "PapFinalResult")
@Table(name = "\"PAP_FINAL_RESULTS\"")
class PapFinalResult {
    protected PapFinalResult() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Integer id;
    @Column(nullable = false, length = 30) String result_code;
    @Column(nullable = false, length = 120) String result_name;
    Double score_grade;
    @Column(nullable = false) boolean is_active;
    @Column(nullable = false) int sort_order;
    @Column(length = 500) String description;
    @Column(nullable = false) Instant created_at;
    @Column(nullable = false) Instant updated_at;
}

@Entity(name = "PapAppraisalMaster")
@Table(name = "\"PAP_APPRAISAL_MASTERS\"")
class PapAppraisalMaster {
    protected PapAppraisalMaster() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Integer id;
    @Column(nullable = false, length = 30) String appraisal_code;
    @Column(nullable = false, length = 120) String appraisal_name;
    @Column(nullable = false) int appraisal_year;
    Integer final_result_id;
    @Column(length = 40) String appraisal_type;
    LocalDate start_date;
    LocalDate end_date;
    @Column(nullable = false) boolean is_active;
    @Column(nullable = false) int sort_order;
    @Column(length = 500) String description;
    @Column(nullable = false) Instant created_at;
    @Column(nullable = false) Instant updated_at;
}

@Entity(name = "PapAppraisalTarget")
@Table(name = "pap_appraisal_targets")
class PapAppraisalTarget {
    protected PapAppraisalTarget() { }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Integer id;
    @Column(nullable = false) int appraisal_id;
    @Column(nullable = false) int employee_id;
    Double score;
    @Column(length = 30) String grade_code;
    @Column(length = 2000) String evaluator_note;
    @Column(nullable = false, length = 20) String status;
    Instant evaluated_at;
    @Column(nullable = false) Instant created_at;
    @Column(nullable = false) Instant updated_at;
}
