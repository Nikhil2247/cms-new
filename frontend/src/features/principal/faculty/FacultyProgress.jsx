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
  Progress,
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
  RiseOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  TrophyOutlined,
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
    // Reset form first, then set new values
    editForm.resetFields();
    // Use setTimeout to ensure form is ready after reset
    setTimeout(() => {
      editForm.setFieldsValue({
        companyName: student.companyName || '',
        jobProfile: student.jobProfile || '',
        stipend: student.stipend ? Number(student.stipend) : null,
        internshipDuration: student.internshipDuration || '',
        internshipStatus: status,
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
          <ProfileAvatar size={32} profileImage={record.profileImage} className="bg-primary/10 text-primary" />
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
          <ProfileAvatar size={28} profileImage={record.studentProfileImage} className="bg-background-tertiary" />
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
      className="rounded-xl border-border shadow-soft bg-surface overflow-hidden"
      styles={{ body: { padding: 0, height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' } }}
    >
      {/* Sidebar Header */}
      <div className="px-4 py-3 bg-primary/5 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TeamOutlined className="text-primary" />
            <Text className="font-semibold text-primary">Faculty Members</Text>
          </div>
          <Text className="text-text-tertiary text-sm">{facultyList.length} faculty</Text>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border space-y-2">
        <Input
          placeholder="Search Faculty..."
          prefix={<UserOutlined className="text-text-tertiary" />}
          onChange={(e) => debouncedSearch(e.target.value)}
          className="rounded-lg"
          allowClear
        />
      </div>

      {/* Faculty List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton.Avatar active size={40} />
                <div className="flex-1">
                  <Skeleton.Input active size="small" block />
                </div>
              </div>
            ))}
          </div>
        ) : filteredFaculty.length === 0 ? (
          <Empty description="No faculty found" className="py-10" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div>
            {filteredFaculty.map((faculty, index) => (
              <div
                key={faculty.id || index}
                onClick={() => handleFacultySelect(faculty)}
                className={`cursor-pointer px-4 py-3 transition-all flex items-center gap-3 border-b border-border/50 hover:bg-primary/5 ${
                  selectedFaculty?.id === faculty.id
                    ? 'bg-primary/8 border-l-[3px] border-l-primary'
                    : 'border-l-[3px] border-l-transparent'
                }`}
              >
                <ProfileAvatar
                  size={40}
                  profileImage={faculty.profileImage}
                  className={`shrink-0 ${
                    selectedFaculty?.id === faculty.id
                      ? 'bg-primary/20 text-primary'
                      : 'bg-background-tertiary text-text-tertiary'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <Text className={`block font-medium truncate text-sm ${
                    selectedFaculty?.id === faculty.id ? 'text-text-primary' : 'text-text-primary'
                  }`}>
                    {faculty.name}
                  </Text>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Tag color="blue" className="rounded-full text-[10px] px-1.5 py-0 m-0 leading-4">
                      {faculty.assignedCount || 0}
                    </Tag>
                    <Text className="text-xs text-text-tertiary truncate">
                      {faculty.designation || 'Faculty'}
                    </Text>
                  </div>
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
      <Card className="rounded-xl border-border shadow-sm mb-4" styles={{ body: { padding: '14px 16px' } }}>
        <div className="flex items-center gap-3">
          <ProfileAvatar
            size={44}
            profileImage={selectedFaculty.profileImage}
            className="bg-primary/10 text-primary shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Text strong className="text-text-primary truncate">{selectedFaculty.name}</Text>
              <Text className="text-xs text-text-tertiary">
                • {selectedFaculty.designation || 'Faculty'} • {selectedFaculty.employeeId || selectedFaculty.email}
              </Text>
            </div>
            {/* Stats Tags below name */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag color="blue" className="rounded-full m-0 px-2 py-0 text-[11px]">
                <TeamOutlined className="mr-1" />{stats.totalStudents || 0} Students
              </Tag>
              <Tag color="green" className="rounded-full m-0 px-2 py-0 text-[11px]">
                <CheckCircleOutlined className="mr-1" />{stats.totalVisits || 0} Visits
              </Tag>
              <Tag color="purple" className="rounded-full m-0 px-2 py-0 text-[11px]">
                <RiseOutlined className="mr-1" />{stats.visitsThisMonth || 0} This Month
              </Tag>
              <Tag color="cyan" className="rounded-full m-0 px-2 py-0 text-[11px]">
                <ClockCircleOutlined className="mr-1" />{stats.visitsLastMonth || 0} Last Month
              </Tag>
              <Tag color="orange" className="rounded-full m-0 px-2 py-0 text-[11px]">
                <ScheduleOutlined className="mr-1" />{stats.scheduledNextMonth || 0} Scheduled
              </Tag>
              {stats.missedVisits > 0 && (
                <Tag color="red" className="rounded-full m-0 px-2 py-0 text-[11px]">
                  <WarningOutlined className="mr-1" />{stats.missedVisits} Missed
                </Tag>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  // Render students tab
  const renderStudentsTab = () => (
    <Card
      className="rounded-xl border-border shadow-soft bg-surface overflow-hidden"
      styles={{ body: { padding: 0 } }}
    >
      <div className="px-4 py-3 border-b border-border flex justify-between items-center">
        <Text className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">
          <TeamOutlined className="mr-1.5" />Assigned Students
        </Text>
        <Tag className="rounded-full text-xs px-2">{facultyDetails?.students?.length || 0}</Tag>
      </div>
      <Table
        columns={studentColumns}
        dataSource={facultyDetails?.students || []}
        rowKey="id"
        loading={detailsLoading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total, range) => (
            <span className="text-text-tertiary">
              Showing <strong>{range[0]}-{range[1]}</strong> of <strong>{total}</strong> students
            </span>
          ),
        }}
        scroll={{ x: 900 }}
        className="[&_.ant-table-thead>tr>th]:bg-background-tertiary/30 [&_.ant-table-thead>tr>th]:font-semibold [&_.ant-table-thead>tr>th]:text-text-secondary [&_.ant-table-thead>tr>th]:text-xs [&_.ant-table-thead>tr>th]:uppercase [&_.ant-table-row:hover>td]:bg-primary/[0.02]"
        locale={{
          emptyText: (
            <Empty
              description="No students assigned to this faculty"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              className="py-12"
            />
          ),
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
    <div className="!space-y-4">
      {/* Filters Card */}
      <Card className="rounded-xl border-border shadow-soft bg-surface" styles={{ body: { padding: '12px 16px' } }}>
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
                className="text-text-tertiary hover:text-error"
              >
                Clear
              </Button>
            )}
          </div>
          <Button
            icon={visitViewMode === 'table' ? <CalendarOutlined /> : <TableOutlined />}
            onClick={() => setVisitViewMode(visitViewMode === 'table' ? 'calendar' : 'table')}
            size="small"
            className="rounded-lg"
          >
            {visitViewMode === 'table' ? 'Calendar' : 'Table'}
          </Button>
        </div>
      </Card>

      {/* Visit Summary */}
      {facultyDetails?.visitSummary && facultyDetails.visitSummary.length > 0 && (
        <Card className="rounded-xl border-border shadow-soft bg-surface" styles={{ body: { padding: '12px' } }}>
          <Text className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3 block">
            <CalendarOutlined className="mr-1.5" />Monthly Summary
          </Text>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
            {facultyDetails.visitSummary.map((month, index) => (
              <div key={index} className={`p-2 rounded-lg border text-center ${
                month.isPast && month.visits === 0
                  ? 'border-error/30 bg-error/5'
                  : month.visits > 0
                  ? 'border-success/30 bg-success/5'
                  : 'border-border bg-background-tertiary/30'
              }`}>
                <Text className="block text-[10px] font-medium text-text-primary">
                  {month.monthName?.substring(0, 3)}
                </Text>
                <span className={`text-sm font-bold ${
                  month.isPast && month.visits === 0 ? 'text-error' : month.visits > 0 ? 'text-success' : 'text-text-tertiary'
                }`}>
                  {month.visits}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Detailed Visits - Table or Calendar View */}
      {visitViewMode === 'table' ? (
        <Card
          className="rounded-xl border-border shadow-soft bg-surface overflow-hidden"
          styles={{ body: { padding: 0 } }}
        >
          <div className="px-4 py-3 border-b border-border flex justify-between items-center">
            <Text className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">
              <FileTextOutlined className="mr-1.5" />Visit Details
            </Text>
            <Tag className="rounded-full text-xs px-2">{filteredVisits.length}</Tag>
          </div>
          <Table
            columns={visitColumns}
            dataSource={filteredVisits}
            rowKey="id"
            loading={detailsLoading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) => (
                <span className="text-text-tertiary">
                  Showing <strong>{range[0]}-{range[1]}</strong> of <strong>{total}</strong> visits
                </span>
              ),
            }}
            scroll={{ x: 1000 }}
            className="[&_.ant-table-thead>tr>th]:bg-background-tertiary/30 [&_.ant-table-thead>tr>th]:font-semibold [&_.ant-table-thead>tr>th]:text-text-secondary [&_.ant-table-thead>tr>th]:text-xs [&_.ant-table-thead>tr>th]:uppercase [&_.ant-table-row:hover>td]:bg-primary/[0.02]"
            expandable={{
              expandedRowRender: (record) => (
                <div className="p-4 bg-gradient-to-br from-background-tertiary/50 to-transparent rounded-xl mx-2 my-2 border border-border/50">
                  <Row gutter={[20, 16]}>
                    <Col xs={24} md={12}>
                      <Descriptions
                        column={1}
                        size="small"
                        className="[&_.ant-descriptions-item-label]:text-text-tertiary [&_.ant-descriptions-item-label]:font-medium"
                      >
                        <Descriptions.Item label="Title of Project/Work">
                          {record.titleOfProjectWork || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Assistance Required from Institute">
                          {record.assistanceRequiredFromInstitute || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Response from Organisation">
                          {record.responseFromOrganisation || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Remarks of Organisation Supervisor">
                          {record.remarksOfOrganisationSupervisor || 'N/A'}
                        </Descriptions.Item>
                      </Descriptions>
                    </Col>
                    <Col xs={24} md={12}>
                      <Descriptions
                        column={1}
                        size="small"
                        className="[&_.ant-descriptions-item-label]:text-text-tertiary [&_.ant-descriptions-item-label]:font-medium"
                      >
                        <Descriptions.Item label="Significant Change in Plan">
                          {record.significantChangeInPlan || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Observations about Student">
                          {record.observationsAboutStudent || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Feedback Shared with Student">
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
              emptyText: (
                <Empty
                  description="No visits recorded"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  className="py-12"
                />
              ),
            }}
          />
        </Card>
      ) : (
        <Card className="rounded-xl border-border shadow-soft bg-surface">
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
        <span className="flex items-center gap-2 px-1">
          <TeamOutlined />
          <span>Assigned Students</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
            {facultyDetails?.students?.length || 0}
          </span>
        </span>
      ),
      children: renderStudentsTab(),
    },
    {
      key: 'visits',
      label: (
        <span className="flex items-center gap-2 px-1">
          <CarOutlined />
          <span>Faculty Visits</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-bold">
            {facultyDetails?.visits?.length || 0}
          </span>
        </span>
      ),
      children: renderVisitsTab(),
    },
  ];

  return (
    <div className="p-4 md:p-6 min-h-screen bg-background-secondary">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <h1 className="text-lg font-bold text-text-primary tracking-tight">Faculty Progress Tracking</h1>
          <Text className="text-text-tertiary text-sm">Monitor faculty visits and student assignments</Text>
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
          className="rounded-lg"
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
              <Card className="rounded-2xl border-border shadow-soft bg-surface">
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
                  className="[&_.ant-tabs-tab]:rounded-lg [&_.ant-tabs-tab]:px-4 [&_.ant-tabs-tab-active]:bg-primary/5 [&_.ant-tabs-ink-bar]:bg-primary [&_.ant-tabs-ink-bar]:h-[3px] [&_.ant-tabs-ink-bar]:rounded-full"
                />
              </div>
            )
          ) : (
            <Card className="rounded-2xl border-border shadow-soft bg-surface">
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
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
              <EditOutlined className="text-warning" />
            </div>
            <div>
              <span className="text-text-primary font-semibold">Edit Internship Details</span>
              <p className="text-xs text-text-tertiary font-normal mb-0">Update student internship information</p>
            </div>
          </div>
        }
        open={editVisible}
        onCancel={() => {
          setEditVisible(false);
          editForm.resetFields();
        }}
        width={600}
        footer={null}
        forceRender
        destroyOnClose={false}
        className="[&_.ant-modal-header]:pb-4 [&_.ant-modal-header]:border-b [&_.ant-modal-header]:border-border"
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditSubmit}
          className="mt-5"
        >
          {editStudent && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-primary/5 to-transparent border border-primary/10 mb-5">
              <div className="flex items-center gap-3">
                <ProfileAvatar
                  size={48}
                  profileImage={editStudent.profileImage}
                  className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary border-2 border-primary/10"
                />
                <div>
                  <Text className="font-bold text-text-primary block text-base">{editStudent.name}</Text>
                  <Text className="text-text-secondary text-sm">{editStudent.rollNumber}</Text>
                </div>
              </div>
            </div>
          )}

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="companyName"
                label={<span className="font-medium">Company Name</span>}
                rules={[{ required: true, message: 'Company name is required' }]}
              >
                <Input placeholder="Enter company name" className="rounded-lg" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="jobProfile"
                label={<span className="font-medium">Job Profile / Role</span>}
              >
                <Input placeholder="Enter job profile" className="rounded-lg" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="stipend"
                label={<span className="font-medium">Monthly Stipend (₹)</span>}
              >
                <InputNumber
                  placeholder="Enter stipend"
                  className="w-full rounded-lg"
                  min={0}
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="internshipDuration"
                label={<span className="font-medium">Duration</span>}
              >
                <Input placeholder="e.g., 6 months" className="rounded-lg" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="internshipStatus"
                label={<span className="font-medium">Status</span>}
              >
                <Select placeholder="Select status" className="rounded-lg">
                  <Select.Option value="ONGOING">Ongoing</Select.Option>
                  <Select.Option value="IN_PROGRESS">In Progress</Select.Option>
                  <Select.Option value="COMPLETED">Completed</Select.Option>
                  <Select.Option value="APPROVED">Approved</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider className="my-5" />
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => {
                setEditVisible(false);
                editForm.resetFields();
              }}
              className="rounded-lg px-5"
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={editLoading}
              icon={<SaveOutlined />}
              className="rounded-lg px-5 shadow-md shadow-primary/20"
            >
              Save Changes
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Visit Report Details Modal */}
      <Modal
        title={
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <EyeOutlined className="text-primary" />
            </div>
            <div>
              <span className="text-text-primary font-semibold">Visit Report Details</span>
              <p className="text-xs text-text-tertiary font-normal mb-0">Complete visit information and feedback</p>
            </div>
          </div>
        }
        open={reportDetailsVisible}
        onCancel={() => {
          setReportDetailsVisible(false);
          setSelectedReport(null);
        }}
        footer={
          <Button
            onClick={() => setReportDetailsVisible(false)}
            className="rounded-lg"
          >
            Close
          </Button>
        }
        width={720}
        className="[&_.ant-modal-header]:pb-4 [&_.ant-modal-header]:border-b [&_.ant-modal-header]:border-border"
      >
        {selectedReport && (
          <div className="space-y-5 mt-5">
            {/* Visit Header Card */}
            <div className="p-5 rounded-xl bg-gradient-to-br from-primary/8 via-primary/5 to-transparent border border-primary/10">
              <Row gutter={[20, 16]}>
                <Col xs={12} sm={6}>
                  <Text className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Faculty</Text>
                  <Text className="font-semibold text-text-primary">{selectedFaculty?.name}</Text>
                </Col>
                <Col xs={12} sm={6}>
                  <Text className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Visit Date</Text>
                  <Text className="font-semibold text-text-primary">
                    {dayjs(selectedReport.visitDate).format('DD MMM YYYY')}
                  </Text>
                </Col>
                <Col xs={12} sm={6}>
                  <Text className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Student</Text>
                  <Text className="font-semibold text-text-primary block">{selectedReport.studentName}</Text>
                  <Text className="text-xs text-text-secondary font-mono">{selectedReport.studentRollNumber}</Text>
                </Col>
                <Col xs={12} sm={6}>
                  <Text className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Visit Type</Text>
                  <div className="flex items-center gap-2">
                    {getVisitTypeIcon(selectedReport.visitType)}
                    <Text className="font-semibold text-text-primary">{selectedReport.visitType}</Text>
                  </div>
                </Col>
              </Row>
            </div>

            {/* Visit Details */}
            <Descriptions
              bordered
              column={{ xs: 1, sm: 2 }}
              size="small"
              className="[&_.ant-descriptions-item-label]:bg-background-tertiary/50 [&_.ant-descriptions-item-label]:font-semibold [&_.ant-descriptions-item-label]:text-text-secondary"
            >
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
                <Tag color={getVisitStatusColor(selectedReport.status)} className="rounded-full font-medium">
                  {selectedReport.status || 'Completed'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Overall Rating" span={2}>
                {selectedReport.overallRating ? (
                  <div className="flex items-center gap-3">
                    <Rate disabled value={selectedReport.overallRating} />
                    <span className="text-sm text-text-secondary">({selectedReport.overallRating}/5)</span>
                  </div>
                ) : (
                  <Text className="text-text-tertiary italic">Not rated</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Title of Project/Work" span={2}>
                <div className="whitespace-pre-wrap text-sm">{selectedReport.titleOfProjectWork || 'N/A'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="Assistance Required from Institute" span={2}>
                <div className="whitespace-pre-wrap text-sm">{selectedReport.assistanceRequiredFromInstitute || 'N/A'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="Response from Organisation" span={2}>
                <div className="whitespace-pre-wrap text-sm">{selectedReport.responseFromOrganisation || 'N/A'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="Remarks of Organisation Supervisor" span={2}>
                <div className="whitespace-pre-wrap text-sm">{selectedReport.remarksOfOrganisationSupervisor || 'N/A'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="Significant Change in Plan" span={2}>
                <div className="whitespace-pre-wrap text-sm">{selectedReport.significantChangeInPlan || 'N/A'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="Observations about Student" span={2}>
                <div className="whitespace-pre-wrap text-sm">{selectedReport.observationsAboutStudent || 'N/A'}</div>
              </Descriptions.Item>
              <Descriptions.Item label="Feedback Shared with Student" span={2}>
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

