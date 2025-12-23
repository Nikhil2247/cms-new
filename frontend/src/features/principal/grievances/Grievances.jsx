import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Input,
  Modal,
  Form,
  Select,
  DatePicker,
  Tabs,
  Row,
  Col,
  Statistic,
  Badge,
  Avatar,
  Empty,
  Spin,
  Timeline,
  Tooltip,
  Descriptions,
  Divider,
  Alert,
  Progress,
} from 'antd';
import {
  AlertOutlined,
  SearchOutlined,
  PlusOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  ReloadOutlined,
  MessageOutlined,
  FileTextOutlined,
  SendOutlined,
  HistoryOutlined,
  FilterOutlined,
  TeamOutlined,
  BookOutlined,
  SafetyOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { debounce } from 'lodash';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const Grievances = () => {
  const [loading, setLoading] = useState(true);
  const [grievances, setGrievances] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    rejected: 0,
  });
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [respondVisible, setRespondVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    priority: 'all',
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [form] = Form.useForm();

  // Fetch grievances
  const fetchGrievances = useCallback(async () => {
    try {
      setLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));

      // Mock data
      const mockGrievances = generateMockGrievances();
      setGrievances(mockGrievances);

      // Calculate stats
      const newStats = {
        total: mockGrievances.length,
        pending: mockGrievances.filter(g => g.status === 'PENDING').length,
        inProgress: mockGrievances.filter(g => g.status === 'IN_PROGRESS').length,
        resolved: mockGrievances.filter(g => g.status === 'RESOLVED').length,
        rejected: mockGrievances.filter(g => g.status === 'REJECTED').length,
      };
      setStats(newStats);
      setPagination(prev => ({ ...prev, total: mockGrievances.length }));
    } catch (error) {
      console.error('Failed to fetch grievances:', error);
      toast.error('Failed to load grievances');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGrievances();
  }, [fetchGrievances]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((value) => {
      setSearchText(value);
    }, 300),
    []
  );

  // Filter grievances
  const filteredGrievances = useMemo(() => {
    let filtered = [...grievances];

    // Tab filter
    if (activeTab !== 'all') {
      filtered = filtered.filter(g => g.status === activeTab.toUpperCase());
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(g => g.status === filters.status);
    }

    // Category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(g => g.category === filters.category);
    }

    // Priority filter
    if (filters.priority !== 'all') {
      filtered = filtered.filter(g => g.priority === filters.priority);
    }

    // Search filter
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        g =>
          g.subject.toLowerCase().includes(search) ||
          g.submittedBy.name.toLowerCase().includes(search) ||
          g.ticketNumber.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [grievances, activeTab, filters, searchText]);

  // Status helpers
  const getStatusConfig = (status) => {
    const configs = {
      PENDING: { color: 'warning', icon: <ClockCircleOutlined />, text: 'Pending' },
      IN_PROGRESS: { color: 'processing', icon: <ExclamationCircleOutlined />, text: 'In Progress' },
      RESOLVED: { color: 'success', icon: <CheckCircleOutlined />, text: 'Resolved' },
      REJECTED: { color: 'error', icon: <CloseCircleOutlined />, text: 'Rejected' },
    };
    return configs[status] || configs.PENDING;
  };

  const getPriorityConfig = (priority) => {
    const configs = {
      LOW: { color: 'default', text: 'Low' },
      MEDIUM: { color: 'warning', text: 'Medium' },
      HIGH: { color: 'error', text: 'High' },
      URGENT: { color: 'magenta', text: 'Urgent' },
    };
    return configs[priority] || configs.MEDIUM;
  };

  const getCategoryIcon = (category) => {
    const icons = {
      ACADEMIC: <BookOutlined className="text-primary" />,
      INTERNSHIP: <TeamOutlined className="text-success" />,
      FACULTY: <UserOutlined className="text-warning" />,
      INFRASTRUCTURE: <SafetyOutlined className="text-error" />,
      OTHER: <InfoCircleOutlined className="text-text-tertiary" />,
    };
    return icons[category] || icons.OTHER;
  };

  // Handle actions
  const handleViewDetails = (grievance) => {
    setSelectedGrievance(grievance);
    setDetailsVisible(true);
  };

  const handleRespond = (grievance) => {
    setSelectedGrievance(grievance);
    form.resetFields();
    setRespondVisible(true);
  };

  const handleSubmitResponse = async (values) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Response submitted successfully');
      setRespondVisible(false);
      fetchGrievances();
    } catch (error) {
      toast.error('Failed to submit response');
    }
  };

  const handleUpdateStatus = async (grievanceId, newStatus) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success(`Grievance marked as ${newStatus.toLowerCase().replace('_', ' ')}`);
      setDetailsVisible(false);
      fetchGrievances();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleRefresh = () => {
    fetchGrievances();
  };

  // Table columns
  const columns = [
    {
      title: 'Ticket',
      key: 'ticket',
      width: 120,
      render: (_, record) => (
        <div>
          <Text className="font-mono font-bold text-primary text-sm">{record.ticketNumber}</Text>
          <div className="text-[10px] text-text-tertiary uppercase">
            {dayjs(record.createdAt).format('DD MMM YYYY')}
          </div>
        </div>
      ),
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
      render: (text, record) => (
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-lg bg-background-tertiary flex items-center justify-center shrink-0">
            {getCategoryIcon(record.category)}
          </div>
          <div className="min-w-0">
            <Tooltip title={text}>
              <Text className="block font-medium text-text-primary truncate">{text}</Text>
            </Tooltip>
            <Tag color="default" className="text-[10px] mt-1">
              {record.category.replace('_', ' ')}
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'Submitted By',
      key: 'submittedBy',
      width: 180,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <Avatar size="small" icon={<UserOutlined />} className="bg-primary/10 text-primary" />
          <div>
            <Text className="block text-sm font-medium text-text-primary">{record.submittedBy.name}</Text>
            <Text className="text-[10px] text-text-tertiary uppercase">
              {record.submittedBy.role}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority) => {
        const config = getPriorityConfig(priority);
        return <Tag color={config.color} className="rounded-full px-3">{config.text}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
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
      title: 'Age',
      key: 'age',
      width: 100,
      render: (_, record) => (
        <Tooltip title={dayjs(record.createdAt).format('DD MMM YYYY HH:mm')}>
          <Text className="text-sm text-text-secondary">
            {dayjs(record.createdAt).fromNow()}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
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
          {record.status !== 'RESOLVED' && record.status !== 'REJECTED' && (
            <Tooltip title="Respond">
              <Button
                type="text"
                icon={<MessageOutlined />}
                onClick={() => handleRespond(record)}
                className="text-success hover:bg-success/10"
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // Stat cards
  const StatCard = ({ title, value, icon, color, percentage }) => (
    <Card className="rounded-2xl border-border shadow-sm hover:shadow-md transition-all h-full">
      <div className="flex items-start justify-between">
        <div>
          <Text className="text-[10px] uppercase font-bold tracking-wider text-text-tertiary block mb-1">
            {title}
          </Text>
          <Text className="text-3xl font-bold" style={{ color }}>{value}</Text>
          {percentage !== undefined && (
            <div className="mt-2">
              <Progress
                percent={percentage}
                size="small"
                strokeColor={color}
                showInfo={false}
              />
            </div>
          )}
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          {React.cloneElement(icon, { className: 'text-xl', style: { color } })}
        </div>
      </div>
    </Card>
  );

  // Tab items
  const tabItems = [
    { key: 'all', label: <span className="flex items-center gap-2"><AlertOutlined />All ({stats.total})</span> },
    { key: 'pending', label: <span className="flex items-center gap-2"><ClockCircleOutlined />Pending ({stats.pending})</span> },
    { key: 'in_progress', label: <span className="flex items-center gap-2"><ExclamationCircleOutlined />In Progress ({stats.inProgress})</span> },
    { key: 'resolved', label: <span className="flex items-center gap-2"><CheckCircleOutlined />Resolved ({stats.resolved})</span> },
  ];

  if (loading && grievances.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px] gap-4">
        <Spin size="large" />
        <Text className="text-text-secondary animate-pulse">Loading grievances...</Text>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Title level={2} className="!mb-2 !text-text-primary">
            Grievance Management
          </Title>
          <Text className="text-text-secondary text-base">
            Track and resolve student and faculty grievances
          </Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
            className="rounded-xl"
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Total Grievances"
            value={stats.total}
            icon={<AlertOutlined />}
            color="#1890ff"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Pending"
            value={stats.pending}
            icon={<ClockCircleOutlined />}
            color="#faad14"
            percentage={stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="In Progress"
            value={stats.inProgress}
            icon={<ExclamationCircleOutlined />}
            color="#722ed1"
            percentage={stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Resolved"
            value={stats.resolved}
            icon={<CheckCircleOutlined />}
            color="#52c41a"
            percentage={stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0}
          />
        </Col>
      </Row>

      {/* Alert for high priority */}
      {stats.pending > 5 && (
        <Alert
          message="Attention Required"
          description={`You have ${stats.pending} pending grievances. Please review and respond promptly.`}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          className="rounded-xl"
        />
      )}

      {/* Filters */}
      <Card className="rounded-2xl border-border shadow-sm">
        <div className="flex flex-wrap gap-4 items-center">
          <Input
            placeholder="Search by ticket, subject, or name..."
            prefix={<SearchOutlined className="text-text-tertiary" />}
            onChange={(e) => debouncedSearch(e.target.value)}
            className="w-full md:w-72 rounded-lg"
            allowClear
          />
          <Select
            value={filters.category}
            onChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
            className="w-full md:w-40"
            placeholder="Category"
          >
            <Select.Option value="all">All Categories</Select.Option>
            <Select.Option value="ACADEMIC">Academic</Select.Option>
            <Select.Option value="INTERNSHIP">Internship</Select.Option>
            <Select.Option value="FACULTY">Faculty</Select.Option>
            <Select.Option value="INFRASTRUCTURE">Infrastructure</Select.Option>
            <Select.Option value="OTHER">Other</Select.Option>
          </Select>
          <Select
            value={filters.priority}
            onChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}
            className="w-full md:w-36"
            placeholder="Priority"
          >
            <Select.Option value="all">All Priority</Select.Option>
            <Select.Option value="LOW">Low</Select.Option>
            <Select.Option value="MEDIUM">Medium</Select.Option>
            <Select.Option value="HIGH">High</Select.Option>
            <Select.Option value="URGENT">Urgent</Select.Option>
          </Select>
        </div>
      </Card>

      {/* Tabs & Table */}
      <Card className="rounded-2xl border-border shadow-sm" styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="px-4 pt-4"
        />
        <Table
          columns={columns}
          dataSource={filteredGrievances}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: filteredGrievances.length,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} grievances`,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
          }}
          locale={{
            emptyText: <Empty description="No grievances found" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          }}
          className="custom-table"
        />
      </Card>

      {/* Details Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-text-primary">
            <FileTextOutlined className="text-primary" />
            <span>Grievance Details</span>
            {selectedGrievance && (
              <Tag color="blue" className="ml-2">{selectedGrievance.ticketNumber}</Tag>
            )}
          </div>
        }
        open={detailsVisible}
        onCancel={() => setDetailsVisible(false)}
        width={800}
        footer={
          selectedGrievance && selectedGrievance.status !== 'RESOLVED' && selectedGrievance.status !== 'REJECTED' ? (
            <Space>
              <Button onClick={() => setDetailsVisible(false)}>Close</Button>
              <Button
                danger
                onClick={() => handleUpdateStatus(selectedGrievance.id, 'REJECTED')}
              >
                Reject
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleUpdateStatus(selectedGrievance.id, 'RESOLVED')}
              >
                Mark as Resolved
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedGrievance && (
          <div className="space-y-6">
            {/* Status Banner */}
            <div className={`p-4 rounded-xl ${
              selectedGrievance.status === 'RESOLVED' ? 'bg-success/10' :
              selectedGrievance.status === 'REJECTED' ? 'bg-error/10' :
              selectedGrievance.status === 'IN_PROGRESS' ? 'bg-primary/10' : 'bg-warning/10'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusConfig(selectedGrievance.status).icon}
                  <Text className="font-semibold">
                    Status: {getStatusConfig(selectedGrievance.status).text}
                  </Text>
                </div>
                <Tag color={getPriorityConfig(selectedGrievance.priority).color}>
                  {getPriorityConfig(selectedGrievance.priority).text} Priority
                </Tag>
              </div>
            </div>

            {/* Details */}
            <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
              <Descriptions.Item label="Subject" span={2}>
                <Text strong>{selectedGrievance.subject}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(selectedGrievance.category)}
                  <span>{selectedGrievance.category.replace('_', ' ')}</span>
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Submitted On">
                {dayjs(selectedGrievance.createdAt).format('DD MMM YYYY HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Submitted By" span={2}>
                <div className="flex items-center gap-2">
                  <Avatar size="small" icon={<UserOutlined />} className="bg-primary/10 text-primary" />
                  <div>
                    <Text className="font-medium">{selectedGrievance.submittedBy.name}</Text>
                    <Text className="text-text-tertiary text-xs ml-2">
                      ({selectedGrievance.submittedBy.role})
                    </Text>
                  </div>
                </div>
              </Descriptions.Item>
            </Descriptions>

            {/* Description */}
            <div>
              <Text className="text-xs uppercase font-bold text-text-tertiary block mb-2">
                Description
              </Text>
              <div className="p-4 bg-background-tertiary/50 rounded-xl">
                <Paragraph className="!mb-0 text-text-primary whitespace-pre-wrap">
                  {selectedGrievance.description}
                </Paragraph>
              </div>
            </div>

            {/* Response History */}
            {selectedGrievance.responses && selectedGrievance.responses.length > 0 && (
              <div>
                <Text className="text-xs uppercase font-bold text-text-tertiary block mb-3">
                  <HistoryOutlined className="mr-1" />
                  Response History
                </Text>
                <Timeline
                  items={selectedGrievance.responses.map((response, idx) => ({
                    color: response.type === 'RESPONSE' ? 'blue' : 'green',
                    children: (
                      <div className="bg-background rounded-xl p-3 border border-border/50">
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar size="small" icon={<UserOutlined />} className="bg-success/10 text-success" />
                          <Text className="font-medium">{response.by}</Text>
                          <Text className="text-xs text-text-tertiary">
                            {dayjs(response.date).format('DD MMM YYYY HH:mm')}
                          </Text>
                        </div>
                        <Paragraph className="!mb-0 text-text-secondary text-sm">
                          {response.message}
                        </Paragraph>
                      </div>
                    ),
                  }))}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Respond Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-text-primary">
            <MessageOutlined className="text-success" />
            <span>Respond to Grievance</span>
          </div>
        }
        open={respondVisible}
        onCancel={() => setRespondVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitResponse}
        >
          {selectedGrievance && (
            <div className="mb-4 p-3 bg-background-tertiary/50 rounded-xl">
              <Text className="text-xs uppercase font-bold text-text-tertiary block mb-1">
                Ticket: {selectedGrievance.ticketNumber}
              </Text>
              <Text className="font-medium text-text-primary">{selectedGrievance.subject}</Text>
            </div>
          )}

          <Form.Item
            name="status"
            label="Update Status"
            rules={[{ required: true, message: 'Please select a status' }]}
          >
            <Select placeholder="Select new status">
              <Select.Option value="IN_PROGRESS">In Progress</Select.Option>
              <Select.Option value="RESOLVED">Resolved</Select.Option>
              <Select.Option value="REJECTED">Rejected</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="response"
            label="Response Message"
            rules={[{ required: true, message: 'Please enter your response' }]}
          >
            <TextArea
              rows={4}
              placeholder="Enter your response to the grievance..."
              className="rounded-xl"
            />
          </Form.Item>

          <Form.Item className="!mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setRespondVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" icon={<SendOutlined />}>
                Submit Response
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// Mock data generator
const generateMockGrievances = () => {
  const categories = ['ACADEMIC', 'INTERNSHIP', 'FACULTY', 'INFRASTRUCTURE', 'OTHER'];
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const statuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];
  const roles = ['STUDENT', 'FACULTY'];

  const subjects = [
    'Delay in internship approval',
    'Faculty not responding to queries',
    'Issues with report submission portal',
    'Mentor assignment pending',
    'Incorrect marks recorded',
    'Infrastructure issues in lab',
    'Hostel facility problems',
    'Library access issues',
    'Certificate delay',
    'Attendance discrepancy',
  ];

  const descriptions = [
    'I have been waiting for my internship approval for over 2 weeks. The application was submitted on time but there has been no response from the concerned department.',
    'Multiple emails sent to the faculty supervisor but no response received. This is affecting my project progress.',
    'The report submission portal shows errors when trying to upload files larger than 5MB. This needs to be fixed urgently.',
    'Despite multiple requests, no mentor has been assigned yet. Other students from my batch already have mentors.',
    'My internal assessment marks are incorrectly recorded in the system. The actual marks are different from what is shown.',
  ];

  const names = [
    'Rahul Kumar', 'Priya Sharma', 'Amit Singh', 'Neha Gupta', 'Vikram Patel',
    'Ananya Roy', 'Rohit Verma', 'Sneha Joshi', 'Karthik Nair', 'Pooja Reddy'
  ];

  return Array.from({ length: 15 }, (_, index) => ({
    id: `GRV-${1000 + index}`,
    ticketNumber: `GRV-${1000 + index}`,
    subject: subjects[index % subjects.length],
    description: descriptions[index % descriptions.length],
    category: categories[index % categories.length],
    priority: priorities[index % priorities.length],
    status: statuses[index % statuses.length],
    submittedBy: {
      id: `USR-${100 + index}`,
      name: names[index % names.length],
      role: roles[index % roles.length],
      email: `${names[index % names.length].toLowerCase().replace(' ', '.')}@example.com`,
    },
    createdAt: dayjs().subtract(index, 'day').subtract(Math.random() * 10, 'hour').toISOString(),
    updatedAt: dayjs().subtract(index - 1, 'day').toISOString(),
    responses: index % 3 === 0 ? [
      {
        type: 'RESPONSE',
        by: 'Admin User',
        date: dayjs().subtract(index - 1, 'day').toISOString(),
        message: 'We have received your grievance and are looking into it. Please allow us some time to resolve this.',
      },
    ] : [],
  }));
};

export default Grievances;
