# Root-level Dockerfile for Render (which points at the repo root).
# It builds the backend directly from backend/ using the release binary.
FROM rust:1.98-slim-bookworm AS builder
WORKDIR /src
COPY backend/Cargo.toml backend/Cargo.lock* ./
COPY backend/src ./src
RUN cargo build --release --locked

FROM debian:bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -r flowdesk && useradd -r -g flowdesk flowdesk

WORKDIR /app
COPY --from=builder /src/target/release/flowdesk-backend /app/flowdesk-backend

ENV DATA_DIR=/app/.data
RUN mkdir -p "$DATA_DIR" && chown -R flowdesk:flowdesk /app
USER flowdesk

EXPOSE 8080
CMD ["./flowdesk-backend"]