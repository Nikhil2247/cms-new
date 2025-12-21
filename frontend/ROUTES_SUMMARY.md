# Routes Summary - All New Pages

## Student Routes
| Path | Component | Description |
|------|-----------|-------------|
| `/internships` | StudentInternshipList | Browse and apply for internships |
| `/reports/submit` | StudentReportSubmit | Submit monthly reports |
| `/profile/edit` | StudentProfileEdit | Edit student profile |

## Principal Routes
| Path | Component | Description |
|------|-----------|-------------|
| `/students/new` | StudentForm | Create new student |
| `/students/:id/edit` | StudentForm | Edit student |
| `/staff/new` | StaffForm | Create new staff |
| `/staff/:id/edit` | StaffForm | Edit staff |
| `/mentors` | MentorAssignment | Assign mentors to students |
| `/bulk-upload` | BulkUpload | Bulk upload students/staff |

## Industry Routes
| Path | Component | Description |
|------|-----------|-------------|
| `/applications` | ApplicationsList | Manage student applications |

## Faculty Routes
| Path | Component | Description |
|------|-----------|-------------|
| `/visit-logs` | VisitLogList | View all visit logs |
| `/visit-logs/new` | VisitLogForm | Create visit log |
| `/visit-logs/:id/edit` | VisitLogForm | Edit visit log |
| `/assigned-students` | AssignedStudentsList | View assigned students |

## State Routes
| Path | Component | Description |
|------|-----------|-------------|
| `/institutions` | InstitutionList | View all institutions |
| `/institutions/new` | InstitutionForm | Create institution |
| `/institutions/:id/edit` | InstitutionForm | Edit institution |
| `/principals` | PrincipalList | View all principals |
| `/principals/new` | PrincipalForm | Create principal |
| `/principals/:id/edit` | PrincipalForm | Edit principal |

## Total Routes
- Student: 3 new routes
- Principal: 6 routes (2 existing, 2 new)
- Industry: 1 route
- Faculty: 4 routes (3 existing, 1 new)
- State: 6 routes (3 existing, 3 new)

**Total: 20 routes** (13 new routes added)
