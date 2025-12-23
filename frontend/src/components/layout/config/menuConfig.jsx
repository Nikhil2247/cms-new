import {
  DashboardOutlined,
  FileTextOutlined,
  TeamOutlined,
  BankOutlined,
  UserAddOutlined,
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
  FileAddOutlined,
  UploadOutlined,
  SettingOutlined,
  CarOutlined,
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
      { key: 'report-builder', label: 'Report Builder', icon: <BarChartOutlined />, path: '/reports/builder' },
      { key: 'audit-logs', label: 'Audit Logs', icon: <AuditOutlined />, path: '/audit-logs' },
    ],
  },
  STATE_OPERATIONS: {
    key: 'state-operations',
    title: 'Operations',
    icon: <DeploymentUnitOutlined />,
    items: [
      { key: 'institutions-list', label: 'All Institutions', icon: <BankOutlined />, path: '/institutions' },
      { key: 'institutions-new', label: 'Add Institution', icon: <UserAddOutlined />, path: '/institutions/new' },
      { key: 'bulk-institute-upload', label: 'Bulk Upload', icon: <UploadOutlined />, path: '/institutions/bulk-upload' },
      { key: 'student-grievances', label: 'Grievances', icon: <AlertOutlined />, path: '/grievances' },
    ],
  },
  STATE_USERS: {
    key: 'state-users',
    title: 'Users & Access',
    icon: <UsergroupAddOutlined />,
    items: [
      { key: 'principals-list', label: 'All Principals', icon: <TeamOutlined />, path: '/principals' },
      { key: 'principals-new', label: 'Add Principal', icon: <UserAddOutlined />, path: '/principals/new' },
      { key: 'state-staff-list', label: 'All Staff', icon: <SolutionOutlined />, path: '/state-staff' },
      { key: 'state-staff-new', label: 'Add Staff', icon: <UserAddOutlined />, path: '/state-staff/new' },
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
      { key: 'staff-new', label: 'Add Staff', icon: <UserAddOutlined />, path: '/staff/new' },
      { key: 'bulk-staff-upload', label: 'Bulk Upload Staff', icon: <UploadOutlined />, path: '/bulk-upload' },
    ],
  },
  STUDENTS: {
    key: 'students',
    title: 'Students',
    icon: <TeamOutlined />,
    items: [
      { key: 'students-list', label: 'All Students', icon: <TeamOutlined />, path: '/students' },
      { key: 'student-create', label: 'Register Student', icon: <UserAddOutlined />, path: '/students/new' },
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
      { key: 'visit-log-new', label: 'Log New Visit', icon: <FileAddOutlined />, path: '/visit-logs/new' },
    ],
  },

  // ==========================================
  // STUDENT MENUS
  // ==========================================
  STUDENT: {
    key: 'student',
    title: 'Student Profile',
    icon: <IdcardOutlined />,
    items: [
      { key: 'student-dashboard', label: 'Dashboard', icon: <DashboardOutlined />, path: '/dashboard' },
      { key: 'profile', label: 'My Profile', icon: <IdcardOutlined />, path: '/profile' },
      { key: 'profile-edit', label: 'Edit Profile', icon: <FormOutlined />, path: '/profile/edit' },
    ],
  },
  INTERNSHIP_PORTAL: {
    key: 'internship-portal',
    title: 'Internship Portal',
    icon: <LaptopOutlined />,
    items: [
      { key: 'internships', label: 'Browse Internships', icon: <SearchOutlined />, path: '/internships' },
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
  SYSTEM_ADMIN: {
    key: 'system-admin',
    title: 'System Administration',
    icon: <SafetyCertificateOutlined />,
    items: [
      { key: 'system-admin-dashboard', label: 'Dashboard', icon: <DashboardOutlined />, path: '/admin/dashboard' },
      { key: 'technical-queries', label: 'Technical Queries', icon: <ExclamationCircleOutlined />, path: '/support/queries' },
      { key: 'audit-logs', label: 'Audit Logs', icon: <AuditOutlined />, path: '/audit-logs' },
      { key: 'settings', label: 'System Settings', icon: <SettingOutlined />, path: '/admin/settings' },
    ],
  },

  // ==========================================
  // SUPPORT (All Users)
  // ==========================================
  SUPPORT: {
    key: 'support',
    title: 'Help & Support',
    icon: <ExclamationCircleOutlined />,
    items: [
      { key: 'my-queries', label: 'My Queries', icon: <FileTextOutlined />, path: '/support/queries' },
    ],
  },
};

export const getMenuSectionsForRole = (role) => {
  const sections = [];

  switch (role) {
    case 'STATE_DIRECTORATE':
      sections.push(menuConfig.STATE_OVERVIEW);
      sections.push(menuConfig.STATE_OPERATIONS);
      sections.push(menuConfig.STATE_USERS);
      break;

    case 'PRINCIPAL':
      sections.push(menuConfig.PRINCIPAL);
      sections.push(menuConfig.STUDENTS);
      sections.push(menuConfig.PRINCIPAL_INTERNSHIP);
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
      sections.push(menuConfig.SYSTEM_ADMIN);
      break;

    case 'ADMISSION_OFFICER':
      sections.push(menuConfig.STUDENTS);
      break;

    default:
      break;
  }

  // Add Support menu for all logged-in users
  if (role) {
    sections.push(menuConfig.SUPPORT);
  }

  return sections;
};