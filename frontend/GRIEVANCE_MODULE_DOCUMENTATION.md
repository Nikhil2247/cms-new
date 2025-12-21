# Grievance Management Module - Complete Implementation

## Overview
A comprehensive grievance management system for students to submit concerns and administrators to track, respond, and resolve them.

## Architecture

### Frontend Structure
```
frontend/src/
├── services/
│   └── grievance.service.js          # API service layer
├── constants/
│   └── grievance.constants.js        # Shared constants and enums
├── features/
│   ├── shared/
│   │   └── grievances/
│   │       └── GrievanceList.jsx     # Admin grievance management (STATE_DIRECTORATE, PRINCIPAL)
│   └── student/
│       └── grievances/
│           └── SubmitGrievance.jsx   # Student grievance submission
└── app/
    └── routes/
        └── AppRoutes.jsx              # Route configuration
```

### Backend Structure
```
backend/src/domain/support/
├── grievance/
│   ├── grievance.service.ts           # Business logic
│   ├── grievance.controller.ts        # REST API endpoints
└── support.module.ts                  # Module configuration
```

## Features

### For Students (SubmitGrievance.jsx)
1. **Submit New Grievances**
   - Category selection (Academic, Internship, Faculty, Industry, Placement, Technical, Other)
   - Priority levels (Low, Medium, High, Urgent)
   - Subject and detailed description
   - File attachments support
   - Form validation

2. **Track Grievances**
   - View all submitted grievances in a table
   - Status tracking (Submitted, In Review, Escalated, Resolved, Closed)
   - Detailed view with timeline
   - Resolution visibility

### For Administrators (GrievanceList.jsx)
1. **Dashboard Statistics**
   - Total grievances
   - Pending count
   - Escalated count
   - Resolved count

2. **Advanced Filtering**
   - Filter by status
   - Filter by category
   - Filter by priority
   - Date range filtering

3. **Grievance Management**
   - View all grievances in sortable table
   - Detailed drawer view with full information
   - Respond to grievances
   - Escalate urgent issues
   - Change status
   - Close grievances
   - Timeline tracking

4. **Grievance Details**
   - Student information
   - Institution details
   - Full description
   - Resolution notes
   - Assignment tracking
   - Status timeline

## API Endpoints

### Backend Controller (grievance.controller.ts)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/grievances` | Admin | Get all grievances with filtering |
| GET | `/grievances/institution/:id` | Admin | Get grievances by institution |
| GET | `/grievances/user/:userId` | Owner/Admin | Get user's grievances |
| GET | `/grievances/:id` | Owner/Admin | Get single grievance |
| POST | `/grievances` | Student | Submit new grievance |
| POST | `/grievances/:id/respond` | Admin | Respond to grievance |
| POST | `/grievances/:id/escalate` | Admin | Escalate grievance |
| PATCH | `/grievances/:id/status` | Admin | Update status |
| PATCH | `/grievances/:id/assign` | Admin | Assign to user |
| PATCH | `/grievances/:id/close` | Admin | Close grievance |
| GET | `/grievances/statistics` | Admin | Get statistics |

## Service Methods

### Frontend (grievance.service.js)

```javascript
// Get methods
grievanceService.getAll(params)              // Get all with filters
grievanceService.getByInstitution(id)        // Get by institution
grievanceService.getByUser(userId)           // Get by user
grievanceService.getById(id)                 // Get single grievance

// Action methods
grievanceService.submit(data)                // Submit new
grievanceService.respond(id, response)       // Respond
grievanceService.escalate(id)                // Escalate
grievanceService.updateStatus(id, status)    // Update status
grievanceService.assign(id, assigneeId)      // Assign
grievanceService.close(id)                   // Close

// Analytics
grievanceService.getStatistics(institutionId) // Get stats
```

### Backend (grievance.service.ts)

```typescript
submitGrievance(userId, data)              // Create grievance
getGrievancesByUser(userId)                 // Get user's grievances
getGrievancesByInstitution(institutionId)   // Get institution's grievances
respondToGrievance(id, responderId, response) // Respond and resolve
escalateGrievance(id)                       // Escalate priority
updateGrievanceStatus(id, status)           // Update status
```

## Data Models

### Grievance Categories
- `ACADEMIC` - Academic matters
- `INTERNSHIP` - Internship-related concerns
- `FACULTY` - Faculty interaction issues
- `INDUSTRY` - Industry partner issues
- `PLACEMENT` - Placement and career concerns
- `TECHNICAL` - Technical/infrastructure issues
- `OTHER` - Other concerns

### Status Flow
1. `SUBMITTED` - Initial submission (Blue badge)
2. `IN_REVIEW` - Under review (Orange badge)
3. `ESCALATED` - Escalated for priority handling (Red badge)
4. `RESOLVED` - Issue resolved (Green badge)
5. `CLOSED` - Case closed (Gray badge)

### Priority Levels
- `LOW` - Non-urgent matters (Gray)
- `MEDIUM` - Standard priority (Blue)
- `HIGH` - Requires prompt attention (Orange)
- `URGENT` - Requires immediate attention (Red)

## Usage Examples

### Student - Submit Grievance
```jsx
import SubmitGrievance from '@/features/student/grievances/SubmitGrievance';

// Route: /submit-grievance
// Access: STUDENT role only
<Route path="/submit-grievance" element={<SubmitGrievance />} />
```

### Admin - Manage Grievances
```jsx
import GrievanceList from '@/features/shared/grievances/GrievanceList';

// Route: /grievances
// Access: STATE_DIRECTORATE, PRINCIPAL roles
<Route path="/grievances" element={<GrievanceList />} />
```

### Using the Service
```javascript
import { grievanceService } from '@/services/grievance.service';

// Submit a grievance
await grievanceService.submit({
  category: 'INTERNSHIP',
  subject: 'Issue with internship placement',
  description: 'Detailed description...',
  priority: 'HIGH'
});

// Get user's grievances
const grievances = await grievanceService.getByUser(userId);

// Respond to a grievance
await grievanceService.respond(grievanceId, 'Your issue has been resolved...');

// Escalate
await grievanceService.escalate(grievanceId);
```

## UI Components Used

### Ant Design Components
- **Table** - Grievance listing with pagination
- **Card** - Container cards for sections
- **Modal** - Response submission
- **Drawer** - Detailed grievance view
- **Form** - Submission forms
- **Select** - Dropdowns for categories, priorities
- **Tag** - Status and category indicators
- **Badge** - Status badges
- **Timeline** - Status progression tracking
- **Statistic** - Dashboard metrics
- **Descriptions** - Information display
- **Upload/Dragger** - File attachments
- **DatePicker** - Date range filtering
- **Alert** - Information and status messages

## Color Coding

### Status Colors
- Submitted: Blue (#1890ff)
- In Review: Orange (#faad14)
- Escalated: Red (#ff4d4f)
- Resolved: Green (#52c41a)
- Closed: Gray (default)

### Priority Colors
- Low: Gray (default)
- Medium: Blue (#1890ff)
- High: Orange (#faad14)
- Urgent: Red (#ff4d4f)

### Category Colors
- Academic: Blue
- Internship: Cyan
- Faculty: Purple
- Industry: Orange
- Placement: Green
- Technical: Geek Blue
- Other: Default

## Access Control

### Role-Based Access
- **STUDENT**: Can submit and view own grievances
- **FACULTY_SUPERVISOR**: Can view and respond to assigned grievances
- **PRINCIPAL**: Full access to institution's grievances
- **STATE_DIRECTORATE**: Full access to all grievances

### Security
- JWT authentication required
- Role-based guards on all endpoints
- Users can only view their own grievances (unless admin)
- All actions are logged and tracked

## Validation

### Frontend Validation
- Subject: Required, minimum 10 characters
- Description: Required, minimum 50 characters
- Category: Required
- Priority: Required

### Backend Validation
- User authentication
- Role authorization
- Data sanitization
- Business logic validation

## Key Features

1. **Real-time Updates** - Automatic refresh after actions
2. **Responsive Design** - Mobile-friendly interface
3. **Advanced Filtering** - Multi-criteria filtering
4. **Status Tracking** - Complete timeline of grievance lifecycle
5. **File Attachments** - Support for document uploads
6. **Toast Notifications** - User feedback for all actions
7. **Statistics Dashboard** - Quick overview metrics
8. **Role-based Views** - Different interfaces for students and admins

## Integration Points

### With Existing System
- Uses existing authentication (JWT)
- Integrates with user management
- Uses institution hierarchy
- Leverages notification system
- Follows existing routing patterns

### Database
- Uses Prisma ORM
- Caching with Redis (through CacheService)
- Related to Student, Institution, User models

## Routes

### Frontend Routes
```
/submit-grievance      - Student submission form
/grievances            - Admin management interface
```

### Backend Routes
```
GET    /api/grievances                    - List all
GET    /api/grievances/institution/:id    - By institution
GET    /api/grievances/user/:userId       - By user
GET    /api/grievances/:id                - Single grievance
POST   /api/grievances                    - Create
POST   /api/grievances/:id/respond        - Respond
POST   /api/grievances/:id/escalate       - Escalate
PATCH  /api/grievances/:id/status         - Update status
PATCH  /api/grievances/:id/close          - Close
GET    /api/grievances/statistics         - Statistics
```

## Testing Recommendations

1. **Unit Tests**
   - Service methods
   - API endpoints
   - Form validation

2. **Integration Tests**
   - Complete grievance lifecycle
   - Permission checks
   - Status transitions

3. **E2E Tests**
   - Student submission flow
   - Admin response flow
   - Escalation workflow

## Future Enhancements

1. Email notifications on status changes
2. Comment threads for discussions
3. Attachment preview
4. Export to PDF/Excel
5. Analytics dashboard
6. Auto-assignment based on category
7. SLA tracking
8. Grievance templates
9. Bulk actions
10. Advanced reporting

## Maintenance

### Adding New Categories
1. Update `GRIEVANCE_CATEGORIES` in `grievance.constants.js`
2. Update backend enum in Prisma schema
3. Run database migration

### Adding New Statuses
1. Update `GRIEVANCE_STATUSES` in `grievance.constants.js`
2. Update backend enum in Prisma schema
3. Run database migration
4. Update workflow logic

## Support

For issues or questions:
1. Check this documentation
2. Review API endpoint documentation
3. Check backend service implementation
4. Review Prisma schema for data model

---

**Version**: 1.0.0
**Last Updated**: 2025-12-20
**Maintainer**: Development Team
