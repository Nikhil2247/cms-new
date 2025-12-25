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
  ProfileOutlined,
  FileSyncOutlined,
  IdcardOutlined,
  PushpinOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  DeploymentUnitOutlined,
  HomeOutlined,
  AlertOutlined,
  LockOutlined,
  ExclamationCircleOutlined,
  BookOutlined,
  UsergroupAddOutlined,
  SearchOutlined,
  FormOutlined,
  FolderOpenOutlined,
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
  BellOutlined,
  SendOutlined,
} from '@ant-design/icons';
import React from 'react';

export const menuConfig = {
  // ==========================================
  // STATE DIRECTORATE MENUS
  // ==========================================
  STATE_OVERVIEW: {
    key: 'state-overview',
    title: 'State Overview',
    icon: <GlobalOutlined />,
    items: [
      { key: 'state-dashboard', label: 'Dashboard', icon: <DashboardOutlined />, path: '/dashboard' },
      { key: 'institutions-overview', label: 'Institutions Overview', icon: <BankOutlined />, path: '/institutions-overview' },
      { key: 'companies-overview', label: 'Companies Overview', icon: <ShopOutlined />, path: '/companies-overview' },
      { key: 'report-builder', label: 'Report Builder', icon: <BarChartOutlined />, path: '/reports/builder' },
      { key: 'send-announcement', label: 'Send Announcement', icon: <SendOutlined />, path: '/send-notification' },
      { key: 'audit-logs', label: 'Audit Logs', icon: <AuditOutlined />, path: '/audit-logs' },
    ],
  },
  STATE_OPERATIONS: {
    key: 'state-operations',
    title: 'Operations',
    icon: <DeploymentUnitOutlined />,
    items: [
      { key: 'institutions-list', label: 'All Institutions', icon: <BankOutlined />, path: '/institutions' },
      { key: 'student-grievances', label: 'Grievances', icon: <AlertOutlined />, path: '/grievances' },
    ],
  },
  STATE_BULK_OPERATIONS: {
    key: 'state-bulk-operations',
    title: 'Bulk Operations',
    icon: <CloudUploadOutlined />,
    items: [
      { key: 'bulk-institute-upload', label: 'Bulk Institutions', icon: <BankOutlined />, path: '/institutions/bulk-upload' },
      { key: 'bulk-staff-upload', label: 'Bulk Staff/Students', icon: <TeamOutlined />, path: '/bulk-upload' },
      { key: 'bulk-internship-upload', label: 'Bulk Self Internships', icon: <LaptopOutlined />, path: '/bulk/self-internships' },
      { key: 'bulk-job-history', label: 'Job History', icon: <HistoryOutlined />, path: '/bulk/job-history' },
    ],
  },
  STATE_USERS: {
    key: 'state-users',
    title: 'Users & Access',
    icon: <UsergroupAddOutlined />,
    items: [
      { key: 'principals-list', label: 'All Principals', icon: <TeamOutlined />, path: '/principals' },
      { key: 'state-staff-list', label: 'All Staff', icon: <SolutionOutlined />, path: '/state-staff' },
      { key: 'bulk-user-creation', label: 'Bulk Users', icon: <UsergroupAddOutlined />, path: '/users/bulk-create' },
      { key: 'credentials-reset', label: 'Reset Credentials', icon: <LockOutlined />, path: '/users/reset-credentials' },
    ],
  },

  // ==========================================
  // PRINCIPAL MENUS
  // ==========================================
  PRINCIPAL: {
    key: 'principal',
    title: 'Administration',
    icon: <SafetyOutlined />,
    items: [
      { key: 'principal-dashboard', label: 'Dashboard', icon: <DashboardOutlined />, path: '/dashboard' },
      { key: 'staff-list', label: 'Staff List', icon: <TeamOutlined />, path: '/staff' },
      { key: 'send-announcement', label: 'Send Announcement', icon: <BellOutlined />, path: '/send-notification' },
    ],
  },
  BULK_OPERATIONS: {
    key: 'bulk-operations',
    title: 'Bulk Operations',
    icon: <CloudUploadOutlined />,
    items: [
      { key: 'bulk-staff-upload', label: 'Bulk Upload Staff/Students', icon: <UploadOutlined />, path: '/bulk-upload' },
      { key: 'bulk-internship-upload', label: 'Bulk Self Internships', icon: <UploadOutlined />, path: '/bulk/self-internships' },
      { key: 'bulk-job-history', label: 'Job History', icon: <HistoryOutlined />, path: '/bulk/job-history' },
    ],
  },
  STUDENTS: {
    key: 'students',
    title: 'Students',
    icon: <TeamOutlined />,
    items: [
      { key: 'students-list', label: 'All Students', icon: <TeamOutlined />, path: '/students' },
      { key: 'mentor-assignment', label: 'Mentor Assignment', icon: <SolutionOutlined />, path: '/mentors' },
    ],
  },
  PRINCIPAL_INTERNSHIP: {
    key: 'principal-internship',
    title: 'Internship Management',
    icon: <LaptopOutlined />,
    items: [
      { key: 'all-internships', label: 'All Internships', icon: <SolutionOutlined />, path: '/internships' },
      { key: 'internship-analytics', label: 'Analytics & Reports', icon: <PieChartOutlined />, path: '/analytics' },
      { key: 'student-progress', label: 'Student Progress', icon: <LineChartOutlined />, path: '/student-progress' },
      { key: 'faculty-progress', label: 'Faculty Progress', icon: <CarOutlined />, path: '/faculty-progress' },
      { key: 'faculty-visit-reports', label: 'Faculty Reports', icon: <FileDoneOutlined />, path: '/faculty-reports' },
      { key: 'student-grievances', label: 'Grievances', icon: <AlertOutlined />, path: '/grievances' },
    ],
  },

  // ==========================================
  // FACULTY MENUS
  // ==========================================
  FACULTY_SUPERVISION: {
    key: 'faculty-supervision',
    title: 'Faculty Supervision',
    icon: <SolutionOutlined />,
    items: [
      { key: 'supervision-dashboard', label: 'Dashboard', icon: <DashboardOutlined />, path: '/dashboard' },
      { key: 'assigned-students', label: 'Assigned Students', icon: <TeamOutlined />, path: '/assigned-students' },
      { key: 'visit-logs', label: 'Visit Logs', icon: <FileDoneOutlined />, path: '/visit-logs' },
      { key: 'faculty-grievances', label: 'Grievances', icon: <AlertOutlined />, path: '/faculty-grievances' },
      { key: 'send-reminder', label: 'Send Reminder', icon: <SendOutlined />, path: '/send-notification' },
    ],
  },

  // ==========================================
  // STUDENT MENUS
  // ==========================================
  STUDENT: {
    key: 'student',
    title: 'Student Portal',
    icon: <IdcardOutlined />,
    items: [
      { key: 'student-dashboard', label: 'Dashboard', icon: <DashboardOutlined />, path: '/dashboard' },
      { key: 'profile', label: 'My Profile', icon: <IdcardOutlined />, path: '/profile' },
    ],
  },
  INTERNSHIP_PORTAL: {
    key: 'internship-portal',
    title: 'Internship',
    icon: <LaptopOutlined />,
    items: [
      { key: 'my-applications', label: 'My Applications', icon: <FileSyncOutlined />, path: '/my-applications' },
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
  SYSTEM_ADMIN_OVERVIEW: {
    key: 'admin-overview',
    title: 'Overview',
    icon: <DashboardOutlined />,
    items: [
      { key: 'system-admin-dashboard', label: 'Dashboard', icon: <DashboardOutlined />, path: '/admin/dashboard' },
      { key: 'system-health', label: 'System Health', icon: <SafetyCertificateOutlined />, path: '/admin/health' },
      { key: 'analytics', label: 'Analytics', icon: <LineChartOutlined />, path: '/admin/analytics' },
      { key: 'send-system-notification', label: 'Send Announcement', icon: <SendOutlined />, path: '/send-notification' },
    ],
  },
  SYSTEM_ADMIN_USERS: {
    key: 'admin-users',
    title: 'User Management',
    icon: <TeamOutlined />,
    items: [
      { key: 'all-users', label: 'All Users', icon: <UsergroupAddOutlined />, path: '/admin/users' },
      { key: 'active-sessions', label: 'Active Sessions', icon: <LaptopOutlined />, path: '/admin/sessions' },
      { key: 'security-insights', label: 'Security Insights', icon: <SafetyOutlined />, path: '/admin/security' },
    ],
  },
  SYSTEM_ADMIN_BACKUP: {
    key: 'admin-backup',
    title: 'Backup & Restore',
    icon: <DatabaseOutlined />,
    items: [
      { key: 'backup-management', label: 'Backup Management', icon: <CloudUploadOutlined />, path: '/admin/backups' },
      { key: 'backup-schedules', label: 'Scheduled Backups', icon: <HistoryOutlined />, path: '/admin/backup-schedules' },
    ],
  },
  SYSTEM_ADMIN_CONFIG: {
    key: 'admin-config',
    title: 'Configuration',
    icon: <SettingOutlined />,
    items: [
      { key: 'system-settings', label: 'System Settings', icon: <SettingOutlined />, path: '/admin/settings' },
      { key: 'feature-flags', label: 'Feature Flags', icon: <SwapOutlined />, path: '/admin/features' },
      { key: 'audit-logs', label: 'Audit Logs', icon: <AuditOutlined />, path: '/admin/audit-logs' },
    ],
  },
  SYSTEM_ADMIN_SUPPORT: {
    key: 'admin-support',
    title: 'Support',
    icon: <CustomerServiceOutlined />,
    items: [
      { key: 'technical-queries', label: 'Technical Queries', icon: <ExclamationCircleOutlined />, path: '/admin/queries' },
      { key: 'system-alerts', label: 'System Alerts', icon: <AlertOutlined />, path: '/admin/alerts' },
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
      sections.push(menuConfig.STATE_OVERVIEW);
      sections.push(menuConfig.STATE_OPERATIONS);
      sections.push(menuConfig.STATE_BULK_OPERATIONS);
      sections.push(menuConfig.STATE_USERS);
      break;

    case 'PRINCIPAL':
      sections.push(menuConfig.PRINCIPAL);
      sections.push(menuConfig.STUDENTS);
      sections.push(menuConfig.PRINCIPAL_INTERNSHIP);
      sections.push(menuConfig.BULK_OPERATIONS);
      break;

    case 'FACULTY':
    case 'TEACHER':
    case 'FACULTY_SUPERVISOR':
      sections.push(menuConfig.FACULTY_SUPERVISION);
      break;

    case 'STUDENT':
      sections.push(menuConfig.STUDENT);
      sections.push(menuConfig.INTERNSHIP_PORTAL);
      break;

    case 'INDUSTRY':
    case 'INDUSTRY_PARTNER':
    case 'INDUSTRY_SUPERVISOR':
      sections.push(menuConfig.INDUSTRY_PORTAL);
      break;

    case 'SYSTEM_ADMIN':
      sections.push(menuConfig.SYSTEM_ADMIN_OVERVIEW);
      sections.push(menuConfig.SYSTEM_ADMIN_USERS);
      sections.push(menuConfig.SYSTEM_ADMIN_BACKUP);
      sections.push(menuConfig.SYSTEM_ADMIN_CONFIG);
      sections.push(menuConfig.SYSTEM_ADMIN_SUPPORT);
      break;

    case 'ADMISSION_OFFICER':
      sections.push(menuConfig.STUDENTS);
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