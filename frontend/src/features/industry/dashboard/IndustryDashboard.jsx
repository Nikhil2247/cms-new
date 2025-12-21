// src/pages/industry/IndustryDashboard.jsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Typography,
  Space,
  List,
  Tag,
  Empty,
  Spin,
  Alert,
  Progress,
  Avatar,
  Divider,
  FloatButton,
  Badge,
  Tooltip,
  theme,
} from "antd";
import {
  ShopOutlined,
  FileAddOutlined,
  ContactsOutlined,
  StarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  TrophyOutlined,
  UserOutlined,
  BankOutlined,
  SettingOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  GlobalOutlined,
  DashboardOutlined,
  CalendarOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";

import API from "../../../services/api";
import Layouts from "../../../components/Layout";
import { useThemeStyles } from "../../../hooks/useThemeStyles";
import ResponsiveContainer from "../../../components/ResponsiveContainer";
import PageHeader from "../../../components/PageHeader";
import { useSmartIndustry } from "../../../hooks";

const { Title, Text, Paragraph } = Typography;

// Professional StatCard Component with minimalistic design
const StatCard = ({
  icon,
  title,
  value,
  trend,
  trendColor = "green",
  iconColor = "#3B82F6",
  bgColor = "#F8FAFC",
}) => {
  const { token } = theme.useToken();
  
  return (
    <Card className="h-full border-0 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Text className="text-sm font-medium text-secondary mb-1">
              {title}
            </Text>
            <div className="flex items-baseline gap-2">
              <Text className="text-2xl font-bold">
                {value || 0}
              </Text>
              {trend && (
                <span className="text-xs font-medium" style={{ color: trendColor === 'green' ? token.colorSuccess : token.colorError }}>
                  {trend > 0 ? "+" : ""}
                  {trend}%
                </span>
              )}
            </div>
          </div>
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: bgColor, color: iconColor }}
          >
            {React.cloneElement(icon, { className: "w-6 h-6" })}
          </div>
        </div>
      </div>
    </Card>
  );
};

// Floating Quick Actions Component
const FloatingQuickActions = ({ profile, dashboardData }) => {
  const navigate = useNavigate();

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <FloatButton.Group
      trigger="click"
      type="primary"
      style={{
        right: 24,
        bottom: 24,
        zIndex: 1000,
      }}
      icon={<ThunderboltOutlined />}
      tooltip="Quick Actions"
      className="floating-actions-group"
    >
      {/* Industry Profile */}
      <Tooltip title="Industry Profile" placement="left">
        <FloatButton
          icon={<UserOutlined />}
          onClick={() => handleNavigation("/industry/profile")}
        />
      </Tooltip>

      {/* Post New Internship - Tab Page */}
      <Tooltip title="Post New Internship" placement="left">
        <FloatButton
          icon={<FileAddOutlined />}
          onClick={() => handleNavigation("/industry/internships?tab=post")}
          disabled={!profile?.isApproved}
          style={{
            opacity: !profile?.isApproved ? 0.5 : 1,
          }}
        />
      </Tooltip>

      {/* Manage Internships - Tab Page */}
      <Tooltip title="Manage Internships" placement="left">
        <FloatButton
          icon={<SettingOutlined />}
          onClick={() => handleNavigation("/industry/internships?tab=manage")}
          badge={{
            count: dashboardData?.stats?.activeInternships || 0,
            size: "small",
          }}
        />
      </Tooltip>

      {/* View Applicants - Tab Page */}
      <Tooltip title="View Applicants" placement="left">
        <FloatButton
          icon={<ContactsOutlined />}
          onClick={() =>
            handleNavigation("/industry/internships?tab=applicants")
          }
          badge={{
            count: dashboardData?.stats?.totalApplications || 0,
            size: "small",
          }}
        />
      </Tooltip>

      {/* Monthly Feedback - Reports Tab */}
      <Tooltip title="Monthly Feedback" placement="left">
        <FloatButton
          icon={<StarOutlined />}
          onClick={() => handleNavigation("/industry/reports?tab=monthly")}
        />
      </Tooltip>

      {/* Completion Feedback - Reports Tab */}
      <Tooltip title="Completion Feedback" placement="left">
        <FloatButton
          icon={<CheckCircleOutlined />}
          onClick={() => handleNavigation("/industry/reports?tab=completion")}
        />
      </Tooltip>
    </FloatButton.Group>
  );
};

const IndustryDashboard = () => {
  // Use smart fetching hook
  const { data: profile, loading, error, isStale, forceRefresh, clearError } =
    useSmartIndustry();
  const navigate = useNavigate();
  // const [loading, setLoading] = useState(true);
  // const [profile, setProfile] = useState(null);
  // const [error, setError] = useState(null);
  const { token } = theme.useToken();
  const styles = useThemeStyles();
  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalInternships: 0,
      activeInternships: 0,
      totalApplications: 0,
      selectedStudents: 0,
    },
    recentApplications: [],
    activeInternships: [],
  });

  // Process dashboard data when profile changes
  useEffect(() => {
    if (profile && profile.internships) {
      processDashboardData(profile);
    }
  }, [profile]);

  const processDashboardData = (profileData) => {
    const internships = profileData.internships || [];

    setDashboardData({
      stats: {
        totalInternships: internships.length,
        activeInternships: internships.filter(
          (internship) => internship.status === "ACTIVE"
        ).length,
        totalApplications: internships.reduce(
          (acc, internship) => acc + (internship?.applications?.length || 0),
          0
        ),
        selectedStudents: internships.reduce((acc, internship) => {
          const selectedCount =
            internship?.applications?.filter(
              (application) => application.status === "SELECTED"
            ).length || 0;
          return acc + selectedCount;
        }, 0),
      },
      recentApplications: internships
        .flatMap((internship) =>
          (internship.applications || []).map((app) => ({
            id: app.id,
            studentName: app.student?.name || "Unknown",
            internshipTitle: internship.title,
            appliedDate: app.appliedDate,
            status: app.status,
            branch: app.student?.branch || "N/A",
          }))
        )
        .sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate))
        .slice(0, 5),
      activeInternships: internships
        .filter((internship) => internship.status === "ACTIVE")
        .map((internship) => ({
          id: internship.id,
          title: internship.title,
          applications: internship.applications?.length || 0,
          positions: internship.numberOfPositions,
          deadline: internship.applicationDeadline,
          status: internship.status,
        })),
    });
  };

  const handleNavigation = (path) => {
    navigate(path);
  };
  // const fetchDashboardData = async () => {
  //   setLoading(true);
  //   try {
  //     const response = await API.get("/industries/profile");
  //     const profileData = response.data;

  //     if (!profileData || !profileData.internships) {
  //       console.error("Profile data or internships are not available.");
  //       setDashboardData({
  //         stats: {
  //           totalInternships: 0,
  //           activeInternships: 0,
  //           totalApplications: 0,
  //           selectedStudents: 0,
  //         },
  //         recentApplications: [],
  //         activeInternships: [],
  //       });
  //       setLoading(false);
  //       return;
  //     }

  //     setProfile(profileData);
  //     await new Promise((resolve) => setTimeout(resolve, 1000));

  //     setDashboardData({
  //       stats: {
  //         totalInternships: profileData.internships.length,
  //         activeInternships: profileData.internships.filter(
  //           (internship) => internship.status === "ACTIVE"
  //         ).length,
  //         totalApplications: profileData.internships.reduce(
  //           (acc, internship) => acc + (internship?.applications?.length || 0),
  //           0
  //         ),
  //         selectedStudents: profileData.internships.reduce(
  //           (acc, internship) => {
  //             const selectedCount =
  //               internship?.applications?.filter(
  //                 (application) => application.status === "SELECTED"
  //               ).length || 0;
  //             return acc + selectedCount;
  //           },
  //           0
  //         ),
  //       },
  //       recentApplications: profileData.internships
  //         .flatMap((internship) =>
  //           internship.applications.map((app) => ({
  //             id: app.id,
  //             studentName: app.student.name,
  //             internshipTitle: internship.title,
  //             appliedDate: app.appliedDate,
  //             status: app.status,
  //             branch: app.student.branch,
  //           }))
  //         )
  //         .sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate))
  //         .slice(0, 5), // Show more recent applications
  //       activeInternships: profileData.internships
  //         .filter((internship) => internship.status === "ACTIVE")
  //         .map((internship) => ({
  //           id: internship.id,
  //           title: internship.title,
  //           applications: internship.applications.length,
  //           positions: internship.numberOfPositions,
  //           deadline: internship.applicationDeadline,
  //           status: internship.status,
  //         })),
  //     });
  //   } catch (error) {
  //     console.error("Error fetching dashboard data:", error);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const getStatusColor = (status) => {
    const colors = {
      APPLIED: "blue",
      UNDER_REVIEW: "orange",
      SELECTED: "green",
      REJECTED: "red",
      ACTIVE: "green",
      INACTIVE: "gray",
    };
    return colors[status] || "default";
  };

  const getStatusIcon = (status) => {
    const icons = {
      APPLIED: <ClockCircleOutlined />,
      UNDER_REVIEW: <ClockCircleOutlined />,
      SELECTED: <CheckCircleOutlined />,
      REJECTED: <ClockCircleOutlined />,
      ACTIVE: <CheckCircleOutlined />,
      INACTIVE: <ClockCircleOutlined />,
    };
    return icons[status] || <ClockCircleOutlined />;
  };

  if (loading) {
    return (
      <Layouts>
        <div className="min-h-screen bg-background-secondary relative overflow-hidden">
          <div className="flex flex-col items-center justify-center min-h-screen p-4 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary flex items-center justify-center mb-6 shadow-md">
              <ShopOutlined className="text-2xl" />
            </div>

            <div className="text-center max-w-md">
              <Title level={3} className="text-text-primary mb-4">
                Loading Your Dashboard
              </Title>
              <Text className="text-text-secondary block mb-6">
                Preparing your internship management center...
              </Text>
              <Spin size="large" />
            </div>
          </div>
        </div>
      </Layouts>
    );
  }

  // Error state
  if (error) {
    return (
      <Layouts>
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background-secondary">
          <Alert
            message="Error Loading Dashboard"
            description={error}
            type="error"
            showIcon
            className="mb-4 rounded-xl border-error/20"
          />
          <Button
            type="primary"
            onClick={forceRefresh}
            icon={<ReloadOutlined />}
            className="rounded-lg shadow-md"
          >
            Retry
          </Button>
        </div>
      </Layouts>
    );
  }

  // No profile state
  if (!profile) {
    return (
      <Layouts>
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background-secondary">
          <Empty
            description="No profile found. Please complete your company profile first."
            className="mb-6"
          />
          <Button
            type="primary"
            onClick={() => navigate("/industry/profile")}
            icon={<UserOutlined />}
            size="large"
            className="rounded-xl shadow-lg"
          >
            Complete Profile
          </Button>
        </div>
      </Layouts>
    );
  }

  const stats = [
    {
      title: "Total Internships",
      value: dashboardData?.stats?.totalInternships || 0,
      icon: ShopOutlined,
      color: token.colorPrimary,
      trend: 12,
    },
    {
      title: "Active Positions",
      value: dashboardData?.stats?.activeInternships || 0,
      icon: CheckCircleOutlined,
      color: token.colorSuccess,
      trend: 8,
    },
    {
      title: "Applications",
      value: dashboardData?.stats?.totalApplications || 0,
      icon: ContactsOutlined,
      color: token.colorInfo,
      trend: -3,
    },
    {
      title: "Selected Students",
      value: dashboardData?.stats?.selectedStudents || 0,
      icon: TrophyOutlined,
      color: token.colorWarning,
      trend: 15,
    },
  ];

  return (
    <Layouts>
      {/* Stale data indicator */}
      {isStale && (
        <Alert
          title="Data may be outdated"
          description="Your dashboard data might not reflect the latest changes. Click refresh to update."
          type="warning"
          showIcon
          action={
            <Button
              size="small"
              type="primary"
              onClick={forceRefresh}
              icon={<ReloadOutlined />}
            >
              Refresh
            </Button>
          }
          className="mb-4 rounded-lg"
        />
      )}
      {/* <ResponsiveContainer withPattern> */}
      <PageHeader
        icon={ShopOutlined}
        title={`Welcome back, ${profile?.companyName || "Industry Partner"}`}
        description="Manage your internship programs and connect with talented students"
        actions={[
          profile?.isApproved ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/industry/post-internship")}
              key="post"
              className="rounded-lg shadow-md shadow-primary/20"
            >
              Post Internship
            </Button>
          ) : (
            <Tag color="warning" className="rounded-md px-3 py-1 font-medium" key="status">
              Profile Pending Approval
            </Tag>
          ),
        ]}
      >
        {/* Status indicator */}
        <div className="mt-4">
          {profile?.isApproved ? (
            <Space className="flex items-center">
              <div
                className="w-2 h-2 rounded-full bg-success animate-pulse"
              />
              <Text className="text-success-600 font-semibold uppercase tracking-wider text-[10px]">
                Profile Approved
              </Text>
            </Space>
          ) : (
            <Space className="flex items-center">
              <div
                className="w-2 h-2 rounded-full bg-warning animate-pulse"
              />
              <Text className="text-warning-600 font-semibold uppercase tracking-wider text-[10px]">
                Pending Review
              </Text>
            </Space>
          )}
        </div>
      </PageHeader>

      {/* Stats Grid */}
      <Row gutter={[16, 16]} className="mb-6">
        {stats.map((stat, index) => (
          <Col xs={12} sm={12} lg={6} key={index}>
            <Card className="shadow-sm border-border rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Text
                    className="text-text-tertiary text-[10px] uppercase tracking-wider font-bold block mb-1"
                  >
                    {stat.title}
                  </Text>
                  <Text
                    className="text-2xl font-bold block text-text-primary"
                  >
                    {stat.value}
                  </Text>
                </div>
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary`}
                  style={{ backgroundColor: `${stat.color}20`, color: stat.color }}
                >
                  <stat.icon className="text-lg" />
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Approval Status Alert */}
      {!profile?.isApproved && (
        <Alert
          message="Profile Under Review"
          description="Your company profile is currently under review by the institution. You can post internships once approved."
          type="warning"
          showIcon
          className="mb-5 rounded-xl border-warning/20 bg-warning-50/50"
        />
      )}

      {/* Modern Content Grid */}
      <Row gutter={[24, 24]}>
        {/* Recent Applications */}
        <Col xs={24} lg={16}>
          <Card
            className="border-border shadow-sm rounded-xl"
            title={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ContactsOutlined className="text-primary" />
                  <span className="font-semibold text-text-primary">Recent Applications</span>
                </div>
                {dashboardData.recentApplications.length > 0 && (
                  <Badge
                    count={dashboardData.recentApplications.length}
                    className="ml-2"
                  />
                )}
              </div>
            }
            extra={
              <Link to="/industry/internships?tab=applicants">
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  className="text-primary hover:bg-primary-50 rounded-lg font-medium"
                >
                  View All
                </Button>
              </Link>
            }
            styles={{ body: { padding: "0" } }}
          >
            {dashboardData.recentApplications.length > 0 ? (
              <div className="p-4 max-h-[600px] overflow-y-auto hide-scrollbar">
                <List
                  dataSource={dashboardData.recentApplications}
                  renderItem={(item) => (
                    <List.Item className="rounded-xl p-4 border-b border-border/50 last:border-0 hover:bg-surface-hover transition-colors duration-200">
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            style={{ background: `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimaryHover} 100%)` }}
                            size="large"
                            icon={<UserOutlined />}
                            className="shadow-sm"
                          />
                        }
                        title={
                          <div className="flex justify-between items-start">
                            <div>
                              <Text className="font-semibold text-base text-text-primary">
                                {item.studentName}
                              </Text>
                              <div className="mt-0.5">
                                <Text className="font-medium text-sm text-primary">
                                  {item.internshipTitle}
                                </Text>
                              </div>
                            </div>
                            <Tag
                              color={getStatusColor(item.status)}
                              className="ml-2 px-3 py-1 rounded-full border-0 font-medium"
                            >
                              <span className="flex items-center gap-1.5">
                                {getStatusIcon(item.status)}
                                {item.status.replace("_", " ")}
                              </span>
                            </Tag>
                          </div>
                        }
                        description={
                          <div className="flex items-center gap-4 mt-2 text-xs text-text-secondary">
                            <span className="flex items-center gap-1">
                              <BankOutlined className="text-text-tertiary" />
                              {item.branch}
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarOutlined className="text-text-tertiary" />
                              Applied {new Date(item.appliedDate).toLocaleDateString()}
                            </span>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            ) : (
              <div className="p-12 text-center">
                <Empty
                  description={
                    <div className="space-y-1">
                      <Text className="text-text-secondary text-lg font-medium">
                        No applications yet
                      </Text>
                      <br />
                      <Text className="text-text-tertiary text-sm">
                        Applications will appear here once students apply
                      </Text>
                    </div>
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            )}
          </Card>
        </Col>

        {/* Active Internships */}
        <Col xs={24} lg={8}>
          <Card
            className="border-border shadow-sm rounded-xl"
            title={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShopOutlined className="text-success" />
                  <span className="font-semibold text-text-primary">Active Internships</span>
                </div>
                {dashboardData.activeInternships.length > 0 && (
                  <Badge
                    count={dashboardData.activeInternships.length}
                    color={token.colorSuccess}
                  />
                )}
              </div>
            }
            extra={
              <Link to="/industry/internships?tab=manage">
                <Button
                  type="text"
                  size="small"
                  icon={<SettingOutlined />}
                  className="text-success hover:bg-success-50 rounded-lg font-medium"
                >                  
                  Manage All
                </Button>
              </Link>
            }
            styles={{ body: { padding: "0" } }}
          >
            {dashboardData.activeInternships.length > 0 ? (
              <div className="p-4 max-h-[600px] overflow-y-auto hide-scrollbar">
                <List
                  dataSource={dashboardData.activeInternships}
                  renderItem={(item) => (
                    <List.Item className="rounded-xl p-4 border-b border-border/50 last:border-0 hover:bg-surface-hover transition-colors duration-200">
                      <List.Item.Meta
                        avatar={
                          <div className="bg-success-50 text-success p-2.5 rounded-xl border border-success-border/30">
                            <BankOutlined className="text-lg" />
                          </div>
                        }
                        title={
                          <div>
                            <Text className="font-semibold text-sm text-text-primary line-clamp-1">
                              {item.title}
                            </Text>
                            <div className="mt-3">
                              <div className="flex justify-between text-[10px] uppercase font-bold text-text-tertiary mb-1">
                                <span>Applicants</span>
                                <span className="text-text-primary">
                                  {item.applications}/{item.positions}
                                </span>
                              </div>
                              <Progress
                                percent={Math.min(
                                  Math.round(
                                    (item.applications / item.positions) * 100
                                  ),
                                  100
                                )}
                                size="small"
                                strokeColor={token.colorSuccess}
                                trailColor="rgba(var(--color-border), 0.2)"
                                showInfo={false}
                                className="!m-0"
                              />
                            </div>
                          </div>
                        }
                        description={
                          <div className="flex items-center gap-4 mt-2 text-[10px] text-text-tertiary font-medium">
                            <span className="flex items-center gap-1">
                              <CalendarOutlined />
                              Deadline: {new Date(item.deadline).toLocaleDateString()}
                            </span>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            ) : (
              <div className="p-8 text-center">
                <Empty
                  description={
                    <div className="space-y-1">
                      <Text className="text-text-secondary font-medium">
                        No active internships
                      </Text>
                      <br />
                      <Text className="text-text-tertiary text-xs">
                        Post your first internship to get started
                      </Text>
                    </div>
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button
                    type="primary"
                    icon={<FileAddOutlined />}
                    onClick={() =>
                      navigate("/industry/post-internship")
                    }
                    className="mt-4 rounded-lg"
                  >
                    Post First Internship
                  </Button>
                </Empty>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Floating Quick Actions */}
      <FloatingQuickActions profile={profile} dashboardData={dashboardData} />
      {/* </ResponsiveContainer> */}
    </Layouts>
  );
};

export default IndustryDashboard;