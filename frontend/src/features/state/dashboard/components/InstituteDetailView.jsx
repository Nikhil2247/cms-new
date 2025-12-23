import React, { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Tabs,
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Spin,
  Empty,
  Progress,
  Typography,
  Space,
  Avatar,
  Modal,
  Descriptions,
  Badge,
  Input,
  Select,
  message,
  Dropdown,
  Tooltip,
  List,
  Alert,
  Result,
} from 'antd';
import {
  TeamOutlined,
  BankOutlined,
  FileTextOutlined,
  CalendarOutlined,
  UserOutlined,
  EnvironmentOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileProtectOutlined,
  PhoneOutlined,
  MailOutlined,
  IdcardOutlined,
  FilterOutlined,
  ReloadOutlined,
  DownloadOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import {
  fetchInstituteOverview,
  fetchInstituteStudents,
  fetchInstituteCompanies,
  fetchInstituteFacultyPrincipal,
  fetchInstitutionMentors,
  assignMentorToStudent,
  removeMentorFromStudent,
  selectInstituteOverview,
  selectInstituteStudents,
  selectInstituteCompanies,
  selectInstituteFacultyPrincipal,
  selectSelectedInstitute,
} from '../../store/stateSlice';

const { Title, Text } = Typography;

// Debounce hook for search optimization
const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

// Status color helper - memoized outside component
const STATUS_COLORS = {
  APPROVED: 'green',
  SUBMITTED: 'blue',
  PENDING: 'orange',
  DRAFT: 'default',
  REJECTED: 'red',
  COMPLETED: 'green',
};

const getStatusColor = (status) => STATUS_COLORS[status] || 'default';

// Memoized Overview Tab Component
const OverviewTab = memo(({ data, loading, error }) => {
  if (loading) return <Spin className="flex justify-center py-12" />;
  if (error) return <Alert type="error" message="Failed to load overview" description={error} showIcon />;
  if (!data) return <Empty description="No data available" />;

  return (
    <div className="space-y-4">
      {/* Compliance Score */}
      <Card size="small" className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={8}>
            <div className="text-center">
              <Progress
                type="circle"
                percent={data.complianceScore || 0}
                size={100}
                strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                format={(p) => <span className="text-lg font-bold">{p}%</span>}
              />
              <div className="mt-2 text-sm font-medium text-gray-600 dark:text-slate-300">
                Compliance Score
              </div>
            </div>
          </Col>
          <Col xs={24} sm={16}>
            <Row gutter={[8, 8]}>
              <Col span={8}>
                <Statistic
                  title="Total Students"
                  value={data.totalStudents || 0}
                  prefix={<TeamOutlined />}
                  className="dark:text-slate-200 [&_.ant-statistic-title]:dark:text-slate-400"
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Companies"
                  value={data.companiesCount || 0}
                  prefix={<BankOutlined />}
                  className="dark:text-slate-200 [&_.ant-statistic-title]:dark:text-slate-400"
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Faculty"
                  value={data.facultyCount || 0}
                  prefix={<UserOutlined />}
                  className="dark:text-slate-200 [&_.ant-statistic-title]:dark:text-slate-400"
                />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      {/* Self-Identified Internships */}
      <Card
        title={<><SafetyCertificateOutlined className="mr-2" />Self-Identified Internships</>}
        size="small"
        extra={<Tag color="blue">{data.selfIdentifiedInternships?.rate || 0}% of students</Tag>}
      >
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Statistic title="Total" value={data.selfIdentifiedInternships?.total || 0} className="dark:text-slate-200 [&_.ant-statistic-title]:dark:text-slate-400" />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title="Approved" value={data.selfIdentifiedInternships?.approved || 0} valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} className="[&_.ant-statistic-title]:text-slate-600 [&_.ant-statistic-title]:dark:text-slate-400" />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title="Pending" value={data.selfIdentifiedInternships?.pending || 0} valueStyle={{ color: '#faad14' }} prefix={<ClockCircleOutlined />} className="[&_.ant-statistic-title]:text-slate-600 [&_.ant-statistic-title]:dark:text-slate-400" />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title="Rejected" value={data.selfIdentifiedInternships?.rejected || 0} valueStyle={{ color: '#cf1322' }} prefix={<CloseCircleOutlined />} className="[&_.ant-statistic-title]:text-slate-600 [&_.ant-statistic-title]:dark:text-slate-400" />
          </Col>
        </Row>
      </Card>

      {/* Mentor Assignment */}
      <Card title={<><TeamOutlined className="mr-2" />Mentor Assignment</>} size="small">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={16}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic title="Assigned" value={data.mentorAssignment?.assigned || 0} valueStyle={{ color: '#3f8600' }} className="[&_.ant-statistic-title]:text-slate-600 [&_.ant-statistic-title]:dark:text-slate-400" />
              </Col>
              <Col span={12}>
                <Statistic title="Unassigned" value={data.mentorAssignment?.unassigned || 0} valueStyle={{ color: '#cf1322' }} className="[&_.ant-statistic-title]:text-slate-600 [&_.ant-statistic-title]:dark:text-slate-400" />
              </Col>
            </Row>
          </Col>
          <Col xs={24} sm={8} className="text-center">
            <Progress type="circle" percent={Math.round(data.mentorAssignment?.rate || 0)} size={80} format={(p) => `${p}%`} />
            <div className="text-xs text-gray-500 mt-1">Assignment Rate</div>
          </Col>
        </Row>
      </Card>

      {/* Joining Letters & Monthly Reports */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card
            title={<><FileProtectOutlined className="mr-2" />Joining Letters</>}
            size="small"
            extra={<Tag color={data.joiningLetterStatus?.rate >= 80 ? 'green' : 'orange'}>{data.joiningLetterStatus?.rate || 0}%</Tag>}
          >
            <Row gutter={[8, 8]}>
              <Col span={6}><Statistic title="Submitted" value={data.joiningLetterStatus?.submitted || 0} valueStyle={{ fontSize: '16px' }} className="dark:text-slate-200 [&_.ant-statistic-title]:dark:text-slate-400 [&_.ant-statistic-title]:text-xs" /></Col>
              <Col span={6}><Statistic title="Pending" value={data.joiningLetterStatus?.pending || 0} valueStyle={{ fontSize: '16px', color: '#faad14' }} className="[&_.ant-statistic-title]:text-slate-600 [&_.ant-statistic-title]:dark:text-slate-400 [&_.ant-statistic-title]:text-xs" /></Col>
              <Col span={6}><Statistic title="Approved" value={data.joiningLetterStatus?.approved || 0} valueStyle={{ fontSize: '16px', color: '#3f8600' }} className="[&_.ant-statistic-title]:text-slate-600 [&_.ant-statistic-title]:dark:text-slate-400 [&_.ant-statistic-title]:text-xs" /></Col>
              <Col span={6}><Statistic title="Rejected" value={data.joiningLetterStatus?.rejected || 0} valueStyle={{ fontSize: '16px', color: '#cf1322' }} className="[&_.ant-statistic-title]:text-slate-600 [&_.ant-statistic-title]:dark:text-slate-400 [&_.ant-statistic-title]:text-xs" /></Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            title={<><CalendarOutlined className="mr-2" />Monthly Reports ({data.monthlyReportStatus?.currentMonth}/{data.monthlyReportStatus?.currentYear})</>}
            size="small"
            extra={<Tag color={data.monthlyReportStatus?.rate >= 80 ? 'green' : 'orange'}>{data.monthlyReportStatus?.rate || 0}%</Tag>}
          >
            <Row gutter={[8, 8]}>
              <Col span={6}><Statistic title="Submitted" value={data.monthlyReportStatus?.submitted || 0} valueStyle={{ fontSize: '16px' }} className="dark:text-slate-200 [&_.ant-statistic-title]:dark:text-slate-400 [&_.ant-statistic-title]:text-xs" /></Col>
              <Col span={6}><Statistic title="Pending" value={data.monthlyReportStatus?.pending || 0} valueStyle={{ fontSize: '16px', color: '#faad14' }} className="[&_.ant-statistic-title]:text-slate-600 [&_.ant-statistic-title]:dark:text-slate-400 [&_.ant-statistic-title]:text-xs" /></Col>
              <Col span={6}><Statistic title="Approved" value={data.monthlyReportStatus?.approved || 0} valueStyle={{ fontSize: '16px', color: '#3f8600' }} className="[&_.ant-statistic-title]:text-slate-600 [&_.ant-statistic-title]:dark:text-slate-400 [&_.ant-statistic-title]:text-xs" /></Col>
              <Col span={6}><Statistic title="Not Submitted" value={data.monthlyReportStatus?.notSubmitted || 0} valueStyle={{ fontSize: '16px', color: '#cf1322' }} className="[&_.ant-statistic-title]:text-slate-600 [&_.ant-statistic-title]:dark:text-slate-400 [&_.ant-statistic-title]:text-xs" /></Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Faculty Visits */}
      <Card
        title={<><EnvironmentOutlined className="mr-2" />Faculty Visits This Month</>}
        size="small"
        extra={<Tag color={data.facultyVisits?.completionRate >= 80 ? 'green' : 'orange'}>{data.facultyVisits?.completionRate || 0}% Complete</Tag>}
      >
        <Row gutter={[16, 16]}>
          <Col xs={8}><Statistic title="Scheduled" value={data.facultyVisits?.scheduled || 0} className="dark:text-slate-200 [&_.ant-statistic-title]:dark:text-slate-400" /></Col>
          <Col xs={8}><Statistic title="Completed" value={data.facultyVisits?.completed || 0} valueStyle={{ color: '#3f8600' }} className="[&_.ant-statistic-title]:text-slate-600 [&_.ant-statistic-title]:dark:text-slate-400" /></Col>
          <Col xs={8}><Statistic title="To Be Done" value={data.facultyVisits?.toBeDone || 0} valueStyle={{ color: '#faad14' }} className="[&_.ant-statistic-title]:text-slate-600 [&_.ant-statistic-title]:dark:text-slate-400" /></Col>
        </Row>
      </Card>

      {/* Branch-wise Distribution */}
      {data.branchWiseData?.length > 0 && (
        <Card title={<><AuditOutlined className="mr-2" />Branch-wise Distribution</>} size="small">
          <Row gutter={[8, 8]}>
            {data.branchWiseData.map((branch, index) => (
              <Col xs={12} sm={8} md={6} key={index}>
                <div className="p-2 rounded bg-gray-50 dark:bg-slate-700 text-center">
                  <div className="text-lg font-bold text-blue-600">{branch.count}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 truncate" title={branch.branch}>{branch.branch}</div>
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}
    </div>
  );
});

OverviewTab.displayName = 'OverviewTab';

// Memoized Faculty Tab Component
const FacultyTab = memo(({ principal, faculty, summary, loading, error }) => {
  if (loading) return <Spin className="flex justify-center py-12" />;
  if (error) return <Alert type="error" message="Failed to load faculty data" description={error} showIcon />;

  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && (
        <Card size="small" className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-700">
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6}><Statistic title="Total Faculty" value={summary.totalFaculty || 0} className="dark:text-slate-200 [&_.ant-statistic-title]:dark:text-slate-400" /></Col>
            <Col xs={12} sm={6}><Statistic title="Students Assigned" value={summary.totalStudentsAssigned || 0} className="dark:text-slate-200 [&_.ant-statistic-title]:dark:text-slate-400" /></Col>
            <Col xs={12} sm={6}><Statistic title="Visits Completed" value={summary.totalVisitsCompleted || 0} valueStyle={{ color: '#3f8600' }} className="[&_.ant-statistic-title]:text-slate-600 [&_.ant-statistic-title]:dark:text-slate-400" /></Col>
            <Col xs={12} sm={6}>
              <div className="text-center">
                <Progress type="circle" percent={summary.overallVisitCompletionRate || 0} size={60} format={(p) => `${p}%`} />
                <div className="text-xs text-gray-500 mt-1">Visit Rate</div>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* Principal */}
      {principal && (
        <Card title={<><IdcardOutlined className="mr-2" />Principal</>} size="small">
          <div className="flex items-start gap-4">
            <Avatar size={64} icon={<UserOutlined />} className="bg-indigo-500" />
            <div className="flex-1">
              <Title level={5} className="!mb-1">{principal.name}</Title>
              <Space direction="vertical" size={0}>
                <Text type="secondary"><MailOutlined className="mr-2" />{principal.email}</Text>
                {principal.phoneNo && <Text type="secondary"><PhoneOutlined className="mr-2" />{principal.phoneNo}</Text>}
              </Space>
              {principal.stats && (
                <div className="mt-3">
                  <Space>
                    <Tag color="blue">Students: {principal.stats.totalStudents}</Tag>
                    <Tag color="green">Faculty: {principal.stats.totalFaculty}</Tag>
                    <Tag color="orange">Pending: {principal.stats.pendingApprovals}</Tag>
                  </Space>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Faculty List */}
      <Card title={<><TeamOutlined className="mr-2" />Faculty Members</>} size="small">
        {(!faculty || faculty.length === 0) ? (
          <Empty description="No faculty members found" />
        ) : (
          <List
            dataSource={faculty}
            renderItem={(item) => (
              <List.Item actions={[<Tag key="role" color={item.role === 'HOD' ? 'purple' : 'blue'}>{item.role}</Tag>]}>
                <List.Item.Meta
                  avatar={<Avatar icon={<UserOutlined />} />}
                  title={<Space>{item.name}{item.branchName && <Tag size="small">{item.branchName}</Tag>}</Space>}
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary" className="text-xs">{item.email}</Text>
                      <Space className="mt-1">
                        <Tooltip title="Students Assigned"><Tag icon={<TeamOutlined />}>{item.stats?.assignedStudents || 0}</Tag></Tooltip>
                        <Tooltip title="Visits Done/Scheduled">
                          <Tag icon={<EnvironmentOutlined />} color={item.stats?.visitCompletionRate >= 80 ? 'green' : 'orange'}>
                            {item.stats?.visitsCompleted || 0}/{item.stats?.visitsScheduled || 0}
                          </Tag>
                        </Tooltip>
                        <Tooltip title="Reports Reviewed"><Tag icon={<FileTextOutlined />}>{item.stats?.reportsReviewed || 0}</Tag></Tooltip>
                      </Space>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
});

FacultyTab.displayName = 'FacultyTab';

// Student Detail Modal Component
const StudentDetailModal = memo(({ visible, student, onClose }) => {
  if (!student) return null;

  const mentor = student.mentor || student.mentorAssignments?.find(ma => ma.isActive)?.mentor;
  const company = student.company || student.internshipApplications?.find(app => app.status === 'APPROVED' || app.status === 'SELECTED')?.internship?.industry;
  const selfId = student.selfIdentifiedData;

  return (
    <Modal title="Student Details" open={visible} onCancel={onClose} footer={null} width={800} destroyOnClose>
      <div className="space-y-4">
        <Descriptions bordered column={2} size="small" title="Basic Information">
          <Descriptions.Item label="Name">{student.name}</Descriptions.Item>
          <Descriptions.Item label="Roll Number">{student.rollNumber}</Descriptions.Item>
          <Descriptions.Item label="Email">{student.email}</Descriptions.Item>
          <Descriptions.Item label="Branch">{student.branchName}</Descriptions.Item>
          <Descriptions.Item label="Mentor">{mentor ? <Tag color="green">{mentor.name}</Tag> : <Tag color="red">Unassigned</Tag>}</Descriptions.Item>
          <Descriptions.Item label="Company">{company ? company.companyName : '-'}</Descriptions.Item>
        </Descriptions>

        {student.hasSelfIdentifiedInternship && selfId && (
          <Descriptions bordered column={2} size="small" title="Self-Identified Internship">
            <Descriptions.Item label="Company Name">{selfId.companyName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Status"><Tag color={getStatusColor(selfId.status)}>{selfId.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="Company Address" span={2}>{selfId.companyAddress || '-'}</Descriptions.Item>
            <Descriptions.Item label="Contact">{selfId.companyContact || '-'}</Descriptions.Item>
            <Descriptions.Item label="Email">{selfId.companyEmail || '-'}</Descriptions.Item>
            <Descriptions.Item label="HR Name">{selfId.hrName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Joining Letter">
              {selfId.joiningLetterUrl ? (
                <Space>
                  <Tag color={getStatusColor(selfId.joiningLetterStatus)}>{selfId.joiningLetterStatus || 'Submitted'}</Tag>
                  <Button type="link" size="small" icon={<DownloadOutlined />} href={selfId.joiningLetterUrl} target="_blank">View</Button>
                </Space>
              ) : <Tag color="orange">Not Uploaded</Tag>}
            </Descriptions.Item>
          </Descriptions>
        )}

        <Descriptions bordered column={2} size="small" title="Monthly Report (Current Month)">
          <Descriptions.Item label="Status">
            {student.currentMonthReport ? <Tag color={getStatusColor(student.currentMonthReport.status)}>{student.currentMonthReport.status}</Tag> : <Tag color="red">Not Submitted</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Submitted At">{student.currentMonthReport?.submittedAt ? new Date(student.currentMonthReport.submittedAt).toLocaleString() : '-'}</Descriptions.Item>
        </Descriptions>

        <Descriptions bordered column={2} size="small" title="Last Faculty Visit">
          <Descriptions.Item label="Date">{student.lastFacultyVisit?.date ? new Date(student.lastFacultyVisit.date).toLocaleDateString() : 'No visits yet'}</Descriptions.Item>
          <Descriptions.Item label="Status">{student.lastFacultyVisit ? <Tag color={getStatusColor(student.lastFacultyVisit.status)}>{student.lastFacultyVisit.status}</Tag> : '-'}</Descriptions.Item>
        </Descriptions>
      </div>
    </Modal>
  );
});

StudentDetailModal.displayName = 'StudentDetailModal';

// Main Component
const InstituteDetailView = () => {
  const dispatch = useDispatch();
  const selectedInstitute = useSelector(selectSelectedInstitute);
  const overview = useSelector(selectInstituteOverview);
  const students = useSelector(selectInstituteStudents);
  const companies = useSelector(selectInstituteCompanies);
  const facultyPrincipal = useSelector(selectInstituteFacultyPrincipal);

  const [activeTab, setActiveTab] = useState('overview');
  const [studentModalVisible, setStudentModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [companyModalVisible, setCompanyModalVisible] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);

  // Search states with debouncing
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [companySearchInput, setCompanySearchInput] = useState('');
  const debouncedStudentSearch = useDebounce(studentSearchInput, 400);
  const debouncedCompanySearch = useDebounce(companySearchInput, 400);

  // Filters
  const [studentFilter, setStudentFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [reportStatusFilter, setReportStatusFilter] = useState('all');
  const [selfIdentifiedFilter, setSelfIdentifiedFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Mentor management
  const [mentorModalVisible, setMentorModalVisible] = useState(false);
  const [mentorStudent, setMentorStudent] = useState(null);
  const [mentors, setMentors] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [selectedMentorId, setSelectedMentorId] = useState(null);
  const [assigningMentor, setAssigningMentor] = useState(false);

  // Track if initial fetch done for each tab
  const fetchedTabsRef = useRef({ students: false, companies: false, faculty: false });

  // Get available branches
  const availableBranches = useMemo(() => students.filters?.branches || [], [students.filters]);

  // Fetch overview when institute changes
  useEffect(() => {
    if (selectedInstitute?.id) {
      dispatch(fetchInstituteOverview(selectedInstitute.id));
      // Reset fetched tabs tracker when institute changes
      fetchedTabsRef.current = { students: false, companies: false, faculty: false };
    }
  }, [dispatch, selectedInstitute?.id]);

  // Fetch tab data when tab changes (only once per tab per institute)
  useEffect(() => {
    if (!selectedInstitute?.id) return;

    if (activeTab === 'students' && !fetchedTabsRef.current.students) {
      fetchedTabsRef.current.students = true;
      dispatch(fetchInstituteStudents({ institutionId: selectedInstitute.id, limit: 20, filter: 'all' }));
    } else if (activeTab === 'companies' && !fetchedTabsRef.current.companies) {
      fetchedTabsRef.current.companies = true;
      dispatch(fetchInstituteCompanies({ institutionId: selectedInstitute.id }));
    } else if (activeTab === 'faculty' && !fetchedTabsRef.current.faculty) {
      fetchedTabsRef.current.faculty = true;
      dispatch(fetchInstituteFacultyPrincipal(selectedInstitute.id));
    }
  }, [activeTab, selectedInstitute?.id, dispatch]);

  // Handle debounced student search
  useEffect(() => {
    if (!selectedInstitute?.id || activeTab !== 'students') return;
    // Only trigger if search actually changed (not on initial mount)
    if (debouncedStudentSearch !== undefined) {
      dispatch(fetchInstituteStudents({
        institutionId: selectedInstitute.id,
        limit: 20,
        search: debouncedStudentSearch || undefined,
        filter: studentFilter,
        branch: branchFilter !== 'all' ? branchFilter : undefined,
        reportStatus: reportStatusFilter !== 'all' ? reportStatusFilter : undefined,
        selfIdentified: selfIdentifiedFilter !== 'all' ? selfIdentifiedFilter : undefined,
      }));
    }
  }, [debouncedStudentSearch, selectedInstitute?.id, activeTab, dispatch, studentFilter, branchFilter, reportStatusFilter, selfIdentifiedFilter]);

  // Handle debounced company search
  useEffect(() => {
    if (!selectedInstitute?.id || activeTab !== 'companies') return;
    if (debouncedCompanySearch !== undefined && fetchedTabsRef.current.companies) {
      dispatch(fetchInstituteCompanies({ institutionId: selectedInstitute.id, search: debouncedCompanySearch || undefined }));
    }
  }, [debouncedCompanySearch, selectedInstitute?.id, activeTab, dispatch]);

  // Apply filters
  const applyFilters = useCallback(() => {
    if (!selectedInstitute?.id) return;
    dispatch(fetchInstituteStudents({
      institutionId: selectedInstitute.id,
      limit: 20,
      search: studentSearchInput || undefined,
      filter: studentFilter,
      branch: branchFilter !== 'all' ? branchFilter : undefined,
      reportStatus: reportStatusFilter !== 'all' ? reportStatusFilter : undefined,
      selfIdentified: selfIdentifiedFilter !== 'all' ? selfIdentifiedFilter : undefined,
    }));
  }, [dispatch, selectedInstitute?.id, studentSearchInput, studentFilter, branchFilter, reportStatusFilter, selfIdentifiedFilter]);

  // Reset filters
  const resetFilters = useCallback(() => {
    setStudentFilter('all');
    setBranchFilter('all');
    setReportStatusFilter('all');
    setSelfIdentifiedFilter('all');
    setStudentSearchInput('');
    if (selectedInstitute?.id) {
      dispatch(fetchInstituteStudents({ institutionId: selectedInstitute.id, limit: 20, filter: 'all' }));
    }
  }, [dispatch, selectedInstitute?.id]);

  // Load more students
  const handleLoadMore = useCallback(() => {
    if (!students.hasMore || students.loadingMore || !selectedInstitute?.id) return;
    dispatch(fetchInstituteStudents({
      institutionId: selectedInstitute.id,
      cursor: students.cursor,
      limit: 20,
      search: studentSearchInput || undefined,
      filter: studentFilter,
      branch: branchFilter !== 'all' ? branchFilter : undefined,
      reportStatus: reportStatusFilter !== 'all' ? reportStatusFilter : undefined,
      selfIdentified: selfIdentifiedFilter !== 'all' ? selfIdentifiedFilter : undefined,
      loadMore: true,
    }));
  }, [dispatch, selectedInstitute?.id, students.cursor, students.hasMore, students.loadingMore, studentSearchInput, studentFilter, branchFilter, reportStatusFilter, selfIdentifiedFilter]);

  // Mentor handlers
  const handleEditMentor = useCallback(async (student) => {
    setMentorStudent(student);
    setSelectedMentorId(student.mentorAssignments?.find(ma => ma.isActive)?.mentor?.id || null);
    setMentorModalVisible(true);

    if (selectedInstitute?.id) {
      setMentorsLoading(true);
      try {
        const result = await dispatch(fetchInstitutionMentors(selectedInstitute.id)).unwrap();
        setMentors(result || []);
      } catch {
        message.error('Failed to load mentors');
      } finally {
        setMentorsLoading(false);
      }
    }
  }, [dispatch, selectedInstitute?.id]);

  const handleAssignMentor = useCallback(async () => {
    if (!mentorStudent || !selectedMentorId) {
      message.warning('Please select a mentor');
      return;
    }

    setAssigningMentor(true);
    try {
      await dispatch(assignMentorToStudent({ studentId: mentorStudent.id, mentorId: selectedMentorId })).unwrap();
      message.success('Mentor assigned successfully');
      setMentorModalVisible(false);
      applyFilters();
    } catch (error) {
      message.error(typeof error === 'string' ? error : 'Failed to assign mentor');
    } finally {
      setAssigningMentor(false);
    }
  }, [dispatch, mentorStudent, selectedMentorId, applyFilters]);

  const handleRemoveMentor = useCallback((student) => {
    Modal.confirm({
      title: 'Remove Mentor',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to remove the mentor from ${student.name}?`,
      okText: 'Remove',
      okType: 'danger',
      onOk: async () => {
        try {
          await dispatch(removeMentorFromStudent(student.id)).unwrap();
          message.success('Mentor removed successfully');
          applyFilters();
        } catch (error) {
          message.error(typeof error === 'string' ? error : 'Failed to remove mentor');
        }
      },
    });
  }, [dispatch, applyFilters]);

  // Student action menu
  const getStudentActionItems = useCallback((record) => {
    const hasMentor = record.mentorAssignments?.some(ma => ma.isActive);
    return [
      { key: 'view', icon: <EyeOutlined />, label: 'View Details', onClick: () => { setSelectedStudent(record); setStudentModalVisible(true); } },
      { type: 'divider' },
      { key: 'mentor', icon: <EditOutlined />, label: hasMentor ? 'Change Mentor' : 'Assign Mentor', onClick: () => handleEditMentor(record) },
      ...(hasMentor ? [{ key: 'remove-mentor', icon: <DeleteOutlined />, label: 'Remove Mentor', danger: true, onClick: () => handleRemoveMentor(record) }] : []),
      { type: 'divider' },
      { key: 'approve-report', icon: <CheckCircleOutlined />, label: 'Approve Report', disabled: !record.currentMonthReport || record.currentMonthReport.status !== 'SUBMITTED', onClick: () => message.info('Report approval coming soon') },
      { key: 'reject-report', icon: <CloseCircleOutlined />, label: 'Reject Report', danger: true, disabled: !record.currentMonthReport || record.currentMonthReport.status !== 'SUBMITTED', onClick: () => message.info('Report rejection coming soon') },
    ];
  }, [handleEditMentor, handleRemoveMentor]);

  // Memoized student columns
  const studentColumns = useMemo(() => [
    {
      title: 'Student', key: 'student', fixed: 'left', width: 200,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <Avatar icon={<UserOutlined />} size="small" />
          <div>
            <Text strong className="text-sm">{record.name}</Text><br />
            <Text type="secondary" className="text-xs">{record.rollNumber}</Text>
          </div>
        </div>
      ),
    },
    { title: 'Branch', dataIndex: 'branchName', key: 'branchName', width: 120, render: (text) => <Tag>{text || 'N/A'}</Tag> },
    {
      title: 'Mentor', key: 'mentor', width: 150,
      render: (_, record) => {
        const mentor = record.mentor || record.mentorAssignments?.find(ma => ma.isActive)?.mentor;
        return mentor ? <Tooltip title={mentor.email}><Tag color="green" className="max-w-[120px] truncate">{mentor.name}</Tag></Tooltip> : <Tag color="red">Unassigned</Tag>;
      },
    },
    {
      title: 'Company', key: 'company', width: 150,
      render: (_, record) => {
        const company = record.company || record.internshipApplications?.find(app => app.status === 'SELECTED' || app.status === 'APPROVED')?.internship?.industry;
        return company ? <Tooltip title={company.city}><Tag color="blue" className="max-w-[130px] truncate">{company.companyName}</Tag></Tooltip> : <Text type="secondary">-</Text>;
      },
    },
    { title: 'Self-ID', key: 'selfIdentified', width: 80, align: 'center', render: (_, record) => record.hasSelfIdentifiedInternship ? <CheckCircleOutlined className="text-green-500" /> : <CloseCircleOutlined className="text-gray-300" /> },
    {
      title: 'Joining Letter', key: 'joiningLetter', width: 120,
      render: (_, record) => {
        if (!record.hasSelfIdentifiedInternship) return <Text type="secondary">-</Text>;
        if (!record.selfIdentifiedData?.joiningLetterUrl) return <Tag color="orange">Not Uploaded</Tag>;
        return <Tag color={getStatusColor(record.selfIdentifiedData?.joiningLetterStatus)}>{record.selfIdentifiedData?.joiningLetterStatus || 'Submitted'}</Tag>;
      },
    },
    { title: 'Monthly Report', key: 'monthlyReport', width: 120, render: (_, record) => record.currentMonthReport ? <Tag color={getStatusColor(record.currentMonthReport.status)}>{record.currentMonthReport.status}</Tag> : <Tag color="red">Not Submitted</Tag> },
    { title: 'Last Visit', key: 'lastVisit', width: 100, render: (_, record) => record.lastFacultyVisit ? <Tooltip title={`Status: ${record.lastFacultyVisit.status}`}><Text className="text-xs">{new Date(record.lastFacultyVisit.date).toLocaleDateString()}</Text></Tooltip> : <Text type="secondary">None</Text> },
    { title: 'Action', key: 'action', width: 60, fixed: 'right', render: (_, record) => <Dropdown menu={{ items: getStudentActionItems(record) }} trigger={['click']} placement="bottomRight"><Button type="text" icon={<MoreOutlined />} /></Dropdown> },
  ], [getStudentActionItems]);

  // Memoized company columns
  const companyColumns = useMemo(() => [
    {
      title: 'Company', key: 'company',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <Avatar icon={<BankOutlined />} className="bg-blue-500" size="small" />
          <div>
            <Text strong className="text-sm">{record.companyName}</Text><br />
            <Text type="secondary" className="text-xs">{record.city}, {record.state}</Text>
          </div>
        </div>
      ),
    },
    { title: 'Type', dataIndex: 'industryType', key: 'industryType', render: (type) => <Tag>{type || 'N/A'}</Tag> },
    { title: 'Students', dataIndex: 'studentCount', key: 'studentCount', render: (count) => <Badge count={count || 0} className="[&_.ant-badge-count]:!bg-blue-600" showZero /> },
    { title: 'Self-ID', dataIndex: 'selfIdentifiedCount', key: 'selfIdentifiedCount', render: (count) => <Badge count={count || 0} className="[&_.ant-badge-count]:!bg-green-600" showZero /> },
    {
      title: 'Branches', key: 'branches',
      render: (_, record) => (
        <div className="flex flex-wrap gap-1">
          {record.branchWiseData?.slice(0, 3).map((b, i) => <Tag key={i} className="text-xs">{b.branch}: {b.total}</Tag>)}
          {record.branchWiseData?.length > 3 && <Tag className="text-xs">+{record.branchWiseData.length - 3} more</Tag>}
        </div>
      ),
    },
    {
      title: 'Status', key: 'status',
      render: (_, record) => (
        <Space>
          {record.isApproved && <Tag color="green">Approved</Tag>}
          {record.isVerified && <Tag color="blue">Verified</Tag>}
          {!record.isApproved && !record.isVerified && <Tag color="default">Pending</Tag>}
        </Space>
      ),
    },
    { title: 'Action', key: 'action', render: (_, record) => <Button type="link" size="small" onClick={() => { setSelectedCompany(record); setCompanyModalVisible(true); }}>View Students</Button> },
  ], []);

  // No institute selected
  if (!selectedInstitute?.id) {
    return (
      <Result
        icon={<BankOutlined className="text-gray-300" />}
        title="Select an Institution"
        subTitle="Choose an institution from the side panel to view details"
      />
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Title level={4} className="!mb-1">{overview.data?.institution?.name || 'Loading...'}</Title>
          <Text type="secondary">
            {overview.data?.institution?.code} • {overview.data?.institution?.city}
            {overview.data?.institution?.district && `, ${overview.data?.institution?.district}`}
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => dispatch(fetchInstituteOverview(selectedInstitute.id))} loading={overview.loading}>Refresh</Button>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        {
          key: 'overview',
          label: <><TeamOutlined /> Overview</>,
          children: <OverviewTab data={overview.data} loading={overview.loading} error={overview.error} />,
        },
        {
          key: 'students',
          label: <><UserOutlined /> Students ({students.total})</>,
          children: (
            <>
              <div className="mb-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input.Search
                    placeholder="Search students..."
                    value={studentSearchInput}
                    onChange={(e) => setStudentSearchInput(e.target.value)}
                    style={{ width: 250 }}
                    allowClear
                  />
                  <Button icon={<FilterOutlined />} onClick={() => setShowFilters(!showFilters)} type={showFilters ? 'primary' : 'default'}>Filters</Button>
                  <Button icon={<ReloadOutlined />} onClick={resetFilters}>Reset</Button>
                </div>
                {showFilters && (
                  <Card size="small" className="bg-gray-50 dark:bg-slate-800">
                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={12} md={6}>
                        <div className="text-xs text-gray-500 mb-1">Mentor Status</div>
                        <Select value={studentFilter} onChange={setStudentFilter} style={{ width: '100%' }} size="small">
                          <Select.Option value="all">All</Select.Option>
                          <Select.Option value="assigned">Assigned</Select.Option>
                          <Select.Option value="unassigned">Unassigned</Select.Option>
                        </Select>
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <div className="text-xs text-gray-500 mb-1">Branch</div>
                        <Select value={branchFilter} onChange={setBranchFilter} style={{ width: '100%' }} size="small">
                          <Select.Option value="all">All Branches</Select.Option>
                          {availableBranches.map((b) => <Select.Option key={b} value={b}>{b}</Select.Option>)}
                        </Select>
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <div className="text-xs text-gray-500 mb-1">Report Status</div>
                        <Select value={reportStatusFilter} onChange={setReportStatusFilter} style={{ width: '100%' }} size="small">
                          <Select.Option value="all">All</Select.Option>
                          <Select.Option value="submitted">Submitted</Select.Option>
                          <Select.Option value="pending">Pending</Select.Option>
                          <Select.Option value="not_submitted">Not Submitted</Select.Option>
                        </Select>
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <div className="text-xs text-gray-500 mb-1">Self-Identified</div>
                        <Select value={selfIdentifiedFilter} onChange={setSelfIdentifiedFilter} style={{ width: '100%' }} size="small">
                          <Select.Option value="all">All</Select.Option>
                          <Select.Option value="yes">Yes</Select.Option>
                          <Select.Option value="no">No</Select.Option>
                        </Select>
                      </Col>
                      <Col xs={24}><Button type="primary" size="small" onClick={applyFilters}>Apply Filters</Button></Col>
                    </Row>
                  </Card>
                )}
              </div>
              {students.error && <Alert type="error" message={students.error} className="mb-4" showIcon closable />}
              <Table columns={studentColumns} dataSource={students.list} rowKey="id" loading={students.loading} pagination={false} scroll={{ x: 1200 }} size="small" />
              {students.hasMore && (
                <div className="text-center mt-4">
                  <Button onClick={handleLoadMore} loading={students.loadingMore}>Load More</Button>
                </div>
              )}
            </>
          ),
        },
        {
          key: 'companies',
          label: <><BankOutlined /> Companies ({companies.total})</>,
          children: (
            <>
              {companies.summary && (
                <Card size="small" className="mb-4 bg-blue-50 dark:bg-slate-800">
                  <Row gutter={[16, 16]}>
                    <Col span={8}><Statistic title="Total Students" value={companies.summary.totalStudents || 0} className="dark:text-slate-200 [&_.ant-statistic-title]:dark:text-slate-400" /></Col>
                    <Col span={8}><Statistic title="Self-Identified" value={companies.summary.totalSelfIdentified || 0} valueStyle={{ color: '#3f8600' }} className="[&_.ant-statistic-title]:text-slate-600 [&_.ant-statistic-title]:dark:text-slate-400" /></Col>
                    <Col span={8}><Statistic title="Self-ID Rate" value={companies.summary.selfIdentifiedRate || 0} suffix="%" className="dark:text-slate-200 [&_.ant-statistic-title]:dark:text-slate-400" /></Col>
                  </Row>
                </Card>
              )}
              <div className="mb-4">
                <Input.Search placeholder="Search companies..." value={companySearchInput} onChange={(e) => setCompanySearchInput(e.target.value)} style={{ width: 250 }} allowClear />
              </div>
              {companies.error && <Alert type="error" message={companies.error} className="mb-4" showIcon closable />}
              <Table columns={companyColumns} dataSource={companies.list} rowKey="id" loading={companies.loading} pagination={{ pageSize: 10 }} size="small" />
            </>
          ),
        },
        {
          key: 'faculty',
          label: <><IdcardOutlined /> Faculty & Principal</>,
          children: <FacultyTab principal={facultyPrincipal.principal} faculty={facultyPrincipal.faculty} summary={facultyPrincipal.summary} loading={facultyPrincipal.loading} error={facultyPrincipal.error} />,
        },
      ]} />

      {/* Student Detail Modal */}
      <StudentDetailModal visible={studentModalVisible} student={selectedStudent} onClose={() => setStudentModalVisible(false)} />

      {/* Company Detail Modal */}
      <Modal title={`Students at ${selectedCompany?.companyName || 'Company'}`} open={companyModalVisible} onCancel={() => setCompanyModalVisible(false)} footer={null} width={800} destroyOnClose>
        {selectedCompany && (
          <div className="space-y-4">
            <Card size="small">
              <Row gutter={[16, 16]}>
                <Col span={8}><Text type="secondary">Type:</Text><div><Tag>{selectedCompany.industryType || 'N/A'}</Tag></div></Col>
                <Col span={8}><Text type="secondary">Location:</Text><div>{selectedCompany.city}, {selectedCompany.state}</div></Col>
                <Col span={8}><Text type="secondary">Status:</Text><div>{selectedCompany.isApproved && <Tag color="green">Approved</Tag>}{selectedCompany.isVerified && <Tag color="blue">Verified</Tag>}</div></Col>
              </Row>
            </Card>
            {selectedCompany.branchWiseData?.length > 0 && (
              <Card size="small" title="Branch-wise Distribution">
                <Row gutter={[8, 8]}>
                  {selectedCompany.branchWiseData.map((b, i) => (
                    <Col xs={12} sm={8} md={6} key={i}>
                      <div className="p-2 rounded bg-gray-50 dark:bg-slate-700 text-center">
                        <div className="text-lg font-bold text-blue-600">{b.total}</div>
                        <div className="text-xs text-gray-500">{b.branch}{b.selfIdentified > 0 && <span className="text-green-600 ml-1">({b.selfIdentified} self-ID)</span>}</div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card>
            )}
            <Table
              dataSource={selectedCompany.students || []}
              columns={[
                { title: 'Name', dataIndex: 'name', key: 'name' },
                { title: 'Roll Number', dataIndex: 'rollNumber', key: 'rollNumber' },
                { title: 'Branch', dataIndex: 'branch', key: 'branch', render: (text) => <Tag>{text}</Tag> },
                { title: 'Self-ID', dataIndex: 'isSelfIdentified', key: 'isSelfIdentified', render: (val) => val ? <CheckCircleOutlined className="text-green-500" /> : <CloseCircleOutlined className="text-gray-300" /> },
                { title: 'Joining Letter', dataIndex: 'joiningLetterStatus', key: 'joiningLetterStatus', render: (status) => status ? <Tag color={getStatusColor(status)}>{status}</Tag> : <Text type="secondary">-</Text> },
              ]}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </div>
        )}
      </Modal>

      {/* Mentor Assignment Modal */}
      <Modal
        title={`${mentorStudent?.mentorAssignments?.some(ma => ma.isActive) ? 'Change' : 'Assign'} Mentor for ${mentorStudent?.name || 'Student'}`}
        open={mentorModalVisible}
        onCancel={() => { setMentorModalVisible(false); setMentorStudent(null); setSelectedMentorId(null); }}
        onOk={handleAssignMentor}
        okText="Save"
        confirmLoading={assigningMentor}
        okButtonProps={{ disabled: !selectedMentorId }}
        destroyOnClose
      >
        <div className="py-4">
          <Text className="block mb-2">Select a mentor from this institution:</Text>
          <Select
            placeholder="Select Mentor"
            loading={mentorsLoading}
            value={selectedMentorId}
            onChange={setSelectedMentorId}
            style={{ width: '100%' }}
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) => option.children.toLowerCase().includes(input.toLowerCase())}
          >
            {mentors.map((mentor) => <Select.Option key={mentor.id} value={mentor.id}>{mentor.name} ({mentor.activeAssignments} students)</Select.Option>)}
          </Select>
          {mentorStudent?.mentorAssignments?.find(ma => ma.isActive)?.mentor && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-slate-800 rounded">
              <Text type="secondary" className="block text-sm">Current Mentor:</Text>
              <Tag color="blue" className="mt-1">{mentorStudent.mentorAssignments.find(ma => ma.isActive).mentor.name}</Tag>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default InstituteDetailView;
