package com.vibehr;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class VibeHrApplication {

    public static void main(String[] args) {
        SpringApplication.run(VibeHrApplication.class, args);
    }
}
