# --- Base builder image ---
FROM node:18-alpine AS builder

# Fix Next.js required dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the code
COPY . .

# Build Next.js
RUN npm run build



# --- Production Runner ---
FROM node:18-alpine AS runner

WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built files
COPY --from=builder /app ./

# Expose Next.js port
EXPOSE 3000

CMD ["npm", "start"]
