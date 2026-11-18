FROM rust:1.100-bookworm AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src src
COPY resources resources
RUN cargo build --release --locked

FROM debian:bookworm-slim
WORKDIR /application
RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates curl fontconfig fonts-nanum \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 vibehr \
    && useradd --system --uid 10001 --gid vibehr --home-dir /application vibehr
COPY --from=builder /app/target/release/vibehr-backend /usr/local/bin/vibehr-backend
COPY resources/swagger-ui/LICENSE resources/swagger-ui/NOTICE resources/swagger-ui/swagger-ui-bundle.js.LICENSE.txt /usr/share/doc/vibehr/swagger-ui/
COPY resources/redoc/LICENSE resources/redoc/*.LICENSE.txt /usr/share/doc/vibehr/redoc/
COPY src/validation/SOURCE.txt src/validation/hibernate-validator-license.txt /usr/share/doc/vibehr/validation/
USER vibehr
ENV BIND_ADDRESS=0.0.0.0:8080
EXPOSE 8080
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=10 CMD curl --fail --silent --show-error http://localhost:8080/actuator/health/readiness || exit 1
ENTRYPOINT ["vibehr-backend"]
