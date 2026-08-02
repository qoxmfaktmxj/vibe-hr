package com.vibehr.seed;

import javax.sql.DataSource;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
@Profile("demo-seed")
public class DemoSeedRunner implements ApplicationRunner {

    private final DataSource dataSource;
    private final Environment environment;

    public DemoSeedRunner(DataSource dataSource, Environment environment) {
        this.dataSource = dataSource;
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        if (!"demo".equals(environment.getProperty("vibehr.seed.confirmation"))) throw new IllegalStateException("demo-seed requires --vibehr.seed.confirmation=demo.");
        int employeeCount = environment.getProperty("vibehr.seed.demo-employee-count", Integer.class, 6000);
        try (var connection = dataSource.getConnection()) {
            System.out.println("Demo fixture seed: " + new FixtureSeedService().seedDemo(connection, employeeCount, environment));
        }
    }
}
