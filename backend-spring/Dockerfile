FROM eclipse-temurin:21-jdk-jammy AS builder
WORKDIR /workspace

COPY gradlew .
COPY gradle gradle
COPY build.gradle.kts settings.gradle.kts ./
RUN chmod +x gradlew
RUN ./gradlew --no-daemon --console=plain dependencies > /dev/null

COPY src src
RUN ./gradlew --no-daemon --console=plain bootJar
RUN java -Djarmode=tools -jar build/libs/*.jar extract --layers --destination extracted
RUN mv extracted/application/*.jar extracted/application/application.jar

FROM eclipse-temurin:21-jre-jammy
WORKDIR /application
RUN apt-get update \
    && apt-get install --no-install-recommends -y curl fontconfig fonts-nanum \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 spring \
    && useradd --system --uid 10001 --gid spring --home-dir /application --shell /usr/sbin/nologin spring

COPY --from=builder --chown=spring:spring /workspace/extracted/dependencies/ ./
COPY --from=builder --chown=spring:spring /workspace/extracted/snapshot-dependencies/ ./
COPY --from=builder --chown=spring:spring /workspace/extracted/application/ ./

USER spring
EXPOSE 8080
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=10 CMD curl --fail --silent --show-error http://localhost:8080/actuator/health/readiness || exit 1
ENTRYPOINT ["java", "-cp", "application.jar:lib/*", "com.vibehr.VibeHrApplication"]
