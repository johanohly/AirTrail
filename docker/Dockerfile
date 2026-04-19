FROM johly/airtrail-airport-overlay:2026.4.18@sha256:3c2395defd27d9f45a92e0da1ab5f453c382a23d6c676ca4e7e490aa647d75e5 AS airport_overlay

FROM oven/bun:debian AS base
WORKDIR /app

FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS build
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

ENV NODE_ENV=production
RUN bun run build

FROM node:22-slim AS release
WORKDIR /app
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=build /app/build build
COPY --from=airport_overlay /airport-overlay.pmtiles /app/build/client/airport-overlay.pmtiles
COPY --from=build /app/package.json .
COPY --from=build /app/prisma/migrations ./prisma/migrations

COPY ./docker/migrate.js /app/docker/
COPY ./docker/admin.js /app/docker/
COPY ./docker/healthcheck.js /app/docker/
COPY ./docker/entrypoint.sh /app/bin/
COPY ./docker/airtrail-admin /app/bin/
COPY ./docker/airtrail-healthcheck /app/bin/
RUN chmod +x /app/bin/entrypoint.sh /app/bin/airtrail-admin /app/bin/airtrail-healthcheck

ENV PATH="${PATH}:/app/bin"

USER node
EXPOSE 3000/tcp
HEALTHCHECK --interval=5m --start-period=30s --start-interval=10s --retries=3 CMD ["airtrail-healthcheck"]
ENTRYPOINT [ "/app/bin/entrypoint.sh" ]
