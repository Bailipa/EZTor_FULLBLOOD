FROM node:22-alpine AS base
WORKDIR /app

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
COPY prisma ./prisma
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh && npm install -g prisma@5
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
