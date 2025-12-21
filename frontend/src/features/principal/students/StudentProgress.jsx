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
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import { debounce } from 'lodash';
import analyticsService from '../../../services/analytics.service';
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
  });
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
      width: 150,
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
          <Tooltip title="Send Reminder">
            <Button
              type="text"
              icon={<BellOutlined />}
              onClick={() => handleSendReminder(record)}
              className="text-warning hover:bg-warning-50"
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

  const expandedRowRender = (record) => (
    <div className="p-4 bg-background-tertiary/30 rounded-xl border border-border/50 mx-4 my-2">
      {record.application ? (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <BankOutlined className="text-lg" />
            </div>
            <div>
              <Text strong className="block text-xs uppercase tracking-widest text-text-tertiary mb-1">Current Internship</Text>
              <Text className="text-base text-text-primary font-semibold">{record.application.internshipTitle || 'N/A'}</Text>
              {record.application.joiningDate && (
                <div className="flex items-center gap-2 mt-1 text-text-secondary text-sm">
                  <CalendarOutlined className="text-xs" />
                  <span>Joined on {dayjs(record.application.joiningDate).format("DD MMM YYYY")}</span>
                </div>
              )}
            </div>
          </div>
          
          {record.timeline && record.timeline.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border/50">
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
    </div>
  );
};

export default StudentProgress;
