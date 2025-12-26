# Dashboard Data Discrepancies Analysis - COMPREHENSIVE

> **Date**: December 26, 2025
> **Scope**: ALL Dashboards (State, Principal, Faculty, Student, Admin), Backend Services, DTOs, Data Models
> **Context**: Self-identified internships are auto-approved; monthly reports and faculty visits should only be expected AFTER internship commencement (startDate)

---

## Executive Summary

| Area | Critical | High | Medium | Total |
|------|----------|------|--------|-------|
| State Dashboard | 5 | 6 | 4 | 15 |
| Principal Dashboard | 4 | 4 | 2 | 10 |
| Faculty Dashboard | 5 | 5 | 4 | 14 |
| Student Dashboard | 3 | 4 | 3 | 10 |
| Data Model | 4 | 3 | 1 | 8 |
| Shared Services | 4 | 4 | 2 | 10 |
| Monthly Reports | 5 | 3 | 2 | 10 |
| Faculty Visits | 4 | 3 | 2 | 9 |
| Mentor Assignments | 1 | 2 | 1 | 4 |
| API/DTOs | 3 | 3 | 2 | 8 |
| **Total** | **38** | **37** | **23** | **98** |

### Core Problems Identified:
1. **Wrong Denominator**: Calculations use `selfIdentifiedApproved` (all approved) instead of `internshipsInTraining` (currently active)
2. **Missing Start Date Filter**: Monthly reports/faculty visits counted without checking if internship has started
3. **Hardcoded Values**: 6-month internship assumption, day > 5 for overdue reports
4. **Dual Status System**: Confusing `status` vs `internshipStatus` fields
5. **Inconsistent Logic**: Same metrics calculated differently across dashboards

---

## 1. STATE DASHBOARD DISCREPANCIES

### CRITICAL

#### 1.1 Monthly Report Rate - Wrong Denominator
- **File**: `backend/src/api/state/state.service.ts`
- **Lines**: 1010, 1041
- **Issue**: Uses `selfIdentifiedApproved` instead of `internshipsInTraining`
```typescript
// WRONG (Line 1010)
monthlyReportRate = selfIdentifiedApproved > 0
  ? ((monthlyReportsSubmitted + monthlyReportsApproved) / selfIdentifiedApproved) * 100
  : 0

// CORRECT (Line 644 - different function)
monthlyReportRate = internshipsInTraining > 0
  ? (reportsSubmittedThisMonth / internshipsInTraining) * 100
  : 100
```
- **Impact**: Inflated compliance rates - counts ended internships in denominator

#### 1.2 Faculty Visits - No Start Date Filter
- **File**: `backend/src/api/state/state.service.ts`
- **Lines**: 945-976
- **Issue**: Counts visits for month without checking if internship started
```typescript
// Current - WRONG
visitDate: { gte: startOfMonth, lte: endOfMonth }

// Should add filter
application: { startDate: { lte: now } }
```
- **Impact**: Visits counted before internship commencement

#### 1.3 Unassigned Students - Wrong Denominator
- **File**: `backend/src/api/state/state.service.ts`
- **Lines**: 195-198
- **Issue**: Uses all approved internships, not those currently in training
```typescript
const unassignedStudents = Math.max(0, studentsWithApprovedInternships - studentsWithActiveMentors);
// Should be: studentsWithActiveInternships - studentsWithActiveMentors
```

#### 1.4 Three Different Report Rate Calculations
- **Locations**:
  - Line 644: Uses `internshipsInTraining` (CORRECT)
  - Line 1010: Uses `selfIdentifiedApproved` (WRONG)
  - Line 3190: Uses `selfIdentifiedApproved` (WRONG)
- **Impact**: Different statistics for same metric

#### 1.5 Compliance Score Uses Mixed Denominators
- **File**: `backend/src/api/state/state.service.ts`
- **Lines**: 1008-1011
- **Issue**: Averages rates with different bases
```typescript
complianceScore = Math.round((mentorAssignmentRate + joiningLetterRate + monthlyReportRate) / 3);
// mentorAssignmentRate uses selfIdentifiedApproved (OK)
// monthlyReportRate uses selfIdentifiedApproved (WRONG - should use internshipsInTraining)
```

### HIGH

#### 1.6 Missing Reports - Hardcoded Day Check
- **File**: `backend/src/api/state/state.service.ts`
- **Lines**: 3836-3860
```typescript
now.getDate() > 5 ? this.prisma.student.findMany({ ... }) : Promise.resolve([])
```
- **Should**: Check days since internship startDate

#### 1.7 Mentor Assignment Query - No Active Internship Check
- **File**: `backend/src/api/state/state.service.ts`
- **Lines**: 128-131
- **Issue**: Counts all active mentor assignments regardless of internship status

#### 1.8 Critical Alerts - 7-Day Grace Period Not Clear
- **Lines**: 3805-3818
- **Issue**: Uses `createdAt` grace period, should use `startDate`

#### 1.9 Institution Ranking - Inconsistent Calculation
- **Line**: 3184-3188
- **Issue**: Uses different logic than main dashboard

#### 1.10 Monthly Reports Query - No Training Period Filter
- **Lines**: 886-943
- **Issue**: Counts all reports without checking internship dates

#### 1.11 Self-Identified Rate - Total Students Denominator
- **Line**: 1026
- **Issue**: Shows % of total students, not % of students with internships

### MEDIUM

#### 1.12 Frontend Fallback - Wrong Denominator
- **File**: `frontend/src/features/state/dashboard/components/PerformanceMetrics.jsx`
- **Lines**: 53-69
- **Issue**: Uses `stats.students?.active` instead of students with internships

#### 1.13 Statistics Cards - Ambiguous Labels
- **File**: `frontend/src/features/state/dashboard/components/StatisticsCards.jsx`
- **Lines**: 186-189
- **Issue**: Subtitle shows "active students" on internship card

#### 1.14 Institute Detail View - Rate Display
- **File**: `frontend/src/features/state/dashboard/components/InstituteDetailView.jsx`
- **Line**: 254
- **Issue**: Displays rate based on wrong denominator from backend

#### 1.15 Auto-Approved vs Applied - Terminology
- **Lines**: 103-119
- **Issue**: Shows "APPLIED" status for auto-approved internships

---

## 2. PRINCIPAL DASHBOARD DISCREPANCIES

### CRITICAL

#### 2.1 Compliance Metrics - Uses `createdAt` Instead of `startDate`
- **File**: `backend/src/api/principal/principal.service.ts`
- **Lines**: 3461-3467
```typescript
// WRONG - counts by application creation date
createdAt: { lte: endOfMonth }

// SHOULD BE - counts by internship start date
startDate: { lte: endOfMonth }
```
- **Impact**: Inflates internship counts for historical months

#### 2.2 Monthly Progress - Hardcoded Division by 6
- **File**: `backend/src/api/principal/principal.service.ts`
- **Lines**: 2410-2433
```typescript
result.push({
  month: monthName,
  completed: Math.round(totalApproved / 6),  // HARDCODED!
  inProgress: Math.round(totalPending / 6),
});
```
- **Impact**: All 6 months show identical (wrong) data

#### 2.3 Missing Visits - No startDate Check
- **File**: `backend/src/api/principal/principal.service.ts`
- **Lines**: 3580-3594
- **Issue**: Flags students with new internships (< 30 days) as "missing visits"
```typescript
// Missing filter for startDate >= thirtyDaysAgo
facultyVisitLogs: {
  none: { visitDate: { gte: thirtyDaysAgo } }
}
```

#### 2.4 Faculty Visits/Reports - No internship startDate Filter
- **Lines**: 3466-3476
- **Issue**: Counts visits occurring before internship started

### HIGH

#### 2.5 Overdue Reports - Hardcoded Day > 5
- **Line**: 3623
```typescript
now.getDate() > 5 ? this.prisma.student.count({ where: overdueReportsWhere }) : 0
```
- **Should**: Check based on internship startDate

#### 2.6 Analytics - Assignment Instead of Addition
- **Lines**: 2367-2371
```typescript
if (item.status === 'COMPLETED') {
  completedInternships = count;  // WRONG: should be +=
}
```
- **Impact**: Only counts last COMPLETED status

#### 2.7 Compliance Returns 100% When No Data
- **Lines**: 3489-3495
```typescript
const visitCompliance = studentsWithInternships > 0
  ? Math.round(Math.min((facultyVisits / studentsWithInternships) * 100, 100))
  : 100;  // FALSE 100%
```

#### 2.8 Internship Count Inconsistency
- **File**: `frontend/src/features/principal/dashboard/components/InternshipCompaniesCard.jsx`
- **Lines**: 109-126
- **Issue**: Frontend adds multiple statuses that may overlap

### MEDIUM

#### 2.9 Mock Data Shows Wrong Statuses
- **File**: `frontend/src/features/principal/internships/SelfIdentifiedInternships.jsx`
- **Lines**: 1053-1093
- **Issue**: Mock shows various statuses, but self-identified are auto-approved

#### 2.10 Faculty Workload - No Internship Status Filter
- **File**: `frontend/src/features/principal/dashboard/components/FacultyWorkloadCard.jsx`
- **Issue**: Doesn't verify only ONGOING internships counted

---

## 3. FACULTY DASHBOARD DISCREPANCIES

### CRITICAL

#### 3.1 Hardcoded 6-Month Assumption
- **File**: `backend/src/api/faculty/faculty.service.ts`
- **Lines**: 329-334
```typescript
const totalReportsExpected = 6; // HARDCODED
overallProgress = (submittedReports / totalReportsExpected) * 100;
```
- **Should**: Use `totalExpectedReports` from schema or calculate from dates

#### 3.2 Monthly Reports - No startDate Validation
- **Lines**: 104-116
- **Issue**: Counts pending reports for internships that haven't started

#### 3.3 Visit Logs - No startDate Validation
- **Lines**: 128-132
- **Issue**: Allows visits before internship commencement

#### 3.4 Self-Identified Approvals - Contradicts Auto-Approve
- **Lines**: 807-855
```typescript
where.status = ApplicationStatus.APPLIED; // Default to pending
```
- **Should**: Self-identified internships start as APPROVED

#### 3.5 Visit Log Creation - No Date Validation
- **Lines**: 428-551
- **Issue**: Allows backdating visits before internship start

### HIGH

#### 3.6 Upcoming Visits - No startDate Filter
- **Lines**: 155-177
- **Issue**: Shows visits for internships that haven't started

#### 3.7 Mentor Assignment - No Active Internship Check
- **Lines**: 73-81
- **Issue**: Shows students as assigned even if internship rejected

#### 3.8 Frontend Completed Visits - No startDate Check
- **File**: `frontend/src/features/faculty/hooks/useFacultyDashboard.js`
- **Line**: 103
```typescript
completedVisits: visitLogs.list.filter(v => new Date(v.visitDate) < new Date()).length
```

#### 3.9 Student Progress - Ignores Duration
- **File**: `frontend/src/features/faculty/students/StudentProgress.jsx`
- **Lines**: 311-323
- **Issue**: No expected vs actual calculation

#### 3.10 Report Upload - No Date Validation
- **Lines**: 388-434
- **Issue**: Allows reports for any month/year

### MEDIUM

#### 3.11 Monthly Report Card - Pending Status Logic
- **File**: `frontend/src/features/faculty/dashboard/components/MonthlyReportsCard.jsx`
- **Line**: 87
- **Issue**: Doesn't validate reports are after internship start

#### 3.12 Assigned Students List - Recent Visit Check
- **File**: `frontend/src/features/faculty/dashboard/components/AssignedStudentsList.jsx`
- **Lines**: 100-118
- **Issue**: Green status shown for pre-internship visits

#### 3.13 Statistics Grid - Misleading Labels
- **File**: `frontend/src/features/faculty/dashboard/components/StatisticsGrid.jsx`
- **Lines**: 44-50
- **Issue**: Shows visits without temporal context

#### 3.14 startDate Field Not Used
- **Issue**: Schema has startDate but service doesn't use it

---

## 4. DATA MODEL DISCREPANCIES

### CRITICAL

#### 4.1 Dual Status System
- **File**: `backend/prisma/schema.prisma`
- **Lines**: 1162-1192
- **Issue**: Two overlapping status fields
  - `status`: ApplicationStatus enum (APPROVED, APPLIED, etc.)
  - `internshipStatus`: String (SELF_IDENTIFIED, ONGOING, COMPLETED)
- **Problem**: Queries inconsistently use one or the other

#### 4.2 Review Fields for Auto-Approved
- **Lines**: 1211-1214
- **Issue**: `reviewedBy`, `reviewedAt`, `reviewRemarks` populated for auto-approved internships
- **Semantic Confusion**: Implies human review occurred

#### 4.3 internshipStatus as String
- **Line**: 1192
```prisma
internshipStatus String? // SELF_IDENTIFIED or OFFERED_BY_COLLEGE
```
- **Problem**: No enum constraint, used inconsistently:
  - Bulk import: `SELF_IDENTIFIED`
  - Service: `ONGOING`
  - One field, two purposes (source type + execution status)

#### 4.4 FacultyVisitLog - No Internship Date Validation
- **Lines**: 1409-1498
- **Issue**: No constraint that visitDate falls within internship dates
- **Missing**: Auto-calculation of required visits based on duration

### HIGH

#### 4.5 MonthlyReport - No Internship Link
- **Lines**: 1313-1368
- **Issue**: Report periods manually set, not auto-calculated from internship dates

#### 4.6 MentorAssignment - No Timeline Validation
- **Lines**: 910-949
- **Issue**: No validation that assignment is within internship dates

#### 4.7 Status Interpretation Inconsistency
- **Multiple Files**
- **Issue**: Principal, State, Faculty services interpret statuses differently

### MEDIUM

#### 4.8 totalExpectedReports/Visits Not Auto-Calculated
- **Issue**: Fields exist but must be manually set

---

## 5. CROSS-DASHBOARD INCONSISTENCIES

| Metric | State Calculation | Principal Calculation | Faculty Calculation |
|--------|-------------------|----------------------|---------------------|
| Monthly Report Rate | `submitted / selfIdentifiedApproved` | `submitted / selfIdentifiedApproved` | `submitted / 6` (hardcoded) |
| Expected Reports | Based on `internshipsInTraining` | Based on `createdAt` | Hardcoded 6 |
| Active Internships | `status: APPROVED` | `internshipStatus: ONGOING` OR `status: APPROVED/JOINED` | `status: APPROVED/JOINED` |
| Overdue Check | Day > 5 of month | Day > 5 of month | Not implemented |
| startDate Filter | Not used | Not used | Not used |

---

## 6. RECOMMENDED FIXES

### Priority 1: Data Model Refactoring
1. Split `internshipStatus` into `internshipType` (enum) and `executionStatus` (enum)
2. Remove review fields from auto-approved internships OR add `autoApprovedAt` field
3. Add database constraint: visit/report dates must be within internship dates

### Priority 2: Backend Logic Fixes
1. **Use `internshipsInTraining` everywhere** - Replace `selfIdentifiedApproved` with count of internships where `startDate <= now AND (endDate >= now OR endDate IS NULL)`
2. **Add startDate filter** to all monthly report and faculty visit queries
3. **Remove hardcoded values** - Calculate expected reports from internship duration
4. **Standardize status interpretation** - Create single service method for status determination

### Priority 3: Frontend Updates
1. Update fallback calculations to use correct denominators
2. Add validation for report/visit date selection
3. Improve labels to distinguish "all approved" vs "currently active"

---

## 7. FILES REQUIRING CHANGES

### Backend
| File | Changes Needed |
|------|---------------|
| `backend/src/api/state/state.service.ts` | Lines 195-198, 644, 886-943, 945-976, 1008-1011, 1026, 1041, 3184-3188, 3836-3860 |
| `backend/src/api/principal/principal.service.ts` | Lines 2367-2371, 2410-2433, 3461-3467, 3466-3476, 3489-3495, 3580-3594, 3623 |
| `backend/src/api/faculty/faculty.service.ts` | Lines 73-81, 104-116, 128-132, 155-177, 329-334, 428-551, 807-855 |
| `backend/prisma/schema.prisma` | Lines 1162-1214 (InternshipApplication model) |

### Frontend
| File | Changes Needed |
|------|---------------|
| `frontend/src/features/state/dashboard/components/PerformanceMetrics.jsx` | Lines 53-69 |
| `frontend/src/features/state/dashboard/components/StatisticsCards.jsx` | Lines 186-189 |
| `frontend/src/features/state/dashboard/components/InstituteDetailView.jsx` | Line 254 |
| `frontend/src/features/principal/internships/SelfIdentifiedInternships.jsx` | Lines 1053-1093 |
| `frontend/src/features/faculty/hooks/useFacultyDashboard.js` | Line 103 |
| `frontend/src/features/faculty/students/StudentProgress.jsx` | Lines 311-323, 388-434 |
| `frontend/src/features/faculty/dashboard/components/MonthlyReportsCard.jsx` | Line 87 |
| `frontend/src/features/faculty/dashboard/components/AssignedStudentsList.jsx` | Lines 100-118 |

---

## 8. DESIGN DECISIONS (Confirmed)

| Question | Decision |
|----------|----------|
| **Expected Reports/Visits** | Fixed per month - expect 1 report and 1 visit per month while internship is active |
| **Empty Data Compliance** | Show N/A or dash when no internships exist (not 100%) |
| **Review Fields (Auto-Approve)** | Keep as-is - continue populating reviewedAt with auto-approval timestamp |
| **Status Field Consolidation** | Merge `status` and `internshipStatus` into single ApplicationStatus enum |

---

## 9. IMPLEMENTATION PRIORITY

### Phase 1: Critical Calculation Fixes (Backend)
1. Replace `selfIdentifiedApproved` with `internshipsInTraining` in all rate calculations
2. Add `startDate` filter to all monthly report and faculty visit queries
3. Remove hardcoded `totalReportsExpected = 6` - calculate months since startDate
4. Fix compliance to show N/A when no data

### Phase 2: Data Model Refactoring
1. Create migration to merge `internshipStatus` values into `ApplicationStatus` enum
2. Add new enum values: `ONGOING`, `IN_TRAINING`
3. Migrate existing data
4. Remove `internshipStatus` field

### Phase 3: Frontend Updates
1. Update fallback calculations
2. Add date validation for report/visit uploads
3. Handle N/A compliance display

---

## 10. STUDENT DASHBOARD DISCREPANCIES

### CRITICAL

#### 10.1 Monthly Report Timing Validation Missing
- **File**: `backend/src/api/student-portal/student.service.ts`
- **Lines**: 1088-1256
- **Issue**: `submitMonthlyReport()` has NO validation checking if report month/year is after `application.startDate`
- **Impact**: Students can submit reports for months BEFORE internship started

#### 10.2 Self-Identified Count Inconsistency
- **Backend**: `student.service.ts:259-261` - Counts ALL self-identified regardless of status
- **Frontend**: `studentSelectors.js:897` - Counts from filtered list
- **Impact**: Different counts in different views

#### 10.3 Report Fetch Not Filtered by startDate
- **File**: `backend/src/api/student-portal/student.service.ts`
- **Lines**: 1521-1577
- **Issue**: `getMonthlyReports()` fetches ALL reports, no filtering by internship period
- **Impact**: Reports from invalid periods displayed

### HIGH

#### 10.4 Auto-Approval Not Clearly Communicated
- **Backend** returns `autoApproved: true` but frontend shows generic "Report submitted" message
- Students don't know reports are auto-approved vs pending review

#### 10.5 Progress Calculation Includes Invalid Reports
- **File**: `frontend/src/features/student/store/studentSelectors.js`
- **Lines**: 862-872
- **Issue**: Includes ALL reports regardless of internship period
- **Impact**: Progress bar shows incorrect completion %

#### 10.6 Status Name Case Sensitivity
- **Frontend** filters for status strings like `'APPLIED'`, `'APPROVED'`
- **Backend** uses enum values which may differ in casing

#### 10.7 Multiple Self-Identified Count Sources
- `StudentDashboard.jsx:36`: Uses selector
- `MyApplications.jsx:35-36`: Calculates locally
- **Impact**: Different components may show different counts

### MEDIUM

#### 10.8 Statistics Grid Fallback Logic
- **File**: `frontend/src/features/student/dashboard/components/StatisticsGrid.jsx`
- **Line**: 22
- **Issue**: Falls back to overlapping stats when undefined

#### 10.9 getAllowedReportMonths Not Enforced
- **File**: `frontend/src/features/student/applications/utils/applicationUtils.js`
- **Lines**: 72-111
- **Issue**: Calculates allowed months but UI doesn't enforce

#### 10.10 Current Internship Status Filter
- **File**: `backend/src/api/student-portal/student.service.ts`
- **Lines**: 216-237
- **Issue**: Uses `[APPROVED, JOINED]` which may not match other dashboards

---

## 11. SHARED SERVICES CONSISTENCY ISSUES

### CRITICAL

#### 11.1 Grievance Status Overloading
- **File**: `backend/src/domain/support/grievance/grievance.service.ts`
- **Lines**: 140, 869, 901, 923
- **Issue**: PENDING and SUBMITTED treated as distinct but counted together
- **Impact**: Double-counting in statistics

#### 11.2 Monthly Report Submission Rate Formula Differs
- **monthly-report.service.ts:290**: `(approved + needsRevision) / total`
- **state-report.service.ts:176**: `approved / total`
- **Impact**: Same metric, different values

#### 11.3 Date Filtering Inconsistency
- Some services use `createdAt`, others use `startDate`, others use `reportMonth/visitMonth`
- No standardized approach to date range filtering

#### 11.4 ApplicationStatus Enum Mapping Confusion
- **File**: `backend/src/domain/internship/application/internship-application.service.ts`
- **Lines**: 27-44
- **Issue**: Maps 'PENDING' → 'APPLIED', creating confusion

### HIGH

#### 11.5 Visit Percentage Rounding Inconsistent
- **faculty-visit.service.ts:581**: Uses `Math.round()`
- **monthly-report.service.ts:290**: No rounding
- **Impact**: Display precision differences

#### 11.6 API Response Unwrapping Patterns Vary
- **report.service.js**: `response.data?.data || response.data`
- **api.js**: `data.data`
- **admin.service.js**: `response.data` (no unwrap)
- **Impact**: Frontend parsing errors

#### 11.7 Support Ticket vs Fee Service Counting
- Support ticket: Database count queries
- Fee service: In-memory filtering after fetch
- **Impact**: Performance and consistency issues

#### 11.8 Different "Active" Criteria
- **mentor.service.ts:332**: `isActive: true`
- **state-report.service.ts:37**: No `isActive` check

### MEDIUM

#### 11.9 Date Formatting Inconsistent
- `toLocaleDateString()` vs `toLocaleString()` vs `toISOString()`

#### 11.10 Pagination Response Format Varies
- Some: `{ data, total, page, limit, totalPages }`
- Some: `{ reports, total, page, limit }` (domain-specific key)
- Some: No data wrapper

---

## 12. MONTHLY REPORTS CROSS-ROLE ANALYSIS

### CRITICAL

#### 12.1 Expected Report Calculation Differences

| Role | Method | Denominator | Issue |
|------|--------|-------------|-------|
| State | Dynamic | `internshipsInTraining` | Correct |
| Principal | Static | `6` (hardcoded) | WRONG |
| Faculty | Static | `6` (hardcoded) | WRONG |
| Student | None | Not validated | WRONG |

#### 12.2 Status Handling Inconsistency

| Role | "Pending" Definition | "Approved" Definition |
|------|---------------------|----------------------|
| State | SUBMITTED | APPROVED |
| Principal | SUBMITTED or APPROVED | APPROVED only |
| Faculty | PENDING or SUBMITTED | SUBMITTED + APPROVED |
| Student | N/A | Auto-approved |

#### 12.3 No startDate Validation Anywhere
- **Student Submit**: No validation
- **Backend Service**: No validation
- **Faculty Review**: No validation
- **State Dashboard**: Partial filtering only

#### 12.4 Compliance Score Uses Different Denominators
- **Line 1010**: `(submitted + approved) / selfIdentifiedApproved`
- **Line 644**: `submitted / internshipsInTraining`
- **Impact**: Same institution gets different scores

#### 12.5 Report Counting Metrics Differ
- State: Count internships in training
- Principal: Count all approved reports
- Faculty: Count SUBMITTED + APPROVED

### HIGH

#### 12.6 PENDING vs SUBMITTED Ambiguity
- Frontend shows "PENDING" status
- Backend uses "SUBMITTED" in database
- No clear mapping documented

#### 12.7 Expected Reports Field Not Used
- `totalExpectedReports` exists in schema but rarely populated/used

#### 12.8 Report Month/Year Not Validated Against Internship

### MEDIUM

#### 12.9 Missing Compliance Report Definition
- `compliance-reports.definition.ts` doesn't include expected count

#### 12.10 Progress Display Without Context
- Shows submitted count but not expected count

---

## 13. FACULTY VISITS CROSS-ROLE ANALYSIS

### CRITICAL

#### 13.1 Visit Compliance Rate Calculation Differs

| Dashboard | Formula | Issue |
|-----------|---------|-------|
| State | `(totalVisits / totalStudents) * 100` | Uses all approved |
| Principal | `(facultyVisits / studentsWithInternships) * 100` | Uses ONGOING filter |
| Faculty | Not calculated | Missing metric |

#### 13.2 No startDate Validation for Visits
- **faculty-visit.service.ts**: `createVisitLog()` has no date validation
- **generateExpectedVisits()**: Calculates from dates but doesn't validate
- **Impact**: Visits can be created before internship starts

#### 13.3 Missing Visits Alert Doesn't Check startDate
- **principal.service.ts:3580-3594**: Flags students with internship < 30 days as "missing visits"
- **Should**: Only flag if `now - startDate >= 30 days`

#### 13.4 Expected Visits Not Consistently Calculated
- State uses `studentsWithInternships` (all approved)
- Principal uses ONGOING filter
- **Impact**: Different expected counts

### HIGH

#### 13.5 Visit Status Types Inconsistent
- Uses: `UPCOMING`, `PENDING`, `OVERDUE`, `COMPLETED`
- No validation against internship dates

#### 13.6 Database Schema Missing Constraints
- No constraint that `visitDate >= application.startDate`
- No auto-calculation of required visits

#### 13.7 totalExpectedVisits Field Not Populated
- Schema has field but defaults to static value

### MEDIUM

#### 13.8 Frontend VisitLogsCard No Expected Count
- Shows actual visits but not expected

#### 13.9 Visit Number Tracking Inconsistent
- `visitNumber` field exists but not consistently used

---

## 14. MENTOR ASSIGNMENT CONSISTENCY

### CRITICAL

#### 14.1 State Action Items Uses Wrong Denominator
- **File**: `backend/src/api/state/state.service.ts`
- **Lines**: 4041-4057
- **Issue**: Uses `studentsWithInternships` instead of `selfIdentifiedApproved`
- **Impact**: Institutions incorrectly flagged for intervention

### HIGH

#### 14.2 Different Active Internship Checks
- State: `status: APPROVED`
- Principal: `internshipStatus: 'ONGOING'`
- Faculty: `status: [APPROVED, JOINED]`
- **Impact**: Different counts across dashboards

#### 14.3 Mentor Coverage Uses Different Filters
- **principal.service.ts:3397-3399**: Uses `totalStudentsWithInternships` (ONGOING filter)
- Other dashboards use APPROVED status
- **Impact**: Percentages don't match

### MEDIUM

#### 14.4 UI Labels Don't Distinguish
- "Students with Mentors" shown without clarifying denominator

---

## 15. API DTOs AND RESPONSE FORMAT ISSUES

### CRITICAL

#### 15.1 Phone Field Naming Inconsistent
| DTO | Field Name |
|-----|------------|
| Principal Staff | `phone` |
| State Principal | `phoneNo` |
| State Staff | `phoneNo` |
| System Admin | `phoneNo` |
| **Database** | `phoneNo` |

**Fix needed**: Change `phone` to `phoneNo` in Principal Staff DTO

#### 15.2 Active Field Naming Inconsistent
| DTO | Field Name |
|-----|------------|
| Update Student | `isActive` |
| Institution | `isActive` |
| State Staff | `active` |
| **Database User** | `active` |
| **Database Student** | `isActive` |

#### 15.3 Enrollment Number vs Roll Number
- **DTO**: `enrollmentNumber`
- **Database**: `rollNumber`
- **Impact**: Mapping issues in service layer

### HIGH

#### 15.4 Pagination Response Format Varies
```typescript
// Format 1: With data wrapper
{ data, total, page, limit, totalPages }

// Format 2: Domain-specific key
{ reports, total, page, limit, totalPages }

// Format 3: No wrapper (Faculty)
{ total, page, limit, totalPages }
```

#### 15.5 Dashboard Stats Response Structures Differ
- Principal: Full nested structure
- Faculty: Flat partial structure
- **Impact**: Frontend needs role-specific handling

#### 15.6 No TypeScript Interfaces for Complex Responses
- Mentor assignment response has no defined interface
- Dashboard stats have implicit types only

### MEDIUM

#### 15.7 institutionName Field May Be Null
- Included in DTO but not always populated

#### 15.8 roleStats Required but Not Always Returned
- Listed as required in DTO but missing in some responses

---

## 16. MASTER FIX PRIORITY LIST

### IMMEDIATE (Phase 1)

1. **Add startDate validation** to all report/visit submission and queries
2. **Replace hardcoded `6`** with dynamic month calculation since startDate
3. **Use `internshipsInTraining`** consistently as denominator
4. **Fix state.service.ts:4041** - change denominator to `selfIdentifiedApproved`
5. **Show N/A** instead of 100% when no internships exist

### SHORT-TERM (Phase 2)

1. **Standardize phone field** to `phoneNo` everywhere
2. **Standardize active field** to `isActive` everywhere
3. **Rename enrollmentNumber** to `rollNumber` in DTOs
4. **Unify pagination response format** with `data` wrapper
5. **Add status enum validation** for PENDING vs SUBMITTED

### MEDIUM-TERM (Phase 3)

1. **Merge `internshipStatus`** into `ApplicationStatus` enum
2. **Add database constraints** for visit/report dates
3. **Create TypeScript interfaces** for all response types
4. **Implement submission rate formula** consistently

---

## 17. FILES REQUIRING CHANGES (COMPLETE LIST)

### Backend Services
| File | Critical Lines |
|------|---------------|
| `state.service.ts` | 195-198, 644, 886-943, 945-976, 1008-1011, 1026, 1041, 3184-3188, 3836-3860, 4041-4057 |
| `principal.service.ts` | 2367-2371, 2410-2433, 3461-3467, 3489-3495, 3580-3594, 3623 |
| `faculty.service.ts` | 73-81, 104-116, 128-132, 155-177, 329-334, 428-551, 807-855 |
| `student.service.ts` | 216-237, 259-261, 1088-1256, 1521-1577 |
| `monthly-report.service.ts` | 30-65, 278-282, 290 |
| `faculty-visit.service.ts` | 31-63, 145-230, 427-524 |
| `state-report.service.ts` | 37, 152, 176 |
| `grievance.service.ts` | 140, 869, 901, 923 |

### Backend DTOs
| File | Issue |
|------|-------|
| `principal/dto/create-staff.dto.ts` | Change `phone` to `phoneNo` |
| `principal/dto/create-student.dto.ts` | Change `enrollmentNumber` to `rollNumber` |
| `state/dto/update-staff.dto.ts` | Change `active` to `isActive` |

### Frontend Components
| File | Critical Lines |
|------|---------------|
| `PerformanceMetrics.jsx` | 53-69 |
| `StatisticsCards.jsx` | 186-189 |
| `InstituteDetailView.jsx` | 254 |
| `SelfIdentifiedInternships.jsx` | 1053-1093 |
| `useFacultyDashboard.js` | 103 |
| `StudentProgress.jsx` | 311-323, 388-434 |
| `MonthlyReportsCard.jsx` | 87 |
| `AssignedStudentsList.jsx` | 100-118 |
| `studentSelectors.js` | 862-872, 897 |
| `StatisticsGrid.jsx` (Student) | 22 |

### Schema
| File | Changes |
|------|---------|
| `schema.prisma` | Lines 1162-1214, 1192, 1409-1498 |

---

*Generated by comprehensive automated analysis - December 26, 2025*
*Total Issues Found: 98 (38 Critical, 37 High, 23 Medium)*
