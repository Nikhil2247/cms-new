# Monthly Cycle Refactoring Plan

## Current State Analysis

### Existing Schema Fields (InternshipApplication)

| Field | Type | Purpose |
|-------|------|---------|
| `startDate` | DateTime? | Internship start date |
| `endDate` | DateTime? | Internship end date |
| `joiningDate` | DateTime? | When student actually joined |
| `completionDate` | DateTime? | When internship was completed |
| `reportsGenerated` | Boolean | Flag if DRAFT reports were generated |
| `totalExpectedReports` | Int? | Stored expected reports count |
| `totalExpectedVisits` | Int? | Stored expected visits count |

### Current Problems

1. **Pre-creating DRAFT reports** - Unnecessary placeholder records (student.service.ts:1931)
2. **Pre-creating SCHEDULED visits** - Unnecessary placeholder records (faculty-visit.service.ts:514)
3. **No Auto-Recalculation** - Changing dates doesn't trigger recalculation
4. **Complex Sync Logic** - Need to manage placeholder records lifecycle

---

## Proposed Solution: Simple Count-Based Approach

### Key Principle
**Don't create placeholder records. Just store expected counts and compare against actual submissions.**

### Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                 INTERNSHIP CREATE/UPDATE                        │
├────────────────────────────────────────────────────────────────┤
│  1. Student submits self-identified internship with dates      │
│  2. OR Principal/Faculty updates dates                         │
│                        ↓                                        │
│  calculateExpectedMonths(startDate, endDate)                   │
│                        ↓                                        │
│  Store on InternshipApplication:                               │
│    - totalExpectedReports = months.length                      │
│    - totalExpectedVisits = months.length                       │
│    - expectedCountsLastCalculated = now()                      │
│                                                                 │
│  NO DRAFT/SCHEDULED RECORDS CREATED                            │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                 STUDENT SUBMITS REPORT                          │
├────────────────────────────────────────────────────────────────┤
│  1. Student uploads report for month/year                      │
│  2. Create MonthlyReport with status=APPROVED (auto-approve)   │
│  3. No placeholder existed - direct creation                   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                 FACULTY LOGS VISIT                              │
├────────────────────────────────────────────────────────────────┤
│  1. Faculty logs visit for student                             │
│  2. Create FacultyVisitLog with status=COMPLETED               │
│  3. No placeholder existed - direct creation                   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                 DISPLAY PROGRESS                                │
├────────────────────────────────────────────────────────────────┤
│  Expected Reports:  InternshipApplication.totalExpectedReports │
│  Submitted Reports: COUNT(MonthlyReport WHERE status=APPROVED) │
│  Completion Rate:   submitted / expected * 100                 │
│                                                                 │
│  Expected Visits:   InternshipApplication.totalExpectedVisits  │
│  Completed Visits:  COUNT(FacultyVisitLog WHERE status=COMPLETED)│
│  Completion Rate:   completed / expected * 100                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Create Recalculation Service

**File:** `backend/src/domain/internship/expected-cycle/expected-cycle.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { calculateExpectedMonths, getTotalExpectedCount } from '../../../common/utils/monthly-cycle.util';

@Injectable()
export class ExpectedCycleService {
  constructor(private prisma: PrismaService) {}

  /**
   * Recalculates expected counts when internship dates change.
   * Does NOT create any placeholder records.
   */
  async recalculateExpectedCounts(applicationId: string): Promise<{
    success: boolean;
    totalExpectedReports: number;
    totalExpectedVisits: number;
    months: number;
  }> {
    const application = await this.prisma.internshipApplication.findUnique({
      where: { id: applicationId },
      select: { startDate: true, endDate: true, joiningDate: true, completionDate: true },
    });

    if (!application) {
      return { success: false, totalExpectedReports: 0, totalExpectedVisits: 0, months: 0 };
    }

    const startDate = application.startDate || application.joiningDate;
    const endDate = application.endDate || application.completionDate;

    if (!startDate || !endDate) {
      return { success: false, totalExpectedReports: 0, totalExpectedVisits: 0, months: 0 };
    }

    // Calculate expected count using monthly cycle utility
    const totalExpected = getTotalExpectedCount(startDate, endDate);

    // Update stored counts (both reports and visits use same month count)
    await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: {
        totalExpectedReports: totalExpected,
        totalExpectedVisits: totalExpected,
        expectedCountsLastCalculated: new Date(), // New field
      },
    });

    return {
      success: true,
      totalExpectedReports: totalExpected,
      totalExpectedVisits: totalExpected,
      months: totalExpected,
    };
  }

  /**
   * Get current submission/completion status for an internship
   */
  async getProgressStatus(applicationId: string): Promise<{
    expectedReports: number;
    submittedReports: number;
    reportCompletionRate: number;
    expectedVisits: number;
    completedVisits: number;
    visitCompletionRate: number;
  }> {
    const [application, submittedReports, completedVisits] = await Promise.all([
      this.prisma.internshipApplication.findUnique({
        where: { id: applicationId },
        select: { totalExpectedReports: true, totalExpectedVisits: true },
      }),
      this.prisma.monthlyReport.count({
        where: {
          applicationId,
          status: { in: ['SUBMITTED', 'APPROVED'] },
          isDeleted: false,
        },
      }),
      this.prisma.facultyVisitLog.count({
        where: {
          applicationId,
          status: 'COMPLETED',
        },
      }),
    ]);

    const expectedReports = application?.totalExpectedReports || 0;
    const expectedVisits = application?.totalExpectedVisits || 0;

    return {
      expectedReports,
      submittedReports,
      reportCompletionRate: expectedReports > 0 ? (submittedReports / expectedReports) * 100 : 0,
      expectedVisits,
      completedVisits,
      visitCompletionRate: expectedVisits > 0 ? (completedVisits / expectedVisits) * 100 : 0,
    };
  }
}
```

---

### Phase 2: Add Schema Field

**File:** `backend/prisma/schema.prisma`

Add one new field to track when counts were last calculated:

```prisma
model InternshipApplication {
  // Existing fields...

  reportsGenerated              Boolean   @default(false)  // Can be deprecated
  totalExpectedReports          Int?
  totalExpectedVisits           Int?
  expectedCountsLastCalculated  DateTime? // NEW: Track when calculation ran
}
```

---

### Phase 3: Hook into Date Operations

#### A. Self-Identified Submission

**File:** `backend/src/api/student-portal/student.service.ts`

```typescript
async submitSelfIdentified(studentId: string, dto: SelfIdentifiedDto) {
  const application = await this.prisma.internshipApplication.create({
    data: {
      studentId,
      isSelfIdentified: true,
      isActive: true,
      status: ApplicationStatus.APPROVED,
      startDate: dto.startDate,
      endDate: dto.endDate,
      // ... other fields
    },
  });

  // Calculate expected counts immediately (no DRAFT records)
  if (dto.startDate && dto.endDate) {
    await this.expectedCycleService.recalculateExpectedCounts(application.id);
  }

  return application;
}
```

#### B. Date Update Endpoint (New)

**File:** `backend/src/api/principal/principal.controller.ts`

```typescript
@Patch('internship/:applicationId/dates')
@ApiOperation({ summary: 'Update internship dates and recalculate expected counts' })
async updateInternshipDates(
  @Param('applicationId') applicationId: string,
  @Body() dto: UpdateInternshipDatesDto,
  @Request() req,
) {
  return this.principalService.updateInternshipDates(req.user.userId, applicationId, dto);
}
```

**DTO:**
```typescript
export class UpdateInternshipDatesDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
```

**Service:**
```typescript
async updateInternshipDates(
  principalId: string,
  applicationId: string,
  dto: UpdateInternshipDatesDto
) {
  // Verify access
  await this.verifyPrincipalAccessToApplication(principalId, applicationId);

  // Update dates
  const updated = await this.prisma.internshipApplication.update({
    where: { id: applicationId },
    data: {
      ...(dto.startDate && { startDate: new Date(dto.startDate) }),
      ...(dto.endDate && { endDate: new Date(dto.endDate) }),
    },
  });

  // Recalculate expected counts
  const counts = await this.expectedCycleService.recalculateExpectedCounts(applicationId);

  return {
    ...updated,
    expectedCounts: counts,
  };
}
```

---

### Phase 4: Remove Placeholder Record Generation

#### A. Remove from Student Service

**File:** `backend/src/api/student-portal/student.service.ts`

**Delete or deprecate:** `generateExpectedReports()` method (lines 1891-1969)

This method currently creates DRAFT MonthlyReport records. We no longer need it.

#### B. Remove from Faculty Visit Service

**File:** `backend/src/domain/report/faculty-visit/faculty-visit.service.ts`

**Delete or deprecate:** `generateExpectedVisits()` method (lines 462-556)

This method currently creates SCHEDULED FacultyVisitLog records. We no longer need it.

---

### Phase 5: Update Progress Queries

All places that display progress should use this pattern:

```typescript
// Get expected from stored count
const expected = application.totalExpectedReports || 0;

// Get actual from real records (not DRAFT placeholders)
const submitted = await prisma.monthlyReport.count({
  where: {
    applicationId,
    status: { in: ['SUBMITTED', 'APPROVED'] },
    isDeleted: false,
  },
});

// Calculate rate
const completionRate = expected > 0 ? (submitted / expected) * 100 : 0;
```

---

## Summary: Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| **Report Creation** | Create DRAFT placeholders, then update when submitted | Create directly when student submits |
| **Visit Creation** | Create SCHEDULED placeholders, then update when logged | Create directly when faculty logs |
| **Expected Count** | Count placeholder records OR stored field | Use stored `totalExpectedReports/Visits` field |
| **Date Change** | Manual recalculation, orphaned records | Auto-recalculate stored counts only |
| **Data Integrity** | Complex (must sync placeholders) | Simple (just numbers) |
| **Storage** | Many unused DRAFT/SCHEDULED records | Only actual submissions |

---

## Migration Steps

### 1. Add Schema Field
```bash
npx prisma migrate dev --name add_expected_counts_timestamp
```

### 2. Create Service
Create `ExpectedCycleService` and wire into module.

### 3. Hook Service Calls
Add recalculation calls to all date-modifying operations.

### 4. Run Backfill Migration
```typescript
async function backfillExpectedCounts() {
  const internships = await prisma.internshipApplication.findMany({
    where: { isActive: true, startDate: { not: null }, endDate: { not: null } },
  });

  for (const app of internships) {
    await expectedCycleService.recalculateExpectedCounts(app.id);
  }

  console.log(`Backfilled ${internships.length} internships`);
}
```

### 5. Deprecate Old Functions
Mark `generateExpectedReports()` and `generateExpectedVisits()` as deprecated.

### 6. Clean Up Old DRAFT/SCHEDULED Records (Optional)
```sql
-- Remove orphaned DRAFT reports (never submitted)
DELETE FROM "MonthlyReport" WHERE status = 'DRAFT' AND "submittedAt" IS NULL;

-- Remove orphaned SCHEDULED visits (never completed)
DELETE FROM "FacultyVisitLog" WHERE status = 'SCHEDULED' AND "visitDate" IS NULL;
```

---

## Benefits

1. **Simpler Data Model** - No placeholder records to manage
2. **Automatic Recalculation** - Dates change → counts update automatically
3. **Less Storage** - Only actual submissions stored
4. **Cleaner Queries** - Count real records, not placeholders
5. **No Orphaned Records** - No cleanup needed when dates change
