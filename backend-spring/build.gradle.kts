import org.springframework.boot.gradle.tasks.bundling.BootJar
import java.security.SecureRandom
import java.util.HexFormat

plugins {
    java
    id("org.springframework.boot") version "4.1.0"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.vibehr"
version = "0.1.0-SNAPSHOT"
description = "Vibe-HR Spring platform migration"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-flyway")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.0.3")
    implementation("org.flywaydb:flyway-core")
    implementation("org.mybatis.spring.boot:mybatis-spring-boot-starter:4.0.0")
    implementation("org.apache.pdfbox:pdfbox:3.0.8")
    implementation("org.webjars:redoc:2.5.1")

    runtimeOnly("org.postgresql:postgresql")
    runtimeOnly("org.flywaydb:flyway-database-postgresql")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    testImplementation(platform("org.testcontainers:testcontainers-bom:2.0.5"))
    testImplementation("org.testcontainers:testcontainers-junit-jupiter")
    testImplementation("org.testcontainers:testcontainers-postgresql")
}

tasks.withType<JavaCompile>().configureEach {
    options.release = 21
    options.compilerArgs.add("-parameters")
}

sourceSets.named("test") {
    // Keep production classes on the test compiler classpath for the dedicated migration task as well.
    compileClasspath += sourceSets["main"].output
    runtimeClasspath += sourceSets["main"].output
}

fun random256BitHex(): String {
    val bytes = ByteArray(32)
    SecureRandom().nextBytes(bytes)
    return HexFormat.of().formatHex(bytes)
}

val testAuthSecret = random256BitHex()
val testBffAssertionSecret = generateSequence(::random256BitHex).first { it != testAuthSecret }

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    systemProperty("vibehr.auth.secret", testAuthSecret)
    systemProperty("vibehr.bff-assertion.secret", testBffAssertionSecret)
}

tasks.named<Test>("test") {
    useJUnitPlatform {
        excludeTags("integration")
    }
}

tasks.register<Test>("integrationTest") {
    group = "verification"
    description = "Runs Docker-backed Testcontainers checks when VIBEHR_RUN_CONTAINER_TESTS=true."
    dependsOn(tasks.named("testClasses"))
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    shouldRunAfter(tasks.named("test"))
    useJUnitPlatform {
        includeTags("integration")
    }
    systemProperty("spring.profiles.active", "integration")
    onlyIf("VIBEHR_RUN_CONTAINER_TESTS=true") {
        System.getenv("VIBEHR_RUN_CONTAINER_TESTS") == "true"
    }
}

tasks.register<Test>("migrationIntegrationTest") {
    group = "verification"
    description = "Runs self-provisioning PostgreSQL 16 Flyway ownership-transfer and replay-store checks."
    dependsOn(tasks.named("testClasses"))
    testClassesDirs = sourceSets["test"].output.classesDirs
    classpath = sourceSets["test"].runtimeClasspath
    include("com/vibehr/migration/**")
    // V4/V5 replay-store capacity is part of the current Flyway install, not the V1 baseline manifest.
    include("com/vibehr/platform/security/BffAssertionReplayStorePostgreSqlIntegrationTest.class")
    shouldRunAfter(tasks.named("test"))
    useJUnitPlatform {
        includeTags("integration")
    }
}

tasks.register<JavaExec>("captureFlywaySchemaManifest") {
    group = "verification"
    description = "Captures a canonical PostgreSQL catalog manifest after V1 has been applied."
    classpath = sourceSets["main"].runtimeClasspath
    mainClass.set("com.vibehr.migration.SchemaManifestTool")
    doFirst {
        val required = listOf("jdbcUrl", "username", "password", "v1Sha256", "output")
        val missing = required.filter { !project.hasProperty(it) }
        check(missing.isEmpty()) { "Missing Gradle properties: ${missing.joinToString(", ")}" }
        args(
            project.property("jdbcUrl").toString(),
            project.property("username").toString(),
            project.property("password").toString(),
            project.property("v1Sha256").toString(),
            project.property("output").toString(),
        )
    }
}

tasks.named<BootJar>("bootJar") {
    layered {
        enabled.set(true)
    }
}
