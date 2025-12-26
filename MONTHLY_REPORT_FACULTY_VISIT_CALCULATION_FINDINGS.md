# Monthly Report & Faculty Visit Calculation Analysis

## Executive Summary

This document provides a comprehensive analysis of how monthly reports and faculty visit calculations are implemented across the CMS system. The investigation reveals a sophisticated multi-layered system using a **4-week cycle framework** that has been standardized across the codebase, with some notable inconsistencies that need attention.

---

## Table of Contents

1. [Calculation Framework Overview](#1-calculation-framework-overview)
2. [Monthly Report Calculations](#2-monthly-report-calculations)
3. [Faculty Visit Calculations](#3-faculty-visit-calculations)
4. [Compliance Score Calculations](#4-compliance-score-calculations)
5. [Standardization Assessment](#5-standardization-assessment)
6. [Discrepancies Found](#6-discrepancies-found)
7. [Database Models](#7-database-models)
8. [Recommendations](#8-recommendations)
9. [File Reference Index](#9-file-reference-index)

---

## 1. Calculation Framework Overview

### 1.1 Core System: 4-Week Cycle Framework

**Location:** `backend/src/common/utils/four-week-cycle.util.ts`

The system uses a standardized 4-week (28-day) cycle for all report and visit calculations:

```typescript
// Core Constants
CYCLE_DURATION_DAYS = 28      // 4 weeks
SUBMISSION_GRACE_DAYS = 5     // 5 days after cycle ends
MAX_CYCLES = 26               // ~2 years maximum
```

### 1.2 Cycle Structure

Each cycle contains:
- `cycleNumber`: Sequential identifier (1, 2, 3, ...)
- `cycleStartDate`: First day of 28-day period
- `cycleEndDate`: Last day of 28-day period (or internship end)
- `submissionWindowStart`: Day after cycle ends
- `submissionWindowEnd`: 5 days grace period
- `dueDate`: Last day of submission window
- `isFirstCycle` / `isFinalCycle`: Boolean flags
- `daysInCycle`: Actual days (may be < 28 for first/last)

### 1.3 Example Timeline

```
Internship Start: Dec 15, 2025
Cycle 1: Dec 15 - Jan 11 (28 days) → Due by Jan 16
Cycle 2: Jan 12 - Feb 8 (28 days) → Due by Feb 13
Cycle 3: Feb 9 - Mar 8 (28 days) → Due by Mar 13
```

---

## 2. Monthly Report Calculations

### 2.1 Report Generation Logic

**Service:** `backend/src/domain/report/monthly/monthly-report.service.ts`

#### Expected Reports Calculation
```typescript
// Line 255-299: getReportStatistics()
Total Expected = Math.ceil(internshipDuration / 28 days)
where internshipDuration = endDate - startDate
```

#### Submission Rate Formula
```typescript
// Line 290
submissionRate = (approved / total) * 100
// NOTE: Only APPROVED reports count, not SUBMITTED
```

### 2.2 Report Status Workflow

```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED | REJECTED | REVISION_REQUIRED
```

### 2.3 Due Date Calculation

```typescript
// From four-week-cycle.util.ts
dueDate = cycleEndDate + 5 days (grace period)

// Submission Window
submissionWindowStart = cycleEndDate + 1 day
submissionWindowEnd = cycleEndDate + 6 days
```

### 2.4 Late Submission Detection

```typescript
isLate = submittedAt > dueDate
daysLate = Math.floor((submittedAt - dueDate) / (24 * 60 * 60 * 1000))
```

### 2.5 Frontend Calculation (Student Dashboard)

**File:** `frontend/src/features/student/dashboard/components/MonthlyReportsCard.jsx`

```javascript
// Line 34
progressPercent = totalRequired > 0
  ? Math.round((submitted / totalRequired) * 100)
  : 0;
```

---

## 3. Faculty Visit Calculations

### 3.1 Visit Generation Logic

**Service:** `backend/src/domain/report/faculty-visit/faculty-visit.service.ts`

#### Expected Visits Calculation
```typescript
// Lines 461-558: generateExpectedVisits()
Total Expected Visits = Math.ceil(internshipDuration / 28 days)

// Visit records auto-created when mentor is assigned
// Updates application.totalExpectedVisits
```

#### Visit Due Date
```typescript
requiredByDate = cycleEndDate (NOT cycleEndDate + 5)
// NOTE: Visits don't have grace period like reports
```

### 3.2 Visit Progress Calculation

```typescript
// Lines 563-625: getMonthlyVisitStatus()
progress = {
  total: count of all visits,
  completed: visits with status COMPLETED,
  pending: total - completed,
  overdue: count where now > requiredByDate AND status ≠ COMPLETED,
  percentage: (completed / total) * 100
}
```

### 3.3 Visit Status Determination

```typescript
// Status Types: COMPLETED, PENDING, OVERDUE, UPCOMING

if (status === 'COMPLETED') → COMPLETED (green)
else if (now > requiredByDate) → OVERDUE (red)
else if (now >= cycleStartDate && now <= requiredByDate) → PENDING (blue)
else → UPCOMING (gray)
```

### 3.4 Visit Statistics (Institution Level)

```typescript
// Lines 414-455: getVisitStatistics()
{
  totalVisits: count of all visits for institution,
  pendingFollowUps: count with followUpRequired: true,
  facultyCount: unique faculty members conducting visits,
  averageVisitsPerFaculty: totalVisits / facultyCount
}
```

### 3.5 Frontend Visit Status

**File:** `frontend/src/features/student/applications/utils/applicationUtils.js`

```javascript
// Lines 301-354: getVisitStatus()
daysOverdue = Math.floor((now - requiredByDate) / 86400000)
daysLeft = Math.ceil((requiredByDate - now) / 86400000)
```

---

## 4. Compliance Score Calculations

### 4.1 Primary Compliance Formula (2 Metrics)

**Location:** `backend/src/api/state/services/state-institution.service.ts` (Lines 415-437)

```typescript
Compliance Score = (MentorRate + JoiningLetterRate) / 2

Where:
- MentorRate = Math.min((studentsWithMentors / activeStudents) * 100, 100)
- JoiningLetterRate = Math.min((joiningLettersUploaded / activeStudents) * 100, 100)

// Final score rounded with Math.round()
// Returns null if activeStudents = 0
```

### 4.2 Compliance Thresholds

| Level | Range | Color |
|-------|-------|-------|
| Excellent | >= 90% | Green |
| Good | 70% - 89% | Blue |
| Warning | 50% - 69% | Yellow |
| Critical | 30% - 49% | Orange |
| Intervention Required | < 30% | Red |

### 4.3 Report/Visit Rates (Displayed Separately)

```typescript
// NOT included in main compliance score
visitComplianceRate = (totalVisitsThisMonth / totalStudentsWithInternships) * 100
reportComplianceRate = (totalReportsThisMonth / totalStudentsWithInternships) * 100
```

---

## 5. Standardization Assessment

### 5.1 Areas of Standardization (CONSISTENT)

| Area | Standard | Files Using |
|------|----------|-------------|
| Cycle Duration | 28 days | four-week-cycle.util.ts, all services |
| Grace Period | 5 days | four-week-cycle.util.ts |
| Rating Scale | 1-5 | MonthlyReport, FacultyVisitLog, MonthlyFeedback |
| Cache TTL | 5 minutes (300s) | All services |
| Compliance Formula | (Mentor + JoiningLetter) / 2 | state-institution.service.ts, state-dashboard.service.ts |
| Student Denominator | activeStudents | All compliance calculations |

### 5.2 Areas of Non-Standardization (INCONSISTENT)

| Area | Inconsistency | Details |
|------|---------------|---------|
| Report Status Counting | See Section 6.1 | Different filters used |
| Rounding Methods | See Section 6.2 | Math.round() vs toFixed() |
| Due Date Logic | Visits vs Reports | Reports have grace period, visits don't |

---

## 6. Discrepancies Found

### 6.1 CRITICAL: Report Status Counting Inconsistency

**Issue:** Different parts of the codebase count different statuses for the same metric.

| Location | Status Counted | Code |
|----------|----------------|------|
| `monthly-report.service.ts:290` | APPROVED only | `(approved / total) * 100` |
| `state-dashboard.service.ts:337` | SUBMITTED + APPROVED | `status: { in: ['SUBMITTED', 'APPROVED'] }` |
| `state-institution.service.ts:300` | SUBMITTED + APPROVED | Same filter |

**Impact:** Submission rate varies significantly depending on which service calculates it.

**Example:**
- Total Reports: 100
- Submitted: 30, Approved: 50, Rejected: 20

Using only APPROVED: `(50/100) = 50%`
Using SUBMITTED + APPROVED: `(80/100) = 80%`

### 6.2 MEDIUM: Rounding Method Inconsistency

**Issue:** Different rounding precision across services.

| Location | Method | Result for 85.456 |
|----------|--------|------------------|
| `state-institution.service.ts:437` | `Math.round()` | 85 |
| `state-dashboard.service.ts:323` | `.toFixed(1)` | "85.5" (string) |
| `principal.service.ts:110` | `.toFixed(2)` | "85.46" (string) |
| `monthly-report.service.ts:290` | `Math.round()` | 85 |

**Impact:** Visual inconsistency in dashboards; potential type issues (number vs string).

### 6.3 MEDIUM: Due Date Handling Difference

**Issue:** Reports and visits have different grace period logic.

| Type | Due Date Logic |
|------|----------------|
| Monthly Reports | `cycleEndDate + 5 days` (grace period) |
| Faculty Visits | `cycleEndDate` (no grace period) |

**Implication:** A report submitted on Jan 15 for Cycle 1 (ending Jan 11) is ON TIME, but a visit logged on Jan 15 for the same cycle is OVERDUE.

### 6.4 LOW: Joining Letter Rate Missing Start Date Check

**Location:** `state-institution.service.ts` (Lines 230-246)

**Issue:** Joining letters are counted even if internship hasn't started yet.

```typescript
// Current: No startDate check
where: {
  joiningLetterUrl: { not: null },  // Counts future internships
}

// Should be:
where: {
  joiningLetterUrl: { not: null },
  startDate: { lte: now }  // Only count started internships
}
```

**Impact:** Inflated joining letter rate for institutions with future-dated internships.

### 6.5 LOW: Inconsistent Denominator Usage

**Issue:** Report/visit rates sometimes use different denominators.

| Service | Report Rate Denominator |
|---------|------------------------|
| state-dashboard.service.ts | `internshipsInTraining` |
| monthly-report.service.ts | `total status counts` |
| principal.service.ts | `totalSelfIdentifiedInternships` |

---

## 7. Database Models

### 7.1 MonthlyReport Model

**Location:** `backend/prisma/schema.prisma` (Lines 1313-1372)

```prisma
model MonthlyReport {
  id String @id

  // Relations
  applicationId String     // Required
  studentId String         // Required

  // Report Period
  reportMonth Int          // 1-12
  reportYear Int

  // Status & Dates
  status MonthlyReportStatus
  submittedAt DateTime?
  dueDate DateTime?

  // Submission Window
  submissionWindowStart DateTime?
  submissionWindowEnd DateTime?
  isLateSubmission Boolean @default(false)
  daysLate Int?

  // Review
  reviewedBy String?
  reviewedAt DateTime?
  isApproved Boolean @default(false)

  @@unique([applicationId, reportMonth, reportYear])
  @@index([applicationId])
  @@index([studentId])
  @@index([status])
}
```

### 7.2 FacultyVisitLog Model

**Location:** `backend/prisma/schema.prisma` (Lines 1413-1502)

```prisma
model FacultyVisitLog {
  id String @id

  // Relations
  applicationId String      // Required
  facultyId String?         // Optional (visits can exist before mentor assigned)

  // Visit Tracking
  visitNumber Int?
  visitDate DateTime?
  visitType VisitType       // PHYSICAL, VIRTUAL, TELEPHONIC
  status VisitLogStatus     // SCHEDULED, COMPLETED, CANCELLED

  // Cycle Tracking
  visitMonth Int?
  visitYear Int?
  requiredByDate DateTime?
  isMonthlyVisit Boolean @default(true)

  // Ratings (1-5)
  studentProgressRating Int?
  industryCooperationRating Int?
  workEnvironmentRating Int?

  @@index([applicationId])
  @@index([facultyId])
  @@index([visitDate])
  @@index([visitMonth, visitYear])
}
```

### 7.3 Key Relationships

```
Student
├── InternshipApplication
│   ├── MonthlyReport[] (unique per month/year)
│   ├── FacultyVisitLog[] (one per cycle)
│   └── MonthlyFeedback[] (industry feedback)
└── ComplianceRecord (aggregate tracking)
```

---

## 8. Recommendations

### 8.1 HIGH PRIORITY: Standardize Report Status Counting

**Action:** Create a shared constant/enum for which statuses count as "submitted."

```typescript
// Create: backend/src/common/constants/report-status.constants.ts
export const SUBMITTED_REPORT_STATUSES = [
  MonthlyReportStatus.SUBMITTED,
  MonthlyReportStatus.APPROVED
] as const;

// Use in all services
where: { status: { in: SUBMITTED_REPORT_STATUSES } }
```

### 8.2 HIGH PRIORITY: Standardize Rounding

**Action:** Use `Math.round()` consistently for all percentage calculations.

```typescript
// Standard pattern
const percentage = total > 0
  ? Math.round((completed / total) * 100)
  : 0;
```

### 8.3 MEDIUM PRIORITY: Document Grace Period Difference

**Action:** Either:
- A) Add 5-day grace period to visits for consistency, OR
- B) Clearly document the intentional difference in system documentation

### 8.4 MEDIUM PRIORITY: Add Joining Letter Start Date Check

**Action:** Update query to only count joining letters for started internships.

```typescript
// state-institution.service.ts
where: {
  joiningLetterUrl: { not: null },
  startDate: { lte: new Date() }  // Add this check
}
```

### 8.5 LOW PRIORITY: Standardize Denominator Documentation

**Action:** Create documentation specifying which denominator to use for each metric.

| Metric | Denominator | Rationale |
|--------|-------------|-----------|
| Mentor Rate | activeStudents | All students need mentors |
| Joining Letter | activeStudents | All students need letters |
| Report Submission | internshipsInTraining | Only active internships submit reports |
| Visit Completion | internshipsInTraining | Only active internships need visits |

---

## 9. File Reference Index

### 9.1 Backend Services

| File | Key Functions | Lines |
|------|---------------|-------|
| `backend/src/common/utils/four-week-cycle.util.ts` | calculateFourWeekCycles, getExpectedReportsAsOfToday | 56-150+ |
| `backend/src/domain/report/monthly/monthly-report.service.ts` | submitReport, getReportStatistics | 30-299 |
| `backend/src/domain/report/faculty-visit/faculty-visit.service.ts` | generateExpectedVisits, getMonthlyVisitStatus | 461-625 |
| `backend/src/api/state/services/state-institution.service.ts` | Compliance score calculation | 415-437 |
| `backend/src/api/state/services/state-dashboard.service.ts` | getComplianceSummary, getDashboardStats | 27-854 |
| `backend/src/api/principal/principal.service.ts` | getDashboard | 35-147 |

### 9.2 Frontend Components

| File | Purpose |
|------|---------|
| `frontend/src/features/student/reports/MonthlyReportForm.jsx` | Report submission form |
| `frontend/src/features/faculty/reports/MonthlyReportsPage.jsx` | Faculty report review |
| `frontend/src/features/student/applications/components/FacultyVisitsSection.jsx` | Visit timeline display |
| `frontend/src/features/faculty/visits/VisitLogList.jsx` | Visit log management |
| `frontend/src/features/student/applications/utils/applicationUtils.js` | Status calculation utils |

### 9.3 Database Schema

| Model | Schema Location |
|-------|-----------------|
| MonthlyReport | `backend/prisma/schema.prisma:1313-1372` |
| FacultyVisitLog | `backend/prisma/schema.prisma:1413-1502` |
| ComplianceRecord | `backend/prisma/schema.prisma:951-993` |
| InternshipApplication | `backend/prisma/schema.prisma:1145-1247` |

---

## Summary of Findings

### What IS Standardized:
- 4-week cycle duration (28 days)
- 5-day submission grace period for reports
- 1-5 rating scales across all feedback
- Compliance formula: (MentorRate + JoiningLetterRate) / 2
- Cache TTL: 5 minutes

### What IS NOT Standardized:
- Report status counting (APPROVED only vs SUBMITTED + APPROVED)
- Rounding precision (0 decimal vs 1 decimal vs 2 decimal)
- Grace period handling (reports have it, visits don't)
- Denominator selection for rate calculations

### Critical Discrepancies Requiring Immediate Attention:
1. Report status counting inconsistency (HIGH)
2. Rounding method inconsistency (MEDIUM)
3. Missing start date check for joining letters (MEDIUM)

---

*Document generated: December 26, 2025*
*Investigation conducted using parallel analysis agents*
