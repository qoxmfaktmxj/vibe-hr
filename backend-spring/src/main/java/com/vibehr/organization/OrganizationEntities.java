package com.vibehr.organization;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.time.LocalDate;

/**
 * This package is the full write owner for org_corporations, org_departments, and org_* tables.
 * Reference entities deliberately use scalar IDs to avoid taking ownership of auth, HR, or code tables.
 */
@Entity(name = "OrgCorporation")
@Table(name = "org_corporations", uniqueConstraints = {
        @UniqueConstraint(name = "uq_org_corporations_enter_cd", columnNames = "enter_cd"),
        @UniqueConstraint(name = "uq_org_corporations_company_code", columnNames = "company_code")
}, indexes = {
        @Index(name = "ix_org_corporations_enter_cd", columnList = "enter_cd"),
        @Index(name = "ix_org_corporations_company_code", columnList = "company_code")
})
class OrgCorporation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Integer id;
    @Column(name = "enter_cd", nullable = false, length = 20) String enterCd;
    @Column(name = "company_code", nullable = false, length = 20) String companyCode;
    @Column(name = "corporation_name", nullable = false, length = 120) String corporationName;
    @Column(name = "corporation_number", length = 30) String corporationNumber;
    @Column(name = "business_number", length = 30) String businessNumber;
    @Column(name = "company_seal_url", length = 500) String companySealUrl;
    @Column(name = "certificate_seal_url", length = 500) String certificateSealUrl;
    @Column(name = "company_logo_url", length = 500) String companyLogoUrl;
    @Column(name = "is_active", nullable = false) boolean active;
    @Column(name = "created_at", nullable = false, columnDefinition = "timestamp") Instant createdAt;
    @Column(name = "updated_at", nullable = false, columnDefinition = "timestamp") Instant updatedAt;
}

@Entity(name = "OrgDepartment")
@Table(name = "org_departments", indexes = @Index(name = "ix_org_departments_code", columnList = "code", unique = true))
class OrgDepartment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Integer id;
    @Column(nullable = false, length = 30) String code;
    @Column(nullable = false, length = 100) String name;
    @Column(name = "parent_id") Integer parentId;
    @Column(name = "organization_type", length = 50) String organizationType;
    @Column(name = "cost_center_code", length = 30) String costCenterCode;
    @Column(length = 500) String description;
    @Column(name = "is_active", nullable = false) boolean active;
    @Column(name = "created_at", nullable = false, columnDefinition = "timestamp") Instant createdAt;
    @Column(name = "updated_at", nullable = false, columnDefinition = "timestamp") Instant updatedAt;
}

@Entity(name = "OrgMappingTypeItem")
@Table(name = "org_mapping_type_items", uniqueConstraints = @UniqueConstraint(name = "uq_org_mapping_type_items_id_type", columnNames = {"id", "type_code"}),
        indexes = @Index(name = "ix_org_mapping_type_items_type_item_from", columnList = "type_code,item_code,effective_from"))
class OrgMappingTypeItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Integer id;
    @Column(name = "type_code", nullable = false, length = 50) String typeCode;
    @Column(name = "item_code", nullable = false, length = 50) String itemCode;
    @Column(nullable = false, length = 100) String name;
    @Column(name = "effective_from", nullable = false) LocalDate effectiveFrom;
    @Column(name = "effective_to") LocalDate effectiveTo;
    @Column(name = "erp_employee_code", length = 50) String erpEmployeeCode;
    @Column(name = "cost_center_type", length = 50) String costCenterType;
    @Column(length = 500) String remark;
    @Column(name = "sort_order", nullable = false) int sortOrder;
    @Column(name = "is_active", nullable = false) boolean active;
    @Column(name = "created_by") Integer createdBy;
    @Column(name = "updated_by") Integer updatedBy;
    @Column(name = "created_at", nullable = false) Instant createdAt;
    @Column(name = "updated_at", nullable = false) Instant updatedAt;
}

@Entity(name = "OrgMappingAssignment")
@Table(name = "org_mapping_assignments", indexes = {
        @Index(name = "ix_org_mapping_assignments_department_type_from", columnList = "department_id,type_code,effective_from"),
        @Index(name = "ix_org_mapping_assignments_item_id", columnList = "item_id")
})
class OrgMappingAssignment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Integer id;
    @Column(name = "department_id", nullable = false) Integer departmentId;
    @Column(name = "type_code", nullable = false, length = 50) String typeCode;
    @Column(name = "item_id", nullable = false) Integer itemId;
    @Column(name = "effective_from", nullable = false) LocalDate effectiveFrom;
    @Column(name = "effective_to") LocalDate effectiveTo;
    @Column(name = "created_by") Integer createdBy;
    @Column(name = "updated_by") Integer updatedBy;
    @Column(name = "created_at", nullable = false) Instant createdAt;
    @Column(name = "updated_at", nullable = false) Instant updatedAt;
}

@Entity(name = "OrgDeptChangeHistory")
@Table(name = "org_dept_change_histories", indexes = {
        @Index(name = "ix_org_dept_change_histories_changed_at", columnList = "changed_at"),
        @Index(name = "ix_org_dept_change_histories_department_id", columnList = "department_id"),
        @Index(name = "ix_org_dept_change_histories_dept_changed", columnList = "department_id,changed_at")
})
class OrgDeptChangeHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Integer id;
    @Column(name = "department_id", nullable = false) Integer departmentId;
    @Column(name = "changed_by") Integer changedBy;
    @Column(name = "field_name", nullable = false, length = 60) String fieldName;
    @Column(name = "before_value", length = 500) String beforeValue;
    @Column(name = "after_value", length = 500) String afterValue;
    @Column(name = "change_reason", length = 300) String changeReason;
    @Column(name = "changed_at", nullable = false, columnDefinition = "timestamp") Instant changedAt;
}

@Entity(name = "OrgRestructurePlan")
@Table(name = "org_restructure_plans", indexes = @Index(name = "ix_org_restructure_plans_status_created", columnList = "status,created_at"))
class OrgRestructurePlan {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Integer id;
    @Column(nullable = false, length = 200) String title;
    @Column(length = 1000) String description;
    @Column(name = "planned_date") LocalDate plannedDate;
    @Column(nullable = false, length = 20) String status;
    @Column(name = "applied_at", columnDefinition = "timestamp") Instant appliedAt;
    @Column(name = "applied_by") Integer appliedBy;
    @Column(name = "created_by", nullable = false) Integer createdBy;
    @Column(name = "created_at", nullable = false, columnDefinition = "timestamp") Instant createdAt;
    @Column(name = "updated_at", nullable = false, columnDefinition = "timestamp") Instant updatedAt;
}

@Entity(name = "OrgRestructurePlanItem")
@Table(name = "org_restructure_plan_items", indexes = {
        @Index(name = "ix_org_restructure_plan_items_plan", columnList = "plan_id,sort_order"),
        @Index(name = "ix_org_restructure_plan_items_plan_id", columnList = "plan_id")
})
class OrgRestructurePlanItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Integer id;
    @Column(name = "plan_id", nullable = false) Integer planId;
    @Column(name = "action_type", nullable = false, length = 20) String actionType;
    @Column(name = "target_dept_id") Integer targetDeptId;
    @Column(name = "new_parent_id") Integer newParentId;
    @Column(name = "new_name", length = 100) String newName;
    @Column(name = "new_code", length = 30) String newCode;
    @Column(name = "new_organization_type", length = 50) String newOrganizationType;
    @Column(name = "new_cost_center_code", length = 30) String newCostCenterCode;
    @Column(name = "sort_order", nullable = false) int sortOrder;
    @Column(name = "item_status", nullable = false, length = 20) String itemStatus;
    @Column(length = 500) String memo;
    @Column(name = "applied_at", columnDefinition = "timestamp") Instant appliedAt;
    @Column(name = "created_at", nullable = false, columnDefinition = "timestamp") Instant createdAt;
    @Column(name = "updated_at", nullable = false, columnDefinition = "timestamp") Instant updatedAt;
}
