package com.vibehr.migration;

import javax.sql.DataSource;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Explicit one-shot command; normal Spring startup never invokes reconciliation. */
@Component
@Profile("pre-adoption-reconciliation")
public class PreAdoptionReconciliationRunner implements ApplicationRunner {

    private final DataSource dataSource;
    private final Environment environment;

    public PreAdoptionReconciliationRunner(DataSource dataSource, Environment environment) {
        this.dataSource = dataSource;
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        String confirmation = environment.getProperty("vibehr.migration.reconciliation-confirmation");
        String fingerprint = environment.getProperty("vibehr.migration.expected-source-fingerprint");
        var report = new PreAdoptionReconciliationService(dataSource).reconcile(confirmation, fingerprint);
        System.out.println("Pre-adoption reconciliation result: " + report);
    }
}
