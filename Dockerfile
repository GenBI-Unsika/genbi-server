FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache netcat-openbsd

# Install dependencies (workspaces + Prisma)
COPY package.json package-lock.json ./
COPY packages ./packages
COPY prisma ./prisma
RUN npm ci

# Copy runtime source
COPY src ./src
COPY scripts ./scripts
COPY vitest.config.js ./vitest.config.js
COPY nodemon.json ./nodemon.json
COPY .env.example ./.env.example

# Ensure upload folder exists (volume will mount here)
RUN mkdir -p /app/temp-uploads

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3500

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npm", "start"]
