import React, { useEffect, useState } from 'react';
import {
  Card,
  Col,
  Row,
  Typography,
  Spin,
  Button,
  Badge,
  Avatar,
  Empty,
  Tooltip
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
  BankOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import NoticeFormModal from '../../../components/modals/NoticeFormModal';
import MixedStudentChart from '../../../components/charts/MixedStudentChart';
import UserRolesPieChart from '../../../components/charts/UserRolesPieChart';
import api from '../../../services/api';

const { Title, Text, Paragraph } = Typography;

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

// Stat Card Component - Clean Style
const StatCard = ({ title, total, icon, bgClass, colorClass }) => (
  <Card
    className="h-full border-border shadow-sm hover:shadow-md transition-all duration-300 rounded-xl"
    styles={{ body: { padding: '16px' } }}
  >
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bgClass} ${colorClass}`}>
        {React.cloneElement(icon, { style: { fontSize: '20px' } })}
      </div>
      <div>
        <div className="text-2xl font-bold text-text-primary mb-0 leading-none">{total}</div>
        <div className="text-xs uppercase font-bold text-text-tertiary mt-1 tracking-wide">
          Total {title}
        </div>
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
      <div className="flex flex-col justify-center items-center h-screen gap-4">
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
      bgClass: 'bg-blue-500/10',
      colorClass: 'text-blue-500',
    },
    {
      title: 'Teachers',
      ...stats.teachers,
      icon: <UserOutlined />,
      bgClass: 'bg-emerald-500/10',
      colorClass: 'text-emerald-500',
    },
    {
      title: 'Staff',
      ...stats.staff,
      icon: <TeamOutlined />,
      bgClass: 'bg-amber-500/10',
      colorClass: 'text-amber-500',
    },
    {
      title: 'Batches',
      total: stats.batches.total,
      active: stats.batches.active,
      inactive: stats.batches.inactive,
      icon: <BookOutlined />,
      bgClass: 'bg-rose-500/10',
      colorClass: 'text-rose-500',
    },
  ];

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-primary shadow-sm mr-3">
              <BankOutlined className="text-lg" />
            </div>
            <div>
              <Title level={2} className="mb-0 text-text-primary text-2xl">
                Principal Dashboard
              </Title>
              <Paragraph className="text-text-secondary text-sm mb-0">
                Welcome back, <span className="font-semibold text-primary">{principalName}</span> • {currentDate}
              </Paragraph>
            </div>
          </div>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
            className="h-10 rounded-xl font-bold shadow-lg shadow-primary/20"
          >
            Create Notice
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card, idx) => (
            <StatCard key={idx} {...card} />
          ))}
        </div>

        {/* Two Column Layout */}
        <Row gutter={[16, 16]}>
          {/* Left Column - Notices & Assignments */}
          <Col xs={24} lg={12}>
            {/* Notices Card */}
            <Card
              className="border-border shadow-sm rounded-xl mb-4"
              styles={{ body: { padding: '20px' } }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <NotificationOutlined className="text-lg text-primary" />
                  </div>
                  <Title level={4} className="!mb-0 !text-text-primary text-lg">
                    Important Notices
                  </Title>
                </div>
                <Button
                  type="text"
                  icon={<PlusOutlined />}
                  onClick={() => setModalVisible(true)}
                  className="text-primary hover:text-primary-600 hover:bg-primary/5 font-medium rounded-lg"
                >
                  Add
                </Button>
              </div>

              <div className="space-y-3">
                {notices.length > 0 ? (
                  notices.slice(0, 4).map((notice, index) => (
                    <div
                      key={notice.id || index}
                      className="
                        p-4 rounded-xl bg-surface border border-border/50
                        hover:border-primary/30
                        transition-all duration-200 group
                      "
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              status={index % 2 === 0 ? 'processing' : 'warning'}
                            />
                            <Text strong className="text-text-primary">
                              {notice.title}
                            </Text>
                          </div>
                          <Text className="text-text-secondary text-sm line-clamp-2 block mb-2">
                            {notice.message || notice.content}
                          </Text>
                          <div className="flex items-center gap-4 text-xs text-text-tertiary">
                            <span className="flex items-center gap-1">
                              <ClockCircleOutlined />
                              {new Date(notice.createdAt).toLocaleDateString()}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-background-tertiary text-text-secondary">
                              {notice.category || 'General'}
                            </span>
                          </div>
                        </div>
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleEdit(notice)}
                          className="
                            opacity-0 group-hover:opacity-100
                            text-primary hover:bg-primary/10
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
              className="border-border shadow-sm rounded-xl"
              styles={{ body: { padding: '20px' } }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <ScheduleOutlined className="text-lg text-emerald-500" />
                </div>
                <Title level={4} className="!mb-0 !text-text-primary text-lg">
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
                        bg-surface border border-border/50
                        hover:bg-background-tertiary transition-colors duration-200
                      "
                    >
                      <Avatar
                        size={40}
                        className={`${i % 2 === 0 ? 'bg-primary' : 'bg-emerald-500'} shrink-0`}
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

          {/* Right Column - Charts */}
          <Col xs={24} lg={12} className="space-y-4">
             <Card
                className="border-border shadow-sm rounded-xl"
                styles={{ body: { padding: '20px' } }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-indigo-500/10">
                    <BookOutlined className="text-lg text-indigo-500" />
                  </div>
                  <Title level={4} className="!mb-0 !text-text-primary text-lg">
                    Student Distribution
                  </Title>
                </div>
                <div className="h-80">
                  <MixedStudentChart />
                </div>
              </Card>

              <Card
                className="border-border shadow-sm rounded-xl"
                styles={{ body: { padding: '20px' } }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <TeamOutlined className="text-lg text-emerald-500" />
                  </div>
                  <Title level={4} className="!mb-0 !text-text-primary text-lg">
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
    </div>
  );
};

export default PrincipalDashboard;