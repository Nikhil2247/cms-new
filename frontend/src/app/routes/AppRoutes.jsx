import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Button, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

// Layout - Using comprehensive Layout with PlaceIntern branding
import Layouts from '../../components/Layout';

// Backend role constants
const ROLES = {
  STATE: 'STATE_DIRECTORATE',
  PRINCIPAL: 'PRINCIPAL',
  FACULTY: ['FACULTY', 'TEACHER', 'FACULTY_SUPERVISOR'],
  STUDENT: 'STUDENT',
  INDUSTRY: ['INDUSTRY', 'INDUSTRY_PARTNER', 'INDUSTRY_SUPERVISOR'],
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
};

// All dashboard-accessible roles
const ALL_ROLES = [
  ROLES.STATE,
  ROLES.PRINCIPAL,
  ...ROLES.FACULTY,
  ROLES.STUDENT,
  ...ROLES.INDUSTRY,
  ROLES.SYSTEM_ADMIN,
];

// Auth
import LoginForm from '../../features/auth/components/LoginForm';
import ForgotPassword from '../../features/auth/components/ForgotPassword';
import ResetPassword from '../../features/auth/components/ResetPassword';
import ChangePassword from '../../features/auth/components/ChangePassword';
import Signup from '../../features/auth/components/Signup';
import StudentSignup from '../../features/auth/components/StudentSignup';
import StudentLogin from '../../features/auth/components/StudentLogin';

// State
import StateDashboard from '../../features/state/dashboard/StateDashboard';
import InstituteManagement from '../../features/state/institutions/InstituteManagement';
import InstitutionBulkUpload from '../../features/state/institutions/BulkUpload';
import { InstitutionOverview } from '../../features/state/overview';
import PrincipalList from '../../features/state/principals/PrincipalList';
import StateStaffList from '../../features/state/staff/StaffList';
import ReportBuilder from '../../features/state/reports/ReportBuilder';
import ReportBuilderDashboard from '../../features/state/reports/ReportBuilderDashboard';
import AuditLogs from '../../features/state/audit/AuditLogs';
import BulkUserCreate from '../../features/state/users/BulkUserCreate';
import CredentialsReset from '../../features/state/users/CredentialsReset';
import CompaniesOverview from '../../features/state/companies/CompaniesOverview';

// Shared
import GrievanceList from '../../features/shared/grievances/GrievanceList';
import NotificationCenter from '../../features/shared/notifications/NotificationCenter';
import SubmitGrievance from '../../features/student/grievances/SubmitGrievance';

// Help & Support
import { HelpCenter, MyQueries, SupportDashboard } from '../../features/help-support';

// Principal
import PrincipalDashboard from '../../features/principal/dashboard/PrincipalDashboard';
import StudentList from '../../features/principal/students/StudentList';
import StudentProgress from '../../features/principal/students/StudentProgress';
import StaffList from '../../features/principal/staff/StaffList';
import MentorAssignment from '../../features/principal/mentors/MentorAssignment';
import BulkUpload from '../../features/principal/bulk/BulkUpload';
import Analytics from '../../features/principal/analytics/Analytics';
import FacultyReports from '../../features/principal/reports/FacultyReports';
import FacultyProgress from '../../features/principal/faculty/FacultyProgress';
import Grievances from '../../features/principal/grievances/Grievances';
import SelfIdentifiedInternships from '../../features/principal/internships/SelfIdentifiedInternships';
import BulkSelfInternshipUpload from '../../features/principal/bulk/BulkSelfInternshipUpload';
import BulkJobHistory from '../../features/common/bulk/BulkJobHistory';

// Faculty
import FacultyDashboard from '../../features/faculty/dashboard/FacultyDashboard';
import VisitLogList from '../../features/faculty/visits/VisitLogList';
import AssignedStudentsList from '../../features/faculty/students/AssignedStudentsList';
import SelfIdentifiedApproval from '../../features/faculty/approvals/SelfIdentifiedApproval';
import MonthlyReportsPage from '../../features/faculty/reports/MonthlyReportsPage';
import JoiningLettersPage from '../../features/faculty/joining-letters/JoiningLettersPage';
import FacultyGrievances from '../../features/faculty/grievances/FacultyGrievances';

// Student
import StudentDashboard from '../../features/student/dashboard/StudentDashboard';
import StudentProfile from '../../features/student/profile/StudentProfile';
import MonthlyReportForm from '../../features/student/reports/MonthlyReportForm';
import StudentReportSubmit from '../../features/student/reports/StudentReportSubmit';
import InternshipList from '../../features/student/internships/InternshipList';
import InternshipDetails from '../../features/student/internships/InternshipDetails';
import MyApplications from '../../features/student/applications/MyApplications';

// Industry
import IndustryDashboard from '../../features/industry/dashboard/IndustryDashboard';
import InternshipPostingList from '../../features/industry/postings/InternshipPostingList';
import ApplicationsList from '../../features/industry/applications/ApplicationsList';
import IndustryProfile from '../../features/industry/profile/IndustryProfile';

// Admin
import { AdminDashboard } from '../../features/admin';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

const AppRoutes = () => {
  const { isAuthenticated } = useSelector((state) => state.auth);

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginForm />
        }
      />
      <Route
        path="/student-login"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <StudentLogin />
        }
      />
      <Route
        path="/signup"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Signup />
        }
      />
      <Route
        path="/student-signup"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <StudentSignup />
        }
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layouts />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* State Routes */}
        <Route
          path="dashboard"
          element={
            <ProtectedRoute allowedRoles={ALL_ROLES}>
              <DashboardRouter />
            </ProtectedRoute>
          }
        />
        <Route
          path="institutions"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <InstituteManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="institutions-overview"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <InstitutionOverview />
            </ProtectedRoute>
          }
        />
        <Route
          path="companies-overview"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <CompaniesOverview />
            </ProtectedRoute>
          }
        />
        <Route
          path="principals"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <PrincipalList />
            </ProtectedRoute>
          }
        />
        <Route
          path="institutions/bulk-upload"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <InstitutionBulkUpload />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports/builder"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <ReportBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports/dashboard"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <ReportBuilderDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="audit-logs"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <AuditLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="grievances"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE, ROLES.PRINCIPAL]}>
              <Grievances />
            </ProtectedRoute>
          }
        />
        <Route
          path="state-staff"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <StateStaffList />
            </ProtectedRoute>
          }
        />
        <Route
          path="users/bulk-create"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <BulkUserCreate />
            </ProtectedRoute>
          }
        />
        <Route
          path="users/reset-credentials"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <CredentialsReset />
            </ProtectedRoute>
          }
        />

        {/* Principal Routes */}
        <Route
          path="students"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
              <StudentList />
            </ProtectedRoute>
          }
        />
        <Route
          path="staff"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
              <StaffList />
            </ProtectedRoute>
          }
        />
        <Route
          path="mentors"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
              <MentorAssignment />
            </ProtectedRoute>
          }
        />
        <Route
          path="bulk-upload"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE, ROLES.PRINCIPAL]}>
              <BulkUpload />
            </ProtectedRoute>
          }
        />
        <Route
          path="analytics"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="student-progress"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
              <StudentProgress />
            </ProtectedRoute>
          }
        />
        <Route
          path="faculty-reports"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
              <FacultyReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="faculty-progress"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
              <FacultyProgress />
            </ProtectedRoute>
          }
        />
        <Route
          path="internships"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
              <SelfIdentifiedInternships />
            </ProtectedRoute>
          }
        />
        <Route
          path="bulk/self-internships"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE, ROLES.PRINCIPAL]}>
              <BulkSelfInternshipUpload />
            </ProtectedRoute>
          }
        />
        <Route
          path="bulk/job-history"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE, ROLES.PRINCIPAL]}>
              <BulkJobHistory />
            </ProtectedRoute>
          }
        />

        {/* Faculty Routes */}
        <Route
          path="visit-logs"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <VisitLogList />
            </ProtectedRoute>
          }
        />
        <Route
          path="assigned-students"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <AssignedStudentsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="approvals"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <SelfIdentifiedApproval />
            </ProtectedRoute>
          }
        />
        <Route
          path="monthly-reports"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <MonthlyReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="joining-letters"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <JoiningLettersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="faculty-grievances"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <FacultyGrievances />
            </ProtectedRoute>
          }
        />

        {/* Student Routes */}
        <Route
          path="profile"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <StudentProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports/new"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <MonthlyReportForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports/submit"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <StudentReportSubmit />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports/:id/edit"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <MonthlyReportForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="internships"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <InternshipList />
            </ProtectedRoute>
          }
        />
        <Route
          path="internships/:id"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <InternshipDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="my-applications"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <MyApplications />
            </ProtectedRoute>
          }
        />
        <Route
          path="submit-grievance"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <SubmitGrievance />
            </ProtectedRoute>
          }
        />

        {/* Industry Routes */}
        <Route
          path="postings"
          element={
            <ProtectedRoute allowedRoles={ROLES.INDUSTRY}>
              <InternshipPostingList />
            </ProtectedRoute>
          }
        />
        <Route
          path="applications"
          element={
            <ProtectedRoute allowedRoles={ROLES.INDUSTRY}>
              <ApplicationsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="company/profile"
          element={
            <ProtectedRoute allowedRoles={ROLES.INDUSTRY}>
              <IndustryProfile />
            </ProtectedRoute>
          }
        />

        {/* Shared Routes */}
        <Route path="notifications" element={<NotificationCenter />} />
        <Route path="change-password" element={<ChangePassword />} />

        {/* Help & Support Routes - Available to all authenticated users */}
        <Route path="help" element={<HelpCenter />} />
        <Route path="my-queries" element={<MyQueries />} />
        <Route
          path="support-dashboard"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <SupportDashboard />
            </ProtectedRoute>
          }
        />

        {/* System Admin Routes */}
        <Route
          path="admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Unauthorized Page */}
      <Route
        path="/unauthorized"
        element={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-red-600 mb-4">Unauthorized</h1>
              <p className="text-gray-600 mb-6">You don't have permission to access this page.</p>
              <Button type="primary" onClick={() => window.history.back()}>
                Go Back
              </Button>
            </div>
          </div>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

// Dashboard Router based on role
const DashboardRouter = () => {
  const { user } = useSelector((state) => state.auth);
  const role = user?.role;

  // System Admin
  if (role === ROLES.SYSTEM_ADMIN) {
    return <AdminDashboard />;
  }
  // State Directorate
  if (role === ROLES.STATE) {
    return <StateDashboard />;
  }
  // Principal
  if (role === ROLES.PRINCIPAL) {
    return <PrincipalDashboard />;
  }
  // Faculty (includes TEACHER, FACULTY_SUPERVISOR)
  if (ROLES.FACULTY.includes(role)) {
    return <FacultyDashboard />;
  }
  // Student
  if (role === ROLES.STUDENT) {
    return <StudentDashboard />;
  }
  // Industry (includes INDUSTRY_PARTNER, INDUSTRY_SUPERVISOR)
  if (ROLES.INDUSTRY.includes(role)) {
    return <IndustryDashboard />;
  }

  return <Navigate to="/login" replace />;
};

export default AppRoutes;