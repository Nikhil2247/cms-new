# CMS Backend Installation Guide

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 6+
- Git

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure:

**Required**:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Strong secret for JWT tokens (min 32 chars)
- `JWT_REFRESH_SECRET` - Strong secret for refresh tokens
- `REDIS_HOST` - Redis server host
- `REDIS_PORT` - Redis server port

**Optional** (for full functionality):
- `CLOUDINARY_*` - File upload service
- `SMTP_*` - Email notifications
- `FIREBASE_*` - Push notifications

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed database (optional)
npm run seed
```

### 4. Start Development Server

```bash
npm run start:dev
```

Server will start on `http://localhost:5000`

API Documentation: `http://localhost:5000/api/docs`

## Production Deployment

### 1. Build Application

```bash
npm run build
```

### 2. Set Environment

```bash
export NODE_ENV=production
```

### 3. Start Production Server

```bash
npm run start:prod
```

## Docker Deployment

```bash
# Build image
docker build -t cms-backend .

# Run container
docker run -p 5000:5000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your-secret" \
  -e REDIS_HOST="redis" \
  cms-backend
```

## Security Checklist

Before deploying to production:

- [ ] Change all default secrets in `.env`
- [ ] Configure `ALLOWED_ORIGINS` for CORS
- [ ] Set up HTTPS/SSL
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Configure Redis for production
- [ ] Set up error tracking (Sentry)
- [ ] Review rate limiting settings
- [ ] Enable monitoring and health checks
- [ ] Configure log aggregation

See [SECURITY.md](./SECURITY.md) for detailed security configuration.

## Verification

Test your deployment:

```bash
# Health check
curl http://localhost:5000/health

# API docs (development only)
curl http://localhost:5000/api/docs
```

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
npx prisma db pull
```

### Redis Connection Issues

```bash
# Test Redis connection
redis-cli -h localhost -p 6379 ping
```

### Port Already in Use

Change port in `.env`:
```env
PORT=5001
```

### Dependencies Issues

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Development Commands

```bash
# Start development server with watch mode
npm run start:dev

# Run linter
npm run lint

# Format code
npm run format

# Run tests
npm run test

# Run tests with coverage
npm run test:cov

# Generate Prisma client after schema changes
npx prisma generate

# Create new migration
npx prisma migrate dev --name your_migration_name

# Reset database (WARNING: deletes all data)
npm run db:reset
```

## Project Structure

```
src/
├── api/              # API route modules (role-based)
├── core/             # Core functionality
│   ├── common/       # Guards, filters, interceptors, pipes
│   ├── database/     # Database configuration
│   └── auth/         # Authentication
├── domain/           # Business logic modules
├── infrastructure/   # External services (mail, storage, etc.)
├── bulk/             # Bulk operations
├── app.module.ts     # Root module
└── main.ts           # Application entry point
```

## Support

For issues or questions:
- Create an issue on GitHub
- Email: support@yourdomain.com

## License

UNLICENSED - Private project
