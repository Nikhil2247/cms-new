import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Select,
  Space,
  Typography,
  Progress,
  Input,
  Tooltip,
  Modal,
  Timeline,
  Avatar,
  Empty,
  Row,
  Col,
  Statistic,
  Tabs,
  Collapse,
  Badge,
  Alert,
  DatePicker,
  Descriptions,
  Divider,
  Form,
  InputNumber,
} from 'antd';
import {
  UserOutlined,
  EyeOutlined,
  BellOutlined,
  TeamOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  MinusCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  FileTextOutlined,
  CalendarOutlined,
  WarningOutlined,
  BankOutlined,
  GlobalOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
  FilePdfOutlined,
  DownloadOutlined,
  LinkOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import { debounce } from 'lodash';
import analyticsService from '../../../services/analytics.service';
import principalService from '../../../services/principal.service';
import { fetchDepartments, fetchBatches } from '../store/principalSlice';

const { Title, Text } = Typography;

const StudentProgress = () => {
  const dispatch = useDispatch();
  const departments = useSelector((state) => state.principal.departments?.list || []);
  const batches = useSelector((state) => state.principal.batches?.list || []);

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    batchId: 'all',
    branchId: 'all',
    status: 'all',
    mentorId: 'all',
    joiningLetterStatus: 'all',
  });
  const [mentors, setMentors] = useState([]);
  const [timelineVisible, setTimelineVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    inProgress: 0,
    completed: 0,
    delayed: 0,
    notStarted: 0,
  });

  // Pending reports state
  const [pendingReportsLoading, setPendingReportsLoading] = useState(false);
  const [pendingReportsData, setPendingReportsData] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState('progress');

  // Edit internship state
  const [editVisible, setEditVisible] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [editForm] = Form.useForm();

  useEffect(() => {
    dispatch(fetchDepartments());
    dispatch(fetchBatches());
  }, [dispatch]);

  const fetchStudentProgress = useCallback(async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: pageSize,
        search: filters.search || undefined,
        batchId: filters.batchId !== 'all' ? filters.batchId : undefined,
        branchId: filters.branchId !== 'all' ? filters.branchId : undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        mentorId: filters.mentorId !== 'all' ? filters.mentorId : undefined,
        joiningLetterStatus: filters.joiningLetterStatus !== 'all' ? filters.joiningLetterStatus : undefined,
      };

      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      const response = await analyticsService.getStudentProgress(params);
      const data = response.data || response;

      setStudents(data.students || []);
      setPagination({
        current: data.pagination?.page || page,
        pageSize: data.pagination?.limit || pageSize,
        total: data.pagination?.total || 0,
      });

      // Set mentors list from API response
      if (data.mentors && Array.isArray(data.mentors)) {
        setMentors(data.mentors);
      }

      const studentList = data.students || [];
      const statusCounts = {
        total: data.pagination?.total || studentList.length,
        inProgress: studentList.filter(s => s.internshipStatus === 'In Progress').length,
        completed: studentList.filter(s => s.internshipStatus === 'Completed').length,
        delayed: studentList.filter(s => s.internshipStatus === 'Delayed').length,
        notStarted: studentList.filter(s => s.internshipStatus === 'Not Started').length,
        pending: studentList.filter(s => s.internshipStatus === 'Pending').length,
      };
      setStats(statusCounts);
    } catch (error) {
      console.error('Failed to fetch student progress:', error);
      toast.error('Failed to load student progress');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchPendingReports = useCallback(async () => {
    try {
      setPendingReportsLoading(true);
      const params = {
        year: selectedYear,
        batchId: filters.batchId !== 'all' ? filters.batchId : undefined,
        branchId: filters.branchId !== 'all' ? filters.branchId : undefined,
      };

      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      const response = await analyticsService.getPendingReportsByMonth(params);
      setPendingReportsData(response.data || response);
    } catch (error) {
      console.error('Failed to fetch pending reports:', error);
      toast.error('Failed to load pending reports');
      setPendingReportsData(null);
    } finally {
      setPendingReportsLoading(false);
    }
  }, [selectedYear, filters.batchId, filters.branchId]);

  useEffect(() => {
    if (activeTab === 'progress') {
      fetchStudentProgress(pagination.current, pagination.pageSize);
    } else if (activeTab === 'pending-reports') {
      fetchPendingReports();
    }
  }, [activeTab, filters, fetchStudentProgress, fetchPendingReports]);

  const debouncedSearch = useCallback(
    debounce((value) => {
      setFilters(prev => ({ ...prev, search: value }));
      setPagination(prev => ({ ...prev, current: 1 }));
    }, 300),
    []
  );

  const handleSearchChange = (e) => {
    debouncedSearch(e.target.value);
  };

  const handleTableChange = (paginationConfig) => {
    setPagination({
      ...pagination,
      current: paginationConfig.current,
      pageSize: paginationConfig.pageSize,
    });
    fetchStudentProgress(paginationConfig.current, paginationConfig.pageSize);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleRefresh = () => {
    if (activeTab === 'progress') {
      fetchStudentProgress(pagination.current, pagination.pageSize);
    } else {
      fetchPendingReports();
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Not Started': 'default',
      'Pending': 'warning',
      'In Progress': 'processing',
      'Delayed': 'error',
      'Completed': 'success',
    };
    return colors[status] || 'default';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'Not Started': <MinusCircleOutlined />,
      'Pending': <ExclamationCircleOutlined />,
      'In Progress': <SyncOutlined spin />,
      'Delayed': <ClockCircleOutlined />,
      'Completed': <CheckCircleOutlined />,
    };
    return icons[status] || <MinusCircleOutlined />;
  };

  const getReportStatusColor = (status) => {
    const colors = {
      missing: 'error',
      pending: 'warning',
      submitted: 'processing',
      approved: 'success',
    };
    return colors[status] || 'default';
  };

  const getReportStatusIcon = (status) => {
    const icons = {
      missing: <WarningOutlined />,
      pending: <ClockCircleOutlined />,
      submitted: <SyncOutlined />,
      approved: <CheckCircleOutlined />,
    };
    return icons[status] || <MinusCircleOutlined />;
  };

  const handleSendReminder = (student) => {
    toast.success(`Reminder sent to ${student.name}`);
  };

  const handleAssignMentor = (student) => {
    toast.info(`Assign mentor to ${student.name}`);
  };

  const handleEditInternship = (student) => {
    setEditStudent(student);
    const app = student.application || {};
    editForm.setFieldsValue({
      companyName: app.companyName || '',
      companyAddress: app.companyAddress || '',
      companyContact: app.companyContact || '',
      companyEmail: app.companyEmail || '',
      jobProfile: app.jobProfile || '',
      stipend: app.stipend ? parseInt(app.stipend) : null,
      internshipDuration: app.internshipDuration || '',
      startDate: app.startDate ? dayjs(app.startDate) : null,
      endDate: app.endDate ? dayjs(app.endDate) : null,
      facultyMentorName: app.facultyMentorName || '',
      facultyMentorEmail: app.facultyMentorEmail || '',
      facultyMentorDesignation: app.facultyMentorDesignation || '',
      status: app.status || 'APPROVED',
    });
    setEditVisible(true);
  };

  const handleEditSubmit = async (values) => {
    if (!editStudent?.application?.id) {
      toast.error('No internship found for this student');
      return;
    }

    try {
      setEditLoading(true);
      const updateData = {
        ...values,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
      };

      await principalService.updateInternship(editStudent.application.id, updateData);
      toast.success('Internship updated successfully');
      setEditVisible(false);
      editForm.resetFields();
      fetchStudentProgress(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('Failed to update internship:', error);
      toast.error(error.message || 'Failed to update internship');
    } finally {
      setEditLoading(false);
    }
  };

  const showTimeline = (student) => {
    setSelectedStudent(student);
    setTimelineVisible(true);
  };

  const columns = [
    {
      title: 'Student',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 200,
      render: (text, record) => (
        <div className="flex items-center gap-2">
          <Avatar size={32} icon={<UserOutlined />} className="bg-primary" />
          <div>
            <div className="font-medium text-text-primary">{text}</div>
            <div className="text-xs text-text-tertiary">{record.rollNumber}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Batch',
      dataIndex: 'batch',
      key: 'batch',
      width: 100,
      render: (text) => <Tag color="blue" className="rounded-md">{text}</Tag>,
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      width: 150,
      render: (text) => <Text className="text-text-primary">{text}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'internshipStatus',
      key: 'internshipStatus',
      width: 140,
      render: (status) => (
        <Tag icon={getStatusIcon(status)} color={getStatusColor(status)} className="rounded-full px-3">
          {status}
        </Tag>
      ),
    },
    {
      title: 'Reports',
      key: 'reports',
      width: 120,
      render: (_, record) => (
        <Tooltip title={`${record.reportsSubmitted} submitted / ${record.totalReports} expected`}>
          <Space size={4} className="text-text-secondary">
            <FileTextOutlined className="text-text-tertiary" />
            <Text>
              {record.reportsSubmitted} / {record.totalReports}
            </Text>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: 'Completion',
      dataIndex: 'completionPercentage',
      key: 'completionPercentage',
      width: 150,
      sorter: (a, b) => a.completionPercentage - b.completionPercentage,
      render: (percentage) => (
        <div className="flex items-center gap-2">
          <Progress
            percent={percentage}
            size="small"
            strokeColor={
              percentage >= 75
                ? 'var(--ant-success-color)'
                : percentage >= 50
                ? 'var(--ant-primary-color)'
                : percentage >= 25
                ? 'var(--ant-warning-color)'
                : 'var(--ant-error-color)'
            }
            className="flex-1"
          />
        </div>
      ),
    },
    {
      title: 'Mentor',
      dataIndex: 'mentor',
      key: 'mentor',
      width: 150,
      render: (mentor) => (mentor ? <Text className="text-text-primary">{mentor}</Text> : <Text className="text-text-tertiary italic">Not Assigned</Text>),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Timeline">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => showTimeline(record)}
              disabled={!record.timeline || record.timeline.length === 0}
              className="text-primary hover:bg-primary-50"
            />
          </Tooltip>
          {record.application && (
            <Tooltip title="Edit Internship">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEditInternship(record)}
                className="text-warning hover:bg-warning-50"
              />
            </Tooltip>
          )}
          <Tooltip title="Send Reminder">
            <Button
              type="text"
              icon={<BellOutlined />}
              onClick={() => handleSendReminder(record)}
              className="text-orange-500 hover:bg-orange-50"
            />
          </Tooltip>
          {!record.mentor && (
            <Tooltip title="Assign Mentor">
              <Button
                type="text"
                icon={<TeamOutlined />}
                onClick={() => handleAssignMentor(record)}
                className="text-secondary hover:bg-secondary-50"
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const pendingReportColumns = [
    {
      title: 'Student',
      key: 'student',
      width: 200,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <Avatar size={28} icon={<UserOutlined />} className="bg-background-tertiary text-text-tertiary" />
          <div>
            <div className="font-medium text-sm text-text-primary">{record.name}</div>
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider font-bold">{record.rollNumber}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Batch',
      dataIndex: 'batch',
      key: 'batch',
      width: 100,
      render: (text) => <Tag color="blue" className="text-[10px] uppercase font-bold rounded-md px-2">{text}</Tag>,
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      width: 120,
      ellipsis: true,
      render: (text) => <Text className="text-text-secondary text-xs">{text}</Text>,
    },
    {
      title: 'Mentor',
      dataIndex: 'mentor',
      key: 'mentor',
      width: 120,
      render: (mentor) => mentor || <Text className="text-text-tertiary text-[10px] italic">Not Assigned</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag icon={getReportStatusIcon(status)} color={getReportStatusColor(status)} className="text-[10px] uppercase font-bold rounded-md m-0">
          {status}
        </Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Tooltip title="Send Reminder">
          <Button
            type="text"
            size="small"
            icon={<BellOutlined />}
            onClick={() => handleSendReminder(record)}
            className="text-warning hover:bg-warning-50"
          />
        </Tooltip>
      ),
    },
  ];

  const getJoiningLetterStatusTag = (application) => {
    if (!application) return null;

    if (application.hasJoiningLetter && application.joiningLetterUrl) {
      return (
        <Tag icon={<CheckCircleOutlined />} color="success" className="rounded-full px-3">
          Uploaded
        </Tag>
      );
    } else if (application.status === 'ACCEPTED' || application.status === 'JOINED') {
      return (
        <Tag icon={<WarningOutlined />} color="warning" className="rounded-full px-3">
          Pending Upload
        </Tag>
      );
    }
    return (
      <Tag icon={<MinusCircleOutlined />} color="default" className="rounded-full px-3">
        Not Required
      </Tag>
    );
  };

  const handleViewJoiningLetter = (url) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  const getReportMonthlyStatusTag = (status) => {
    const statusConfig = {
      SUBMITTED: { color: 'processing', icon: <SyncOutlined />, text: 'Submitted' },
      APPROVED: { color: 'success', icon: <CheckCircleOutlined />, text: 'Approved' },
      REJECTED: { color: 'error', icon: <ExclamationCircleOutlined />, text: 'Rejected' },
      PENDING: { color: 'warning', icon: <ClockCircleOutlined />, text: 'Pending' },
    };
    const config = statusConfig[status] || statusConfig.PENDING;
    return (
      <Tag icon={config.icon} color={config.color} className="rounded-md text-xs">
        {config.text}
      </Tag>
    );
  };

  const expandedRowRender = (record) => (
    <div className="p-4 bg-background-tertiary/30 rounded-xl border border-border/50 mx-4 my-2">
      {record.application ? (
        <div className="space-y-6">
          {/* Internship Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                <BankOutlined className="text-xl" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Text strong className="text-xs uppercase tracking-widest text-text-tertiary">Self-Identified Internship</Text>
                  <Tag color="purple" className="rounded-full text-[10px] uppercase font-bold m-0">Student Sourced</Tag>
                </div>
                <Text className="text-lg text-text-primary font-semibold">{record.application.companyName || record.application.internshipTitle || 'N/A'}</Text>
                {record.application.jobProfile && (
                  <Text className="text-sm text-text-secondary block">{record.application.jobProfile}</Text>
                )}
                <div className="flex items-center gap-4 mt-2 text-text-secondary text-sm flex-wrap">
                  {record.application.joiningDate && (
                    <div className="flex items-center gap-1">
                      <CalendarOutlined className="text-xs" />
                      <span>Started {dayjs(record.application.joiningDate || record.application.startDate).format("DD MMM YYYY")}</span>
                    </div>
                  )}
                  {record.application.internshipDuration && (
                    <div className="flex items-center gap-1">
                      <ClockCircleOutlined className="text-xs" />
                      <span>{record.application.internshipDuration}</span>
                    </div>
                  )}
                  {record.application.stipend && (
                    <Tag color="green" className="rounded-full m-0 text-xs">
                      Stipend: {record.application.stipend}/month
                    </Tag>
                  )}
                </div>
              </div>
            </div>
            <Tag color={getStatusColor(record.internshipStatus)} className="rounded-full px-3">
              {record.internshipStatus}
            </Tag>
          </div>

          {/* Joining Letter Section */}
          <div className="bg-background rounded-xl p-4 border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
                  <FilePdfOutlined className="text-lg" />
                </div>
                <div>
                  <Text className="block text-xs uppercase tracking-widest text-text-tertiary font-bold mb-1">Joining Letter</Text>
                  <div className="flex items-center gap-2">
                    {getJoiningLetterStatusTag(record.application)}
                    {record.application.joiningLetterUploadedAt && (
                      <Text className="text-xs text-text-tertiary">
                        Uploaded {dayjs(record.application.joiningLetterUploadedAt).format("DD MMM YYYY")}
                      </Text>
                    )}
                  </div>
                </div>
              </div>
              {record.application.hasJoiningLetter && record.application.joiningLetterUrl && (
                <Space>
                  <Button
                    type="primary"
                    ghost
                    icon={<EyeOutlined />}
                    onClick={() => handleViewJoiningLetter(record.application.joiningLetterUrl)}
                    className="rounded-lg"
                  >
                    View
                  </Button>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = record.application.joiningLetterUrl;
                      link.download = `joining-letter-${record.rollNumber}.pdf`;
                      link.click();
                    }}
                    className="rounded-lg"
                  >
                    Download
                  </Button>
                </Space>
              )}
            </div>
          </div>

          {/* Company/Industry Details - Self-Identified */}
          {(record.application.companyName || record.application.company) && (
            <div className="bg-background rounded-xl p-4 border border-border/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <BankOutlined className="text-lg" />
                </div>
                <div>
                  <Text className="block text-xs uppercase tracking-widest text-text-tertiary font-bold">Company Details</Text>
                </div>
              </div>
              <Descriptions
                column={{ xs: 1, sm: 2, md: 3 }}
                size="small"
                className="bg-background-tertiary/30 rounded-lg p-3"
              >
                <Descriptions.Item label={<span className="text-text-tertiary"><BankOutlined className="mr-1" />Company</span>}>
                  <Text strong className="text-text-primary">{record.application.companyName || record.application.company?.name || 'N/A'}</Text>
                </Descriptions.Item>
                {record.application.jobProfile && (
                  <Descriptions.Item label={<span className="text-text-tertiary">Job Profile</span>}>
                    <Tag color="purple" className="rounded-md">{record.application.jobProfile}</Tag>
                  </Descriptions.Item>
                )}
                {record.application.stipend && (
                  <Descriptions.Item label={<span className="text-text-tertiary">Stipend</span>}>
                    <Tag color="green" className="rounded-md">{record.application.stipend}/month</Tag>
                  </Descriptions.Item>
                )}
                {record.application.companyEmail && (
                  <Descriptions.Item label={<span className="text-text-tertiary"><MailOutlined className="mr-1" />Email</span>}>
                    <a href={`mailto:${record.application.companyEmail}`} className="text-primary hover:underline">
                      {record.application.companyEmail}
                    </a>
                  </Descriptions.Item>
                )}
                {record.application.companyContact && (
                  <Descriptions.Item label={<span className="text-text-tertiary"><PhoneOutlined className="mr-1" />Phone</span>}>
                    <Text className="text-text-primary">{record.application.companyContact}</Text>
                  </Descriptions.Item>
                )}
                {record.application.companyAddress && (
                  <Descriptions.Item label={<span className="text-text-tertiary"><EnvironmentOutlined className="mr-1" />Address</span>} span={2}>
                    <Text className="text-text-primary">{record.application.companyAddress}</Text>
                  </Descriptions.Item>
                )}
                {record.application.startDate && (
                  <Descriptions.Item label={<span className="text-text-tertiary"><CalendarOutlined className="mr-1" />Duration</span>}>
                    <Text className="text-text-primary">
                      {dayjs(record.application.startDate).format("DD MMM YYYY")} - {record.application.endDate ? dayjs(record.application.endDate).format("DD MMM YYYY") : 'Ongoing'}
                    </Text>
                  </Descriptions.Item>
                )}
              </Descriptions>

              {/* Faculty Mentor Details for Self-Identified */}
              {record.application.facultyMentorName && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <TeamOutlined className="text-text-tertiary" />
                    <Text className="text-xs uppercase tracking-widest text-text-tertiary font-bold">Faculty Mentor</Text>
                  </div>
                  <Descriptions
                    column={{ xs: 1, sm: 2 }}
                    size="small"
                    className="bg-background-tertiary/30 rounded-lg p-3"
                  >
                    <Descriptions.Item label="Name">
                      <Text strong className="text-text-primary">{record.application.facultyMentorName}</Text>
                    </Descriptions.Item>
                    {record.application.facultyMentorDesignation && (
                      <Descriptions.Item label="Designation">
                        <Text className="text-text-primary">{record.application.facultyMentorDesignation}</Text>
                      </Descriptions.Item>
                    )}
                    {record.application.facultyMentorEmail && (
                      <Descriptions.Item label="Email">
                        <a href={`mailto:${record.application.facultyMentorEmail}`} className="text-primary hover:underline">
                          {record.application.facultyMentorEmail}
                        </a>
                      </Descriptions.Item>
                    )}
                    {record.application.facultyMentorContact && (
                      <Descriptions.Item label="Contact">
                        <Text className="text-text-primary">{record.application.facultyMentorContact}</Text>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </div>
              )}
            </div>
          )}

          {/* Monthly Reports Section */}
          {record.monthlyReports && record.monthlyReports.length > 0 && (
            <div className="bg-background rounded-xl p-4 border border-border/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
                    <FileTextOutlined className="text-lg" />
                  </div>
                  <div>
                    <Text className="block text-xs uppercase tracking-widest text-text-tertiary font-bold">Monthly Reports</Text>
                    <Text className="text-sm text-text-secondary">
                      {record.reportsSubmitted} of {record.totalReports} submitted
                    </Text>
                  </div>
                </div>
                <Progress
                  type="circle"
                  percent={Math.round((record.reportsSubmitted / record.totalReports) * 100) || 0}
                  size={50}
                  strokeColor={record.reportsSubmitted === record.totalReports ? 'var(--ant-success-color)' : 'var(--ant-primary-color)'}
                />
              </div>
              <Table
                dataSource={record.monthlyReports}
                rowKey={(r) => r.id || `${r.month}-${r.year}`}
                size="small"
                pagination={false}
                scroll={{ x: 500 }}
                className="bg-background-tertiary/30 rounded-lg overflow-hidden"
                columns={[
                  {
                    title: 'Month',
                    key: 'month',
                    width: 120,
                    render: (_, r) => (
                      <Text className="font-medium text-text-primary">
                        {dayjs().month(r.month - 1).format('MMMM')} {r.year}
                      </Text>
                    ),
                  },
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    key: 'status',
                    width: 120,
                    render: (status) => getReportMonthlyStatusTag(status),
                  },
                  {
                    title: 'Submitted On',
                    dataIndex: 'submittedAt',
                    key: 'submittedAt',
                    width: 140,
                    render: (date) => date ? dayjs(date).format('DD MMM YYYY') : '-',
                  },
                  {
                    title: 'Actions',
                    key: 'actions',
                    width: 100,
                    render: (_, r) => r.reportFileUrl ? (
                      <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => window.open(r.reportFileUrl, '_blank')}
                        className="!p-0"
                      >
                        View
                      </Button>
                    ) : (
                      <Text className="text-text-tertiary text-xs">Not submitted</Text>
                    ),
                  },
                ]}
              />
            </div>
          )}

          {/* Progress Timeline */}
          {record.timeline && record.timeline.length > 0 && (
            <div className="pt-4 border-t border-border/50">
              <Title level={5} className="!mb-4 flex items-center text-xs uppercase tracking-widest text-text-tertiary font-bold">
                <SyncOutlined className="mr-2" />
                Progress Timeline
              </Title>
              <div className="px-2">
                <Timeline
                  items={record.timeline.slice(0, 5).map(item => ({
                    ...item,
                    children: <div className="text-text-primary text-sm">{item.children}</div>
                  }))}
                  className="mt-2"
                />
              </div>
              {record.timeline.length > 5 && (
                <Button type="link" onClick={() => showTimeline(record)} className="!p-0 text-primary">
                  View all {record.timeline.length} events
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <Empty description="No internship application" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </div>
  );

  const renderPendingReportsView = () => {
    if (pendingReportsLoading) {
      return (
        <div className="flex flex-col justify-center items-center py-20 gap-4">
          <SyncOutlined spin className="text-3xl text-primary" />
          <Text className="text-text-secondary font-medium animate-pulse">Loading pending reports...</Text>
        </div>
      );
    }

    if (!pendingReportsData) {
      return <Empty description="No data available" />;
    }

    const { summary, months } = pendingReportsData;

    return (
      <div className="space-y-6">
        {/* Summary Stats */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="borderless" className="rounded-xl border border-border shadow-sm">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Active Interns</Text>}
                value={summary.totalStudentsWithInternships}
                prefix={<UserOutlined className="text-primary" />}
                valueStyle={{ color: 'var(--ant-primary-color)', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="borderless" className="rounded-xl border border-border shadow-sm">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Expected Reports</Text>}
                value={summary.totalExpectedReports}
                prefix={<FileTextOutlined className="text-text-tertiary" />}
                valueStyle={{ color: 'var(--ant-text-color-secondary)', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="borderless" className="rounded-xl border border-border shadow-sm">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Submitted</Text>}
                value={summary.totalSubmitted}
                prefix={<CheckCircleOutlined className="text-success" />}
                valueStyle={{ color: 'var(--ant-success-color)', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="borderless" className="rounded-xl border border-border shadow-sm">
              <Statistic
                title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Pending/Missing</Text>}
                value={summary.totalPending}
                prefix={<WarningOutlined className="text-error" />}
                valueStyle={{ color: summary.totalPending > 0 ? 'var(--ant-error-color)' : 'var(--ant-success-color)', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
        </Row>

        {summary.totalPending > 0 && (
          <Alert
            message={`${summary.totalPending} report(s) pending or missing across ${summary.monthsWithPending} month(s)`}
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            className="rounded-xl border-warning/30 bg-warning-50/50"
          />
        )}

        {/* Monthly Breakdown */}
        <Card title={<span className="text-text-primary font-semibold">Monthly Report Status</span>} variant="borderless" className="rounded-xl border border-border shadow-sm">
          {months.length === 0 ? (
            <Empty description="No months to display" />
          ) : (
            <Collapse
              accordion
              ghost
              className="bg-background"
              items={months.map((monthData) => ({
                key: `${monthData.year}-${monthData.month}`,
                label: (
                  <div className="flex justify-between items-center w-full pr-4">
                    <Space>
                      <CalendarOutlined className="text-text-tertiary" />
                      <span className="font-semibold text-text-primary">{monthData.monthName} {monthData.year}</span>
                      {monthData.isPast && monthData.pending > 0 && (
                        <Tag color="error" className="text-[10px] uppercase font-bold rounded-md">Overdue</Tag>
                      )}
                    </Space>
                    <Space size="large">
                      <Badge
                        count={monthData.pending}
                        showZero
                        color={monthData.pending > 0 ? 'var(--ant-error-color)' : 'var(--ant-success-color)'}
                        overflowCount={99}
                      >
                        <Tag color={monthData.pending > 0 ? 'error' : 'success'} className="rounded-md m-0 font-medium px-3">
                          {monthData.pending > 0 ? `${monthData.pending} Pending` : 'All Submitted'}
                        </Tag>
                      </Badge>
                      <Text className="text-xs text-text-secondary font-medium">
                        {monthData.submitted}/{monthData.totalExpected} <span className="text-text-tertiary font-normal">submitted</span>
                      </Text>
                    </Space>
                  </div>
                ),
                children: (
                  <div className="bg-background-tertiary/20 rounded-xl p-4 border border-border/50">
                    {monthData.students.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-3">
                          <CheckCircleOutlined className="text-2xl" />
                        </div>
                        <div className="text-success-700 font-medium">All reports submitted and approved!</div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-4">
                          <Text className="text-text-secondary text-sm font-medium">
                            Students with pending or missing reports for {monthData.monthName}:
                          </Text>
                        </div>
                        <Table
                          columns={pendingReportColumns}
                          dataSource={monthData.students}
                          rowKey="id"
                          pagination={false}
                          size="small"
                          scroll={{ x: 700 }}
                          className="custom-table-small"
                        />
                      </>
                    )}
                  </div>
                ),
                extra: monthData.pending > 0 ? (
                  <Button
                    size="small"
                    icon={<BellOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.success(`Reminder sent to ${monthData.pending} student(s) for ${monthData.monthName}`);
                    }}
                    className="rounded-lg text-xs"
                  >
                    Remind All
                  </Button>
                ) : null,
              }))}
            />
          )}
        </Card>
      </div>
    );
  };

  const tabItems = [
    {
      key: 'progress',
      label: (
        <span className="flex items-center gap-2 py-2">
          <SyncOutlined />
          Student Progress
        </span>
      ),
      children: (
        <>
          {/* Statistics Cards */}
          <Row gutter={[16, 16]} className="mb-6">
            <Col xs={24} sm={12} lg={6}>
              <Card variant="borderless" className="rounded-xl border border-border shadow-sm">
                <Statistic
                  title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Total Students</Text>}
                  value={stats.total}
                  prefix={<UserOutlined className="text-primary" />}
                  valueStyle={{ color: 'var(--ant-primary-color)', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card variant="borderless" className="rounded-xl border border-border shadow-sm">
                <Statistic
                  title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">In Progress</Text>}
                  value={stats.inProgress}
                  prefix={<SyncOutlined className="text-primary" />}
                  valueStyle={{ color: 'var(--ant-primary-color)', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card variant="borderless" className="rounded-xl border border-border shadow-sm">
                <Statistic
                  title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Completed</Text>}
                  value={stats.completed}
                  prefix={<CheckCircleOutlined className="text-success" />}
                  valueStyle={{ color: 'var(--ant-success-color)', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card variant="borderless" className="rounded-xl border border-border shadow-sm">
                <Statistic
                  title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Delayed</Text>}
                  value={stats.delayed}
                  prefix={<ClockCircleOutlined className="text-error" />}
                  valueStyle={{ color: stats.delayed > 0 ? 'var(--ant-error-color)' : 'var(--ant-success-color)', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Table */}
          <Card className="border-border rounded-2xl shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
            <Table
              columns={columns}
              dataSource={students}
              rowKey="id"
              loading={loading}
              scroll={{ x: 1200 }}
              expandable={{
                expandedRowRender,
                rowExpandable: () => true,
              }}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} students`,
                pageSizeOptions: ['10', '20', '50', '100'],
              }}
              onChange={handleTableChange}
              locale={{
                emptyText: <Empty description="No students found" />,
              }}
              className="custom-table"
            />
          </Card>
        </>
      ),
    },
    {
      key: 'pending-reports',
      label: (
        <span className="flex items-center gap-2 py-2">
          <Badge count={pendingReportsData?.summary?.totalPending || 0} size="small" offset={[10, 0]}>
            <FileTextOutlined />
            <span className="ml-1">Pending Reports</span>
          </Badge>
        </span>
      ),
      children: renderPendingReportsView(),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <Title level={2} className="mb-1 text-text-primary">
            Student Progress Tracking
          </Title>
          <Text className="text-text-secondary text-base">
            Monitor internship progress and report submissions across all students
          </Text>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'pending-reports' && (
            <Select
              value={selectedYear}
              onChange={(value) => setSelectedYear(value)}
              className="w-28 rounded-lg"
            >
              {[0, 1, 2].map(offset => {
                const year = new Date().getFullYear() - offset;
                return <Select.Option key={year} value={year}>{year}</Select.Option>;
              })}
            </Select>
          )}
          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh} 
            loading={loading || pendingReportsLoading}
            className="rounded-lg shadow-sm"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="rounded-xl border-border shadow-sm">
        <div className="flex gap-4 flex-wrap items-center">
          {activeTab === 'progress' && (
            <Input
              placeholder="Search name or roll number..."
              prefix={<SearchOutlined className="text-text-tertiary" />}
              onChange={handleSearchChange}
              className="w-full md:w-64 rounded-lg"
              allowClear
            />
          )}
          <Select
            value={filters.batchId}
            onChange={(value) => handleFilterChange('batchId', value)}
            className="w-full md:w-40 rounded-lg"
            placeholder="Filter by Batch"
          >
            <Select.Option value="all">All Batches</Select.Option>
            {batches?.map(batch => (
              <Select.Option key={batch.id} value={batch.id}>
                {batch.name || `Batch ${batch.year}`}
              </Select.Option>
            ))}
          </Select>
          <Select
            value={filters.branchId}
            onChange={(value) => handleFilterChange('branchId', value)}
            className="w-full md:w-48 rounded-lg"
            placeholder="Filter by Department"
          >
            <Select.Option value="all">All Departments</Select.Option>
            {departments?.map(dept => (
              <Select.Option key={dept.id} value={dept.id}>{dept.name}</Select.Option>
            ))}
          </Select>
          {activeTab === 'progress' && (
            <>
              <Select
                value={filters.status}
                onChange={(value) => handleFilterChange('status', value)}
                className="w-full md:w-40 rounded-lg"
                placeholder="Filter by Status"
              >
                <Select.Option value="all">All Status</Select.Option>
                <Select.Option value="Not Started">Not Started</Select.Option>
                <Select.Option value="Pending">Pending</Select.Option>
                <Select.Option value="In Progress">In Progress</Select.Option>
                <Select.Option value="Delayed">Delayed</Select.Option>
                <Select.Option value="Completed">Completed</Select.Option>
              </Select>
              <Select
                value={filters.mentorId}
                onChange={(value) => handleFilterChange('mentorId', value)}
                className="w-full md:w-48 rounded-lg"
                placeholder="Filter by Mentor"
              >
                <Select.Option value="all">All Mentors</Select.Option>
                <Select.Option value="unassigned">Unassigned</Select.Option>
                {mentors?.map(mentor => (
                  <Select.Option key={mentor.id} value={mentor.id}>
                    {mentor.name}
                  </Select.Option>
                ))}
              </Select>
              <Select
                value={filters.joiningLetterStatus}
                onChange={(value) => handleFilterChange('joiningLetterStatus', value)}
                className="w-full md:w-48 rounded-lg"
                placeholder="Joining Letter"
              >
                <Select.Option value="all">All Joining Letters</Select.Option>
                <Select.Option value="uploaded">Uploaded</Select.Option>
                <Select.Option value="pending">Pending Upload</Select.Option>
                <Select.Option value="not_required">Not Required</Select.Option>
              </Select>
            </>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
        className="custom-tabs-large"
      />

      {/* Timeline Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-text-primary">
            <SyncOutlined className="text-primary" />
            <span>Progress Timeline - {selectedStudent?.name}</span>
          </div>
        }
        open={timelineVisible}
        onCancel={() => setTimelineVisible(false)}
        footer={null}
        width={600}
        className="rounded-2xl overflow-hidden"
      >
        {selectedStudent && (
          <div className="py-4">
            {selectedStudent.application && (
              <div className="mb-6 p-4 bg-background-tertiary/30 rounded-xl border border-border/50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <Text strong className="block text-[10px] uppercase tracking-widest text-text-tertiary mb-1">Company</Text>
                    <Text className="text-base text-text-primary font-bold">{selectedStudent.application.internshipTitle || 'N/A'}</Text>
                  </div>
                  <Tag color={getStatusColor(selectedStudent.internshipStatus)} className="m-0 rounded-full px-3">
                    {selectedStudent.internshipStatus}
                  </Tag>
                </div>
              </div>
            )}
            {selectedStudent.timeline && selectedStudent.timeline.length > 0 ? (
              <div className="px-4">
                <Timeline
                  items={selectedStudent.timeline.map(item => ({
                    ...item,
                    children: <div className="text-text-primary text-sm">{item.children}</div>
                  }))}
                />
              </div>
            ) : (
              <Empty description="No timeline events" image={Empty.PRESENTED_IMAGE_SIMPLE} className="py-10" />
            )}
          </div>
        )}
      </Modal>

      {/* Edit Internship Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-text-primary">
            <EditOutlined className="text-warning" />
            <span>Edit Internship Details</span>
          </div>
        }
        open={editVisible}
        onCancel={() => {
          setEditVisible(false);
          editForm.resetFields();
        }}
        width={700}
        footer={null}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditSubmit}
          className="mt-4"
        >
          {editStudent && (
            <div className="p-3 rounded-lg bg-primary/5 mb-4">
              <div className="flex items-center gap-3">
                <Avatar size={40} icon={<UserOutlined />} className="bg-primary/10 text-primary" />
                <div>
                  <Text className="font-bold text-text-primary block">{editStudent.name}</Text>
                  <Text className="text-text-secondary text-sm">{editStudent.rollNumber}</Text>
                </div>
              </div>
            </div>
          )}

          <Divider className="my-4">Company Information</Divider>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="companyName"
                label="Company Name"
                rules={[{ required: true, message: 'Company name is required' }]}
              >
                <Input placeholder="Enter company name" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="jobProfile" label="Job Profile / Role">
                <Input placeholder="Enter job profile" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="companyContact" label="Company Contact">
                <Input placeholder="Enter contact number" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="companyEmail" label="Company Email">
                <Input placeholder="Enter email" type="email" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="companyAddress" label="Company Address">
            <Input.TextArea placeholder="Enter company address" rows={2} />
          </Form.Item>

          <Divider className="my-4">Internship Details</Divider>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="stipend" label="Monthly Stipend (₹)">
                <InputNumber
                  placeholder="Enter stipend"
                  className="w-full"
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="internshipDuration" label="Duration">
                <Input placeholder="e.g., 6 months" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="status" label="Status">
                <Select placeholder="Select status">
                  <Select.Option value="APPROVED">Active</Select.Option>
                  <Select.Option value="JOINED">Joined</Select.Option>
                  <Select.Option value="COMPLETED">Completed</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="startDate" label="Start Date">
                <DatePicker className="w-full" format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="endDate" label="End Date">
                <DatePicker className="w-full" format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Divider className="my-4">Faculty Mentor</Divider>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="facultyMentorName" label="Mentor Name">
                <Input placeholder="Enter mentor name" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="facultyMentorEmail" label="Mentor Email">
                <Input placeholder="Enter mentor email" type="email" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="facultyMentorDesignation" label="Designation">
                <Input placeholder="Enter designation" />
              </Form.Item>
            </Col>
          </Row>

          <Divider className="my-4" />
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => {
                setEditVisible(false);
                editForm.resetFields();
              }}
              icon={<CloseOutlined />}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={editLoading}
              icon={<SaveOutlined />}
            >
              Save Changes
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default StudentProgress;
