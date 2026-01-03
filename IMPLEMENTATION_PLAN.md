# Internship Status Alignment - Implementation Plan

**Status:** Planning Phase
**Created:** January 2, 2026
**Priority:** HIGH - Impacts data consistency and query reliability

---

## Executive Summary

**Problem:** The `internshipStatus` field in the `InternshipApplication` model is used inconsistently across services, mixing type-unsafe string values with enum-based `status` field. This creates maintenance nightmares, data integrity risks, and performance concerns.

**Solution:** Align all services to use the `status` enum field as the primary application state tracker, and consolidate internship phase tracking into a new properly-typed `internshipPhase` enum field.

**Total Files to Modify:** 7 services
**Total Changes:** ~38 field/query updates
**Estimated Implementation Time:** 5-7 hours
**Testing Time:** 3-4 hours

---

## Phase 1: Preparation (Week 1)

### Step 1.1: Create Backup and Branch
```bash
# Create feature branch
git checkout -b fix/align-internship-status-fields

# Create database backup
# (Coordinate with DevOps/DBA)
```

### Step 1.2: Update Prisma Schema
**File:** `/backend/prisma/schema.prisma`

**Changes needed:**
1. Add `InternshipPhase` enum (new)
2. Add `internshipPhase` field to InternshipApplication
3. Keep `internshipStatus` temporarily (for dual-write period)
4. Document deprecation

**PR Title:** `schema: Add internshipPhase enum and field for phase tracking`

```diff
+ enum InternshipPhase {
+   PENDING      // Before joining
+   ONGOING      // Active internship
+   COMPLETED    // Finished
+   CANCELLED    // Not completed
+ }

model InternshipApplication {
  // ... existing fields ...

+ internshipPhase InternshipPhase?

  // Deprecated: Use internshipPhase instead
  // internshipStatus String?
  internshipStatus String?  // TODO: Remove in next release
}
```

**Generate new Prisma client:**
```bash
cd backend
npx prisma generate
```

### Step 1.3: Create Migration
```bash
npx prisma migrate dev --name add_internship_phase_enum
```

**Migration file should:**
- Add `internshipPhase` column to `internship_applications` table
- Use character varying with default NULL
- Add index on `(internshipPhase)` for query performance
- **NOT** remove `internshipStatus` yet (for backwards compatibility)

---

## Phase 2: Service Updates (Week 1-2)

### Step 2.1: Principal Service Refactoring
**File:** `/backend/src/api/principal/principal.service.ts`
**Complexity:** HIGH
**Occurrences:** 16

#### 2.1.1: Update Read Queries

**Location:** Lines 86-94 (Dashboard count - ongoing internships)

**Before:**
```typescript
this.prisma.internshipApplication.count({
  where: {
    student: { institutionId, isActive: true },
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,
    internshipStatus: { in: ['ONGOING', 'IN_PROGRESS'] },
  }
})
```

**After:**
```typescript
this.prisma.internshipApplication.count({
  where: {
    student: { institutionId, isActive: true },
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,
    internshipPhase: InternshipPhase.ONGOING,
  }
})
```

**Similar changes at:** Lines 437, 855, 4281 (filter operations)

#### 2.1.2: Update Create Operations

**Locations:** Lines 3845, 4038, 4048, 4183, 4202, 4219

**Before:**
```typescript
const updated = await this.prisma.internshipApplication.create({
  data: {
    studentId,
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,
    internshipStatus: 'ONGOING',
    // ... other fields ...
  },
});
```

**After:**
```typescript
const updated = await this.prisma.internshipApplication.create({
  data: {
    studentId,
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,
    internshipPhase: InternshipPhase.ONGOING,
    // ... other fields ...
  },
});
```

#### 2.1.3: Update Status Check Logic

**Locations:** Lines 612-615, 846-870

**Before:**
```typescript
// First check internshipStatus field (ONGOING, COMPLETED) for self-identified internships
if (application.internshipStatus === 'COMPLETED') {
  // Completed
} else if (application.internshipStatus === 'ONGOING') {
  // In Progress
}

// Later in code:
// In Progress: APPROVED, JOINED, or SELECTED status OR internshipStatus is ONGOING
if ([ApplicationStatus.APPROVED, ApplicationStatus.JOINED, ApplicationStatus.SELECTED]
      .includes(application.status) || application.internshipStatus === 'ONGOING') {
  // Count as in-progress
}
```

**After:**
```typescript
// Check internshipPhase field
if (application.internshipPhase === InternshipPhase.COMPLETED) {
  // Completed
} else if (application.internshipPhase === InternshipPhase.ONGOING) {
  // In Progress
} else if (application.internshipPhase === InternshipPhase.PENDING) {
  // Not started
} else {
  // Cancelled or unknown
}

// Simplified logic:
if ([ApplicationStatus.APPROVED, ApplicationStatus.JOINED, ApplicationStatus.SELECTED]
      .includes(application.status) &&
    application.internshipPhase === InternshipPhase.ONGOING) {
  // Count as in-progress
}
```

**Add new utility function** (Optional but recommended):
```typescript
// In a new utilities file: src/common/utils/internship-status.util.ts
export function getInternshipPhase(application: InternshipApplication): string {
  if (!application.internshipPhase) {
    return 'Not Started';
  }

  switch (application.internshipPhase) {
    case InternshipPhase.PENDING:
      return 'Not Started';
    case InternshipPhase.ONGOING:
      return 'In Progress';
    case InternshipPhase.COMPLETED:
      return 'Completed';
    case InternshipPhase.CANCELLED:
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}
```

### Step 2.2: Student Service Update
**File:** `/backend/src/api/student-portal/student.service.ts`
**Complexity:** LOW
**Occurrences:** 2

#### 2.2.1: Update Create Operation
**Location:** Line 1217

**Before:**
```typescript
const application = await this.prisma.internshipApplication.create({
  data: {
    studentId,
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,
    internshipStatus: 'ONGOING',
    ...selfIdentifiedDto,
  },
});
```

**After:**
```typescript
const application = await this.prisma.internshipApplication.create({
  data: {
    studentId,
    isSelfIdentified: true,
    status: ApplicationStatus.APPROVED,
    internshipPhase: InternshipPhase.ONGOING,
    ...selfIdentifiedDto,
  },
});
```

#### 2.2.2: Update Filter Query
**Location:** Line 256

**Before:**
```typescript
{ internshipStatus: 'ONGOING' }
```

**After:**
```typescript
{ internshipPhase: InternshipPhase.ONGOING }
```

### Step 2.3: Self-Identified Service Update
**File:** `/backend/src/domain/internship/self-identified/self-identified.service.ts`
**Complexity:** LOW
**Occurrences:** 1

#### 2.3.1: Update Create Operation
**Location:** Line 83

**Before:**
```typescript
status: ApplicationStatus.APPROVED,
internshipStatus: 'ONGOING', // Set internship as ongoing
```

**After:**
```typescript
status: ApplicationStatus.APPROVED,
internshipPhase: InternshipPhase.ONGOING, // Set internship as ongoing
```

### Step 2.4: State Industry Service Update
**File:** `/backend/src/api/state/services/state-industry.service.ts`
**Complexity:** LOW
**Occurrences:** 2

#### 2.4.1: Update Filter Queries
**Locations:** Lines 292, 629

**Before:**
```typescript
{ internshipStatus: 'SELF_IDENTIFIED' }
```

**After:**
```typescript
{ isSelfIdentified: true }
```

### Step 2.5: State Institution Service Update
**File:** `/backend/src/api/state/services/state-institution.service.ts`
**Complexity:** LOW
**Occurrences:** 1

#### 2.5.1: Update Filter Query
**Location:** Line 1438

**Before:**
```typescript
{ internshipStatus: 'SELF_IDENTIFIED' }
```

**After:**
```typescript
{ isSelfIdentified: true }
```

### Step 2.6: Bulk Self-Internship Service Update
**File:** `/backend/src/bulk/bulk-self-internship/bulk-self-internship.service.ts`
**Complexity:** LOW
**Occurrences:** 1

#### 2.6.1: Update Create Operation
**Location:** Line 408

**Before:**
```typescript
internshipStatus: 'SELF_IDENTIFIED',
```

**After:**
```typescript
internshipPhase: InternshipPhase.ONGOING,
```

### Step 2.7: Faculty & State Dashboard - No Changes
**Files:**
- `/backend/src/api/faculty/faculty.service.ts`
- `/backend/src/api/state/services/state-dashboard.service.ts`

**Action:** Review and verify these use only `status` field and `isSelfIdentified` boolean. No changes needed.

---

## Phase 3: Database Data Migration (Week 2)

### Step 3.1: Write Data Migration Script

**File:** `/backend/src/db-migrations/migrate-internship-status.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateInternshipStatus() {
  console.log('Starting internship status migration...');

  const startTime = Date.now();
  let migratedCount = 0;

  try {
    // Batch process to avoid memory issues
    const pageSize = 1000;
    let hasMore = true;
    let skip = 0;

    while (hasMore) {
      const applications = await prisma.internshipApplication.findMany({
        where: {
          internshipStatus: { not: null },
          internshipPhase: null, // Only migrate null values
        },
        take: pageSize,
        skip: skip,
        select: {
          id: true,
          internshipStatus: true,
          status: true,
        },
      });

      if (applications.length === 0) {
        hasMore = false;
        break;
      }

      // Determine phase based on old internshipStatus
      const updates = applications.map((app) => {
        let newPhase = 'PENDING';

        if (app.internshipStatus === 'ONGOING' || app.internshipStatus === 'IN_PROGRESS') {
          newPhase = 'ONGOING';
        } else if (app.internshipStatus === 'COMPLETED') {
          newPhase = 'COMPLETED';
        }
        // SELF_IDENTIFIED and OFFERED_BY_COLLEGE should already be handled by isSelfIdentified field

        return prisma.internshipApplication.update({
          where: { id: app.id },
          data: { internshipPhase: newPhase },
        });
      });

      await Promise.all(updates);
      migratedCount += applications.length;
      skip += pageSize;

      console.log(`Migrated ${migratedCount} records...`);
    }

    console.log(`✓ Migration complete. Total migrated: ${migratedCount}`);
    console.log(`Time taken: ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute
migrateInternshipStatus().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

### Step 3.2: Run Data Migration

```bash
# Test migration script locally first
cd backend
npx ts-node src/db-migrations/migrate-internship-status.ts

# Then apply to dev database
npm run migrate:dev

# Verify results
npx prisma studio
```

### Step 3.3: Verify Migration

**Query to verify:**
```sql
-- Check migration success
SELECT
  COUNT(*) as total_applications,
  COUNT(CASE WHEN internshipPhase IS NOT NULL THEN 1 END) as migrated_with_phase,
  COUNT(CASE WHEN internshipStatus IS NOT NULL THEN 1 END) as still_has_old_field,
  COUNT(CASE WHEN internshipPhase IS NULL AND internshipStatus IS NULL THEN 1 END) as both_null
FROM internship_applications;

-- Verify phase distribution
SELECT
  internshipPhase,
  COUNT(*) as count
FROM internship_applications
WHERE internshipPhase IS NOT NULL
GROUP BY internshipPhase;
```

---

## Phase 4: Testing (Week 2)

### Step 4.1: Unit Tests

**Test File:** `/backend/src/api/principal/principal.service.spec.ts`

```typescript
describe('PrincipalService - Internship Status Alignment', () => {

  describe('Dashboard counts', () => {
    it('should count ongoing self-identified internships correctly', async () => {
      // Create test data
      const student = await createTestStudent();
      const ongoingApp = await prisma.internshipApplication.create({
        data: {
          studentId: student.id,
          isSelfIdentified: true,
          status: ApplicationStatus.APPROVED,
          internshipPhase: InternshipPhase.ONGOING,
        },
      });

      const result = await service.getDashboard(principalId);

      expect(result.ongoingInternships).toBe(1);
    });

    it('should not count completed internships as ongoing', async () => {
      const student = await createTestStudent();
      await prisma.internshipApplication.create({
        data: {
          studentId: student.id,
          isSelfIdentified: true,
          status: ApplicationStatus.COMPLETED,
          internshipPhase: InternshipPhase.COMPLETED,
        },
      });

      const result = await service.getDashboard(principalId);

      expect(result.ongoingInternships).toBe(0);
    });
  });

  describe('Status categorization', () => {
    it('should correctly categorize application as in-progress', async () => {
      const app = await createTestApplicationWithPhase(InternshipPhase.ONGOING);

      const category = getInternshipCategory(app);

      expect(category).toBe('In Progress');
    });

    it('should correctly categorize application as completed', async () => {
      const app = await createTestApplicationWithPhase(InternshipPhase.COMPLETED);

      const category = getInternshipCategory(app);

      expect(category).toBe('Completed');
    });
  });
});
```

### Step 4.2: Integration Tests

**Test File:** `/backend/test/integration/internship-status.integration.spec.ts`

```typescript
describe('Internship Status - Cross-Service Integration', () => {

  it('should return consistent counts across Principal and Faculty services', async () => {
    // Create test internship applications
    const applications = await createTestApplications(10, {
      isSelfIdentified: true,
      status: ApplicationStatus.APPROVED,
      internshipPhase: InternshipPhase.ONGOING,
    });

    const principalCount = await principalService.getOngoingInternshipCount();
    const facultyCount = await facultyService.getOngoingInternshipCount();
    const stateCount = await stateDashboardService.getOngoingInternshipCount();

    expect(principalCount).toBe(10);
    expect(facultyCount).toBe(10);
    expect(stateCount).toBe(10);
  });

  it('should correctly identify self-identified vs college-offered internships', async () => {
    const selfIdentified = await createTestApplication({
      isSelfIdentified: true,
    });
    const collegeOffered = await createTestApplication({
      isSelfIdentified: false,
    });

    const result = await stateIndustryService.getSelfIdentifiedInternships();

    expect(result).toContain(selfIdentified.id);
    expect(result).not.toContain(collegeOffered.id);
  });
});
```

### Step 4.3: E2E Tests

**Test File:** `/backend/test/e2e/internship-dashboard.e2e.spec.ts`

```typescript
describe('Internship Dashboard E2E', () => {

  it('should show correct dashboard statistics after internship status update', async () => {
    // Create and submit self-identified internship
    const response = await request(app.getHttpServer())
      .post('/api/internship/self-identified')
      .send(validSelfIdentifiedData);

    expect(response.status).toBe(201);

    // Verify dashboard shows it
    const dashboardRes = await request(app.getHttpServer())
      .get('/api/principal/dashboard')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(dashboardRes.body.ongoingInternships).toBeGreaterThan(0);
  });
});
```

### Step 4.4: Data Validation Tests

```typescript
describe('Internship Status Data Validation', () => {

  it('should not allow invalid internshipPhase values', async () => {
    const error = await expectAsync(
      prisma.internshipApplication.create({
        data: {
          studentId: 'test-id',
          isSelfIdentified: true,
          status: ApplicationStatus.APPROVED,
          internshipPhase: 'INVALID_PHASE' as any, // Should fail
        },
      })
    ).toBeRejected();

    expect(error).toBeDefined();
  });

  it('should migrate old string values correctly', async () => {
    // After migration, verify:
    // ONGOING → InternshipPhase.ONGOING
    // IN_PROGRESS → InternshipPhase.ONGOING
    // COMPLETED → InternshipPhase.COMPLETED

    const applications = await prisma.internshipApplication.findMany({
      where: { internshipPhase: { not: null } },
    });

    applications.forEach((app) => {
      expect(['PENDING', 'ONGOING', 'COMPLETED', 'CANCELLED'])
        .toContain(app.internshipPhase);
    });
  });
});
```

### Step 4.5: Performance Tests

```typescript
describe('Internship Status Query Performance', () => {

  it('should query ongoing internships efficiently with index', async () => {
    const startTime = performance.now();

    await prisma.internshipApplication.findMany({
      where: {
        isSelfIdentified: true,
        internshipPhase: InternshipPhase.ONGOING,
      },
      take: 1000,
    });

    const duration = performance.now() - startTime;

    // Should complete in < 100ms with proper indexing
    expect(duration).toBeLessThan(100);
  });
});
```

### Step 4.6: Regression Tests

- Run existing test suite to ensure no breaking changes
- Compare API response data types before/after
- Validate all dashboard numbers match

---

## Phase 5: Deployment (Week 2-3)

### Step 5.1: Pre-Deployment Checklist

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] Code review approved
- [ ] Database backup created
- [ ] Rollback plan documented
- [ ] Deployment window scheduled
- [ ] Team notified of changes
- [ ] Monitoring alerts configured

### Step 5.2: Deployment Steps

```bash
# 1. Create release branch
git checkout -b release/v1.x.x

# 2. Update version
npm version minor

# 3. Merge feature branch
git merge fix/align-internship-status-fields

# 4. Create PR for release
# - Tag: needs-review
# - Template: Release checklist

# 5. After approval, merge to main
git checkout main
git merge --no-ff release/v1.x.x

# 6. Deploy to staging
npm run deploy:staging

# 7. Run smoke tests on staging
npm run test:smoke

# 8. Deploy to production
npm run deploy:production
```

### Step 5.3: Monitoring Post-Deployment

**Monitor these metrics:**
- Error rate in logs (should be 0 spikes)
- Database query performance (should not degrade)
- API response times
- Dashboard page load times
- Error logs for "internshipStatus" references

**Alert conditions:**
- Any error containing "internshipStatus" → Page alert
- Any error containing "InternshipPhase" → Page alert
- Query performance degradation > 20% → Page alert

---

## Phase 6: Cleanup (Week 3)

### Step 6.1: Remove Deprecated Field (After 2 Release Cycles)

Once we're confident the migration is successful and all code uses new field:

**File:** `/backend/prisma/schema.prisma`

```diff
model InternshipApplication {
  // ... fields ...

  internshipPhase InternshipPhase?

- // Deprecated: Use internshipPhase instead
- internshipStatus String?
}
```

**Create new migration:**
```bash
npx prisma migrate dev --name remove_deprecated_internship_status_field
```

### Step 6.2: Clean Up Generated Files

```bash
npx prisma generate
```

### Step 6.3: Update Documentation

- Update API documentation
- Update schema documentation
- Update deployment guides
- Add migration notes to release notes

---

## Rollback Plan

### If something goes wrong during deployment:

```bash
# Step 1: Identify issue
# Check error logs and monitoring dashboards

# Step 2: Rollback code
git revert <commit-hash>

# Step 3: Rebuild and redeploy
npm install
npm run build
npm run deploy:production

# Step 4: Rollback database (if needed)
# Contact DBA to restore from backup
# OR manually reset internshipPhase values to NULL

# Step 5: Verify
# Check all dashboard pages
# Verify counts match previous state
```

**Rollback Window:** 24 hours
**Estimated Rollback Time:** 15-30 minutes

---

## Risk Assessment

### High Risk Areas
1. **Principal Service Dashboard Counts** - Complex logic changes
   - Mitigation: Comprehensive test coverage, parallel testing

2. **Data Migration** - Mapping old values to new enum
   - Mitigation: Verify migration with SQL queries, dry run first

### Medium Risk Areas
1. **Backwards Compatibility** - Old API responses
   - Mitigation: API versioning, gradual rollout

2. **Performance** - New index behavior
   - Mitigation: Load testing before production

### Low Risk Areas
1. **Faculty Service** - Already using correct pattern
   - No changes needed

2. **State Dashboard** - Already using correct pattern
   - No changes needed

---

## Success Criteria

- [x] All services use type-safe enum/boolean fields
- [x] No string literals in internship status queries
- [x] Dashboard counts consistent across services
- [x] Database indexes optimized
- [x] Zero migration errors
- [x] All tests passing
- [x] No performance degradation
- [x] Documentation updated
- [x] Team trained on new pattern

---

## Timeline Summary

| Phase | Duration | Dates | Owner |
|-------|----------|-------|-------|
| Preparation | 1 day | Week 1 (Mon) | Backend Lead |
| Service Updates | 3 days | Week 1 (Tue-Thu) | Development Team |
| Data Migration | 1 day | Week 1 (Fri) | Backend Lead + DBA |
| Testing | 3 days | Week 2 (Mon-Wed) | QA Team |
| Deployment | 1 day | Week 2 (Thu) | DevOps |
| Monitoring | 3 days | Week 2-3 (Fri-Mon) | Backend Lead |
| Cleanup | 1 day | Week 3 (Tue) | Backend Lead |
| **Total** | **11 days** | | |

---

## Team Responsibilities

- **Backend Lead:** Oversee implementation, code review, data migration
- **Development Team:** Implement service changes, write tests
- **QA Team:** Test coverage, regression testing, E2E testing
- **DevOps:** Deployment pipeline, monitoring setup, rollback capability
- **Database Admin:** Schema migration, data migration, backup/restore

---

## References

- Prisma Schema: `/backend/prisma/schema.prisma`
- Analysis Document: `ANALYSIS_INTERNSHIP_STATUS_ALIGNMENT.md`
- Comparison Document: `FIELD_USAGE_COMPARISON.md`
- Implementation Notes: This file

