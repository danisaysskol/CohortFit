# Next.js frontend (Lab Ledger design system) — production build.
# Routes are pre-compiled at build time, so navigation in the running app is
# instant (the dev server compiled each route on first visit, which was slow).

# --- build stage: compile the app ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
# NEXT_PUBLIC_* is inlined at build time. The browser (on the host) reaches the
# backend via the host-mapped port, so this must be the host URL.
ENV NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runtime stage: run the standalone server ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Standalone output bundles only what the server needs.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
