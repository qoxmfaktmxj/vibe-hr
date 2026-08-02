package com.vibehr.management.persistence;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Repository;

/** JPA access for the MNG aggregate tables; HR/auth values are queried as scalar projections. */
@Repository
public class ManagementRepository {
    @PersistenceContext
    private EntityManager entityManager;

    public List<ManagementEntities.Company> companies(String search) {
        String where = " where c.active = true";
        if (search != null && !search.isBlank()) {
            where += " and (lower(c.companyName) like lower(:search) or lower(c.companyCode) like lower(:search))";
        }
        var query = entityManager.createQuery("select c from Company c" + where + " order by c.companyCode", ManagementEntities.Company.class);
        if (search != null && !search.isBlank()) {
            query.setParameter("search", "%" + search.trim() + "%");
        }
        return query.getResultList();
    }

    public List<ManagementEntities.Company> activeCompanies() {
        return entityManager.createQuery("select c from Company c where c.active = true order by c.companyName", ManagementEntities.Company.class).getResultList();
    }

    public Optional<ManagementEntities.Company> company(int id) {
        return Optional.ofNullable(entityManager.find(ManagementEntities.Company.class, id));
    }

    public Optional<ManagementEntities.Company> lockCompany(int id) {
        return Optional.ofNullable(entityManager.find(ManagementEntities.Company.class, id, LockModeType.PESSIMISTIC_WRITE));
    }

    public boolean companyCodeExists(String companyCode) {
        return !entityManager.createQuery("select c.id from Company c where c.companyCode = :companyCode", Integer.class)
            .setParameter("companyCode", companyCode).setMaxResults(1).getResultList().isEmpty();
    }

    public List<ManagementEntities.Company> companiesByIds(Collection<Integer> ids) {
        if (ids.isEmpty()) return List.of();
        return entityManager.createQuery("select c from Company c where c.id in :ids", ManagementEntities.Company.class)
            .setParameter("ids", ids).getResultList();
    }

    public Map<Integer, String> companyNames(Collection<Integer> ids) {
        Map<Integer, String> names = new HashMap<>();
        for (ManagementEntities.Company company : companiesByIds(ids)) names.put(company.id, company.companyName);
        return names;
    }

    public List<ManagementEntities.ManagerCompany> managerCompanies() {
        return entityManager.createQuery("select m from ManagerCompany m where m.active = true order by m.id", ManagementEntities.ManagerCompany.class).getResultList();
    }

    public List<ManagementEntities.ManagerCompany> managerCompaniesByIds(Collection<Integer> ids) {
        return byIds("select m from ManagerCompany m where m.id in :ids", ids, ManagementEntities.ManagerCompany.class);
    }

    public List<ManagementEntities.DevRequest> devRequests(Integer companyId, String statusCode) {
        String where = " where 1 = 1";
        if (companyId != null && companyId != 0) where += " and r.companyId = :companyId";
        if (statusCode != null && !statusCode.isBlank()) where += " and r.statusCode = :statusCode";
        var query = entityManager.createQuery("select r from DevRequest r" + where + " order by r.id desc", ManagementEntities.DevRequest.class);
        if (companyId != null && companyId != 0) query.setParameter("companyId", companyId);
        if (statusCode != null && !statusCode.isBlank()) query.setParameter("statusCode", statusCode);
        return query.getResultList();
    }

    public Optional<ManagementEntities.DevRequest> devRequest(int id) {
        return Optional.ofNullable(entityManager.find(ManagementEntities.DevRequest.class, id));
    }

    public int maxRequestSequence(int companyId, LocalDate requestYm) {
        Integer value = entityManager.createQuery("select max(r.requestSeq) from DevRequest r where r.companyId = :companyId and r.requestYm = :requestYm", Integer.class)
            .setParameter("companyId", companyId).setParameter("requestYm", requestYm).getSingleResult();
        return value == null ? 0 : value;
    }

    public List<ManagementEntities.DevRequest> devRequestsByIds(Collection<Integer> ids) {
        return byIds("select r from DevRequest r where r.id in :ids", ids, ManagementEntities.DevRequest.class);
    }

    public List<ManagementEntities.DevProject> devProjects(Integer companyId) {
        String query = "select p from DevProject p" + (companyId != null && companyId != 0 ? " where p.companyId = :companyId" : "") + " order by p.id desc";
        var typed = entityManager.createQuery(query, ManagementEntities.DevProject.class);
        if (companyId != null && companyId != 0) typed.setParameter("companyId", companyId);
        return typed.getResultList();
    }

    public Optional<ManagementEntities.DevProject> devProject(int id) {
        return Optional.ofNullable(entityManager.find(ManagementEntities.DevProject.class, id));
    }

    public List<ManagementEntities.DevProject> devProjectsByIds(Collection<Integer> ids) {
        return byIds("select p from DevProject p where p.id in :ids", ids, ManagementEntities.DevProject.class);
    }

    public List<ManagementEntities.DevInquiry> devInquiries(Integer companyId, String progressCode) {
        String where = " where 1 = 1";
        if (companyId != null && companyId != 0) where += " and q.companyId = :companyId";
        if (progressCode != null && !progressCode.isBlank()) where += " and q.progressCode = :progressCode";
        var query = entityManager.createQuery("select q from DevInquiry q" + where + " order by q.id desc", ManagementEntities.DevInquiry.class);
        if (companyId != null && companyId != 0) query.setParameter("companyId", companyId);
        if (progressCode != null && !progressCode.isBlank()) query.setParameter("progressCode", progressCode);
        return query.getResultList();
    }

    public Optional<ManagementEntities.DevInquiry> devInquiry(int id) {
        return Optional.ofNullable(entityManager.find(ManagementEntities.DevInquiry.class, id));
    }

    public List<ManagementEntities.DevInquiry> devInquiriesByIds(Collection<Integer> ids) {
        return byIds("select q from DevInquiry q where q.id in :ids", ids, ManagementEntities.DevInquiry.class);
    }

    public List<ManagementEntities.OutsourceContract> outsourceContracts() {
        return entityManager.createQuery("select c from OutsourceContract c where c.active = true order by c.id desc", ManagementEntities.OutsourceContract.class).getResultList();
    }

    public Optional<ManagementEntities.OutsourceContract> outsourceContract(int id) {
        return Optional.ofNullable(entityManager.find(ManagementEntities.OutsourceContract.class, id));
    }

    public List<ManagementEntities.OutsourceContract> outsourceContractsByIds(Collection<Integer> ids) {
        return byIds("select c from OutsourceContract c where c.id in :ids", ids, ManagementEntities.OutsourceContract.class);
    }

    public boolean outsourceContractExists(int employeeId, LocalDate startDate, Integer excludeId) {
        String query = "select c.id from OutsourceContract c where c.employeeId = :employeeId and c.startDate = :startDate" + (excludeId == null || excludeId == 0 ? "" : " and c.id <> :excludeId");
        var typed = entityManager.createQuery(query, Integer.class).setParameter("employeeId", employeeId).setParameter("startDate", startDate).setMaxResults(1);
        if (excludeId != null && excludeId != 0) typed.setParameter("excludeId", excludeId);
        return !typed.getResultList().isEmpty();
    }

    public List<ManagementEntities.OutsourceAttendance> attendances(int contractId) {
        return entityManager.createQuery("select a from OutsourceAttendance a where a.contractId = :contractId order by a.startDate desc", ManagementEntities.OutsourceAttendance.class)
            .setParameter("contractId", contractId).getResultList();
    }

    public List<ManagementEntities.OutsourceAttendance> attendancesByIds(Collection<Integer> ids) {
        return byIds("select a from OutsourceAttendance a where a.id in :ids", ids, ManagementEntities.OutsourceAttendance.class);
    }

    public List<ManagementEntities.InfraMaster> infraMasters(Integer companyId) {
        String query = "select m from InfraMaster m where m.active = true" + (companyId != null && companyId != 0 ? " and m.companyId = :companyId" : "") + " order by m.id desc";
        var typed = entityManager.createQuery(query, ManagementEntities.InfraMaster.class);
        if (companyId != null && companyId != 0) typed.setParameter("companyId", companyId);
        return typed.getResultList();
    }

    public Optional<ManagementEntities.InfraMaster> infraMaster(int id) {
        return Optional.ofNullable(entityManager.find(ManagementEntities.InfraMaster.class, id));
    }

    public Optional<ManagementEntities.InfraMaster> lockInfraMaster(int id) {
        return Optional.ofNullable(entityManager.find(ManagementEntities.InfraMaster.class, id, LockModeType.PESSIMISTIC_WRITE));
    }

    public List<ManagementEntities.InfraMaster> infraMastersByIds(Collection<Integer> ids) {
        return byIds("select m from InfraMaster m where m.id in :ids", ids, ManagementEntities.InfraMaster.class);
    }

    public boolean infraMasterExists(int companyId, String serviceType, String envType) {
        return !entityManager.createQuery("select m.id from InfraMaster m where m.companyId = :companyId and m.serviceType = :serviceType and m.envType = :envType", Integer.class)
            .setParameter("companyId", companyId).setParameter("serviceType", serviceType).setParameter("envType", envType).setMaxResults(1).getResultList().isEmpty();
    }

    public List<ManagementEntities.InfraConfig> infraConfigs(int masterId) {
        return entityManager.createQuery("select c from InfraConfig c where c.masterId = :masterId order by c.section, c.sortOrder", ManagementEntities.InfraConfig.class)
            .setParameter("masterId", masterId).getResultList();
    }

    public Optional<ManagementEntities.InfraConfig> infraConfig(int id) {
        return Optional.ofNullable(entityManager.find(ManagementEntities.InfraConfig.class, id));
    }

    public Optional<ManagementEntities.InfraConfig> infraConfig(int masterId, String section, String configKey) {
        return entityManager.createQuery("select c from InfraConfig c where c.masterId = :masterId and c.section = :section and c.configKey = :configKey", ManagementEntities.InfraConfig.class)
            .setParameter("masterId", masterId).setParameter("section", section).setParameter("configKey", configKey).getResultStream().findFirst();
    }

    public void deleteConfigsByMasterIds(Collection<Integer> masterIds) {
        if (!masterIds.isEmpty()) entityManager.createQuery("delete from InfraConfig c where c.masterId in :ids").setParameter("ids", masterIds).executeUpdate();
    }

    public boolean employeeExists(int employeeId) {
        Number count = (Number) entityManager.createNativeQuery("select count(*) from hr_employees where id = :employeeId")
            .setParameter("employeeId", employeeId).getSingleResult();
        return count.longValue() > 0;
    }

    public Map<Integer, EmployeeView> employees(Collection<Integer> employeeIds) {
        if (employeeIds.isEmpty()) return Map.of();
        Query query = entityManager.createNativeQuery("select e.id, u.display_name, e.employee_no from hr_employees e left join auth_users u on u.id = e.user_id where e.id in (:employeeIds)");
        query.setParameter("employeeIds", employeeIds);
        Map<Integer, EmployeeView> result = new HashMap<>();
        for (Object[] row : (List<Object[]>) query.getResultList()) {
            result.put(((Number) row[0]).intValue(), new EmployeeView((String) row[1], (String) row[2]));
        }
        return result;
    }

    public void persist(Object entity) { entityManager.persist(entity); }
    public void remove(Object entity) { entityManager.remove(entity); }
    public void flush() { entityManager.flush(); }

    private <T> List<T> byIds(String jpql, Collection<Integer> ids, Class<T> type) {
        if (ids.isEmpty()) return List.of();
        return entityManager.createQuery(jpql, type).setParameter("ids", ids).getResultList();
    }

    public record EmployeeView(String displayName, String employeeNo) { }
}
