import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Select,
  DatePicker,
  Space,
  Typography,
  Input,
  Modal,
  Descriptions,
  Rate,
  Statistic,
  Row,
  Col,
  Calendar,
  Badge,
  Empty,
  Spin,
  Tooltip,
} from 'antd';
import {
  EyeOutlined,
  DownloadOutlined,
  SearchOutlined,
  CalendarOutlined,
  FileTextOutlined,
  StarOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';
import analyticsService from '../../../services/analytics.service';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const FacultyReports = () => {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [facultyList, setFacultyList] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [dateRange, setDateRange] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const fetchFacultyReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
      };

      if (selectedFaculty !== 'all') {
        params.facultyId = selectedFaculty;
      }

      if (dateRange && dateRange.length === 2 && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }

      const response = await analyticsService.getFacultyReports(params);
      const data = response.data || response;

      setReports(data.reports || []);
      setStats(data.stats || { totalVisits: 0, avgRating: 0, visitsThisMonth: 0 });
      if (data.facultyList) {
        setFacultyList(data.facultyList);
      }
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || data.reports?.length || 0,
      }));
    } catch (error) {
      console.error('Failed to fetch faculty reports:', error);
      toast.error('Failed to load faculty reports');
      setReports([]);
      setStats({ totalVisits: 0, avgRating: 0, visitsThisMonth: 0 });
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, selectedFaculty, dateRange]);

  useEffect(() => {
    fetchFacultyReports();
  }, [fetchFacultyReports]);

  useEffect(() => {
    applyFilters();
  }, [reports, selectedStatus, searchText]);

  const applyFilters = () => {
    let filtered = [...reports];

    if (selectedStatus !== 'all') {
      filtered = filtered.filter((r) => r.status === selectedStatus);
    }

    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.facultyName?.toLowerCase().includes(search) ||
          r.studentName?.toLowerCase().includes(search) ||
          r.studentRollNumber?.toLowerCase().includes(search)
      );
    }

    setFilteredReports(filtered);
  };

  const handleRefresh = () => {
    fetchFacultyReports();
  };

  const handleTableChange = (paginationConfig) => {
    setPagination({
      ...pagination,
      current: paginationConfig.current,
      pageSize: paginationConfig.pageSize,
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      Pending: 'warning',
      Approved: 'success',
      Rejected: 'error',
      'Under Review': 'processing',
    };
    return colors[status] || 'default';
  };

  const getVisitTypeColor = (type) => {
    const colors = {
      'In-Person': 'blue',
      Virtual: 'purple',
      Phone: 'cyan',
    };
    return colors[type] || 'default';
  };

  const handleViewDetails = (report) => {
    setSelectedReport(report);
    setDetailsVisible(true);
  };

  const handleDownloadReport = (report) => {
    toast.success(`Downloading report for ${report.studentName}`);
  };

  const columns = [
    {
      title: 'Faculty Name',
      dataIndex: 'facultyName',
      key: 'facultyName',
      width: 150,
      render: (text) => (
        <div className="flex items-center gap-2">
          <TeamOutlined className="text-primary-500" />
          <span className="font-medium">{text}</span>
        </div>
      ),
    },
    {
      title: 'Student',
      key: 'student',
      width: 180,
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.studentName}</div>
          {record.studentRollNumber && (
            <div className="text-xs text-surface-400">{record.studentRollNumber}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Visit Date',
      dataIndex: 'visitDate',
      key: 'visitDate',
      width: 120,
      render: (date) => dayjs(date).format('DD/MM/YYYY'),
      sorter: (a, b) => dayjs(a.visitDate).unix() - dayjs(b.visitDate).unix(),
    },
    {
      title: 'Visit Type',
      dataIndex: 'visitType',
      key: 'visitType',
      width: 120,
      render: (type) => <Tag color={getVisitTypeColor(type)}>{type}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    {
      title: 'Rating',
      dataIndex: 'rating',
      key: 'rating',
      width: 150,
      render: (rating) => (
        <div className="flex items-center gap-2">
          <Rate disabled value={rating} style={{ fontSize: 14 }} />
          <Text className="text-sm">({rating})</Text>
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 100,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>
          <Tooltip title="Download Report">
            <Button
              type="text"
              icon={<DownloadOutlined />}
              onClick={() => handleDownloadReport(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const getListData = (value) => {
    const dateStr = value.format('YYYY-MM-DD');
    return filteredReports
      .filter((r) => dayjs(r.visitDate).format('YYYY-MM-DD') === dateStr)
      .map((r) => ({
        type: r.status === 'Approved' ? 'success' : 'warning',
        content: `${r.facultyName} - ${r.studentName}`,
      }));
  };

  const dateCellRender = (value) => {
    const listData = getListData(value);
    return (
      <ul className="list-none p-0 m-0">
        {listData.map((item, index) => (
          <li key={index}>
            <Badge status={item.type} text={item.content} className="text-xs" />
          </li>
        ))}
      </ul>
    );
  };

  if (loading && reports.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px] gap-4">
        <Spin size="large" />
        <Text className="text-surface-500">Loading faculty reports...</Text>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Title level={2} className="!mb-2">
            Faculty Visit Reports
          </Title>
          <Text className="text-surface-500">
            Monitor and review faculty visit reports and student interactions
          </Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
          >
            Refresh
          </Button>
          <Button
            icon={viewMode === 'table' ? <CalendarOutlined /> : <FileTextOutlined />}
            onClick={() => setViewMode(viewMode === 'table' ? 'calendar' : 'table')}
          >
            {viewMode === 'table' ? 'Calendar View' : 'Table View'}
          </Button>
          <Button type="primary" icon={<DownloadOutlined />}>
            Export All
          </Button>
        </Space>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="border-0 shadow-soft">
            <Statistic
              title="Total Visits"
              value={stats?.totalVisits || 0}
              prefix={<CheckCircleOutlined className="text-primary-500" />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="border-0 shadow-soft">
            <Statistic
              title="Average Rating"
              value={stats?.avgRating || 0}
              precision={1}
              prefix={<StarOutlined className="text-amber-500" />}
              suffix="/ 5"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="border-0 shadow-soft">
            <Statistic
              title="Visits This Month"
              value={stats?.visitsThisMonth || 0}
              prefix={<CalendarOutlined className="text-emerald-500" />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card className="border-0 shadow-soft">
        <Space size="middle" wrap className="w-full">
          <Input
            placeholder="Search faculty or student..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-64"
            allowClear
          />
          <Select
            value={selectedFaculty}
            onChange={(value) => {
              setSelectedFaculty(value);
              setPagination(prev => ({ ...prev, current: 1 }));
            }}
            className="w-48"
            placeholder="Filter by Faculty"
          >
            <Option value="all">All Faculty</Option>
            {facultyList.map((faculty) => (
              <Option key={faculty.id} value={faculty.id}>
                {faculty.name}
              </Option>
            ))}
          </Select>
          <Select
            value={selectedStatus}
            onChange={setSelectedStatus}
            className="w-48"
            placeholder="Filter by Status"
          >
            <Option value="all">All Status</Option>
            <Option value="Pending">Pending</Option>
            <Option value="Approved">Approved</Option>
            <Option value="Rejected">Rejected</Option>
            <Option value="Under Review">Under Review</Option>
          </Select>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              setDateRange(dates);
              setPagination(prev => ({ ...prev, current: 1 }));
            }}
            format="DD/MM/YYYY"
            className="w-64"
          />
        </Space>
      </Card>

      {/* Content - Table or Calendar View */}
      {viewMode === 'table' ? (
        <Card className="border-0 shadow-soft">
          <Table
            columns={columns}
            dataSource={filteredReports}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1000 }}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} reports`,
            }}
            onChange={handleTableChange}
            locale={{
              emptyText: <Empty description="No reports found" />,
            }}
          />
        </Card>
      ) : (
        <Card className="border-0 shadow-soft">
          <Calendar cellRender={(current, info) => {
            if (info.type === 'date') {
              return dateCellRender(current);
            }
            return info.originNode;
          }} />
        </Card>
      )}

      {/* Details Modal */}
      <Modal
        title="Visit Report Details"
        open={detailsVisible}
        onCancel={() => setDetailsVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailsVisible(false)}>
            Close
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadReport(selectedReport)}
          >
            Download PDF
          </Button>,
        ]}
        width={700}
      >
        {selectedReport && (
          <div className="space-y-4">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="Faculty Name" span={2}>
                {selectedReport.facultyName}
              </Descriptions.Item>
              <Descriptions.Item label="Student Name">
                {selectedReport.studentName}
              </Descriptions.Item>
              <Descriptions.Item label="Roll Number">
                {selectedReport.studentRollNumber || 'N/A'}
              </Descriptions.Item>
              {selectedReport.internshipTitle && (
                <Descriptions.Item label="Internship" span={2}>
                  {selectedReport.internshipTitle}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Visit Date">
                {dayjs(selectedReport.visitDate).format('DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Visit Type">
                <Tag color={getVisitTypeColor(selectedReport.visitType)}>
                  {selectedReport.visitType}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(selectedReport.status)}>
                  {selectedReport.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Rating">
                <Rate disabled value={selectedReport.rating} />
              </Descriptions.Item>
              <Descriptions.Item label="Duration">
                {selectedReport.duration}
              </Descriptions.Item>
              <Descriptions.Item label="Location">
                {selectedReport.location}
              </Descriptions.Item>
              {selectedReport.summary && (
                <Descriptions.Item label="Summary" span={2}>
                  {selectedReport.summary}
                </Descriptions.Item>
              )}
              {selectedReport.observations && (
                <Descriptions.Item label="Observations" span={2}>
                  <pre className="whitespace-pre-wrap text-sm m-0">{selectedReport.observations}</pre>
                </Descriptions.Item>
              )}
              {selectedReport.recommendations && (
                <Descriptions.Item label="Recommendations" span={2}>
                  {selectedReport.recommendations}
                </Descriptions.Item>
              )}
              {selectedReport.issuesIdentified && (
                <Descriptions.Item label="Issues Identified" span={2}>
                  {selectedReport.issuesIdentified}
                </Descriptions.Item>
              )}
              {selectedReport.actionRequired && (
                <Descriptions.Item label="Action Required" span={2}>
                  {selectedReport.actionRequired}
                </Descriptions.Item>
              )}
              {selectedReport.feedbackSharedWithStudent && (
                <Descriptions.Item label="Feedback to Student" span={2}>
                  {selectedReport.feedbackSharedWithStudent}
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FacultyReports;
