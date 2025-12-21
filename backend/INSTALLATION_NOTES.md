# Installation Notes for Report Builder & LRU Cache Systems

## Required Package Installation

To use the newly implemented LRU Cache System and Report Builder System, you need to install the following package:

```bash
npm install lru-cache
```

Or with yarn:

```bash
yarn add lru-cache
```

## Additional Type Definitions (Optional)

For better TypeScript support, you may also want to install:

```bash
npm install --save-dev @types/lru-cache
```

## Verification

After installation, run the following to verify all dependencies are installed:

```bash
npm install
```

## Environment Variables

Make sure your `.env` file has the following Redis configuration:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_if_any
```

## Running the Application

After installing dependencies, you can start the application:

```bash
npm run start:dev
```

## Testing the Report Builder API

### 1. Get Available Reports
```
GET /api/shared/reports/catalog
Authorization: Bearer <token>
```

### 2. Get Report Configuration
```
GET /api/shared/reports/config/:type
Authorization: Bearer <token>
```

### 3. Generate Report
```
POST /api/shared/reports/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "student-progress",
  "format": "excel",
  "filters": {
    "academicYear": "2024-2025",
    "semester": 1
  }
}
```

### 4. Check Report Status
```
GET /api/shared/reports/:id
Authorization: Bearer <token>
```

### 5. Download Report
```
GET /api/shared/reports/:id/download
Authorization: Bearer <token>
```

### 6. Get Report History
```
GET /api/shared/reports?page=1&limit=10
Authorization: Bearer <token>
```

## Files Created

Total files created: **17**

### Cache System (6 files):
- `src/core/cache/lru-cache.service.ts` (NEW)
- `src/core/cache/cache.interceptor.ts` (NEW)
- `src/core/cache/cache.decorator.ts` (UPDATED)
- `src/core/cache/cache.module.ts` (UPDATED)
- `src/core/database/prisma-cache.service.ts` (NEW)
- `src/core/database/prisma.module.ts` (UPDATED)

### Report Builder System (11 files):
- `src/domain/report/builder/interfaces/report.interface.ts`
- `src/domain/report/builder/dto/generate-report.dto.ts`
- `src/domain/report/builder/dto/report-history.dto.ts`
- `src/domain/report/builder/export/excel.service.ts`
- `src/domain/report/builder/export/pdf.service.ts`
- `src/domain/report/builder/export/csv.service.ts`
- `src/domain/report/builder/report-generator.service.ts`
- `src/domain/report/builder/report-builder.service.ts`
- `src/domain/report/builder/report.processor.ts`
- `src/domain/report/builder/report-builder.controller.ts`
- `src/domain/report/builder/report-builder.module.ts`

## Database Schema Requirements

Make sure your Prisma schema has the following models (or similar):

```prisma
model Report {
  id           String   @id @default(cuid())
  userId       String
  type         String
  filters      Json?
  format       String
  status       String   @default("pending")
  downloadUrl  String?
  errorMessage String?
  createdAt    DateTime @default(now())
  completedAt  DateTime?

  user User @relation(fields: [userId], references: [id])
}
```

If the Report model doesn't exist, you'll need to add it to your schema and run migrations:

```bash
npx prisma migrate dev --name add_report_model
```

## Integration with Main App Module

The Report Builder Module should be imported in your main app.module.ts:

```typescript
import { ReportBuilderModule } from './domain/report/builder/report-builder.module';

@Module({
  imports: [
    // ... other modules
    ReportBuilderModule,
  ],
})
export class AppModule {}
```
