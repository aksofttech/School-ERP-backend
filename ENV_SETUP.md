# Environment Setup

## Database Configuration

Create a `.env` file in the `backend` directory with the following content:

```env
# Database Configuration
DATABASE_URL="postgresql://postgres:5899@localhost:5437/edu_erp?schema=public"
DB_HOST=localhost
DB_PORT=5437
DB_USERNAME=postgres
DB_PASSWORD=5899
DB_NAME=edu_erp

# Application Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_REFRESH_EXPIRES_IN=7d
SALT_ROUNDS=10

# Redis Configuration (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TTL=3600

# AWS Configuration (Optional)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=
```

## Setup Steps

1. **Create the `.env` file** in the `backend` directory with the content above.

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Generate Prisma Client:**
   ```bash
   npm run prisma:generate
   ```

4. **Run database migrations** (after creating your Prisma schema):
   ```bash
   npm run prisma:migrate
   ```

5. **Start the development server:**
   ```bash
   npm run start:dev
   ```

## Database Connection Details

- **Host:** localhost
- **Port:** 5437
- **Database:** edu_erp
- **Username:** postgres
- **Password:** 5899

**Note:** If your PostgreSQL username is different from `postgres`, update the `DATABASE_URL` and `DB_USERNAME` in the `.env` file accordingly.

