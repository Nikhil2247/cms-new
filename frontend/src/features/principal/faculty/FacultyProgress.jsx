import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Input,
  Empty,
  Row,
  Col,
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
  Spin,
  List,
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
  FileTextOutlined,
  EditOutlined,
  SaveOutlined,
  EyeOutlined,
  TableOutlined,
  RiseOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  IdcardOutlined,
  BookOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { debounce } from 'lodash';
import dayjs from 'dayjs';
import principalService from '../../../services/principal.service';
import ProfileAvatar from '../../../components/common/ProfileAvatar';

const { Text, Title } = Typography;
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
    setFacultyDetails(null);
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

    if (visitStatusFilter !== 'all') {
      visits = visits.filter((v) => v.status === visitStatusFilter);
    }

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
        return <CarOutlined className="text-blue-500" />;
      case 'VIRTUAL':
        return <VideoCameraOutlined className="text-purple-500" />;
      case 'SCHEDULED':
        return <ScheduleOutlined className="text-orange-500" />;
      default:
        return <EnvironmentOutlined className="text-gray-500" />;
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
    const phase = student.internshipPhase || 'NOT_STARTED';
    editForm.resetFields();
    setTimeout(() => {
      editForm.setFieldsValue({
        companyName: student.companyName || '',
        jobProfile: student.jobProfile || '',
        stipend: student.stipend ? Number(student.stipend) : null,
        internshipDuration: student.internshipDuration || '',
        internshipPhase: phase,
      });
    }, 0);
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

  const handleRefresh = () => {
    fetchFacultyList();
    if (selectedFaculty) {
      fetchFacultyDetails(selectedFaculty.id);
    }
  };

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return dayjs(dateString).format('DD MMM YYYY');
  };

  // Get display faculty - use nested faculty object from details, or fallback to list item
  const displayFaculty = facultyDetails?.faculty || selectedFaculty;
  const stats = facultyDetails?.stats || {};

  // Student columns for the table
  const studentColumns = [
    {
      title: 'Student',
      key: 'student',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <ProfileAvatar size={32} profileImage={record.profileImage} />
          <div>
            <Text className="block font-medium">{record.name}</Text>
            <Text className="text-xs text-gray-500">{record.rollNumber}</Text>
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
          <Text className="block text-xs text-gray-500 mt-1">{record.department}</Text>
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
            <Text className="block text-sm font-medium">
              {record.companyName || record.internshipTitle || 'N/A'}
            </Text>
            <Tag color="purple" className="rounded-full text-[9px] uppercase font-bold m-0 px-1.5">
              Self-ID
            </Tag>
          </div>
          {record.jobProfile && (
            <Text className="text-xs text-gray-500 block">{record.jobProfile}</Text>
          )}
          <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
            {record.internshipDuration && <span>{record.internshipDuration}</span>}
            {record.stipend && (
              <Tag color="green" className="rounded-full text-[9px] m-0 px-1.5">
                ₹{record.stipend}/mo
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
        <Badge count={visits || 0} showZero color={visits > 0 ? '#1890ff' : '#ff4d4f'} />
      ),
    },
    {
      title: 'Last Visit',
      dataIndex: 'lastVisitDate',
      key: 'lastVisit',
      render: (date) => date ? (
        <Text className="text-sm text-gray-600">{formatDate(date)}</Text>
      ) : (
        <Text className="text-xs text-gray-400 italic">No visits</Text>
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
            className="text-orange-500 hover:bg-orange-50"
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
          <CalendarOutlined className="text-gray-400" />
          <Text className="font-medium">{formatDate(date)}</Text>
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
          <ProfileAvatar size={28} profileImage={record.studentProfileImage} />
          <div>
            <Text className="block text-sm">{record.studentName}</Text>
            <Text className="text-xs text-gray-500">{record.studentRollNumber}</Text>
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
          <Text className="block text-sm">{name || 'N/A'}</Text>
          {record.visitLocation && (
            <Text className="text-xs text-gray-500 flex items-center gap-1">
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
        <Text className="text-xs text-gray-400">Not rated</Text>
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
            className="text-blue-500 hover:bg-blue-50"
          />
        </Tooltip>
      ),
    },
  ];

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

  // Tab items
  const tabItems = [
    {
      key: 'students',
      label: <span><TeamOutlined /> Assigned Students</span>,
      children: (
        <div className="p-4">
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
            scroll={{ x: 900 }}
            locale={{
              emptyText: <Empty description="No students assigned to this faculty" className="py-8" />,
            }}
          />
        </div>
      ),
    },
    {
      key: 'visits',
      label: (
        <span>
          <CarOutlined /> Faculty Visits
          {facultyDetails?.visits?.length > 0 && (
            <Tag color="green" className="ml-2">{facultyDetails.visits.length}</Tag>
          )}
        </span>
      ),
      children: (
        <div className="p-4 space-y-4">
          {/* Filters */}
          <Card size="small" className="shadow-sm border-0">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-2 items-center">
                <Select
                  value={visitStatusFilter}
                  onChange={setVisitStatusFilter}
                  className="w-32"
                  size="small"
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
                  className="w-56"
                  size="small"
                  placeholder={['Start', 'End']}
                />
                {(visitStatusFilter !== 'all' || visitDateRange) && (
                  <Button
                    type="text"
                    size="small"
                    onClick={() => {
                      setVisitStatusFilter('all');
                      setVisitDateRange(null);
                    }}
                    className="text-gray-500 hover:text-red-500"
                  >
                    Clear
                  </Button>
                )}
              </div>
              <Button
                icon={visitViewMode === 'table' ? <CalendarOutlined /> : <TableOutlined />}
                onClick={() => setVisitViewMode(visitViewMode === 'table' ? 'calendar' : 'table')}
                size="small"
              >
                {visitViewMode === 'table' ? 'Calendar' : 'Table'}
              </Button>
            </div>
          </Card>

          {/* Monthly Summary */}
          {facultyDetails?.visitSummary && facultyDetails.visitSummary.length > 0 && (
            <Card size="small" className="shadow-sm border-0">
              <Text className="text-xs font-semibold text-gray-500 uppercase mb-3 block">
                <CalendarOutlined className="mr-1.5" />Monthly Summary
              </Text>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
                {facultyDetails.visitSummary.map((month, index) => (
                  <div key={index} className={`p-2 rounded-lg border text-center ${
                    month.isPast && month.visits === 0
                      ? 'border-red-200 bg-red-50'
                      : month.visits > 0
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <Text className="block text-[10px] font-medium">
                      {month.monthName?.substring(0, 3)}
                    </Text>
                    <span className={`text-sm font-bold ${
                      month.isPast && month.visits === 0 ? 'text-red-500' : month.visits > 0 ? 'text-green-500' : 'text-gray-400'
                    }`}>
                      {month.visits}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Visits Table or Calendar */}
          {visitViewMode === 'table' ? (
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
              expandable={{
                expandedRowRender: (record) => (
                  <div className="p-4 bg-gray-50 rounded-lg mx-2 my-2">
                    <Row gutter={[20, 16]}>
                      <Col xs={24} md={12}>
                        <Descriptions column={1} size="small">
                          <Descriptions.Item label="Title of Project/Work">
                            {record.titleOfProjectWork || 'N/A'}
                          </Descriptions.Item>
                          <Descriptions.Item label="Assistance Required">
                            {record.assistanceRequiredFromInstitute || 'N/A'}
                          </Descriptions.Item>
                        </Descriptions>
                      </Col>
                      <Col xs={24} md={12}>
                        <Descriptions column={1} size="small">
                          <Descriptions.Item label="Observations">
                            {record.observationsAboutStudent || 'N/A'}
                          </Descriptions.Item>
                          <Descriptions.Item label="Feedback">
                            {record.feedbackSharedWithStudent || 'N/A'}
                          </Descriptions.Item>
                        </Descriptions>
                      </Col>
                    </Row>
                  </div>
                ),
                rowExpandable: () => true,
              }}
              locale={{
                emptyText: <Empty description="No visits recorded" className="py-8" />,
              }}
            />
          ) : (
            <Card className="shadow-sm border-0">
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
      ),
    },
  ];

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <Title level={3} className="text-blue-800 !mb-0">
            Faculty Progress Tracking
          </Title>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          loading={loading || detailsLoading}
          className="bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
        >
          Refresh
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        {/* Faculty List - Left Column */}
        <Col xs={24} sm={24} md={8} lg={6} xl={6}>
          <Card
            title={
              <div className="flex items-center text-blue-800">
                <TeamOutlined className="mr-2" /> Faculty Directory
                <Text type="secondary" className="ml-auto text-xs">
                  {filteredFaculty.length} faculty
                </Text>
              </div>
            }
            className="rounded-lg border-0"
            styles={{
              body: { padding: 0, maxHeight: 'calc(80vh - 80px)', overflowY: 'hidden' },
              header: { borderBottom: '2px solid #e6f7ff', backgroundColor: '#f0f7ff' },
            }}
          >
            <div style={{ maxHeight: 'calc(80vh - 80px)', overflowY: 'auto', padding: '0.5rem' }} className="hide-scrollbar">
              <Input
                placeholder="Search Faculty..."
                className="mb-3 rounded-lg"
                value={searchText}
                onChange={(e) => debouncedSearch(e.target.value)}
                prefix={<UserOutlined className="text-gray-400" />}
                allowClear
              />

              {loading ? (
                <div className="flex justify-center items-center h-40">
                  <Spin size="small" tip="Loading faculty..." />
                </div>
              ) : filteredFaculty.length === 0 ? (
                <Empty description="No faculty found" className="py-8" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <List
                  itemLayout="horizontal"
                  dataSource={filteredFaculty}
                  renderItem={(faculty) => (
                    <List.Item
                      onClick={() => handleFacultySelect(faculty)}
                      className={`cursor-pointer my-2 rounded-xl transition-all duration-300 ease-in-out ${
                        selectedFaculty?.id === faculty.id
                          ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-indigo-100 border-l-4 border-l-blue-500 shadow-sm'
                          : 'hover:bg-gray-100 hover:shadow-md hover:translate-x-1'
                      }`}
                    >
                      <List.Item.Meta
                        className="px-3 py-1"
                        avatar={
                          <ProfileAvatar
                            profileImage={faculty.profileImage}
                            size={50}
                            className={selectedFaculty?.id === faculty.id
                              ? 'border-2 border-blue-400'
                              : 'border border-gray-200 hover:border-gray-300'
                            }
                          />
                        }
                        title={
                          <Text className="font-semibold !text-sm !text-gray-600">
                            {faculty.name}
                          </Text>
                        }
                        description={
                          <div>
                            <Tag color="blue" className="text-xs">
                              {faculty.assignedCount || 0} Students
                            </Tag>
                            <div className="mt-1 text-xs text-gray-500">
                              <IdcardOutlined className="mr-1" />
                              {faculty.designation || 'Faculty'}
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </div>
          </Card>
        </Col>

        {/* Faculty Details - Right Column */}
        <Col xs={24} sm={24} md={16} lg={18} xl={18} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          {displayFaculty ? (
            <div className="space-y-4">
              {/* Profile Header */}
              <Card className="border-0 rounded-lg shadow-sm">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <ProfileAvatar
                    profileImage={displayFaculty.profileImage}
                    size={90}
                    className="border-4 border-white shadow-lg"
                  />
                  <div className="flex-grow text-center md:text-left">
                    <Title level={3} className="mb-0 text-blue-800">
                      {displayFaculty.name}
                    </Title>
                    <div className="flex justify-center md:justify-start items-center text-gray-500 mb-1">
                      <IdcardOutlined className="mr-2" />
                      {displayFaculty.designation || 'Faculty'} • {displayFaculty.employeeId || displayFaculty.email}
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                      <Tag color="blue" className="px-3 py-1 rounded-full">
                        <TeamOutlined className="mr-1" />
                        {stats.totalStudents || displayFaculty.assignedCount || 0} Students
                      </Tag>
                      <Tag color="green" className="px-3 py-1 rounded-full">
                        <CheckCircleOutlined className="mr-1" />
                        {stats.totalVisits || 0} Total Visits
                      </Tag>
                      <Tag color="purple" className="px-3 py-1 rounded-full">
                        <RiseOutlined className="mr-1" />
                        {stats.visitsThisMonth || 0} This Month
                      </Tag>
                      <Tag color="cyan" className="px-3 py-1 rounded-full">
                        <ClockCircleOutlined className="mr-1" />
                        {stats.visitsLastMonth || 0} Last Month
                      </Tag>
                      <Tag color="orange" className="px-3 py-1 rounded-full">
                        <ScheduleOutlined className="mr-1" />
                        {stats.scheduledNextMonth || 0} Scheduled
                      </Tag>
                      {stats.missedVisits > 0 && (
                        <Tag color="red" className="px-3 py-1 rounded-full">
                          <WarningOutlined className="mr-1" />
                          {stats.missedVisits} Missed
                        </Tag>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Quick Info */}
                <div className="grid lg:grid-cols-3 gap-4 mt-6 p-3 rounded-lg shadow-sm bg-gray-50">
                  <div className="flex items-center">
                    <MailOutlined className="text-blue-500 text-xl mr-3" />
                    <div>
                      <div className="text-xs text-gray-500">Email</div>
                      <div className="text-sm font-medium">{displayFaculty.email || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <PhoneOutlined className="text-green-500 text-xl mr-3" />
                    <div>
                      <div className="text-xs text-gray-500">Contact</div>
                      <div className="text-sm font-medium">{displayFaculty.phoneNo || displayFaculty.contact || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <BankOutlined className="text-orange-500 text-xl mr-3" />
                    <div>
                      <div className="text-xs text-gray-500">Department</div>
                      <div className="text-sm font-medium">{displayFaculty.branch?.name || displayFaculty.branchName || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Detailed Information in Tabs */}
              <Card className="rounded-lg !mt-3 shadow-sm" styles={{ body: { padding: 0 } }}>
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  items={tabItems}
                  tabBarStyle={{ padding: '10px 16px 0', marginBottom: 0 }}
                  className="faculty-tabs"
                />
              </Card>
            </div>
          ) : (
            <Card className="min-h-[75vh] shadow-xl rounded-3xl bg-white/90 backdrop-blur-lg border-0 flex items-center justify-center">
              <div className="text-center max-w-md mx-auto py-16">
                <div className="relative mb-8">
                  <div className="w-24 h-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded-3xl flex items-center justify-center mb-4 mx-auto">
                    <UserOutlined className="text-gray-600 text-4xl" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                    <SearchOutlined className="text-indigo-500 text-sm" />
                  </div>
                </div>
                <Title level={4} className="text-gray-600 mb-4">
                  Select a Faculty Member
                </Title>
                <Text className="text-gray-500 text-base block mb-6">
                  Choose a faculty from the directory on the left to view detailed progress and student assignments.
                </Text>
                <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-4 border-0">
                  <Text className="text-indigo-700 text-sm">
                    Tip: Use the search to quickly find specific faculty members
                  </Text>
                </Card>
              </div>
            </Card>
          )}
        </Col>
      </Row>

      {/* Edit Internship Modal */}
      <Modal
        title="Edit Internship Details"
        open={editVisible}
        onCancel={() => {
          setEditVisible(false);
          editForm.resetFields();
        }}
        width={600}
        footer={null}
        forceRender
        destroyOnClose={false}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit} className="mt-4">
          {editStudent && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 mb-5">
              <div className="flex items-center gap-3">
                <ProfileAvatar size={48} profileImage={editStudent.profileImage} />
                <div>
                  <Text className="font-bold block text-base">{editStudent.name}</Text>
                  <Text className="text-gray-600 text-sm">{editStudent.rollNumber}</Text>
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
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="internshipDuration" label="Duration">
                <Input placeholder="e.g., 6 months" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="internshipPhase" label="Phase">
                <Select placeholder="Select phase">
                  <Select.Option value="NOT_STARTED">Not Started</Select.Option>
                  <Select.Option value="ACTIVE">Active</Select.Option>
                  <Select.Option value="COMPLETED">Completed</Select.Option>
                  <Select.Option value="TERMINATED">Terminated</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider className="my-4" />
          <div className="flex justify-end gap-3">
            <Button onClick={() => { setEditVisible(false); editForm.resetFields(); }}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={editLoading} icon={<SaveOutlined />}>
              Save Changes
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Visit Report Details Modal */}
      <Modal
        title="Visit Report Details"
        open={reportDetailsVisible}
        onCancel={() => {
          setReportDetailsVisible(false);
          setSelectedReport(null);
        }}
        footer={<Button onClick={() => setReportDetailsVisible(false)}>Close</Button>}
        width={720}
      >
        {selectedReport && (
          <div className="space-y-5 mt-4">
            {/* Visit Header Card */}
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <Row gutter={[20, 16]}>
                <Col xs={12} sm={6}>
                  <Text className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Faculty</Text>
                  <Text className="font-semibold">{selectedFaculty?.name}</Text>
                </Col>
                <Col xs={12} sm={6}>
                  <Text className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Visit Date</Text>
                  <Text className="font-semibold">{formatDate(selectedReport.visitDate)}</Text>
                </Col>
                <Col xs={12} sm={6}>
                  <Text className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Student</Text>
                  <Text className="font-semibold block">{selectedReport.studentName}</Text>
                  <Text className="text-xs text-gray-500">{selectedReport.studentRollNumber}</Text>
                </Col>
                <Col xs={12} sm={6}>
                  <Text className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Visit Type</Text>
                  <div className="flex items-center gap-2">
                    {getVisitTypeIcon(selectedReport.visitType)}
                    <Text className="font-semibold">{selectedReport.visitType}</Text>
                  </div>
                </Col>
              </Row>
            </div>

            {/* Visit Details */}
            <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Company">{selectedReport.companyName || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Location">{selectedReport.visitLocation || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Duration">{selectedReport.visitDuration || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getVisitStatusColor(selectedReport.status)} className="rounded-full">
                  {selectedReport.status || 'Completed'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Overall Rating" span={2}>
                {selectedReport.overallRating ? (
                  <div className="flex items-center gap-3">
                    <Rate disabled value={selectedReport.overallRating} />
                    <span className="text-sm text-gray-500">({selectedReport.overallRating}/5)</span>
                  </div>
                ) : (
                  <Text className="text-gray-400 italic">Not rated</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Title of Project/Work" span={2}>
                <div className="whitespace-pre-wrap text-sm">{selectedReport.titleOfProjectWork || 'N/A'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="Assistance Required" span={2}>
                <div className="whitespace-pre-wrap text-sm">{selectedReport.assistanceRequiredFromInstitute || 'N/A'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="Response from Organisation" span={2}>
                <div className="whitespace-pre-wrap text-sm">{selectedReport.responseFromOrganisation || 'N/A'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="Supervisor Remarks" span={2}>
                <div className="whitespace-pre-wrap text-sm">{selectedReport.remarksOfOrganisationSupervisor || 'N/A'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="Observations" span={2}>
                <div className="whitespace-pre-wrap text-sm">{selectedReport.observationsAboutStudent || 'N/A'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="Feedback Shared" span={2}>
                <div className="whitespace-pre-wrap text-sm">{selectedReport.feedbackSharedWithStudent || 'N/A'}</div>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FacultyProgress;
