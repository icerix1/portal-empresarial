FROM rust:1.92-bookworm AS build
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libgcc-s1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/target/release/portal-backend /app/portal-backend
ENV PORT=8080
EXPOSE 8080
CMD ["/app/portal-backend"]
