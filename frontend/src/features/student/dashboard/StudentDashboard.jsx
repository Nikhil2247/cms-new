import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  Row,
  Col,
  Spin,
  Alert,
  Card,
  Typography,
  Button,
  Tag,
  Empty,
  Upload,
  Modal,
  message,
  Tooltip,
  Select,
  Form,
  Input,
  Avatar,
  Space,
  List,
  Descriptions,
} from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  BankOutlined,
  PlusOutlined,
  UploadOutlined,
  CalendarOutlined,
  EyeOutlined,
  LaptopOutlined,
  BookOutlined,
  FireOutlined,
  ClockCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import toast from 'react-hot-toast';

import { useStudentDashboard } from '../hooks/useStudentDashboard';
import { selectInstitute } from '../../../store/slices/instituteSlice';
import studentService from '../../../services/student.service';
import { getImageUrl, openFileWithPresignedUrl } from '../../../utils/imageUtils';

dayjs.extend(isSameOrBefore);

const { Title, Text, Paragraph } = Typography;

const REPORT_STATUS_COLORS = {
  DRAFT: 'default',
  SUBMITTED: 'blue',
  UNDER_REVIEW: 'gold',
  APPROVED: 'green',
  REJECTED: 'red',
  REVISION_REQUIRED: 'orange',
};

// Status Card Component
const StatusCard = memo(({
  icon,
  iconBgColor,
  iconColor,
  title,
  value,
  secondaryValue,
  statusTag,
  statusColor,
  subtitle,
  onViewAction,
  onAddAction,
  showViewAction,
  showAddAction,
  onClick,
  pendingItems = [],
}) => (
  <Card
    className={`h-full border border-gray-200 rounded-xl hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
    styles={{ body: { padding: '16px' } }}
    onClick={onClick}
  >
    {/* Action buttons row - fixed at top */}
    <div className="flex justify-between items-center mb-2 h-6">
      {showViewAction ? (
        <Tooltip title="View">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined className="text-xs" />}
            onClick={(e) => { e.stopPropagation(); onViewAction?.(); }}
            className="w-6 h-6 min-w-0 p-0 text-text-tertiary hover:text-primary"
          />
        </Tooltip>
      ) : (
        <div className="w-6" />
      )}

      {showAddAction ? (
        <Tooltip title="Upload">
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined className="text-xs" />}
            onClick={(e) => { e.stopPropagation(); onAddAction?.(); }}
            className="w-6 h-6 min-w-0 p-0 text-text-tertiary hover:text-primary"
          />
        </Tooltip>
      ) : (
        <div className="w-6" />
      )}
    </div>

    <div className="text-center">
      <div
        className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3"
        style={{ backgroundColor: iconBgColor }}
      >
        {React.cloneElement(icon, { style: { fontSize: '20px', color: iconColor } })}
      </div>

      <Text strong className="block text-sm text-gray-600 mb-2">
        {title}
      </Text>

      {value !== undefined && (
        <div className="text-2xl font-bold text-gray-800 mb-1">
          {value}
          {secondaryValue !== undefined && (
            <>
              <span className="text-gray-400">/</span>
              <span className="text-gray-500">{secondaryValue}</span>
            </>
          )}
        </div>
      )}

      {statusTag && (
        <Tag color={statusColor} className="!px-3 !py-0.5 text-xs">
          {statusTag}
        </Tag>
      )}

      {pendingItems.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="flex flex-wrap gap-1 justify-center">
            {pendingItems.slice(0, 3).map((item, index) => (
              <Tag key={index} color="warning" className="!px-2 !py-0.5 !m-0 text-[10px]">
                {item}
              </Tag>
            ))}
          </div>
          {pendingItems.length > 3 && (
            <Text type="secondary" className="text-[10px]">
              +{pendingItems.length - 3} more
            </Text>
          )}
        </div>
      )}

      {subtitle && (
        <Text className="text-[10px] text-text-tertiary mt-1 block">{subtitle}</Text>
      )}
    </div>
  </Card>
));

StatusCard.displayName = 'StatusCard';

// Faculty Mentor Card Component
const FacultyMentorCard = memo(({ mentor, visitCount = 0, onAddMentor }) => (
  <Card
    className="border border-gray-200 rounded-xl h-full"
    styles={{ body: { padding: 0, position: 'relative' } }}
  >
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
      <div className="w-1 h-5 rounded-full bg-purple-500" />
      <Text className="text-sm font-semibold text-text-primary">Faculty Mentor</Text>
    </div>

    <div className="p-4">
      <Space direction="vertical" className="w-full" size="middle">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Text type="secondary" className="text-xs block mb-1">Mentor Name</Text>
            <Text strong className="text-sm block">{mentor?.name || 'Not Assigned'}</Text>
            {mentor?.designation && mentor.designation !== 'N/A' && (
              <Text type="secondary" className="text-xs block mt-0.5">{mentor.designation}</Text>
            )}
          </div>
          <Avatar
            size={44}
            icon={<UserOutlined />}
            className="!bg-purple-100 !text-purple-600 shrink-0"
          />
        </div>

        {mentor?.email && (
          <div>
            <Text type="secondary" className="text-xs block mb-1">Email</Text>
            <Text className="text-xs break-all">{mentor.email}</Text>
          </div>
        )}

        {mentor?.contact && (
          <div>
            <Text type="secondary" className="text-xs block mb-1">Contact</Text>
            <Text className="text-xs">{mentor.contact}</Text>
          </div>
        )}

        <div>
          <Text type="secondary" className="text-xs block mb-1">Faculty Visits</Text>
          <Text strong className="text-base">{visitCount}</Text>
        </div>
      </Space>
    </div>
  </Card>
));

FacultyMentorCard.displayName = 'FacultyMentorCard';

// Industry Supervisor Card Component
const IndustrySupervisorCard = memo(({ supervisor, onAddSupervisor }) => (
  <Card
    className="border border-gray-200 rounded-xl h-full"
    styles={{ body: { padding: 0, position: 'relative' } }}
  >
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
      <div className="w-1 h-5 rounded-full bg-orange-500" />
      <Text className="text-sm font-semibold text-text-primary">Industry Supervisor</Text>
    </div>

    <div className="p-4">
      <Space direction="vertical" className="w-full" size="middle">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Text type="secondary" className="text-xs block mb-1">Supervisor Name</Text>
            <Text strong className="text-sm block">{supervisor?.name || 'Not Provided'}</Text>
            {supervisor?.designation && supervisor.designation !== 'N/A' && (
              <Text type="secondary" className="text-xs block mt-0.5">{supervisor.designation}</Text>
            )}
          </div>
          <Avatar
            size={44}
            icon={<BankOutlined />}
            className="!bg-orange-100 !text-orange-600 shrink-0"
          />
        </div>

        <Row gutter={16}>
          <Col span={12}>
            <Text type="secondary" className="text-xs block mb-1">Contact</Text>
            <Text className="text-xs">{supervisor?.phone || supervisor?.contact || 'N/A'}</Text>
          </Col>
          <Col span={12}>
            <Text type="secondary" className="text-xs block mb-1">Email</Text>
            <Text className="text-xs truncate block">{supervisor?.email || 'N/A'}</Text>
          </Col>
        </Row>

        {supervisor?.company && (
          <div>
            <Text type="secondary" className="text-xs block mb-1">Company</Text>
            <Text className="text-xs">{supervisor.company}</Text>
          </div>
        )}
      </Space>
    </div>
  </Card>
));

IndustrySupervisorCard.displayName = 'IndustrySupervisorCard';

// Main Dashboard Component
const StudentDashboard = () => {
  const navigate = useNavigate();
  const institute = useSelector(selectInstitute);

  const {
    isLoading,
    isRevalidating,
    profile,
    grievances,
    stats,
    activeInternships,
    monthlyReports,
    mentor,
    error,
    refresh,
  } = useStudentDashboard();

  // Modal states
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reportUploadModalVisible, setReportUploadModalVisible] = useState(false);
  const [reportViewModalVisible, setReportViewModalVisible] = useState(false);
  const [joiningViewModalVisible, setJoiningViewModalVisible] = useState(false);
  const [pendingFieldsModalVisible, setPendingFieldsModalVisible] = useState(false);

  // Internship selector state
  const [selectedInternshipIndex, setSelectedInternshipIndex] = useState(0);

  // Get current active internship
  const hasActiveInternship = activeInternships?.length > 0;
  const currentInternship = useMemo(() => {
    if (!hasActiveInternship) return null;
    return activeInternships[selectedInternshipIndex] || activeInternships[0];
  }, [activeInternships, selectedInternshipIndex, hasActiveInternship]);

  // Grievances data
  const grievancesList = useMemo(() => {
    return Array.isArray(grievances) ? grievances : (grievances?.grievances || []);
  }, [grievances]);

  const openGrievances = useMemo(() => {
    return grievancesList.filter(g => {
      const status = (g.status || '').toString().toUpperCase();
      return status !== 'RESOLVED' && status !== 'CLOSED' && status !== 'RESOLVED_BY_STUDENT';
    }).length;
  }, [grievancesList]);

  // Monthly reports for current internship
  const currentInternshipReports = useMemo(() => {
    if (!currentInternship) return [];
    return (monthlyReports || []).filter(r => r.applicationId === currentInternship.id);
  }, [monthlyReports, currentInternship]);

  // Check if internship has started
  const hasInternshipStarted = useMemo(() => {
    if (!currentInternship) return false;
    const startDate = currentInternship.isSelfIdentified
      ? currentInternship.startDate
      : currentInternship.joiningDate || currentInternship.internship?.startDate;
    if (!startDate) return false;
    return dayjs(startDate).isSameOrBefore(dayjs(), 'day');
  }, [currentInternship]);

  // Calculate monthly report status
  const monthlyReportStatus = useMemo(() => {
    if (!currentInternship) return { submitted: 0, total: 0, pending: [] };

    let startDate, endDate;
    if (currentInternship.isSelfIdentified) {
      startDate = currentInternship.startDate;
      endDate = currentInternship.endDate;
    } else {
      startDate = currentInternship.joiningDate || currentInternship.internship?.startDate;
      endDate = currentInternship.internship?.endDate;
    }

    if (!startDate || !endDate) return { submitted: 0, total: 0, pending: [] };

    const start = new Date(startDate);
    const end = new Date(endDate);
    const currentDate = new Date();

    if (currentDate < start) return { submitted: 0, total: 0, pending: [] };

    const monthsDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24 * 30));
    const totalReports = Math.max(1, Math.min(monthsDiff, 12));

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    const pendingMonths = [];
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    let checkDate = new Date(start);
    while (checkDate <= currentDate && checkDate <= end) {
      const checkMonth = checkDate.getMonth();
      const checkYear = checkDate.getFullYear();
      const isCurrentMonth = checkMonth === currentMonth && checkYear === currentYear;
      const isPastMonth = checkDate < new Date(currentYear, currentMonth, 1);

      if (isPastMonth || isCurrentMonth) {
        const hasReport = currentInternshipReports.some(r => {
          const reportMonth = typeof r.reportMonth === 'number' ? r.reportMonth : parseInt(r.reportMonth, 10);
          return reportMonth === checkMonth + 1 && r.reportYear === checkYear;
        });
        if (!hasReport) pendingMonths.push(monthNames[checkMonth]);
      }
      checkDate.setMonth(checkDate.getMonth() + 1);
    }

    return {
      submitted: currentInternshipReports.length,
      total: totalReports,
      pending: pendingMonths,
    };
  }, [currentInternship, currentInternshipReports]);

  // Internship data status check
  const getInternshipDataStatus = useCallback((application) => {
    if (!application) return { status: 'missing', pendingFields: [] };

    if (application.isSelfIdentified) {
      const pendingFields = [];
      if (!application.companyName) pendingFields.push('Company Name');
      if (!application.jobProfile) pendingFields.push('Job Profile');
      if (!application.startDate) pendingFields.push('Start Date');
      if (!application.endDate) pendingFields.push('End Date');

      if (pendingFields.length === 0) return { status: 'complete', pendingFields: [] };
      return { status: pendingFields.length < 4 ? 'pending' : 'missing', pendingFields };
    }

    return application.internship
      ? { status: 'complete', pendingFields: [] }
      : { status: 'missing', pendingFields: ['Internship Details'] };
  }, []);

  // Joining letter status check
  const isJoiningLetterUploaded = currentInternship?.joiningLetterUrl;
  const joiningLetterUrl = currentInternship?.joiningLetterUrl ? getImageUrl(currentInternship.joiningLetterUrl) : null;

  // Faculty mentor info
  const facultyMentorInfo = useMemo(() => {
    if (mentor) {
      return {
        name: mentor.name || 'Not Assigned',
        email: mentor.email || null,
        contact: mentor.phoneNo || mentor.contact || null,
        designation: mentor.designation || 'Faculty Mentor',
        visits: currentInternship?.facultyVisitLogs?.length || 0,
      };
    }

    if (!currentInternship) {
      return { name: 'Not Assigned', email: null, contact: null, visits: 0 };
    }

    if (currentInternship.isSelfIdentified) {
      return {
        name: currentInternship.facultyMentorName || 'Not Provided',
        email: currentInternship.facultyMentorEmail || null,
        contact: currentInternship.facultyMentorContact || null,
        designation: currentInternship.facultyMentorDesignation || 'N/A',
        visits: currentInternship.facultyVisitLogs?.length || 0,
      };
    }

    if (currentInternship.mentor) {
      return {
        name: currentInternship.mentor.name || 'Not Assigned',
        email: currentInternship.mentor.email || null,
        contact: currentInternship.mentor.contact || null,
        designation: currentInternship.mentor.designation || 'Faculty Mentor',
        visits: currentInternship.facultyVisitLogs?.length || 0,
      };
    }

    return { name: 'Not Assigned', email: null, contact: null, visits: 0 };
  }, [mentor, currentInternship]);

  // Industry supervisor info
  const industrySupervisorInfo = useMemo(() => {
    if (!currentInternship) {
      return { name: 'Not Assigned', contact: 'N/A', email: 'N/A', designation: 'N/A' };
    }

    if (currentInternship.isSelfIdentified) {
      return {
        name: currentInternship.hrName || 'Not Provided',
        contact: currentInternship.hrContact || 'N/A',
        email: currentInternship.hrEmail || 'N/A',
        designation: currentInternship.hrDesignation || 'N/A',
        company: currentInternship.companyName || 'N/A',
      };
    }

    const industryData = currentInternship.internship?.industry;
    return {
      name: industryData?.primaryContactName || industryData?.companyName || 'Not Provided',
      contact: industryData?.primaryPhone || industryData?.contactPhone || 'N/A',
      email: industryData?.primaryEmail || industryData?.contactEmail || 'N/A',
      company: industryData?.companyName || 'N/A',
    };
  }, [currentInternship]);

  // Company name for display
  const companyName = useMemo(() => {
    if (!currentInternship) return 'N/A';
    return currentInternship.companyName || currentInternship.internship?.industry?.companyName || 'N/A';
  }, [currentInternship]);

  // Internship title
  const internshipTitle = useMemo(() => {
    if (!currentInternship) return '';
    return currentInternship.isSelfIdentified
      ? currentInternship.jobProfile
      : currentInternship.internship?.title;
  }, [currentInternship]);

  // Handle joining letter upload
  const handleJoiningLetterUpload = async (file) => {
    if (!currentInternship?.id) {
      message.error('No active internship found');
      return false;
    }

    // Backend only accepts PDF files
    if (file.type !== 'application/pdf') {
      message.error('Only PDF files are allowed');
      return false;
    }

    // Backend has 5MB limit
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      message.error('File size must be less than 5MB');
      return false;
    }

    setUploading(true);
    try {
      await studentService.uploadJoiningLetter(currentInternship.id, file);
      message.success('Joining letter uploaded successfully');
      setUploadModalVisible(false);
      refresh();
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'Failed to upload joining letter');
    } finally {
      setUploading(false);
    }
    return false;
  };

  // Navigation handlers
  // const handleNavigateToGrievances = useCallback(() => navigate('/grievances'), [navigate]);
  const handleNavigateToReports = useCallback(() => navigate('/reports/submit'), [navigate]);
  const handleViewReports = useCallback(() => setReportViewModalVisible(true), []);
  const handleViewJoiningLetter = useCallback(() => {
    if (currentInternship?.joiningLetterUrl) {
      openFileWithPresignedUrl(currentInternship.joiningLetterUrl);
    }
  }, [currentInternship?.joiningLetterUrl]);

  // Report status color
  const getReportStatusColor = (status) => REPORT_STATUS_COLORS[status] || 'blue';

  // Report period label
  const getReportPeriodLabel = (report) => {
    if (!report) return 'Unknown period';
    if (report.monthName && report.reportYear) return `${report.monthName} ${report.reportYear}`;
    const monthValue = typeof report.reportMonth === 'number' ? report.reportMonth : parseInt(report.reportMonth, 10);
    if (!Number.isNaN(monthValue) && report.reportYear) {
      const date = new Date(report.reportYear, Math.max(0, monthValue - 1), 1);
      return `${date.toLocaleString('default', { month: 'long' })} ${report.reportYear}`;
    }
    return 'Unknown period';
  };

  if (error) {
    return (
      <div className="p-4">
        <Alert
          type="error"
          message="Error loading dashboard"
          description={error}
          showIcon
          action={<Button onClick={refresh} type="link" size="small">Try Again</Button>}
        />
      </div>
    );
  }

  const internshipDataStatus = getInternshipDataStatus(currentInternship);

  return (
    <Spin spinning={isLoading} tip="Loading...">
      <div className="p-4 md:p-5 min-h-screen">
        {isRevalidating && !isLoading && (
          <div className="fixed top-0 left-0 right-0 z-50 px-3 py-1.5 flex items-center justify-center gap-2 text-xs bg-info/10 border-b border-info/20 text-info">
            <SyncOutlined spin />
            <span>Updating...</span>
          </div>
        )}

        {/* Header Section */}
        <Card className="p-4 md:p-6 !mb-4 rounded-xl">
          <Row justify="space-between" align="middle" gutter={[16, 16]}>
            <Col>
              <Title level={3} className="!mb-1">
                Welcome back, {profile?.name || 'Student'}!
              </Title>
              <Paragraph type="secondary" className="!mb-0 text-sm">
                Here's a snapshot of your internship journey.
              </Paragraph>
            </Col>
            <Col>
              <Space size="middle">
                <div className="md:block hidden space-x-2">
                  <Button
                    icon={<LaptopOutlined />}
                    onClick={() => navigate('/my-applications')}
                    className="rounded-lg"
                  >
                    My Applications
                  </Button>
                  <Button
                    type="text"
                    icon={<SyncOutlined spin={isRevalidating} />}
                    onClick={refresh}
                    className="rounded-lg"
                  />
                </div>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Current Internship Status Section */}
        <Card className="!mb-4 rounded-xl border-0 shadow-sm">
          <div className="mb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-2">
              <div className="flex items-center">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full mr-3" />
                <Title level={4} className="!mb-0">Current Internship Status</Title>
              </div>

              {/* Internship selector for multiple internships */}
              {hasActiveInternship && activeInternships.length > 1 && (
                <Select
                  value={selectedInternshipIndex}
                  onChange={(value) => setSelectedInternshipIndex(value)}
                  className="w-full md:w-auto min-w-[200px]"
                  placeholder="Select internship"
                >
                  {activeInternships.map((internship, index) => (
                    <Select.Option key={internship.id} value={index}>
                      <div className="flex flex-col">
                        <Text strong className="text-sm">
                          {internship.isSelfIdentified ? internship.jobProfile : internship.internship?.title}
                        </Text>
                        <Text type="secondary" className="text-xs">
                          {internship.isSelfIdentified ? internship.companyName : internship.internship?.industry?.companyName}
                        </Text>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              )}

              {/* Show current internship info when only one */}
              {hasActiveInternship && activeInternships.length === 1 && (
                <div className="text-left md:text-right">
                  <Text strong className="text-sm block">{internshipTitle}</Text>
                  <Text type="secondary" className="text-xs">{companyName}</Text>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Text type="secondary" className="text-sm">
                Track your internship progress and submissions
              </Text>
              {activeInternships?.length > 1 && (
                <Tag color="blue" className="!px-2 !py-0.5 w-fit text-xs">
                  {activeInternships.length} active internships
                </Tag>
              )}
            </div>
          </div>

          {hasActiveInternship ? (
            <Row gutter={[16, 16]}>
              {/* Internship Data Status */}
              <Col xs={24} sm={12} md={12} lg={6}>
                <StatusCard
                  icon={<CheckCircleOutlined />}
                  iconBgColor={internshipDataStatus.status === 'complete' ? '#dcfce7' : internshipDataStatus.status === 'pending' ? '#fef9c3' : '#fee2e2'}
                  iconColor={internshipDataStatus.status === 'complete' ? '#22c55e' : internshipDataStatus.status === 'pending' ? '#eab308' : '#ef4444'}
                  title="Internship Data"
                  statusTag={internshipDataStatus.status.toUpperCase()}
                  statusColor={internshipDataStatus.status === 'complete' ? 'success' : internshipDataStatus.status === 'pending' ? 'warning' : 'error'}
                  showViewAction={internshipDataStatus.pendingFields.length > 0}
                  onViewAction={() => setPendingFieldsModalVisible(true)}
                />
              </Col>

              {/* Joining Letter Status */}
              <Col xs={24} sm={12} md={12} lg={6}>
                <StatusCard
                  icon={<FileTextOutlined />}
                  iconBgColor={isJoiningLetterUploaded ? '#dcfce7' : '#fef9c3'}
                  iconColor={isJoiningLetterUploaded ? '#22c55e' : '#eab308'}
                  title="Joining Letter"
                  statusTag={isJoiningLetterUploaded ? 'UPLOADED' : 'PENDING'}
                  statusColor={isJoiningLetterUploaded ? 'success' : 'warning'}
                  showViewAction={isJoiningLetterUploaded}
                  onViewAction={handleViewJoiningLetter}
                  showAddAction={true}
                  onAddAction={() => setUploadModalVisible(true)}
                />
              </Col>

              {/* Grievances Status */}
              <Col xs={24} sm={12} md={12} lg={6}>
                <StatusCard
                  icon={<FireOutlined />}
                  iconBgColor="#fee2e2"
                  iconColor="#ef4444"
                  title="Grievances"
                  value={grievancesList.length}
                  statusTag={openGrievances === 0 ? 'No open' : `${openGrievances} open`}
                  statusColor={openGrievances === 0 ? 'success' : 'warning'}
                  // onClick={handleNavigateToGrievances}
                />
              </Col>

              {/* Monthly Reports Status */}
              <Col xs={24} sm={12} md={12} lg={6}>
                <StatusCard
                  icon={<BookOutlined />}
                  iconBgColor="#dbeafe"
                  iconColor="#3b82f6"
                  title="Monthly Reports"
                  value={monthlyReportStatus.submitted}
                  secondaryValue={monthlyReportStatus.total}
                  statusTag={monthlyReportStatus.pending.length > 0 ? `${monthlyReportStatus.pending.length} pending` : 'All submitted'}
                  statusColor={monthlyReportStatus.pending.length > 0 ? 'warning' : 'success'}
                  pendingItems={monthlyReportStatus.pending}
                  showViewAction={monthlyReportStatus.submitted > 0}
                  onViewAction={handleViewReports}
                  showAddAction={hasInternshipStarted}
                  onAddAction={handleNavigateToReports}
                />
              </Col>
            </Row>
          ) : (
            <Card className="rounded-xl border border-gray-100" styles={{ body: { padding: '32px' } }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div className="text-center">
                    <Text className="text-text-secondary text-sm block mb-1">No active internship</Text>
                    <Text className="text-xs text-text-tertiary">Apply for internships to get started</Text>
                  </div>
                }
              >
                <Button type="primary" onClick={() => navigate('/internships')} className="rounded-lg">
                  Browse Internships
                </Button>
              </Empty>
            </Card>
          )}
        </Card>

        {/* Faculty Mentor & Industry Supervisor */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <FacultyMentorCard
              mentor={facultyMentorInfo}
              visitCount={facultyMentorInfo.visits}
            />
          </Col>
          <Col xs={24} md={12}>
            <IndustrySupervisorCard supervisor={industrySupervisorInfo} />
          </Col>
        </Row>

        {/* Upload Joining Letter Modal */}
        <Modal
          title="Upload Joining Letter"
          open={uploadModalVisible}
          onCancel={() => setUploadModalVisible(false)}
          footer={null}
          width={400}
          className="rounded-xl"
        >
          <div className="py-4">
            <Upload.Dragger
              name="joiningLetter"
              accept=".pdf"
              beforeUpload={handleJoiningLetterUpload}
              showUploadList={false}
              disabled={uploading}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined className="text-3xl text-primary" />
              </p>
              <p className="ant-upload-text text-sm font-medium">Click or drag file to upload</p>
              <p className="ant-upload-hint text-xs text-text-tertiary">
                PDF files only (Max 5MB)
              </p>
            </Upload.Dragger>
            {uploading && (
              <div className="mt-3 text-center">
                <Spin size="small" />
                <Text className="ml-2 text-xs text-text-secondary">Uploading...</Text>
              </div>
            )}
          </div>
        </Modal>

        {/* View Monthly Reports Modal */}
        <Modal
          title="Monthly Reports"
          open={reportViewModalVisible}
          onCancel={() => setReportViewModalVisible(false)}
          footer={null}
          width={600}
          className="rounded-xl"
        >
          <div className="py-2">
            {currentInternshipReports.length > 0 ? (
              <List
                dataSource={currentInternshipReports}
                renderItem={(report) => (
                  <List.Item
                    className="!px-0"
                    actions={[
                      <Tag key="status" color={getReportStatusColor(report.status)}>
                        {report.status}
                      </Tag>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <FileTextOutlined className="text-blue-500" />
                        </div>
                      }
                      title={<Text strong>{getReportPeriodLabel(report)}</Text>}
                      description={
                        <Text type="secondary" className="text-xs">
                          Submitted: {report.submittedAt ? dayjs(report.submittedAt).format('MMM D, YYYY') : 'N/A'}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="No reports submitted yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        </Modal>

        {/* Pending Fields Modal */}
        <Modal
          title="Pending Internship Data"
          open={pendingFieldsModalVisible}
          onCancel={() => setPendingFieldsModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setPendingFieldsModalVisible(false)}>
              Close
            </Button>,
            <Button
              key="view"
              type="primary"
              onClick={() => {
                setPendingFieldsModalVisible(false);
                navigate('/my-applications');
              }}
            >
              View Details
            </Button>
          ]}
          width={400}
          className="rounded-xl"
        >
          <div className="py-2">
            <Text className="block mb-3">
              The following fields need to be completed for your internship:
            </Text>
            <List
              size="small"
              dataSource={internshipDataStatus.pendingFields}
              renderItem={(field) => (
                <List.Item className="!py-2">
                  <div className="flex items-center gap-2">
                    <ExclamationCircleOutlined className="text-warning" />
                    <Text>{field}</Text>
                  </div>
                </List.Item>
              )}
            />
          </div>
        </Modal>
      </div>
    </Spin>
  );
};

StudentDashboard.displayName = 'StudentDashboard';

export default memo(StudentDashboard);
