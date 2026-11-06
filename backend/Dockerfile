# syntax=docker/dockerfile:1

# Build stage: Eclipse Temurin 17 JDK via the official Maven image.
# The Maven wrapper is tracked without the executable bit, so the image's Maven
# installation is used instead of relying on `./mvnw` being executable.
FROM maven:3.9.9-eclipse-temurin-17 AS build

WORKDIR /build

# Dependency layer: only re-resolves when the POM changes.
COPY pom.xml ./
RUN mvn -B -q dependency:go-offline

COPY src ./src

# Tests require a PostgreSQL instance and are executed separately (CI / local).
# -Dmaven.test.skip=true both skips and avoids compiling tests, so the image
# build never tries to reach localhost PostgreSQL.
RUN mvn -B -Dmaven.test.skip=true package \
    && cp target/shareloop-backend-*.jar /build/app.jar

# Runtime stage: Eclipse Temurin 17 JRE, non-root.
FROM eclipse-temurin:17-jre

RUN groupadd --gid 10001 shareloop \
    && useradd --uid 10001 --gid shareloop --no-create-home --shell /usr/sbin/nologin shareloop

WORKDIR /app

COPY --from=build /build/app.jar /app/app.jar
RUN chown -R shareloop:shareloop /app

USER 10001:10001

# Render injects PORT; application.yml reads it (server.port=${PORT:8080}).
EXPOSE 8080

# Configurable JVM memory. 75% of the container limit leaves headroom for
# metaspace, code cache, threads and direct buffers.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError"

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
