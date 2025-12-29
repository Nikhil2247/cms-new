import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Input,
  Avatar,
  Empty,
  Row,
  Col,
  Statistic,
  Tabs,
  Badge,
  Skeleton,
  Descriptions,
  Rate,
  Modal,
  Form,
  Select,
  DatePicker,
  InputNumber,
  Divider,
  Tooltip,
  Calendar,
  Popconfirm,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  CarOutlined,
  VideoCameraOutlined,
  ScheduleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  StarOutlined,
  EyeOutlined,
  DownloadOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { debounce } from 'lodash';
import dayjs from 'dayjs';
import principalService from '../../../services/principal.service';

const { Title, Text } = Typography;

const { RangePicker } = DatePicker;

const FacultyProgress = () => {
  // State
  const [loading, setLoading] = useState(true);
  const [facultyList, setFacultyList] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [facultyDetails, setFacultyDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('students');

  // Visit view state (table vs calendar)
  const [visitViewMode, setVisitViewMode] = useState('table');
  const [visitDateRange, setVisitDateRange] = useState(null);
  const [visitStatusFilter, setVisitStatusFilter] = useState('all');

  // Report details modal
  const [reportDetailsVisible, setReportDetailsVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  // Edit internship state
  const [editVisible, setEditVisible] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [editForm] = Form.useForm();

  // Fetch faculty list on mount
  useEffect(() => {
    fetchFacultyList();
  }, []);

  // Fetch faculty list
  const fetchFacultyList = async () => {
    try {
      setLoading(true);
      // Response is already unwrapped: { faculty: [...] }
      const response = await principalService.getFacultyProgress();
      setFacultyList(response?.faculty || []);

      // Auto-select first faculty if available
      if (response?.faculty?.length > 0 && !selectedFaculty) {
        setSelectedFaculty(response.faculty[0]);
        fetchFacultyDetails(response.faculty[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch faculty list:', error);
      toast.error('Failed to load faculty list');
    } finally {
      setLoading(false);
    }
  };

  // Fetch faculty details
  const fetchFacultyDetails = async (facultyId) => {
    try {
      setDetailsLoading(true);
      // Response is already unwrapped
      const response = await principalService.getFacultyProgressDetails(facultyId);
      setFacultyDetails(response);
    } catch (error) {
      console.error('Failed to fetch faculty details:', error);
      toast.error('Failed to load faculty details');
    } finally {
      setDetailsLoading(false);
    }
  };

  // Handle faculty selection
  const handleFacultySelect = (faculty) => {
    setSelectedFaculty(faculty);
    fetchFacultyDetails(faculty.id);
  };

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((value) => {
      setSearchText(value);
    }, 300),
    []
  );

  // Filtered faculty list
  const filteredFaculty = useMemo(() => {
    if (!searchText) return facultyList;
    const lower = searchText.toLowerCase();
    return facultyList.filter(
      (f) =>
        f.name?.toLowerCase().includes(lower) ||
        f.email?.toLowerCase().includes(lower) ||
        f.employeeId?.toLowerCase().includes(lower)
    );
  }, [facultyList, searchText]);

  // Filtered visits based on date range and status
  const filteredVisits = useMemo(() => {
    let visits = facultyDetails?.visits || [];

    // Filter by status
    if (visitStatusFilter !== 'all') {
      visits = visits.filter((v) => v.status === visitStatusFilter);
    }

    // Filter by date range
    if (visitDateRange && visitDateRange.length === 2 && visitDateRange[0] && visitDateRange[1]) {
      visits = visits.filter((v) => {
        const visitDate = dayjs(v.visitDate);
        return visitDate.isAfter(visitDateRange[0]) && visitDate.isBefore(visitDateRange[1].add(1, 'day'));
      });
    }

    return visits;
  }, [facultyDetails?.visits, visitStatusFilter, visitDateRange]);

  // Calculate average rating
  const averageRating = useMemo(() => {
    const visits = facultyDetails?.visits || [];
    const ratedVisits = visits.filter((v) => v.overallRating > 0);
    if (ratedVisits.length === 0) return 0;
    const sum = ratedVisits.reduce((acc, v) => acc + v.overallRating, 0);
    return (sum / ratedVisits.length).toFixed(1);
  }, [facultyDetails?.visits]);

  // Handle view report details
  const handleViewReportDetails = (visit) => {
    setSelectedReport(visit);
    setReportDetailsVisible(true);
  };

  // Get visit type icon
  const getVisitTypeIcon = (type) => {
    switch (type) {
      case 'PHYSICAL':
        return <CarOutlined className="text-primary" />;
      case 'VIRTUAL':
        return <VideoCameraOutlined className="text-secondary" />;
      case 'SCHEDULED':
        return <ScheduleOutlined className="text-warning" />;
      default:
        return <EnvironmentOutlined className="text-text-tertiary" />;
    }
  };

  // Get visit status color
  const getVisitStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'SCHEDULED':
        return 'processing';
      case 'CANCELLED':
        return 'error';
      case 'MISSED':
        return 'error';
      default:
        return 'default';
    }
  };

  // Handle edit internship
  const handleEditInternship = (student) => {
    setEditStudent(student);
    // Normalize status to uppercase
    const status = student.internshipStatus?.toUpperCase?.() || student.internshipStatus || 'ONGOING';
    editForm.setFieldsValue({
      companyName: student.companyName || '',
      jobProfile: student.jobProfile || '',
      stipend: student.stipend ? parseInt(student.stipend) : null,
      internshipDuration: student.internshipDuration || '',
      internshipStatus: status,
    });
    setEditVisible(true);
  };

  const handleEditSubmit = async (values) => {
    if (!editStudent?.applicationId) {
      toast.error('No internship found for this student');
      return;
    }

    try {
      setEditLoading(true);
      await principalService.updateInternship(editStudent.applicationId, values);
      toast.success('Internship updated successfully');
      setEditVisible(false);
      editForm.resetFields();
      // Refresh faculty details to get updated data
      if (selectedFaculty) {
        fetchFacultyDetails(selectedFaculty.id);
      }
    } catch (error) {
      console.error('Failed to update internship:', error);
      toast.error(error.message || 'Failed to update internship');
    } finally {
      setEditLoading(false);
    }
  };

  // Student columns for the table
  const studentColumns = [
    {
      title: 'Student',
      key: 'student',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <Avatar size={32} icon={<UserOutlined />} className="bg-primary/10 text-primary" />
          <div>
            <Text className="block font-medium text-text-primary">{record.name}</Text>
            <Text className="text-xs text-text-tertiary">{record.rollNumber}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Batch / Dept',
      key: 'batchDept',
      render: (_, record) => (
        <div>
          <Tag color="blue" className="rounded-md m-0">{record.batch}</Tag>
          <Text className="block text-xs text-text-tertiary mt-1">{record.department}</Text>
        </div>
      ),
    },
    {
      title: 'Internship',
      key: 'internship',
      width: 220,
      render: (_, record) => (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Text className="block text-text-primary text-sm font-medium">
              {record.companyName || record.internshipTitle || 'N/A'}
            </Text>
            <Tag color="purple" className="rounded-full text-[9px] uppercase font-bold m-0 px-1.5">
              Self-ID
            </Tag>
          </div>
          {record.jobProfile && (
            <Text className="text-xs text-text-secondary block">{record.jobProfile}</Text>
          )}
          <div className="flex items-center gap-2 mt-1 text-[10px] text-text-tertiary">
            {record.internshipDuration && (
              <span>{record.internshipDuration}</span>
            )}
            {record.stipend && (
              <Tag color="green" className="rounded-full text-[9px] m-0 px-1.5">
                {record.stipend}/mo
              </Tag>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'internshipStatus',
      key: 'status',
      render: (status) => {
        const colors = {
          'ONGOING': 'processing',
          'IN_PROGRESS': 'processing',
          'COMPLETED': 'success',
          'PENDING': 'warning',
          'APPROVED': 'success',
          'NOT_STARTED': 'default',
        };
        const labels = {
          'ONGOING': 'Ongoing',
          'IN_PROGRESS': 'In Progress',
          'COMPLETED': 'Completed',
          'PENDING': 'Pending',
          'APPROVED': 'Approved',
          'NOT_STARTED': 'Not Started',
        };
        const statusKey = status?.toUpperCase?.() || status;
        return <Tag color={colors[statusKey] || 'default'} className="rounded-full">{labels[statusKey] || status || 'N/A'}</Tag>;
      },
    },
    {
      title: 'Visits',
      dataIndex: 'totalVisits',
      key: 'visits',
      align: 'center',
      render: (visits) => (
        <Badge count={visits || 0} showZero color={visits > 0 ? 'var(--ant-primary-color)' : 'var(--ant-error-color)'} />
      ),
    },
    {
      title: 'Last Visit',
      dataIndex: 'lastVisitDate',
      key: 'lastVisit',
      render: (date) => date ? (
        <Text className="text-sm text-text-secondary">{dayjs(date).format('DD MMM YYYY')}</Text>
      ) : (
        <Text className="text-xs text-text-tertiary italic">No visits</Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Tooltip title="Edit Internship">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditInternship(record)}
            className="text-warning hover:bg-warning/10"
          />
        </Tooltip>
      ),
    },
  ];

  // Visit columns for the table
  const visitColumns = [
    {
      title: 'Visit Date',
      dataIndex: 'visitDate',
      key: 'visitDate',
      width: 140,
      render: (date) => (
        <div className="flex items-center gap-2">
          <CalendarOutlined className="text-text-tertiary" />
          <Text className="font-medium text-text-primary">{dayjs(date).format('DD MMM YYYY')}</Text>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'visitType',
      key: 'visitType',
      width: 120,
      render: (type) => (
        <Space>
          {getVisitTypeIcon(type)}
          <Text className="text-sm">{type}</Text>
        </Space>
      ),
    },
    {
      title: 'Student',
      key: 'student',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <Avatar size={28} icon={<UserOutlined />} className="bg-background-tertiary" />
          <div>
            <Text className="block text-sm text-text-primary">{record.studentName}</Text>
            <Text className="text-xs text-text-tertiary">{record.studentRollNumber}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Company',
      dataIndex: 'companyName',
      key: 'company',
      render: (name, record) => (
        <div>
          <Text className="block text-sm text-text-primary">{name || 'N/A'}</Text>
          {record.visitLocation && (
            <Text className="text-xs text-text-tertiary flex items-center gap-1">
              <EnvironmentOutlined /> {record.visitLocation}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Rating',
      dataIndex: 'overallRating',
      key: 'rating',
      width: 100,
      render: (rating) => rating ? (
        <Rate disabled value={rating} count={5} className="text-sm" />
      ) : (
        <Text className="text-xs text-text-tertiary">Not rated</Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status) => (
        <Tag color={getVisitStatusColor(status)} className="rounded-full m-0">
          {status || 'Completed'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Tooltip title="View Details">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewReportDetails(record)}
            className="text-primary hover:bg-primary/10"
          />
        </Tooltip>
      ),
    },
  ];

  // Render faculty sidebar
  const renderFacultySidebar = () => (
    <Card
      className="h-full rounded-2xl border-border shadow-sm"
      styles={{ body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}
    >
      <div className="p-4 border-b border-border">
        <Title level={5} className="!mb-3 !text-text-primary flex items-center gap-2">
          <TeamOutlined className="text-primary" />
          Faculty Members
        </Title>
        <Input
          placeholder="Search faculty..."
          prefix={<SearchOutlined className="text-text-tertiary" />}
          onChange={(e) => debouncedSearch(e.target.value)}
          className="rounded-lg"
          allowClear
        />
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton.Button key={i} active block style={{ height: 60 }} />
            ))}
          </div>
        ) : filteredFaculty.length === 0 ? (
          <Empty description="No faculty found" className="py-10" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="flex flex-col">
            {filteredFaculty.map((faculty, index) => (
              <div
                key={faculty.id || index}
                onClick={() => handleFacultySelect(faculty)}
                className={`cursor-pointer px-4 py-3 transition-all border-l-4 hover:bg-background-tertiary/50 flex items-center gap-3 w-full ${
                  index !== filteredFaculty.length - 1 ? 'border-b border-border/50' : ''
                } ${
                  selectedFaculty?.id === faculty.id
                    ? 'bg-primary/5 border-l-primary'
                    : 'border-l-transparent'
                }`}
              >
                <Avatar
                  size={40}
                  icon={<UserOutlined />}
                  className={selectedFaculty?.id === faculty.id ? 'bg-primary text-white' : 'bg-background-tertiary text-text-tertiary'}
                />
                <div className="flex-1 min-w-0">
                  <Text className="block font-medium text-text-primary truncate">{faculty.name}</Text>
                  <Text className="text-xs text-text-tertiary">{faculty.employeeId || faculty.email}</Text>
                </div>
                <div className="flex flex-col items-end">
                  <Badge
                    count={faculty.assignedCount}
                    showZero
                    color="var(--ant-primary-color)"
                    className="mb-1"
                  />
                  <Text className="text-[10px] text-text-tertiary uppercase">Students</Text>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );

  // Render faculty details header
  const renderFacultyDetailsHeader = () => {
    if (!selectedFaculty) return null;

    const stats = facultyDetails?.stats || {};

    return (
      <Card className="rounded-2xl border-border shadow-sm mb-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Faculty Info */}
          <div className="flex items-start gap-4">
            <Avatar size={64} icon={<UserOutlined />} className="bg-primary text-white shrink-0" />
            <div>
              <Title level={4} className="!mb-1 !text-text-primary">{selectedFaculty.name}</Title>
              <Space orientation="vertical" size={2}>
                {selectedFaculty.employeeId && (
                  <Text className="text-sm text-text-secondary flex items-center gap-2">
                    <UserOutlined className="text-text-tertiary" />
                    {selectedFaculty.employeeId}
                  </Text>
                )}
                {selectedFaculty.email && (
                  <Text className="text-sm text-text-secondary flex items-center gap-2">
                    <MailOutlined className="text-text-tertiary" />
                    {selectedFaculty.email}
                  </Text>
                )}
                {selectedFaculty.phone && (
                  <Text className="text-sm text-text-secondary flex items-center gap-2">
                    <PhoneOutlined className="text-text-tertiary" />
                    {selectedFaculty.phone}
                  </Text>
                )}
              </Space>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="flex-1">
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={8} lg={4}>
                <div className="text-center p-3 bg-primary/5 rounded-xl">
                  <Statistic
                    value={stats.totalStudents || 0}
                    styles={{ content: { color: 'var(--ant-primary-color)', fontSize: 24, fontWeight: 'bold' } }}
                  />
                  <Text className="text-[10px] uppercase font-bold text-text-tertiary">Total Students</Text>
                </div>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <div className="text-center p-3 bg-success/5 rounded-xl">
                  <Statistic
                    value={stats.totalVisits || 0}
                    styles={{ content: { color: 'var(--ant-success-color)', fontSize: 24, fontWeight: 'bold' } }}
                  />
                  <Text className="text-[10px] uppercase font-bold text-text-tertiary">Total Visits</Text>
                </div>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <div className="text-center p-3 bg-background-tertiary rounded-xl">
                  <Statistic
                    value={stats.visitsLastMonth || 0}
                    styles={{ content: { color: 'var(--ant-text-color-secondary)', fontSize: 24, fontWeight: 'bold' } }}
                  />
                  <Text className="text-[10px] uppercase font-bold text-text-tertiary">Last Month</Text>
                </div>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <div className="text-center p-3 bg-secondary/5 rounded-xl">
                  <Statistic
                    value={stats.visitsThisMonth || 0}
                    styles={{ content: { color: 'var(--ant-secondary-color, #722ed1)', fontSize: 24, fontWeight: 'bold' } }}
                  />
                  <Text className="text-[10px] uppercase font-bold text-text-tertiary">This Month</Text>
                </div>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <div className="text-center p-3 bg-warning/5 rounded-xl">
                  <Statistic
                    value={stats.scheduledNextMonth || 0}
                    styles={{ content: { color: 'var(--ant-warning-color)', fontSize: 24, fontWeight: 'bold' } }}
                  />
                  <Text className="text-[10px] uppercase font-bold text-text-tertiary">Scheduled</Text>
                </div>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <div className="text-center p-3 bg-error/5 rounded-xl">
                  <Statistic
                    value={stats.missedVisits || 0}
                    styles={{ content: { color: stats.missedVisits > 0 ? 'var(--ant-error-color)' : 'var(--ant-success-color)', fontSize: 24, fontWeight: 'bold' } }}
                  />
                  <Text className="text-[10px] uppercase font-bold text-text-tertiary">Missed</Text>
                </div>
              </Col>
            </Row>
          </div>
        </div>
      </Card>
    );
  };

  // Render students tab
  const renderStudentsTab = () => (
    <Card className="rounded-2xl border-border shadow-sm" styles={{ body: { padding: 0 } }}>
      <div className="p-4 border-b border-border flex justify-between items-center">
        <Title level={5} className="!mb-0 !text-text-primary flex items-center gap-2">
          <TeamOutlined className="text-primary" />
          Assigned Students
        </Title>
        <Text className="text-text-tertiary">
          {facultyDetails?.students?.length || 0} students
        </Text>
      </div>
      <Table
        columns={studentColumns}
        dataSource={facultyDetails?.students || []}
        rowKey="id"
        loading={detailsLoading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} students`,
        }}
        scroll={{ x: 800 }}
        className="custom-table"
        locale={{
          emptyText: <Empty description="No students assigned" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
        }}
      />
    </Card>
  );

  // Calendar cell renderer for visits
  const dateCellRender = (value) => {
    const dateStr = value.format('YYYY-MM-DD');
    const dayVisits = filteredVisits.filter(
      (v) => dayjs(v.visitDate).format('YYYY-MM-DD') === dateStr
    );

    return (
      <ul className="list-none p-0 m-0">
        {dayVisits.map((visit, index) => (
          <li key={index} className="mb-1">
            <Badge
              status={visit.status === 'COMPLETED' ? 'success' : visit.status === 'SCHEDULED' ? 'processing' : 'warning'}
              text={
                <span className="text-xs cursor-pointer" onClick={() => handleViewReportDetails(visit)}>
                  {visit.studentName?.split(' ')[0]}
                </span>
              }
            />
          </li>
        ))}
      </ul>
    );
  };

  // Render visits tab
  const renderVisitsTab = () => (
    <div className="space-y-6">
      {/* Filters and View Toggle */}
      <Card className="rounded-2xl border-border shadow-sm">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <Space wrap>
            <Select
              value={visitStatusFilter}
              onChange={setVisitStatusFilter}
              className="w-40"
              placeholder="Status"
            >
              <Select.Option value="all">All Status</Select.Option>
              <Select.Option value="COMPLETED">Completed</Select.Option>
              <Select.Option value="SCHEDULED">Scheduled</Select.Option>
              <Select.Option value="CANCELLED">Cancelled</Select.Option>
              <Select.Option value="MISSED">Missed</Select.Option>
            </Select>
            <RangePicker
              value={visitDateRange}
              onChange={setVisitDateRange}
              format="DD/MM/YYYY"
              className="w-64"
              placeholder={['Start Date', 'End Date']}
            />
            {(visitStatusFilter !== 'all' || visitDateRange) && (
              <Button
                onClick={() => {
                  setVisitStatusFilter('all');
                  setVisitDateRange(null);
                }}
              >
                Clear Filters
              </Button>
            )}
          </Space>
          <Space>
            <Button
              icon={visitViewMode === 'table' ? <CalendarOutlined /> : <TableOutlined />}
              onClick={() => setVisitViewMode(visitViewMode === 'table' ? 'calendar' : 'table')}
            >
              {visitViewMode === 'table' ? 'Calendar View' : 'Table View'}
            </Button>
          </Space>
        </div>
      </Card>

      {/* Visit Summary */}
      {facultyDetails?.visitSummary && (
        <Card className="rounded-2xl border-border shadow-sm">
          <Title level={5} className="!mb-4 !text-text-primary flex items-center gap-2">
            <CalendarOutlined className="text-primary" />
            Monthly Visit Summary
          </Title>
          <Row gutter={[16, 16]}>
            {facultyDetails.visitSummary.map((month, index) => (
              <Col xs={12} sm={8} md={6} lg={4} key={index}>
                <div className={`p-3 rounded-xl border ${
                  month.isPast && month.visits === 0
                    ? 'border-error/30 bg-error/5'
                    : month.visits > 0
                    ? 'border-success/30 bg-success/5'
                    : 'border-border bg-background-tertiary/30'
                }`}>
                  <Text className="block text-sm font-semibold text-text-primary">
                    {month.monthName} {month.year}
                  </Text>
                  <div className="flex items-center gap-2 mt-1">
                    {month.isPast && month.visits === 0 ? (
                      <>
                        <ExclamationCircleOutlined className="text-error" />
                        <Text className="text-error text-xs font-medium">Missed</Text>
                      </>
                    ) : (
                      <>
                        <CheckCircleOutlined className={month.visits > 0 ? 'text-success' : 'text-text-tertiary'} />
                        <Text className={`text-xs font-medium ${month.visits > 0 ? 'text-success' : 'text-text-tertiary'}`}>
                          {month.visits} visit{month.visits !== 1 ? 's' : ''}
                        </Text>
                      </>
                    )}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* Detailed Visits - Table or Calendar View */}
      {visitViewMode === 'table' ? (
        <Card className="rounded-2xl border-border shadow-sm" styles={{ body: { padding: 0 } }}>
          <div className="p-4 border-b border-border flex justify-between items-center">
            <Title level={5} className="!mb-0 !text-text-primary flex items-center gap-2">
              <FileTextOutlined className="text-primary" />
              Visit Details
            </Title>
            <Text className="text-text-tertiary">
              {filteredVisits.length} visits
            </Text>
          </div>
          <Table
            columns={visitColumns}
            dataSource={filteredVisits}
            rowKey="id"
            loading={detailsLoading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} visits`,
            }}
            scroll={{ x: 1000 }}
            className="custom-table"
            expandable={{
              expandedRowRender: (record) => (
                <div className="p-4 bg-background-tertiary/30 rounded-xl mx-4 my-2">
                  <Row gutter={[24, 16]}>
                    <Col xs={24} md={12}>
                      <Descriptions
                        column={1}
                        size="small"
                        className="bg-background rounded-lg p-3"
                      >
                        <Descriptions.Item label="Duration">
                          {record.visitDuration || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Student Performance">
                          {record.studentPerformance || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Work Environment">
                          {record.workEnvironment || 'N/A'}
                        </Descriptions.Item>
                      </Descriptions>
                    </Col>
                    <Col xs={24} md={12}>
                      <Descriptions
                        column={1}
                        size="small"
                        className="bg-background rounded-lg p-3"
                      >
                        <Descriptions.Item label="Industry Support">
                          {record.industrySupport || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Skills Development">
                          {record.skillsDevelopment || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Remarks">
                          {record.remarks || 'N/A'}
                        </Descriptions.Item>
                      </Descriptions>
                    </Col>
                  </Row>
                </div>
              ),
              rowExpandable: () => true,
            }}
            locale={{
              emptyText: <Empty description="No visits recorded" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        </Card>
      ) : (
        <Card className="rounded-2xl border-border shadow-sm">
          <Calendar
            cellRender={(current, info) => {
              if (info.type === 'date') {
                return dateCellRender(current);
              }
              return info.originNode;
            }}
          />
        </Card>
      )}
    </div>
  );

  // Tab items
  const tabItems = [
    {
      key: 'students',
      label: (
        <span className="flex items-center gap-2 py-2">
          <TeamOutlined />
          Assigned Students
          <Badge count={facultyDetails?.students?.length || 0} showZero className="ml-1" />
        </span>
      ),
      children: renderStudentsTab(),
    },
    {
      key: 'visits',
      label: (
        <span className="flex items-center gap-2 py-2">
          <CarOutlined />
          Faculty Visits
          <Badge count={facultyDetails?.visits?.length || 0} showZero className="ml-1" />
        </span>
      ),
      children: renderVisitsTab(),
    },
  ];

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <Title level={2} className="!mb-1 !text-text-primary">
            Faculty Progress Tracking
          </Title>
          <Text className="text-text-secondary text-base">
            Monitor faculty visits and student assignments across your institution
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            fetchFacultyList();
            if (selectedFaculty) {
              fetchFacultyDetails(selectedFaculty.id);
            }
          }}
          loading={loading || detailsLoading}
          className="rounded-lg shadow-sm"
        >
          Refresh
        </Button>
      </div>

      {/* Main Content */}
      <Row gutter={[24, 24]}>
        {/* Faculty Sidebar */}
        <Col xs={24} lg={6}>
          <div className="lg:sticky lg:top-6" style={{ maxHeight: 'calc(100vh - 180px)' }}>
            {renderFacultySidebar()}
          </div>
        </Col>

        {/* Faculty Details */}
        <Col xs={24} lg={18}>
          {selectedFaculty ? (
            detailsLoading && !facultyDetails ? (
              <Card className="rounded-2xl border-border shadow-sm">
                <Skeleton active paragraph={{ rows: 8 }} />
              </Card>
            ) : (
              <div>
                {renderFacultyDetailsHeader()}
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  items={tabItems}
                  size="large"
                  className="custom-tabs-large"
                />
              </div>
            )
          ) : (
            <Card className="rounded-2xl border-border shadow-sm">
              <Empty
                description="Select a faculty member to view details"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                className="py-20"
              />
            </Card>
          )}
        </Col>
      </Row>

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
        width={600}
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
              <Form.Item name="internshipStatus" label="Status">
                <Select placeholder="Select status">
                  <Select.Option value="ONGOING">Ongoing</Select.Option>
                  <Select.Option value="IN_PROGRESS">In Progress</Select.Option>
                  <Select.Option value="COMPLETED">Completed</Select.Option>
                  <Select.Option value="APPROVED">Approved</Select.Option>
                </Select>
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

      {/* Visit Report Details Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-text-primary">
            <EyeOutlined className="text-primary" />
            <span>Visit Report Details</span>
          </div>
        }
        open={reportDetailsVisible}
        onCancel={() => {
          setReportDetailsVisible(false);
          setSelectedReport(null);
        }}
        footer={[
          <Button key="close" onClick={() => setReportDetailsVisible(false)}>
            Close
          </Button>,
        ]}
        width={700}
      >
        {selectedReport && (
          <div className="space-y-4">
            {/* Visit Header */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5">
              <Row gutter={[16, 8]}>
                <Col xs={12}>
                  <Text className="text-xs text-text-tertiary block">Faculty</Text>
                  <Text className="font-medium text-text-primary">{selectedFaculty?.name}</Text>
                </Col>
                <Col xs={12}>
                  <Text className="text-xs text-text-tertiary block">Visit Date</Text>
                  <Text className="font-medium text-text-primary">
                    {dayjs(selectedReport.visitDate).format('DD MMM YYYY')}
                  </Text>
                </Col>
                <Col xs={12}>
                  <Text className="text-xs text-text-tertiary block">Student</Text>
                  <Text className="font-medium text-text-primary">{selectedReport.studentName}</Text>
                  <Text className="text-xs text-text-secondary block">{selectedReport.studentRollNumber}</Text>
                </Col>
                <Col xs={12}>
                  <Text className="text-xs text-text-tertiary block">Visit Type</Text>
                  <Space>
                    {getVisitTypeIcon(selectedReport.visitType)}
                    <Text className="text-text-primary">{selectedReport.visitType}</Text>
                  </Space>
                </Col>
              </Row>
            </div>

            {/* Visit Details */}
            <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Company">
                {selectedReport.companyName || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Location">
                {selectedReport.visitLocation || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Duration">
                {selectedReport.visitDuration || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getVisitStatusColor(selectedReport.status)}>
                  {selectedReport.status || 'Completed'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Overall Rating" span={2}>
                {selectedReport.overallRating ? (
                  <Rate disabled value={selectedReport.overallRating} />
                ) : (
                  <Text className="text-text-tertiary">Not rated</Text>
                )}
              </Descriptions.Item>
              {selectedReport.studentPerformance && (
                <Descriptions.Item label="Student Performance" span={2}>
                  {selectedReport.studentPerformance}
                </Descriptions.Item>
              )}
              {selectedReport.workEnvironment && (
                <Descriptions.Item label="Work Environment" span={2}>
                  {selectedReport.workEnvironment}
                </Descriptions.Item>
              )}
              {selectedReport.industrySupport && (
                <Descriptions.Item label="Industry Support" span={2}>
                  {selectedReport.industrySupport}
                </Descriptions.Item>
              )}
              {selectedReport.skillsDevelopment && (
                <Descriptions.Item label="Skills Development" span={2}>
                  {selectedReport.skillsDevelopment}
                </Descriptions.Item>
              )}
              {selectedReport.remarks && (
                <Descriptions.Item label="Remarks" span={2}>
                  <pre className="whitespace-pre-wrap text-sm m-0">{selectedReport.remarks}</pre>
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
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FacultyProgress;
