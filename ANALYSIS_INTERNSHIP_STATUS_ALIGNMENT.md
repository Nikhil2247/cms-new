# Internship Status Field Alignment Analysis

**Date:** January 2, 2026
**Status:** Analysis Complete - Ready for Implementation Planning

---

## Executive Summary

There is a **critical field naming inconsistency** in the `InternshipApplication` model across services. The Prisma schema defines two separate fields serving different purposes:

1. **`status` (ApplicationStatus enum)** - Tracks the application lifecycle (APPLIED, APPROVED, JOINED, COMPLETED, etc.)
2. **`internshipStatus` (String field)** - Tracks the internship phase (ONGOING, COMPLETED, SELF_IDENTIFIED, IN_PROGRESS)

**Current Problem:** Different services are using these fields inconsistently:
- **Principal Service**: Uses BOTH `status` (ApplicationStatus.APPROVED) AND `internshipStatus` (ONGOING/IN_PROGRESS)
- **Faculty Service**: Uses ONLY `status` (ApplicationStatus.APPROVED, ApplicationStatus.JOINED)
- **State Dashboard Service**: Uses ONLY `status` (ApplicationStatus.APPROVED)
- **Student Service**: Uses BOTH fields interchangeably

This creates confusion and makes it difficult to query and filter internship applications consistently.

---

## Detailed Schema Analysis

### InternshipApplication Model Definition

**Location:** `/backend/prisma/schema.prisma` (lines 1132-1240)

#### Field 1: `status`
```prisma
status       ApplicationStatus @default(APPLIED)
```
- **Type:** Enum (ApplicationStatus)
- **Purpose:** Tracks the APPLICATION lifecycle
- **Valid Values:** APPLIED, UNDER_REVIEW, SHORTLISTED, SELECTED, REJECTED, APPROVED, JOINED, COMPLETED, WITHDRAWN
- **Database Index:** Yes (indexed on status alone and in composite indexes)
- **Use Case:** Determines eligibility for monthly reports, faculty visits, and general workflow

#### Field 2: `internshipStatus`
```prisma
internshipStatus String? // SELF_IDENTIFIED or OFFERED_BY_COLLEGE
```
- **Type:** String (untyped)
- **Purpose:** Indicates the SOURCE and PHASE of the internship
- **Current Values Found:**
  - `'ONGOING'` - Internship is currently active
  - `'IN_PROGRESS'` - Same as ONGOING (redundant)
  - `'COMPLETED'` - Internship has ended
  - `'SELF_IDENTIFIED'` - Student identified the internship themselves
  - `'OFFERED_BY_COLLEGE'` - (Defined in schema comment but not used in code)
- **Database Index:** No indexes on this field
- **Use Case:** Distinguishes self-identified vs. college-offered internships and tracks phase

---

## Current Usage Patterns by Service

### 1. Principal Service (`principal.service.ts`)
**Status:** INCONSISTENT - Uses BOTH fields

**File Path:** `/backend/src/api/principal/principal.service.ts`

**Problematic Pattern (Lines 86-94):**
```typescript
// Count ongoing self-identified internships (auto-approved, in progress)
this.prisma.internshipApplication.count({
  where: {
    student: { institutionId, isActive: true },
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,
    internshipStatus: { in: ['ONGOING', 'IN_PROGRESS'] },  // ❌ Uses string literals
  }
})
```

**Additional Patterns:**
- Line 437: Sets `internshipStatus: 'ONGOING'`
- Line 612-615: Checks `application.internshipStatus === 'COMPLETED'` vs `'ONGOING'`
- Line 846-870: Complex logic mixing `status` field with `internshipStatus` checks
- Line 855: Filters with `{ internshipStatus: 'ONGOING' }`
- Lines 3845, 4038, 4048, 4183, 4202, 4219, 4281: Multiple updates setting `internshipStatus: 'ONGOING'`

**Issues:**
- Using string literals directly without type safety
- No clear separation between application status and internship phase
- Redundant checks for ONGOING vs IN_PROGRESS
- Mixes two different concerns in filter logic

### 2. Faculty Service (`faculty.service.ts`)
**Status:** CONSISTENT - Uses only `status` field

**File Path:** `/backend/src/api/faculty/faculty.service.ts`

**Consistent Pattern (Lines 240-250):**
```typescript
this.prisma.internshipApplication.count({
  where: {
    studentId: { in: studentIds },
    student: { isActive: true },
    OR: [
      { isSelfIdentified: true },
      { internshipId: null },
    ],
    status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED] },  // ✓ Uses enum
  },
})
```

**Pattern Used:**
- Only uses `status` field with ApplicationStatus enum
- Relies on `isSelfIdentified` boolean to distinguish internship sources
- Does NOT use `internshipStatus` field at all

**Strength:**
- Type-safe enum usage
- Clear intent: checking application state, not internship phase

### 3. State Dashboard Service (`state-dashboard.service.ts`)
**Status:** CONSISTENT - Uses only `status` field

**File Path:** `/backend/src/api/state/services/state-dashboard.service.ts`

**Consistent Pattern (Line 115, 129, etc.):**
```typescript
this.prisma.internshipApplication.count({
  where: {
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,  // ✓ Uses enum
    student: { isActive: true },
  },
})
```

**Pattern Used:**
- Consistently uses `status` field with ApplicationStatus enum
- Multiple occurrences (lines: 115, 129, 157, 261, 443, 461, 637, 762, 779, 955, 1010, 1102)
- Does NOT use `internshipStatus` field at all

**Strength:**
- Uniform enum usage across all queries
- No string literals or type confusion

### 4. Student Service (`student.service.ts`)
**Status:** INCONSISTENT - Uses BOTH fields

**File Path:** `/backend/src/api/student-portal/student.service.ts`

**Problematic Pattern (Lines 1216-1217):**
```typescript
const application = await this.prisma.internshipApplication.create({
  data: {
    studentId,
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,
    internshipStatus: 'ONGOING',  // ❌ Direct string assignment
    ...
  },
});
```

**Additional Patterns:**
- Line 256: Filter with `{ internshipStatus: 'ONGOING' }`
- Line 1217: Create with `internshipStatus: 'ONGOING'`

### 5. Self-Identified Service (`self-identified.service.ts`)
**Status:** INCONSISTENT - Uses BOTH fields

**File Path:** `/backend/src/domain/internship/self-identified/self-identified.service.ts`

**Pattern (Line 83):**
```typescript
status: ApplicationStatus.APPROVED,
internshipStatus: 'ONGOING', // Set internship as ongoing
```

### 6. State Industry Service (`state-industry.service.ts`)
**Status:** USES `internshipStatus` for SELF_IDENTIFIED check

**File Path:** `/backend/src/api/state/services/state-industry.service.ts`

**Pattern (Lines 292, 629):**
```typescript
{ internshipStatus: 'SELF_IDENTIFIED' }
```

**Issue:** Uses `internshipStatus` to identify self-identified internships, but:
- The `isSelfIdentified` boolean field already exists in the schema (line 1171)
- Using string comparison is redundant and error-prone

---

## Schema Design Issues

### Issue #1: Conflicting Field Purposes
The `internshipStatus` field mixes two concerns:
1. **Source identification:** SELF_IDENTIFIED vs OFFERED_BY_COLLEGE
2. **Phase tracking:** ONGOING vs COMPLETED vs IN_PROGRESS

**Better approach:** Separate these into:
- `isSelfIdentified` (Boolean) - Already exists! (line 1171)
- `internshipPhase` (Enum) - Should be: PENDING, ONGOING, COMPLETED, CANCELLED

### Issue #2: Type Safety
- `internshipStatus` is typed as `String?` with no validation
- No enum exists to enforce valid values
- String literals scattered across codebase make refactoring dangerous

### Issue #3: Redundant State
- Both `status: APPROVED` and `internshipStatus: ONGOING` represent similar information
- Creates data consistency challenges
- Makes queries complex and error-prone

### Issue #4: Missing Indexes
- `internshipStatus` field has no database indexes
- Queries filtering on this field may be slow
- Should either index it or eliminate the need to filter by it

---

## Enum Reference

### ApplicationStatus (Correct - Defined in schema)
```prisma
enum ApplicationStatus {
  APPROVED       // Application approved
  APPLIED        // Initial submission
  UNDER_REVIEW   // Being reviewed
  SHORTLISTED    // Shortlisted for selection
  SELECTED       // Selected for internship
  REJECTED       // Application rejected
  JOINED         // Student has joined
  COMPLETED      // Internship completed
  WITHDRAWN      // Application withdrawn
}
```

### InternshipStatus (For Internship Postings - Not ApplicationStatus)
```prisma
enum InternshipStatus {
  ACTIVE         // Internship posting is active
  INACTIVE       // Internship posting inactive
  COMPLETED      // Internship posting completed
  CANCELLED      // Internship posting cancelled
}
```
**Note:** This is for the `Internship` model, NOT `InternshipApplication`

---

## Complete File Inventory

### Files Using `internshipStatus` Field

1. **backend/src/api/principal/principal.service.ts** (16 occurrences)
   - Lines: 92, 437, 612, 613, 615, 846, 855, 861, 870, 3845, 4038, 4048, 4183, 4202, 4219, 4281

2. **backend/src/api/student-portal/student.service.ts** (2 occurrences)
   - Lines: 256, 1217

3. **backend/src/domain/internship/self-identified/self-identified.service.ts** (1 occurrence)
   - Line: 83

4. **backend/src/bulk/bulk-self-internship/bulk-self-internship.service.ts** (1 occurrence)
   - Line: 408

5. **backend/src/api/state/services/state-industry.service.ts** (2 occurrences)
   - Lines: 292, 629

6. **backend/src/api/state/services/state-institution.service.ts** (1 occurrence)
   - Line: 1438

7. **Generated Files (Auto-generated - DO NOT EDIT)**
   - backend/src/generated/prisma/internal/class.ts
   - backend/src/generated/prisma/internal/prismaNamespace.ts
   - backend/src/generated/prisma/internal/prismaNamespaceBrowser.ts
   - backend/src/generated/prisma/models/InternshipApplication.ts

### Files Using ONLY `status` Field

1. **backend/src/api/faculty/faculty.service.ts**
   - Pattern: `status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED] }`

2. **backend/src/api/state/services/state-dashboard.service.ts** (12 occurrences)
   - Lines: 115, 129, 157, 261, 443, 461, 637, 762, 779, 955, 1010, 1102
   - Pattern: `status: ApplicationStatus.APPROVED`

3. **backend/src/api/state/services/state-reports.service.ts** (Multiple occurrences)
   - Uses `status: ApplicationStatus.APPROVED` throughout

4. **backend/src/api/industry-portal/industry.service.ts**
   - Uses `status: ApplicationStatus.JOINED`

---

## Recommendations for Alignment

### Recommended Approach: Keep `status` Field Only (Simplest)

**Rationale:**
1. `status` field is already an enum with type safety
2. Faculty and State services already follow this pattern successfully
3. `isSelfIdentified` boolean already distinguishes internship sources
4. Reduces complexity and removes redundancy

**Migration Steps:**
1. Create an enum `InternshipPhase` for tracking ONGOING/COMPLETED:
   ```prisma
   enum InternshipPhase {
     PENDING          // Before joining
     ONGOING          // Active internship
     COMPLETED        // Finished
     CANCELLED        // Not completed
   }
   ```

2. Replace `internshipStatus` field with `internshipPhase`:
   ```prisma
   // OLD:
   internshipStatus String?

   // NEW:
   internshipPhase InternshipPhase? @default(PENDING)
   ```

3. Update logic in Principal Service:
   - OLD: `status: APPROVED AND internshipStatus: ONGOING`
   - NEW: `status: APPROVED AND internshipPhase: ONGOING`
   - BETTER: `status: JOINED AND internshipPhase: ONGOING` (since JOINED implies active)

4. Consolidate StatusCheck Logic:
   - ApplicationStatus.APPROVED + ONGOING → ApplicationStatus.JOINED status
   - ApplicationStatus.APPROVED + COMPLETED → ApplicationStatus.COMPLETED status
   - Reduces dual-field dependency

### Alternative Approach: Separate Concerns (More Robust)

If you want to keep both fields but with clear separation:

1. Redefine `internshipStatus` strictly for source:
   ```prisma
   enum InternshipSource {
     OFFERED_BY_COLLEGE
     SELF_IDENTIFIED
     FACULTY_GUIDED
   }
   internshipSource InternshipSource @default(OFFERED_BY_COLLEGE)
   ```

2. Replace with proper phase tracking:
   ```prisma
   enum InternshipPhase {
     PENDING
     ONGOING
     COMPLETED
     CANCELLED
   }
   internshipPhase InternshipPhase? @default(PENDING)
   ```

3. Keep existing `isSelfIdentified` boolean for backwards compatibility during migration

---

## Data Consistency Concerns

### Current Problematic Patterns

**Pattern 1: Dual-Status Check**
```typescript
WHERE status = APPROVED AND internshipStatus IN ('ONGOING', 'IN_PROGRESS')
```
- What if status = JOINED but internshipStatus = PENDING?
- Creates ambiguity: which field is source of truth?

**Pattern 2: Redundant Values**
- ONGOING and IN_PROGRESS are used interchangeably
- Increases data corruption risk
- Makes audit trails confusing

**Pattern 3: String Literals**
```typescript
{ internshipStatus: 'ONGOING' }  // ❌ No type checking
ApplicationStatus.APPROVED       // ✓ Type-safe
```

---

## Migration Impact Analysis

### Services Requiring Changes

| Service | Current Pattern | Impact | Effort |
|---------|-----------------|--------|--------|
| Principal | Both fields | HIGH - 16 occurrences | High |
| Faculty | Status only | LOW - Already correct | Minimal |
| State Dashboard | Status only | LOW - Already correct | Minimal |
| Student Service | Both fields | MEDIUM - 2 occurrences | Low |
| Self-Identified | Both fields | MEDIUM - 1 occurrence | Low |
| State Industry | internshipStatus | MEDIUM - 2 occurrences | Low |
| State Institution | internshipStatus | LOW - 1 occurrence | Low |

### Database Migration Requirements

- **Migration Type:** Additive (add new field) → Populate → Remove old field
- **Downtime:** Requires schema update and data migration
- **Rollback:** Complex - requires dual-field support during transition
- **Testing:** Requires comprehensive test coverage on both old and new patterns

---

## Recommended Implementation Sequence

### Phase 1: Add Type Safety
1. Create `InternshipPhase` enum in schema
2. Add `internshipPhase` field (nullable initially)
3. Keep `internshipStatus` temporarily

### Phase 2: Gradual Migration
1. Update all CREATE operations to use both fields (for consistency)
2. Deploy new reads to prefer `internshipPhase`
3. Batch update existing records

### Phase 3: Cleanup
1. Remove `internshipStatus` column
2. Finalize `internshipPhase` as non-nullable
3. Update all queries to use `internshipPhase`

---

## Testing Considerations

### Test Cases Required

1. **Application Status Transitions**
   - APPLIED → APPROVED
   - APPROVED → JOINED
   - JOINED → COMPLETED
   - Verify `internshipPhase` updates correctly

2. **Self-Identified Vs. College-Offered**
   - Ensure `isSelfIdentified` boolean is source of truth
   - Verify queries using both `status` and `internshipPhase` work

3. **Query Consistency**
   - Faculty Service results match Principal Service results
   - State Dashboard matches Institution Dashboard
   - Reports show consistent numbers

4. **Backwards Compatibility**
   - Old API responses still work
   - Existing integrations don't break

---

## Summary Table: Field Usage Alignment Status

| Service | File | Current Usage | Status | Recommendation |
|---------|------|----------------|--------|-----------------|
| Principal | principal.service.ts | `status` + `internshipStatus` | ❌ Inconsistent | Use `status` + `internshipPhase` |
| Faculty | faculty.service.ts | `status` only | ✅ Correct | Keep as-is (model pattern) |
| State Dashboard | state-dashboard.service.ts | `status` only | ✅ Correct | Keep as-is (model pattern) |
| Student Service | student.service.ts | Both fields | ❌ Inconsistent | Use `status` + `internshipPhase` |
| Self-Identified | self-identified.service.ts | Both fields | ❌ Inconsistent | Use `status` + `internshipPhase` |
| State Industry | state-industry.service.ts | `internshipStatus` | ❌ Wrong field | Use `isSelfIdentified` instead |
| State Institution | state-institution.service.ts | `internshipStatus` | ❌ Wrong field | Use `isSelfIdentified` instead |

---

## Conclusion

**The Principal Service is the problematic service** and should be corrected to match the Faculty and State Dashboard services pattern of using only the `status` field with proper ApplicationStatus enum values.

However, to properly track internship lifecycle (PENDING → ONGOING → COMPLETED), a dedicated `internshipPhase` enum field should be introduced to replace the ambiguous string-based `internshipStatus` field.

**Next Steps:**
1. Approve this analysis
2. Create detailed implementation specification
3. Develop migration scripts
4. Update all affected services
5. Deploy with comprehensive testing

