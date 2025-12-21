import React, { useEffect, useState } from 'react';
import {
  Card,
  Col,
  Row,
  Typography,
  Spin,
  Button,
  Progress,
  Tooltip,
  Badge,
  Avatar,
  Empty,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  BookOutlined,
  ReadOutlined,
  NotificationOutlined,
  BellOutlined,
  EditOutlined,
  ScheduleOutlined,
  RightOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import NoticeFormModal from '../../../components/modals/NoticeFormModal';
import MixedStudentChart from '../../../components/charts/MixedStudentChart';
import UserRolesPieChart from '../../../components/charts/UserRolesPieChart';
import api from '../../../services/api';

const { Title, Text } = Typography;

// Helper functions
const getCurrentUser = () => {
  try {
    const loginData = localStorage.getItem('loginResponse');
    if (loginData) {
      return JSON.parse(loginData)?.user;
    }
    const token = localStorage.getItem('token');
    if (token) {
      return JSON.parse(atob(token.split('.')[1]));
    }
  } catch {
    return null;
  }
  return null;
};

const getInstitutionId = () => {
  try {
    const loginData = localStorage.getItem('loginResponse');
    if (loginData) {
      return JSON.parse(loginData)?.user?.institutionId;
    }
  } catch {
    return null;
  }
  return null;
};

// Stat Card Component
const StatCard = ({ title, total, active, inactive, icon, gradient, iconBg }) => (
  <Card
    className="h-full border-0 shadow-soft hover:shadow-soft-lg transition-all duration-300 rounded-2xl overflow-hidden group"
    styles={{ body: { padding: 0 } }}
  >
    <div className={`bg-linear-to-r ${gradient} p-5`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="text-4xl font-bold text-white mb-1">{total}</div>
          <div className="text-sm text-white/80 font-medium uppercase tracking-wide">
            Total {title}
          </div>
        </div>
        <div
          className={`
            p-3.5 rounded-xl ${iconBg} bg-opacity-30 backdrop-blur-sm
            group-hover:scale-110 transition-transform duration-300
          `}
        >
          {React.cloneElement(icon, { className: 'text-2xl text-white' })}
        </div>
      </div>
    </div>
    <div className="p-5 bg-white">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-text-secondary">Active Rate</span>
        <span className="text-sm font-semibold text-text-primary">
          {active} / {total}
        </span>
      </div>
      <Progress
        percent={total > 0 ? Math.round((active / total) * 100) : 0}
        showInfo={false}
        className="mb-0"
      />
      <div className="flex justify-between mt-2 text-xs">
        <span className="text-emerald-600 font-medium">{active} Active</span>
        <span className="text-text-tertiary">{inactive} Inactive</span>
      </div>
    </div>
  </Card>
);

const PrincipalDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [principalName, setPrincipalName] = useState('Principal');
  const [notices, setNotices] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [instituteName, setInstituteName] = useState('');

  useEffect(() => {
    const currentUser = getCurrentUser();
    setPrincipalName(currentUser?.name || 'Principal');
    const institutionId = getInstitutionId();

    const fetchInstitutionData = async () => {
      try {
        const response = await api.get(`/principal/dashboard`);
        const data = response.data?.data || response.data;

        // Set institution name from the new API response structure
        setInstituteName(data.institution?.name || data.institutionName || data.shortName || '');

        // Process notices
        const institutionNotices = data.notices || [];
        setNotices(institutionNotices);

        // Extract stats from the new API response structure
        const studentsData = data.students || {};
        const staffData = data.staff || {};
        const batchesCount = typeof data.batches === 'number' ? data.batches : (data.batches?.length || 0);

        // Set consolidated stats using the new response format
        setStats({
          students: {
            total: studentsData.total || 0,
            active: studentsData.active || 0,
            inactive: (studentsData.total || 0) - (studentsData.active || 0),
          },
          teachers: {
            // Teachers are part of staff in the new API
            total: staffData.total || 0,
            active: staffData.active || 0,
            inactive: (staffData.total || 0) - (staffData.active || 0),
          },
          staff: {
            total: staffData.total || 0,
            active: staffData.active || 0,
            inactive: (staffData.total || 0) - (staffData.active || 0),
          },
          batches: {
            total: batchesCount,
            active: batchesCount,
            inactive: 0,
          },
          // Additional data from new API
          internships: data.internships || {},
          pending: data.pending || {},
          assignments: data.classAssignments || [],
        });
      } catch (error) {
        console.error('Failed to fetch institution data', error);
        // Set default stats on error
        setStats({
          students: { total: 0, active: 0, inactive: 0 },
          teachers: { total: 0, active: 0, inactive: 0 },
          staff: { total: 0, active: 0, inactive: 0 },
          batches: { total: 0, active: 0, inactive: 0 },
          internships: {},
          pending: {},
          assignments: [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInstitutionData();
  }, []);

  const handleEdit = (notice) => {
    setEditingNotice(notice);
    setModalVisible(true);
  };

  const refreshData = async () => {
    try {
      const response = await api.get(`/principal/dashboard`);
      const data = response.data?.data || response.data;

      const institutionNotices = data.notices || [];
      setNotices(institutionNotices);
    } catch (error) {
      console.error('Failed to refresh data', error);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-100 gap-4">
        <Spin size="large" />
        <Text className="text-text-secondary animate-pulse">Loading dashboard...</Text>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8 text-center">
        <Text type="danger">Failed to load dashboard data</Text>
      </div>
    );
  }

  const summaryCards = [
    {
      title: 'Students',
      ...stats.students,
      icon: <ReadOutlined />,
      gradient: 'from-blue-500 to-indigo-600',
      iconBg: 'bg-blue-400',
    },
    {
      title: 'Teachers',
      ...stats.teachers,
      icon: <UserOutlined />,
      gradient: 'from-emerald-500 to-teal-600',
      iconBg: 'bg-emerald-400',
    },
    {
      title: 'Staff',
      ...stats.staff,
      icon: <TeamOutlined />,
      gradient: 'from-amber-500 to-orange-600',
      iconBg: 'bg-amber-400',
    },
    {
      title: 'Batches',
      total: stats.batches.total,
      active: stats.batches.active,
      inactive: stats.batches.inactive,
      icon: <BookOutlined />,
      gradient: 'from-rose-500 to-pink-600',
      iconBg: 'bg-rose-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-2 text-text-secondary text-sm mb-2">
            <CalendarOutlined />
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
          <Title level={2} className="!mb-1 !text-text-primary">
            Welcome back, <span className="text-primary-600">{principalName}</span>
          </Title>
          {instituteName && (
            <Text className="text-text-secondary text-base">{instituteName}</Text>
          )}
        </div>
        <Button
          type="primary"
          icon={<BellOutlined />}
          size="large"
          onClick={() => setModalVisible(true)}
          className="
            h-11 px-6 rounded-xl font-medium
            shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30
            transition-all duration-200
          "
        >
          Create Notice
        </Button>
      </div>

      {/* Summary Cards */}
      <Row gutter={[16, 16]}>
        {summaryCards.map((card, idx) => (
          <Col key={idx} xs={24} sm={12} lg={6}>
            <StatCard {...card} />
          </Col>
        ))}
      </Row>

      {/* Two Column Layout */}
      <Row gutter={[16, 16]}>
        {/* Left Column - Notices & Assignments */}
        <Col xs={24} lg={12}>
          {/* Notices Card */}
          <Card
            className="border-0 shadow-soft rounded-2xl mb-4"
            styles={{ body: { padding: '20px' } }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-50">
                  <NotificationOutlined className="text-lg text-primary-600" />
                </div>
                <Title level={4} className="!mb-0 !text-text-primary">
                  Important Notices
                </Title>
              </div>
              <Button
                type="text"
                icon={<PlusOutlined />}
                onClick={() => setModalVisible(true)}
                className="text-primary-600 hover:text-primary-700 hover:bg-primary-50 font-medium"
              >
                Add
              </Button>
            </div>

            <div className="space-y-4">
              {notices.length > 0 ? (
                notices.slice(0, 4).map((notice, index) => (
                  <div
                    key={notice.id || index}
                    className="
                      p-4 rounded-xl bg-background-tertiary border border-border/50
                      hover:bg-background-tertiary hover:border-border
                      transition-all duration-200 group
                    "
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            color={index % 2 === 0 ? 'blue' : 'orange'}
                            className="mr-1"
                          />
                          <Text strong className="text-text-primary text-base">
                            {notice.title}
                          </Text>
                        </div>
                        <Text className="text-text-secondary text-sm line-clamp-2">
                          {notice.message || notice.content}
                        </Text>
                        <div className="flex items-center gap-4 mt-3 text-xs text-text-tertiary">
                          <span className="flex items-center gap-1">
                            <ClockCircleOutlined />
                            {new Date(notice.createdAt).toLocaleDateString()}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-background-tertiary text-text-secondary">
                            {notice.category || 'General'}
                          </span>
                        </div>
                      </div>
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(notice)}
                        className="
                          opacity-0 group-hover:opacity-100
                          text-primary-600 hover:bg-primary-50
                          transition-all duration-200
                        "
                      />
                    </div>
                  </div>
                ))
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div className="text-center py-4">
                      <Text className="text-text-secondary block mb-2">No notices available</Text>
                      <Button type="link" onClick={() => setModalVisible(true)}>
                        Create your first notice
                      </Button>
                    </div>
                  }
                />
              )}
            </div>
          </Card>

          {/* Class Assignments Card */}
          <Card
            className="border-0 shadow-soft rounded-2xl"
            styles={{ body: { padding: '20px' } }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-emerald-50">
                <ScheduleOutlined className="text-lg text-emerald-600" />
              </div>
              <Title level={4} className="!mb-0 !text-text-primary">
                Class Assignments
              </Title>
            </div>

            <div className="space-y-3">
              {stats.assignments && stats.assignments.length > 0 ? (
                stats.assignments.slice(0, 5).map((assign, i) => (
                  <div
                    key={i}
                    className="
                      flex items-center gap-4 p-3 rounded-xl
                      bg-background-tertiary border border-border/50
                      hover:bg-background-tertiary transition-colors duration-200
                    "
                  >
                    <Avatar
                      size={40}
                      className={`${i % 2 === 0 ? 'bg-primary-500' : 'bg-emerald-500'} shrink-0`}
                      icon={<UserOutlined />}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Text strong className="text-text-primary truncate">
                          {assign.teacher?.name || assign.teacherName || 'Teacher'}
                        </Text>
                        <RightOutlined className="text-xs text-text-tertiary" />
                        <Text className="text-text-secondary truncate">
                          {assign.Batch?.name || assign.batchName || 'N/A'}
                        </Text>
                      </div>
                      <Text className="text-text-tertiary text-sm">
                        Academic Year: {assign.academicYear || 'Current'}
                      </Text>
                    </div>
                  </div>
                ))
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Text className="text-text-tertiary">No class assignments found</Text>
                  }
                />
              )}
            </div>
          </Card>
        </Col>

        {/* Right Column - Empty for now */}
        <Col xs={24} lg={12}>
          {/* Placeholder for future content */}
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card
            className="border-0 shadow-soft rounded-2xl h-full"
            styles={{ body: { padding: '20px' } }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-indigo-50">
                <BookOutlined className="text-lg text-indigo-600" />
              </div>
              <Title level={4} className="!mb-0 !text-text-primary">
                Student Distribution
              </Title>
            </div>
            <div className="h-80">
              <MixedStudentChart />
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            className="border-0 shadow-soft rounded-2xl h-full"
            styles={{ body: { padding: '20px' } }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-emerald-50">
                <TeamOutlined className="text-lg text-emerald-600" />
              </div>
              <Title level={4} className="!mb-0 !text-text-primary">
                Staff Distribution
              </Title>
            </div>
            <div className="h-80">
              <UserRolesPieChart />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Modals */}
      <NoticeFormModal
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditingNotice(null);
        }}
        onSuccess={refreshData}
        editingNotice={editingNotice}
      />
    </div>
  );
};

export default PrincipalDashboard;