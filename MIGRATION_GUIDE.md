# MongoDB to PostgreSQL Migration Guide

This guide covers the complete migration of the CMS application from MongoDB to PostgreSQL.

## Overview

The migration involves:
- Converting Prisma schema from MongoDB to PostgreSQL
- Updating Docker configuration
- Migrating existing data
- Generating PostgreSQL migrations

## Prerequisites

1. **PostgreSQL 16** installed locally or running in Docker
2. **Node.js** >= 18.x
3. **npm** >= 9.x
4. Existing MongoDB database (if migrating data)

## Migration Steps

### Step 1: Update Dependencies

```bash
cd backend
npm install
```

This will install the new dependencies including:
- `mongodb` driver for the migration script
- Updated Prisma client for PostgreSQL

### Step 2: Configure Environment

Update your `.env` file with PostgreSQL connection:

```env
# PostgreSQL Connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cms_db?schema=public
```

### Step 3: Start PostgreSQL (Docker)

```bash
docker-compose up -d postgres
```

Wait for PostgreSQL to be healthy:
```bash
docker-compose logs -f postgres
```

### Step 4: Generate Prisma Client

```bash
npm run prisma:generate
```

### Step 5: Create Database Schema

```bash
npm run prisma:migrate
```

This will:
- Create a new migration based on the updated schema
- Apply the migration to PostgreSQL
- Create all tables with proper indexes

### Step 6: Migrate Data (If Existing MongoDB Data)

If you have existing data in MongoDB that needs to be migrated:

```bash
# Set MongoDB connection URL
export MONGODB_URL="mongodb://admin:password@localhost:27017/cms_db?authSource=admin"

# Run migration script
npm run db:migrate-to-postgres
```

The migration script will:
- Connect to MongoDB
- Read all collections
- Convert ObjectIds to UUIDs
- Maintain referential integrity
- Insert data into PostgreSQL

### Step 7: Seed Fresh Data (Optional)

For a fresh installation without migrating existing data:

```bash
npm run seed
```

## Docker Configuration

The updated `docker-compose.yml` includes:

### PostgreSQL 16 Service

```yaml
postgres:
  image: postgres:16-alpine
  container_name: cms-postgres
  ports:
    - "5432:5432"
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres123
    POSTGRES_DB: cms_db
```

### Performance Optimizations

PostgreSQL is configured with:
- `shared_buffers=512MB`
- `effective_cache_size=1536MB`
- `maintenance_work_mem=128MB`
- `max_connections=200`
- WAL optimizations for better write performance

## Schema Changes

### Primary Keys

- **MongoDB**: `@id @default(auto()) @map("_id") @db.ObjectId`
- **PostgreSQL**: `@id @default(uuid())`

### Foreign Keys

- **MongoDB**: `String @db.ObjectId`
- **PostgreSQL**: `String` (UUID)

### Arrays

PostgreSQL natively supports arrays, so `String[]` fields work directly.

### Full-Text Search

PostgreSQL full-text search is enabled via:
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch"]
}
```

## Verification

After migration, verify the data:

```bash
# Connect to PostgreSQL
docker exec -it cms-postgres psql -U postgres -d cms_db

# Check table counts
SELECT tablename,
       (xpath('/row/cnt/text()',
              query_to_xml('SELECT count(*) as cnt FROM ' || tablename,
                          false, false, '')))[1]::text::int as row_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

## Rollback (If Needed)

To rollback to MongoDB:

1. Restore original `.env` with MongoDB connection
2. Restore original `docker-compose.yml`
3. Restore original `schema.prisma`
4. Run `npx prisma generate`

## Troubleshooting

### Connection Refused

Ensure PostgreSQL is running:
```bash
docker-compose ps
```

### Migration Fails

Check PostgreSQL logs:
```bash
docker-compose logs postgres
```

### Prisma Generate Errors

Clear Prisma cache and regenerate:
```bash
rm -rf node_modules/.prisma
npm run prisma:generate
```

## Performance Comparison

| Feature | MongoDB | PostgreSQL |
|---------|---------|------------|
| ACID Compliance | Partial | Full |
| Transactions | Limited | Full |
| Joins | Via aggregation | Native |
| Full-Text Search | Built-in | Extension |
| JSON Support | Native | JSONB |
| Array Support | Native | Native |

## Next Steps

1. Update any MongoDB-specific queries in the application
2. Test all CRUD operations
3. Run the full test suite
4. Monitor query performance
5. Configure PostgreSQL backups

## Support

For issues with the migration, check:
- Prisma documentation: https://www.prisma.io/docs
- PostgreSQL documentation: https://www.postgresql.org/docs/16/
