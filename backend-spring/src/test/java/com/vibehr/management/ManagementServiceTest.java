package com.vibehr.management;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vibehr.management.api.ManagementDtos.CompanyCreateRequest;
import com.vibehr.management.api.ManagementDtos.CompanyUpdateRequest;
import com.vibehr.management.api.ManagementDtos.DevInquiryUpdateRequest;
import com.vibehr.management.api.ManagementDtos.DevRequestCreateRequest;
import com.vibehr.management.api.ManagementDtos.InfraMasterCreateRequest;
import com.vibehr.management.api.ManagementDtos.ManagerCompanyCreateRequest;
import com.vibehr.management.api.ManagementDtos.OutsourceContractCreateRequest;
import com.vibehr.management.application.ManagementService;
import com.vibehr.management.persistence.ManagementEntities.Company;
import com.vibehr.management.persistence.ManagementRepository;
import com.vibehr.platform.error.ApiException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class ManagementServiceTest {
    private final ManagementRepository repository = mock(ManagementRepository.class);
    private final ManagementService service = new ManagementService(repository);

    @Test
    void allocatesTheNextDevRequestSequenceWhileHoldingTheCompanyRowLock() {
        Company company = new Company(); company.id = 7;
        when(repository.lockCompany(7)).thenReturn(Optional.of(company));
        when(repository.maxRequestSequence(7, LocalDate.of(2026, 8, 1))).thenReturn(4);
        when(repository.companyNames(List.of(7))).thenReturn(Map.of(7, "Vibe"));
        when(repository.employees(any())).thenReturn(Map.of());
        doNothing().when(repository).persist(any());
        doNothing().when(repository).flush();

        var response = service.createDevRequest(new DevRequestCreateRequest(7, LocalDate.of(2026, 8, 1), 0,
                null, null, null, null, null, null, Boolean.FALSE, null, Boolean.FALSE,
                null, null, null, null, null, null, null));

        assertThat(response.item().requestSeq()).isEqualTo(5);
        verify(repository).lockCompany(7);
        verify(repository).maxRequestSequence(7, LocalDate.of(2026, 8, 1));
    }

    @Test
    void rejectsARepeatedCompanyCodeBeforeWriting() {
        when(repository.companyCodeExists("VIBE")).thenReturn(true);

        assertThatThrownBy(() -> service.createCompany(new CompanyCreateRequest(" VIBE ", "Vibe", null, null, null, null, null)))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.status().value()).isEqualTo(409);
                    assertThat(exception.detail()).isEqualTo("이미 존재하는 회사코드입니다.");
                });
    }

    @Test
    void rejectsARepeatedOutsourceContractWithConflictSemantics() {
        when(repository.employeeExists(9)).thenReturn(true);
        when(repository.outsourceContractExists(9, LocalDate.of(2026, 8, 1), null)).thenReturn(true);

        assertThatThrownBy(() -> service.createOutsourceContract(new OutsourceContractCreateRequest(9,
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 12, 31), null, null, null)))
                .isInstanceOf(ApiException.class)
                .hasMessage("동일한 사원/시작일 계약이 이미 존재합니다.");
    }

    @Test
    void companyPatchIgnoresExplicitNullLikeThePythonService() {
        Company company = new Company();
        company.id = 3;
        company.companyName = "기존 고객사";
        when(repository.company(3)).thenReturn(Optional.of(company));

        CompanyUpdateRequest patch = new CompanyUpdateRequest();
        patch.companyName(null);
        service.updateCompany(3, patch);

        assertThat(company.companyName).isEqualTo("기존 고객사");
    }

    @Test
    void nullableDevelopmentPatchDistinguishesExplicitNullFromOmission() {
        var inquiry = new com.vibehr.management.persistence.ManagementEntities.DevInquiry();
        inquiry.id = 5;
        inquiry.companyId = 3;
        inquiry.inquiryContent = "preserved";
        inquiry.note = "clear me";
        when(repository.devInquiry(5)).thenReturn(Optional.of(inquiry));
        when(repository.companyNames(List.of(3))).thenReturn(Map.of(3, "고객사"));

        DevInquiryUpdateRequest patch = new DevInquiryUpdateRequest();
        patch.note(null);
        service.updateDevInquiry(5, patch);

        assertThat(inquiry.note).isNull();
        assertThat(inquiry.inquiryContent).isEqualTo("preserved");
    }

    @Test
    void restoresRepresentativePythonErrorDetailsAndStatuses() {
        when(repository.company(404)).thenReturn(Optional.empty());
        when(repository.infraMasterExists(3, "DB", "PROD")).thenReturn(true);

        assertThatThrownBy(() -> service.company(404))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.status().value()).isEqualTo(404);
                    assertThat(exception.detail()).isEqualTo("고객사를 찾을 수 없습니다.");
                });
        assertThatThrownBy(() -> service.createInfraMaster(new InfraMasterCreateRequest(3, "DB", "PROD")))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.status().value()).isEqualTo(409);
                    assertThat(exception.detail()).isEqualTo("동일한 인프라 구성이 이미 존재합니다.");
                });
    }

    @Test
    void restoresBadRequestAndFeatureSpecificNotFoundDetails() {
        when(repository.employeeExists(99)).thenReturn(false);
        when(repository.devRequest(41)).thenReturn(Optional.empty());
        when(repository.outsourceContract(42)).thenReturn(Optional.empty());
        when(repository.infraConfig(43)).thenReturn(Optional.empty());

        assertError(() -> service.createManagerCompany(new ManagerCompanyCreateRequest(
                99, 3, LocalDate.of(2026, 8, 1), null, null)), 400, "사원을 찾을 수 없습니다.");
        assertError(() -> service.devRequest(41), 404, "추가개발 요청을 찾을 수 없습니다.");
        assertError(() -> service.outsourceContract(42), 404, "계약을 찾을 수 없습니다.");
        assertError(() -> service.deleteInfraConfig(43), 404, "인프라 구성을 찾을 수 없습니다.");
    }

    private static void assertError(org.assertj.core.api.ThrowableAssert.ThrowingCallable operation,
                                    int status, String detail) {
        assertThatThrownBy(operation).isInstanceOfSatisfying(ApiException.class, exception -> {
            assertThat(exception.status().value()).isEqualTo(status);
            assertThat(exception.detail()).isEqualTo(detail);
        });
    }
}
