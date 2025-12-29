import {
  DashboardOutlined,
  FileTextOutlined,
  TeamOutlined,
  BankOutlined,
  DatabaseOutlined,
  ShopOutlined,
  LaptopOutlined,
  SolutionOutlined,
  FileDoneOutlined,
  GlobalOutlined,
  BarChartOutlined,
  PieChartOutlined,
  AuditOutlined,
  FileSyncOutlined,
  IdcardOutlined,
  PushpinOutlined,
  SafetyCertificateOutlined,
  DeploymentUnitOutlined,
  AlertOutlined,
  LockOutlined,
  ExclamationCircleOutlined,
  UsergroupAddOutlined,
  LineChartOutlined,
  SafetyOutlined,
  SwapOutlined,
  UploadOutlined,
  SettingOutlined,
  CarOutlined,
  CustomerServiceOutlined,
  QuestionCircleOutlined,
  MessageOutlined,
  HistoryOutlined,
  CloudUploadOutlined,
  SendOutlined,
} from '@ant-design/icons';
import React from 'react';

export const menuConfig = {
  // ==========================================
  // STATE DIRECTORATE MENUS
  // ==========================================
  STATE_HOME: {
    key: 'state-home',
    title: 'Home',
    icon: <DashboardOutlined />,
    items: [
      { key: 'state-dashboard', label: 'Dashboard', icon: <DashboardOutlined />, path: '/dashboard' },
      { key: 'report-builder', label: 'Report Builder', icon: <BarChartOutlined />, path: '/reports/builder' },
    ],
  },
  STATE_INSTITUTIONS: {
    key: 'state-institutions',
    title: 'Institutions',
    icon: <BankOutlined />,
    items: [
      { key: 'institutions-overview', label: 'Overview', icon: <GlobalOutlined />, path: '/institutions-overview' },
      { key: 'institutions-list', label: 'All Institutions', icon: <BankOutlined />, path: '/institutions' },
      { key: 'principals-list', label: 'Principals', icon: <TeamOutlined />, path: '/principals' },
    ],
  },
  STATE_COMPANIES: {
    key: 'state-companies',
    title: 'Companies',
    icon: <ShopOutlined />,
    items: [
      { key: 'companies-overview', label: 'Overview', icon: <ShopOutlined />, path: '/companies-overview' },
      { key: 'student-grievances', label: 'Grievances', icon: <AlertOutlined />, path: '/grievances' },
    ],
  },
  STATE_BULK: {
    key: 'state-bulk',
    title: 'Bulk Operations',
    icon: <CloudUploadOutlined />,
    items: [
      { key: 'bulk-institute-upload', label: 'Institutions', icon: <BankOutlined />, path: '/institutions/bulk-upload' },
      { key: 'bulk-staff-upload', label: 'Staff/Students', icon: <TeamOutlined />, path: '/bulk-upload' },
      { key: 'bulk-internship-upload', label: 'Internships', icon: <LaptopOutlined />, path: '/bulk/self-internships' },
      { key: 'bulk-job-history', label: 'Job History', icon: <HistoryOutlined />, path: '/bulk/job-history' },
    ],
  },
  STATE_SYSTEM: {
    key: 'state-system',
    title: 'System',
    icon: <SettingOutlined />,
    items: [
      { key: 'master-data', label: 'Master Data', icon: <DatabaseOutlined />, path: '/master-data' },
      { key: 'state-staff-list', label: 'Staff', icon: <SolutionOutlined />, path: '/state-staff' },
      { key: 'bulk-user-creation', label: 'Bulk Users', icon: <UsergroupAddOutlined />, path: '/users/bulk-create' },
      { key: 'credentials-reset', label: 'Reset Credentials', icon: <LockOutlined />, path: '/users/reset-credentials' },
      { key: 'audit-logs', label: 'Audit Logs', icon: <AuditOutlined />, path: '/audit-logs' },
    ],
  },

  // ==========================================
  // PRINCIPAL MENUS
  // ==========================================
  PRINCIPAL_HOME: {
    key: 'principal-home',
    title: 'Home',
    icon: <DashboardOutlined />,
    items: [
      { key: 'principal-overview', label: 'Overview', icon: <GlobalOutlined />, path: '/overview' },
      { key: 'principal-dashboard', label: 'Full Dashboard', icon: <DashboardOutlined />, path: '/dashboard' },
    ],
  },
  PRINCIPAL_PEOPLE: {
    key: 'principal-people',
    title: 'People',
    icon: <TeamOutlined />,
    items: [
      { key: 'students-list', label: 'Students', icon: <TeamOutlined />, path: '/students' },
      { key: 'staff-list', label: 'Staff', icon: <SolutionOutlined />, path: '/staff' },
      { key: 'mentor-assignment', label: 'Mentor Assignment', icon: <SolutionOutlined />, path: '/mentors' },
    ],
  },
  PRINCIPAL_INTERNSHIP: {
    key: 'principal-internship',
    title: 'Internships',
    icon: <LaptopOutlined />,
    items: [
      { key: 'all-internships', label: 'All Internships', icon: <LaptopOutlined />, path: '/internships' },
      { key: 'faculty-progress', label: 'Faculty Progress', icon: <CarOutlined />, path: '/faculty-progress' },
      { key: 'student-grievances', label: 'Grievances', icon: <AlertOutlined />, path: '/grievances' },
    ],
  },
  PRINCIPAL_OPERATIONS: {
    key: 'principal-operations',
    title: 'Operations',
    icon: <CloudUploadOutlined />,
    items: [
      { key: 'bulk-staff-upload', label: 'Bulk Upload', icon: <UploadOutlined />, path: '/bulk-upload' },
      { key: 'bulk-internship-upload', label: 'Bulk Internships', icon: <UploadOutlined />, path: '/bulk/self-internships' },
      { key: 'bulk-job-history', label: 'Job History', icon: <HistoryOutlined />, path: '/bulk/job-history' },
    ],
  },

  // ==========================================
  // FACULTY MENUS
  // ==========================================
  FACULTY_HOME: {
    key: 'faculty-home',
    title: 'Home',
    icon: <DashboardOutlined />,
    items: [
      { key: 'supervision-dashboard', label: 'Dashboard', icon: <DashboardOutlined />, path: '/dashboard' },
      { key: 'assigned-students', label: 'My Students', icon: <TeamOutlined />, path: '/assigned-students' },
    ],
  },
  FACULTY_SUPERVISION: {
    key: 'faculty-supervision',
    title: 'Supervision',
    icon: <SolutionOutlined />,
    items: [
      { key: 'visit-logs', label: 'Visit Logs', icon: <FileDoneOutlined />, path: '/visit-logs' },
      { key: 'monthly-reports', label: 'Monthly Reports', icon: <FileTextOutlined />, path: '/monthly-reports' },
      { key: 'joining-letters', label: 'Joining Letters', icon: <SafetyCertificateOutlined />, path: '/joining-letters' },
      { key: 'pending-approvals', label: 'Pending Approvals', icon: <AuditOutlined />, path: '/approvals' },
    ],
  },
  FACULTY_COMMUNICATION: {
    key: 'faculty-communication',
    title: 'Communication',
    icon: <SendOutlined />,
    items: [
      { key: 'faculty-grievances', label: 'Grievances', icon: <AlertOutlined />, path: '/faculty-grievances' },
    ],
  },

  // ==========================================
  // STUDENT MENUS
  // ==========================================
  STUDENT_HOME: {
    key: 'student-home',
    title: 'Home',
    icon: <DashboardOutlined />,
    items: [
      { key: 'student-dashboard', label: 'Dashboard', icon: <DashboardOutlined />, path: '/dashboard' },
      { key: 'profile', label: 'My Profile', icon: <IdcardOutlined />, path: '/profile' },
    ],
  },
  STUDENT_INTERNSHIP: {
    key: 'student-internship',
    title: 'Internship',
    icon: <LaptopOutlined />,
    items: [
      { key: 'my-applications', label: 'My Internship', icon: <LaptopOutlined />, path: '/my-applications' },
      { key: 'monthly-reports', label: 'Monthly Reports', icon: <FileTextOutlined />, path: '/reports/submit' },
      { key: 'submit-grievance', label: 'Submit Grievance', icon: <AlertOutlined />, path: '/submit-grievance' },
    ],
  },

  // ==========================================
  // INDUSTRY MENUS
  // ==========================================
  INDUSTRY_PORTAL: {
    key: 'industry-portal',
    title: 'Industry Portal',
    icon: <ShopOutlined />,
    items: [
      { key: 'industry-dashboard', label: 'Dashboard', icon: <DashboardOutlined />, path: '/dashboard' },
      { key: 'postings', label: 'Internship Postings', icon: <PushpinOutlined />, path: '/postings' },
      { key: 'applications', label: 'Applications', icon: <FileSyncOutlined />, path: '/applications' },
      { key: 'industry-profile', label: 'Company Profile', icon: <IdcardOutlined />, path: '/company/profile' },
    ],
  },

  // ==========================================
  // SYSTEM ADMIN MENUS
  // ==========================================
  SYSTEM_ADMIN_HOME: {
    key: 'admin-home',
    title: 'Home',
    icon: <DashboardOutlined />,
    items: [
      { key: 'system-admin-dashboard', label: 'Dashboard', icon: <DashboardOutlined />, path: '/admin/dashboard' },
      { key: 'system-health', label: 'System Health', icon: <SafetyCertificateOutlined />, path: '/admin/health' },
      { key: 'analytics', label: 'Analytics', icon: <LineChartOutlined />, path: '/admin/analytics' },
    ],
  },
  SYSTEM_ADMIN_USERS: {
    key: 'admin-users',
    title: 'Users',
    icon: <TeamOutlined />,
    items: [
      { key: 'all-users', label: 'All Users', icon: <UsergroupAddOutlined />, path: '/admin/users' },
      { key: 'active-sessions', label: 'Sessions', icon: <LaptopOutlined />, path: '/admin/sessions' },
      { key: 'security-insights', label: 'Security', icon: <SafetyOutlined />, path: '/admin/security' },
    ],
  },
  SYSTEM_ADMIN_DATA: {
    key: 'admin-data',
    title: 'Data & Backups',
    icon: <DatabaseOutlined />,
    items: [
      { key: 'backup-management', label: 'Backups', icon: <CloudUploadOutlined />, path: '/admin/backups' },
      { key: 'backup-schedules', label: 'Schedules', icon: <HistoryOutlined />, path: '/admin/backup-schedules' },
      { key: 'audit-logs', label: 'Audit Logs', icon: <AuditOutlined />, path: '/admin/audit-logs' },
    ],
  },
  SYSTEM_ADMIN_CONFIG: {
    key: 'admin-config',
    title: 'Settings',
    icon: <SettingOutlined />,
    items: [
      { key: 'system-settings', label: 'System Settings', icon: <SettingOutlined />, path: '/admin/settings' },
      { key: 'feature-flags', label: 'Feature Flags', icon: <SwapOutlined />, path: '/admin/features' },
    ],
  },
  SYSTEM_ADMIN_SUPPORT: {
    key: 'admin-support',
    title: 'Support',
    icon: <CustomerServiceOutlined />,
    items: [
      { key: 'technical-queries', label: 'Queries', icon: <ExclamationCircleOutlined />, path: '/admin/queries' },
      { key: 'system-alerts', label: 'Alerts', icon: <AlertOutlined />, path: '/admin/alerts' },
    ],
  },


  // ==========================================
  // SUPPORT (All Users)
  // ==========================================
  SUPPORT: {
    key: 'support',
    title: 'Help & Support',
    icon: <CustomerServiceOutlined />,
    items: [
      { key: 'help-center', label: 'Help Center', icon: <QuestionCircleOutlined />, path: '/help' },
      { key: 'my-queries', label: 'My Queries', icon: <MessageOutlined />, path: '/my-queries' },
    ],
  },

  // ==========================================
  // SUPPORT ADMIN (STATE_DIRECTORATE Only)
  // ==========================================
  SUPPORT_ADMIN: {
    key: 'support-admin',
    title: 'Support Management',
    icon: <CustomerServiceOutlined />,
    items: [
      { key: 'support-dashboard', label: 'Support Dashboard', icon: <DashboardOutlined />, path: '/support-dashboard' },
      { key: 'help-center', label: 'Help Center', icon: <QuestionCircleOutlined />, path: '/help' },
      { key: 'my-queries', label: 'My Queries', icon: <MessageOutlined />, path: '/my-queries' },
    ],
  },
};

export const getMenuSectionsForRole = (role) => {
  const sections = [];

  switch (role) {
    case 'STATE_DIRECTORATE':
      sections.push(menuConfig.STATE_HOME);
      sections.push(menuConfig.STATE_INSTITUTIONS);
      sections.push(menuConfig.STATE_COMPANIES);
      sections.push(menuConfig.STATE_BULK);
      sections.push(menuConfig.STATE_SYSTEM);
      break;

    case 'PRINCIPAL':
      sections.push(menuConfig.PRINCIPAL_HOME);
      sections.push(menuConfig.PRINCIPAL_PEOPLE);
      sections.push(menuConfig.PRINCIPAL_INTERNSHIP);
      sections.push(menuConfig.PRINCIPAL_OPERATIONS);
      break;

    case 'FACULTY':
    case 'TEACHER':
    case 'FACULTY_SUPERVISOR':
      sections.push(menuConfig.FACULTY_HOME);
      sections.push(menuConfig.FACULTY_SUPERVISION);
      sections.push(menuConfig.FACULTY_COMMUNICATION);
      break;

    case 'STUDENT':
      sections.push(menuConfig.STUDENT_HOME);
      sections.push(menuConfig.STUDENT_INTERNSHIP);
      break;

    case 'INDUSTRY':
    case 'INDUSTRY_PARTNER':
    case 'INDUSTRY_SUPERVISOR':
      sections.push(menuConfig.INDUSTRY_PORTAL);
      break;

    case 'SYSTEM_ADMIN':
      sections.push(menuConfig.SYSTEM_ADMIN_HOME);
      sections.push(menuConfig.SYSTEM_ADMIN_USERS);
      sections.push(menuConfig.SYSTEM_ADMIN_DATA);
      sections.push(menuConfig.SYSTEM_ADMIN_CONFIG);
      sections.push(menuConfig.SYSTEM_ADMIN_SUPPORT);
      break;

    case 'ADMISSION_OFFICER':
      sections.push(menuConfig.PRINCIPAL_PEOPLE);
      break;

    default:
      break;
  }

  // Add Support menu for all logged-in users
  // STATE_DIRECTORATE gets the admin version with Support Dashboard
  if (role) {
    if (role === 'STATE_DIRECTORATE') {
      sections.push(menuConfig.SUPPORT_ADMIN);
    } else {
      sections.push(menuConfig.SUPPORT);
    }
  }

  return sections;
};