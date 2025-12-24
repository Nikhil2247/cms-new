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
import { useDebounce } from '../../../../hooks/useDebounce';

const { Title, Text } = Typography;

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

// Memoized Overview Tab Component - Refactored for Clean UI
const OverviewTab = memo(({ data, loading, error }) => {
  if (loading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  if (error) return <Alert type="error" message="Failed to load overview" description={error} showIcon className="rounded-xl border-error/20 bg-error/5" />;
  if (!data) return <Empty description="No data available" />;

  return (
    <div className="space-y-6 p-4">
      {/* Compliance Score & Key Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-border shadow-sm bg-surface overflow-hidden">
          <div className="flex flex-col items-center justify-center h-full py-4">
            <Progress
              type="circle"
              percent={data.complianceScore || 0}
              size={120}
              strokeColor={{ '0%': 'rgb(var(--color-info))', '100%': 'rgb(var(--color-success))' }}
              format={(p) => (
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-black text-text-primary">{p}%</span>
                  <span className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest mt-1">Score</span>
                </div>
              )}
            />
            <div className="mt-4 text-center">
              <Text className="text-lg font-bold text-text-primary block">Compliance Status</Text>
              <Text className="text-text-secondary text-sm">Overall performance rating</Text>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2 rounded-2xl border-border shadow-sm bg-surface">
          <Title level={5} className="mb-4 text-text-primary flex items-center gap-2">
            <BankOutlined className="text-primary" /> Key Metrics
          </Title>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-background-tertiary/30 border border-border/50 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                <TeamOutlined className="text-lg" />
              </div>
              <div className="text-2xl font-black text-text-primary">{data.totalStudents || 0}</div>
              <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">Total Students</div>
            </div>
            <div className="p-4 rounded-xl bg-background-tertiary/30 border border-border/50 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center mb-2">
                <BankOutlined className="text-lg" />
              </div>
              <div className="text-2xl font-black text-text-primary">{data.companiesCount || 0}</div>
              <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">Companies</div>
            </div>
            <div className="p-4 rounded-xl bg-background-tertiary/30 border border-border/50 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center mb-2">
                <UserOutlined className="text-lg" />
              </div>
              <div className="text-2xl font-black text-text-primary">{data.facultyCount || 0}</div>
              <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">Faculty</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Self-Identified Internships */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
              <SafetyCertificateOutlined className="text-purple-500" />
            </div>
            <span className="font-bold text-text-primary">Self-Identified Internships</span>
          </div>
        }
        className="rounded-2xl border-border shadow-sm bg-surface"
        extra={<Tag color="blue" className="rounded-md font-bold px-2">{data.selfIdentifiedInternships?.rate || 0}% of students</Tag>}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3">
            <div className="text-2xl font-bold text-text-primary">{data.selfIdentifiedInternships?.total || 0}</div>
            <div className="text-xs text-text-tertiary uppercase tracking-wider font-semibold">Total</div>
          </div>
          <div className="text-center p-3 border-l border-border/50">
            <div className="text-2xl font-bold text-success">{data.selfIdentifiedInternships?.approved || 0}</div>
            <div className="text-xs text-text-tertiary uppercase tracking-wider font-semibold">Approved</div>
          </div>
          <div className="text-center p-3 border-l border-border/50">
            <div className="text-2xl font-bold text-warning">{data.selfIdentifiedInternships?.pending || 0}</div>
            <div className="text-xs text-text-tertiary uppercase tracking-wider font-semibold">Pending</div>
          </div>
          <div className="text-center p-3 border-l border-border/50">
            <div className="text-2xl font-bold text-error">{data.selfIdentifiedInternships?.rejected || 0}</div>
            <div className="text-xs text-text-tertiary uppercase tracking-wider font-semibold">Rejected</div>
          </div>
        </div>
      </Card>

      {/* Mentor Assignment */}
      <Card 
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
              <TeamOutlined className="text-indigo-500" />
            </div>
            <span className="font-bold text-text-primary">Mentor Assignment</span>
          </div>
        }
        className="rounded-2xl border-border shadow-sm bg-surface"
      >
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 w-full">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-success/5 border border-success/20">
                <div className="text-2xl font-bold text-success">{data.mentorAssignment?.assigned || 0}</div>
                <div className="text-xs font-bold text-success-700 uppercase tracking-wider">Assigned</div>
              </div>
              <div className="p-4 rounded-xl bg-error/5 border border-error/20">
                <div className="text-2xl font-bold text-error">{data.mentorAssignment?.unassigned || 0}</div>
                <div className="text-xs font-bold text-error-700 uppercase tracking-wider">Unassigned</div>
              </div>
            </div>
          </div>
          <div className="text-center shrink-0">
            <Progress 
              type="circle" 
              percent={Math.round(data.mentorAssignment?.rate || 0)} 
              size={80} 
              strokeColor="rgb(var(--color-primary))"
              format={(p) => <span className="text-sm font-bold text-text-primary">{p}%</span>}
            />
            <div className="text-[10px] uppercase font-bold text-text-tertiary mt-2 tracking-wide">Coverage</div>
          </div>
        </div>
      </Card>

      {/* Joining Letters & Monthly Reports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          title={
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <FileProtectOutlined className="text-blue-500" />
              </div>
              <span className="font-bold text-text-primary">Joining Letters</span>
            </div>
          }
          className="rounded-2xl border-border shadow-sm bg-surface"
          extra={<Tag color={data.joiningLetterStatus?.rate >= 80 ? 'green' : 'orange'} className="rounded-md font-bold">{data.joiningLetterStatus?.rate || 0}%</Tag>}
        >
          <div className="grid grid-cols-2 gap-y-4">
            <Statistic title={<span className="text-xs uppercase font-bold text-text-tertiary">Submitted</span>} value={data.joiningLetterStatus?.submitted || 0} valueStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
            <Statistic title={<span className="text-xs uppercase font-bold text-text-tertiary">Pending</span>} value={data.joiningLetterStatus?.pending || 0} valueStyle={{ fontSize: '18px', fontWeight: 'bold', color: '#faad14' }} />
            <Statistic title={<span className="text-xs uppercase font-bold text-text-tertiary">Approved</span>} value={data.joiningLetterStatus?.approved || 0} valueStyle={{ fontSize: '18px', fontWeight: 'bold', color: '#52c41a' }} />
            <Statistic title={<span className="text-xs uppercase font-bold text-text-tertiary">Rejected</span>} value={data.joiningLetterStatus?.rejected || 0} valueStyle={{ fontSize: '18px', fontWeight: 'bold', color: '#ff4d4f' }} />
          </div>
        </Card>

        <Card
          title={
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                <CalendarOutlined className="text-orange-500" />
              </div>
              <span className="font-bold text-text-primary">Monthly Reports</span>
            </div>
          }
          className="rounded-2xl border-border shadow-sm bg-surface"
          extra={<Tag color={data.monthlyReportStatus?.rate >= 80 ? 'green' : 'orange'} className="rounded-md font-bold">{data.monthlyReportStatus?.rate || 0}%</Tag>}
        >
          <div className="grid grid-cols-2 gap-y-4">
            <Statistic title={<span className="text-xs uppercase font-bold text-text-tertiary">Submitted</span>} value={data.monthlyReportStatus?.submitted || 0} valueStyle={{ fontSize: '18px', fontWeight: 'bold' }} />
            <Statistic title={<span className="text-xs uppercase font-bold text-text-tertiary">Pending</span>} value={data.monthlyReportStatus?.pending || 0} valueStyle={{ fontSize: '18px', fontWeight: 'bold', color: '#faad14' }} />
            <Statistic title={<span className="text-xs uppercase font-bold text-text-tertiary">Approved</span>} value={data.monthlyReportStatus?.approved || 0} valueStyle={{ fontSize: '18px', fontWeight: 'bold', color: '#52c41a' }} />
            <Statistic title={<span className="text-xs uppercase font-bold text-text-tertiary">Missing</span>} value={data.monthlyReportStatus?.notSubmitted || 0} valueStyle={{ fontSize: '18px', fontWeight: 'bold', color: '#ff4d4f' }} />
          </div>
        </Card>
      </div>

      {/* Faculty Visits */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
              <EnvironmentOutlined className="text-teal-500" />
            </div>
            <span className="font-bold text-text-primary">Faculty Visits (This Month)</span>
          </div>
        }
        className="rounded-2xl border-border shadow-sm bg-surface"
        extra={<Tag color={data.facultyVisits?.completionRate >= 80 ? 'green' : 'orange'} className="rounded-md font-bold">{data.facultyVisits?.completionRate || 0}% Complete</Tag>}
      >
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-background-tertiary/30 rounded-xl">
            <div className="text-2xl font-bold text-text-primary">{data.facultyVisits?.scheduled || 0}</div>
            <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">Scheduled</div>
          </div>
          <div className="p-3 bg-success/5 border border-success/20 rounded-xl">
            <div className="text-2xl font-bold text-success">{data.facultyVisits?.completed || 0}</div>
            <div className="text-[10px] uppercase font-bold text-success-700 tracking-widest">Completed</div>
          </div>
          <div className="p-3 bg-warning/5 border border-warning/20 rounded-xl">
            <div className="text-2xl font-bold text-warning">{data.facultyVisits?.toBeDone || 0}</div>
            <div className="text-[10px] uppercase font-bold text-warning-700 tracking-widest">Pending</div>
          </div>
        </div>
      </Card>

      {/* Branch-wise Distribution */}
      {data.branchWiseData?.length > 0 && (
        <Card 
          title={
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <AuditOutlined className="text-primary" />
              </div>
              <span className="font-bold text-text-primary">Branch Distribution</span>
            </div>
          }
          className="rounded-2xl border-border shadow-sm bg-surface"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.branchWiseData.map((branch, index) => (
              <div key={index} className="p-3 rounded-xl bg-background-tertiary border border-border text-center">
                <div className="text-lg font-bold text-primary">{branch.count}</div>
                <div className="text-[10px] text-text-secondary truncate font-medium uppercase tracking-wide" title={branch.branch}>{branch.branch}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
});

OverviewTab.displayName = 'OverviewTab';

// Memoized Faculty Tab Component - Refactored
const FacultyTab = memo(({ principal, faculty, summary, loading, error }) => {
  if (loading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  if (error) return <Alert type="error" message="Failed to load faculty data" description={error} showIcon className="rounded-xl border-error/20 bg-error/5" />;

  return (
    <div className="space-y-6 p-4">
      {/* Summary */}
      {summary && (
        <Card className="rounded-2xl border-border shadow-sm bg-surface">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="grid grid-cols-3 gap-8 flex-1 w-full text-center">
              <div>
                <div className="text-3xl font-black text-text-primary">{summary.totalFaculty || 0}</div>
                <div className="text-xs uppercase font-bold text-text-tertiary tracking-widest">Total Faculty</div>
              </div>
              <div>
                <div className="text-3xl font-black text-primary">{summary.totalStudentsAssigned || 0}</div>
                <div className="text-xs uppercase font-bold text-text-tertiary tracking-widest">Students Assigned</div>
              </div>
              <div>
                <div className="text-3xl font-black text-success">{summary.totalVisitsCompleted || 0}</div>
                <div className="text-xs uppercase font-bold text-text-tertiary tracking-widest">Visits Done</div>
              </div>
            </div>
            <div className="text-center shrink-0 pl-8 border-l border-border/50">
              <Progress type="circle" percent={summary.overallVisitCompletionRate || 0} size={70} strokeColor="rgb(var(--color-primary))" />
              <div className="text-[10px] uppercase font-bold text-text-tertiary mt-2">Visit Rate</div>
            </div>
          </div>
        </Card>
      )}

      {/* Principal */}
      {principal && (
        <Card 
          title={
            <div className="flex items-center gap-2">
              <IdcardOutlined className="text-primary" />
              <span className="font-bold text-text-primary">Principal</span>
            </div>
          }
          className="rounded-2xl border-border shadow-sm bg-surface"
        >
          <div className="flex items-start gap-4">
            <Avatar size={64} icon={<UserOutlined />} className="bg-indigo-500 rounded-2xl" />
            <div className="flex-1">
              <Title level={5} className="!mb-1 text-text-primary">{principal.name}</Title>
              <Space direction="vertical" size={0} className="mb-3">
                <Text className="text-text-secondary text-sm"><MailOutlined className="mr-2 text-text-tertiary" />{principal.email}</Text>
                {principal.phoneNo && <Text className="text-text-secondary text-sm"><PhoneOutlined className="mr-2 text-text-tertiary" />{principal.phoneNo}</Text>}
              </Space>
              {principal.stats && (
                <div className="flex gap-2">
                  <Tag color="blue" className="rounded-md border-0">Students: {principal.stats.totalStudents}</Tag>
                  <Tag color="green" className="rounded-md border-0">Faculty: {principal.stats.totalFaculty}</Tag>
                  <Tag color="orange" className="rounded-md border-0">Pending: {principal.stats.pendingApprovals}</Tag>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Faculty List */}
      <Card 
        title={
          <div className="flex items-center gap-2">
            <TeamOutlined className="text-primary" />
            <span className="font-bold text-text-primary">Faculty Members</span>
          </div>
        }
        className="rounded-2xl border-border shadow-sm bg-surface overflow-hidden"
        styles={{ body: { padding: 0 } }}
      >
        {(!faculty || faculty.length === 0) ? (
          <Empty description="No faculty members found" className="py-12" />
        ) : (
          <List
            dataSource={faculty}
            className="w-full"
            renderItem={(item) => (
              <List.Item 
                className="px-6 py-4 hover:bg-background-tertiary transition-colors border-b border-border last:border-0"
                actions={[<Tag key="role" color={item.role === 'HOD' ? 'purple' : 'blue'} className="rounded-md m-0 font-bold border-0">{item.role}</Tag>]}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={<UserOutlined />} className="bg-background-tertiary text-text-secondary rounded-lg" />}
                  title={<Space className="text-text-primary font-semibold">{item.name}{item.branchName && <Tag className="text-[10px] rounded-sm m-0">{item.branchName}</Tag>}</Space>}
                  description={
                    <div className="space-y-2 mt-1">
                      <Text className="text-xs text-text-tertiary block">{item.email}</Text>
                      <div className="flex gap-2 flex-wrap">
                        <Tooltip title="Students Assigned">
                          <Tag icon={<TeamOutlined />} className="rounded-md bg-background border-border text-text-secondary m-0">
                            {item.stats?.assignedStudents || 0}
                          </Tag>
                        </Tooltip>
                        <Tooltip title="Visits Done/Scheduled">
                          <Tag icon={<EnvironmentOutlined />} color={item.stats?.visitCompletionRate >= 80 ? 'green' : 'orange'} className="rounded-md border-0 m-0">
                            {item.stats?.visitsCompleted || 0}/{item.stats?.visitsScheduled || 0}
                          </Tag>
                        </Tooltip>
                        <Tooltip title="Reports Reviewed">
                          <Tag icon={<FileTextOutlined />} className="rounded-md bg-background border-border text-text-secondary m-0">
                            {item.stats?.reportsReviewed || 0}
                          </Tag>
                        </Tooltip>
                      </div>
                    </div>
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
    <Modal title="Student Details" open={visible} onCancel={onClose} footer={null} width={800} destroyOnClose className="rounded-2xl overflow-hidden">
      <div className="space-y-4 pt-2">
        <Descriptions bordered column={2} size="small" title={<Text className="text-xs uppercase font-bold text-text-tertiary">Basic Information</Text>} className="rounded-xl overflow-hidden">
          <Descriptions.Item label="Name"><Text strong>{student.name}</Text></Descriptions.Item>
          <Descriptions.Item label="Roll Number">{student.rollNumber}</Descriptions.Item>
          <Descriptions.Item label="Email">{student.email}</Descriptions.Item>
          <Descriptions.Item label="Branch">{student.branchName}</Descriptions.Item>
          <Descriptions.Item label="Mentor">{mentor ? <Tag color="green">{mentor.name}</Tag> : <Tag color="red">Unassigned</Tag>}</Descriptions.Item>
          <Descriptions.Item label="Company">{company ? company.companyName : '-'}</Descriptions.Item>
        </Descriptions>

        {student.hasSelfIdentifiedInternship && selfId && (
          <Descriptions bordered column={2} size="small" title={<Text className="text-xs uppercase font-bold text-text-tertiary">Self-Identified Internship</Text>} className="rounded-xl overflow-hidden">
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

        <Descriptions bordered column={2} size="small" title={<Text className="text-xs uppercase font-bold text-text-tertiary">Current Status</Text>} className="rounded-xl overflow-hidden">
          <Descriptions.Item label="Report Status">
            {student.currentMonthReport ? <Tag color={getStatusColor(student.currentMonthReport.status)}>{student.currentMonthReport.status}</Tag> : <Tag color="red">Not Submitted</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Submitted At">{student.currentMonthReport?.submittedAt ? new Date(student.currentMonthReport.submittedAt).toLocaleString() : '-'}</Descriptions.Item>
          <Descriptions.Item label="Last Faculty Visit">{student.lastFacultyVisit?.date ? new Date(student.lastFacultyVisit.date).toLocaleDateString() : 'No visits yet'}</Descriptions.Item>
          <Descriptions.Item label="Visit Status">{student.lastFacultyVisit ? <Tag color={getStatusColor(student.lastFacultyVisit.status)}>{student.lastFacultyVisit.status}</Tag> : '-'}</Descriptions.Item>
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

  // Handler for viewing student details
  const handleViewStudentDetails = useCallback((record) => {
    setSelectedStudent(record);
    setStudentModalVisible(true);
  }, []);

  // Handler for approving report
  const handleApproveReport = useCallback(() => {
    message.info('Report approval coming soon');
  }, []);

  // Handler for rejecting report
  const handleRejectReport = useCallback(() => {
    message.info('Report rejection coming soon');
  }, []);

  // Student action menu
  const getStudentActionItems = useCallback((record) => {
    const hasMentor = record.mentorAssignments?.some(ma => ma.isActive);
    return [
      { key: 'view', icon: <EyeOutlined />, label: 'View Details', onClick: () => handleViewStudentDetails(record) },
      { type: 'divider' },
      { key: 'mentor', icon: <EditOutlined />, label: hasMentor ? 'Change Mentor' : 'Assign Mentor', onClick: () => handleEditMentor(record) },
      ...(hasMentor ? [{ key: 'remove-mentor', icon: <DeleteOutlined />, label: 'Remove Mentor', danger: true, onClick: () => handleRemoveMentor(record) }] : []),
      { type: 'divider' },
      { key: 'approve-report', icon: <CheckCircleOutlined />, label: 'Approve Report', disabled: !record.currentMonthReport || record.currentMonthReport.status !== 'SUBMITTED', onClick: handleApproveReport },
      { key: 'reject-report', icon: <CloseCircleOutlined />, label: 'Reject Report', danger: true, disabled: !record.currentMonthReport || record.currentMonthReport.status !== 'SUBMITTED', onClick: handleRejectReport },
    ];
  }, [handleEditMentor, handleRemoveMentor, handleViewStudentDetails, handleApproveReport, handleRejectReport]);

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
      title: 'Company', key: 'company', width: 180,
      render: (_, record) => {
        // Prefer company object, then selfIdentifiedData
        const company = record.company;
        const selfId = record.selfIdentifiedData;

        if (company?.companyName) {
          return (
            <Tooltip title={company.isSelfIdentified ? `${company.jobProfile || 'Self-identified'}` : (company.city || '')}>
              <div className="flex items-center gap-1">
                <Tag color={company.isSelfIdentified ? 'purple' : 'blue'} className="max-w-[140px] truncate m-0">
                  {company.companyName}
                </Tag>
                {company.isSelfIdentified && <Tag color="green" className="text-[9px] px-1 m-0">Self</Tag>}
              </div>
            </Tooltip>
          );
        }
        if (selfId?.companyName) {
          return (
            <Tooltip title={selfId.jobProfile || 'Self-identified internship'}>
              <div className="flex items-center gap-1">
                <Tag color="purple" className="max-w-[140px] truncate m-0">{selfId.companyName}</Tag>
                <Tag color="green" className="text-[9px] px-1 m-0">Self</Tag>
              </div>
            </Tooltip>
          );
        }
        return <Text type="secondary">-</Text>;
      },
    },
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

  // Handler for viewing company details
  const handleViewCompanyDetails = useCallback((record) => {
    setSelectedCompany(record);
    setCompanyModalVisible(true);
  }, []);

  // Memoized company columns - Enhanced design
  const companyColumns = useMemo(() => [
    {
      title: 'Company', key: 'company', width: 260, fixed: 'left',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <Avatar
            icon={<BankOutlined />}
            className={record.isSelfIdentifiedCompany
              ? 'bg-gradient-to-br from-purple-500 to-pink-500'
              : 'bg-gradient-to-br from-blue-500 to-cyan-500'}
            size={40}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Text strong className="text-sm truncate max-w-[160px]" title={record.companyName}>
                {record.companyName || 'Unknown Company'}
              </Text>
              {record.isSelfIdentifiedCompany && (
                <Tag color="purple" className="text-[10px] px-1.5 py-0 m-0 rounded-full">
                  Self-Identified
                </Tag>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
              <EnvironmentOutlined className="text-[10px]" />
              <span className="truncate max-w-[180px]">
                {record.isSelfIdentifiedCompany
                  ? (record.companyAddress || 'Address not provided')
                  : `${record.city || 'N/A'}${record.state ? `, ${record.state}` : ''}`}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Industry', dataIndex: 'industryType', key: 'industryType', width: 130,
      render: (type, record) => (
        <Tag
          color={record.isSelfIdentifiedCompany ? 'purple' : 'cyan'}
          className="font-medium"
        >
          {type || 'General'}
        </Tag>
      ),
    },
    {
      title: 'Contact', key: 'contact', width: 180,
      render: (_, record) => (
        <div className="space-y-1">
          {(record.email || record.companyEmail) && (
            <div className="flex items-center gap-1 text-xs">
              <MailOutlined className="text-gray-400 text-[10px]" />
              <span className="truncate max-w-[140px]" title={record.email || record.companyEmail}>
                {record.email || record.companyEmail}
              </span>
            </div>
          )}
          {(record.phoneNo || record.companyContact) && (
            <div className="flex items-center gap-1 text-xs">
              <PhoneOutlined className="text-gray-400 text-[10px]" />
              <span>{record.phoneNo || record.companyContact}</span>
            </div>
          )}
          {!record.email && !record.companyEmail && !record.phoneNo && !record.companyContact && (
            <Text type="secondary" className="text-xs">No contact info</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Students', key: 'students', width: 100, align: 'center',
      render: (_, record) => (
        <div className="flex flex-col items-center">
          <div className="text-lg font-bold text-blue-600">{record.studentCount || 0}</div>
          <div className="text-[10px] text-gray-500">placed</div>
        </div>
      ),
    },
    {
      title: 'Branches', key: 'branches', width: 200,
      render: (_, record) => (
        <div className="flex flex-wrap gap-1">
          {record.branchWiseData?.slice(0, 2).map((b, i) => (
            <Tag key={i} className="text-xs m-0" color="blue">
              {b.branch}: <strong>{b.total}</strong>
            </Tag>
          ))}
          {record.branchWiseData?.length > 2 && (
            <Tooltip title={record.branchWiseData.slice(2).map(b => `${b.branch}: ${b.total}`).join(', ')}>
              <Tag className="text-xs m-0 cursor-pointer" color="default">
                +{record.branchWiseData.length - 2} more
              </Tag>
            </Tooltip>
          )}
          {(!record.branchWiseData || record.branchWiseData.length === 0) && (
            <Text type="secondary" className="text-xs">-</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Status', key: 'status', width: 130, align: 'center',
      render: (_, record) => (
        <div className="flex flex-col items-center gap-1">
          {record.isSelfIdentifiedCompany ? (
            <Tag icon={<CheckCircleOutlined />} color="success" className="m-0">
              Auto-Approved
            </Tag>
          ) : (
            <>
              {record.isApproved ? (
                <Tag icon={<CheckCircleOutlined />} color="success" className="m-0">Approved</Tag>
              ) : record.isVerified ? (
                <Tag icon={<SafetyCertificateOutlined />} color="processing" className="m-0">Verified</Tag>
              ) : (
                <Tag icon={<ClockCircleOutlined />} color="warning" className="m-0">Pending</Tag>
              )}
            </>
          )}
        </div>
      ),
    },
    {
      title: 'Action', key: 'action', width: 120, fixed: 'right', align: 'center',
      render: (_, record) => (
        <Button
          type="primary"
          ghost
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewCompanyDetails(record)}
        >
          Details
        </Button>
      ),
    },
  ], [handleViewCompanyDetails]);

  // No institute selected
  if (!selectedInstitute?.id) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Result
          icon={<BankOutlined className="text-text-tertiary text-6xl" />}
          title={<span className="text-text-primary">Select an Institution</span>}
          subTitle={<span className="text-text-secondary">Choose an institution from the side panel to view detailed information</span>}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between shrink-0">
        <div>
          <Title level={4} className="!mb-1 !text-text-primary text-xl font-bold">{overview.data?.institution?.name || 'Loading...'}</Title>
          <Text className="text-text-secondary flex items-center gap-2 text-sm">
            <EnvironmentOutlined /> {overview.data?.institution?.city}
            {overview.data?.institution?.district && `, ${overview.data?.institution?.district}`}
            <span className="w-1 h-1 rounded-full bg-text-tertiary opacity-50" />
            <span className="font-mono text-xs bg-background-tertiary px-1.5 py-0.5 rounded border border-border">{overview.data?.institution?.code}</span>
          </Text>
        </div>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={() => dispatch(fetchInstituteOverview(selectedInstitute.id))} 
          loading={overview.loading}
          className="rounded-xl h-10 font-bold border-border hover:border-primary hover:text-primary"
        >
          Refresh Data
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          className="h-full flex flex-col custom-tabs"
          tabBarStyle={{
            marginBottom: 0,
            flexShrink: 0,
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
          tabBarGutter={24}
          items={[
            {
              key: 'overview',
              label: <><TeamOutlined /> Overview</>,
              children: <div className="h-full overflow-y-auto hide-scrollbar"><OverviewTab data={overview.data} loading={overview.loading} error={overview.error} /></div>,
            },
            {
              key: 'students',
              label: <><UserOutlined /> Students ({students.total})</>,
              children: (
                <div className="h-full flex flex-col p-4 space-y-4 overflow-hidden">
                  <Card className="rounded-2xl border-border shadow-sm shrink-0" styles={{ body: { padding: '16px' } }}>
                    <div className="flex flex-wrap items-center gap-3">
                      <Input.Search
                        placeholder="Search students..."
                        value={studentSearchInput}
                        onChange={(e) => setStudentSearchInput(e.target.value)}
                        className="w-64 rounded-xl h-10 bg-background border-border"
                        allowClear
                      />
                      <Button icon={<FilterOutlined />} onClick={() => setShowFilters(!showFilters)} type={showFilters ? 'primary' : 'default'} className="rounded-xl h-10 font-bold">Filters</Button>
                      <Button icon={<ReloadOutlined />} onClick={resetFilters} className="rounded-xl h-10">Reset</Button>
                    </div>
                    {showFilters && (
                      <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-text-tertiary mb-1">Mentor Status</div>
                          <Select value={studentFilter} onChange={setStudentFilter} className="w-full h-10 rounded-lg">
                            <Select.Option value="all">All</Select.Option>
                            <Select.Option value="assigned">Assigned</Select.Option>
                            <Select.Option value="unassigned">Unassigned</Select.Option>
                          </Select>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-text-tertiary mb-1">Branch</div>
                          <Select value={branchFilter} onChange={setBranchFilter} className="w-full h-10 rounded-lg">
                            <Select.Option value="all">All Branches</Select.Option>
                            {availableBranches.map((b) => <Select.Option key={b} value={b}>{b}</Select.Option>)}
                          </Select>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-text-tertiary mb-1">Report Status</div>
                          <Select value={reportStatusFilter} onChange={setReportStatusFilter} className="w-full h-10 rounded-lg">
                            <Select.Option value="all">All</Select.Option>
                            <Select.Option value="submitted">Submitted</Select.Option>
                            <Select.Option value="pending">Pending</Select.Option>
                            <Select.Option value="not_submitted">Not Submitted</Select.Option>
                          </Select>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-text-tertiary mb-1">Self-Identified</div>
                          <Select value={selfIdentifiedFilter} onChange={setSelfIdentifiedFilter} className="w-full h-10 rounded-lg">
                            <Select.Option value="all">All</Select.Option>
                            <Select.Option value="yes">Yes</Select.Option>
                            <Select.Option value="no">No</Select.Option>
                          </Select>
                        </div>
                        <div className="sm:col-span-2 md:col-span-4 flex justify-end">
                          <Button type="primary" onClick={applyFilters} className="rounded-xl h-10 font-bold px-6">Apply Filters</Button>
                        </div>
                      </div>
                    )}
                  </Card>
                  
                  {students.error && <Alert type="error" message={students.error} className="rounded-xl" showIcon closable />}
                  
                  <Card className="rounded-2xl border-border shadow-sm flex-1 overflow-hidden" styles={{ body: { padding: 0 } }}>
                    <div className="h-full flex flex-col">
                      <Table 
                        columns={studentColumns} 
                        dataSource={students.list} 
                        rowKey="id" 
                        loading={students.loading} 
                        pagination={false} 
                        scroll={{ x: 1200, y: 'calc(100vh - 400px)' }} 
                        size="middle" 
                        className="custom-table flex-1 overflow-hidden"
                      />
                      {students.hasMore && (
                        <div className="text-center p-4 border-t border-border bg-background-tertiary/30">
                          <Button onClick={handleLoadMore} loading={students.loadingMore} className="rounded-xl font-bold">Load More Students</Button>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              ),
            },
            {
              key: 'companies',
              label: <><BankOutlined /> Companies ({companies.total})</>,
              children: (
                <div className="h-full p-4 overflow-y-auto hide-scrollbar space-y-4">
                  {/* Summary Cards */}
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={8}>
                      <Card size="small" className="rounded-xl border-border shadow-sm bg-surface">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <BankOutlined className="text-primary text-xl" />
                          </div>
                          <div>
                            <div className="text-2xl font-black text-text-primary">{companies.total || 0}</div>
                            <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">Total Companies</div>
                          </div>
                        </div>
                      </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Card size="small" className="rounded-xl border-border shadow-sm bg-surface">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                            <TeamOutlined className="text-success text-xl" />
                          </div>
                          <div>
                            <div className="text-2xl font-black text-text-primary">{companies.summary?.totalStudents || 0}</div>
                            <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">Students Placed</div>
                          </div>
                        </div>
                      </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Card size="small" className="rounded-xl border-border shadow-sm bg-surface">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                            <SafetyCertificateOutlined className="text-purple-500 text-xl" />
                          </div>
                          <div>
                            <div className="text-2xl font-black text-text-primary">
                              {companies.summary?.totalSelfIdentified || 0}
                              <span className="text-sm font-normal text-text-tertiary ml-1">
                                ({companies.summary?.selfIdentifiedRate || 0}%)
                              </span>
                            </div>
                            <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">Self-Identified</div>
                          </div>
                        </div>
                      </Card>
                    </Col>
                  </Row>

                  {/* Search and Filters */}
                  <Card className="rounded-2xl border-border shadow-sm" styles={{ body: { padding: '16px' } }}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <Input.Search
                        placeholder="Search companies by name..."
                        value={companySearchInput}
                        onChange={(e) => setCompanySearchInput(e.target.value)}
                        className="max-w-md rounded-xl h-10 bg-background border-border"
                        allowClear
                        enterButton={<Button type="primary" className="rounded-r-xl h-10 font-bold">Search</Button>}
                      />
                      <Tag className="rounded-full px-3 py-1 bg-purple-500/10 text-purple-600 border-purple-500/20 font-bold">
                        {companies.list?.filter(c => c.isSelfIdentifiedCompany).length || 0} Self-Identified Companies
                      </Tag>
                    </div>
                  </Card>

                  {/* Error Alert */}
                  {companies.error && <Alert type="error" message={companies.error} className="rounded-xl" showIcon closable />}

                  {/* Companies Table */}
                  <Card className="rounded-2xl border-border shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
                    {(companies.loading || companies.list?.length > 0) ? (
                      <Table
                        columns={companyColumns}
                        dataSource={companies.list}
                        rowKey="id"
                        loading={companies.loading}
                        pagination={{
                          pageSize: 10,
                          showSizeChanger: true,
                          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} companies`,
                          className: "px-6 py-4",
                        }}
                        size="middle"
                        scroll={{ x: 1100 }}
                        className="custom-table"
                        rowClassName={(record) => record.isSelfIdentifiedCompany ? 'bg-purple-50/10 hover:bg-purple-50/20' : ''}
                      />
                    ) : (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <div className="text-center py-12">
                            <Text type="secondary" className="block mb-1">No companies found</Text>
                            <Text className="text-xs text-text-tertiary">Companies with placed students will appear here</Text>
                          </div>
                        }
                      />
                    )}
                  </Card>
                </div>
              ),
            },
            {
              key: 'faculty',
              label: <><IdcardOutlined /> Faculty & Principal</>,
              children: (
                <div className="h-full overflow-y-auto hide-scrollbar">
                  <FacultyTab principal={facultyPrincipal.principal} faculty={facultyPrincipal.faculty} summary={facultyPrincipal.summary} loading={facultyPrincipal.loading} error={facultyPrincipal.error} />
                </div>
              ),
            },
          ]} 
        />
      </div>

      {/* Student Detail Modal */}
      <StudentDetailModal visible={studentModalVisible} student={selectedStudent} onClose={() => setStudentModalVisible(false)} />

      {/* Company Detail Modal - Enhanced */}
      <Modal
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <BankOutlined className="text-primary text-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-text-primary">{selectedCompany?.companyName || 'Company Details'}</span>
                {selectedCompany?.isSelfIdentifiedCompany && (
                  <Tag color="purple" className="text-[10px] font-bold uppercase tracking-wider rounded-md border-0 m-0">Self-ID</Tag>
                )}
              </div>
              <Text className="text-text-tertiary text-xs uppercase font-bold tracking-wider">
                {selectedCompany?.studentCount || 0} students placed
              </Text>
            </div>
          </div>
        }
        open={companyModalVisible}
        onCancel={() => setCompanyModalVisible(false)}
        footer={null}
        width={900}
        destroyOnClose
        className="rounded-2xl overflow-hidden"
      >
        {selectedCompany && (
          <div className="space-y-6 pt-4">
            {/* Company Info Card */}
            <Card
              size="small"
              className={`rounded-xl border shadow-sm ${selectedCompany.isSelfIdentifiedCompany
                ? 'border-purple-200 bg-purple-50/30'
                : 'border-border bg-surface'}`}
            >
              <Row gutter={[24, 16]}>
                <Col xs={24} sm={8}>
                  <div className="text-[10px] uppercase font-bold text-text-tertiary mb-1">Industry Type</div>
                  <Tag className="m-0 rounded-md font-medium text-text-primary bg-background border-border">
                    {selectedCompany.industryType || 'General'}
                  </Tag>
                </Col>
                <Col xs={24} sm={8}>
                  <div className="text-[10px] uppercase font-bold text-text-tertiary mb-1">Location</div>
                  <Text className="text-text-primary font-medium">
                    {selectedCompany.isSelfIdentifiedCompany
                      ? (selectedCompany.companyAddress || 'Not specified')
                      : `${selectedCompany.city || 'N/A'}${selectedCompany.state ? `, ${selectedCompany.state}` : ''}`}
                  </Text>
                </Col>
                <Col xs={24} sm={8}>
                  <div className="text-[10px] uppercase font-bold text-text-tertiary mb-1">Status</div>
                  {selectedCompany.isSelfIdentifiedCompany ? (
                    <Tag icon={<CheckCircleOutlined />} color="success" className="m-0 rounded-md font-bold border-0">Auto-Approved</Tag>
                  ) : (
                    <Space>
                      {selectedCompany.isApproved && <Tag icon={<CheckCircleOutlined />} color="success" className="m-0 rounded-md border-0">Approved</Tag>}
                      {selectedCompany.isVerified && <Tag icon={<SafetyCertificateOutlined />} color="processing" className="m-0 rounded-md border-0">Verified</Tag>}
                      {!selectedCompany.isApproved && !selectedCompany.isVerified && <Tag color="warning" className="m-0 rounded-md border-0">Pending</Tag>}
                    </Space>
                  )}
                </Col>
                {(selectedCompany.email || selectedCompany.companyEmail || selectedCompany.phoneNo || selectedCompany.companyContact) && (
                  <>
                    <Col xs={24} sm={12}>
                      <div className="text-[10px] uppercase font-bold text-text-tertiary mb-1">Email</div>
                      <div className="flex items-center gap-2">
                        <MailOutlined className="text-text-tertiary text-xs" />
                        <Text className="text-text-primary font-medium">{selectedCompany.email || selectedCompany.companyEmail || 'N/A'}</Text>
                      </div>
                    </Col>
                    <Col xs={24} sm={12}>
                      <div className="text-[10px] uppercase font-bold text-text-tertiary mb-1">Phone</div>
                      <div className="flex items-center gap-2">
                        <PhoneOutlined className="text-text-tertiary text-xs" />
                        <Text className="text-text-primary font-medium">{selectedCompany.phoneNo || selectedCompany.companyContact || 'N/A'}</Text>
                      </div>
                    </Col>
                  </>
                )}
              </Row>
            </Card>

            {/* Branch-wise Distribution */}
            {selectedCompany.branchWiseData?.length > 0 && (
              <div>
                <Title level={5} className="!mb-3 text-xs uppercase tracking-widest text-text-tertiary font-bold">Branch Distribution</Title>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {selectedCompany.branchWiseData.map((b, i) => (
                    <div key={i} className="p-3 rounded-xl bg-background-tertiary/30 border border-border text-center">
                      <div className="text-xl font-black text-primary">{b.total}</div>
                      <div className="text-[10px] text-text-secondary truncate font-bold uppercase tracking-wide" title={b.branch}>{b.branch}</div>
                      {b.selfIdentified > 0 && (
                        <div className="text-[9px] text-purple-600 font-bold mt-1">
                          {b.selfIdentified} Self-ID
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Students Table */}
            <div>
              <Title level={5} className="!mb-3 text-xs uppercase tracking-widest text-text-tertiary font-bold">Placed Students ({selectedCompany.students?.length || 0})</Title>
              <div className="rounded-xl border border-border overflow-hidden">
                <Table
                  dataSource={selectedCompany.students || []}
                  columns={[
                    {
                      title: 'Student', key: 'student', width: 200,
                      render: (_, record) => (
                        <div className="flex items-center gap-3">
                          <Avatar size="small" icon={<UserOutlined />} className="bg-primary/10 text-primary border border-primary/20" />
                          <div>
                            <div className="font-bold text-sm text-text-primary">{record.name}</div>
                            <div className="text-xs text-text-tertiary">{record.email}</div>
                          </div>
                        </div>
                      ),
                    },
                    { title: 'Roll No.', dataIndex: 'rollNumber', key: 'rollNumber', width: 100, render: (t) => <span className="font-mono text-xs">{t}</span> },
                    {
                      title: 'Branch', dataIndex: 'branch', key: 'branch', width: 120,
                      render: (text) => <Tag className="rounded-md border-0 bg-background-tertiary text-text-secondary m-0 text-[10px] font-bold uppercase">{text || 'N/A'}</Tag>,
                    },
                    ...(selectedCompany.isSelfIdentifiedCompany ? [
                      {
                        title: 'Job Profile', dataIndex: 'jobProfile', key: 'jobProfile', width: 150,
                        render: (text) => text ? <Text className="text-sm font-medium">{text}</Text> : <Text type="secondary">-</Text>,
                      },
                      {
                        title: 'Stipend', dataIndex: 'stipend', key: 'stipend', width: 100,
                        render: (val) => val ? (
                          <Text className="font-bold text-success">₹{Number(val).toLocaleString()}/mo</Text>
                        ) : <Text type="secondary">-</Text>,
                      },
                    ] : [
                      {
                        title: 'Type', dataIndex: 'isSelfIdentified', key: 'isSelfIdentified', width: 100,
                        render: (val) => val ? (
                          <Tag color="purple" icon={<CheckCircleOutlined />} className="rounded-md border-0 m-0">Self-ID</Tag>
                        ) : (
                          <Tag color="blue" className="rounded-md border-0 m-0">College</Tag>
                        ),
                      },
                    ]),
                    {
                      title: 'Joining Letter', dataIndex: 'joiningLetterStatus', key: 'joiningLetterStatus', width: 120,
                      render: (status) => status ? (
                        <Tag
                          icon={status === 'APPROVED' ? <CheckCircleOutlined /> : status === 'PENDING' ? <ClockCircleOutlined /> : <CloseCircleOutlined />}
                          color={getStatusColor(status)}
                          className="rounded-md border-0 m-0 font-medium"
                        >
                          {status}
                        </Tag>
                      ) : <Text type="secondary" className="text-xs italic">Not uploaded</Text>,
                    },
                  ]}
                  rowKey="id"
                  pagination={{ pageSize: 5, showSizeChanger: false }}
                  size="small"
                  scroll={{ x: 700 }}
                  className="custom-table"
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Mentor Assignment Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-primary">
            <TeamOutlined /> 
            <span className="font-bold">{mentorStudent?.mentorAssignments?.some(ma => ma.isActive) ? 'Change' : 'Assign'} Mentor</span>
          </div>
        }
        open={mentorModalVisible}
        onCancel={() => { setMentorModalVisible(false); setMentorStudent(null); setSelectedMentorId(null); }}
        onOk={handleAssignMentor}
        okText="Save Assignment"
        confirmLoading={assigningMentor}
        okButtonProps={{ disabled: !selectedMentorId, className: "rounded-xl font-bold h-10" }}
        cancelButtonProps={{ className: "rounded-xl h-10 font-medium" }}
        destroyOnClose
        className="rounded-2xl overflow-hidden"
      >
        <div className="py-6">
          <div className="bg-background-tertiary/30 p-4 rounded-xl border border-border mb-6">
            <Text className="text-text-secondary text-sm block mb-1">Student:</Text>
            <Text className="text-text-primary font-bold text-lg">{mentorStudent?.name || 'Student'}</Text>
            {mentorStudent?.mentorAssignments?.find(ma => ma.isActive)?.mentor && (
              <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2">
                <Text type="secondary" className="text-xs">Current Mentor:</Text>
                <Tag color="blue" className="m-0 rounded-md border-0 font-medium">{mentorStudent.mentorAssignments.find(ma => ma.isActive).mentor.name}</Tag>
              </div>
            )}
          </div>

          <Text className="block mb-2 font-bold text-text-primary text-sm uppercase tracking-wide">Select New Mentor</Text>
          <Select
            placeholder="Select a mentor from this institution"
            loading={mentorsLoading}
            value={selectedMentorId}
            onChange={setSelectedMentorId}
            style={{ width: '100%' }}
            size="large"
            className="rounded-xl"
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) => option.children.toLowerCase().includes(input.toLowerCase())}
          >
            {mentors.map((mentor) => (
              <Select.Option key={mentor.id} value={mentor.id}>
                {mentor.name} • <span className="text-text-tertiary text-xs">{mentor.activeAssignments} active students</span>
              </Select.Option>
            ))}
          </Select>
        </div>
      </Modal>
    </div>
  );
};

export default memo(InstituteDetailView);