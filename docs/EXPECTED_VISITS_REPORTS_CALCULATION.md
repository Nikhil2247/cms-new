# Expected Faculty Visits & Monthly Reports Calculation

## Overview

This document explains how expected faculty visits and monthly reports are calculated across the CMS application. The system uses a **Fixed Monthly Cycle** approach where internship months are aligned with calendar months.

---

## Table of Contents

1. [Core Calculation Logic](#1-core-calculation-logic)
2. [Database Schema](#2-database-schema)
3. [Utility Files](#3-utility-files)
4. [Backend Implementation](#4-backend-implementation)
5. [Frontend Implementation](#5-frontend-implementation)
6. [API Endpoints](#6-api-endpoints)
7. [Data Flow](#7-data-flow)
8. [Known Issues & Discrepancies](#8-known-issues--discrepancies)
9. [Configuration](#9-configuration)

---

## 1. Core Calculation Logic

### Month Inclusion Rule

A month is **INCLUDED** in expected count only if the student has **more than 10 days** in that month.

```
Days in Month > 10  →  INCLUDED (counted)
Days in Month ≤ 10  →  EXCLUDED (not counted)
```

### Due Dates

| Type | Due Date | Grace Period |
|------|----------|--------------|
| **Monthly Report** | 5th of NEXT month at 23:59:59 | None (submission window: 1st-10th) |
| **Faculty Visit** | Last day of SAME month at 23:59:59 | None |

### Example Calculation

**Internship: January 15 - May 15, 2025**

| Month | Days | Included? | Report Due | Visit Due |
|-------|------|-----------|------------|-----------|
| January | 17 (15-31) | ✓ Yes (17 > 10) | Feb 5, 23:59:59 | Jan 31, 23:59:59 |
| February | 28 | ✓ Yes | Mar 5, 23:59:59 | Feb 28, 23:59:59 |
| March | 31 | ✓ Yes | Apr 5, 23:59:59 | Mar 31, 23:59:59 |
| April | 30 | ✓ Yes | May 5, 23:59:59 | Apr 30, 23:59:59 |
| May | 15 (1-15) | ✓ Yes (15 > 10) | Jun 5, 23:59:59 | May 31, 23:59:59 |

**Total Expected: 5 reports + 5 visits**

### Two Calculation Methods

| Method | Function | Purpose |
|--------|----------|---------|
| **Total Expected** | `getTotalExpectedCount()` | Total for entire internship duration |
| **Expected As Of Today** | `getExpectedReportsAsOfToday()` / `getExpectedVisitsAsOfToday()` | Only counts where due date has passed |

---

## 2. Database Schema

### InternshipApplication Model

```prisma
model InternshipApplication {
  // Expected counts (stored after generation)
  totalExpectedReports  Int?     // Set by generateExpectedReports()
  totalExpectedVisits   Int?     // Set by generateExpectedVisits()
  reportsGenerated      Boolean  @default(false)

  // Date range for calculation
  startDate             DateTime?
  endDate               DateTime?
  joiningDate           DateTime?
  completionDate        DateTime?

  // Relations
  monthlyReports        MonthlyReport[]
  facultyVisitLogs      FacultyVisitLog[]
}
```

### MonthlyReport Model

```prisma
model MonthlyReport {
  reportMonth           Int       // 1-12
  reportYear            Int
  status                MonthlyReportStatus  // DRAFT, SUBMITTED, APPROVED, etc.
  dueDate               DateTime? // 5th of next month
  submissionWindowStart DateTime? // 1st of next month
  submissionWindowEnd   DateTime? // 10th of next month
  periodStartDate       DateTime?
  periodEndDate         DateTime?
  isPartialMonth        Boolean   @default(false)
  isFinalReport         Boolean   @default(false)
}
```

### FacultyVisitLog Model

```prisma
model FacultyVisitLog {
  visitMonth            Int?      // 1-12
  visitYear             Int?
  requiredByDate        DateTime? // Last day of month
  status                VisitLogStatus  // SCHEDULED, COMPLETED, etc.
  isMonthlyVisit        Boolean   @default(true)
}
```

---

## 3. Utility Files

### Backend Utility

**File:** `backend/src/common/utils/monthly-cycle.util.ts`

| Function | Returns | Description |
|----------|---------|-------------|
| `calculateExpectedMonths(start, end)` | `MonthlyCycle[]` | All included months with due dates |
| `getTotalExpectedCount(start, end)` | `number` | Total expected for full duration |
| `getExpectedReportsAsOfToday(start, end)` | `number` | Reports due by today |
| `getExpectedVisitsAsOfToday(start, end)` | `number` | Visits due by today |
| `getReportDueDate(year, month)` | `Date` | 5th of next month |
| `getVisitDueDate(year, month)` | `Date` | Last day of month |
| `getReportSubmissionStatus(report, dueDate)` | `ReportStatusResult` | Full status object |
| `getVisitSubmissionStatus(visit, dueDate)` | `VisitStatusResult` | Full status object |

### Frontend Utility

**File:** `frontend/src/utils/monthlyCycle.js`

Same functions as backend, with minor differences (see [Known Issues](#8-known-issues--discrepancies)).

### Configuration

**Backend:** `backend/src/config/monthly-cycle.config.ts`
**Frontend:** `frontend/src/config/monthlyCycle.config.js`

```javascript
{
  MIN_DAYS_FOR_INCLUSION: 10,    // Month must have >10 days
  REPORT_DUE_DAY: 5,             // Reports due on 5th
  VISIT_DUE_ON_MONTH_END: true,  // Visits due on last day
  MAX_MONTHS: 24,                // Safety limit
  MIN_INTERNSHIP_WEEKS: 16,      // Minimum duration
}
```

---

## 4. Backend Implementation

### Services Using Expected Calculations

#### Principal Service
**File:** `backend/src/api/principal/principal.service.ts`

```typescript
// Lines 620-750: getStudentDetailWithReports()
{
  totalExpectedReports: storedValue ?? getTotalExpectedCount(start, end),
  totalExpectedVisits: storedValue ?? getTotalExpectedCount(start, end),
  expectedReportsAsOfNow: getExpectedReportsAsOfToday(start, end),
  expectedVisitsAsOfNow: getExpectedVisitsAsOfToday(start, end),
  completionPercentage: (approvedReports / totalExpectedReports) * 100,
}
```

#### State Dashboard Service
**File:** `backend/src/api/state/services/state-dashboard.service.ts`

```typescript
// Lines 290-317: getDashboardStats()
for (const internship of internshipsInTraining) {
  expectedReportsThisMonth += getExpectedReportsAsOfToday(start, end);
  expectedVisitsThisMonth += getExpectedVisitsAsOfToday(start, end);
}
```

#### State Institution Service
**File:** `backend/src/api/state/services/state-institution.service.ts`

```typescript
// Lines 380-493: getInstitutions()
reportsExpected = getExpectedReportsAsOfToday(start, end);
visitsExpected = getExpectedVisitsAsOfToday(start, end);
monthlyReportRate = (submitted / expected) * 100;
```

#### Faculty Service
**File:** `backend/src/api/faculty/faculty.service.ts`

```typescript
// Lines 101-115: calculateExpectedCycles() (private)
const months = calculateExpectedMonths(start, end);
return countOnlyDue ? months.filter(m => now >= m.reportDueDate).length : months.length;
```

#### Student Service
**File:** `backend/src/api/student-portal/student.service.ts`

```typescript
// Lines 1891-1969: generateReportsForInternship()
const periods = calculateExpectedReportPeriods(startDate, endDate);
await prisma.internshipApplication.update({
  data: { totalExpectedReports: periods.length, reportsGenerated: true }
});
```

#### Faculty Visit Service
**File:** `backend/src/domain/report/faculty-visit/faculty-visit.service.ts`

```typescript
// Lines 462-556: generateExpectedVisits()
const periods = calculateExpectedVisitPeriods(startDate, endDate);
await prisma.internshipApplication.update({
  data: { totalExpectedVisits: periods.length }
});
```

### ⚠️ ANOMALY: Report Generator Service

**File:** `backend/src/domain/report/builder/report-generator.service.ts`
**Line:** 849

```typescript
// INCORRECT - Uses hardcoded formula instead of monthly cycle
const expectedReports = Math.max(activeApplications.length * 3, 1);
```

**Issue:** This uses `applications * 3` instead of actual date-based calculation.
**Impact:** Compliance scores in custom reports may be incorrect.
**Fix Required:** Replace with `getTotalExpectedCount(startDate, endDate)`.

---

## 5. Frontend Implementation

### Core Utility File

**File:** `frontend/src/utils/monthlyCycle.js`

#### Key Functions and Line Numbers

| Function | Lines | Description |
|----------|-------|-------------|
| `calculateExpectedMonths(start, end)` | 202-267 | Calculates all expected months (days > 10) |
| `getTotalExpectedCount(start, end)` | 275-278 | Total count for entire internship |
| `getExpectedReportsAsOfToday(start, end)` | 287-300 | Reports due by today (uses `<=` at line 294) |
| `getExpectedVisitsAsOfToday(start, end)` | 309-322 | Visits due by today (uses `<=` at line 316) |

#### ⚠️ CRITICAL FINDING: Unused Utility Functions

**The `getExpectedReportsAsOfToday()` and `getExpectedVisitsAsOfToday()` functions in `monthlyCycle.js` are NOT directly used by frontend components.**

Components receive pre-calculated values from backend APIs:
- `expectedReportsAsOfNow`
- `expectedVisitsAsOfNow`

This means the frontend utility functions exist but the actual "as of today" calculation happens on the backend.

### Components Using Expected Calculations

#### Principal Dashboard

| Component | File | Method |
|-----------|------|--------|
| FacultyWorkloadCard | `principal/dashboard/components/FacultyWorkloadCard.jsx` | API only: `f.expectedVisits`, `f.expectedReports` |
| DashboardInternshipTable | `principal/dashboard/components/DashboardInternshipTable.jsx` | Local: `getTotalExpectedCount()` + API: `expectedReportsAsOfNow` |
| SelfIdentifiedInternships | `principal/internships/SelfIdentifiedInternships.jsx` | Local: `getTotalExpectedCount()` + API |

**FacultyWorkloadCard specifics:**
- Line 52: Sums `expectedVisits` from faculty records
- Line 54: Sums `expectedReports` from faculty records
- Lines 104, 128: Uses `record.expectedVisits || 0` and `record.expectedReports || 0` for progress calculation

**DashboardInternshipTable specifics:**
- Line 75: Uses `getTotalExpectedCount()` to calculate total reports
- Line 183: Uses `getTotalExpectedCount()` to calculate total visits
- Lines 178, 188: Stores `expectedReportsAsOfNow` and `expectedVisitsAsOfNow` from backend
- Lines 711, 763: Compares `expectedNow = record.expectedReportsAsOfNow || 0`

#### Faculty Dashboard

| Component | File | Method |
|-----------|------|--------|
| AssignedStudentsList | `faculty/dashboard/components/AssignedStudentsList.jsx` | Local only: `getTotalExpectedCount()` |
| StudentDetailsModal | `faculty/dashboard/components/StudentDetailsModal.jsx` | Local only: `getTotalExpectedCount()` |

**AssignedStudentsList specifics:**
- Lines 84-105: Custom `calculateExpectedReports()` and `calculateExpectedVisits()` functions
- Both use `getTotalExpectedCount(startDate, endDate)` internally

#### State Dashboard

| Component | File | Method |
|-----------|------|--------|
| StatisticsCards | `state/dashboard/components/StatisticsCards.jsx` | API: `expectedThisMonth` |
| PerformanceMetrics | `state/dashboard/components/PerformanceMetrics.jsx` | API: `expectedThisMonth` |
| InstituteDetailView | `state/dashboard/components/InstituteDetailView.jsx` | API: `reportsExpected`, `visitsExpected` |

**InstituteDetailView specifics:**
- Line 1378: Uses fallback pattern: `record.reportsExpected ?? record.expectedReportsCount ?? 0`
- Line 1398: Uses fallback pattern: `record.visitsExpected ?? record.expectedVisitsCount ?? 0`

### Property Name Variations (Frontend Fallbacks)

The frontend uses fallback chains due to inconsistent API property names:

```javascript
// Reports
const submitted = record.reportsSubmitted ?? record.monthlyReportsCount ?? 0;
const expected = record.reportsExpected ?? record.expectedReportsCount ?? 0;

// Visits
const completed = record.visitsCompleted ?? record.facultyVisitsCount ?? 0;
const expected = record.visitsExpected ?? record.expectedVisitsCount ?? 0;
```

### Progress Bar Color Logic Inconsistency

Different portals use different color schemes for progress display:

**Principal Portal (Binary):**
```javascript
// DashboardInternshipTable.jsx Lines 710-728
const isOnTrack = submitted >= expectedNow;
// Color: submitted >= expectedNow ? green : red
```

**State Portal (Ternary):**
```javascript
// InstituteDetailView.jsx Lines 1379, 1399
submitted >= expected ? 'success' : submitted > 0 ? 'warning' : 'error'
// Color: green (on track) / orange (partial) / red (none)
```

---

## 6. API Endpoints

| Endpoint | Service | Returns |
|----------|---------|---------|
| `GET /principal/student/:id/reports` | Principal | `totalExpectedReports`, `expectedReportsAsOfNow`, `completionPercentage` |
| `GET /principal/dashboard` | Principal | Dashboard stats with faculty expected counts |
| `GET /principal/mentor/:id/progress` | Principal | Mentor's students' expected counts |
| `GET /state/dashboard` | State | `expectedThisMonth`, `submissionRate` |
| `GET /state/institutions` | State | Per-institution `reportsExpected`, `visitsExpected` |
| `GET /faculty/dashboard` | Faculty | Student progress with expected counts |
| `POST /student/internship/:id/generate-reports` | Student | Generates and stores `totalExpectedReports` |
| `POST /student/internship/:id/generate-visits` | Student | Generates and stores `totalExpectedVisits` |

---

## 7. Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    REPORT/VISIT GENERATION                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Student Action: POST /generate-reports                          │
│         ↓                                                        │
│  StudentService.generateExpectedReports(applicationId)           │
│         ↓                                                        │
│  calculateExpectedReportPeriods(startDate, endDate)              │
│         ↓                                                        │
│  calculateExpectedMonths() [monthly-cycle.util.ts]               │
│         ↓ Filter months with >10 days                            │
│         ↓                                                        │
│  Create DRAFT MonthlyReport records for each month               │
│         ↓                                                        │
│  Update InternshipApplication:                                   │
│    - reportsGenerated = true                                     │
│    - totalExpectedReports = count                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    DASHBOARD DISPLAY                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Principal Dashboard                                             │
│         ↓                                                        │
│  PrincipalService.getDashboard()                                 │
│         ↓                                                        │
│  Fetch InternshipApplication.totalExpectedReports                │
│    OR calculate via getTotalExpectedCount()                      │
│         ↓                                                        │
│  Count approved MonthlyReports                                   │
│         ↓                                                        │
│  Calculate: completionPercentage = (approved / expected) * 100   │
│         ↓                                                        │
│  Display: "5 reports expected, 2 submitted (40%)"                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    STATE DASHBOARD                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  StateDashboardService.getDashboardStats()                       │
│         ↓                                                        │
│  For each active internship:                                     │
│    getExpectedReportsAsOfToday(startDate, endDate)               │
│         ↓ Count months where due date has passed                 │
│         ↓                                                        │
│  Aggregate across all internships                                │
│         ↓                                                        │
│  submissionRate = (submitted / expectedThisMonth) * 100          │
│         ↓                                                        │
│  Display: "Expected: 150, Submitted: 120 (80%)"                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Known Issues & Discrepancies

### CRITICAL: Backend "As Of Today" Uses Strict Comparison

**Backend** (`monthly-cycle.util.ts` line 530):
```typescript
if (now > month.reportDueDate) { expectedCount++; }
```

**Frontend** (`monthlyCycle.js` line 294):
```javascript
if (month.reportDueDate <= now) { count++; }
```

**Real-World Impact:**
- Frontend utility functions use `<=` (includes today if it's the due date)
- Backend uses `>` (excludes today even if it's the due date)

**BUT NOTE:** The frontend utility functions (`getExpectedReportsAsOfToday`, `getExpectedVisitsAsOfToday`) are **NOT actually used by components**. Components receive pre-calculated `expectedReportsAsOfNow` and `expectedVisitsAsOfNow` values from the **backend**.

**Actual Behavior:** The backend's `>` operator is what controls the display, meaning:
- If today is the due date, the report/visit is NOT counted as "expected as of now"
- It only counts after the due date has passed

**Recommendation:** Decide if this is the desired behavior or if `>=` should be used in backend.

### CRITICAL: Unused Frontend Utility Functions

**File:** `frontend/src/utils/monthlyCycle.js`

Functions `getExpectedReportsAsOfToday()` (line 287) and `getExpectedVisitsAsOfToday()` (line 309) exist but are never called by any component.

All components receive pre-calculated values from backend API responses. These frontend functions should either:
1. Be deleted if truly unused, OR
2. Be used as fallback calculations if backend doesn't provide values

### MEDIUM: Progress Bar Color Logic Inconsistency

Different portals use different color schemes:

| Portal | Logic | Colors |
|--------|-------|--------|
| Principal | Binary | Green (on track) / Red (behind) |
| State | Ternary | Green (on track) / Orange (partial) / Red (none) |

This creates inconsistent user experience across portals.

### MEDIUM: Status Function Return Types

- **Backend:** Returns full object `{ status, label, color, isOverdue, daysOverdue, canSubmit }`
- **Frontend:** Returns only status string `'NOT_STARTED' | 'DRAFT' | 'APPROVED' | 'OVERDUE'`

### MEDIUM: getMonthCycle() Parameter Order

- **Backend:** `getMonthCycle(year, month, startDate, endDate)`
- **Frontend:** `getMonthCycle(startDate, endDate, year, month)`

### LOW: Property Name Inconsistencies

Multiple property names used across API responses:

| Concept | Variations Found |
|---------|-----------------|
| Expected Reports | `reportsExpected`, `expectedReportsCount`, `expectedReports` |
| Expected Visits | `visitsExpected`, `expectedVisitsCount`, `expectedVisits` |
| Submitted Reports | `reportsSubmitted`, `monthlyReportsCount` |
| Completed Visits | `visitsCompleted`, `facultyVisitsCount` |

Frontend uses fallback chains (e.g., `record.reportsExpected ?? record.expectedReportsCount ?? 0`) to handle this.

### Deprecated: Four-Week Cycle Utility

**File:** `backend/src/common/utils/four-week-cycle.util.ts`

This legacy system used 28-day rolling cycles instead of calendar months. It is deprecated and should not be used for new implementations.

---

## 9. Configuration

### Backend Configuration

**File:** `backend/src/config/monthly-cycle.config.ts`

```typescript
export const MONTHLY_CYCLE_CONFIG = {
  MIN_DAYS_FOR_INCLUSION: 10,        // Month must have >10 days to count
  REPORT_DUE_DAY: 5,                 // Reports due on 5th of next month
  VISIT_DUE_ON_MONTH_END: true,      // Visits due on last day of month
  VISIT_DUE_DAY: 28,                 // Fallback if not using month end
  VISIT_GRACE_DAYS: 0,               // No grace period for visits
  MAX_MONTHS: 24,                    // Safety limit for calculations
  MIN_INTERNSHIP_WEEKS: 16,          // Minimum internship duration
  REMINDER_DAYS_BEFORE_DEADLINE: 5,  // Notification timing
  SEND_OVERDUE_NOTIFICATIONS: true,  // Enable late notifications
  AUTO_APPROVE_REPORTS: true,        // Auto-approve on submit
};
```

### Frontend Configuration

**File:** `frontend/src/config/monthlyCycle.config.js`

```javascript
export const MONTHLY_CYCLE_CONFIG = {
  MIN_DAYS_FOR_INCLUSION: 10,
  REPORT_DUE_DAY: 5,
  VISIT_DUE_ON_MONTH_END: true,
  VISIT_DUE_DAY: 28,
  MAX_MONTHS: 24,
  MIN_INTERNSHIP_WEEKS: 16,
  REMINDER_DAYS_BEFORE_DEADLINE: 5,
};
```

---

## Summary Table

| Aspect | Value |
|--------|-------|
| **Calculation Method** | Fixed Monthly Cycle (calendar months) |
| **Month Inclusion Rule** | Days in month > 10 |
| **Report Due Date** | 5th of next month at 23:59:59 |
| **Visit Due Date** | Last day of same month at 23:59:59 |
| **Grace Period** | None |
| **Min Internship** | 16 weeks (~4 months) |
| **Max Months** | 24 (safety limit) |
| **Storage Fields** | `totalExpectedReports`, `totalExpectedVisits` on InternshipApplication |
| **Primary Utility** | `monthly-cycle.util.ts` (backend), `monthlyCycle.js` (frontend) |

---

## Recommendations

### Priority 1 (Critical)

1. **Fix Report Generator Service:** Replace hardcoded `* 3` formula in `report-generator.service.ts:849` with proper date-based calculation using `getTotalExpectedCount(startDate, endDate)`

2. **Decide on "As Of Today" Behavior:** The backend uses `>` (strict) which excludes the due date itself. Either:
   - Keep as-is and document that "expected as of now" only counts AFTER due date passes
   - Change to `>=` to include the due date itself

3. **Clean Up Unused Frontend Functions:** Either:
   - Remove `getExpectedReportsAsOfToday()` and `getExpectedVisitsAsOfToday()` from `monthlyCycle.js` since they're unused
   - Use them as fallback when backend doesn't provide values

### Priority 2 (Medium)

4. **Standardize API Property Names:** Pick one naming convention and use it everywhere:
   - Recommended: `expectedReports`, `expectedVisits`, `submittedReports`, `completedVisits`
   - Update all backend endpoints to return consistent property names
   - Remove frontend fallback chains after standardization

5. **Unify Progress Bar Color Logic:** Choose one scheme (binary or ternary) and apply consistently across all portals

### Priority 3 (Low)

6. **Remove Deprecated Code:** Delete `four-week-cycle.util.ts` after confirming no references

7. **Add Unit Tests:** Cover edge cases:
   - Exactly 10 days in a month (should be excluded)
   - Exactly 11 days in a month (should be included)
   - Due date equals current time (boundary test)

8. **Sync Function Signatures:** Align `getMonthCycle()` parameter order between backend and frontend
