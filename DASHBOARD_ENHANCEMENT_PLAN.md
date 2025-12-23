# Dashboard Enhancement Plan

## Focus Areas
1. **Joining Letters/Reports** - Full tracking integration (PRIMARY)
2. **Company Details** - Industry/company information display
3. **Faculty Workload** - Visit and mentor workload statistics

---

## Current State (No Changes Needed)

The following areas are working as expected and require no enhancements:

| Area | Current Implementation | Status |
|------|----------------------|--------|
| Self-Identified Internships | Auto-approved, counts displayed | OK |
| Faculty Visits | Aggregate counts (this month, last month, pending) | OK |
| Mentor Assignments | Assigned/unassigned counts, bulk/auto-assign | OK |
| Monthly Reports | Submission count, missing count | OK |

---

## Enhancement 1: Joining Letters Integration

### Requirements
- Display on **BOTH** State and Principal dashboards
- Full tracking: Counts, list, verification actions, status timeline

### Current Data Model
```
InternshipApplication:
- joiningLetterUrl: String (file URL)
- joiningLetterUploadedAt: DateTime
- hasJoined: Boolean
- joiningDate: DateTime
- reviewedBy: String
- reviewedAt: DateTime
- reviewRemarks: String
```

### Available API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/state/joining-letters/stats` | GET | State-level joining letter statistics |
| `/faculty/joining-letters` | GET | List joining letters for review |
| `/faculty/joining-letters/:id/verify` | PUT | Verify joining letter |
| `/faculty/joining-letters/:id/reject` | PUT | Reject joining letter |

### State Dashboard Implementation

**New Component: `JoiningLetterTracker.jsx`**

Location: `frontend/src/features/state/dashboard/components/`

Features:
1. **Summary Card** - Counts by status (Pending, Verified, Rejected, Total)
2. **Institution Breakdown** - Joining letter stats per institution
3. **Trend Line** - Verification rate over time

**Data to Display:**
```javascript
{
  total: number,
  pending: number,
  verified: number,
  rejected: number,
  verificationRate: percentage,
  byInstitution: [
    { institutionId, name, pending, verified, rejected }
  ]
}
```

### Principal Dashboard Implementation

**New Component: `JoiningLetterPanel.jsx`**

Location: `frontend/src/features/principal/dashboard/components/`

Features:
1. **Summary Stats** - Total, Pending, Verified, Rejected counts
2. **Pending List** - List of students with pending verification
3. **Quick Actions** - Verify/Reject buttons with modal
4. **Status Timeline** - Recent verification activity

**Data to Display:**
```javascript
{
  stats: { total, pending, verified, rejected },
  pendingList: [
    {
      studentId, studentName, companyName,
      joiningLetterUrl, uploadedAt,
      applicationId
    }
  ],
  recentActivity: [
    { action, studentName, timestamp, reviewedBy }
  ]
}
```

### Backend Enhancements Needed

**State Service** (`state.service.ts`):
```typescript
// Add method to get detailed joining letter stats
async getJoiningLetterStats(filters?: { month?: number, year?: number }) {
  // Return counts by status
  // Return institution-wise breakdown
  // Return verification rate
}
```

**Principal Service** (`principal.service.ts`):
```typescript
// Add method to get joining letters for institution
async getJoiningLetters(institutionId: string, filters?: { status?: string }) {
  // Return list with student details
  // Include company information
  // Support pagination
}

// Add verification actions
async verifyJoiningLetter(applicationId: string, remarks?: string)
async rejectJoiningLetter(applicationId: string, remarks: string)
```

### Redux State Updates

**stateSlice.js:**
```javascript
// Add to initialState
joiningLetterStats: {
  data: null,
  loading: false,
  error: null
}

// Add thunk
export const fetchJoiningLetterStats = createAsyncThunk(
  'state/fetchJoiningLetterStats',
  async (params, { rejectWithValue }) => { ... }
);

// Add selector
export const selectJoiningLetterStats = (state) => state.state.joiningLetterStats.data;
```

**principalSlice.js:**
```javascript
// Add to initialState
joiningLetters: {
  data: [],
  stats: null,
  loading: false,
  error: null
}

// Add thunks
export const fetchJoiningLetters = createAsyncThunk(...);
export const verifyJoiningLetter = createAsyncThunk(...);
export const rejectJoiningLetter = createAsyncThunk(...);

// Add selectors
export const selectJoiningLetters = (state) => state.principal.joiningLetters.data;
export const selectJoiningLetterStats = (state) => state.principal.joiningLetters.stats;
```

---

## Enhancement 2: Company Details Display

### Requirements
- Show company/industry information for internships on dashboards

### Current Data Available
```
InternshipApplication:
- companyName, companyAddress, companyContact, companyEmail
- industryId -> Industry table

Industry:
- name, description, sector
- contactPerson, email, phone
- address, website
```

### State Dashboard Implementation

**Enhance: `StatisticsCards.jsx`**

Add company info to internship stats modal:
- Top companies by intern count
- Industry sector distribution
- Company verification status

**Enhance: `InstitutionsTable.jsx`**

Add column or expandable row showing:
- Top 3 companies per institution
- Industry distribution per institution

### Principal Dashboard Implementation

**New Component: `CompanyOverview.jsx`**

Location: `frontend/src/features/principal/dashboard/components/`

Features:
1. **Company List** - Companies with active interns
2. **Intern Count** - Number of students per company
3. **Contact Info** - Quick access to company details
4. **Sector Breakdown** - Pie/bar chart of industry sectors

**Data to Display:**
```javascript
{
  companies: [
    {
      companyName, internCount, sector,
      contactPerson, email, phone
    }
  ],
  sectorDistribution: [
    { sector: 'IT', count: 25 },
    { sector: 'Manufacturing', count: 15 }
  ]
}
```

### Backend Enhancements Needed

**State Service:**
```typescript
// Enhance dashboard stats to include company info
async getCompanyStats() {
  // Top companies by intern count
  // Industry sector distribution
}
```

**Principal Service:**
```typescript
// Get company details for institution's interns
async getCompanyOverview(institutionId: string) {
  // List companies with intern counts
  // Sector distribution
  // Contact information
}
```

### Redux State Updates

**stateSlice.js:**
```javascript
// Add to existing dashboardStats or create new slice
companyStats: {
  topCompanies: [],
  sectorDistribution: [],
  loading: false
}
```

**principalSlice.js:**
```javascript
companyOverview: {
  companies: [],
  sectorDistribution: [],
  loading: false
}
```

---

## Enhancement 3: Faculty Workload Display

### Requirements
- Show faculty visit workload statistics
- Display mentor assignment load per faculty

### Current Data Available
```
FacultyVisitLog:
- facultyId, visitDate, visitType
- studentId, applicationId

MentorAssignment:
- mentorId (faculty), studentId
- isActive, assignmentDate
```

### State Dashboard Implementation

**Enhance: `StatisticsCards.jsx`** or **New Component: `FacultyWorkloadCard.jsx`**

Display at state level:
- Average visits per faculty (state-wide)
- Average students per mentor (state-wide)
- Institution-wise faculty workload comparison

**Data to Display:**
```javascript
{
  stateAverage: {
    visitsPerFaculty: number,
    studentsPerMentor: number
  },
  byInstitution: [
    {
      institutionId, name,
      avgVisitsPerFaculty, avgStudentsPerMentor,
      totalFaculty, totalVisits, totalAssignments
    }
  ]
}
```

### Principal Dashboard Implementation

**New Component: `FacultyWorkloadPanel.jsx`**

Location: `frontend/src/features/principal/dashboard/components/`

Features:
1. **Workload Summary** - Average load across all faculty
2. **Faculty List** - Each faculty with their workload metrics
3. **Load Distribution** - Bar chart showing workload per faculty
4. **Overload Alerts** - Highlight faculty with high workload

**Data to Display:**
```javascript
{
  summary: {
    totalFaculty: number,
    avgVisitsPerFaculty: number,
    avgStudentsPerMentor: number
  },
  facultyList: [
    {
      facultyId, name,
      assignedStudents: number,
      visitsThisMonth: number,
      visitsLastMonth: number,
      pendingVisits: number,
      workloadScore: 'Low' | 'Medium' | 'High'
    }
  ]
}
```

### Backend Enhancements Needed

**State Service:**
```typescript
async getFacultyWorkloadStats() {
  // State-wide averages
  // Institution-wise breakdown
}
```

**Principal Service:**
```typescript
async getFacultyWorkload(institutionId: string) {
  // Per-faculty metrics
  // Visit counts
  // Assignment counts
  // Workload calculation
}
```

### Redux State Updates

**stateSlice.js:**
```javascript
facultyWorkloadStats: {
  stateAverage: null,
  byInstitution: [],
  loading: false
}
```

**principalSlice.js:**
```javascript
facultyWorkload: {
  summary: null,
  facultyList: [],
  loading: false
}
```

---

## Implementation Plan

### Phase 1: Joining Letters (Priority)

**Backend Tasks:**
1. Add `getJoiningLetterStats()` to state.service.ts
2. Add `getJoiningLetters()` to principal.service.ts
3. Add verification endpoints to principal.controller.ts
4. Update DTOs for response types

**Frontend Tasks:**
1. Update stateSlice.js with joining letter state/thunks
2. Update principalSlice.js with joining letter state/thunks
3. Create `JoiningLetterTracker.jsx` for State dashboard
4. Create `JoiningLetterPanel.jsx` for Principal dashboard
5. Integrate components into dashboards

### Phase 2: Company Details

**Backend Tasks:**
1. Add `getCompanyStats()` to state.service.ts
2. Add `getCompanyOverview()` to principal.service.ts

**Frontend Tasks:**
1. Enhance StatisticsCards.jsx to show company info
2. Create `CompanyOverview.jsx` for Principal dashboard
3. Add Redux state/thunks for company data

### Phase 3: Faculty Workload

**Backend Tasks:**
1. Add `getFacultyWorkloadStats()` to state.service.ts
2. Add `getFacultyWorkload()` to principal.service.ts

**Frontend Tasks:**
1. Create `FacultyWorkloadCard.jsx` or enhance existing
2. Create `FacultyWorkloadPanel.jsx` for Principal dashboard
3. Add Redux state/thunks for workload data

---

## File Structure

```
frontend/src/features/
├── state/
│   ├── dashboard/
│   │   ├── StateDashboard.jsx (update to include new components)
│   │   └── components/
│   │       ├── JoiningLetterTracker.jsx (NEW)
│   │       ├── FacultyWorkloadCard.jsx (NEW)
│   │       └── StatisticsCards.jsx (ENHANCE - company info)
│   └── store/
│       └── stateSlice.js (ADD - joining letters, company, workload state)
│
├── principal/
│   ├── dashboard/
│   │   ├── PrincipalDashboard.jsx (update to include new components)
│   │   └── components/
│   │       ├── JoiningLetterPanel.jsx (NEW)
│   │       ├── CompanyOverview.jsx (NEW)
│   │       └── FacultyWorkloadPanel.jsx (NEW)
│   └── store/
│       └── principalSlice.js (ADD - joining letters, company, workload state)
│
└── services/
    ├── state.service.js (ADD - new API calls)
    └── principal.service.js (ADD - new API calls)

backend/src/api/
├── state/
│   ├── state.controller.ts (ADD - new endpoints)
│   └── state.service.ts (ADD - new methods)
└── principal/
    ├── principal.controller.ts (ADD - new endpoints)
    └── principal.service.ts (ADD - new methods)
```

---

## Next Steps

1. **Confirm this plan** - Review and approve the implementation approach
2. **Start with Joining Letters** - Highest priority as per your requirements
3. **Implement backend first** - Add service methods and endpoints
4. **Build frontend components** - Create Redux state and React components
5. **Test integration** - Verify data flow and UI

Would you like me to start implementing these enhancements?
