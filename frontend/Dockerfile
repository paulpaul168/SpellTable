FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build the application (environment variables will be embedded at build time)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

FROM node:18-alpine AS production

WORKDIR /app

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Install ws package for WebSocket support
RUN npm install ws

COPY --from=build /app/package*.json ./
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server.js ./server.js

# Change ownership to the nextjs user
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

# Use custom server instead of npm start
CMD ["node", "server.js"] 