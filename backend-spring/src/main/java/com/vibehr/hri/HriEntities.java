package com.vibehr.hri;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.time.LocalDate;
import org.hibernate.annotations.Check;

@MappedSuperclass
abstract class HriAudit {
    @Column(nullable = false) public Instant created_at;
    @Column(nullable = false) public Instant updated_at;
}

@Entity(name = "HriFormType")
@Table(name = "hri_form_types",
        uniqueConstraints = @UniqueConstraint(name = "uq_hri_form_types_form_code", columnNames = "form_code"),
        indexes = @Index(name = "ix_hri_form_types_form_code", columnList = "form_code"))
class HriFormType extends HriAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false, length = 30) public String form_code;
    @Column(nullable = false, length = 100) public String form_name_ko;
    @Column(length = 100) public String form_name_en;
    @Column(nullable = false, length = 30) public String module_code;
    @Column(nullable = false) public boolean is_active;
    @Column(nullable = false) public boolean allow_draft;
    @Column(nullable = false) public boolean allow_withdraw;
    @Column(nullable = false) public boolean requires_receive;
    @Column(nullable = false) public int default_priority;
    public Integer created_by;
    public Integer updated_by;
}

@Entity(name = "HriFormTypePolicy")
@Table(name = "hri_form_type_policies",
        uniqueConstraints = @UniqueConstraint(name = "uq_hri_form_type_policies_key_period",
                columnNames = {"form_type_id", "policy_key", "effective_from"}),
        indexes = @Index(name = "ix_hri_form_type_policies_form_type_id", columnList = "form_type_id"))
class HriFormTypePolicy extends HriAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int form_type_id;
    @Column(nullable = false, length = 50) public String policy_key;
    @Column(nullable = false, length = 500) public String policy_value;
    @Column(nullable = false) public LocalDate effective_from;
    public LocalDate effective_to;
}

@Entity(name = "HriApprovalLineTemplate")
@Table(name = "hri_approval_line_templates",
        uniqueConstraints = @UniqueConstraint(name = "uq_hri_approval_line_templates_code", columnNames = "template_code"),
        indexes = {
                @Index(name = "ix_hri_approval_line_templates_scope_id", columnList = "scope_id"),
                @Index(name = "ix_hri_approval_line_templates_template_code", columnList = "template_code")
        })
@Check(name = "ck_hri_approval_line_templates_scope_type",
        constraints = "scope_type IN ('GLOBAL', 'COMPANY', 'DEPT', 'TEAM', 'USER')")
class HriApprovalLineTemplate extends HriAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false, length = 30) public String template_code;
    @Column(nullable = false, length = 100) public String template_name;
    @Column(nullable = false, length = 20) public String scope_type;
    @Column(length = 40) public String scope_id;
    @Column(nullable = false) public boolean is_default;
    @Column(nullable = false) public boolean is_active;
    @Column(nullable = false) public int priority;
}

@Entity(name = "HriApprovalLineStep")
@Table(name = "hri_approval_line_steps",
        uniqueConstraints = @UniqueConstraint(name = "uq_hri_approval_line_steps_order",
                columnNames = {"template_id", "step_order"}),
        indexes = @Index(name = "ix_hri_approval_line_steps_template_id", columnList = "template_id"))
@Check(name = "ck_hri_approval_line_steps_actor_resolve_type",
        constraints = "actor_resolve_type IN ('ROLE_BASED', 'USER_FIXED')")
@Check(name = "ck_hri_approval_line_steps_required_action", constraints = "required_action IN ('APPROVE', 'RECEIVE')")
@Check(name = "ck_hri_approval_line_steps_step_type", constraints = "step_type IN ('APPROVAL', 'RECEIVE', 'REFERENCE')")
class HriApprovalLineStep extends HriAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int template_id;
    @Column(nullable = false) public int step_order;
    @Column(nullable = false, length = 20) public String step_type;
    @Column(nullable = false, length = 30) public String actor_resolve_type;
    @Column(length = 30) public String actor_role_code;
    public Integer actor_user_id;
    @Column(nullable = false) public boolean allow_delegate;
    @Column(nullable = false, length = 20) public String required_action;
}

@Entity(name = "HriFormTypeApprovalMap")
@Table(name = "hri_form_type_approval_maps",
        uniqueConstraints = @UniqueConstraint(name = "uq_hri_form_type_approval_maps_link",
                columnNames = {"form_type_id", "template_id", "effective_from"}),
        indexes = {
                @Index(name = "ix_hri_form_type_approval_maps_form_type_id", columnList = "form_type_id"),
                @Index(name = "ix_hri_form_type_approval_maps_template_id", columnList = "template_id")
        })
class HriFormTypeApprovalMap extends HriAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int form_type_id;
    @Column(nullable = false) public int template_id;
    @Column(nullable = false) public boolean is_active;
    @Column(nullable = false) public LocalDate effective_from;
    public LocalDate effective_to;
}

@Entity(name = "HriApprovalActorRule")
@Table(name = "hri_approval_actor_rules",
        uniqueConstraints = @UniqueConstraint(name = "uq_hri_approval_actor_rules_role_code", columnNames = "role_code"),
        indexes = @Index(name = "ix_hri_approval_actor_rules_role_code", columnList = "role_code"))
@Check(name = "ck_hri_approval_actor_rules_fallback_rule", constraints = "fallback_rule IN ('ESCALATE', 'SKIP', 'HR_ADMIN')")
@Check(name = "ck_hri_approval_actor_rules_resolve_method", constraints = "resolve_method IN ('ORG_CHAIN', 'JOB_POSITION', 'FIXED_USER')")
class HriApprovalActorRule extends HriAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false, length = 30) public String role_code;
    @Column(nullable = false, length = 30) public String resolve_method;
    @Column(nullable = false, length = 30) public String fallback_rule;
    @Column(columnDefinition = "varchar") public String position_keywords_json;
    @Column(nullable = false) public boolean is_active;
}

@Entity(name = "HriRequestMaster")
@Table(name = "hri_request_masters",
        uniqueConstraints = @UniqueConstraint(name = "uq_hri_request_masters_request_no", columnNames = "request_no"),
        indexes = {
                @Index(name = "ix_hri_request_masters_form_type_id", columnList = "form_type_id"),
                @Index(name = "ix_hri_request_masters_request_no", columnList = "request_no"),
                @Index(name = "ix_hri_request_masters_requester_created_at", columnList = "requester_id, created_at"),
                @Index(name = "ix_hri_request_masters_requester_id", columnList = "requester_id"),
                @Index(name = "ix_hri_request_masters_status_created_at", columnList = "status_code, created_at")
        })
@Check(name = "ck_hri_request_masters_status_code",
        constraints = "status_code IN ('DRAFT','APPROVAL_IN_PROGRESS','APPROVAL_REJECTED','RECEIVE_IN_PROGRESS','RECEIVE_REJECTED','COMPLETED','WITHDRAWN')")
class HriRequestMaster extends HriAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false, length = 40) public String request_no;
    @Column(nullable = false) public int form_type_id;
    @Column(nullable = false) public int requester_id;
    public Integer requester_org_id;
    @Column(nullable = false, length = 200) public String title;
    @Column(nullable = false, columnDefinition = "varchar") public String content_json;
    @Column(nullable = false, length = 30) public String status_code;
    public Integer current_step_order;
    public Instant submitted_at;
    public Instant completed_at;
}

@Entity(name = "HriRequestStepSnapshot")
@Table(name = "hri_request_step_snapshots",
        uniqueConstraints = @UniqueConstraint(name = "uq_hri_request_step_snapshots_request_step",
                columnNames = {"request_id", "step_order"}),
        indexes = {
                @Index(name = "ix_hri_request_step_snapshots_actor_status", columnList = "actor_user_id, action_status"),
                @Index(name = "ix_hri_request_step_snapshots_actor_user_id", columnList = "actor_user_id"),
                @Index(name = "ix_hri_request_step_snapshots_request_id", columnList = "request_id")
        })
@Check(name = "ck_hri_request_step_snapshots_action_status",
        constraints = "action_status IN ('WAITING', 'APPROVED', 'REJECTED', 'RECEIVED')")
@Check(name = "ck_hri_request_step_snapshots_step_type", constraints = "step_type IN ('APPROVAL', 'RECEIVE', 'REFERENCE')")
class HriRequestStepSnapshot extends HriAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int request_id;
    @Column(nullable = false) public int step_order;
    @Column(nullable = false, length = 20) public String step_type;
    @Column(nullable = false) public int actor_user_id;
    @Column(nullable = false, length = 100) public String actor_name;
    public Integer actor_org_id;
    @Column(length = 30) public String actor_role_code;
    @Column(nullable = false, length = 20) public String action_status;
    public Instant acted_at;
    @Column(length = 1000) public String comment;
}

@Entity(name = "HriRequestHistory")
@Table(name = "hri_request_histories", indexes = {
        @Index(name = "ix_hri_request_histories_actor_created_at", columnList = "actor_user_id, created_at"),
        @Index(name = "ix_hri_request_histories_event_type", columnList = "event_type"),
        @Index(name = "ix_hri_request_histories_request_created_at", columnList = "request_id, created_at"),
        @Index(name = "ix_hri_request_histories_request_id", columnList = "request_id")
})
class HriRequestHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int request_id;
    @Column(nullable = false, length = 30) public String event_type;
    @Column(length = 30) public String from_status;
    @Column(length = 30) public String to_status;
    @Column(nullable = false) public int actor_user_id;
    @Column(length = 45) public String actor_ip;
    @Column(columnDefinition = "varchar") public String event_payload_json;
    @Column(nullable = false) public Instant created_at;
}

@Entity(name = "HriRequestAttachment")
@Table(name = "hri_request_attachments", indexes = {
        @Index(name = "ix_hri_request_attachments_request_id", columnList = "request_id"),
        @Index(name = "ix_hri_request_attachments_request_uploaded_at", columnList = "request_id, uploaded_at")
})
class HriRequestAttachment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int request_id;
    @Column(nullable = false, length = 300) public String file_key;
    @Column(nullable = false, length = 255) public String file_name;
    @Column(nullable = false) public int file_size;
    @Column(length = 120) public String mime_type;
    @Column(nullable = false) public int uploaded_by;
    @Column(nullable = false) public Instant uploaded_at;
}

@Entity(name = "HriRequestCounter") @Table(name = "hri_request_counters")
class HriRequestCounter {
    @Id @Column(length = 80) public String counter_key;
    @Column(nullable = false) public int last_seq;
    @Column(nullable = false) public Instant updated_at;
}

@Entity(name = "HriReqTimAttendance")
@Table(name = "hri_req_tim_attendance",
        uniqueConstraints = @UniqueConstraint(name = "uq_hri_req_tim_attendance_request_id", columnNames = "request_id"),
        indexes = {
                @Index(name = "ix_hri_req_tim_attendance_dates", columnList = "start_date, end_date"),
                @Index(name = "ix_hri_req_tim_attendance_request_id", columnList = "request_id")
        })
class HriReqTimAttendance extends HriAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int request_id;
    @Column(nullable = false, length = 30) public String attendance_code;
    @Column(nullable = false) public LocalDate start_date;
    @Column(nullable = false) public LocalDate end_date;
    @Column(length = 5) public String start_time;
    @Column(length = 5) public String end_time;
    @Column(nullable = false) public int applied_minutes;
    @Column(length = 1000) public String reason;
}

@Entity(name = "HriReqTimCorrection")
@Table(name = "hri_req_tim_correction",
        uniqueConstraints = @UniqueConstraint(name = "uq_hri_req_tim_correction_request_id", columnNames = "request_id"),
        indexes = {
                @Index(name = "ix_hri_req_tim_correction_request_id", columnList = "request_id"),
                @Index(name = "ix_hri_req_tim_correction_work_date", columnList = "work_date")
        })
class HriReqTimCorrection extends HriAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int request_id;
    @Column(nullable = false) public LocalDate work_date;
    @Column(nullable = false, length = 30) public String before_status;
    @Column(nullable = false, length = 30) public String after_status;
    @Column(length = 1000) public String reason;
}

@Entity(name = "HriReqCertEmployment")
@Table(name = "hri_req_cert_employment",
        uniqueConstraints = @UniqueConstraint(name = "uq_hri_req_cert_employment_request_id", columnNames = "request_id"),
        indexes = @Index(name = "ix_hri_req_cert_employment_request_id", columnList = "request_id"))
class HriReqCertEmployment extends HriAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int request_id;
    @Column(nullable = false, length = 200) public String purpose;
    @Column(nullable = false) public int copies;
    @Column(length = 200) public String recipient;
    @Column(length = 1000) public String reason;
}

@Entity(name = "HriReqLeave")
@Table(name = "hri_req_leave",
        uniqueConstraints = @UniqueConstraint(name = "uq_hri_req_leave_request_id", columnNames = "request_id"),
        indexes = {
                @Index(name = "ix_hri_req_leave_dates", columnList = "start_date, end_date"),
                @Index(name = "ix_hri_req_leave_request_id", columnList = "request_id")
        })
class HriReqLeave extends HriAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Integer id;
    @Column(nullable = false) public int request_id;
    @Column(nullable = false, length = 30) public String leave_type_code;
    @Column(nullable = false) public LocalDate start_date;
    @Column(nullable = false) public LocalDate end_date;
    @Column(length = 5) public String start_time;
    @Column(length = 5) public String end_time;
    @Column(nullable = false) public int applied_minutes;
    @Column(length = 1000) public String reason;
}
