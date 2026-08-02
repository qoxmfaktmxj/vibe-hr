package com.vibehr.seed;

import javax.sql.DataSource;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
@Profile("dev-seed")
public class DevSeedRunner implements ApplicationRunner {

    private final DataSource dataSource;
    private final Environment environment;

    public DevSeedRunner(DataSource dataSource, Environment environment) {
        this.dataSource = dataSource;
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        if (!"dev".equals(environment.getProperty("vibehr.seed.confirmation"))) throw new IllegalStateException("dev-seed requires --vibehr.seed.confirmation=dev.");
        try (var connection = dataSource.getConnection()) {
            System.out.println("Dev fixture seed: " + new FixtureSeedService().seedDev(connection, environment));
        }
    }
}
