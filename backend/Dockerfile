# syntax=docker/dockerfile:1

###############################################################################
# Builder: compile the release binary
###############################################################################
FROM rust:1.98-slim-bookworm AS builder
WORKDIR /app

# Cache dependencies first (independent of source).
COPY Cargo.toml Cargo.lock* ./
RUN mkdir -p src && echo "fn main() {}" > src/main.rs && \
    cargo build --release || true && \
    rm -rf src

# Build the real binary.
COPY src ./src
RUN cargo build --release --locked

###############################################################################
# Runner: minimal runtime
###############################################################################
FROM debian:bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -r flowdesk && useradd -r -g flowdesk flowdesk

WORKDIR /app
COPY --from=builder /app/target/release/flowdesk-backend /app/flowdesk-backend

# Uploads/docs path (overridable via RENDER_DISK_MOUNT_PATH or DATA_DIR).
ENV DATA_DIR=/app/.data
RUN mkdir -p "$DATA_DIR" && chown -R flowdesk:flowdesk /app
USER flowdesk

# Render injects $PORT; config.rs binds 0.0.0.0:<PORT> by default.
EXPOSE 8080
CMD ["./flowdesk-backend"]