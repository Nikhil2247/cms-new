# Database Changes Log

**Date:** January 3, 2026
**Database:** PostgreSQL (cms_db)
**Table Affected:** `internship_applications`

---

## Summary

| Action | Records Affected |
|--------|------------------|
| Deleted WITHDRAWN applications | 3 |
| Deleted inactive student application | 1 |
| Deleted duplicate (Khunimajra) | 1 |
| Deleted duplicate (Talwara) | 1 |
| **Total Deleted** | **6** |

**Before:** 1,304 applications
**After:** 1,298 applications

---

## Detailed Changes

### 1. Deleted WITHDRAWN Applications (3 records)

These applications were withdrawn by students and no longer needed.

| Application ID | Student | Roll No | Company | Created |
|----------------|---------|---------|---------|---------|
| `a94dfbc9-2d60-4dd1-8f9b-828c4a7282c6` | Harman Kaur | 231939008182 | Multi Skill Development Centre | Dec 24, 2025 |
| `83fc6cb6-ca7d-42cc-af8e-d4dc71cbaa4b` | Simranjeet Kaur | 231946108334 | Patiala locomotive works | Dec 26, 2025 |
| `7ff656b2-a279-4773-b28f-6231eeb07c4e` | RAJANDEEP SINGH | 230185201526 | PSPCL | Jan 1, 2026 |

**Reason:** Status = WITHDRAWN, applications were cancelled by students.

---

### 2. Deleted Inactive Student Application (1 record)

| Application ID | Student | Roll No | Company | Issue |
|----------------|---------|---------|---------|-------|
| `c858885f-7788-4296-9c5a-20f291518773` | DIVANSHU | 230226180594 | International Tractors Limited | Student.isActive = false |

**Reason:** Student account was deactivated but application remained active. Data inconsistency.

---

### 3. Deleted Duplicate - Khunimajra (1 record)

**Institution:** Governement Polytechnic College, Khunimajra
**Student:** DIYA (Roll No: 230239502917)

| # | Application ID | Company | Start Date | End Date | Created |
|---|----------------|---------|------------|----------|---------|
| 1 (KEPT) | `34d13f10-8a43-4086-94e7-e370bbc707d1` | Excellence technology | Jan 21, 2026 | Jul 21, 2026 | Dec 24, 2025 |
| 2 (DELETED) | `73b5e7a5-72d3-4a9f-bb79-ac10c63604e2` | Excellence technology | Jan 25, 2026 | Jan 25, 2026 | Jan 2, 2026 |

**Reason:**
- Same student, same company
- App 2 had invalid dates (startDate = endDate = 0 days duration)
- App 1 had valid 6-month duration

---

### 4. Deleted Duplicate - Talwara (1 record)

**Institution:** S. Amarjit Singh Sahi Government Polytechnic College, Talwara
**Student:** MANJIT KAUSHAL (Roll No: 231856183180)

| # | Application ID | Company | Created |
|---|----------------|---------|---------|
| 1 (KEPT) | `69ac0837-1393-4b03-b557-a7f32a9f5cd4` | Central Scientific Instruments Organisation (CSIO), Chandigarh | Jan 3, 2026 09:57:47 |
| 2 (DELETED) | `14936537-baaf-40c1-b1be-520b5a562d4c` | Central Scientific Instruments Organisation (CSIO), Chandigarh | Jan 3, 2026 09:57:54 |

**Reason:**
- Same student, same company, same dates
- Created 7 seconds apart (double-click submission)

---

## Code Fixes Applied

To prevent future duplicates, the following code changes were made:

### Backend (NestJS)

**File:** `backend/src/api/student-portal/student.service.ts` (lines 1236-1248)
```typescript
// Check if student already has an approved self-identified internship
const existingSelfIdentified = await this.prisma.internshipApplication.findFirst({
  where: {
    studentId,
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,
    internshipPhase: { in: [InternshipPhase.NOT_STARTED, InternshipPhase.ACTIVE] },
  },
});

if (existingSelfIdentified) {
  throw new BadRequestException('You already have an approved self-identified internship. Please edit the existing one instead of creating a new application.');
}
```

**File:** `backend/src/domain/internship/self-identified/self-identified.service.ts` (lines 47-59)
- Same check added

### Frontend (React)

**File:** `frontend/src/features/student/internships/SelfIdentifiedInternship.jsx`

1. Moved `setLoading(true)` to start of `handleSubmit`
2. Added guard clause: `if (loading) return;`
3. Added `setLoading(false)` before all early returns
4. Added `disabled={loading}` to submit button

---

## Verification Queries

### Current Application Count
```sql
SELECT COUNT(*) FROM internship_applications;
-- Result: 1298
```

### Status Distribution
```sql
SELECT status, COUNT(*)
FROM internship_applications
GROUP BY status;
-- Result: APPROVED = 1298
```

### Check for Remaining Duplicates
```sql
SELECT s."rollNumber", s.name, COUNT(ia.id) as app_count
FROM "Student" s
JOIN internship_applications ia ON s.id = ia."studentId"
GROUP BY s.id, s."rollNumber", s.name
HAVING COUNT(ia.id) > 1;
-- Result: 0 rows (no duplicates)
```

---

## Migration Notes

- Data was migrated from MongoDB (server: 144.208.66.222) to PostgreSQL (local)
- 17 records were skipped during migration (orphaned data with missing user references)
- MongoDB on server is now empty (cleared after migration)

---

**Document Created:** January 3, 2026
**Author:** Claude Code
