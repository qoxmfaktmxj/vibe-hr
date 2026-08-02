package com.vibehr.hr;

import com.vibehr.auth.CurrentUser;
import com.vibehr.platform.error.ApiException;
import com.vibehr.platform.ids.IntegerId;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/v1")
class HrController {
    private final HrApplicationService service;
    private final HrAuthorization authorization;

    HrController(HrApplicationService service, HrAuthorization authorization) { this.service = service; this.authorization = authorization; }
    private int employeeReader(Authentication auth) { int id = authorization.requireAnyRole(auth, "hr_manager", "admin"); authorization.requireEmployeeMenuAction(id, "query"); return id; }
    private int employeeWriter(Authentication auth) { int id = authorization.requireAnyRole(auth, "hr_manager", "admin"); authorization.requireEmployeeMenuAction(id, "save"); return id; }
    private int hr(Authentication auth) { return authorization.requireAnyRole(auth, "hr_manager", "admin"); }
    private int severance(Authentication auth) { return authorization.requireAnyRole(auth, "hr_manager", "payroll_mgr", "admin"); }
    private int currentUserId(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) throw ApiException.unauthorized("Not authenticated.");
        if (auth.getPrincipal() instanceof CurrentUser currentUser) return IntegerId.required(currentUser.id(), "user_id");
        try { return Integer.parseInt(auth.getName()); }
        catch (NumberFormatException exception) { throw ApiException.unauthorized("Not authenticated."); }
    }

    @GetMapping("/employees") Map<String,Object> employees(Authentication auth,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="100") @Min(1) @Max(1000) int limit,@RequestParam(name="all",defaultValue="false") boolean allRows,@RequestParam(required=false,name="employee_no") String employeeNo,@RequestParam(required=false) String name,@RequestParam(required=false) String department,@RequestParam(required=false,name="employment_status") String employmentStatus,@RequestParam(required=false) Boolean active){employeeReader(auth);return service.listEmployees(page,limit,allRows,employeeNo,name,department,employmentStatus,active);}
    @GetMapping("/employees/departments") Map<String,Object> departments(Authentication auth){employeeReader(auth);return service.departments();}
    @PostMapping("/employees") ResponseEntity<Map<String,Object>> createEmployee(Authentication auth,@Valid @RequestBody HrRequests.EmployeeCreate request){employeeWriter(auth);return ResponseEntity.status(HttpStatus.CREATED).body(service.createEmployee(request));}
    @PostMapping("/employees/batch") Map<String,Object> batchEmployees(Authentication auth,@Valid @RequestBody HrRequests.EmployeeBatch request){employeeWriter(auth);return service.batchEmployees(request);}
    @GetMapping("/employees/me") Map<String,Object> currentEmployee(Authentication auth){return service.employeeForUser(currentUserId(auth));}
    @PutMapping("/employees/{employee_id}") Map<String,Object> updateEmployee(Authentication auth,@PathVariable("employee_id") int employeeId,@Valid @RequestBody HrRequests.EmployeeUpdate request){employeeWriter(auth);return service.updateEmployee(employeeId,request);}
    @DeleteMapping("/employees/{employee_id}") ResponseEntity<Void> deleteEmployee(Authentication auth,@PathVariable("employee_id") int employeeId){employeeWriter(auth);service.deleteEmployee(employeeId);return ResponseEntity.noContent().build();}

    @GetMapping("/hr/basic/admin-records") Map<String,Object> adminRecords(Authentication auth,@RequestParam String category,@RequestParam(required=false,name="employee_no") String employeeNo,@RequestParam(required=false) String name,@RequestParam(required=false) String department,@RequestParam(required=false,name="employment_status") String status){hr(auth);return service.adminRecords(category,employeeNo,name,department,status);}
    @GetMapping("/hr/basic/{employee_id}") Map<String,Object> basic(Authentication auth,@PathVariable("employee_id") int employeeId){hr(auth);return service.basicDetail(employeeId);}
    @PutMapping("/hr/basic/{employee_id}/profile") Map<String,Object> profile(Authentication auth,@PathVariable("employee_id") int employeeId,@Valid @RequestBody HrRequests.BasicProfileUpdate request){hr(auth);return service.updateBasicProfile(employeeId,request);}
    @PostMapping("/hr/basic/{employee_id}/records") ResponseEntity<Map<String,Object>> createRecord(Authentication auth,@PathVariable("employee_id") int employeeId,@Valid @RequestBody HrRequests.BasicRecordCreate request){hr(auth);return ResponseEntity.status(HttpStatus.CREATED).body(service.createBasicRecord(employeeId,request));}
    @PutMapping("/hr/basic/{employee_id}/records/{record_id}") Map<String,Object> updateRecord(Authentication auth,@PathVariable("employee_id") int employeeId,@PathVariable("record_id") int recordId,@RequestParam String category,@Valid @RequestBody HrRequests.BasicRecordUpdate request){hr(auth);return service.updateBasicRecord(employeeId,recordId,category,request);}
    @DeleteMapping("/hr/basic/{employee_id}/records/{record_id}") ResponseEntity<Void> deleteRecord(Authentication auth,@PathVariable("employee_id") int employeeId,@PathVariable("record_id") int recordId,@RequestParam String category){hr(auth);service.deleteBasicRecord(employeeId,recordId,category);return ResponseEntity.noContent().build();}

    @GetMapping("/hr/recruit/finalists") Map<String,Object> finalists(Authentication auth,@RequestParam(required=false) String search){hr(auth);return service.listFinalists(search);}
    @PostMapping("/hr/recruit/finalists") ResponseEntity<Map<String,Object>> createFinalist(Authentication auth,@Valid @RequestBody HrRequests.FinalistCreate request){hr(auth);return ResponseEntity.status(HttpStatus.CREATED).body(service.createFinalist(request));}
    @PutMapping("/hr/recruit/finalists/{finalist_id}") Map<String,Object> updateFinalist(Authentication auth,@PathVariable("finalist_id") int finalistId,@Valid @RequestBody HrRequests.FinalistUpdate request){hr(auth);return service.updateFinalist(finalistId,request);}
    @DeleteMapping("/hr/recruit/finalists") Map<String,Object> deleteFinalists(Authentication auth,@Valid @RequestBody HrRequests.Ids request){hr(auth);return service.deleteFinalists(request);}
    @PostMapping("/hr/recruit/finalists/if-sync") Map<String,Object> syncFinalists(Authentication auth,@Valid @RequestBody HrRequests.IfSync request){hr(auth);return service.syncFinalists(request);}
    @PostMapping("/hr/recruit/finalists/generate-employee-no") Map<String,Object> generateFinalistEmployeeNos(Authentication auth,@Valid @RequestBody HrRequests.Ids request){hr(auth);return service.generateFinalistEmployeeNos(request);}
    @PostMapping("/hr/recruit/finalists/create-employees") Map<String,Object> createFinalistEmployees(Authentication auth,@Valid @RequestBody HrRequests.Ids request){hr(auth);return service.createEmployeesFromFinalists(request);}

    @GetMapping("/hr/appointment-codes") Map<String,Object> appointmentCodes(Authentication auth){hr(auth);return service.listAppointmentCodes();}
    @PostMapping("/hr/appointment-codes") ResponseEntity<Map<String,Object>> createAppointmentCode(Authentication auth,@Valid @RequestBody HrRequests.AppointmentCodeCreate request){hr(auth);return ResponseEntity.status(HttpStatus.CREATED).body(service.createAppointmentCode(request));}
    @PutMapping("/hr/appointment-codes/{code_id}") Map<String,Object> updateAppointmentCode(Authentication auth,@PathVariable("code_id") int codeId,@Valid @RequestBody HrRequests.AppointmentCodeUpdate request){hr(auth);return service.updateAppointmentCode(codeId,request);}
    @DeleteMapping("/hr/appointment-codes/{code_id}") ResponseEntity<Void> deleteAppointmentCode(Authentication auth,@PathVariable("code_id") int codeId){hr(auth);service.deleteAppointmentCode(codeId);return ResponseEntity.noContent().build();}

    @GetMapping("/hr/appointments/records") Map<String,Object> appointmentRecords(Authentication auth,@RequestParam(required=false,name="employee_no") String employeeNo,@RequestParam(required=false) String name,@RequestParam(required=false) String department,@RequestParam(required=false,name="order_status") String status,@RequestParam(required=false,name="appointment_kind") String kind,@RequestParam(required=false,name="appointment_no") String appointmentNo){hr(auth);return service.listAppointmentRecords(employeeNo,name,department,status,kind,appointmentNo);}
    @PostMapping("/hr/appointments/records") ResponseEntity<Map<String,Object>> createAppointmentRecord(Authentication auth,@Valid @RequestBody HrRequests.AppointmentRecordCreate request){return ResponseEntity.status(HttpStatus.CREATED).body(service.createAppointmentRecord(request,hr(auth)));}
    @PutMapping("/hr/appointments/records/{item_id}") Map<String,Object> updateAppointmentRecord(Authentication auth,@PathVariable("item_id") int itemId,@Valid @RequestBody HrRequests.AppointmentRecordUpdate request){hr(auth);return service.updateAppointmentRecord(itemId,request);}
    @DeleteMapping("/hr/appointments/records/{item_id}") ResponseEntity<Void> deleteAppointmentRecord(Authentication auth,@PathVariable("item_id") int itemId){hr(auth);service.deleteAppointmentRecord(itemId);return ResponseEntity.noContent().build();}
    @PostMapping("/hr/appointments/orders/{order_id}/confirm") Map<String,Object> confirmAppointment(Authentication auth,@PathVariable("order_id") int orderId){return service.confirmAppointment(orderId,hr(auth));}

    @GetMapping("/hr/retire/checklist") Map<String,Object> checklist(Authentication auth,@RequestParam(defaultValue="false",name="include_inactive") boolean includeInactive,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="50") @Min(1) @Max(200) int limit){hr(auth);return service.listChecklist(includeInactive,page,limit);}
    @PostMapping("/hr/retire/checklist") ResponseEntity<Map<String,Object>> createChecklist(Authentication auth,@Valid @RequestBody HrRequests.ChecklistCreate request){hr(auth);return ResponseEntity.status(HttpStatus.CREATED).body(service.createChecklist(request));}
    @PutMapping("/hr/retire/checklist/{checklist_item_id}") Map<String,Object> updateChecklist(Authentication auth,@PathVariable("checklist_item_id") int checklistItemId,@Valid @RequestBody HrRequests.ChecklistUpdate request){hr(auth);return service.updateChecklist(checklistItemId,request);}
    @GetMapping("/hr/retire/cases") Map<String,Object> retireCases(Authentication auth,@RequestParam(required=false) String status,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="50") @Min(1) @Max(200) int limit){hr(auth);return service.listRetireCases(status,page,limit);}
    @PostMapping("/hr/retire/cases") ResponseEntity<Map<String,Object>> createRetireCase(Authentication auth,@Valid @RequestBody HrRequests.RetireCaseCreate request){return ResponseEntity.status(HttpStatus.CREATED).body(service.createRetireCase(request,hr(auth)));}
    @GetMapping("/hr/retire/cases/{case_id}") Map<String,Object> retireCase(Authentication auth,@PathVariable("case_id") int caseId){hr(auth);return service.retireDetail(caseId);}
    @PutMapping("/hr/retire/cases/{case_id}/items/{case_item_id}") Map<String,Object> updateRetireItem(Authentication auth,@PathVariable("case_id") int caseId,@PathVariable("case_item_id") int caseItemId,@Valid @RequestBody HrRequests.RetireItemUpdate request){return service.updateRetireItem(caseId,caseItemId,request,hr(auth));}
    @PostMapping("/hr/retire/cases/{case_id}/confirm") Map<String,Object> confirmRetire(Authentication auth,@PathVariable("case_id") int caseId){return service.confirmRetireCase(caseId,hr(auth));}
    @PostMapping("/hr/retire/cases/{case_id}/cancel") Map<String,Object> cancelRetire(Authentication auth,@PathVariable("case_id") int caseId,@Valid @RequestBody HrRequests.RetireCancel request){return service.cancelRetireCase(caseId,request,hr(auth));}

    @GetMapping("/hr/severance/calcs") Map<String,Object> severance(Authentication auth,@RequestParam(required=false) String status,@RequestParam(required=false) String year,@RequestParam(defaultValue="1") @Min(1) int page,@RequestParam(defaultValue="50") @Min(1) @Max(200) int limit){severance(auth);return service.listSeverance(status,year,page,limit);}
    @GetMapping("/hr/severance/calcs/{calc_id}") Map<String,Object> severanceDetail(Authentication auth,@PathVariable("calc_id") int calcId){severance(auth);return service.severanceDetail(calcId);}
    @PostMapping("/hr/severance/calcs/{calc_id}/recalculate") Map<String,Object> recalculate(Authentication auth,@PathVariable("calc_id") int calcId){severance(auth);return service.recalculateSeverance(calcId);}
    @PutMapping("/hr/severance/calcs/{calc_id}") Map<String,Object> updateSeverance(Authentication auth,@PathVariable("calc_id") int calcId,@Valid @RequestBody HrRequests.SeveranceAdjustment request){severance(auth);return service.updateSeverance(calcId,request);}
    @PostMapping("/hr/severance/calcs/{calc_id}/confirm") Map<String,Object> confirmSeverance(Authentication auth,@PathVariable("calc_id") int calcId){return service.confirmSeverance(calcId,severance(auth));}
}
