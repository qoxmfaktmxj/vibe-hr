ARG BACKEND_IMAGE=vibehr-backend-rust:local
FROM ${BACKEND_IMAGE} AS backend
FROM redgate/flyway:12.4.0
COPY --from=backend /usr/local/bin/vibehr-backend /usr/local/bin/vibehr-backend
COPY backend-spring/src/main/resources/db/migration/ /legacy/migration/
COPY backend-spring/src/main/resources/db/reconciliation/pre-adoption-production-drift-20260803.sql /legacy/reconcile.sql
USER 10001:10001
WORKDIR /tmp
ENTRYPOINT ["/usr/local/bin/vibehr-backend"]
