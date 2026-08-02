package com.vibehr.migration;

import javax.sql.DataSource;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Explicit command profile; normal Spring startup never calls adoption. */
@Component
@Profile("flyway-adoption")
public class FlywayAdoptionRunner implements ApplicationRunner {

    private final DataSource dataSource;
    private final Environment environment;

    public FlywayAdoptionRunner(DataSource dataSource, Environment environment) {
        this.dataSource = dataSource;
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        if (!"adopt-exact-alembic-head".equals(environment.getProperty("vibehr.migration.adoption-confirmation"))) {
            throw new IllegalStateException("Adoption requires --vibehr.migration.adoption-confirmation=adopt-exact-alembic-head.");
        }
        System.out.println("Flyway adoption result: " + new FlywayAdoptionService(dataSource).adopt());
    }
}
