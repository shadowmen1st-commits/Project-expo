FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev


FROM node:22-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

# Create upload folders and give permission
RUN mkdir -p /app/uploads/dispute_evidence \
    /app/uploads/documents \
    /app/uploads/profiles \
    && chown -R app:app /app/uploads

USER app

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
CMD wget -qO- http://127.0.0.1:5001/health || exit 1

CMD ["node", "src/index.js"]