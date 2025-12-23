import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Input,
  Modal,
  Row,
  Col,
  Statistic,
  Avatar,
  Empty,
  Spin,
  Tooltip,
  Descriptions,
  Select,
  DatePicker,
  Progress,
  Timeline,
  Tabs,
  Badge,
  Divider,
  Form,
  InputNumber,
  Popconfirm,
  Dropdown,
} from 'antd';
import {
  ShopOutlined,
  SearchOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  ReloadOutlined,
  DownloadOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  MailOutlined,
  PhoneOutlined,
  TeamOutlined,
  FileTextOutlined,
  BankOutlined,
  DollarOutlined,
  RiseOutlined,
  FilePdfOutlined,
  LinkOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  MoreOutlined,
  CheckOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import principalService from '../../../services/principal.service';
import {
  fetchInternshipStats,
  selectInternshipStats,
} from '../store/principalSlice';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const SelfIdentifiedInternships = () => {
  const dispatch = useDispatch();
  const internshipStats = useSelector(selectInternshipStats);
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [internships, setInternships] = useState([]);
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({
    status: 'all',
    dateRange: null,
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // Fetch internships
  const fetchInternships = useCallback(async () => {
    try {
      setLoading(true);
      // Using student progress endpoint which includes internship data
      const response = await principalService.getStudents({
        page: pagination.current,
        limit: pagination.pageSize,
        hasInternship: true,
      });

      const data = response.data || response;
      const students = data.data || data.students || [];

      // Transform student data to internship format
      const internshipData = students
        .filter(s => s.internshipApplication || s.selfIdentifiedInternship)
        .map(student => {
          const internship = student.internshipApplication || student.selfIdentifiedInternship || {};
          return {
            id: internship.id || student.id,
            studentId: student.id,
            studentName: student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim(),
            studentRollNumber: student.rollNumber || student.registrationNumber,
            studentEmail: student.email,
            studentPhone: student.phone,
            studentBatch: student.batch?.name || student.batchName,
            studentDepartment: student.department?.name || student.departmentName,
            companyName: internship.companyName || 'N/A',
            companyAddress: internship.companyAddress,
            companyContact: internship.companyContact,
            companyEmail: internship.companyEmail,
            jobProfile: internship.jobProfile || internship.role,
            stipend: internship.stipend,
            startDate: internship.startDate,
            endDate: internship.endDate,
            duration: internship.internshipDuration,
            status: internship.status || 'APPROVED',
            mentorName: internship.facultyMentorName || student.mentor?.name,
            mentorEmail: internship.facultyMentorEmail || student.mentor?.email,
            mentorDesignation: internship.facultyMentorDesignation,
            joiningLetterUrl: internship.joiningLetterUrl,
            submittedAt: internship.createdAt || student.createdAt,
            isSelfIdentified: internship.isSelfIdentified ?? true,
          };
        });

      setInternships(internshipData);
      setPagination(prev => ({
        ...prev,
        total: data.total || data.pagination?.total || internshipData.length,
      }));
    } catch (error) {
      console.error('Failed to fetch internships:', error);
      toast.error('Failed to load internships');
      // Set mock data for demo
      setInternships(generateMockData());
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => {
    fetchInternships();
    dispatch(fetchInternshipStats());
  }, [fetchInternships, dispatch]);

  // Filter internships
  const filteredInternships = useMemo(() => {
    let filtered = [...internships];

    // Tab filter
    if (activeTab !== 'all') {
      filtered = filtered.filter(i => i.status === activeTab.toUpperCase());
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(i => i.status === filters.status);
    }

    // Date range filter
    if (filters.dateRange && filters.dateRange.length === 2) {
      filtered = filtered.filter(i => {
        const date = dayjs(i.submittedAt);
        return date.isAfter(filters.dateRange[0]) && date.isBefore(filters.dateRange[1]);
      });
    }

    // Search filter
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        i =>
          i.studentName?.toLowerCase().includes(search) ||
          i.companyName?.toLowerCase().includes(search) ||
          i.studentRollNumber?.toLowerCase().includes(search) ||
          i.jobProfile?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [internships, activeTab, filters, searchText]);

  // Status helpers
  const getStatusConfig = (status) => {
    const configs = {
      APPROVED: { color: 'success', icon: <CheckCircleOutlined />, text: 'Active' },
      JOINED: { color: 'processing', icon: <RiseOutlined />, text: 'Ongoing' },
      COMPLETED: { color: 'default', icon: <CheckCircleOutlined />, text: 'Completed' },
      APPLIED: { color: 'warning', icon: <ClockCircleOutlined />, text: 'Pending' },
    };
    return configs[status] || { color: 'default', icon: <ClockCircleOutlined />, text: status };
  };

  // Calculate stats
  const stats = useMemo(() => {
    const total = internships.length;
    const ongoing = internships.filter(i => ['APPROVED', 'JOINED'].includes(i.status)).length;
    const completed = internships.filter(i => i.status === 'COMPLETED').length;
    const uniqueCompanies = new Set(internships.map(i => i.companyName)).size;

    return { total, ongoing, completed, uniqueCompanies };
  }, [internships]);

  const handleViewDetails = (internship) => {
    setSelectedInternship(internship);
    setDetailsVisible(true);
  };

  const handleEdit = (internship) => {
    setSelectedInternship(internship);
    form.setFieldsValue({
      companyName: internship.companyName,
      companyAddress: internship.companyAddress,
      companyContact: internship.companyContact,
      companyEmail: internship.companyEmail,
      jobProfile: internship.jobProfile,
      stipend: internship.stipend ? parseInt(internship.stipend) : null,
      internshipDuration: internship.duration,
      startDate: internship.startDate ? dayjs(internship.startDate) : null,
      endDate: internship.endDate ? dayjs(internship.endDate) : null,
      facultyMentorName: internship.mentorName,
      facultyMentorEmail: internship.mentorEmail,
      facultyMentorDesignation: internship.mentorDesignation,
      status: internship.status,
    });
    setEditVisible(true);
  };

  const handleEditSubmit = async (values) => {
    if (!selectedInternship) return;

    try {
      setEditLoading(true);
      const updateData = {
        ...values,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
      };

      await principalService.updateInternship(selectedInternship.id, updateData);
      toast.success('Internship updated successfully');
      setEditVisible(false);
      fetchInternships();
      dispatch(fetchInternshipStats());
    } catch (error) {
      console.error('Failed to update internship:', error);
      toast.error(error.message || 'Failed to update internship');
    } finally {
      setEditLoading(false);
    }
  };

  const handleBulkStatusUpdate = async (status) => {
    if (selectedRowKeys.length === 0) {
      toast.error('Please select internships first');
      return;
    }

    try {
      setBulkActionLoading(true);
      await principalService.bulkUpdateInternshipStatus(selectedRowKeys, status);
      toast.success(`Updated ${selectedRowKeys.length} internship(s) to ${status}`);
      setSelectedRowKeys([]);
      fetchInternships();
      dispatch(fetchInternshipStats());
    } catch (error) {
      console.error('Failed to bulk update:', error);
      toast.error(error.message || 'Failed to update internships');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchInternships();
    dispatch(fetchInternshipStats());
    toast.success('Data refreshed');
  };

  // Row selection for bulk actions
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
    getCheckboxProps: (record) => ({
      disabled: false,
    }),
  };

  // Bulk action menu items
  const bulkActionItems = [
    { key: 'APPROVED', label: 'Mark as Active', icon: <CheckCircleOutlined className="text-green-500" /> },
    { key: 'JOINED', label: 'Mark as Joined', icon: <RiseOutlined className="text-blue-500" /> },
    { key: 'COMPLETED', label: 'Mark as Completed', icon: <CheckOutlined className="text-purple-500" /> },
    { key: 'REJECTED', label: 'Mark as Rejected', icon: <StopOutlined className="text-red-500" /> },
  ];

  // Table columns
  const columns = [
    {
      title: 'Student',
      key: 'student',
      width: 220,
      fixed: 'left',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <Avatar icon={<UserOutlined />} className="bg-primary/10 text-primary" />
          <div className="min-w-0">
            <Text className="block font-medium text-text-primary truncate">{record.studentName}</Text>
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <span>{record.studentRollNumber}</span>
              {record.studentBatch && (
                <>
                  <span>•</span>
                  <span>{record.studentBatch}</span>
                </>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Company',
      key: 'company',
      width: 200,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
            <BankOutlined className="text-purple-500" />
          </div>
          <div className="min-w-0">
            <Tooltip title={record.companyName}>
              <Text className="block font-medium text-text-primary truncate">{record.companyName}</Text>
            </Tooltip>
            {record.jobProfile && (
              <Text className="text-xs text-text-tertiary truncate block">{record.jobProfile}</Text>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 150,
      render: (_, record) => (
        <div>
          <Text className="text-sm text-text-primary block">{record.duration || 'N/A'}</Text>
          {record.startDate && (
            <Text className="text-xs text-text-tertiary">
              {dayjs(record.startDate).format('DD MMM')} - {record.endDate ? dayjs(record.endDate).format('DD MMM YY') : 'Ongoing'}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Stipend',
      key: 'stipend',
      width: 100,
      render: (_, record) => (
        record.stipend ? (
          <Tag color="green" className="rounded-full">
            <DollarOutlined className="mr-1" />
            {record.stipend}/mo
          </Tag>
        ) : (
          <Tag color="default" className="rounded-full">Unpaid</Tag>
        )
      ),
    },
    {
      title: 'Mentor',
      key: 'mentor',
      width: 150,
      render: (_, record) => (
        record.mentorName ? (
          <div className="flex items-center gap-2">
            <Avatar size="small" icon={<TeamOutlined />} className="bg-success/10 text-success" />
            <Text className="text-sm text-text-primary truncate">{record.mentorName}</Text>
          </div>
        ) : (
          <Tag color="warning" className="rounded-full">Unassigned</Tag>
        )
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const config = getStatusConfig(status);
        return (
          <Tag icon={config.icon} color={config.color} className="rounded-full px-3">
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: 'Submitted',
      key: 'submittedAt',
      width: 120,
      render: (_, record) => (
        <Tooltip title={dayjs(record.submittedAt).format('DD MMM YYYY HH:mm')}>
          <Text className="text-sm text-text-secondary">
            {dayjs(record.submittedAt).fromNow()}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
              className="text-primary hover:bg-primary/10"
            />
          </Tooltip>
          <Tooltip title="Edit Internship">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              className="text-warning hover:bg-warning/10"
            />
          </Tooltip>
          {record.joiningLetterUrl && (
            <Tooltip title="View Joining Letter">
              <Button
                type="text"
                icon={<FilePdfOutlined />}
                onClick={() => window.open(record.joiningLetterUrl, '_blank')}
                className="text-success hover:bg-success/10"
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // Tab items
  const tabItems = [
    { key: 'all', label: <span className="flex items-center gap-2"><ShopOutlined />All ({stats.total})</span> },
    { key: 'approved', label: <span className="flex items-center gap-2"><CheckCircleOutlined />Active ({stats.ongoing})</span> },
    { key: 'completed', label: <span className="flex items-center gap-2"><CheckCircleOutlined />Completed ({stats.completed})</span> },
  ];

  if (loading && internships.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px] gap-4">
        <Spin size="large" />
        <Text className="text-text-secondary animate-pulse">Loading internships...</Text>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Title level={2} className="!mb-2 !text-text-primary">
            Self-Identified Internships
          </Title>
          <Text className="text-text-secondary text-base">
            Track and manage student-sourced internship placements
          </Text>
        </div>
        <Space wrap>
          {selectedRowKeys.length > 0 && (
            <Dropdown
              menu={{
                items: bulkActionItems.map(item => ({
                  key: item.key,
                  label: (
                    <Popconfirm
                      title={`Update ${selectedRowKeys.length} internship(s)?`}
                      description={`This will change their status to "${item.label.replace('Mark as ', '')}"`}
                      onConfirm={() => handleBulkStatusUpdate(item.key)}
                      okText="Yes"
                      cancelText="No"
                    >
                      <div className="flex items-center gap-2 py-1">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                    </Popconfirm>
                  ),
                })),
              }}
              trigger={['click']}
            >
              <Button
                loading={bulkActionLoading}
                className="rounded-xl"
              >
                <Space>
                  Bulk Actions ({selectedRowKeys.length})
                  <MoreOutlined />
                </Space>
              </Button>
            </Dropdown>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
            className="rounded-xl"
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            className="rounded-xl shadow-lg shadow-primary/20"
          >
            Export
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-sm">
            <Statistic
              title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Total Internships</Text>}
              value={stats.total}
              prefix={<ShopOutlined className="text-primary mr-2" />}
              valueStyle={{ color: 'var(--ant-primary-color)', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-sm">
            <Statistic
              title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Ongoing</Text>}
              value={stats.ongoing}
              prefix={<RiseOutlined className="text-success mr-2" />}
              valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-sm">
            <Statistic
              title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Completed</Text>}
              value={stats.completed}
              prefix={<CheckCircleOutlined className="text-blue-500 mr-2" />}
              valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-sm">
            <Statistic
              title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Companies</Text>}
              value={stats.uniqueCompanies}
              prefix={<BankOutlined className="text-purple-500 mr-2" />}
              valueStyle={{ color: '#9333ea', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card className="rounded-2xl border-border shadow-sm">
        <div className="flex flex-wrap gap-4 items-center">
          <Input
            placeholder="Search by student, company, or role..."
            prefix={<SearchOutlined className="text-text-tertiary" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full md:w-72 rounded-lg"
            allowClear
          />
          <Select
            value={filters.status}
            onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            className="w-full md:w-40"
            placeholder="Status"
          >
            <Select.Option value="all">All Status</Select.Option>
            <Select.Option value="APPROVED">Active</Select.Option>
            <Select.Option value="JOINED">Ongoing</Select.Option>
            <Select.Option value="COMPLETED">Completed</Select.Option>
          </Select>
          <RangePicker
            value={filters.dateRange}
            onChange={(dates) => setFilters(prev => ({ ...prev, dateRange: dates }))}
            format="DD/MM/YYYY"
            className="w-full md:w-64"
            placeholder={['Start Date', 'End Date']}
          />
        </div>
      </Card>

      {/* Table */}
      <Card className="rounded-2xl border-border shadow-sm" styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="px-4 pt-4"
        />
        <Table
          columns={columns}
          dataSource={filteredInternships}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          scroll={{ x: 1200 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: filteredInternships.length,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} internships`,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
          }}
          locale={{
            emptyText: (
              <Empty
                description={
                  <div className="text-center py-4">
                    <Text className="text-text-tertiary block mb-2">No internships found</Text>
                    <Text className="text-text-tertiary text-xs">Students will appear here once they submit self-identified internships</Text>
                  </div>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>

      {/* Details Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-text-primary">
            <ShopOutlined className="text-purple-500" />
            <span>Internship Details</span>
            {selectedInternship && (
              <Tag color="purple" className="ml-2 rounded-full">Self-Identified</Tag>
            )}
          </div>
        }
        open={detailsVisible}
        onCancel={() => setDetailsVisible(false)}
        width={800}
        footer={
          <Space>
            <Button onClick={() => setDetailsVisible(false)}>Close</Button>
            {selectedInternship?.joiningLetterUrl && (
              <Button
                type="primary"
                icon={<FilePdfOutlined />}
                onClick={() => window.open(selectedInternship.joiningLetterUrl, '_blank')}
              >
                View Joining Letter
              </Button>
            )}
          </Space>
        }
      >
        {selectedInternship && (
          <div className="space-y-6">
            {/* Status Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar size={48} icon={<UserOutlined />} className="bg-primary/10 text-primary" />
                  <div>
                    <Text className="font-bold text-lg text-text-primary block">{selectedInternship.studentName}</Text>
                    <Text className="text-text-secondary text-sm">{selectedInternship.studentRollNumber}</Text>
                  </div>
                </div>
                <Tag
                  icon={getStatusConfig(selectedInternship.status).icon}
                  color={getStatusConfig(selectedInternship.status).color}
                  className="rounded-full px-4 py-1 text-sm"
                >
                  {getStatusConfig(selectedInternship.status).text}
                </Tag>
              </div>
            </div>

            {/* Company Details */}
            <div>
              <Text className="text-xs uppercase font-bold text-text-tertiary block mb-3">
                <BankOutlined className="mr-1" />
                Company Information
              </Text>
              <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label="Company Name" span={2}>
                  <Text strong>{selectedInternship.companyName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Job Profile">
                  {selectedInternship.jobProfile || 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Stipend">
                  {selectedInternship.stipend ? (
                    <Tag color="green">{selectedInternship.stipend}/month</Tag>
                  ) : (
                    <Tag color="default">Unpaid</Tag>
                  )}
                </Descriptions.Item>
                {selectedInternship.companyAddress && (
                  <Descriptions.Item label="Address" span={2}>
                    <div className="flex items-start gap-1">
                      <EnvironmentOutlined className="text-text-tertiary mt-1" />
                      <span>{selectedInternship.companyAddress}</span>
                    </div>
                  </Descriptions.Item>
                )}
                {selectedInternship.companyContact && (
                  <Descriptions.Item label="Contact">
                    <div className="flex items-center gap-1">
                      <PhoneOutlined className="text-text-tertiary" />
                      <span>{selectedInternship.companyContact}</span>
                    </div>
                  </Descriptions.Item>
                )}
                {selectedInternship.companyEmail && (
                  <Descriptions.Item label="Email">
                    <div className="flex items-center gap-1">
                      <MailOutlined className="text-text-tertiary" />
                      <span>{selectedInternship.companyEmail}</span>
                    </div>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </div>

            {/* Duration Details */}
            <div>
              <Text className="text-xs uppercase font-bold text-text-tertiary block mb-3">
                <CalendarOutlined className="mr-1" />
                Internship Duration
              </Text>
              <Descriptions bordered column={{ xs: 1, sm: 3 }} size="small">
                <Descriptions.Item label="Start Date">
                  {selectedInternship.startDate ? dayjs(selectedInternship.startDate).format('DD MMM YYYY') : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="End Date">
                  {selectedInternship.endDate ? dayjs(selectedInternship.endDate).format('DD MMM YYYY') : 'Ongoing'}
                </Descriptions.Item>
                <Descriptions.Item label="Duration">
                  <Tag color="blue">{selectedInternship.duration || 'N/A'}</Tag>
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* Mentor Details */}
            {selectedInternship.mentorName && (
              <div>
                <Text className="text-xs uppercase font-bold text-text-tertiary block mb-3">
                  <TeamOutlined className="mr-1" />
                  Faculty Mentor
                </Text>
                <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                  <Descriptions.Item label="Name">
                    <Text strong>{selectedInternship.mentorName}</Text>
                  </Descriptions.Item>
                  {selectedInternship.mentorDesignation && (
                    <Descriptions.Item label="Designation">
                      {selectedInternship.mentorDesignation}
                    </Descriptions.Item>
                  )}
                  {selectedInternship.mentorEmail && (
                    <Descriptions.Item label="Email" span={2}>
                      <div className="flex items-center gap-1">
                        <MailOutlined className="text-text-tertiary" />
                        <span>{selectedInternship.mentorEmail}</span>
                      </div>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </div>
            )}

            {/* Student Contact */}
            <div>
              <Text className="text-xs uppercase font-bold text-text-tertiary block mb-3">
                <UserOutlined className="mr-1" />
                Student Contact
              </Text>
              <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                {selectedInternship.studentEmail && (
                  <Descriptions.Item label="Email">
                    <div className="flex items-center gap-1">
                      <MailOutlined className="text-text-tertiary" />
                      <span>{selectedInternship.studentEmail}</span>
                    </div>
                  </Descriptions.Item>
                )}
                {selectedInternship.studentPhone && (
                  <Descriptions.Item label="Phone">
                    <div className="flex items-center gap-1">
                      <PhoneOutlined className="text-text-tertiary" />
                      <span>{selectedInternship.studentPhone}</span>
                    </div>
                  </Descriptions.Item>
                )}
                {selectedInternship.studentBatch && (
                  <Descriptions.Item label="Batch">
                    {selectedInternship.studentBatch}
                  </Descriptions.Item>
                )}
                {selectedInternship.studentDepartment && (
                  <Descriptions.Item label="Department">
                    {selectedInternship.studentDepartment}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
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
          form.resetFields();
        }}
        width={800}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEditSubmit}
          className="mt-4"
        >
          {selectedInternship && (
            <div className="p-3 rounded-lg bg-primary/5 mb-4">
              <div className="flex items-center gap-3">
                <Avatar size={40} icon={<UserOutlined />} className="bg-primary/10 text-primary" />
                <div>
                  <Text className="font-bold text-text-primary block">{selectedInternship.studentName}</Text>
                  <Text className="text-text-secondary text-sm">{selectedInternship.studentRollNumber}</Text>
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
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value.replace(/,/g, '')}
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
                  <Select.Option value="APPLIED">Applied</Select.Option>
                  <Select.Option value="APPROVED">Active</Select.Option>
                  <Select.Option value="JOINED">Joined</Select.Option>
                  <Select.Option value="COMPLETED">Completed</Select.Option>
                  <Select.Option value="REJECTED">Rejected</Select.Option>
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
            <Col xs={24} md={12}>
              <Form.Item name="facultyMentorName" label="Mentor Name">
                <Input placeholder="Enter mentor name" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="facultyMentorDesignation" label="Mentor Designation">
                <Input placeholder="Enter designation" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="facultyMentorEmail" label="Mentor Email">
                <Input placeholder="Enter mentor email" type="email" />
              </Form.Item>
            </Col>
          </Row>

          <Divider className="my-4" />
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => {
                setEditVisible(false);
                form.resetFields();
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
              className="shadow-lg shadow-primary/20"
            >
              Save Changes
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

// Mock data generator for demo
const generateMockData = () => {
  const companies = [
    { name: 'TCS', location: 'Mumbai', industry: 'IT Services' },
    { name: 'Infosys', location: 'Bangalore', industry: 'IT Services' },
    { name: 'Wipro', location: 'Pune', industry: 'IT Services' },
    { name: 'HCL Technologies', location: 'Noida', industry: 'IT Services' },
    { name: 'Tech Mahindra', location: 'Hyderabad', industry: 'IT Services' },
    { name: 'Cognizant', location: 'Chennai', industry: 'IT Services' },
    { name: 'Accenture', location: 'Gurgaon', industry: 'Consulting' },
    { name: 'Capgemini', location: 'Mumbai', industry: 'Consulting' },
  ];

  const roles = ['Software Developer Intern', 'Data Analyst Intern', 'Web Developer Intern', 'ML Engineer Intern', 'QA Intern'];
  const statuses = ['APPROVED', 'JOINED', 'COMPLETED'];
  const names = ['Rahul Kumar', 'Priya Sharma', 'Amit Singh', 'Neha Gupta', 'Vikram Patel', 'Ananya Roy'];

  return Array.from({ length: 12 }, (_, i) => {
    const company = companies[i % companies.length];
    return {
      id: `INT-${1000 + i}`,
      studentId: `STU-${100 + i}`,
      studentName: names[i % names.length],
      studentRollNumber: `2021CS${String(i + 1).padStart(3, '0')}`,
      studentEmail: `student${i + 1}@college.edu`,
      studentBatch: '2021-2025',
      studentDepartment: 'Computer Science',
      companyName: company.name,
      companyAddress: `${company.location}, India`,
      jobProfile: roles[i % roles.length],
      stipend: (i % 3 === 0) ? null : `${10000 + (i * 2500)}`,
      startDate: dayjs().subtract(i * 15, 'day').toISOString(),
      endDate: dayjs().add((6 - i % 4) * 30, 'day').toISOString(),
      duration: `${3 + (i % 4)} months`,
      status: statuses[i % statuses.length],
      mentorName: i % 2 === 0 ? `Dr. Faculty ${i + 1}` : null,
      mentorEmail: i % 2 === 0 ? `faculty${i + 1}@college.edu` : null,
      submittedAt: dayjs().subtract(i * 7, 'day').toISOString(),
      isSelfIdentified: true,
    };
  });
};

export default SelfIdentifiedInternships;
