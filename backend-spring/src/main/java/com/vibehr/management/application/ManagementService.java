package com.vibehr.management.application;

import com.vibehr.management.api.ManagementDtos.CompanyCreateRequest;
import com.vibehr.management.api.ManagementDtos.CompanyDetailResponse;
import com.vibehr.management.api.ManagementDtos.CompanyDropdownItem;
import com.vibehr.management.api.ManagementDtos.CompanyDropdownResponse;
import com.vibehr.management.api.ManagementDtos.CompanyItem;
import com.vibehr.management.api.ManagementDtos.CompanyListResponse;
import com.vibehr.management.api.ManagementDtos.CompanyUpdateRequest;
import com.vibehr.management.api.ManagementDtos.DevInquiryCreateRequest;
import com.vibehr.management.api.ManagementDtos.DevInquiryItem;
import com.vibehr.management.api.ManagementDtos.DevInquiryUpdateRequest;
import com.vibehr.management.api.ManagementDtos.DevProjectCreateRequest;
import com.vibehr.management.api.ManagementDtos.DevProjectItem;
import com.vibehr.management.api.ManagementDtos.DevProjectUpdateRequest;
import com.vibehr.management.api.ManagementDtos.DevRequestCreateRequest;
import com.vibehr.management.api.ManagementDtos.DevRequestItem;
import com.vibehr.management.api.ManagementDtos.DevRequestMonthlySummaryItem;
import com.vibehr.management.api.ManagementDtos.DevRequestUpdateRequest;
import com.vibehr.management.api.ManagementDtos.DevStaffProjectItem;
import com.vibehr.management.api.ManagementDtos.DevStaffRevenueItem;
import com.vibehr.management.api.ManagementDtos.DetailResponse;
import com.vibehr.management.api.ManagementDtos.InfraConfigItem;
import com.vibehr.management.api.ManagementDtos.InfraConfigUpsertRequest;
import com.vibehr.management.api.ManagementDtos.InfraMasterCreateRequest;
import com.vibehr.management.api.ManagementDtos.InfraMasterItem;
import com.vibehr.management.api.ManagementDtos.ListResponse;
import com.vibehr.management.api.ManagementDtos.ManagerCompanyCreateRequest;
import com.vibehr.management.api.ManagementDtos.ManagerCompanyItem;
import com.vibehr.management.api.ManagementDtos.OutsourceAttendanceCreateRequest;
import com.vibehr.management.api.ManagementDtos.OutsourceAttendanceItem;
import com.vibehr.management.api.ManagementDtos.OutsourceAttendanceSummaryItem;
import com.vibehr.management.api.ManagementDtos.OutsourceContractCreateRequest;
import com.vibehr.management.api.ManagementDtos.OutsourceContractItem;
import com.vibehr.management.api.ManagementDtos.OutsourceContractUpdateRequest;
import com.vibehr.management.persistence.ManagementEntities.Company;
import com.vibehr.management.persistence.ManagementEntities.DevInquiry;
import com.vibehr.management.persistence.ManagementEntities.DevProject;
import com.vibehr.management.persistence.ManagementEntities.DevRequest;
import com.vibehr.management.persistence.ManagementEntities.InfraConfig;
import com.vibehr.management.persistence.ManagementEntities.InfraMaster;
import com.vibehr.management.persistence.ManagementEntities.ManagerCompany;
import com.vibehr.management.persistence.ManagementEntities.OutsourceAttendance;
import com.vibehr.management.persistence.ManagementEntities.OutsourceContract;
import com.vibehr.management.persistence.ManagementRepository;
import com.vibehr.management.persistence.ManagementRepository.EmployeeView;
import com.vibehr.platform.error.ApiException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Application transaction boundary for every MNG route. */
@Service
public class ManagementService {
    private final ManagementRepository repository;

    public ManagementService(ManagementRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public CompanyListResponse companies(String search, int page, int limit) {
        List<CompanyItem> items = repository.companies(search).stream().map(this::companyItem).toList();
        Page<CompanyItem> result = page(items, page, limit);
        return new CompanyListResponse(result.items(), result.totalCount(), result.page(), result.limit());
    }

    @Transactional(readOnly = true)
    public CompanyDropdownResponse companyDropdown() {
        return new CompanyDropdownResponse(repository.activeCompanies().stream()
            .map(company -> new CompanyDropdownItem(company.id, company.companyName)).toList());
    }

    @Transactional(readOnly = true)
    public CompanyDetailResponse company(int companyId) {
        return new CompanyDetailResponse(companyItem(companyOr404(companyId)));
    }

    @Transactional
    public CompanyDetailResponse createCompany(CompanyCreateRequest request) {
        String companyCode = request.companyCode().trim();
        if (repository.companyCodeExists(companyCode)) throw conflict("이미 존재하는 회사코드입니다.");
        Company company = new Company();
        company.companyCode = companyCode;
        company.companyName = request.companyName().trim();
        company.companyGroupCode = request.companyGroupCode();
        company.companyType = request.companyType();
        company.managementType = request.managementType();
        company.representativeCompany = request.representativeCompany();
        company.startDate = request.startDate();
        company.active = true;
        company.createdAt = now();
        company.updatedAt = company.createdAt;
        return new CompanyDetailResponse(write(company, () -> companyItem(company), "이미 존재하는 회사코드입니다."));
    }

    @Transactional
    public CompanyDetailResponse updateCompany(int companyId, CompanyUpdateRequest patch) {
        Company company = companyOr404(companyId);
        if (patch.has("company_name") && patch.companyName() != null) company.companyName = patch.companyName().trim();
        if (patch.has("company_group_code") && patch.companyGroupCode() != null) company.companyGroupCode = patch.companyGroupCode();
        if (patch.has("company_type") && patch.companyType() != null) company.companyType = patch.companyType();
        if (patch.has("management_type") && patch.managementType() != null) company.managementType = patch.managementType();
        if (patch.has("representative_company") && patch.representativeCompany() != null) company.representativeCompany = patch.representativeCompany();
        if (patch.has("start_date") && patch.startDate() != null) company.startDate = patch.startDate();
        if (patch.has("is_active") && patch.isActive() != null) company.active = patch.isActive();
        company.updatedAt = now();
        return new CompanyDetailResponse(write(null, () -> companyItem(company), "Data integrity conflict."));
    }

    @Transactional
    public int deleteCompanies(Collection<Integer> ids) {
        List<Company> companies = repository.companiesByIds(ids);
        if (companies.isEmpty()) throw notFound("삭제할 고객사가 없습니다.");
        companies.forEach(repository::remove);
        return write(null, companies::size, "Data integrity conflict.");
    }

    @Transactional(readOnly = true)
    public ListResponse<ManagerCompanyItem> managerCompanies(int page, int limit) {
        List<ManagerCompany> rows = repository.managerCompanies();
        Map<Integer, String> companyNames = repository.companyNames(ids(rows, row -> row.companyId));
        Map<Integer, EmployeeView> employees = repository.employees(ids(rows, row -> row.employeeId));
        List<ManagerCompanyItem> items = rows.stream().map(row -> managerCompanyItem(row, companyNames, employees))
            .sorted(Comparator.comparing(ManagerCompanyItem::employeeName, Comparator.nullsFirst(String::compareTo))).toList();
        Page<ManagerCompanyItem> result = page(items, page, limit);
        return list(result);
    }

    @Transactional
    public ListResponse<ManagerCompanyItem> createManagerCompany(ManagerCompanyCreateRequest request) {
        if (!repository.employeeExists(request.employeeId())) throw badRequest("사원을 찾을 수 없습니다.");
        if (repository.company(request.companyId()).isEmpty()) throw badRequest("고객사를 찾을 수 없습니다.");
        ManagerCompany mapping = new ManagerCompany();
        mapping.employeeId = request.employeeId();
        mapping.companyId = request.companyId();
        mapping.startDate = request.startDate();
        mapping.endDate = request.endDate();
        mapping.note = request.note();
        mapping.active = true;
        mapping.createdAt = now();
        mapping.updatedAt = mapping.createdAt;
        write(mapping, () -> mapping, "Data integrity conflict.");
        List<ManagerCompanyItem> items = managerCompanies(1, Integer.MAX_VALUE).items();
        return new ListResponse<>(items, items.size(), 1, Math.max(items.size(), 1));
    }

    @Transactional
    public int deleteManagerCompanies(Collection<Integer> ids) {
        List<ManagerCompany> rows = repository.managerCompaniesByIds(ids);
        if (rows.isEmpty()) throw notFound("삭제할 매핑이 없습니다.");
        rows.forEach(repository::remove);
        return write(null, rows::size, "Data integrity conflict.");
    }

    @Transactional(readOnly = true)
    public ListResponse<DevRequestItem> devRequests(Integer companyId, String statusCode, int page, int limit) {
        List<DevRequest> rows = repository.devRequests(companyId, statusCode);
        Map<Integer, String> companies = companyNames(rows);
        Map<Integer, EmployeeView> employees = employeesForRequests(rows);
        return list(page(rows.stream().map(row -> devRequestItem(row, companies, employees)).toList(), page, limit));
    }

    @Transactional(readOnly = true)
    public ListResponse<DevRequestMonthlySummaryItem> devRequestMonthlySummary(Integer companyId, String statusCode, int page, int limit) {
        Map<LocalDate, DevRequestMonthlySummaryItem> totals = new java.util.HashMap<>();
        for (DevRequest row : repository.devRequests(companyId, statusCode)) {
            LocalDate month = row.requestYm.withDayOfMonth(1);
            DevRequestMonthlySummaryItem prior = totals.get(month);
            totals.put(month, new DevRequestMonthlySummaryItem(month, prior == null ? 1 : prior.totalCount() + 1,
                (prior == null ? 0 : prior.paidCount()) + (row.paid ? 1 : 0),
                (prior == null ? 0D : prior.paidManMonthsTotal()) + zero(row.paidManMonths),
                (prior == null ? 0D : prior.actualManMonthsTotal()) + zero(row.actualManMonths)));
        }
        return list(page(totals.values().stream().sorted(Comparator.comparing(DevRequestMonthlySummaryItem::requestYm).reversed()).toList(), page, limit));
    }

    @Transactional(readOnly = true)
    public DetailResponse<DevRequestItem> devRequest(int requestId) {
        DevRequest row = devRequestOr404(requestId);
        return new DetailResponse<>(devRequestItem(row, repository.companyNames(List.of(row.companyId)), repository.employees(employeeIds(row))));
    }

    @Transactional
    public DetailResponse<DevRequestItem> createDevRequest(DevRequestCreateRequest request) {
        // The company lock serializes legacy auto-sequence allocation without adding a schema column.
        if (request.requestSeq() == 0) repository.lockCompany(request.companyId());
        DevRequest row = new DevRequest();
        row.companyId = request.companyId();
        row.requestYm = request.requestYm();
        row.requestSeq = request.requestSeq() == 0 ? repository.maxRequestSequence(row.companyId, row.requestYm) + 1 : request.requestSeq();
        row.statusCode = request.statusCode(); row.partCode = request.partCode(); row.requesterName = request.requesterName();
        row.requestContent = request.requestContent(); row.managerEmployeeId = request.managerEmployeeId(); row.developerEmployeeId = request.developerEmployeeId();
        row.paid = request.isPaid() != null && request.isPaid(); row.paidContent = request.paidContent();
        row.taxBill = request.hasTaxBill() != null && request.hasTaxBill(); row.startYm = request.startYm(); row.endYm = request.endYm();
        row.devStartDate = request.devStartDate(); row.devEndDate = request.devEndDate(); row.paidManMonths = request.paidManMonths();
        row.actualManMonths = request.actualManMonths(); row.note = request.note(); row.createdAt = now(); row.updatedAt = row.createdAt;
        return new DetailResponse<>(write(row, () -> devRequestItem(row, repository.companyNames(List.of(row.companyId)), repository.employees(employeeIds(row))), "Data integrity conflict."));
    }

    @Transactional
    public DetailResponse<DevRequestItem> updateDevRequest(int requestId, DevRequestUpdateRequest patch) {
        DevRequest row = devRequestOr404(requestId);
        if (patch.has("company_id") && patch.companyId() != null) row.companyId = patch.companyId();
        if (patch.has("request_ym") && patch.requestYm() != null) row.requestYm = patch.requestYm();
        if (patch.has("status_code")) row.statusCode = patch.statusCode();
        if (patch.has("part_code")) row.partCode = patch.partCode();
        if (patch.has("requester_name")) row.requesterName = patch.requesterName();
        if (patch.has("request_content")) row.requestContent = patch.requestContent();
        if (patch.has("manager_employee_id")) row.managerEmployeeId = patch.managerEmployeeId();
        if (patch.has("developer_employee_id")) row.developerEmployeeId = patch.developerEmployeeId();
        if (patch.has("is_paid") && patch.isPaid() != null) row.paid = patch.isPaid();
        if (patch.has("paid_content")) row.paidContent = patch.paidContent();
        if (patch.has("has_tax_bill") && patch.hasTaxBill() != null) row.taxBill = patch.hasTaxBill();
        if (patch.has("start_ym")) row.startYm = patch.startYm();
        if (patch.has("end_ym")) row.endYm = patch.endYm();
        if (patch.has("dev_start_date")) row.devStartDate = patch.devStartDate();
        if (patch.has("dev_end_date")) row.devEndDate = patch.devEndDate();
        if (patch.has("paid_man_months")) row.paidManMonths = patch.paidManMonths();
        if (patch.has("actual_man_months")) row.actualManMonths = patch.actualManMonths();
        if (patch.has("note")) row.note = patch.note();
        row.updatedAt = now();
        return new DetailResponse<>(write(null, () -> devRequestItem(row, repository.companyNames(List.of(row.companyId)), repository.employees(employeeIds(row))), "Data integrity conflict."));
    }

    @Transactional
    public int deleteDevRequests(Collection<Integer> ids) { return delete(repository.devRequestsByIds(ids), "Data integrity conflict."); }

    @Transactional(readOnly = true)
    public ListResponse<DevProjectItem> devProjects(Integer companyId, int page, int limit) {
        List<DevProject> rows = repository.devProjects(companyId);
        Map<Integer, String> companies = repository.companyNames(ids(rows, row -> row.companyId));
        return list(page(rows.stream().map(row -> devProjectItem(row, companies)).toList(), page, limit));
    }

    @Transactional(readOnly = true)
    public DetailResponse<DevProjectItem> devProject(int projectId) {
        DevProject row = devProjectOr404(projectId);
        return new DetailResponse<>(devProjectItem(row, repository.companyNames(List.of(row.companyId))));
    }

    @Transactional
    public DetailResponse<DevProjectItem> createDevProject(DevProjectCreateRequest request) {
        DevProject row = new DevProject();
        row.projectName = request.projectName().trim(); row.companyId = request.companyId(); row.partCode = request.partCode(); row.assignedStaff = request.assignedStaff();
        row.contractStartDate = request.contractStartDate(); row.contractEndDate = request.contractEndDate(); row.devStartDate = request.devStartDate(); row.devEndDate = request.devEndDate();
        row.inspectionStatus = request.inspectionStatus(); row.taxBill = request.hasTaxBill() != null && request.hasTaxBill(); row.actualManMonths = request.actualManMonths();
        row.contractAmount = request.contractAmount(); row.note = request.note(); row.createdAt = now(); row.updatedAt = row.createdAt;
        return new DetailResponse<>(write(row, () -> devProjectItem(row, repository.companyNames(List.of(row.companyId))), "Data integrity conflict."));
    }

    @Transactional
    public DetailResponse<DevProjectItem> updateDevProject(int projectId, DevProjectUpdateRequest patch) {
        DevProject row = devProjectOr404(projectId);
        if (patch.has("project_name") && patch.projectName() != null) row.projectName = patch.projectName().trim();
        if (patch.has("company_id") && patch.companyId() != null) row.companyId = patch.companyId();
        if (patch.has("part_code")) row.partCode = trim(patch.partCode());
        if (patch.has("assigned_staff")) row.assignedStaff = trim(patch.assignedStaff());
        if (patch.has("contract_start_date")) row.contractStartDate = patch.contractStartDate();
        if (patch.has("contract_end_date")) row.contractEndDate = patch.contractEndDate();
        if (patch.has("dev_start_date")) row.devStartDate = patch.devStartDate();
        if (patch.has("dev_end_date")) row.devEndDate = patch.devEndDate();
        if (patch.has("inspection_status")) row.inspectionStatus = trim(patch.inspectionStatus());
        if (patch.has("has_tax_bill") && patch.hasTaxBill() != null) row.taxBill = patch.hasTaxBill();
        if (patch.has("actual_man_months")) row.actualManMonths = patch.actualManMonths();
        if (patch.has("contract_amount")) row.contractAmount = patch.contractAmount();
        if (patch.has("note")) row.note = trim(patch.note());
        row.updatedAt = now();
        return new DetailResponse<>(write(null, () -> devProjectItem(row, repository.companyNames(List.of(row.companyId))), "Data integrity conflict."));
    }

    @Transactional
    public int deleteDevProjects(Collection<Integer> ids) { return delete(repository.devProjectsByIds(ids), "Data integrity conflict."); }

    @Transactional(readOnly = true)
    public ListResponse<DevInquiryItem> devInquiries(Integer companyId, String progressCode, int page, int limit) {
        List<DevInquiry> rows = repository.devInquiries(companyId, progressCode);
        Map<Integer, String> companies = repository.companyNames(ids(rows, row -> row.companyId));
        return list(page(rows.stream().map(row -> devInquiryItem(row, companies)).toList(), page, limit));
    }

    @Transactional(readOnly = true)
    public DetailResponse<DevInquiryItem> devInquiry(int inquiryId) {
        DevInquiry row = devInquiryOr404(inquiryId);
        return new DetailResponse<>(devInquiryItem(row, repository.companyNames(List.of(row.companyId))));
    }

    @Transactional
    public DetailResponse<DevInquiryItem> createDevInquiry(DevInquiryCreateRequest request) {
        DevInquiry row = new DevInquiry();
        row.companyId = request.companyId(); row.inquiryContent = request.inquiryContent(); row.hopedStartDate = request.hopedStartDate(); row.estimatedManMonths = request.estimatedManMonths();
        row.salesRepName = request.salesRepName(); row.clientContactName = request.clientContactName(); row.progressCode = request.progressCode();
        row.confirmed = request.isConfirmed() != null && request.isConfirmed(); row.projectName = request.projectName(); row.note = request.note(); row.createdAt = now(); row.updatedAt = row.createdAt;
        return new DetailResponse<>(write(row, () -> devInquiryItem(row, repository.companyNames(List.of(row.companyId))), "Data integrity conflict."));
    }

    @Transactional
    public DetailResponse<DevInquiryItem> updateDevInquiry(int inquiryId, DevInquiryUpdateRequest patch) {
        DevInquiry row = devInquiryOr404(inquiryId);
        if (patch.has("company_id") && patch.companyId() != null) row.companyId = patch.companyId();
        if (patch.has("inquiry_content")) row.inquiryContent = patch.inquiryContent();
        if (patch.has("hoped_start_date")) row.hopedStartDate = patch.hopedStartDate();
        if (patch.has("estimated_man_months")) row.estimatedManMonths = patch.estimatedManMonths();
        if (patch.has("sales_rep_name")) row.salesRepName = patch.salesRepName();
        if (patch.has("client_contact_name")) row.clientContactName = patch.clientContactName();
        if (patch.has("progress_code")) row.progressCode = patch.progressCode();
        if (patch.has("is_confirmed") && patch.isConfirmed() != null) row.confirmed = patch.isConfirmed();
        if (patch.has("project_name")) row.projectName = patch.projectName();
        if (patch.has("note")) row.note = patch.note();
        row.updatedAt = now();
        return new DetailResponse<>(write(null, () -> devInquiryItem(row, repository.companyNames(List.of(row.companyId))), "Data integrity conflict."));
    }

    @Transactional
    public int deleteDevInquiries(Collection<Integer> ids) { return delete(repository.devInquiriesByIds(ids), "Data integrity conflict."); }

    @Transactional(readOnly = true)
    public ListResponse<DevStaffProjectItem> devStaffProjects(Integer companyId, int page, int limit) {
        List<DevProject> rows = repository.devProjects(companyId);
        Map<Integer, String> companies = repository.companyNames(ids(rows, row -> row.companyId));
        return list(page(rows.stream().map(row -> new DevStaffProjectItem(row.id, row.projectName, row.companyId, companies.get(row.companyId), row.assignedStaff, row.contractStartDate, row.contractEndDate, row.devStartDate, row.devEndDate, row.actualManMonths, row.contractAmount)).toList(), page, limit));
    }

    @Transactional(readOnly = true)
    public ListResponse<DevStaffRevenueItem> devStaffRevenue(Integer companyId, int page, int limit) {
        Map<LocalDate, DevStaffRevenueItem> totals = new java.util.HashMap<>();
        for (DevProject row : repository.devProjects(companyId)) {
            LocalDate month = month(row.contractEndDate != null ? row.contractEndDate : row.devEndDate != null ? row.devEndDate : row.contractStartDate != null ? row.contractStartDate : row.devStartDate);
            DevStaffRevenueItem prior = totals.get(month);
            totals.put(month, new DevStaffRevenueItem(month, prior == null ? 1 : prior.projectCount() + 1,
                (prior == null ? 0 : prior.contractAmountTotal()) + (row.contractAmount == null ? 0 : row.contractAmount),
                (prior == null ? 0D : prior.actualManMonthsTotal()) + zero(row.actualManMonths)));
        }
        return list(page(totals.values().stream().sorted(Comparator.comparing(DevStaffRevenueItem::month).reversed()).toList(), page, limit));
    }

    @Transactional(readOnly = true)
    public ListResponse<OutsourceContractItem> outsourceContracts(String search, int page, int limit) {
        List<OutsourceContract> rows = repository.outsourceContracts();
        Map<Integer, EmployeeView> employees = repository.employees(ids(rows, row -> row.employeeId));
        String keyword = search == null ? null : search.trim().toLowerCase();
        List<OutsourceContractItem> items = rows.stream().map(row -> outsourceContractItem(row, employees)).filter(item -> keyword == null || keyword.isEmpty()
            || item.employeeName() != null && item.employeeName().toLowerCase().contains(keyword)
            || item.employeeNo() != null && item.employeeNo().toLowerCase().contains(keyword)).toList();
        return list(page(items, page, limit));
    }

    @Transactional(readOnly = true)
    public DetailResponse<OutsourceContractItem> outsourceContract(int contractId) {
        OutsourceContract row = outsourceContractOr404(contractId);
        return new DetailResponse<>(outsourceContractItem(row, repository.employees(List.of(row.employeeId))));
    }

    @Transactional(readOnly = true)
    public boolean hasDuplicateOutsourceContract(int employeeId, LocalDate startDate, Integer excludeContractId) {
        return repository.outsourceContractExists(employeeId, startDate, excludeContractId);
    }

    @Transactional
    public DetailResponse<OutsourceContractItem> createOutsourceContract(OutsourceContractCreateRequest request) {
        if (!repository.employeeExists(request.employeeId())) throw badRequest("사원을 찾을 수 없습니다.");
        if (repository.outsourceContractExists(request.employeeId(), request.startDate(), null)) throw conflict("동일한 사원/시작일 계약이 이미 존재합니다.");
        OutsourceContract row = new OutsourceContract(); row.employeeId = request.employeeId(); row.startDate = request.startDate(); row.endDate = request.endDate();
        row.totalLeaveCount = request.totalLeaveCount() == null ? 0D : request.totalLeaveCount(); row.extraLeaveCount = request.extraLeaveCount() == null ? 0D : request.extraLeaveCount();
        row.note = request.note(); row.active = true; row.createdAt = now(); row.updatedAt = row.createdAt;
        return new DetailResponse<>(write(row, () -> outsourceContractItem(row, repository.employees(List.of(row.employeeId))), "동일한 사원/시작일 계약이 이미 존재합니다."));
    }

    @Transactional
    public DetailResponse<OutsourceContractItem> updateOutsourceContract(int contractId, OutsourceContractUpdateRequest patch) {
        OutsourceContract row = outsourceContractOr404(contractId);
        if (patch.has("start_date") && patch.startDate() != null) row.startDate = patch.startDate();
        if (patch.has("end_date") && patch.endDate() != null) row.endDate = patch.endDate();
        if (patch.has("total_leave_count") && patch.totalLeaveCount() != null) row.totalLeaveCount = patch.totalLeaveCount();
        if (patch.has("extra_leave_count") && patch.extraLeaveCount() != null) row.extraLeaveCount = patch.extraLeaveCount();
        if (patch.has("note")) row.note = patch.note();
        if (patch.has("is_active") && patch.isActive() != null) row.active = patch.isActive();
        row.updatedAt = now();
        return new DetailResponse<>(write(null, () -> outsourceContractItem(row, repository.employees(List.of(row.employeeId))), "동일한 사원/시작일 계약이 이미 존재합니다."));
    }

    @Transactional
    public int deleteOutsourceContracts(Collection<Integer> ids) { return delete(repository.outsourceContractsByIds(ids), "Data integrity conflict."); }

    @Transactional(readOnly = true)
    public ListResponse<OutsourceAttendanceSummaryItem> outsourceAttendanceSummary(int page, int limit) {
        List<OutsourceContract> contracts = repository.outsourceContracts();
        Map<Integer, EmployeeView> employees = repository.employees(ids(contracts, row -> row.employeeId));
        List<OutsourceAttendanceSummaryItem> items = new ArrayList<>();
        for (OutsourceContract contract : contracts) {
            double used = repository.attendances(contract.id).stream().mapToDouble(row -> zero(row.applyCount)).sum();
            double total = contract.totalLeaveCount + contract.extraLeaveCount;
            EmployeeView employee = employees.get(contract.employeeId);
            items.add(new OutsourceAttendanceSummaryItem(contract.id, contract.employeeId, employee == null ? null : employee.displayName(), employee == null ? null : employee.employeeNo(), contract.startDate, contract.endDate, total, used, Math.max(total - used, 0D), contract.note));
        }
        return list(page(items, page, limit));
    }

    @Transactional(readOnly = true)
    public ListResponse<OutsourceAttendanceItem> outsourceAttendances(int contractId, int page, int limit) {
        return list(page(repository.attendances(contractId).stream().map(this::outsourceAttendanceItem).toList(), page, limit));
    }

    @Transactional
    public ListResponse<OutsourceAttendanceItem> createOutsourceAttendance(OutsourceAttendanceCreateRequest request) {
        if (repository.outsourceContract(request.contractId()).isEmpty()) throw badRequest("계약을 찾을 수 없습니다.");
        OutsourceAttendance row = new OutsourceAttendance(); row.contractId = request.contractId(); row.employeeId = request.employeeId(); row.attendanceCode = request.attendanceCode();
        row.applyDate = request.applyDate(); row.statusCode = request.statusCode(); row.startDate = request.startDate(); row.endDate = request.endDate(); row.applyCount = request.applyCount(); row.note = request.note(); row.createdAt = now(); row.updatedAt = row.createdAt;
        write(row, () -> row, "Data integrity conflict.");
        List<OutsourceAttendanceItem> items = repository.attendances(row.contractId).stream().map(this::outsourceAttendanceItem).toList();
        return new ListResponse<>(items, items.size(), 1, Math.max(items.size(), 1));
    }

    @Transactional
    public int deleteOutsourceAttendances(Collection<Integer> ids) { return delete(repository.attendancesByIds(ids), "Data integrity conflict."); }

    @Transactional(readOnly = true)
    public ListResponse<InfraMasterItem> infraMasters(Integer companyId, int page, int limit) {
        List<InfraMaster> rows = repository.infraMasters(companyId);
        Map<Integer, String> companies = repository.companyNames(ids(rows, row -> row.companyId));
        return list(page(rows.stream().map(row -> infraMasterItem(row, companies)).toList(), page, limit));
    }

    @Transactional
    public ListResponse<InfraMasterItem> createInfraMaster(InfraMasterCreateRequest request) {
        String serviceType = request.serviceType().trim(); String envType = request.envType().trim();
        if (repository.infraMasterExists(request.companyId(), serviceType, envType)) throw conflict("동일한 인프라 구성이 이미 존재합니다.");
        InfraMaster row = new InfraMaster(); row.companyId = request.companyId(); row.serviceType = serviceType; row.envType = envType; row.active = true; row.createdAt = now(); row.updatedAt = row.createdAt;
        write(row, () -> row, "동일한 인프라 구성이 이미 존재합니다.");
        List<InfraMasterItem> items = infraMasters(null, 1, Integer.MAX_VALUE).items();
        return new ListResponse<>(items, items.size(), 1, Math.max(items.size(), 1));
    }

    @Transactional
    public int deleteInfraMasters(Collection<Integer> ids) {
        List<InfraMaster> rows = repository.infraMastersByIds(ids);
        repository.deleteConfigsByMasterIds(ids(rows, row -> row.id));
        rows.forEach(repository::remove);
        return write(null, rows::size, "Data integrity conflict.");
    }

    @Transactional(readOnly = true)
    public ListResponse<InfraConfigItem> infraConfigs(int masterId, int page, int limit) {
        return list(page(repository.infraConfigs(masterId).stream().map(this::infraConfigItem).toList(), page, limit));
    }

    @Transactional
    public ListResponse<InfraConfigItem> upsertInfraConfigs(int masterId, InfraConfigUpsertRequest request) {
        if (repository.lockInfraMaster(masterId).isEmpty()) throw notFound("인프라 마스터를 찾을 수 없습니다.");
        for (var requestRow : request.rows()) {
            InfraConfig config = repository.infraConfig(masterId, requestRow.section(), requestRow.configKey()).orElseGet(() -> {
                InfraConfig created = new InfraConfig(); created.masterId = masterId; created.section = requestRow.section().trim(); created.configKey = requestRow.configKey().trim(); created.createdAt = now(); return created;
            });
            config.configValue = requestRow.configValue(); config.sortOrder = requestRow.sortOrder(); config.updatedAt = now();
            if (config.id == null) repository.persist(config);
        }
        List<InfraConfigItem> items = write(null, () -> repository.infraConfigs(masterId).stream().map(this::infraConfigItem).toList(), "Data integrity conflict.");
        return new ListResponse<>(items, items.size(), 1, Math.max(items.size(), 1));
    }

    @Transactional
    public void deleteInfraConfig(int configId) {
        InfraConfig config = repository.infraConfig(configId).orElseThrow(() -> notFound("인프라 구성을 찾을 수 없습니다."));
        repository.remove(config); write(null, () -> null, "Data integrity conflict.");
    }

    private Company companyOr404(int id) { return repository.company(id).orElseThrow(() -> notFound("고객사를 찾을 수 없습니다.")); }
    private DevRequest devRequestOr404(int id) { return repository.devRequest(id).orElseThrow(() -> notFound("추가개발 요청을 찾을 수 없습니다.")); }
    private DevProject devProjectOr404(int id) { return repository.devProject(id).orElseThrow(() -> notFound("프로젝트를 찾을 수 없습니다.")); }
    private DevInquiry devInquiryOr404(int id) { return repository.devInquiry(id).orElseThrow(() -> notFound("문의를 찾을 수 없습니다.")); }
    private OutsourceContract outsourceContractOr404(int id) { return repository.outsourceContract(id).orElseThrow(() -> notFound("계약을 찾을 수 없습니다.")); }

    private int delete(List<?> rows, String conflictDetail) {
        rows.forEach(repository::remove);
        return write(null, rows::size, conflictDetail);
    }

    private <T> T write(Object created, Supplier<T> result, String conflictDetail) {
        try {
            if (created != null) repository.persist(created);
            repository.flush();
            return result.get();
        } catch (DataIntegrityViolationException exception) {
            throw conflict(conflictDetail);
        }
    }

    private CompanyItem companyItem(Company row) { return new CompanyItem(row.id, row.companyCode, row.companyName, row.companyGroupCode, row.companyType, row.managementType, row.representativeCompany, row.startDate, row.active, row.createdAt, row.updatedAt); }
    private ManagerCompanyItem managerCompanyItem(ManagerCompany row, Map<Integer, String> companies, Map<Integer, EmployeeView> employees) { EmployeeView employee = employees.get(row.employeeId); return new ManagerCompanyItem(row.id, row.employeeId, employee == null ? null : employee.displayName(), row.companyId, companies.get(row.companyId), row.startDate, row.endDate, row.note, row.active, row.createdAt, row.updatedAt); }
    private DevRequestItem devRequestItem(DevRequest row, Map<Integer, String> companies, Map<Integer, EmployeeView> employees) { EmployeeView manager = row.managerEmployeeId == null ? null : employees.get(row.managerEmployeeId); EmployeeView developer = row.developerEmployeeId == null ? null : employees.get(row.developerEmployeeId); return new DevRequestItem(row.id, row.companyId, companies.get(row.companyId), row.requestYm, row.requestSeq, row.statusCode, null, row.partCode, null, row.requesterName, row.requestContent, row.managerEmployeeId, manager == null ? null : manager.displayName(), row.developerEmployeeId, developer == null ? null : developer.displayName(), row.paid, row.paidContent, row.taxBill, row.startYm, row.endYm, row.devStartDate, row.devEndDate, row.paidManMonths, row.actualManMonths, row.note, row.createdAt, row.updatedAt); }
    private DevProjectItem devProjectItem(DevProject row, Map<Integer, String> companies) { return new DevProjectItem(row.id, row.projectName, row.companyId, companies.get(row.companyId), row.partCode, null, row.assignedStaff, row.contractStartDate, row.contractEndDate, row.devStartDate, row.devEndDate, row.inspectionStatus, null, row.taxBill, row.actualManMonths, row.contractAmount, row.note, row.createdAt, row.updatedAt); }
    private DevInquiryItem devInquiryItem(DevInquiry row, Map<Integer, String> companies) { return new DevInquiryItem(row.id, row.companyId, companies.get(row.companyId), row.inquiryContent, row.hopedStartDate, row.estimatedManMonths, row.salesRepName, row.clientContactName, row.progressCode, null, row.confirmed, row.projectName, row.note, row.createdAt, row.updatedAt); }
    private OutsourceContractItem outsourceContractItem(OutsourceContract row, Map<Integer, EmployeeView> employees) { EmployeeView employee = employees.get(row.employeeId); return new OutsourceContractItem(row.id, row.employeeId, employee == null ? null : employee.displayName(), employee == null ? null : employee.employeeNo(), row.startDate, row.endDate, row.totalLeaveCount, row.extraLeaveCount, row.note, row.active, row.createdAt, row.updatedAt); }
    private OutsourceAttendanceItem outsourceAttendanceItem(OutsourceAttendance row) { return new OutsourceAttendanceItem(row.id, row.contractId, row.employeeId, row.attendanceCode, null, row.applyDate, row.statusCode, null, row.startDate, row.endDate, row.applyCount, row.note, row.createdAt, row.updatedAt); }
    private InfraMasterItem infraMasterItem(InfraMaster row, Map<Integer, String> companies) { return new InfraMasterItem(row.id, row.companyId, companies.get(row.companyId), row.serviceType, null, row.envType, row.active, row.createdAt, row.updatedAt); }
    private InfraConfigItem infraConfigItem(InfraConfig row) { return new InfraConfigItem(row.id, row.masterId, row.section, row.configKey, row.configValue, row.sortOrder, row.createdAt, row.updatedAt); }

    private Map<Integer, String> companyNames(List<DevRequest> rows) { return repository.companyNames(ids(rows, row -> row.companyId)); }
    private Map<Integer, EmployeeView> employeesForRequests(List<DevRequest> rows) { HashSet<Integer> ids = new HashSet<>(); for (DevRequest row : rows) { if (row.managerEmployeeId != null) ids.add(row.managerEmployeeId); if (row.developerEmployeeId != null) ids.add(row.developerEmployeeId); } return repository.employees(ids); }
    private Collection<Integer> employeeIds(DevRequest row) { List<Integer> ids = new ArrayList<>(); if (row.managerEmployeeId != null) ids.add(row.managerEmployeeId); if (row.developerEmployeeId != null) ids.add(row.developerEmployeeId); return ids; }
    private static <T> HashSet<Integer> ids(Collection<T> rows, java.util.function.Function<T, Integer> extractor) { HashSet<Integer> values = new HashSet<>(); for (T row : rows) { Integer value = extractor.apply(row); if (value != null) values.add(value); } return values; }
    private static <T> ListResponse<T> list(Page<T> page) { return new ListResponse<>(page.items(), page.totalCount(), page.page(), page.limit()); }
    private static <T> Page<T> page(List<T> all, int page, int limit) { int from = Math.min((page - 1) * limit, all.size()); int to = Math.min(from + limit, all.size()); return new Page<>(all.subList(from, to), all.size(), page, limit); }
    private static LocalDateTime now() { return LocalDateTime.now(ZoneOffset.UTC); }
    private static LocalDate month(LocalDate date) { LocalDate value = date == null ? LocalDate.now(ZoneOffset.UTC) : date; return value.withDayOfMonth(1); }
    private static double zero(Double value) { return value == null ? 0D : value; }
    private static String trim(String value) { return value == null ? null : value.trim(); }
    private static ApiException notFound(String detail) { return ApiException.notFound(detail); }
    private static ApiException badRequest(String detail) { return ApiException.badRequest(detail); }
    private static ApiException conflict(String detail) { return ApiException.conflict(detail); }

    private record Page<T>(List<T> items, int totalCount, int page, int limit) { }
}
