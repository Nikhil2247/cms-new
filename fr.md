# Functional Requirements Specification

1. Document Information
-----------------------
- **Project Name:** PlaceIntern
- **Document Version:** 1.0
- **Date:** 29-12-2025
- **Author:** Gunjan Gupta / Nikhil
- **Reviewer:** Gunjan Gupta
- **Status:** Draft

---

2. Executive Summary
--------------------
PlaceIntern is an internship management portal primarily designed for PSBTE colleges to streamline internship listings, applications, assignments, reporting and compliance across PSBTE-affiliated institutions and state directorates. The system provides role-based access (System Admin, State Directorate, Institution Administrators, Students, Mentors), secure authentication, file storage, analytics and scheduled monthly reporting. Primary users include students at PSBTE colleges seeking internships, institution staff who manage internship programs, mentors who review and manage students’ internships and state-level administrators who monitor and report program progress.

---

3. Project Overview
-------------------
3.1 Project Description
PlaceIntern centralizes internship program workflows: student registration and profile management, internship postings (which may be posted by institutions, self-identified by students, or identified by faculty), application handling, mentor assignments, tracking visits, grievances and technical support, plus automated monthly reporting. The system stores documents and images in MinIO (S3-compatible storage), uses MongoDB for primary storage, provides a responsive web UI (React/Vite) and a REST API backend (NestJS).

3.2 Project Scope
Included:
- User authentication (JWT + Passport, optional Google sign-in)
- Role-based access control (System Admin, State Directorate, Institution, Student, Mentor)
- Institution and user management
- Internship listings and applications workflow
- Mentor assignment and visit logging
- Grievance and support ticketing (technical queries)
- FAQ and Help/Support module
- File uploads and serving (MinIO)
- Scheduling and background jobs (monthly reports, migrations)
- Audit logging, analytics and health endpoints
- Containerized deployment with Docker/Compose and CI/CD workflows

Excluded (out-of-scope):
- Third-party internship marketplace integrations (unless specified)
- Real-time video interview functionality (future enhancement)
- On-premise-only legacy system connectors (unless requested)

3.3 Project Objectives
- Provide a secure, auditable workflow for managing internships and related reporting
- Automate monthly report generation and distribution
- Offer a role-based portal tailored to students, institutions and administrators
- Ensure the system is container-ready and deployable via CI/CD with documented deployment steps

---

4. User Profiles and Stakeholders
--------------------------------
4.1 User Profiles

| User Role | Description | Key Needs |
|---|---:|---|
| System Admin | Platform administrators with full access | Manage institutions, users, system configuration, audit and health monitoring |
| State Directorate | State-level program owners and monitors | Access reports, analytics, institution status, sign-off and guidance |
| Institution Admin | College/institution staff managing interns | Post internships, review applicants, assign mentors, approve reports |
| Mentor | Faculty/industry mentors | Access assigned interns, log visits, provide feedback |
| Student | Internship candidates | Browse internships, apply, manage profile and documents |
| Support Staff | Technical support operators | Manage tickets, respond to technical queries and grievances |

4.2 Stakeholders
- State Government / Directorates (program success, compliance and reporting)
- Participating educational institutions (student placement outcomes)
- System Administrators and IT (uptime, security)
- Students and mentors (usability, timely reporting)
- Data privacy officers (compliance)

---

5. Functional Requirements
--------------------------
Note: Each FR must be assigned unique FR-IDs when approved in project tracking.

5.1 Authentication & Authorization
- FR-001: User Registration & Login
  - Priority: Critical
  - User Role: All (public registration for students, invite/seeded accounts for institutions & admins)
  - Description: Provide secure sign-up, login, password reset, refresh tokens and optional Google OAuth sign-in.
  - Acceptance Criteria:
    - POST /auth/login returns access + refresh tokens on valid credentials
    - Refresh tokens rotate and can be revoked (blacklisting)
    - Password reset flow sends email with secure single-use link
  - Related Requirements: FR-002 (RBAC)

- FR-002: Role-Based Access Control
  - Priority: Critical
  - User Role: System Admin, State Directorate, Institution Admin, Mentor, Student
  - Description: Enforce per-endpoint access control with roles and resource scoping (institutionId scoped where applicable)
  - Acceptance Criteria:
    - Admin-only endpoints are inaccessible to non-admin roles
    - Institution-scoped endpoints require matching `institutionId`

5.2 Institution & User Management
- FR-010: Manage Institutions
  - Priority: High
  - User Role: System Admin
  - Description: CRUD operations for institutions, branch/batch metadata and default institution configuration
  - Acceptance Criteria:
    - System Admin can create/update/delete institutions
    - Institution counts and indexes are present in seeded data

- FR-011: User Profiles & Roles
  - Priority: High
  - User Role: System Admin, Institution Admin, Student
  - Description: Maintain user profiles, contact details, role assignments, and institution linkage
  - Acceptance Criteria:
    - Users can update profile and upload documents
    - Role changes are logged to audit trail

5.3 Internship & Application Workflow
- FR-020: Internship Postings
  - Priority: High
  - User Role: Institution Admin, Student (self-identified), Mentor/Faculty (faculty-identified)
  - Description: Create/edit/delete internship listings with eligibility & documents. Support internship postings created by institution administrators, self-identified by students, or identified/submitted by faculty mentors.
  - Acceptance Criteria:
    - Internship visible to students matching criteria
    - System supports tagging postings as **Self-identified** or **Faculty-identified** and routes them for review/approval where required

- FR-021: Application Submission
  - Priority: High
  - User Role: Student
  - Description: Students can apply to internships and attach required documents
  - Acceptance Criteria:
    - Submissions stored, attachments saved to MinIO, and status tracked

- FR-022: Mentor Assignment & Visit Logs
  - Priority: Medium
  - User Role: Institution Admin / Mentor
  - Description: Assign mentors and allow them to log visits and feedback
  - Acceptance Criteria:
    - Mentor can view assigned interns and submit visit logs

5.4 Reporting & Analytics
- FR-030: Monthly Reports
  - Priority: Critical
  - User Role: System Admin / State Directorate / Institution Admin
  - Description: Generate monthly aggregated reports (counts, placements, compliance) automatically and make downloadable
  - Acceptance Criteria:
    - Scheduled jobs produce monthly_reports entries and produce downloadable PDFs/CSV

- FR-031: Health & Usage Analytics
  - Priority: Medium
  - User Role: System Admin
  - Description: System exposes endpoints for uptime, login analytics and role statistics
  - Acceptance Criteria:
    - GET /system/analytics returns recent login graphs, active sessions and role counts

5.5 Support & Grievance
- FR-040: Tickets and FAQs
  - Priority: Medium
  - User Role: All
  - Description: Create/track technical queries and grievances; maintain public FAQs targeted by roles
  - Acceptance Criteria:
    - Users can create tickets; staff can respond and close them
    - FAQ CRUD available to authorized roles

5.6 File Management & Media
- FR-050: Object Storage Integration
  - Priority: High
  - User Role: All roles that upload files
  - Description: Use MinIO (S3-compatible) for uploads; public download as needed, private object keys for protected content
  - Acceptance Criteria:
    - Uploaded files stored in `cms-uploads` bucket; download links are valid and expiration policies respected

---

6. System Workflows and Use Cases
-------------------------------
6.1 Student Applies to Internship
- Actor: Student
- Preconditions: Student profile complete and logged in
- Main Flow:
  1. Student browses internships and selects one
  2. Student completes application form and uploads required documents
  3. System stores application and attachments; notifies institution admin
  4. Institution reviews and responds (accept/reject/waitlist)
- Alternative Flows:
  - Alternative A: Missing documents → system requests missing fields and prevents submission
  - Alternative B: Duplicate application → system alerts student
- Postconditions: Application status recorded and audit log created

6.2 Mentor Logs a Visit
- Actor: Mentor
- Preconditions: Mentor assigned to student and logged in
- Main Flow:
  1. Mentor selects assigned student and opens visit log
  2. Mentor records visit details and submits
  3. System saves log and updates intern progress
- Postconditions: Visit log stored and visible to institution staff

---

7. Data Requirements
--------------------
7.1 Data Entities (primary)
- User: id, name, email, role, institutionId, lastLoginAt, loginCount
- Student: profile fields (education, batch, branch), documents (MinIO keys)
- Institution: id, name, address, branches
- Internship: id, title, description, eligibility, institutionId, status
- Application: id, internshipId, studentId, attachments, status, submittedAt
- MentorAssignment: mentorId, studentId, startDate, status
- MonthlyReport / GeneratedReport: reportId, month, institutionId, metrics, fileKey
- TechnicalQuery / Grievance: id, userId, subject, messages, status

7.2 Data Validation Rules
- Required fields validated server-side with class-validator rules
- Email format validation, file size & type limits, and document type checks apply
- Referential integrity enforced at application level (e.g., student -> institution)

7.3 Data Retention and Privacy
- Sensitive PII stored securely; access logged and limited by role
- MinIO access keys rotated and secrets secured in environment variables
- Retention: default policy to retain application data for X years (configurable); archival processes expected

---

8. Integration Requirements
---------------------------
8.1 External Systems
- MongoDB
  - Integration Type: Database
  - Data Exchange: Application documents and collections
- MinIO (S3-compatible)
  - Integration Type: Object storage
  - Data Exchange: File uploads (profile images, documents, generated reports)
- Email (SMTP / Gmail)
  - Integration Type: SMTP
  - Data Exchange: Password reset, notifications, system alerts
- Google OAuth (optional)
  - Integration Type: OAuth 2.0 provider
  - Data Exchange: Basic profile information
- DragonflyDB / caching layer
  - Integration Type: In-memory / cache
  - Data Exchange: Caching of ephemeral data / fast lookups

8.2 APIs and Interfaces
- REST API (JSON) over HTTPS: endpoints for auth, users, internships, applications, reports, analytics
- WebSocket: for real-time notifications (token-based auth)
- Admin UI (React/Vite) consuming the REST API

---

9. Non-Functional Requirements
------------------------------
9.1 Performance
- Response time: < 2 seconds for common user queries under normal load
- Capacity: Support 1,000 concurrent users initially; support scaling horizontally
- Background jobs: Monthly report generation completes within the scheduled window

9.2 Security
- All traffic over TLS/HTTPS
- Authentication: JWT with refresh tokens; token blacklisting for logout/revocation
- Authorization: Role-based access control per endpoint
- Data encryption in transit; secrets in environment or secret store
- Audit logging for administrative actions and report generation

9.3 Scalability and Availability
- Containerized services (Docker) to allow horizontal scaling
- Recommended uptime: 99.9% (depending on infra SLA)
- Use of load balancer & stateless API servers; state persisted in MongoDB and MinIO

9.4 Compliance
- GDPR-like controls for EU data subjects (subject to legal review)
- Access to logs and data export requested by data owners

---

10. Assumptions and Constraints
-------------------------------
10.1 Assumptions
- Institutions will provide student lists or allow student self-registration
- Stable MinIO and MongoDB infrastructure is available for production
- Email provider credentials (SMTP) will be supplied for production

10.2 Constraints
- Must use existing MongoDB/MinIO infrastructure or compatible cloud equivalents
- Budget and timeline constraints to be validated with stakeholders (example timeline: 6 months)
- Sensitive credentials stored as environment variables or secret manager

---

11. Dependencies
-----------------
- External email provider (SMTP) for notifications
- MinIO (or S3 provider) for file storage
- MongoDB for primary data storage
- OAuth provider credentials (Google) if social sign-in enabled
- CI/CD tooling (GitHub Actions) and deployment environment

---

12. Change Control and Approval
-------------------------------
Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Technical Lead | Gunjan Gupta |  | 29-12-2025 |
| Client / Stakeholder | Mridul |  |  |

Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 29-12-2025 | Gunjan Gupta / Nikhil | Initial draft |

---

13. Appendices
--------------
Appendix A: Glossary
- MinIO: S3-compatible object storage used for file uploads
- JWT: JSON Web Tokens used for stateless authentication
- RBAC: Role-Based Access Control

Appendix B: References
- `DEPLOYMENT_GUIDE.md` (deployment & env vars)
- Backend README (auth & system architecture)
- `docker-compose.prod.yml` & `docker-compose.dev.yml`

Appendix C: Additional Diagrams
- System architecture and data-flow diagrams to be added here (wireframes, sequence diagrams)

---

Notes & Next Steps
- Convert FR items to tracked tickets (e.g., FR-001, FR-002, FR-010) in project tracker and expand acceptance criteria where required.
- Add sample wireframes and sequence diagrams into Appendix C.


*Document generated from repository analysis on 29-12-2025.*
