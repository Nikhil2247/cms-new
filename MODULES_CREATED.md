# Faculty and Student Portal API Modules - Created Files

## Directory Structure

```
D:\Github\New folder\cms-new\backend\src\api\
├── faculty/
│   ├── faculty.module.ts
│   ├── faculty.controller.ts
│   └── faculty.service.ts
└── student-portal/
    ├── student-portal.module.ts
    ├── student.controller.ts
    └── student.service.ts
```

## Faculty Module

**Location:** `D:\Github\New folder\cms-new\backend\src\api\faculty\`

### Files Created:
1. ✅ faculty.module.ts
2. ✅ faculty.controller.ts
3. ✅ faculty.service.ts

### API Routes (All under @Controller('api/faculty')):

**Guards:** @UseGuards(JwtAuthGuard, RolesGuard)
**Roles:** @Roles(Role.TEACHER, Role.FACULTY_SUPERVISOR)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/faculty/dashboard` | Get faculty dashboard data |
| GET | `/api/faculty/profile` | Get faculty profile |
| GET | `/api/faculty/students` | Get assigned students list |
| GET | `/api/faculty/students/:id` | Get student detail |
| GET | `/api/faculty/students/:id/progress` | Get student progress |
| GET | `/api/faculty/visit-logs` | Get all visit logs |
| POST | `/api/faculty/visit-logs` | Create visit log |
| PUT | `/api/faculty/visit-logs/:id` | Update visit log |
| DELETE | `/api/faculty/visit-logs/:id` | Delete visit log |
| GET | `/api/faculty/monthly-reports` | Get monthly reports for review |
| PUT | `/api/faculty/monthly-reports/:id/review` | Review monthly report |
| GET | `/api/faculty/approvals/self-identified` | Get self-identified internship approvals |
| PUT | `/api/faculty/approvals/self-identified/:id` | Approve or reject self-identified internship |
| POST | `/api/faculty/feedback/monthly` | Submit monthly feedback for student |
| GET | `/api/faculty/feedback/history` | Get feedback history |

### Service Methods (Placeholder Implementations):
- getDashboard(facultyId)
- getProfile(facultyId)
- getAssignedStudents(facultyId, params)
- getStudentDetail(studentId)
- getStudentProgress(studentId)
- getVisitLogs(facultyId, params)
- createVisitLog(facultyId, createVisitLogDto)
- updateVisitLog(id, updateVisitLogDto)
- deleteVisitLog(id)
- getMonthlyReports(facultyId, params)
- reviewMonthlyReport(id, reviewDto)
- getSelfIdentifiedApprovals(facultyId, params)
- updateSelfIdentifiedApproval(id, approvalDto)
- submitMonthlyFeedback(facultyId, feedbackDto)
- getFeedbackHistory(facultyId, params)

---

## Student Portal Module

**Location:** `D:\Github\New folder\cms-new\backend\src\api\student-portal\`

### Files Created:
1. ✅ student-portal.module.ts
2. ✅ student.controller.ts
3. ✅ student.service.ts

### API Routes (All under @Controller('api/student')):

**Guards:** @UseGuards(JwtAuthGuard, RolesGuard)
**Roles:** @Roles(Role.STUDENT)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/student/dashboard` | Get student dashboard data |
| GET | `/api/student/profile` | Get student profile |
| PUT | `/api/student/profile` | Update student profile |
| POST | `/api/student/profile/image` | Upload profile image |
| GET | `/api/student/internships` | Get available internships |
| GET | `/api/student/internships/:id` | Get internship details |
| POST | `/api/student/internships/:id/apply` | Apply for internship |
| GET | `/api/student/applications` | Get all student applications |
| GET | `/api/student/applications/:id` | Get application details |
| POST | `/api/student/self-identified` | Submit self-identified internship |
| GET | `/api/student/self-identified` | Get self-identified internships |
| GET | `/api/student/monthly-reports` | Get all monthly reports |
| POST | `/api/student/monthly-reports` | Submit monthly report |
| PUT | `/api/student/monthly-reports/:id` | Update monthly report |
| GET | `/api/student/documents` | Get all student documents |
| POST | `/api/student/documents` | Upload document |
| DELETE | `/api/student/documents/:id` | Delete document |
| POST | `/api/student/grievances` | Submit grievance |
| GET | `/api/student/grievances` | Get all grievances |
| POST | `/api/student/technical-queries` | Submit technical query |

### Service Methods (Placeholder Implementations):
- getDashboard(studentId)
- getProfile(studentId)
- updateProfile(studentId, updateProfileDto)
- uploadProfileImage(studentId, file)
- getInternships(params)
- getInternshipDetails(internshipId)
- applyForInternship(studentId, internshipId, applicationDto)
- getApplications(studentId, params)
- getApplicationDetails(applicationId)
- submitSelfIdentified(studentId, selfIdentifiedDto)
- getSelfIdentified(studentId, params)
- getMonthlyReports(studentId, params)
- submitMonthlyReport(studentId, reportDto)
- updateMonthlyReport(reportId, reportDto)
- getDocuments(studentId, params)
- uploadDocument(studentId, file, documentDto)
- deleteDocument(documentId)
- submitGrievance(studentId, grievanceDto)
- getGrievances(studentId, params)
- submitTechnicalQuery(studentId, queryDto)

---

## Features Implemented

✅ All controllers use proper NestJS decorators
✅ Swagger/OpenAPI decorators (@ApiTags, @ApiOperation, @ApiResponse)
✅ JWT Authentication Guard (@UseGuards(JwtAuthGuard))
✅ Role-based Access Control (@Roles decorator)
✅ File upload support for images and documents (@UseInterceptors(FileInterceptor))
✅ Proper HTTP methods (GET, POST, PUT, DELETE)
✅ Query parameters for pagination, filtering, and search
✅ Bearer token authentication (@ApiBearerAuth)
✅ Placeholder service implementations with TODO comments

---

## Next Steps

The placeholder implementations need to be filled with actual business logic:

1. **Database Integration**: Add Prisma/TypeORM models and queries
2. **DTOs**: Create proper Data Transfer Objects with validation decorators
3. **Error Handling**: Implement proper error handling and validation
4. **File Storage**: Integrate file storage service (Cloudinary, S3, etc.)
5. **Pagination**: Implement proper cursor or offset-based pagination
6. **Business Logic**: Add actual implementation for all service methods
7. **Testing**: Add unit and integration tests

---

## Dependencies Required

The modules reference the following shared dependencies that need to be created:

```typescript
// Guards
- JwtAuthGuard (at: shared/guards/jwt-auth.guard.ts)
- RolesGuard (at: shared/guards/roles.guard.ts)

// Decorators
- Roles (at: shared/decorators/roles.decorator.ts)

// Enums
- Role (at: shared/enums/role.enum.ts)
```

These should define:
- Role.TEACHER
- Role.FACULTY_SUPERVISOR
- Role.STUDENT
