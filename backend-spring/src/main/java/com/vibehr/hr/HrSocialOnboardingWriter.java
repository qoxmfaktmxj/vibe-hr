package com.vibehr.hr;

import com.vibehr.platform.error.ApiException;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * HR-owned writer for the employee aggregate created after social authentication.
 *
 * <p>Authentication owns the user and role rows; this service owns the HR aggregate so every
 * table has one JPA mapping and one write boundary.</p>
 */
@Service
public class HrSocialOnboardingWriter {
    private static final String EMPLOYEE_NUMBER_NAMESPACE_LOCK = "hr_employee_number_namespace";

    private final EntityManager entityManager;
    private final Clock clock;

    public HrSocialOnboardingWriter(EntityManager entityManager, Clock clock) {
        this.entityManager = entityManager;
        this.clock = clock;
    }

    @Transactional
    public void ensureEmployee(int userId, int departmentId) {
        lockEmployeeNumberNamespace();

        HrEmployee employee = employeeForUser(userId);
        if (employee == null) {
            Instant now = clock.instant();
            employee = new HrEmployee();
            employee.user_id = userId;
            employee.employee_no = nextAvailableEmployeeNumber();
            employee.department_id = departmentId;
            employee.position_title = "\uC0AC\uC6D0";
            employee.hire_date = LocalDate.now(clock);
            employee.employment_status = "active";
            employee.created_at = now;
            employee.updated_at = now;
            entityManager.persist(employee);
            entityManager.flush();
        }

        if (basicProfileFor(employee.id) == null) {
            Instant now = clock.instant();
            HrEmployeeBasicProfile profile = new HrEmployeeBasicProfile();
            profile.employee_id = employee.id;
            profile.created_at = now;
            profile.updated_at = now;
            entityManager.persist(profile);
        }
    }

    private HrEmployee employeeForUser(int userId) {
        return entityManager.createQuery(
                        "select e from HrEmployee e where e.user_id = :userId", HrEmployee.class)
                .setParameter("userId", userId)
                .getResultStream()
                .findFirst()
                .orElse(null);
    }

    private HrEmployeeBasicProfile basicProfileFor(int employeeId) {
        return entityManager.createQuery(
                        "select p from HrEmployeeBasicProfile p where p.employee_id = :employeeId",
                        HrEmployeeBasicProfile.class)
                .setParameter("employeeId", employeeId)
                .getResultStream()
                .findFirst()
                .orElse(null);
    }

    private String nextAvailableEmployeeNumber() {
        for (int sequence = 1; sequence < 1_000_000; sequence++) {
            String employeeNo = String.format("EMP-%06d", sequence);
            Long existing = entityManager.createQuery(
                            "select count(e) from HrEmployee e where e.employee_no = :employeeNo", Long.class)
                    .setParameter("employeeNo", employeeNo)
                    .getSingleResult();
            if (existing == 0) {
                return employeeNo;
            }
        }
        throw ApiException.badRequest("No employee number is available.");
    }

    private void lockEmployeeNumberNamespace() {
        entityManager.createNativeQuery("select pg_advisory_xact_lock(hashtext(:name))")
                .setParameter("name", EMPLOYEE_NUMBER_NAMESPACE_LOCK)
                .getSingleResult();
    }
}
