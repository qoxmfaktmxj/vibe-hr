package com.vibehr.platform.health;

import java.sql.SQLException;
import java.sql.Statement;
import javax.sql.DataSource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

@Component
public class DatabaseHealthCheck {

    private final ObjectProvider<DataSource> dataSourceProvider;

    public DatabaseHealthCheck(ObjectProvider<DataSource> dataSourceProvider) {
        this.dataSourceProvider = dataSourceProvider;
    }

    public boolean isAvailable() {
        DataSource dataSource = dataSourceProvider.getIfAvailable();
        if (dataSource == null) {
            return false;
        }
        try (var connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            return statement.execute("SELECT 1");
        } catch (SQLException | RuntimeException exception) {
            return false;
        }
    }
}
