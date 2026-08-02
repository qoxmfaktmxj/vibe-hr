package com.vibehr.hr;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

record HrRetireConfirmedEvent(int caseId) { }

@Component
class HrRetirementSeveranceListener {
    private static final Logger log = LoggerFactory.getLogger(HrRetirementSeveranceListener.class);
    private final HrApplicationService service;

    HrRetirementSeveranceListener(HrApplicationService service) { this.service = service; }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void createDraft(HrRetireConfirmedEvent event) {
        try {
            service.createSeveranceDraftFromRetireCase(event.caseId());
        } catch (RuntimeException exception) {
            log.error("Failed to create severance draft for retire_case_id={}", event.caseId(), exception);
        }
    }
}
