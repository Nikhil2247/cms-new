import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  DatePicker,
  Select,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Statistic,
  Spin,
  Empty,
  Divider,
  Alert,
  Badge,
  Descriptions,
  Tooltip,
  theme,
} from 'antd';
import {
  AuditOutlined,
  ReloadOutlined,
  DownloadOutlined,
  FilterOutlined,
  InfoCircleOutlined,
  UserOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  WarningOutlined,
  SafetyOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';
import { auditService } from '../../../services/audit.service';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const AuditLogs = () => {
  const { token } = theme.useToken();
  
  const [logs, setLogs] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);

  // Filter states
  const [filters, setFilters] = useState({
    dateRange: null,
    action: undefined,
    entityType: undefined,
    category: undefined,
    page: 1,
    limit: 50,
  });

  // Pagination
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });

  // Severity colors
  const severityColors = {
    LOW: 'success',
    MEDIUM: 'warning',
    HIGH: 'orange',
    CRITICAL: 'error',
  };

  // Severity icons
  const severityIcons = {
    LOW: <CheckCircleOutlined />,
    MEDIUM: <InfoCircleOutlined />,
    HIGH: <WarningOutlined />,
    CRITICAL: <ExclamationCircleOutlined />,
  };

  // Category colors
  const categoryColors = {
    AUTHENTICATION: 'blue',
    PROFILE_MANAGEMENT: 'cyan',
    INTERNSHIP_WORKFLOW: 'purple',
    APPLICATION_PROCESS: 'geekblue',
    FEEDBACK_SYSTEM: 'magenta',
    ADMINISTRATIVE: 'orange',
    SECURITY: 'red',
  };

  // Action types for dropdown
  const actionTypes = [
    'LOGIN',
    'LOGOUT',
    'PASSWORD_CHANGED',
    'PROFILE_CREATED',
    'PROFILE_UPDATED',
    'DOCUMENT_UPLOADED',
    'INTERNSHIP_CREATED',
    'INTERNSHIP_UPDATED',
    'APPLICATION_SUBMITTED',
    'APPLICATION_APPROVED',
    'APPLICATION_REJECTED',
    'FEEDBACK_SUBMITTED',
    'BULK_OPERATION',
    'REPORT_GENERATED',
    'SYSTEM_BACKUP',
    'UNAUTHORIZED_ACCESS',
  ];

  // Entity types for dropdown
  const entityTypes = [
    'User',
    'Student',
    'Faculty',
    'Principal',
    'Institution',
    'Internship',
    'Application',
    'Feedback',
    'Document',
    'Report',
    'System',
  ];

  // Categories for dropdown
  const categories = [
    'AUTHENTICATION',
    'PROFILE_MANAGEMENT',
    'INTERNSHIP_WORKFLOW',
    'APPLICATION_PROCESS',
    'FEEDBACK_SYSTEM',
    'ADMINISTRATIVE',
    'SECURITY',
  ];

  // Fetch audit logs
  const fetchLogs = async (newFilters = filters) => {
    setLoading(true);
    try {
      const params = {
        page: newFilters.page,
        limit: newFilters.limit,
      };

      // Add date range if selected
      if (newFilters.dateRange && newFilters.dateRange.length === 2) {
        params.startDate = newFilters.dateRange[0].startOf('day').toISOString();
        params.endDate = newFilters.dateRange[1].endOf('day').toISOString();
      }

      // Add other filters
      if (newFilters.action) params.action = newFilters.action;
      if (newFilters.entityType) params.entityType = newFilters.entityType;
      if (newFilters.category) params.category = newFilters.category;

      const response = await auditService.getLogs(params);
      setLogs(response.logs || []);
      setPagination({
        current: response.page,
        pageSize: newFilters.limit,
        total: response.total,
      });
      toast.success('Audit logs loaded successfully');
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStatistics = async () => {
    setStatsLoading(true);
    try {
      const params = {};

      // Add date range if selected
      if (filters.dateRange && filters.dateRange.length === 2) {
        params.startDate = filters.dateRange[0].startOf('day').toISOString();
        params.endDate = filters.dateRange[1].endOf('day').toISOString();
      }

      const response = await auditService.getStatistics(params);
      setStatistics(response);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toast.error('Failed to load statistics');
    } finally {
      setStatsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchLogs();
    fetchStatistics();
  }, []);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value, page: 1 };
    setFilters(newFilters);
  };

  // Handle apply filters
  const handleApplyFilters = () => {
    fetchLogs(filters);
    fetchStatistics();
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchLogs();
    fetchStatistics();
  };

  // Handle table change (pagination)
  const handleTableChange = (newPagination) => {
    const newFilters = {
      ...filters,
      page: newPagination.current,
      limit: newPagination.pageSize,
    };
    setFilters(newFilters);
    fetchLogs(newFilters);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      // Prepare CSV headers
      const headers = [
        'Timestamp',
        'User',
        'Action',
        'Entity Type',
        'Entity ID',
        'Category',
        'Severity',
        'Description',
      ];

      // Prepare CSV rows
      const rows = logs.map((log) => [
        dayjs(log.timestamp).format('YYYY-MM-DD HH:mm:ss'),
        log.userName || log.user?.name || 'System',
        log.action,
        log.entityType,
        log.entityId || 'N/A',
        log.category,
        log.severity,
        log.description || 'N/A',
      ]);

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `audit_logs_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Audit logs exported successfully');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export audit logs');
    }
  };

  // Prepare pie chart data for actions
  const actionChartData = useMemo(() => {
    if (!statistics?.actionBreakdown) return [];
    return statistics.actionBreakdown.slice(0, 8).map((item) => ({
      name: item.action.replace(/_/g, ' '),
      value: item.count,
    }));
  }, [statistics]);

  // Prepare pie chart data for categories
  const categoryChartData = useMemo(() => {
    if (!statistics?.categoryBreakdown) return [];
    return statistics.categoryBreakdown.map((item) => ({
      name: item.category.replace(/_/g, ' '),
      value: item.count,
    }));
  }, [statistics]);

  // Chart colors
  const COLORS = [
    token.colorPrimary,
    token.colorSuccess,
    token.colorWarning,
    token.colorError,
    token.colorInfo,
    token.colorLink,
    token.colorPrimaryActive,
    token.colorErrorBg
  ];

  // Table columns
  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp) => (
        <div>
          <div>{dayjs(timestamp).format('MMM DD, YYYY')}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            <ClockCircleOutlined /> {dayjs(timestamp).format('HH:mm:ss')}
          </Text>
          <div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              ({dayjs(timestamp).fromNow()})
            </Text>
          </div>
        </div>
      ),
      sorter: (a, b) => dayjs(a.timestamp).unix() - dayjs(b.timestamp).unix(),
    },
    {
      title: 'User',
      key: 'user',
      width: 200,
      render: (_, record) => (
        <div>
          <div>
            <UserOutlined /> {record.userName || record.user?.name || 'System'}
          </div>
          {record.user?.email && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.user.email}
            </Text>
          )}
          {record.userRole && (
            <div>
              <Tag color="blue" style={{ fontSize: '11px', marginTop: 4 }}>
                {record.userRole.replace(/_/g, ' ')}
              </Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 200,
      render: (action) => (
        <Tag color="processing" style={{ fontSize: '12px' }}>
          {action.replace(/_/g, ' ')}
        </Tag>
      ),
      filters: actionTypes.map((action) => ({ text: action.replace(/_/g, ' '), value: action })),
      onFilter: (value, record) => record.action === value,
    },
    {
      title: 'Entity Type',
      dataIndex: 'entityType',
      key: 'entityType',
      width: 150,
      render: (entityType) => (
        <Text>
          <FileTextOutlined /> {entityType}
        </Text>
      ),
      filters: entityTypes.map((type) => ({ text: type, value: type })),
      onFilter: (value, record) => record.entityType === value,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 180,
      render: (category) => (
        <Tag color={categoryColors[category]} style={{ fontSize: '12px' }}>
          {category.replace(/_/g, ' ')}
        </Tag>
      ),
      filters: categories.map((cat) => ({ text: cat.replace(/_/g, ' '), value: cat })),
      onFilter: (value, record) => record.category === value,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      align: 'center',
      render: (severity) => (
        <Badge
          status={severityColors[severity] === 'success' ? 'success' : severityColors[severity] === 'error' ? 'error' : 'warning'}
          text={
            <Tag color={severityColors[severity]} icon={severityIcons[severity]} style={{ fontSize: '12px' }}>
              {severity}
            </Tag>
          }
        />
      ),
      sorter: (a, b) => {
        const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      },
    },
  ];

  // Expanded row render
  const expandedRowRender = (record) => {
    return (
      <div style={{ padding: '16px', borderRadius: '4px' }} className="bg-surface-50">
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Entity ID" span={1}>
            {record.entityId || 'N/A'}
          </Descriptions.Item>
          <Descriptions.Item label="IP Address" span={1}>
            {record.ipAddress || 'N/A'}
          </Descriptions.Item>
          <Descriptions.Item label="Description" span={2}>
            {record.description || 'No description available'}
          </Descriptions.Item>

          {record.changedFields && record.changedFields.length > 0 && (
            <Descriptions.Item label="Changed Fields" span={2}>
              {record.changedFields.map((field, idx) => (
                <Tag key={idx} color="blue" style={{ marginBottom: 4 }}>
                  {field}
                </Tag>
              ))}
            </Descriptions.Item>
          )}

          {record.oldValues && (
            <Descriptions.Item label="Old Values" span={2}>
              <pre style={{ margin: 0, fontSize: '12px', maxHeight: '200px', overflow: 'auto' }}>
                {JSON.stringify(record.oldValues, null, 2)}
              </pre>
            </Descriptions.Item>
          )}

          {record.newValues && (
            <Descriptions.Item label="New Values" span={2}>
              <pre style={{ margin: 0, fontSize: '12px', maxHeight: '200px', overflow: 'auto' }}>
                {JSON.stringify(record.newValues, null, 2)}
              </pre>
            </Descriptions.Item>
          )}
        </Descriptions>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>
          <AuditOutlined /> Audit Logs
        </Title>
          <Text type="secondary">
            Track and monitor all system activities, user actions, data changes, and security events
          </Text>
        </div>

        {/* Statistics Cards */}
        <Spin spinning={statsLoading}>
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Total Logs"
                  value={statistics?.totalLogs || 0}
                  prefix={<AuditOutlined />}
                  className="text-primary-500"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Unique Actions"
                  value={statistics?.actionBreakdown?.length || 0}
                  prefix={<CheckCircleOutlined />}
                  className="text-success-500"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Entity Types"
                  value={statistics?.entityTypeBreakdown?.length || 0}
                  prefix={<FileTextOutlined />}
                  className="text-purple-600"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Active Users"
                  value={statistics?.userActivityBreakdown?.length || 0}
                  prefix={<UserOutlined />}
                  className="text-orange-500"
                />
              </Card>
            </Col>
          </Row>
        </Spin>

        {/* Charts */}
        {statistics && (
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col xs={24} lg={12}>
              <Card title="Action Breakdown" extra={<SafetyOutlined />}>
                {actionChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={actionChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {actionChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="No action data available" />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Category Breakdown" extra={<InfoCircleOutlined />}>
                {categoryChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty description="No category data available" />
                )}
              </Card>
            </Col>
          </Row>
        )}

        {/* Filters Card */}
        <Card style={{ marginBottom: '24px' }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={12} md={8}>
              <Text strong>Date Range:</Text>
              <RangePicker
                style={{ width: '100%', marginTop: 8 }}
                value={filters.dateRange}
                onChange={(dates) => handleFilterChange('dateRange', dates)}
                format="YYYY-MM-DD"
              />
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Text strong>Action:</Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                placeholder="Select action"
                allowClear
                value={filters.action}
                onChange={(value) => handleFilterChange('action', value)}
              >
                {actionTypes.map((action) => (
                  <Option key={action} value={action}>
                    {action.replace(/_/g, ' ')}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Text strong>Entity Type:</Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                placeholder="Select entity"
                allowClear
                value={filters.entityType}
                onChange={(value) => handleFilterChange('entityType', value)}
              >
                {entityTypes.map((type) => (
                  <Option key={type} value={type}>
                    {type}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Text strong>Category:</Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                placeholder="Select category"
                allowClear
                value={filters.category}
                onChange={(value) => handleFilterChange('category', value)}
              >
                {categories.map((cat) => (
                  <Option key={cat} value={cat}>
                    {cat.replace(/_/g, ' ')}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <div style={{ marginTop: 24 }}>
                <Space>
                  <Button
                    type="primary"
                    icon={<FilterOutlined />}
                    onClick={handleApplyFilters}
                  >
                    Apply
                  </Button>
                </Space>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Main Content Card */}
        <Card>
          {/* Toolbar */}
          <Row gutter={16} style={{ marginBottom: '16px' }} align="middle" justify="space-between">
            <Col>
              <Title level={4} style={{ margin: 0 }}>
                Audit Log Entries
              </Title>
            </Col>
            <Col>
              <Space wrap>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleRefresh}
                  loading={loading}
                >
                  Refresh
                </Button>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleExportCSV}
                  disabled={logs.length === 0}
                >
                  Export CSV
                </Button>
              </Space>
            </Col>
          </Row>

          <Divider style={{ margin: '16px 0' }} />

          {/* Alert for active filters */}
          {(filters.dateRange || filters.action || filters.entityType || filters.category) && (
            <Alert
              title="Active Filters"
              description={
                <Space wrap>
                  {filters.dateRange && (
                    <Tag closable onClose={() => handleFilterChange('dateRange', null)}>
                      Date: {filters.dateRange[0].format('YYYY-MM-DD')} to {filters.dateRange[1].format('YYYY-MM-DD')}
                    </Tag>
                  )}
                  {filters.action && (
                    <Tag closable onClose={() => handleFilterChange('action', undefined)}>
                      Action: {filters.action.replace(/_/g, ' ')}
                    </Tag>
                  )}
                  {filters.entityType && (
                    <Tag closable onClose={() => handleFilterChange('entityType', undefined)}>
                      Entity: {filters.entityType}
                    </Tag>
                  )}
                  {filters.category && (
                    <Tag closable onClose={() => handleFilterChange('category', undefined)}>
                      Category: {filters.category.replace(/_/g, ' ')}
                    </Tag>
                  )}
                </Space>
              }
              type="info"
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}

          {/* Table */}
          <Table
            columns={columns}
            dataSource={logs}
            rowKey="id"
            loading={loading}
            scroll={{ x: 'max-content' }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ['10', '25', '50', '100'],
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} logs`,
            }}
            onChange={handleTableChange}
            expandable={{
              expandedRowRender,
              expandedRowKeys,
              onExpandedRowsChange: setExpandedRowKeys,
              expandIcon: ({ expanded, onExpand, record }) => (
                <Tooltip title={expanded ? 'Collapse' : 'Expand details'}>
                  <Button
                    type="link"
                    size="small"
                    icon={<InfoCircleOutlined />}
                    onClick={(e) => onExpand(record, e)}
                  />
                </Tooltip>
              ),
            }}
          />
        </Card>
    </div>
  );
};

export default AuditLogs;