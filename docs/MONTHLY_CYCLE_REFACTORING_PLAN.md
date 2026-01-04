# Monthly Cycle Refactoring Plan

## Proposed Solution: Counter-Based Approach

### Key Principle
**Store counters on InternshipApplication and increment on submission - no COUNT queries needed.**

---

## Schema Changes

### Fields to ADD
```prisma
submittedReportsCount         Int       @default(0)  // Increment when report submitted
completedVisitsCount          Int       @default(0)  // Increment when visit completed
expectedCountsLastCalculated  DateTime?              // Track when calculation ran
```

### Fields to KEEP
```prisma
totalExpectedReports  Int @default(0)  // Calculated from dates
totalExpectedVisits   Int @default(0)  // Calculated from dates
```

### Fields to REMOVE
```prisma
reportsGenerated  Boolean @default(false)  // No longer needed - REMOVE
```

---

## Edge Cases & Business Rules

### CRITICAL: Date Changes After Submissions

| Scenario | Expected Count | Submitted Count | Action |
|----------|---------------|-----------------|--------|
| Student changes startDate earlier | Recalculate (may increase) | **NO CHANGE** | Only update expected |
| Student changes endDate later | Recalculate (may increase) | **NO CHANGE** | Only update expected |
| Student changes startDate later | Recalculate (may decrease) | **NO CHANGE** | Only update expected |
| Student changes endDate earlier | Recalculate (may decrease) | **NO CHANGE** | Only update expected |

**Rule: Submitted/Completed counts are NEVER affected by date changes. Only expected counts recalculate.**

### Report Submission Edge Cases

| Scenario | Action |
|----------|--------|
| Report submitted successfully | `submittedReportsCount: { increment: 1 }` |
| Report rejected by mentor | **NO CHANGE** (rejection ≠ deletion) |
| Report deleted by student | `submittedReportsCount: { decrement: 1 }` |
| Report soft-deleted (isDeleted=true) | `submittedReportsCount: { decrement: 1 }` |
| Duplicate report for same month | Prevent creation OR still increment (decide) |
| Report submitted for invalid month | Validate against expected months, reject if invalid |

### Visit Logging Edge Cases

| Scenario | Action |
|----------|--------|
| Visit logged as COMPLETED | `completedVisitsCount: { increment: 1 }` |
| Visit status changed to CANCELLED | `completedVisitsCount: { decrement: 1 }` |
| Visit deleted | `completedVisitsCount: { decrement: 1 }` |
| Multiple visits in same month | Allow and increment (faculty can visit multiple times) |
| Visit logged for month outside internship | Validate, allow but don't count toward expected |

### Expected Count Edge Cases

| Scenario | Action |
|----------|--------|
| Internship < 10 days in a month | Month NOT counted in expected |
| Internship exactly 10 days in month | Month NOT counted (rule is >10) |
| Internship 11+ days in month | Month IS counted |
| No startDate or endDate set | expected = 0 |
| endDate before startDate | Validation error, reject |
| Submitted > Expected | Display warning, but allow (overtime work) |

---

## Files to Modify

### BACKEND - Schema

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add 3 new fields, remove `reportsGenerated` |

### BACKEND - New Service

| File | Change |
|------|--------|
| `domain/internship/expected-cycle/expected-cycle.service.ts` | CREATE new service |
| `domain/internship/expected-cycle/expected-cycle.module.ts` | CREATE new module |

### BACKEND - Hook into Operations

| File | Line(s) | Change |
|------|---------|--------|
| `api/student-portal/student.service.ts` | ~1266 | Add `incrementReportCount()` after report creation |
| `api/student-portal/student.service.ts` | ~1005-1017 | Add `recalculateExpectedCounts()` after self-identified submission |
| `api/student-portal/student.service.ts` | Report delete | Add `decrementReportCount()` |
| `api/faculty/faculty.service.ts` | ~791 | Add `incrementVisitCount()` after visit creation |
| `api/faculty/faculty.service.ts` | Visit cancel/delete | Add `decrementVisitCount()` |
| `domain/report/faculty-visit/faculty-visit.service.ts` | ~228 | Add `incrementVisitCount()` after visit creation |
| `api/principal/principal.service.ts` | Date update | Add `recalculateExpectedCounts()` (expected only) |

### BACKEND - Remove DRAFT/SCHEDULED Generation

| File | Line(s) | Change |
|------|---------|--------|
| `api/student-portal/student.service.ts` | 1891-1969 | DELETE `generateExpectedReports()` method |
| `domain/report/faculty-visit/faculty-visit.service.ts` | 462-556 | DELETE `generateExpectedVisits()` method |

### BACKEND - Update Dashboard Queries

| File | Change |
|------|--------|
| `api/principal/principal.service.ts` | Use counter fields instead of COUNT queries |
| `api/faculty/faculty.service.ts` | Use counter fields instead of `calculateExpectedCycles()` |
| `api/state/services/state-institution.service.ts` | Use counter fields instead of COUNT queries |
| `api/state/services/state-dashboard.service.ts` | Use counter fields instead of COUNT queries |

### FRONTEND - Use Counter Fields from API

| File | Line(s) | Change |
|------|---------|--------|
| `features/principal/dashboard/components/DashboardInternshipTable.jsx` | 173-184 | Remove `getTotalExpectedCount()`, use API fields |
| `features/principal/internships/SelfIdentifiedInternships.jsx` | 173-184 | Remove `getTotalExpectedCount()`, use API fields |
| `features/faculty/dashboard/components/AssignedStudentsList.jsx` | 84-105 | Remove local calculation, use API fields |
| `features/faculty/dashboard/components/StudentDetailsModal.jsx` | ~60 | Remove local calculation, use API fields |
| `features/state/dashboard/components/InstituteDetailView.jsx` | 1378, 1398 | Use consistent field names |

### FRONTEND - Cleanup (Optional)

| File | Change |
|------|--------|
| `utils/monthlyCycle.js` | Mark `getTotalExpectedCount`, `getExpectedReportsAsOfToday`, `getExpectedVisitsAsOfToday` as deprecated |

---

## Implementation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              INTERNSHIP CREATE (Self-Identified)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Create InternshipApplication with:                          │
│       - startDate, endDate                                       │
│       - submittedReportsCount = 0                                │
│       - completedVisitsCount = 0                                 │
│                                                                  │
│  2. Call recalculateExpectedCounts(applicationId):               │
│       - totalExpectedReports = getTotalExpectedCount(start, end) │
│       - totalExpectedVisits = getTotalExpectedCount(start, end)  │
│       - expectedCountsLastCalculated = now()                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              DATE UPDATE (By Principal/Student)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Update startDate and/or endDate                              │
│                                                                  │
│  2. Call recalculateExpectedCounts(applicationId):               │
│       - totalExpectedReports = getTotalExpectedCount(start, end) │
│       - totalExpectedVisits = getTotalExpectedCount(start, end)  │
│       - expectedCountsLastCalculated = now()                     │
│                                                                  │
│  ⚠️  DO NOT touch submittedReportsCount or completedVisitsCount  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              STUDENT SUBMITS MONTHLY REPORT                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Create MonthlyReport with status=APPROVED                    │
│                                                                  │
│  2. Increment counter (atomic):                                  │
│     prisma.internshipApplication.update({                        │
│       where: { id: applicationId },                              │
│       data: { submittedReportsCount: { increment: 1 } }          │
│     });                                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              FACULTY LOGS VISIT                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Create FacultyVisitLog with status=COMPLETED                 │
│                                                                  │
│  2. Increment counter (atomic):                                  │
│     prisma.internshipApplication.update({                        │
│       where: { id: applicationId },                              │
│       data: { completedVisitsCount: { increment: 1 } }           │
│     });                                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              DISPLAY PROGRESS (Dashboard)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  // All data already on InternshipApplication - NO QUERIES!     │
│                                                                  │
│  const {                                                         │
│    totalExpectedReports,   // 5                                  │
│    submittedReportsCount,  // 3                                  │
│    totalExpectedVisits,    // 5                                  │
│    completedVisitsCount    // 2                                  │
│  } = application;                                                │
│                                                                  │
│  reportRate = (submittedReportsCount / totalExpectedReports)*100 │
│  visitRate = (completedVisitsCount / totalExpectedVisits) * 100  │
│                                                                  │
│  // Display: "3/5 reports (60%), 2/5 visits (40%)"               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## ExpectedCycleService Implementation

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { getTotalExpectedCount } from '../../../common/utils/monthly-cycle.util';

@Injectable()
export class ExpectedCycleService {
  constructor(private prisma: PrismaService) {}

  /**
   * Recalculate ONLY expected counts when dates change.
   * NEVER modifies submittedReportsCount or completedVisitsCount.
   */
  async recalculateExpectedCounts(applicationId: string) {
    const app = await this.prisma.internshipApplication.findUnique({
      where: { id: applicationId },
      select: { startDate: true, endDate: true, joiningDate: true, completionDate: true },
    });

    if (!app) return { success: false, reason: 'Application not found' };

    const startDate = app.startDate || app.joiningDate;
    const endDate = app.endDate || app.completionDate;

    if (!startDate || !endDate) {
      // Set expected to 0 if no valid dates
      await this.prisma.internshipApplication.update({
        where: { id: applicationId },
        data: {
          totalExpectedReports: 0,
          totalExpectedVisits: 0,
          expectedCountsLastCalculated: new Date(),
        },
      });
      return { success: true, totalExpected: 0 };
    }

    const totalExpected = getTotalExpectedCount(startDate, endDate);

    await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: {
        totalExpectedReports: totalExpected,
        totalExpectedVisits: totalExpected,
        expectedCountsLastCalculated: new Date(),
      },
    });

    return { success: true, totalExpected };
  }

  /**
   * Increment report counter when student submits a report.
   */
  async incrementReportCount(applicationId: string) {
    return this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: { submittedReportsCount: { increment: 1 } },
    });
  }

  /**
   * Decrement report counter when report is deleted.
   * Ensures count doesn't go below 0.
   */
  async decrementReportCount(applicationId: string) {
    const app = await this.prisma.internshipApplication.findUnique({
      where: { id: applicationId },
      select: { submittedReportsCount: true },
    });

    if (app && app.submittedReportsCount > 0) {
      return this.prisma.internshipApplication.update({
        where: { id: applicationId },
        data: { submittedReportsCount: { decrement: 1 } },
      });
    }
    return app;
  }

  /**
   * Increment visit counter when faculty logs a completed visit.
   */
  async incrementVisitCount(applicationId: string) {
    return this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: { completedVisitsCount: { increment: 1 } },
    });
  }

  /**
   * Decrement visit counter when visit is cancelled/deleted.
   * Ensures count doesn't go below 0.
   */
  async decrementVisitCount(applicationId: string) {
    const app = await this.prisma.internshipApplication.findUnique({
      where: { id: applicationId },
      select: { completedVisitsCount: true },
    });

    if (app && app.completedVisitsCount > 0) {
      return this.prisma.internshipApplication.update({
        where: { id: applicationId },
        data: { completedVisitsCount: { decrement: 1 } },
      });
    }
    return app;
  }
}
```

---

## Backfill Migration Script

```typescript
// backend/prisma/backfill-counters.ts

import { PrismaClient } from '@prisma/client';
import { getTotalExpectedCount } from '../src/common/utils/monthly-cycle.util';

const prisma = new PrismaClient();

async function backfillCounters() {
  console.log('Starting backfill of counter fields...');

  const applications = await prisma.internshipApplication.findMany({
    where: { isActive: true },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      joiningDate: true,
      completionDate: true,
    },
  });

  console.log(`Found ${applications.length} active applications`);

  let updated = 0;
  let errors = 0;

  for (const app of applications) {
    try {
      // Count existing submitted reports (SUBMITTED or APPROVED status)
      const submittedReports = await prisma.monthlyReport.count({
        where: {
          applicationId: app.id,
          status: { in: ['SUBMITTED', 'APPROVED'] },
          isDeleted: false,
        },
      });

      // Count existing completed visits
      const completedVisits = await prisma.facultyVisitLog.count({
        where: {
          applicationId: app.id,
          status: 'COMPLETED',
        },
      });

      // Calculate expected from dates
      const startDate = app.startDate || app.joiningDate;
      const endDate = app.endDate || app.completionDate;

      let totalExpected = 0;
      if (startDate && endDate) {
        totalExpected = getTotalExpectedCount(new Date(startDate), new Date(endDate));
      }

      // Update application with counter values
      await prisma.internshipApplication.update({
        where: { id: app.id },
        data: {
          totalExpectedReports: totalExpected,
          totalExpectedVisits: totalExpected,
          submittedReportsCount: submittedReports,
          completedVisitsCount: completedVisits,
          expectedCountsLastCalculated: new Date(),
        },
      });

      updated++;
      if (updated % 100 === 0) {
        console.log(`Progress: ${updated}/${applications.length}`);
      }
    } catch (error) {
      console.error(`Error updating application ${app.id}:`, error);
      errors++;
    }
  }

  console.log(`\nBackfill complete!`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
}

backfillCounters()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## Cleanup: Delete DRAFT/SCHEDULED Records (Optional)

After backfill, clean up orphaned placeholder records:

```sql
-- Remove DRAFT reports that were never actually submitted
DELETE FROM "MonthlyReport"
WHERE status = 'DRAFT'
  AND "submittedAt" IS NULL
  AND "reportFileUrl" IS NULL;

-- Remove SCHEDULED visits that were never completed
DELETE FROM "FacultyVisitLog"
WHERE status = 'SCHEDULED'
  AND "visitDate" IS NULL;
```

---

## API Response Standardization

All endpoints should return these fields consistently:

```typescript
interface InternshipWithCounts {
  id: string;
  // ... other fields

  // Counter fields (always include)
  totalExpectedReports: number;
  totalExpectedVisits: number;
  submittedReportsCount: number;
  completedVisitsCount: number;

  // Computed rates (optional, can compute on frontend)
  reportCompletionRate?: number;  // (submitted / expected) * 100
  visitCompletionRate?: number;   // (completed / expected) * 100
}
```

---

## Summary

| Before | After |
|--------|-------|
| Create DRAFT MonthlyReport records | Direct creation on submit |
| Create SCHEDULED FacultyVisitLog records | Direct creation on log |
| COUNT queries every dashboard load | Read 4 counter fields |
| `reportsGenerated` flag | Removed |
| Date change = orphaned records | Date change = only update expected |
| O(n) COUNT queries | O(1) field reads |
