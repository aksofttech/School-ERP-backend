FROM node:18-slim

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Final application uses port 3000 by default (per main.ts)
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:dev"]