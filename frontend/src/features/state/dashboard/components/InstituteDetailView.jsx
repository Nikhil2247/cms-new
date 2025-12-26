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
  SearchOutlined,
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

// Status color helper
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
  if (loading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  if (error) return <Alert type="error" title="Failed to load overview" description={error} showIcon className="rounded-xl border-error/20 bg-error/5" />;
  if (!data) return <Empty description="No data available" />;

  return (
    <div className="space-y-6 p-1">
      {/* Compliance Score & Key Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-border shadow-soft bg-surface overflow-hidden h-full">
          <div className="flex flex-col items-center justify-center h-full py-6">
            <Progress
              type="circle"
              percent={data.complianceScore || 0}
              size={140}
              strokeColor={{ '0%': 'rgb(var(--color-info))', '100%': 'rgb(var(--color-success))' }}
              format={(p) => (
                <div className="flex flex-col items-center">
                  <span className="text-4xl font-black text-text-primary">{p}%</span>
                  <span className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest mt-1">Score</span>
                </div>
              )}
            />
            <div className="mt-6 text-center">
              <Text className="text-xl font-bold text-text-primary block">Compliance Status</Text>
              <Text className="text-text-secondary text-sm">Overall performance rating</Text>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2 rounded-2xl border-border shadow-soft bg-surface h-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <BankOutlined className="text-xl" />
            </div>
            <Title level={4} className="!mb-0 !text-lg font-bold text-text-primary">Key Metrics</Title>
          </div>
          
          <div className="grid grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-background-tertiary/50 border border-border flex flex-col items-center justify-center text-center transition-all hover:bg-background-tertiary">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                <TeamOutlined className="text-xl" />
              </div>
              <div className="text-3xl font-black text-text-primary mb-1">{data.totalStudents || 0}</div>
              <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">Total Students</div>
            </div>
            <div className="p-6 rounded-2xl bg-background-tertiary/50 border border-border flex flex-col items-center justify-center text-center transition-all hover:bg-background-tertiary">
              <div className="w-12 h-12 rounded-xl bg-success/10 text-success flex items-center justify-center mb-3">
                <BankOutlined className="text-xl" />
              </div>
              <div className="text-3xl font-black text-text-primary mb-1">{data.companiesCount || 0}</div>
              <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">Companies</div>
            </div>
            <div className="p-6 rounded-2xl bg-background-tertiary/50 border border-border flex flex-col items-center justify-center text-center transition-all hover:bg-background-tertiary">
              <div className="w-12 h-12 rounded-xl bg-warning/10 text-warning flex items-center justify-center mb-3">
                <UserOutlined className="text-xl" />
              </div>
              <div className="text-3xl font-black text-text-primary mb-1">{data.facultyCount || 0}</div>
              <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">Faculty</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Self-Identified Internships */}
      <Card
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
              <SafetyCertificateOutlined className="text-purple-500 text-lg" />
            </div>
            <span className="font-bold text-text-primary text-lg">Self-Identified Internships</span>
          </div>
        }
        className="rounded-2xl border-border shadow-soft bg-surface"
        extra={
          <Tag color="blue" className="rounded-lg font-bold px-3 py-1 text-sm border-0">
            {data.totalStudents > 0 ? `${data.selfIdentifiedInternships?.rate || 0}% of students` : 'N/A'}
          </Tag>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="text-center p-4 bg-background-tertiary/30 rounded-xl border border-border/50">
            <div className="text-3xl font-bold text-text-primary">{data.selfIdentifiedInternships?.total || 0}</div>
            <div className="text-xs text-text-tertiary uppercase tracking-wider font-bold mt-1">Total</div>
          </div>
          <div className="text-center p-4 bg-success/5 rounded-xl border border-success/10">
            <div className="text-3xl font-bold text-success">{data.selfIdentifiedInternships?.approved || 0}</div>
            <div className="text-xs text-success-700 uppercase tracking-wider font-bold mt-1">Approved</div>
          </div>
          <div className="text-center p-4 bg-warning/5 rounded-xl border border-warning/10">
            <div className="text-3xl font-bold text-warning">{data.selfIdentifiedInternships?.pending || 0}</div>
            <div className="text-xs text-warning-700 uppercase tracking-wider font-bold mt-1">Pending</div>
          </div>
          <div className="text-center p-4 bg-error/5 rounded-xl border border-error/10">
            <div className="text-3xl font-bold text-error">{data.selfIdentifiedInternships?.rejected || 0}</div>
            <div className="text-xs text-error-700 uppercase tracking-wider font-bold mt-1">Rejected</div>
          </div>
        </div>
      </Card>

      {/* Mentor Assignment */}
      <Card 
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
              <TeamOutlined className="text-indigo-500 text-lg" />
            </div>
            <span className="font-bold text-text-primary text-lg">Mentor Assignment</span>
          </div>
        }
        className="rounded-2xl border-border shadow-soft bg-surface"
      >
        <div className="flex flex-col md:flex-row items-center gap-8 py-2">
          <div className="flex-1 w-full">
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-success/5 border border-success/20 text-center">
                <div className="text-4xl font-black text-success mb-1">{data.mentorAssignment?.assigned || 0}</div>
                <div className="text-xs font-bold text-success-700 uppercase tracking-wider">Assigned Students</div>
              </div>
              <div className="p-6 rounded-2xl bg-error/5 border border-error/20 text-center">
                <div className="text-4xl font-black text-error mb-1">{data.mentorAssignment?.unassigned || 0}</div>
                <div className="text-xs font-bold text-error-700 uppercase tracking-wider">Unassigned Students</div>
              </div>
            </div>
          </div>
          <div className="text-center shrink-0 px-8 border-l border-border/50 hidden md:block">
            <Progress 
              type="circle" 
              percent={Math.round(data.mentorAssignment?.rate || 0)} 
              size={100} 
              strokeColor="rgb(var(--color-primary))"
              format={(p) => <span className="text-xl font-bold text-text-primary">{p}%</span>}
            />
            <div className="text-xs uppercase font-bold text-text-tertiary mt-3 tracking-wide">Coverage Rate</div>
          </div>
        </div>
      </Card>

      {/* Joining Letters & Monthly Reports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          title={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <FileProtectOutlined className="text-blue-500 text-lg" />
              </div>
              <span className="font-bold text-text-primary text-lg">Joining Letters</span>
            </div>
          }
          className="rounded-2xl border-border shadow-soft bg-surface"
          extra={
            <Tag
              color={data.joiningLetterStatus?.rate >= 80 ? 'green' : 'orange'}
              className="rounded-lg font-bold border-0 px-2 py-0.5"
            >
              {data.joiningLetterStatus?.total > 0 ? `${data.joiningLetterStatus?.rate || 0}%` : 'N/A'}
            </Tag>
          }
        >
          <div className="grid grid-cols-2 gap-y-6">
            <Statistic title={<span className="text-xs uppercase font-bold text-text-tertiary">Submitted</span>} value={data.joiningLetterStatus?.submitted || 0} styles={{ content: { fontSize: '24px', fontWeight: 'bold', color: 'rgb(var(--color-text-primary))' } }} />
            <Statistic title={<span className="text-xs uppercase font-bold text-text-tertiary">Pending</span>} value={data.joiningLetterStatus?.pending || 0} styles={{ content: { fontSize: '24px', fontWeight: 'bold', color: 'rgb(var(--ant-warning-color))' } }} />
            <Statistic title={<span className="text-xs uppercase font-bold text-text-tertiary">Approved</span>} value={data.joiningLetterStatus?.approved || 0} styles={{ content: { fontSize: '24px', fontWeight: 'bold', color: 'rgb(var(--ant-success-color))' } }} />
            <Statistic title={<span className="text-xs uppercase font-bold text-text-tertiary">Rejected</span>} value={data.joiningLetterStatus?.rejected || 0} styles={{ content: { fontSize: '24px', fontWeight: 'bold', color: 'rgb(var(--ant-error-color))' } }} />
          </div>
        </Card>

        <Card
          title={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                <CalendarOutlined className="text-orange-500 text-lg" />
              </div>
              <span className="font-bold text-text-primary text-lg">Monthly Reports</span>
            </div>
          }
          className="rounded-2xl border-border shadow-soft bg-surface"
          extra={
            <Tag
              color={data.monthlyReportStatus?.rate >= 80 ? 'green' : 'orange'}
              className="rounded-lg font-bold border-0 px-2 py-0.5"
            >
              {data.monthlyReportStatus?.total > 0 ? `${data.monthlyReportStatus?.rate || 0}%` : 'N/A'}
            </Tag>
          }
        >
          <div className="grid grid-cols-2 gap-y-6">
            <Statistic title={<span className="text-xs uppercase font-bold text-text-tertiary">Submitted</span>} value={data.monthlyReportStatus?.submitted || 0} styles={{ content: { fontSize: '24px', fontWeight: 'bold', color: 'rgb(var(--color-text-primary))' } }} />
            <Statistic title={<span className="text-xs uppercase font-bold text-text-tertiary">Pending</span>} value={data.monthlyReportStatus?.pending || 0} styles={{ content: { fontSize: '24px', fontWeight: 'bold', color: 'rgb(var(--ant-warning-color))' } }} />
            <Statistic title={<span className="text-xs uppercase font-bold text-text-tertiary">Approved</span>} value={data.monthlyReportStatus?.approved || 0} styles={{ content: { fontSize: '24px', fontWeight: 'bold', color: 'rgb(var(--ant-success-color))' } }} />
            <Statistic title={<span className="text-xs uppercase font-bold text-text-tertiary">Missing</span>} value={data.monthlyReportStatus?.notSubmitted || 0} styles={{ content: { fontSize: '24px', fontWeight: 'bold', color: 'rgb(var(--ant-error-color))' } }} />
          </div>
        </Card>
      </div>

      {/* Faculty Visits */}
      <Card
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
              <EnvironmentOutlined className="text-teal-500 text-lg" />
            </div>
            <span className="font-bold text-text-primary text-lg">Faculty Visits (This Month)</span>
          </div>
        }
        className="rounded-2xl border-border shadow-soft bg-surface"
        extra={
          <Tag
            color={data.facultyVisits?.completionRate >= 80 ? 'green' : 'orange'}
            className="rounded-lg font-bold border-0 px-2 py-0.5"
          >
            {data.facultyVisits?.scheduled > 0 ? `${data.facultyVisits?.completionRate || 0}% Complete` : 'N/A'}
          </Tag>
        }
      >
        <div className="grid grid-cols-3 gap-6 text-center pt-2">
          <div className="p-4 bg-background-tertiary/30 rounded-2xl">
            <div className="text-3xl font-black text-text-primary">{data.facultyVisits?.scheduled || 0}</div>
            <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest mt-1">Scheduled</div>
          </div>
          <div className="p-4 bg-success/5 border border-success/20 rounded-2xl">
            <div className="text-3xl font-black text-success">{data.facultyVisits?.completed || 0}</div>
            <div className="text-[10px] uppercase font-bold text-success-700 tracking-widest mt-1">Completed</div>
          </div>
          <div className="p-4 bg-warning/5 border border-warning/20 rounded-2xl">
            <div className="text-3xl font-black text-warning">{data.facultyVisits?.toBeDone || 0}</div>
            <div className="text-[10px] uppercase font-bold text-warning-700 tracking-widest mt-1">Pending</div>
          </div>
        </div>
      </Card>

      {/* Branch-wise Distribution */}
      {data.branchWiseData?.length > 0 && (
        <Card 
          title={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <AuditOutlined className="text-primary text-lg" />
              </div>
              <span className="font-bold text-text-primary text-lg">Branch Distribution</span>
            </div>
          }
          className="rounded-2xl border-border shadow-soft bg-surface"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {data.branchWiseData.map((branch, index) => (
              <div key={index} className="p-4 rounded-xl bg-background-tertiary/50 border border-border text-center hover:bg-background-tertiary transition-colors">
                <div className="text-2xl font-black text-primary">{branch.count}</div>
                <div className="text-[10px] text-text-secondary truncate font-bold uppercase tracking-wide mt-1" title={branch.branch}>{branch.branch}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
});

OverviewTab.displayName = 'OverviewTab';

// Memoized Faculty Tab Component
const FacultyTab = memo(({ principal, faculty, summary, loading, error }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Spin size="large" />
        <Text className="text-text-tertiary">Loading faculty information...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        title="Failed to load faculty data"
        description={error}
        showIcon
        className="rounded-xl"
      />
    );
  }

  // Empty state
  if (!principal && (!faculty || faculty.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-20 h-20 rounded-2xl bg-background-tertiary flex items-center justify-center mb-4">
          <TeamOutlined className="text-3xl text-text-tertiary" />
        </div>
        <Text className="text-text-primary font-medium text-lg mb-1">No Faculty Data</Text>
        <Text className="text-text-tertiary">Faculty and principal information will appear here</Text>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary Row */}
      {summary && (
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <div className="bg-surface rounded-xl border border-border p-4 text-center">
              <div className="text-2xl font-bold text-text-primary">{summary.totalFaculty || 0}</div>
              <div className="text-xs text-text-tertiary mt-1">Total Faculty</div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div className="bg-surface rounded-xl border border-border p-4 text-center">
              <div className="text-2xl font-bold text-primary">{summary.totalStudentsAssigned || 0}</div>
              <div className="text-xs text-text-tertiary mt-1">Students Assigned</div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div className="bg-surface rounded-xl border border-border p-4 text-center">
              <div className="text-2xl font-bold text-success">{summary.totalVisitsCompleted || 0}</div>
              <div className="text-xs text-text-tertiary mt-1">Visits Completed</div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div className="bg-surface rounded-xl border border-border p-4 text-center">
              <Progress
                type="circle"
                percent={summary.overallVisitCompletionRate || 0}
                size={48}
                strokeWidth={8}
                strokeColor="rgb(var(--color-primary))"
              />
              <div className="text-xs text-text-tertiary mt-1">Visit Rate</div>
            </div>
          </Col>
        </Row>
      )}

      {/* Principal Card */}
      {principal && (
        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-2xl border border-indigo-200/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <IdcardOutlined className="text-white text-sm" />
            </div>
            <Text className="font-bold text-text-primary">Principal</Text>
          </div>

          <div className="flex items-start gap-5">
            <Avatar size={64} icon={<UserOutlined />} className="bg-indigo-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <Text className="text-xl font-bold text-text-primary block">{principal.name}</Text>
              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <MailOutlined className="text-text-tertiary" />
                  <span>{principal.email}</span>
                </div>
                {principal.phoneNo && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <PhoneOutlined className="text-text-tertiary" />
                    <span>{principal.phoneNo}</span>
                  </div>
                )}
              </div>
              {principal.stats && (
                <div className="flex flex-wrap gap-3 mt-4">
                  <div className="bg-white/50 rounded-lg px-3 py-1.5 text-center">
                    <div className="text-lg font-bold text-text-primary">{principal.stats.totalStudents || 0}</div>
                    <div className="text-[10px] text-text-tertiary uppercase">Students</div>
                  </div>
                  <div className="bg-white/50 rounded-lg px-3 py-1.5 text-center">
                    <div className="text-lg font-bold text-text-primary">{principal.stats.totalFaculty || 0}</div>
                    <div className="text-[10px] text-text-tertiary uppercase">Faculty</div>
                  </div>
                  <div className="bg-white/50 rounded-lg px-3 py-1.5 text-center">
                    <div className="text-lg font-bold text-warning">{principal.stats.pendingApprovals || 0}</div>
                    <div className="text-[10px] text-text-tertiary uppercase">Pending</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Faculty Grid */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TeamOutlined className="text-primary" />
          <Text className="font-bold text-text-primary">Faculty Members</Text>
          {faculty && <Tag className="m-0 rounded-full text-xs bg-primary/10 text-primary border-0">{faculty.length}</Tag>}
        </div>

        {(!faculty || faculty.length === 0) ? (
          <div className="bg-surface rounded-xl border border-border p-8 text-center">
            <Text className="text-text-tertiary">No faculty members found</Text>
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            {faculty.map((member, index) => (
              <Col xs={24} md={12} key={member.id || index}>
                <div className="bg-surface rounded-xl border border-border p-4 h-full hover:border-primary/30 hover:shadow-md transition-all">
                  <div className="flex items-start gap-4">
                    <Avatar
                      size={48}
                      icon={<UserOutlined />}
                      className={member.role === 'HOD' ? 'bg-purple-500' : 'bg-primary'}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Text className="font-semibold text-text-primary">{member.name}</Text>
                        <Tag
                          color={member.role === 'HOD' ? 'purple' : 'blue'}
                          className="m-0 text-[10px] rounded px-1.5"
                        >
                          {member.role}
                        </Tag>
                        {member.branchName && (
                          <Tag className="m-0 text-[10px] rounded bg-background-tertiary text-text-tertiary border-0">
                            {member.branchName}
                          </Tag>
                        )}
                      </div>
                      <Text className="text-xs text-text-tertiary block mt-1 truncate">{member.email}</Text>

                      {/* Stats Row */}
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                        <Tooltip title="Students Assigned">
                          <div className="flex items-center gap-1.5">
                            <TeamOutlined className="text-text-tertiary text-xs" />
                            <span className="text-sm font-medium text-text-primary">
                              {member.stats?.assignedStudents || 0}
                            </span>
                          </div>
                        </Tooltip>
                        <Tooltip title="Visits Completed">
                          <div className="flex items-center gap-1.5">
                            <EnvironmentOutlined className="text-text-tertiary text-xs" />
                            <span className="text-sm font-medium text-text-primary">
                              {member.stats?.visitsCompleted || 0}
                              <span className="text-text-tertiary">/{member.stats?.visitsScheduled || 0}</span>
                            </span>
                          </div>
                        </Tooltip>
                        <Tooltip title="Reports Reviewed">
                          <div className="flex items-center gap-1.5">
                            <FileTextOutlined className="text-text-tertiary text-xs" />
                            <span className="text-sm font-medium text-text-primary">
                              {member.stats?.reportsReviewed || 0}
                            </span>
                          </div>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        )}
      </div>
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
    <Modal title="Student Details" open={visible} onCancel={onClose} footer={null} width={800} destroyOnHidden className="rounded-2xl overflow-hidden">
      <div className="space-y-4 pt-2">
        <Descriptions bordered column={2} size="small" title={<Text className="text-xs uppercase font-bold text-text-tertiary">Basic Information</Text>} className="rounded-xl overflow-hidden bg-background-tertiary/20">
          <Descriptions.Item label="Name"><Text strong>{student.name}</Text></Descriptions.Item>
          <Descriptions.Item label="Roll Number"><Text code>{student.rollNumber}</Text></Descriptions.Item>
          <Descriptions.Item label="Email">{student.email}</Descriptions.Item>
          <Descriptions.Item label="Branch">{student.branchName}</Descriptions.Item>
          <Descriptions.Item label="Mentor">{mentor ? <Tag color="green" className="border-0 rounded-md">{mentor.name}</Tag> : <Tag color="red" className="border-0 rounded-md">Unassigned</Tag>}</Descriptions.Item>
          <Descriptions.Item label="Company">{company ? company.companyName : '-'}</Descriptions.Item>
        </Descriptions>

        {student.hasSelfIdentifiedInternship && selfId && (
          <Descriptions bordered column={2} size="small" title={<Text className="text-xs uppercase font-bold text-text-tertiary">Self-Identified Internship</Text>} className="rounded-xl overflow-hidden bg-background-tertiary/20">
            <Descriptions.Item label="Company Name">{selfId.companyName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Status"><Tag color={getStatusColor(selfId.status)} className="border-0 rounded-md">{selfId.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="Company Address" span={2}>{selfId.companyAddress || '-'}</Descriptions.Item>
            <Descriptions.Item label="Contact">{selfId.companyContact || '-'}</Descriptions.Item>
            <Descriptions.Item label="Email">{selfId.companyEmail || '-'}</Descriptions.Item>
            <Descriptions.Item label="HR Name">{selfId.hrName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Joining Letter">
              {selfId.joiningLetterUrl ? (
                <Space>
                  <Tag color={getStatusColor(selfId.joiningLetterStatus)} className="border-0 rounded-md">{selfId.joiningLetterStatus || 'Submitted'}</Tag>
                  <Button type="link" size="small" icon={<DownloadOutlined />} href={selfId.joiningLetterUrl} target="_blank">View</Button>
                </Space>
              ) : <Tag color="orange" className="border-0 rounded-md">Not Uploaded</Tag>}
            </Descriptions.Item>
          </Descriptions>
        )}

        <Descriptions bordered column={2} size="small" title={<Text className="text-xs uppercase font-bold text-text-tertiary">Current Status</Text>} className="rounded-xl overflow-hidden bg-background-tertiary/20">
          <Descriptions.Item label="Report Status">
            {student.currentMonthReport ? <Tag color={getStatusColor(student.currentMonthReport.status)} className="border-0 rounded-md">{student.currentMonthReport.status}</Tag> : <Tag color="red" className="border-0 rounded-md">Not Submitted</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Submitted At">{student.currentMonthReport?.submittedAt ? new Date(student.currentMonthReport.submittedAt).toLocaleString() : '-'}</Descriptions.Item>
          <Descriptions.Item label="Last Faculty Visit">{student.lastFacultyVisit?.date ? new Date(student.lastFacultyVisit.date).toLocaleDateString() : 'No visits yet'}</Descriptions.Item>
          <Descriptions.Item label="Visit Status">{student.lastFacultyVisit ? <Tag color={getStatusColor(student.lastFacultyVisit.status)} className="border-0 rounded-md">{student.lastFacultyVisit.status}</Tag> : '-'}</Descriptions.Item>
        </Descriptions>
      </div>
    </Modal>
  );
});

StudentDetailModal.displayName = 'StudentDetailModal';

// Main Component
const InstituteDetailView = ({ defaultTab = null }) => {
  const dispatch = useDispatch();
  const selectedInstitute = useSelector(selectSelectedInstitute);
  const overview = useSelector(selectInstituteOverview);
  const students = useSelector(selectInstituteStudents);
  const companies = useSelector(selectInstituteCompanies);
  const facultyPrincipal = useSelector(selectInstituteFacultyPrincipal);

  const [activeTab, setActiveTab] = useState('overview');

  // Handle defaultTab prop
  useEffect(() => {
    if (defaultTab && ['overview', 'students', 'companies', 'faculty'].includes(defaultTab)) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);
  
  const [studentModalVisible, setStudentModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [companyModalVisible, setCompanyModalVisible] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);

  // Search states
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

  // Track if initial fetch done
  const fetchedTabsRef = useRef({ students: false, companies: false, faculty: false });

  // Get available branches
  const availableBranches = useMemo(() => students.filters?.branches || [], [students.filters]);

  // Fetch overview when institute changes
  useEffect(() => {
    if (selectedInstitute?.id) {
      dispatch(fetchInstituteOverview(selectedInstitute.id));
      fetchedTabsRef.current = { students: false, companies: false, faculty: false };
    }
  }, [dispatch, selectedInstitute?.id]);

  // Fetch tab data when tab changes
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

  // Memoized student columns - Clean and non-overlapping
  const studentColumns = useMemo(() => [
    {
      title: 'Student',
      key: 'student',
      fixed: 'left',
      width: 220,
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <Avatar
            icon={<UserOutlined />}
            className="bg-primary/10 text-primary shrink-0"
            size={36}
          />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-text-primary text-sm truncate" title={record.name}>
              {record.name}
            </div>
            <div className="text-xs text-text-tertiary font-mono">{record.rollNumber}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Branch',
      dataIndex: 'branchName',
      key: 'branchName',
      width: 120,
      render: (text) => (
        <span className="text-sm text-text-secondary">{text || '-'}</span>
      ),
    },
    {
      title: 'Mentor',
      key: 'mentor',
      width: 150,
      render: (_, record) => {
        const mentor = record.mentor || record.mentorAssignments?.find((ma) => ma.isActive)?.mentor;
        if (!mentor) {
          return <Tag color="error" className="m-0 rounded text-xs">Unassigned</Tag>;
        }
        return (
          <Tooltip title={mentor.email}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-sm text-text-primary truncate">{mentor.name}</span>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: 'Company',
      key: 'company',
      width: 180,
      ellipsis: true,
      render: (_, record) => {
        const company = record.company;
        const selfId = record.selfIdentifiedData;
        const name = company?.companyName || selfId?.companyName;
        const isSelf = company?.isSelfIdentified || selfId?.companyName;

        if (!name) {
          return <span className="text-text-tertiary text-sm italic">Not Placed</span>;
        }
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-primary truncate" title={name}>{name}</span>
            {isSelf && <Tag color="purple" className="m-0 text-[10px] px-1 shrink-0">Self</Tag>}
          </div>
        );
      },
    },
    {
      title: 'Report',
      key: 'report',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const status = record.currentMonthReport?.status;
        if (!status) {
          return <Tag color="error" className="m-0 rounded text-xs">Missing</Tag>;
        }
        return <Tag color={getStatusColor(status)} className="m-0 rounded text-xs">{status}</Tag>;
      },
    },
    {
      title: 'Last Visit',
      key: 'visit',
      width: 100,
      align: 'center',
      render: (_, record) => {
        if (!record.lastFacultyVisit?.date) {
          return <span className="text-text-tertiary text-xs">None</span>;
        }
        return (
          <span className="text-sm text-text-secondary">
            {new Date(record.lastFacultyVisit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        );
      },
    },
    {
      title: '',
      key: 'action',
      width: 50,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Dropdown menu={{ items: getStudentActionItems(record) }} trigger={['click']} placement="bottomRight">
          <Button type="text" size="small" icon={<MoreOutlined />} className="text-text-tertiary hover:text-primary" />
        </Dropdown>
      ),
    },
  ], [getStudentActionItems]);

  // Handler for viewing company details
  const handleViewCompanyDetails = useCallback((record) => {
    setSelectedCompany(record);
    setCompanyModalVisible(true);
  }, []);

  // Memoized company columns
  const companyColumns = useMemo(() => [
    {
      title: 'Company', key: 'company', width: 300, fixed: 'left',
      render: (_, record) => (
        <div className="flex items-center gap-4 py-1">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${
            record.isSelfIdentifiedCompany 
              ? 'bg-purple-500/10 border-purple-500/20 text-purple-600' 
              : 'bg-primary/10 border-primary/20 text-primary'
          }`}>
            <BankOutlined className="text-xl" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Text strong className="text-sm text-text-primary truncate max-w-[180px]" title={record.companyName}>
                {record.companyName || 'Unknown Company'}
              </Text>
              {record.isSelfIdentifiedCompany && (
                <Badge status="processing" color="purple" title="Self-Identified" />
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary font-medium">
              <EnvironmentOutlined className="text-[10px]" />
              <span className="truncate max-w-[200px]">
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
      title: 'Industry', key: 'industry', width: 140,
      render: (_, record) => (
        <Tag
          variant="borderless"
          className={`font-bold rounded-md m-0 px-2 py-0.5 text-[10px] uppercase tracking-wider ${
            record.isSelfIdentifiedCompany
              ? 'bg-purple-500/10 text-purple-600'
              : 'bg-cyan-500/10 text-cyan-600'
          }`}
        >
          {record.industryType || 'General'}
        </Tag>
      ),
    },
    {
      title: 'Contact Details', key: 'contact', width: 200,
      render: (_, record) => (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 group">
            <MailOutlined className="text-text-tertiary group-hover:text-primary transition-colors text-xs" />
            <Text className="text-xs text-text-secondary truncate max-w-[160px]">{record.email || record.companyEmail || 'N/A'}</Text>
          </div>
          <div className="flex items-center gap-2 group">
            <PhoneOutlined className="text-text-tertiary group-hover:text-success transition-colors text-xs" />
            <Text className="text-xs text-text-secondary">{record.phoneNo || record.companyContact || 'N/A'}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Placement Stats', key: 'students', width: 140, align: 'center',
      render: (_, record) => (
        <div className="flex flex-col items-center p-2 rounded-xl bg-background-tertiary/30 border border-border/50">
          <Text className="text-lg font-black text-primary leading-none">{record.studentCount || 0}</Text>
          <Text className="text-[9px] text-text-tertiary font-bold uppercase tracking-tighter mt-1">Students</Text>
        </div>
      ),
    },
    {
      title: 'Status', key: 'status', width: 140, align: 'center',
      render: (_, record) => {
        if (record.isSelfIdentifiedCompany) {
          return <Tag icon={<CheckCircleOutlined />} color="success" className="m-0 rounded-full font-bold text-[10px] px-3 py-0.5 uppercase tracking-wide border-0">Auto-Approved</Tag>;
        }
        if (record.isApproved) return <Tag icon={<CheckCircleOutlined />} color="success" className="m-0 rounded-full font-bold text-[10px] px-3 py-0.5 uppercase tracking-wide border-0">Approved</Tag>;
        if (record.isVerified) return <Tag icon={<SafetyCertificateOutlined />} color="processing" className="m-0 rounded-full font-bold text-[10px] px-3 py-0.5 uppercase tracking-wide border-0">Verified</Tag>;
        return <Tag icon={<ClockCircleOutlined />} color="warning" className="m-0 rounded-full font-bold text-[10px] px-3 py-0.5 uppercase tracking-wide border-0">Pending</Tag>;
      },
    },
    {
      title: 'Action', key: 'action', width: 100, fixed: 'right', align: 'center',
      render: (_, record) => (
        <Button
          type="primary"
          ghost
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewCompanyDetails(record)}
          className="rounded-lg font-bold text-xs"
        >
          Details
        </Button>
      ),
    },
  ], [handleViewCompanyDetails]);

  // No institute selected - Enhanced empty state
  if (!selectedInstitute?.id) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-gradient-to-br from-background via-background-secondary to-background">
        <div className="text-center max-w-md">
          {/* Animated illustration */}
          <div className="relative inline-block mb-8">
            <div className="w-32 h-32 rounded-3xl bg-primary/5 flex items-center justify-center">
              <BankOutlined className="text-5xl text-primary/40" />
            </div>
            {/* Decorative elements */}
            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-lg bg-success/20 flex items-center justify-center">
              <CheckCircleOutlined className="text-success text-xs" />
            </div>
            <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-xl bg-info/20 flex items-center justify-center">
              <TeamOutlined className="text-info text-sm" />
            </div>
          </div>

          <Title level={3} className="!mb-2 !text-2xl font-bold text-text-primary">
            Select an Institution
          </Title>
          <Text className="text-text-secondary block mb-6 text-base leading-relaxed">
            Choose an institution from the sidebar to explore detailed analytics,
            student data, company partnerships, and faculty information.
          </Text>

          {/* Feature hints */}
          <div className="grid grid-cols-2 gap-3 text-left max-w-sm mx-auto">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-surface border border-border">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <TeamOutlined className="text-primary text-sm" />
              </div>
              <Text className="text-xs text-text-secondary">View student enrollment & progress</Text>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-surface border border-border">
              <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                <BankOutlined className="text-success text-sm" />
              </div>
              <Text className="text-xs text-text-secondary">Explore company partnerships</Text>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-surface border border-border">
              <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                <SafetyCertificateOutlined className="text-warning text-sm" />
              </div>
              <Text className="text-xs text-text-secondary">Track compliance scores</Text>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-surface border border-border">
              <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                <UserOutlined className="text-info text-sm" />
              </div>
              <Text className="text-xs text-text-secondary">Manage faculty & mentors</Text>
            </div>
          </div>

          {/* Arrow hint */}
          <div className="mt-8 flex items-center justify-center gap-2 text-text-tertiary">
            <span className="text-lg">←</span>
            <Text className="text-sm">Select from sidebar</Text>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden bg-background">
      {/* Enhanced Header */}
      <div className="mb-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-lg shadow-primary/10 flex items-center justify-center text-primary">
            <BankOutlined className="text-2xl" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Title level={4} className="!mb-0 !text-xl font-bold text-text-primary">
                {overview.data?.institution?.name || 'Loading...'}
              </Title>
              {overview.data?.complianceScore >= 80 && (
                <Tooltip title="High compliance score">
                  <CheckCircleOutlined className="text-success" />
                </Tooltip>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <Tag className="font-mono text-xs bg-primary/10 text-primary border-0 m-0 rounded-md px-2">
                {overview.data?.institution?.code}
              </Tag>
              <Text className="text-text-secondary flex items-center gap-1.5 text-sm">
                <EnvironmentOutlined className="text-text-tertiary text-xs" />
                {overview.data?.institution?.city}
                {overview.data?.institution?.district && `, ${overview.data?.institution?.district}`}
              </Text>
              {overview.data?.complianceScore != null && (
                <Badge
                  count={`${overview.data.complianceScore}%`}
                  style={{
                    backgroundColor: overview.data.complianceScore >= 80 ? 'rgb(var(--color-success))' :
                                     overview.data.complianceScore >= 50 ? 'rgb(var(--color-warning))' : 'rgb(var(--color-error))'
                  }}
                  className="[&_.ant-badge-count]:text-[10px] [&_.ant-badge-count]:font-bold"
                />
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip title="Refresh all data">
            <Button
              icon={<ReloadOutlined spin={overview.loading} />}
              onClick={() => dispatch(fetchInstituteOverview(selectedInstitute.id))}
              loading={overview.loading}
              className="rounded-xl h-10 font-bold border-border hover:border-primary hover:text-primary shadow-sm"
            >
              Refresh
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden flex flex-col bg-background-secondary rounded-2xl border border-border shadow-soft">
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          className="h-full flex flex-col custom-tabs"
          items={[
            {
              key: 'overview',
              label: <span className="flex items-center gap-2"><TeamOutlined /> Overview</span>,
              children: <div className="h-full overflow-y-auto hide-scrollbar p-6"><OverviewTab data={overview.data} loading={overview.loading} error={overview.error} /></div>,
            },
            {
              key: 'students',
              label: <span className="flex items-center gap-2"><UserOutlined /> Students ({students.total})</span>,
              children: (
                <div className="h-full flex flex-col p-6 gap-4 min-h-0">
                  <Card className="rounded-2xl border-border shadow-soft shrink-0 bg-surface" styles={{ body: { padding: '16px' } }}>
                    <div className="flex flex-wrap items-center gap-3">
                      <Input.Search
                        placeholder="Search students..."
                        value={studentSearchInput}
                        onChange={(e) => setStudentSearchInput(e.target.value)}
                        className="w-72 rounded-xl h-10 bg-background border-border"
                        allowClear
                      />
                      <Button icon={<FilterOutlined />} onClick={() => setShowFilters(!showFilters)} type={showFilters ? 'primary' : 'default'} className="rounded-xl h-10 font-bold shadow-sm">Filters</Button>
                      <Button icon={<ReloadOutlined />} onClick={resetFilters} className="rounded-xl h-10 shadow-sm">Reset</Button>
                    </div>
                    {showFilters && (
                      <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
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
                          <Button type="primary" onClick={applyFilters} className="rounded-xl h-10 font-bold px-6 shadow-lg shadow-primary/20">Apply Filters</Button>
                        </div>
                      </div>
                    )}
                  </Card>
                  
                  {students.error && <Alert type="error" title={students.error} className="rounded-xl border-error/20 bg-error/5" showIcon closable />}
                  
                  <div className="rounded-2xl border border-border shadow-soft flex-1 min-h-0 overflow-hidden bg-surface flex flex-col">
                    <div className="flex-1 min-h-0 overflow-auto">
                      <Table
                        columns={studentColumns}
                        dataSource={students.list}
                        rowKey="id"
                        loading={students.loading}
                        pagination={false}
                        scroll={{ x: 950 }}
                        size="middle"
                        className="custom-table"
                        sticky
                      />
                    </div>
                    {students.hasMore && (
                      <div className="text-center p-4 border-t border-border bg-background-tertiary/30 shrink-0">
                        <Button onClick={handleLoadMore} loading={students.loadingMore} className="rounded-xl font-bold shadow-sm">
                          Load More Students
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'companies',
              label: <span className="flex items-center gap-2"><BankOutlined /> Companies ({companies.total})</span>,
              children: (
                <div className="h-full p-6 overflow-y-auto hide-scrollbar space-y-6">
                  {/* Summary Cards */}
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={8}>
                      <Card className="rounded-2xl border-border shadow-soft bg-surface h-full">
                        <div className="flex items-center gap-4 p-1">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <BankOutlined className="text-primary text-2xl" />
                          </div>
                          <div>
                            <div className="text-3xl font-black text-text-primary">{companies.total || 0}</div>
                            <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">Total Companies</div>
                          </div>
                        </div>
                      </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Card className="rounded-2xl border-border shadow-soft bg-surface h-full">
                        <div className="flex items-center gap-4 p-1">
                          <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                            <TeamOutlined className="text-success text-2xl" />
                          </div>
                          <div>
                            <div className="text-3xl font-black text-text-primary">{companies.summary?.totalStudents || 0}</div>
                            <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">Students Placed</div>
                          </div>
                        </div>
                      </Card>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Card className="rounded-2xl border-border shadow-soft bg-surface h-full">
                        <div className="flex items-center gap-4 p-1">
                          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                            <SafetyCertificateOutlined className="text-purple-500 text-2xl" />
                          </div>
                          <div>
                            <div className="text-3xl font-black text-text-primary">
                              {companies.summary?.totalSelfIdentified || 0}
                              <span className="text-sm font-normal text-text-tertiary ml-2 align-middle">
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
                  <Card className="rounded-2xl border-border shadow-soft bg-surface" styles={{ body: { padding: '16px' } }}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <Input.Search
                        placeholder="Search companies by name..."
                        value={companySearchInput}
                        onChange={(e) => setCompanySearchInput(e.target.value)}
                        className="max-w-md rounded-xl h-10 bg-background border-border"
                        allowClear
                        enterButton={<Button type="primary" className="rounded-r-xl h-10 font-bold shadow-md">Search</Button>}
                      />
                      <Tag className="rounded-full px-4 py-1.5 bg-purple-500/10 text-purple-600 border border-purple-500/20 font-bold text-sm">
                        <CheckCircleOutlined className="mr-1.5" />
                        {companies.list?.filter(c => c.isSelfIdentifiedCompany).length || 0} Self-Identified Companies
                      </Tag>
                    </div>
                  </Card>

                  {/* Error Alert */}
                  {companies.error && <Alert type="error" title={companies.error} className="rounded-xl border-error/20 bg-error/5" showIcon closable />}

                  {/* Companies Table */}
                  <div className="rounded-2xl border border-border shadow-soft overflow-hidden bg-surface">
                    {(companies.loading || companies.list?.length > 0) ? (
                      <Table
                        columns={companyColumns}
                        dataSource={companies.list}
                        rowKey="id"
                        loading={companies.loading}
                        pagination={{
                          pageSize: 10,
                          showSizeChanger: true,
                          showTotal: (total, range) => <span className="text-text-tertiary">Showing {range[0]}-{range[1]} of {total} companies</span>,
                          className: "px-6 py-4",
                        }}
                        size="middle"
                        scroll={{ x: 1100 }}
                        className="custom-table"
                        rowClassName={(record) => record.isSelfIdentifiedCompany ? 'bg-purple-50/10 hover:bg-purple-50/20' : 'hover:bg-background-tertiary/40'}
                      />
                    ) : (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <div className="text-center py-12">
                            <Text type="secondary" className="block mb-1 text-lg">No companies found</Text>
                            <Text className="text-xs text-text-tertiary">Companies with placed students will appear here</Text>
                          </div>
                        }
                      />
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'faculty',
              label: <span className="flex items-center gap-2"><IdcardOutlined /> Faculty & Principal</span>,
              children: (
                <div className="h-full overflow-y-auto hide-scrollbar p-6">
                  <FacultyTab principal={facultyPrincipal.principal} faculty={facultyPrincipal.faculty} summary={facultyPrincipal.summary} loading={facultyPrincipal.loading} error={facultyPrincipal.error} />
                </div>
              ),
            },
          ]} 
        />
      </div>

      {/* Student Detail Modal */}
      <StudentDetailModal visible={studentModalVisible} student={selectedStudent} onClose={() => setStudentModalVisible(false)} />

      {/* Company Detail Modal */}
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
        destroyOnHidden
        className="rounded-2xl overflow-hidden"
      >
        {selectedCompany && (
          <div className="space-y-6 pt-4">
            {/* Company Info Card */}
            <Card
              size="small"
              className={`rounded-2xl border shadow-sm ${selectedCompany.isSelfIdentifiedCompany
                ? 'border-purple-200 bg-purple-50/30'
                : 'border-border bg-surface'}`}
            >
              <Row gutter={[24, 16]}>
                <Col xs={24} sm={8}>
                  <div className="text-[10px] uppercase font-bold text-text-tertiary mb-1">Industry Type</div>
                  <Tag className="m-0 rounded-lg font-medium text-text-primary bg-background border-border text-sm px-3 py-1">
                    {selectedCompany.industryType || 'General'}
                  </Tag>
                </Col>
                <Col xs={24} sm={8}>
                  <div className="text-[10px] uppercase font-bold text-text-tertiary mb-1">Location</div>
                  <Text className="text-text-primary font-medium flex items-center gap-1">
                    <EnvironmentOutlined className="text-text-tertiary" />
                    {selectedCompany.isSelfIdentifiedCompany
                      ? (selectedCompany.companyAddress || 'Not specified')
                      : `${selectedCompany.city || 'N/A'}${selectedCompany.state ? `, ${selectedCompany.state}` : ''}`}
                  </Text>
                </Col>
                <Col xs={24} sm={8}>
                  <div className="text-[10px] uppercase font-bold text-text-tertiary mb-1">Status</div>
                  {selectedCompany.isSelfIdentifiedCompany ? (
                    <Tag icon={<CheckCircleOutlined />} color="success" className="m-0 rounded-lg font-bold border-0 px-3 py-1">Auto-Approved</Tag>
                  ) : (
                    <Space>
                      {selectedCompany.isApproved && <Tag icon={<CheckCircleOutlined />} color="success" className="m-0 rounded-lg border-0 px-3 py-1">Approved</Tag>}
                      {selectedCompany.isVerified && <Tag icon={<SafetyCertificateOutlined />} color="processing" className="m-0 rounded-lg border-0 px-3 py-1">Verified</Tag>}
                      {!selectedCompany.isApproved && !selectedCompany.isVerified && <Tag color="warning" className="m-0 rounded-lg border-0 px-3 py-1">Pending</Tag>}
                    </Space>
                  )}
                </Col>
                {(selectedCompany.email || selectedCompany.companyEmail || selectedCompany.phoneNo || selectedCompany.companyContact) && (
                  <>
                    <Col xs={24} sm={12}>
                      <div className="text-[10px] uppercase font-bold text-text-tertiary mb-1">Email</div>
                      <div className="flex items-center gap-2">
                        <MailOutlined className="text-text-tertiary" />
                        <Text className="text-text-primary font-medium">{selectedCompany.email || selectedCompany.companyEmail || 'N/A'}</Text>
                      </div>
                    </Col>
                    <Col xs={24} sm={12}>
                      <div className="text-[10px] uppercase font-bold text-text-tertiary mb-1">Phone</div>
                      <div className="flex items-center gap-2">
                        <PhoneOutlined className="text-text-tertiary" />
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
                        <div className="text-[9px] text-purple-600 font-bold mt-1 bg-purple-100 rounded px-1 inline-block">
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
              <div className="rounded-xl border border-border overflow-hidden bg-surface">
                <Table
                  dataSource={selectedCompany.students || []}
                  columns={[
                    {
                      title: 'Student', key: 'student', width: 220,
                      render: (_, record) => (
                        <div className="flex items-center gap-3">
                          <Avatar size="small" icon={<UserOutlined />} className="bg-primary/10 text-primary border border-primary/20" />
                          <div>
                            <div className="font-bold text-sm text-text-primary">{record.name}</div>
                            <div className="text-xs text-text-tertiary font-mono">{record.email}</div>
                          </div>
                        </div>
                      ),
                    },
                    { title: 'Roll No.', dataIndex: 'rollNumber', key: 'rollNumber', width: 120, render: (t) => <span className="font-mono text-xs bg-background border border-border px-1.5 py-0.5 rounded text-text-secondary">{t}</span> },
                    {
                      title: 'Branch', dataIndex: 'branch', key: 'branch', width: 120,
                      render: (text) => <Tag className="rounded-md border-0 bg-background-tertiary text-text-secondary m-0 text-[10px] font-bold uppercase">{text || 'N/A'}</Tag>,
                    },
                    ...(selectedCompany.isSelfIdentifiedCompany ? [
                      {
                        title: 'Job Profile', dataIndex: 'jobProfile', key: 'jobProfile', width: 150,
                        render: (text) => text ? <Text className="text-sm font-medium text-text-primary">{text}</Text> : <Text type="secondary">-</Text>,
                      },
                      {
                        title: 'Stipend', dataIndex: 'stipend', key: 'stipend', width: 120,
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
                      title: 'Joining Letter', dataIndex: 'joiningLetterStatus', key: 'joiningLetterStatus', width: 140,
                      render: (status) => status ? (
                        <Tag
                          icon={status === 'APPROVED' ? <CheckCircleOutlined /> : status === 'PENDING' ? <ClockCircleOutlined /> : <CloseCircleOutlined />}
                          color={getStatusColor(status)}
                          className="rounded-md border-0 m-0 font-medium"
                        >
                          {status}
                        </Tag>
                      ) : <Text type="secondary" className="text-xs italic text-text-tertiary">Not uploaded</Text>,
                    },
                  ]}
                  rowKey="id"
                  pagination={{ pageSize: 5, showSizeChanger: false }}
                  size="small"
                  scroll={{ x: 800 }}
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
            <span className="font-bold text-lg">{mentorStudent?.mentorAssignments?.some(ma => ma.isActive) ? 'Change' : 'Assign'} Mentor</span>
          </div>
        }
        open={mentorModalVisible}
        onCancel={() => { setMentorModalVisible(false); setMentorStudent(null); setSelectedMentorId(null); }}
        onOk={handleAssignMentor}
        okText="Save Assignment"
        confirmLoading={assigningMentor}
        okButtonProps={{ disabled: !selectedMentorId, className: "rounded-xl font-bold h-10 shadow-lg shadow-primary/20" }}
        cancelButtonProps={{ className: "rounded-xl h-10 font-medium hover:bg-background-tertiary" }}
        destroyOnHidden
        className="rounded-2xl overflow-hidden"
      >
        <div className="py-6">
          <div className="bg-background-tertiary/30 p-4 rounded-xl border border-border mb-6">
            <Text className="text-text-secondary text-xs uppercase font-bold tracking-wide block mb-1">Student</Text>
            <div className="flex items-center gap-3">
              <Avatar icon={<UserOutlined />} className="bg-background border border-border text-text-secondary" />
              <div>
                <Text className="text-text-primary font-bold text-lg block leading-tight">{mentorStudent?.name || 'Student'}</Text>
                <Text className="text-text-tertiary text-xs font-mono">{mentorStudent?.rollNumber}</Text>
              </div>
            </div>
            
            {mentorStudent?.mentorAssignments?.find(ma => ma.isActive)?.mentor && (
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2">
                <Text type="secondary" className="text-xs">Current Mentor:</Text>
                <Tag color="blue" className="m-0 rounded-md border-0 font-medium">{mentorStudent.mentorAssignments.find(ma => ma.isActive).mentor.name}</Tag>
              </div>
            )}
          </div>

          <Text className="block mb-2 font-bold text-text-primary text-sm uppercase tracking-wide">Select New Mentor</Text>
          <Select
            placeholder="Search for a mentor..."
            loading={mentorsLoading}
            value={selectedMentorId}
            onChange={setSelectedMentorId}
            style={{ width: '100%' }}
            size="large"
            className="rounded-xl"
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) => option.children.toLowerCase().includes(input.toLowerCase())}
            suffixIcon={<SearchOutlined className="text-text-tertiary" />}
          >
            {mentors.map((mentor) => (
              <Select.Option key={mentor.id} value={mentor.id}>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-text-primary">{mentor.name}</span>
                  <Tag className="m-0 rounded border-border bg-background text-xs text-text-secondary">{mentor.activeAssignments} students</Tag>
                </div>
              </Select.Option>
            ))}
          </Select>
        </div>
      </Modal>
    </div>
  );
};

export default memo(InstituteDetailView);