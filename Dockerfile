FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache ca-certificates

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --production

FROM base AS build
COPY . .
RUN npm ci && npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh
HEALTHCHECK --interval=30s --timeout=3s CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
