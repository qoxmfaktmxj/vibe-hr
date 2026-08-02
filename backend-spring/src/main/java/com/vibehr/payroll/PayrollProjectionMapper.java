package com.vibehr.payroll;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

/** Typed PostgreSQL projections for payroll grids and cross-domain source events. */
@Mapper
public interface PayrollProjectionMapper {
    @Select("""
            select re.id, re.run_id, re.employee_id, e.employee_no, u.display_name as employee_name,
                   re.profile_id, re.gross_pay, re.taxable_income, re.non_taxable_income,
                   re.total_deductions, re.net_pay, re.status, re.warning_message,
                   re.created_at, re.updated_at
              from pay_payroll_run_employees re
              left join hr_employees e on e.id = re.employee_id
              left join auth_users u on u.id = e.user_id
             where re.run_id = #{runId}
             order by re.employee_id
            """)
    @Results(id = "runEmployeeProjection", value = {
            @Result(column = "run_id", property = "runId"),
            @Result(column = "employee_id", property = "employeeId"),
            @Result(column = "employee_no", property = "employeeNo"),
            @Result(column = "employee_name", property = "employeeName"),
            @Result(column = "profile_id", property = "profileId"),
            @Result(column = "gross_pay", property = "grossPay"),
            @Result(column = "taxable_income", property = "taxableIncome"),
            @Result(column = "non_taxable_income", property = "nonTaxableIncome"),
            @Result(column = "total_deductions", property = "totalDeductions"),
            @Result(column = "net_pay", property = "netPay"),
            @Result(column = "warning_message", property = "warningMessage"),
            @Result(column = "created_at", property = "createdAt"),
            @Result(column = "updated_at", property = "updatedAt")
    })
    List<RunEmployeeProjection> findRunEmployees(@Param("runId") int runId);

    @Select("""
            <script>
            select i.id, i.employee_id, o.appointment_no, o.title as order_title,
                   i.appointment_kind, i.action_type, i.start_date, i.end_date,
                   i.from_department_id, from_dept.name as from_department_name,
                   i.to_department_id, to_dept.name as to_department_name,
                   i.from_position_title, i.to_position_title,
                   i.from_employment_status, i.to_employment_status,
                   i.temporary_reason, i.note
              from hr_appointment_order_items i
              join hr_appointment_orders o on o.id = i.order_id
              left join org_departments from_dept on from_dept.id = i.from_department_id
              left join org_departments to_dept on to_dept.id = i.to_department_id
             where o.status = 'confirmed'
               and i.employee_id in
               <foreach item="employeeId" collection="employeeIds" open="(" separator="," close=")">#{employeeId}</foreach>
               and i.start_date &lt;= #{periodEnd}
               and (i.end_date is null or i.end_date &gt;= #{periodStart})
             order by i.employee_id, i.start_date, i.id
            </script>
            """)
    @Results(id = "appointmentProjection", value = {
            @Result(column = "employee_id", property = "employeeId"),
            @Result(column = "appointment_no", property = "appointmentNo"),
            @Result(column = "order_title", property = "orderTitle"),
            @Result(column = "appointment_kind", property = "appointmentKind"),
            @Result(column = "action_type", property = "actionType"),
            @Result(column = "start_date", property = "startDate"),
            @Result(column = "end_date", property = "endDate"),
            @Result(column = "from_department_id", property = "fromDepartmentId"),
            @Result(column = "from_department_name", property = "fromDepartmentName"),
            @Result(column = "to_department_id", property = "toDepartmentId"),
            @Result(column = "to_department_name", property = "toDepartmentName"),
            @Result(column = "from_position_title", property = "fromPositionTitle"),
            @Result(column = "to_position_title", property = "toPositionTitle"),
            @Result(column = "from_employment_status", property = "fromEmploymentStatus"),
            @Result(column = "to_employment_status", property = "toEmploymentStatus"),
            @Result(column = "temporary_reason", property = "temporaryReason")
    })
    List<AppointmentProjection> findAppointmentEvents(
            @Param("employeeIds") List<Integer> employeeIds,
            @Param("periodStart") LocalDate periodStart,
            @Param("periodEnd") LocalDate periodEnd);

    @Select("""
            <script>
            select id, employee_id, leave_type, start_date, end_date, reason,
                   request_status, approved_at, decision_comment
              from tim_leave_requests
             where employee_id in
               <foreach item="employeeId" collection="employeeIds" open="(" separator="," close=")">#{employeeId}</foreach>
               and request_status = 'approved'
               and start_date &lt;= #{periodEnd}
               and end_date &gt;= #{periodStart}
             order by employee_id, start_date, id
            </script>
            """)
    @Results(id = "leaveProjection", value = {
            @Result(column = "employee_id", property = "employeeId"),
            @Result(column = "leave_type", property = "leaveType"),
            @Result(column = "start_date", property = "startDate"),
            @Result(column = "end_date", property = "endDate"),
            @Result(column = "request_status", property = "requestStatus"),
            @Result(column = "approved_at", property = "approvedAt"),
            @Result(column = "decision_comment", property = "decisionComment")
    })
    List<LeaveProjection> findApprovedLeaveEvents(
            @Param("employeeIds") List<Integer> employeeIds,
            @Param("periodStart") LocalDate periodStart,
            @Param("periodEnd") LocalDate periodEnd);

    @Select("""
            <script>
            select r.id, r.request_no, r.benefit_type_code, r.benefit_type_name,
                   r.employee_no, r.status_code, r.requested_amount, r.approved_amount,
                   r.payroll_run_label, r.description, r.requested_at, r.approved_at,
                   r.created_at, r.updated_at, t.name as benefit_master_name,
                   t.is_deduction, t.pay_item_code
              from wel_benefit_requests r
              join wel_benefit_types t on t.code = r.benefit_type_code and t.is_active = true
             where r.employee_no in
               <foreach item="employeeNo" collection="employeeNos" open="(" separator="," close=")">#{employeeNo}</foreach>
               and r.status_code in ('approved', 'payroll_reflected')
               and (r.payroll_run_label is null or r.payroll_run_label ilike concat('%', #{yearMonth}, '%'))
             order by r.employee_no, r.id
            </script>
            """)
    @Results(id = "welfareProjection", value = {
            @Result(column = "request_no", property = "requestNo"),
            @Result(column = "benefit_type_code", property = "benefitTypeCode"),
            @Result(column = "benefit_type_name", property = "benefitTypeName"),
            @Result(column = "employee_no", property = "employeeNo"),
            @Result(column = "status_code", property = "statusCode"),
            @Result(column = "requested_amount", property = "requestedAmount"),
            @Result(column = "approved_amount", property = "approvedAmount"),
            @Result(column = "payroll_run_label", property = "payrollRunLabel"),
            @Result(column = "requested_at", property = "requestedAt"),
            @Result(column = "approved_at", property = "approvedAt"),
            @Result(column = "created_at", property = "createdAt"),
            @Result(column = "updated_at", property = "updatedAt"),
            @Result(column = "benefit_master_name", property = "benefitMasterName"),
            @Result(column = "is_deduction", property = "deduction"),
            @Result(column = "pay_item_code", property = "payItemCode")
    })
    List<WelfareProjection> findWelfareRequests(
            @Param("employeeNos") List<String> employeeNos,
            @Param("yearMonth") String yearMonth);

    @Select("""
            select e.employee_no, u.display_name as employee_name, d.name as department_name
              from hr_employees e
              left join auth_users u on u.id = e.user_id
              left join org_departments d on d.id = e.department_id
             where e.id = #{employeeId}
            """)
    @Results(id = "payslipIdentityProjection", value = {
            @Result(column = "employee_no", property = "employeeNo"),
            @Result(column = "employee_name", property = "employeeName"),
            @Result(column = "department_name", property = "departmentName")
    })
    PayslipIdentityProjection findPayslipIdentity(@Param("employeeId") int employeeId);

    class RunEmployeeProjection {
        private int id; private int runId; private int employeeId; private String employeeNo; private String employeeName;
        private Integer profileId; private double grossPay; private double taxableIncome; private double nonTaxableIncome;
        private double totalDeductions; private double netPay; private String status; private String warningMessage;
        private LocalDateTime createdAt; private LocalDateTime updatedAt;
        public int id() { return id; } public void setId(int value) { id = value; }
        public int runId() { return runId; } public void setRunId(int value) { runId = value; }
        public int employeeId() { return employeeId; } public void setEmployeeId(int value) { employeeId = value; }
        public String employeeNo() { return employeeNo; } public void setEmployeeNo(String value) { employeeNo = value; }
        public String employeeName() { return employeeName; } public void setEmployeeName(String value) { employeeName = value; }
        public Integer profileId() { return profileId; } public void setProfileId(Integer value) { profileId = value; }
        public double grossPay() { return grossPay; } public void setGrossPay(double value) { grossPay = value; }
        public double taxableIncome() { return taxableIncome; } public void setTaxableIncome(double value) { taxableIncome = value; }
        public double nonTaxableIncome() { return nonTaxableIncome; } public void setNonTaxableIncome(double value) { nonTaxableIncome = value; }
        public double totalDeductions() { return totalDeductions; } public void setTotalDeductions(double value) { totalDeductions = value; }
        public double netPay() { return netPay; } public void setNetPay(double value) { netPay = value; }
        public String status() { return status; } public void setStatus(String value) { status = value; }
        public String warningMessage() { return warningMessage; } public void setWarningMessage(String value) { warningMessage = value; }
        public LocalDateTime createdAt() { return createdAt; } public void setCreatedAt(LocalDateTime value) { createdAt = value; }
        public LocalDateTime updatedAt() { return updatedAt; } public void setUpdatedAt(LocalDateTime value) { updatedAt = value; }
    }

    class AppointmentProjection {
        private int id; private int employeeId; private String appointmentNo; private String orderTitle;
        private String appointmentKind; private String actionType; private LocalDate startDate; private LocalDate endDate;
        private Integer fromDepartmentId; private String fromDepartmentName; private Integer toDepartmentId; private String toDepartmentName;
        private String fromPositionTitle; private String toPositionTitle; private String fromEmploymentStatus; private String toEmploymentStatus;
        private String temporaryReason; private String note;
        public int id() { return id; } public void setId(int value) { id = value; }
        public int employeeId() { return employeeId; } public void setEmployeeId(int value) { employeeId = value; }
        public String appointmentNo() { return appointmentNo; } public void setAppointmentNo(String value) { appointmentNo = value; }
        public String orderTitle() { return orderTitle; } public void setOrderTitle(String value) { orderTitle = value; }
        public String appointmentKind() { return appointmentKind; } public void setAppointmentKind(String value) { appointmentKind = value; }
        public String actionType() { return actionType; } public void setActionType(String value) { actionType = value; }
        public LocalDate startDate() { return startDate; } public void setStartDate(LocalDate value) { startDate = value; }
        public LocalDate endDate() { return endDate; } public void setEndDate(LocalDate value) { endDate = value; }
        public Integer fromDepartmentId() { return fromDepartmentId; } public void setFromDepartmentId(Integer value) { fromDepartmentId = value; }
        public String fromDepartmentName() { return fromDepartmentName; } public void setFromDepartmentName(String value) { fromDepartmentName = value; }
        public Integer toDepartmentId() { return toDepartmentId; } public void setToDepartmentId(Integer value) { toDepartmentId = value; }
        public String toDepartmentName() { return toDepartmentName; } public void setToDepartmentName(String value) { toDepartmentName = value; }
        public String fromPositionTitle() { return fromPositionTitle; } public void setFromPositionTitle(String value) { fromPositionTitle = value; }
        public String toPositionTitle() { return toPositionTitle; } public void setToPositionTitle(String value) { toPositionTitle = value; }
        public String fromEmploymentStatus() { return fromEmploymentStatus; } public void setFromEmploymentStatus(String value) { fromEmploymentStatus = value; }
        public String toEmploymentStatus() { return toEmploymentStatus; } public void setToEmploymentStatus(String value) { toEmploymentStatus = value; }
        public String temporaryReason() { return temporaryReason; } public void setTemporaryReason(String value) { temporaryReason = value; }
        public String note() { return note; } public void setNote(String value) { note = value; }
    }

    class LeaveProjection {
        private int id; private int employeeId; private String leaveType; private LocalDate startDate; private LocalDate endDate;
        private String reason; private String requestStatus; private LocalDateTime approvedAt; private String decisionComment;
        public int id() { return id; } public void setId(int value) { id = value; }
        public int employeeId() { return employeeId; } public void setEmployeeId(int value) { employeeId = value; }
        public String leaveType() { return leaveType; } public void setLeaveType(String value) { leaveType = value; }
        public LocalDate startDate() { return startDate; } public void setStartDate(LocalDate value) { startDate = value; }
        public LocalDate endDate() { return endDate; } public void setEndDate(LocalDate value) { endDate = value; }
        public String reason() { return reason; } public void setReason(String value) { reason = value; }
        public String requestStatus() { return requestStatus; } public void setRequestStatus(String value) { requestStatus = value; }
        public LocalDateTime approvedAt() { return approvedAt; } public void setApprovedAt(LocalDateTime value) { approvedAt = value; }
        public String decisionComment() { return decisionComment; } public void setDecisionComment(String value) { decisionComment = value; }
    }

    class WelfareProjection {
        private int id; private String requestNo; private String benefitTypeCode; private String benefitTypeName; private String employeeNo;
        private String statusCode; private long requestedAmount; private Long approvedAmount; private String payrollRunLabel; private String description;
        private LocalDateTime requestedAt; private LocalDateTime approvedAt; private LocalDateTime createdAt; private LocalDateTime updatedAt;
        private String benefitMasterName; private boolean deduction; private String payItemCode;
        public int id() { return id; } public void setId(int value) { id = value; }
        public String requestNo() { return requestNo; } public void setRequestNo(String value) { requestNo = value; }
        public String benefitTypeCode() { return benefitTypeCode; } public void setBenefitTypeCode(String value) { benefitTypeCode = value; }
        public String benefitTypeName() { return benefitTypeName; } public void setBenefitTypeName(String value) { benefitTypeName = value; }
        public String employeeNo() { return employeeNo; } public void setEmployeeNo(String value) { employeeNo = value; }
        public String statusCode() { return statusCode; } public void setStatusCode(String value) { statusCode = value; }
        public long requestedAmount() { return requestedAmount; } public void setRequestedAmount(long value) { requestedAmount = value; }
        public Long approvedAmount() { return approvedAmount; } public void setApprovedAmount(Long value) { approvedAmount = value; }
        public String payrollRunLabel() { return payrollRunLabel; } public void setPayrollRunLabel(String value) { payrollRunLabel = value; }
        public String description() { return description; } public void setDescription(String value) { description = value; }
        public LocalDateTime requestedAt() { return requestedAt; } public void setRequestedAt(LocalDateTime value) { requestedAt = value; }
        public LocalDateTime approvedAt() { return approvedAt; } public void setApprovedAt(LocalDateTime value) { approvedAt = value; }
        public LocalDateTime createdAt() { return createdAt; } public void setCreatedAt(LocalDateTime value) { createdAt = value; }
        public LocalDateTime updatedAt() { return updatedAt; } public void setUpdatedAt(LocalDateTime value) { updatedAt = value; }
        public String benefitMasterName() { return benefitMasterName; } public void setBenefitMasterName(String value) { benefitMasterName = value; }
        public boolean deduction() { return deduction; } public void setDeduction(boolean value) { deduction = value; }
        public String payItemCode() { return payItemCode; } public void setPayItemCode(String value) { payItemCode = value; }
        public double amount() { return approvedAmount != null && approvedAmount != 0 ? approvedAmount.doubleValue() : (double) requestedAmount; }
    }

    class PayslipIdentityProjection {
        private String employeeNo; private String employeeName; private String departmentName;
        public String employeeNo() { return employeeNo; } public void setEmployeeNo(String value) { employeeNo = value; }
        public String employeeName() { return employeeName; } public void setEmployeeName(String value) { employeeName = value; }
        public String departmentName() { return departmentName; } public void setDepartmentName(String value) { departmentName = value; }
    }
}
