package com.vibehr.hr;

import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

final class HrRequests {
    private HrRequests() { }

    abstract static class Tracked {
        private final Set<String> supplied = new HashSet<>();

        final void supplied(String field) { supplied.add(field); }
        final boolean has(String field) { return supplied.contains(field); }
    }

    static final class EmployeeCreate extends Tracked {
        @Size(min = 1, max = 30) String employeeNo;
        @NotNull @Size(min = 2, max = 100) String displayName;
        @NotNull Integer departmentId;
        @NotNull @Size(min = 1, max = 80) String positionTitle;
        LocalDate hireDate;
        @NotNull @Pattern(regexp = "^(active|leave|resigned)$") String employmentStatus = "active";
        @Size(min = 4, max = 50) String loginId;
        @Size(max = 255) String email;
        @NotNull @Pattern(regexp = ".*\\S.*") @Size(min = 4, max = 128) String password;

        @JsonSetter("employee_no") public void employeeNo(String value) { supplied("employee_no"); employeeNo = value; }
        @JsonSetter("display_name") public void displayName(String value) { supplied("display_name"); displayName = value; }
        @JsonSetter("department_id") public void departmentId(Integer value) { supplied("department_id"); departmentId = value; }
        @JsonSetter("position_title") public void positionTitle(String value) { supplied("position_title"); positionTitle = value; }
        @JsonSetter("hire_date") public void hireDate(LocalDate value) { supplied("hire_date"); hireDate = value; }
        @JsonSetter("employment_status") public void employmentStatus(String value) { supplied("employment_status"); employmentStatus = value; }
        @JsonSetter("login_id") public void loginId(String value) { supplied("login_id"); loginId = value; }
        @JsonSetter("email") public void email(String value) { supplied("email"); email = value; }
        @JsonSetter("password") public void password(String value) { supplied("password"); password = value; }
    }

    static final class EmployeeUpdate extends Tracked {
        Integer id;
        @Size(min = 2, max = 100) String displayName;
        Integer departmentId;
        @Size(min = 1, max = 80) String positionTitle;
        LocalDate hireDate;
        @Pattern(regexp = "^(active|leave|resigned)$") String employmentStatus;
        @Size(max = 255) String email;
        Boolean isActive;
        @Size(min = 4, max = 128) String password;

        @JsonSetter("id") public void id(Integer value) { supplied("id"); id = value; }
        @JsonSetter("display_name") public void displayName(String value) { supplied("display_name"); displayName = value; }
        @JsonSetter("department_id") public void departmentId(Integer value) { supplied("department_id"); departmentId = value; }
        @JsonSetter("position_title") public void positionTitle(String value) { supplied("position_title"); positionTitle = value; }
        @JsonSetter("hire_date") public void hireDate(LocalDate value) { supplied("hire_date"); hireDate = value; }
        @JsonSetter("employment_status") public void employmentStatus(String value) { supplied("employment_status"); employmentStatus = value; }
        @JsonSetter("email") public void email(String value) { supplied("email"); email = value; }
        @JsonSetter("is_active") public void isActive(Boolean value) { supplied("is_active"); isActive = value; }
        @JsonSetter("password") public void password(String value) { supplied("password"); password = value; }
    }

    static final class EmployeeBatch extends Tracked {
        @NotNull @Pattern(regexp = "^atomic$") String mode = "atomic";
        @NotNull List<@Valid EmployeeCreate> insert = new ArrayList<>();
        @NotNull List<@Valid EmployeeUpdate> update = new ArrayList<>();
        @NotNull List<@NotNull Integer> delete = new ArrayList<>();
        @Size(max = 100) String requestId;

        @JsonSetter("mode") public void mode(String value) { supplied("mode"); mode = value; }
        @JsonSetter("insert") public void insert(List<EmployeeCreate> value) { supplied("insert"); insert = value; }
        @JsonSetter("update") public void update(List<EmployeeUpdate> value) { supplied("update"); update = value; }
        @JsonSetter("delete") public void delete(List<Integer> value) { supplied("delete"); delete = value; }
        @JsonSetter("request_id") public void requestId(String value) { supplied("request_id"); requestId = value; }
    }

    static final class BasicProfileUpdate extends Tracked {
        String fullName;
        LocalDate hireDate;
        String positionTitle;
        String gender;
        String residentNoMasked;
        LocalDate birthDate;
        LocalDate retireDate;
        String bloodType;
        String maritalStatus;
        String mbti;
        LocalDate probationEndDate;
        String jobFamily;
        String jobRole;
        String grade;

        @JsonSetter("full_name") public void fullName(String value) { supplied("full_name"); fullName = value; }
        @JsonSetter("hire_date") public void hireDate(LocalDate value) { supplied("hire_date"); hireDate = value; }
        @JsonSetter("position_title") public void positionTitle(String value) { supplied("position_title"); positionTitle = value; }
        @JsonSetter("gender") public void gender(String value) { supplied("gender"); gender = value; }
        @JsonSetter("resident_no_masked") public void residentNoMasked(String value) { supplied("resident_no_masked"); residentNoMasked = value; }
        @JsonSetter("birth_date") public void birthDate(LocalDate value) { supplied("birth_date"); birthDate = value; }
        @JsonSetter("retire_date") public void retireDate(LocalDate value) { supplied("retire_date"); retireDate = value; }
        @JsonSetter("blood_type") public void bloodType(String value) { supplied("blood_type"); bloodType = value; }
        @JsonSetter("marital_status") public void maritalStatus(String value) { supplied("marital_status"); maritalStatus = value; }
        @JsonSetter("mbti") public void mbti(String value) { supplied("mbti"); mbti = value; }
        @JsonSetter("probation_end_date") public void probationEndDate(LocalDate value) { supplied("probation_end_date"); probationEndDate = value; }
        @JsonSetter("job_family") public void jobFamily(String value) { supplied("job_family"); jobFamily = value; }
        @JsonSetter("job_role") public void jobRole(String value) { supplied("job_role"); jobRole = value; }
        @JsonSetter("grade") public void grade(String value) { supplied("grade"); grade = value; }
    }

    static class BasicRecordUpdate extends Tracked {
        LocalDate recordDate;
        String title;
        String type;
        String organization;
        String value;
        String note;

        @JsonSetter("record_date") public void recordDate(LocalDate field) { supplied("record_date"); recordDate = field; }
        @JsonSetter("title") public void title(String field) { supplied("title"); title = field; }
        @JsonSetter("type") public void type(String field) { supplied("type"); type = field; }
        @JsonSetter("organization") public void organization(String field) { supplied("organization"); organization = field; }
        @JsonSetter("value") public void value(String field) { supplied("value"); value = field; }
        @JsonSetter("note") public void note(String field) { supplied("note"); note = field; }
    }

    static final class BasicRecordCreate extends BasicRecordUpdate {
        @NotNull String category;
        @JsonSetter("category") public void category(String field) { supplied("category"); category = field; }
    }

    static class FinalistUpdate extends Tracked {
        @Pattern(regexp = "^(if|manual)$") String sourceType;
        @Size(max = 100) String externalKey;
        @Size(min = 1, max = 100) String fullName;
        @Size(max = 30) String residentNoMasked;
        LocalDate birthDate;
        @Size(max = 40) String phoneMobile;
        @Size(max = 320) String email;
        @Pattern(regexp = "^(new|experienced)$") String hireType;
        @Min(0) @Max(60) Integer careerYears;
        @Size(max = 50) String loginId;
        @Size(max = 30) String employeeNo;
        LocalDate expectedJoinDate;
        @Pattern(regexp = "^(draft|ready|appointed)$") String statusCode;
        @Size(max = 500) String note;
        Boolean isActive;

        @JsonSetter("source_type") public void sourceType(String value) { supplied("source_type"); sourceType = value; }
        @JsonSetter("external_key") public void externalKey(String value) { supplied("external_key"); externalKey = value; }
        @JsonSetter("full_name") public void fullName(String value) { supplied("full_name"); fullName = value; }
        @JsonSetter("resident_no_masked") public void residentNoMasked(String value) { supplied("resident_no_masked"); residentNoMasked = value; }
        @JsonSetter("birth_date") public void birthDate(LocalDate value) { supplied("birth_date"); birthDate = value; }
        @JsonSetter("phone_mobile") public void phoneMobile(String value) { supplied("phone_mobile"); phoneMobile = value; }
        @JsonSetter("email") public void email(String value) { supplied("email"); email = value; }
        @JsonSetter("hire_type") public void hireType(String value) { supplied("hire_type"); hireType = value; }
        @JsonSetter("career_years") public void careerYears(Integer value) { supplied("career_years"); careerYears = value; }
        @JsonSetter("login_id") public void loginId(String value) { supplied("login_id"); loginId = value; }
        @JsonSetter("employee_no") public void employeeNo(String value) { supplied("employee_no"); employeeNo = value; }
        @JsonSetter("expected_join_date") public void expectedJoinDate(LocalDate value) { supplied("expected_join_date"); expectedJoinDate = value; }
        @JsonSetter("status_code") public void statusCode(String value) { supplied("status_code"); statusCode = value; }
        @JsonSetter("note") public void note(String value) { supplied("note"); note = value; }
        @JsonSetter("is_active") public void isActive(Boolean value) { supplied("is_active"); isActive = value; }
    }

    static final class FinalistCreate extends FinalistUpdate {
        FinalistCreate() { sourceType = "manual"; hireType = "new"; statusCode = "draft"; isActive = true; }

        @NotNull public String getSourceType() { return sourceType; }
        @NotNull public String getFullName() { return fullName; }
        @NotNull public String getHireType() { return hireType; }
        @NotNull public String getStatusCode() { return statusCode; }
        @NotNull public Boolean getIsActive() { return isActive; }
    }

    static final class Ids extends Tracked {
        @NotNull @Size(min = 1) List<@NotNull Integer> ids;
        @JsonSetter("ids") public void ids(List<Integer> value) { supplied("ids"); ids = value; }
    }

    static final class IfRow extends Tracked {
        @NotNull @Size(min = 1, max = 100) String externalKey;
        @NotNull @Size(min = 1, max = 100) String fullName;
        @NotNull @Pattern(regexp = "^(new|experienced)$") String hireType = "new";
        @Size(max = 40) String phoneMobile;
        @Size(max = 320) String email;
        LocalDate expectedJoinDate;
        @Size(max = 500) String note;

        @JsonSetter("external_key") public void externalKey(String value) { supplied("external_key"); externalKey = value; }
        @JsonSetter("full_name") public void fullName(String value) { supplied("full_name"); fullName = value; }
        @JsonSetter("hire_type") public void hireType(String value) { supplied("hire_type"); hireType = value; }
        @JsonSetter("phone_mobile") public void phoneMobile(String value) { supplied("phone_mobile"); phoneMobile = value; }
        @JsonSetter("email") public void email(String value) { supplied("email"); email = value; }
        @JsonSetter("expected_join_date") public void expectedJoinDate(LocalDate value) { supplied("expected_join_date"); expectedJoinDate = value; }
        @JsonSetter("note") public void note(String value) { supplied("note"); note = value; }
    }

    static final class IfSync extends Tracked {
        @NotNull List<@Valid IfRow> rows = new ArrayList<>();
        @JsonSetter("rows") public void rows(List<IfRow> value) { supplied("rows"); rows = value; }
    }

    static class AppointmentCodeUpdate extends Tracked {
        @Size(min = 1, max = 30) String code;
        @Size(min = 1, max = 100) String name;
        String description;
        Boolean isActive;
        Integer sortOrder;
        @Size(max = 200) String mappingKey;
        @Size(max = 200) String mappingValue;

        @JsonSetter("code") public void code(String value) { supplied("code"); code = value; }
        @JsonSetter("name") public void name(String value) { supplied("name"); name = value; }
        @JsonSetter("description") public void description(String value) { supplied("description"); description = value; }
        @JsonSetter("is_active") public void isActive(Boolean value) { supplied("is_active"); isActive = value; }
        @JsonSetter("sort_order") public void sortOrder(Integer value) { supplied("sort_order"); sortOrder = value; }
        @JsonSetter("mapping_key") public void mappingKey(String value) { supplied("mapping_key"); mappingKey = value; }
        @JsonSetter("mapping_value") public void mappingValue(String value) { supplied("mapping_value"); mappingValue = value; }
    }

    static final class AppointmentCodeCreate extends AppointmentCodeUpdate {
        AppointmentCodeCreate() { isActive = true; sortOrder = 0; }
        @NotNull public String getCode() { return code; }
        @NotNull public String getName() { return name; }
        @NotNull public Boolean getIsActive() { return isActive; }
        @NotNull public Integer getSortOrder() { return sortOrder; }
    }

    static class AppointmentRecordUpdate extends Tracked {
        @Positive Integer employeeId;
        @Size(max = 30) String appointmentNo;
        @Size(min = 1, max = 120) String orderTitle;
        @Size(max = 500) String orderDescription;
        LocalDate effectiveDate;
        @Positive Integer orderAppointmentCodeId;
        @Positive Integer itemAppointmentCodeId;
        @Size(max = 20) String appointmentKind;
        @Size(min = 1, max = 30) String actionType;
        LocalDate startDate;
        LocalDate endDate;
        @Positive Integer toDepartmentId;
        @Size(max = 80) String toPositionTitle;
        @Size(max = 20) String toEmploymentStatus;
        @Size(max = 500) String temporaryReason;
        @Size(max = 500) String note;

        @JsonSetter("employee_id") public void employeeId(Integer value) { supplied("employee_id"); employeeId = value; }
        @JsonSetter("appointment_no") public void appointmentNo(String value) { supplied("appointment_no"); appointmentNo = value; }
        @JsonSetter("order_title") public void orderTitle(String value) { supplied("order_title"); orderTitle = value; }
        @JsonSetter("order_description") public void orderDescription(String value) { supplied("order_description"); orderDescription = value; }
        @JsonSetter("effective_date") public void effectiveDate(LocalDate value) { supplied("effective_date"); effectiveDate = value; }
        @JsonSetter("order_appointment_code_id") public void orderAppointmentCodeId(Integer value) { supplied("order_appointment_code_id"); orderAppointmentCodeId = value; }
        @JsonSetter("item_appointment_code_id") public void itemAppointmentCodeId(Integer value) { supplied("item_appointment_code_id"); itemAppointmentCodeId = value; }
        @JsonSetter("appointment_kind") public void appointmentKind(String value) { supplied("appointment_kind"); appointmentKind = value; }
        @JsonSetter("action_type") public void actionType(String value) { supplied("action_type"); actionType = value; }
        @JsonSetter("start_date") public void startDate(LocalDate value) { supplied("start_date"); startDate = value; }
        @JsonSetter("end_date") public void endDate(LocalDate value) { supplied("end_date"); endDate = value; }
        @JsonSetter("to_department_id") public void toDepartmentId(Integer value) { supplied("to_department_id"); toDepartmentId = value; }
        @JsonSetter("to_position_title") public void toPositionTitle(String value) { supplied("to_position_title"); toPositionTitle = value; }
        @JsonSetter("to_employment_status") public void toEmploymentStatus(String value) { supplied("to_employment_status"); toEmploymentStatus = value; }
        @JsonSetter("temporary_reason") public void temporaryReason(String value) { supplied("temporary_reason"); temporaryReason = value; }
        @JsonSetter("note") public void note(String value) { supplied("note"); note = value; }
    }

    static final class AppointmentRecordCreate extends AppointmentRecordUpdate {
        AppointmentRecordCreate() { appointmentKind = "permanent"; }
        @NotNull public Integer getEmployeeId() { return employeeId; }
        @NotNull public String getOrderTitle() { return orderTitle; }
        @NotNull public LocalDate getEffectiveDate() { return effectiveDate; }
        @NotNull public String getAppointmentKind() { return appointmentKind; }
        @NotNull public String getActionType() { return actionType; }
        @NotNull public LocalDate getStartDate() { return startDate; }
    }

    static class ChecklistUpdate extends Tracked {
        String title;
        String description;
        Boolean isRequired;
        Boolean isActive;
        Integer sortOrder;

        @JsonSetter("title") public void title(String value) { supplied("title"); title = value; }
        @JsonSetter("description") public void description(String value) { supplied("description"); description = value; }
        @JsonSetter("is_required") public void isRequired(Boolean value) { supplied("is_required"); isRequired = value; }
        @JsonSetter("is_active") public void isActive(Boolean value) { supplied("is_active"); isActive = value; }
        @JsonSetter("sort_order") public void sortOrder(Integer value) { supplied("sort_order"); sortOrder = value; }
    }

    static final class ChecklistCreate extends ChecklistUpdate {
        @NotNull String code;
        ChecklistCreate() { isRequired = true; isActive = true; sortOrder = 0; }
        @JsonSetter("code") public void code(String value) { supplied("code"); code = value; }
        @NotNull public String getTitle() { return title; }
        @NotNull public Boolean getIsRequired() { return isRequired; }
        @NotNull public Boolean getIsActive() { return isActive; }
        @NotNull public Integer getSortOrder() { return sortOrder; }
    }

    static final class RetireCaseCreate extends Tracked {
        @NotNull Integer employeeId;
        @NotNull LocalDate retireDate;
        String reason;

        @JsonSetter("employee_id") public void employeeId(Integer value) { supplied("employee_id"); employeeId = value; }
        @JsonSetter("retire_date") public void retireDate(LocalDate value) { supplied("retire_date"); retireDate = value; }
        @JsonSetter("reason") public void reason(String value) { supplied("reason"); reason = value; }
    }

    static final class RetireItemUpdate extends Tracked {
        @NotNull Boolean isChecked;
        String note;
        @JsonSetter("is_checked") public void isChecked(Boolean value) { supplied("is_checked"); isChecked = value; }
        @JsonSetter("note") public void note(String value) { supplied("note"); note = value; }
    }

    static final class RetireCancel extends Tracked {
        String cancelReason;
        @JsonSetter("cancel_reason") public void cancelReason(String value) { supplied("cancel_reason"); cancelReason = value; }
    }

    static final class SeveranceAdjustment extends Tracked {
        @NotNull Double adjustmentAmount;
        @NotNull @Size(min = 1, max = 500) String adjustmentReason;
        @JsonSetter("adjustment_amount") public void adjustmentAmount(Double value) { supplied("adjustment_amount"); adjustmentAmount = value; }
        @JsonSetter("adjustment_reason") public void adjustmentReason(String value) { supplied("adjustment_reason"); adjustmentReason = value; }
    }
}
