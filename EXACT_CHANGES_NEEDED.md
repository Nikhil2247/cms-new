# Exact Code Changes Required - Line by Line

This document provides the exact locations and code snippets for every change needed to align internship status field usage.

---

## File 1: Principal Service
**Path:** `/backend/src/api/principal/principal.service.ts`
**Total Changes:** 16

### Change 1.1 - Line 92: Dashboard ongoing count filter
**Current Code (Lines 86-94):**
```typescript
// Count ongoing self-identified internships (auto-approved, in progress)
this.prisma.internshipApplication.count({
  where: {
    student: { institutionId, isActive: true },
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,
    internshipStatus: { in: ['ONGOING', 'IN_PROGRESS'] },  // ← CHANGE THIS
  }
})
```

**New Code:**
```typescript
// Count ongoing self-identified internships (auto-approved, in progress)
this.prisma.internshipApplication.count({
  where: {
    student: { institutionId, isActive: true },
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,
    internshipPhase: InternshipPhase.ONGOING,  // ← CHANGED
  }
})
```

**Changes:**
- Replace `internshipStatus: { in: ['ONGOING', 'IN_PROGRESS'] }` with `internshipPhase: InternshipPhase.ONGOING`
- Remove the array and use single enum value

---

### Change 1.2 - Line 437: Mentor assignment update
**Current Code (Lines 430-440):**
```typescript
const updated = await this.prisma.internshipApplication.update({
  where: { id: applicationId },
  data: {
    mentorId,
    mentorAssignedAt: new Date(),
    mentorAssignedBy: principalId,
    status: ApplicationStatus.APPROVED,
    internshipStatus: 'ONGOING',  // ← CHANGE THIS
    remarks: dto.remarks || null,
  },
});
```

**New Code:**
```typescript
const updated = await this.prisma.internshipApplication.update({
  where: { id: applicationId },
  data: {
    mentorId,
    mentorAssignedAt: new Date(),
    mentorAssignedBy: principalId,
    status: ApplicationStatus.APPROVED,
    internshipPhase: InternshipPhase.ONGOING,  // ← CHANGED
    remarks: dto.remarks || null,
  },
});
```

**Changes:**
- Replace string literal `'ONGOING'` with enum `InternshipPhase.ONGOING`

---

### Change 1.3 - Lines 612-615: Status check logic
**Current Code:**
```typescript
// First check internshipStatus field (ONGOING, COMPLETED) for self-identified internships
if (application.internshipStatus === 'COMPLETED') {
  // Completed
  completed++;
} else if (application.internshipStatus === 'ONGOING') {
  // In Progress
  inProgress++;
}
```

**New Code:**
```typescript
// First check internshipPhase field
if (application.internshipPhase === InternshipPhase.COMPLETED) {
  // Completed
  completed++;
} else if (application.internshipPhase === InternshipPhase.ONGOING) {
  // In Progress
  inProgress++;
} else if (application.internshipPhase === InternshipPhase.PENDING) {
  // Not started
  pending++;
}
```

**Changes:**
- Replace string comparisons with enum comparisons
- Update comment to reflect new field name
- Add handling for PENDING state

---

### Change 1.4 - Lines 846-870: Complex status categorization
**Current Code (BEFORE):**
```typescript
// In Progress: APPROVED, JOINED, or SELECTED status OR internshipStatus is ONGOING
if ([ApplicationStatus.APPROVED, ApplicationStatus.JOINED, ApplicationStatus.SELECTED]
      .includes(application.status) || application.internshipStatus === 'ONGOING') {
  inProgress++;
}

// Completed: COMPLETED status or internshipStatus is COMPLETED
if (application.status === ApplicationStatus.COMPLETED ||
    application.internshipStatus === 'COMPLETED') {
  completed++;
}
```

**New Code (AFTER):**
```typescript
// In Progress: Check both status and internshipPhase
if ([ApplicationStatus.APPROVED, ApplicationStatus.JOINED, ApplicationStatus.SELECTED]
      .includes(application.status) &&
    application.internshipPhase === InternshipPhase.ONGOING) {
  inProgress++;
}

// Completed: Check both status and internshipPhase
if (application.status === ApplicationStatus.COMPLETED &&
    application.internshipPhase === InternshipPhase.COMPLETED) {
  completed++;
}
```

**Changes:**
- Change `||` (OR) to `&&` (AND) to require both conditions
- Replace string literal with enum
- Simplify logic for consistency

---

### Change 1.5 - Line 855: Filter with string literal
**Current Code (Lines 850-860):**
```typescript
// Some filter query that uses internshipStatus
const results = await this.prisma.internshipApplication.findMany({
  where: {
    isSelfIdentified: true,
    internshipStatus: 'ONGOING',  // ← CHANGE THIS
  },
});
```

**New Code:**
```typescript
const results = await this.prisma.internshipApplication.findMany({
  where: {
    isSelfIdentified: true,
    internshipPhase: InternshipPhase.ONGOING,  // ← CHANGED
  },
});
```

**Changes:**
- Replace string literal with enum value

---

### Change 1.6 - Lines 3845, 4038, 4048, 4183, 4202, 4219: Multiple updates setting ONGOING

**Pattern for all 6 occurrences:**

**Current Pattern:**
```typescript
await this.prisma.internshipApplication.update({
  where: { id },
  data: {
    // ... other fields ...
    internshipStatus: 'ONGOING',  // ← CHANGE THIS (appears 6 times)
  },
});
```

**New Pattern:**
```typescript
await this.prisma.internshipApplication.update({
  where: { id },
  data: {
    // ... other fields ...
    internshipPhase: InternshipPhase.ONGOING,  // ← CHANGED
  },
});
```

**Locations:**
- Line 3845
- Line 4038
- Line 4048
- Line 4183
- Line 4202
- Line 4219

**Changes for each:**
- Replace `internshipStatus: 'ONGOING'` with `internshipPhase: InternshipPhase.ONGOING`

---

### Change 1.7 - Line 4281: Filter for ONGOING internships

**Current Code (Around line 4281):**
```typescript
const count = await this.prisma.internshipApplication.count({
  where: {
    isSelfIdentified: true,
    internshipStatus: 'ONGOING',  // ← CHANGE THIS
  },
});
```

**New Code:**
```typescript
const count = await this.prisma.internshipApplication.count({
  where: {
    isSelfIdentified: true,
    internshipPhase: InternshipPhase.ONGOING,  // ← CHANGED
  },
});
```

**Changes:**
- Replace string literal with enum value

---

## File 2: Student Service
**Path:** `/backend/src/api/student-portal/student.service.ts`
**Total Changes:** 2

### Change 2.1 - Line 256: Filter by internshipStatus
**Current Code:**
```typescript
// Some filter
where: {
  OR: [
    { internshipStatus: 'ONGOING' },  // ← CHANGE THIS
    // ... other conditions ...
  ],
}
```

**New Code:**
```typescript
where: {
  OR: [
    { internshipPhase: InternshipPhase.ONGOING },  // ← CHANGED
    // ... other conditions ...
  ],
}
```

**Changes:**
- Replace string literal with enum value

---

### Change 2.2 - Line 1217: Create self-identified internship
**Current Code (Lines 1212-1224):**
```typescript
const application = await this.prisma.internshipApplication.create({
  data: {
    studentId,
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,
    internshipStatus: 'ONGOING',  // ← CHANGE THIS
    reviewedAt: new Date(),
    reviewedBy: hasJoiningLetter ? 'SYSTEM' : null,
    hasJoined: hasJoiningLetter,
    joiningLetterUploadedAt: hasJoiningLetter ? new Date() : null,
    ...selfIdentifiedDto,
  },
});
```

**New Code:**
```typescript
const application = await this.prisma.internshipApplication.create({
  data: {
    studentId,
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,
    internshipPhase: InternshipPhase.ONGOING,  // ← CHANGED
    reviewedAt: new Date(),
    reviewedBy: hasJoiningLetter ? 'SYSTEM' : null,
    hasJoined: hasJoiningLetter,
    joiningLetterUploadedAt: hasJoiningLetter ? new Date() : null,
    ...selfIdentifiedDto,
  },
});
```

**Changes:**
- Replace string literal with enum value

---

## File 3: Self-Identified Service
**Path:** `/backend/src/domain/internship/self-identified/self-identified.service.ts`
**Total Changes:** 1

### Change 3.1 - Line 83: Auto-approve internship with status
**Current Code (Lines 80-90):**
```typescript
const newApplication = await this.prisma.internshipApplication.create({
  data: {
    studentId,
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,
    internshipStatus: 'ONGOING', // Set internship as ongoing  // ← CHANGE THIS
    mentorId: null,
    remarks: 'Auto-approved self-identified internship',
    // ... other fields ...
  },
});
```

**New Code:**
```typescript
const newApplication = await this.prisma.internshipApplication.create({
  data: {
    studentId,
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,
    internshipPhase: InternshipPhase.ONGOING, // Set internship as ongoing  // ← CHANGED
    mentorId: null,
    remarks: 'Auto-approved self-identified internship',
    // ... other fields ...
  },
});
```

**Changes:**
- Replace string literal with enum value
- Update comment if needed

---

## File 4: State Industry Service
**Path:** `/backend/src/api/state/services/state-industry.service.ts`
**Total Changes:** 2

### Change 4.1 - Line 292: Filter for self-identified internships
**Current Code:**
```typescript
const applications = await this.prisma.internshipApplication.findMany({
  where: {
    OR: [
      { internshipStatus: 'SELF_IDENTIFIED' },  // ← CHANGE THIS
      // ... other conditions ...
    ],
  },
});
```

**New Code:**
```typescript
const applications = await this.prisma.internshipApplication.findMany({
  where: {
    OR: [
      { isSelfIdentified: true },  // ← CHANGED (use correct field)
      // ... other conditions ...
    ],
  },
});
```

**Changes:**
- Replace `internshipStatus: 'SELF_IDENTIFIED'` with `isSelfIdentified: true`
- This uses the correct boolean field for source identification

---

### Change 4.2 - Line 629: Another filter for self-identified
**Current Code:**
```typescript
const count = await this.prisma.internshipApplication.count({
  where: {
    OR: [
      { internshipStatus: 'SELF_IDENTIFIED' },  // ← CHANGE THIS
      // ... other conditions ...
    ],
  },
});
```

**New Code:**
```typescript
const count = await this.prisma.internshipApplication.count({
  where: {
    OR: [
      { isSelfIdentified: true },  // ← CHANGED (use correct field)
      // ... other conditions ...
    ],
  },
});
```

**Changes:**
- Replace `internshipStatus: 'SELF_IDENTIFIED'` with `isSelfIdentified: true`

---

## File 5: State Institution Service
**Path:** `/backend/src/api/state/services/state-institution.service.ts`
**Total Changes:** 1

### Change 5.1 - Line 1438: Filter for self-identified internships
**Current Code:**
```typescript
const result = await this.prisma.internshipApplication.findMany({
  where: {
    OR: [
      { internshipStatus: 'SELF_IDENTIFIED' },  // ← CHANGE THIS
      // ... other conditions ...
    ],
  },
});
```

**New Code:**
```typescript
const result = await this.prisma.internshipApplication.findMany({
  where: {
    OR: [
      { isSelfIdentified: true },  // ← CHANGED (use correct field)
      // ... other conditions ...
    ],
  },
});
```

**Changes:**
- Replace `internshipStatus: 'SELF_IDENTIFIED'` with `isSelfIdentified: true`

---

## File 6: Bulk Self-Internship Service
**Path:** `/backend/src/bulk/bulk-self-internship/bulk-self-internship.service.ts`
**Total Changes:** 1

### Change 6.1 - Line 408: Bulk create operation
**Current Code:**
```typescript
const application = await this.prisma.internshipApplication.create({
  data: {
    studentId,
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,
    internshipStatus: 'SELF_IDENTIFIED',  // ← CHANGE THIS (wrong meaning)
    // ... other fields ...
  },
});
```

**New Code:**
```typescript
const application = await this.prisma.internshipApplication.create({
  data: {
    studentId,
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,
    internshipPhase: InternshipPhase.ONGOING,  // ← CHANGED (correct field and value)
    // ... other fields ...
  },
});
```

**Changes:**
- Replace `internshipStatus: 'SELF_IDENTIFIED'` with `internshipPhase: InternshipPhase.ONGOING`
- Note: 'SELF_IDENTIFIED' is not a phase, it's a source, so this should use internshipPhase with ONGOING

---

## File 7: Prisma Schema
**Path:** `/backend/prisma/schema.prisma`
**Total Changes:** 2

### Change 7.1 - Add new InternshipPhase enum (after ApplicationStatus enum)
**Location:** After line 1882

**Add this new enum:**
```prisma
enum InternshipPhase {
  PENDING      // Before joining
  ONGOING      // Active internship
  COMPLETED    // Internship finished
  CANCELLED    // Not completed
}
```

**Placement:** Should be added right after the ApplicationStatus enum definition

---

### Change 7.2 - Add internshipPhase field to InternshipApplication model
**Location:** Around line 1180 (near internshipStatus field)

**Current Code (Lines 1180-1181):**
```prisma
internshipStatus String? // SELF_IDENTIFIED or OFFERED_BY_COLLEGE
```

**New Code:**
```prisma
// Deprecated: Use internshipPhase instead
internshipStatus String? // SELF_IDENTIFIED or OFFERED_BY_COLLEGE

// Track internship lifecycle phase
internshipPhase InternshipPhase?

// Index for performance
@@index([internshipPhase])
```

**Changes:**
- Add the new `internshipPhase` field with `InternshipPhase` type
- Mark `internshipStatus` as deprecated in comment
- Add database index on the new field

---

## Import Statements to Update

### In Principal Service (principal.service.ts)
**Add to imports at top of file:**
```typescript
// After existing imports from @prisma/client
import { ApplicationStatus, InternshipPhase, Role, ... } from '../../generated/prisma/client';
```

**Check if InternshipPhase is already imported from Prisma client. If not, add it.**

### In Student Service (student.service.ts)
**Add to imports at top of file:**
```typescript
import { ApplicationStatus, InternshipPhase, Role, ... } from '../../generated/prisma/client';
```

### In Self-Identified Service (self-identified.service.ts)
**Add to imports at top of file:**
```typescript
import { ApplicationStatus, InternshipPhase, Role, ... } from '../../generated/prisma/client';
```

### In Bulk Service (bulk-self-internship.service.ts)
**Add to imports at top of file:**
```typescript
import { ApplicationStatus, InternshipPhase, Role, ... } from '../../generated/prisma/client';
```

---

## Summary Table

| File | Line(s) | Current | New | Type |
|------|---------|---------|-----|------|
| principal.service.ts | 92 | `internshipStatus: { in: ['ONGOING', 'IN_PROGRESS'] }` | `internshipPhase: InternshipPhase.ONGOING` | Query |
| principal.service.ts | 437 | `internshipStatus: 'ONGOING'` | `internshipPhase: InternshipPhase.ONGOING` | Update |
| principal.service.ts | 612-615 | String comparisons | Enum comparisons | Logic |
| principal.service.ts | 846-870 | Mixed string/status logic | Enum logic | Logic |
| principal.service.ts | 855 | `internshipStatus: 'ONGOING'` | `internshipPhase: InternshipPhase.ONGOING` | Query |
| principal.service.ts | 3845 | `internshipStatus: 'ONGOING'` | `internshipPhase: InternshipPhase.ONGOING` | Update |
| principal.service.ts | 4038 | `internshipStatus: 'ONGOING'` | `internshipPhase: InternshipPhase.ONGOING` | Update |
| principal.service.ts | 4048 | `internshipStatus: 'ONGOING'` | `internshipPhase: InternshipPhase.ONGOING` | Update |
| principal.service.ts | 4183 | `internshipStatus: 'ONGOING'` | `internshipPhase: InternshipPhase.ONGOING` | Update |
| principal.service.ts | 4202 | `internshipStatus: 'ONGOING'` | `internshipPhase: InternshipPhase.ONGOING` | Update |
| principal.service.ts | 4219 | `internshipStatus: 'ONGOING'` | `internshipPhase: InternshipPhase.ONGOING` | Update |
| principal.service.ts | 4281 | `internshipStatus: 'ONGOING'` | `internshipPhase: InternshipPhase.ONGOING` | Query |
| student.service.ts | 256 | `internshipStatus: 'ONGOING'` | `internshipPhase: InternshipPhase.ONGOING` | Query |
| student.service.ts | 1217 | `internshipStatus: 'ONGOING'` | `internshipPhase: InternshipPhase.ONGOING` | Create |
| self-identified.service.ts | 83 | `internshipStatus: 'ONGOING'` | `internshipPhase: InternshipPhase.ONGOING` | Create |
| state-industry.service.ts | 292 | `internshipStatus: 'SELF_IDENTIFIED'` | `isSelfIdentified: true` | Query |
| state-industry.service.ts | 629 | `internshipStatus: 'SELF_IDENTIFIED'` | `isSelfIdentified: true` | Query |
| state-institution.service.ts | 1438 | `internshipStatus: 'SELF_IDENTIFIED'` | `isSelfIdentified: true` | Query |
| bulk-self-internship.service.ts | 408 | `internshipStatus: 'SELF_IDENTIFIED'` | `internshipPhase: InternshipPhase.ONGOING` | Create |
| schema.prisma | +N/A | (add new) | InternshipPhase enum | Schema |
| schema.prisma | 1180+ | (add new) | internshipPhase field | Schema |

---

## Total Changes: 24

- **String literals to enum values:** 19 changes
- **String comparisons to enum comparisons:** 2 changes (612-615, 846-870)
- **Wrong field usage (internshipStatus → isSelfIdentified):** 3 changes
- **Schema additions:** 2 changes
- **Import statements:** 4 files to update

---

## Verification Checklist After Changes

- [ ] All `internshipStatus` string literals replaced with `internshipPhase` enum values
- [ ] All string comparisons (`=== 'ONGOING'`) replaced with enum comparisons
- [ ] All `internshipStatus: 'SELF_IDENTIFIED'` replaced with `isSelfIdentified: true`
- [ ] All 4 services importing `InternshipPhase` enum
- [ ] Prisma schema has `InternshipPhase` enum defined
- [ ] Prisma schema has `internshipPhase` field added to InternshipApplication
- [ ] Database migration created and tested
- [ ] All tests passing
- [ ] No TypeScript compilation errors

