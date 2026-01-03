# CMS Data Discrepancy Report

## Critical Issues Summary

### 1. Student Count Inconsistencies
**Issue:** Total (179) vs Active (168) students - 11 inactive students included in some counts
- Principal Dashboard: Shows both total and active separately ✓
- Faculty Dashboard: NO isActive filter on assigned students ✗
- State Dashboard: Active count correct, but internship metrics use total ✗

### 2. Backend Endpoint Filtering Issues

#### PRINCIPAL API
| Endpoint | Student Filter | Internship Filter | Status |
|----------|---------------|-------------------|--------|
| /principal/dashboard | PARTIAL | ✗ NO | FIX NEEDED |
| /principal/mentors/stats | ✓ YES | ✓ YES | GOOD |
| /principal/dashboard/mentor-coverage | ✓ YES | ✓ YES | GOOD |

**Issues:**
- `getDashboard()` - Line 78-79: Internship counts missing `student.isActive` filter

#### FACULTY API
| Endpoint | Student Filter | Internship Filter | Status |
|----------|---------------|-------------------|--------|
| /faculty/dashboard | ✗ NO | ✗ NO | FIX NEEDED |
| /faculty/students | ✗ NO | N/A | FIX NEEDED |

**Issues:**
- `getDashboard()` - Line 240-249: Active internships count missing `student.isActive`
- `getAssignedStudents()` - Line 376-475: No `student.isActive` filter

#### STATE API
| Endpoint | Student Filter | Internship Filter | Status |
|----------|---------------|-------------------|--------|
| /state/dashboard | PARTIAL | ✗ NO | FIX NEEDED |
| /state/institutions/:id/overview | PARTIAL | ✗ NO | FIX NEEDED |
| /state/mentors/institution-overview | ✓ YES | ✓ YES | GOOD |

**Issues:**
- `getDashboard()` - Line 106-113: Internship/report/visit counts missing `student.isActive`
- `getInstitutionOverview()` - Line 644-648: Self-identified counts missing filter

### 3. Frontend Display Inconsistencies

#### Principal Views
- **MentorAssignment.jsx**: Shows stats from backend (correctly filtered) ✓
- **Dashboard**: Shows both total and active ✓

#### Faculty Views
- **StatisticsGrid.jsx**:
  - Line 192-209: Uses `stats.totalStudents` (includes inactive) ✗
  - Should show breakdown: internal/external AND active/inactive

#### State Views
- **InstituteDetailView.jsx**:
  - MentorOverviewTab (Line 131-147): NOW shows breakdown ✓ (just added)
  - OverviewTab: Uses backend stats (some include inactive) ✗

### 4. Percentage Calculation Errors
**Problem:** Numerator includes inactive students, denominator uses active students
- Monthly Reports %: reports(all) / activeStudents → can exceed 100%
- Faculty Visits %: visits(all) / activeStudents → can exceed 100%
- Joining Letters %: letters(all) / activeStudents → can exceed 100%

## Files Requiring Updates

### Backend Files (Add `student.isActive: true` filter)
1. `backend/src/api/principal/principal.service.ts`
   - Line 78-79, 106-113 (internship counts)
2. `backend/src/api/faculty/faculty.service.ts`
   - Line 240-249 (active internships)
   - Line 261-270 (monthly reports)
   - Line 272-280 (faculty visits)
   - Line 376-475 (assigned students query)
3. `backend/src/api/state/services/state-dashboard.service.ts`
   - Line 106-113 (internship counts)
   - Line 150-180 (visit counts)
   - Line 190-220 (report counts)
4. `backend/src/api/state/services/state-institution.service.ts`
   - Line 644-648 (self-identified)
   - Line 660-690 (joining letters)
   - Line 700-730 (monthly reports)
   - Line 740-770 (faculty visits)

### Frontend Files (Show active/inactive breakdown)
1. `frontend/src/features/faculty/dashboard/components/StatisticsGrid.jsx`
   - Add active vs total student breakdown
2. `frontend/src/features/state/dashboard/components/InstituteDetailView.jsx`
   - OverviewTab needs student status breakdown

## 5. Company View Discrepancies

### Critical Issues
- **NO isActive filter** on student counts per company
- Self-identified companies use `applicationCount` (NOT deduplicated by student)
- Regular industries use deduplicated `studentCount`

### Affected Endpoints
- `GET /state/companies` - state-industry.service.ts:268-612
- `GET /state/institutions/:id/companies` - state-institution.service.ts:1410-1649
- `GET /principal/:id/internship-stats` - principal.service.ts:2847-2968

### Specific Locations
```
state-industry.service.ts
  Line 318-342: No isActive filter on student selection
  Line 363-375: No isActive filter on self-identified apps
  Line 587: Uses totalApplications for self-identified (duplicates!)

state-institution.service.ts
  Line 1459-1475: No isActive filter on applications
  Line 1611: applicationCount vs studentCount mismatch

principal.service.ts
  Line 2870-2874: No isActive filter on self-identified applications
```

## 6. Monthly Report Discrepancies

### Expected Count Issues
- **4 different methods** to calculate "expected" reports
- `monthly-cycle.util.ts` not consistently applied
- Frontend uses simple student count, backend uses complex date logic

### Status Definition Mismatches
| View | SUBMITTED | DRAFT | Behavior |
|------|-----------|-------|----------|
| Faculty Dashboard | NOT counted | Counted as pending | Inconsistent |
| Faculty Page | Counted as submitted | Counted as draft | Different |
| Principal | ALL counted together | - | No separation |

### Affected Endpoints
- `principal.service.ts:100-104` - Counts ALL time (no month filter!) ❌
- `state-reports.service.ts:172-186` - No isActive filter
- `faculty.service.ts:261-270` - No isActive filter

### Specific Issues
```
principal.service.ts:100-104
  WHERE status = 'SUBMITTED'
  Missing: reportMonth, reportYear filters
  Missing: student.isActive filter

faculty.service.ts:240-249
  Active internships count missing student.isActive

MonthlyReportsCard.jsx:92-109
  Filters DRAFT reports but ignores SUBMITTED/UNDER_REVIEW
```

## 7. Faculty Visit Log Discrepancies

### Critical Filtering Issues
- **NO isActive filter** on students when counting visits
- Visit status field NOT used consistently
- Expected calculation uses `getExpectedVisitsAsOfToday()` but queries don't

### Affected Endpoints
- `principal.service.ts:2348-2353` - getFacultyReportsForDashboard (no filter)
- `state-institution.service.ts:297-315` - Visit count query (no filter)
- `state-institution.service.ts:351-367` - Internship training query (no filter)

### Visit Status Inconsistency
```
Frontend: Filters by status (COMPLETED, DRAFT, SCHEDULED)
Backend: Ignores status, just counts by date range
State: Assumes all visits in date range are "completed"
```

### Specific Locations
```
principal.service.ts:2348-2353
  WHERE application.student.institutionId
  Missing: student.isActive filter

state-institution.service.ts:297-315
  visitDate between month range
  Missing: student.isActive
  Missing: status = 'COMPLETED' check

faculty-visit.service.ts:520-543
  No filtering by isActive at all
```

## 8. Joining Letter Discrepancies

### Total Expected Definition Varies
- **Principal**: ALL self-identified applications (no status filter)
- **Faculty**: APPROVED/JOINED applications only
- **State**: ALL self-identified applications

### Verification Status Inconsistency
```
Principal uses: hasJoined + reviewedBy fields
Faculty uses: reviewedAt + reviewRemarks fields
```

### Affected Endpoints
- `principal.service.ts:4407-4470` - getJoiningLetterStats
- `faculty.service.ts:1926-2014, 299-320` - getJoiningLetters
- `state-dashboard.service.ts:105-113` - No isActive filter

### Specific Issues
```
principal.service.ts:4439-4450
  if (hasJoined) → verified
  else if (reviewedBy) → rejected

faculty.service.ts:303-305
  if (reviewedAt && !contains('reject')) → verified
  if (reviewedAt && contains('reject')) → rejected

Different logic = different counts!
```

## 9. Student List View Discrepancies

### Faculty Dashboard vs List Mismatch
- Dashboard counts UNIQUE students with active assignments
- List counts MENTOR ASSIGNMENTS (can have duplicates)
- If student has 2 mentors → dashboard shows 1, list shows 2

### Default Filter Behavior
| Role | Default Filter | Shows |
|------|---------------|-------|
| Principal | isActive: '' (empty) | ALL students |
| Faculty | mentorId + isActive: true | Only assigned |
| State | status: 'all' | ALL students |

### Specific Issues
```
faculty.service.ts:235-238
  assignedStudents = studentIds.length (UNIQUE)

faculty.service.ts:406-456
  total = mentorAssignment.count (ASSIGNMENTS, not unique)

Discrepancy if student has multiple mentors!
```

## 10. Grievance View Discrepancies

### NO isActive Filtering Applied
- **ALL grievance queries** lack `student.isActive` filter
- Inactive students' grievances still counted

### Faculty Stats Calculation Mismatch
- **Principal/State**: Uses backend `/statistics` API
- **Faculty**: Calculates stats CLIENT-SIDE from array
- Creates inconsistency in counts

### Affected Endpoints
```
grievance.service.ts:869-873
  WHERE student.institutionId
  Missing: student.isActive filter

grievance.service.ts:264-270
  getGrievancesByInstitution - no isActive

grievance.service.ts:320-330
  getGrievancesByFaculty - no isActive
```

### Status Mapping Differences
| Status | Principal Label | Faculty Label |
|--------|----------------|---------------|
| SUBMITTED, PENDING | Pending | Pending |
| REJECTED | Rejected | (Not shown) |

## 11. Application View Discrepancies

### Student Filtering Issues
- Active students: 72 (where isActive: true)
- Total applications: 85 (NO isActive check)
- **11 applications from inactive students!**

### Status Field Confusion
- Principal uses `internshipStatus` field (ONGOING, IN_PROGRESS)
- Faculty/State use `status` field (APPROVED, JOINED)
- Different fields = different counts

### Affected Endpoints
```
principal.service.ts:78-96
  Internship counts missing student.isActive filter

faculty.service.ts:240-249
  Active internships count missing student.isActive

state-dashboard.service.ts:106-113
  All application counts missing student.isActive
```

### Self-Identified Application Logic
- ALL views only count `isSelfIdentified: true`
- Platform-based internships excluded everywhere (intentional)

## 12. Batch/Branch Distribution Discrepancies

### Batch Count Inconsistency
- `getBatches()`: Returns ALL students (includes inactive)
- `getAnalytics()`: Returns ONLY active students
- Frontend may show different numbers

### Branch Distribution Missing isActive
```
state-institution.service.ts:934-939
  branchWiseStudents = student.groupBy({ by: ['branchName'] })
  Missing: where: { isActive: true }
```

### Affected Endpoints
```
principal.service.ts:2610-2625
  getBatches() - includes ALL students (no filter)

principal.service.ts:2732
  getAnalytics() - includes ONLY active students

state-institution.service.ts:935-939
  branchWiseStudents - no isActive filter
```

## Summary of Critical Issues

### High Priority (Data Integrity)
1. ❌ **Student.isActive NOT filtered** in 47+ endpoints
2. ❌ **Self-identified companies use applicationCount** (duplicates)
3. ❌ **Monthly reports count ALL time** (no month filter)
4. ❌ **Faculty stats calculated differently** (client vs server)
5. ❌ **Batch counts inconsistent** (active vs all)

### Medium Priority (Display Consistency)
1. ⚠️ **Different status fields** (internshipStatus vs status)
2. ⚠️ **Verification logic differs** (hasJoined vs reviewedAt)
3. ⚠️ **Expected count calculations** (4 different methods)

### Files Requiring Immediate Updates

#### Backend (Add student.isActive: true filter)
1. `backend/src/api/principal/principal.service.ts` (10+ locations)
2. `backend/src/api/faculty/faculty.service.ts` (8+ locations)
3. `backend/src/api/state/services/state-dashboard.service.ts` (15+ locations)
4. `backend/src/api/state/services/state-institution.service.ts` (20+ locations)
5. `backend/src/api/state/services/state-industry.service.ts` (5+ locations)
6. `backend/src/api/state/services/state-reports.service.ts` (3+ locations)
7. `backend/src/domain/support/grievance/grievance.service.ts` (6+ locations)

#### Frontend (Show active/inactive breakdown)
1. `frontend/src/features/faculty/dashboard/components/StatisticsGrid.jsx`
2. `frontend/src/features/state/companies/CompaniesOverview.jsx`
3. `frontend/src/features/principal/grievances/Grievances.jsx`

## Next Steps (Prioritized)

### Phase 1: Critical Data Integrity (Week 1)
- [ ] Add `student.isActive: true` to ALL student-related queries
- [ ] Fix monthly report month filtering in Principal
- [ ] Standardize self-identified company counting (use deduplicated studentCount)

### Phase 2: Status Field Standardization (Week 2)
- [ ] Align internshipStatus vs status field usage
- [ ] Standardize joining letter verification logic
- [ ] Fix expected count calculations (use monthly-cycle utility)

### Phase 3: Frontend Display Updates (Week 3)
- [ ] Add student breakdown displays (active vs total)
- [ ] Update Faculty stats to use backend API
- [ ] Add discrepancy explanations to UI

### Phase 4: Testing & Validation (Week 4)
- [ ] Add integration tests for count endpoints
- [ ] Verify percentage calculations
- [ ] Document expected behavior

---
Last Updated: 2026-01-02
Status: COMPLETE - All areas verified. 47+ endpoints need isActive filter!
