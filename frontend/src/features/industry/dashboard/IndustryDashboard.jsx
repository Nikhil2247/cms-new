// src/pages/industry/IndustryDashboard.jsx
import React, { useState, useEffect, memo } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Typography,
  Space,
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

// Stat Card Component - Refactored for Clean UI
const StatCard = ({ title, value, icon: Icon, colorClass, bgClass }) => (
  <Card bordered={false} className="rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all h-full bg-white dark:bg-slate-900 dark:border-slate-800">
    <div className="flex items-center gap-4 p-2">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bgClass} ${colorClass}`}>
        <Icon className="text-xl" />
      </div>
      <div>
        <div className="text-3xl font-bold text-gray-900 dark:text-white leading-none mb-1">
          {value || 0}
        </div>
        <div className="text-xs uppercase font-bold text-gray-400 dark:text-slate-500 tracking-wider">{title}</div>
      </div>
    </div>
  </Card>
);

// Floating Quick Actions Component
const FloatingQuickActions = ({ profile, dashboardData }) => {
  const navigate = useNavigate();
  return (
    <FloatButton.Group
      trigger="hover"
      type="primary"
      style={{ right: 24, bottom: 24 }}
      icon={<PlusOutlined />}
    >
      <FloatButton
        icon={<FileAddOutlined />}
        tooltip="Post Internship"
        onClick={() => navigate("/app/postings")}
      />
      <FloatButton
        icon={<ContactsOutlined />}
        tooltip="View Applications"
        onClick={() => navigate("/app/applications")}
      />
      <FloatButton
        icon={<SettingOutlined />}
        tooltip="Profile Settings"
        onClick={() => navigate("/app/company/profile")}
      />
    </FloatButton.Group>
  );
};

const IndustryDashboard = () => {
  // ... (keep state and hooks)
  // Assuming useSmartIndustry hook provides all necessary data and logic
  const {
    profile,
    dashboardData,
    loading: isLoading,
    isStale,
    forceRefresh,
    error
  } = useSmartIndustry();
  
  const navigate = useNavigate();
  const { token } = theme.useToken();

  const getStatusColor = (status) => {
    switch (status) {
      case "SELECTED": return "success";
      case "REJECTED": return "error";
      case "SHORTLISTED": return "warning";
      default: return "default"; // processing/applied
    }
  };

  const statsConfigs = [
    {
      title: "Total Internships",
      value: dashboardData?.stats?.totalInternships || 0,
      icon: ShopOutlined,
      colorClass: "text-blue-600 dark:text-blue-400",
      bgClass: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      title: "Active Positions",
      value: dashboardData?.stats?.activeInternships || 0,
      icon: CheckCircleOutlined,
      colorClass: "text-green-600 dark:text-green-400",
      bgClass: "bg-green-50 dark:bg-green-900/20",
    },
    {
      title: "Applications",
      value: dashboardData?.stats?.totalApplications || 0,
      icon: ContactsOutlined,
      colorClass: "text-cyan-600 dark:text-cyan-400",
      bgClass: "bg-cyan-50 dark:bg-cyan-900/20",
    },
    {
      title: "Selected Students",
      value: dashboardData?.stats?.selectedStudents || 0,
      icon: TrophyOutlined,
      colorClass: "text-amber-500 dark:text-amber-400",
      bgClass: "bg-amber-50 dark:bg-amber-900/20",
    },
  ];

  if (isLoading && !dashboardData) {
    return (
      <Layouts>
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-950">
          <Spin size="large" tip="Loading dashboard..." />
        </div>
      </Layouts>
    );
  }

  return (
    <Layouts>
      <div className="p-4 md:p-8 bg-background-secondary min-h-screen">
        <div className="max-w-[1600px] mx-auto space-y-8 pb-20">
          {/* Stale data indicator */}
          {isStale && (
            <Alert
              message={<span className="font-bold">Data Update Required</span>}
              description="Your dashboard data might be outdated. Click refresh to sync with the latest server data."
              type="warning"
              showIcon
              action={
                <Button
                  size="small"
                  type="primary"
                  onClick={forceRefresh}
                  className="rounded-lg bg-amber-500 hover:bg-amber-600 border-0"
                >
                  Refresh Now
                </Button>
              }
              className="rounded-xl border-amber-100 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800"
            />
          )}

          <PageHeader
            icon={ShopOutlined}
            title={`Welcome back, ${profile?.companyName || "Industry Partner"}`}
            description="Manage your internship programs and connect with talented students"
            actions={[
              profile?.isApproved ? (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate("/app/postings")}
                  key="post"
                  className="h-11 px-6 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 border-0 shadow-lg shadow-blue-200 dark:shadow-none"
                >
                  Post Internship
                </Button>
              ) : (
                <Tag color="warning" className="rounded-full px-4 py-1.5 font-bold border-0 uppercase text-[10px] tracking-widest" key="status">
                  PENDING APPROVAL
                </Tag>
              ),
            ]}
          >
            {/* Status indicator */}
            <div className="mt-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className={`w-2 h-2 rounded-full ${profile?.isApproved ? 'bg-green-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
                <Text className={`font-bold uppercase tracking-widest text-[10px] ${profile?.isApproved ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {profile?.isApproved ? 'Profile Approved' : 'Under Review'}
                </Text>
              </div>
            </div>
          </PageHeader>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
            {statsConfigs.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </div>

          {/* Modern Content Grid */}
          <Row gutter={[24, 24]} className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            {/* Recent Applications */}
            <Col xs={24} lg={16}>
              <Card
                bordered={false}
                className="rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900"
                styles={{ header: { borderBottom: '1px solid #f3f4f6', padding: '20px 24px' }, body: { padding: 0 } }}
                title={
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                      <ContactsOutlined className="text-blue-600 dark:text-blue-400 text-lg" />
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 dark:text-white text-lg block leading-tight">Recent Applications</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">Latest student applications</span>
                    </div>
                    {dashboardData.recentApplications.length > 0 && (
                      <Badge
                        count={dashboardData.recentApplications.length}
                        className="ml-auto"
                        style={{ backgroundColor: '#3b82f6' }}
                      />
                    )}
                  </div>
                }
                extra={
                  <Link to="/app/applications">
                    <Button
                      type="text"
                      className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl font-bold text-xs px-4 h-9"
                    >
                      VIEW ALL
                    </Button>
                  </Link>
                }
              >
                {dashboardData.recentApplications.length > 0 ? (
                  <div className="p-2 max-h-[600px] overflow-y-auto hide-scrollbar flex flex-col">
                    {dashboardData.recentApplications.map((item, index) => (
                      <div
                        key={item.id || index}
                        className={`
                          rounded-xl p-4 transition-all duration-200 flex items-start gap-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 group cursor-pointer
                          ${index !== dashboardData.recentApplications.length - 1 ? 'border-b border-gray-50 dark:border-slate-800' : ''}
                        `}
                        onClick={() => navigate(`/applications/${item.id}`)}
                      >
                        <Avatar
                          className="bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400 rounded-xl shrink-0"
                          size={48}
                          icon={<UserOutlined />}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div className="min-w-0">
                              <Text className="font-bold text-base text-gray-900 dark:text-white block leading-tight mb-1 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {item.studentName}
                              </Text>
                              <Text className="font-medium text-sm text-gray-500 dark:text-slate-400 truncate block">
                                Applied for <span className="text-gray-700 dark:text-slate-300 font-semibold">{item.internshipTitle}</span>
                              </Text>
                            </div>
                            <Tag
                              color={getStatusColor(item.status)}
                              className="m-0 px-3 py-1 rounded-full border-0 font-bold uppercase tracking-widest text-[10px] shrink-0"
                            >
                              {item.status.replace("_", " ")}
                            </Tag>
                          </div>
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 dark:text-slate-500 font-medium">
                            <span className="flex items-center gap-1.5">
                              <BankOutlined className="text-[10px]" />
                              {item.branch}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-600 shrink-0" />
                            <span className="flex items-center gap-1.5">
                              <CalendarOutlined className="text-[10px]" />
                              Applied {new Date(item.appliedDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-24 text-center flex flex-col items-center">
                    <Empty
                      description={false}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                    <Title level={5} className="text-gray-500 dark:text-slate-400 mt-4 !font-normal">No applications yet</Title>
                    <Text className="text-gray-400 dark:text-slate-500 text-sm">Applications will appear here once students apply</Text>
                  </div>
                )}
              </Card>
            </Col>

            {/* Active Internships */}
            <Col xs={24} lg={8}>
              <Card
                bordered={false}
                className="rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900"
                styles={{ header: { borderBottom: '1px solid #f3f4f6', padding: '20px 24px' }, body: { padding: 0 } }}
                title={
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                      <ShopOutlined className="text-green-600 dark:text-green-400 text-lg" />
                    </div>
                    <div>
                      <span className="font-bold text-gray-900 dark:text-white text-lg block leading-tight">Active Posts</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">Live internships</span>
                    </div>
                  </div>
                }
                extra={
                  <Link to="/app/postings">
                    <Button
                      type="text"
                      icon={<SettingOutlined />}
                      className="text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl font-bold text-xs px-4 h-9"
                    >                  
                      MANAGE
                    </Button>
                  </Link>
                }
              >
                {dashboardData.activeInternships.length > 0 ? (
                  <div className="p-2 max-h-[600px] overflow-y-auto hide-scrollbar flex flex-col">
                    {dashboardData.activeInternships.map((item, index) => (
                      <div
                        key={item.id || index}
                        className={`
                          rounded-xl p-4 transition-all duration-200 flex flex-col gap-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 group
                          ${index !== dashboardData.activeInternships.length - 1 ? 'border-b border-gray-50 dark:border-slate-800' : ''}
                        `}
                      >
                        <div className="w-full">
                          <div className="flex items-start gap-3 mb-4">
                            <div className="bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 p-2.5 rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                              <BankOutlined className="text-xl" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <Text className="font-bold text-base text-gray-900 dark:text-white block truncate mb-1">
                                {item.title}
                              </Text>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                                <CalendarOutlined />
                                Ends: {new Date(item.deadline).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                            <div className="flex justify-between text-[10px] uppercase font-black text-gray-400 dark:text-slate-500 mb-2 tracking-widest">
                              <span>Applicants</span>
                              <span className="text-blue-600 dark:text-blue-400">
                                {item.applications} / {item.positions}
                              </span>
                            </div>
                            <Progress
                              percent={Math.min(Math.round((item.applications / item.positions) * 100), 100)}
                              size="small"
                              strokeColor={token.colorSuccess}
                              railColor="rgba(var(--color-border), 0.1)"
                              showInfo={false}
                              className="!m-0"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-16 text-center flex flex-col items-center">
                    <Empty
                      description={false}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                    <Text className="text-gray-400 dark:text-slate-500 mt-4 mb-6 block font-medium">Post your first internship to get started</Text>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => navigate("/app/postings")}
                      className="rounded-xl font-bold bg-blue-600 hover:bg-blue-500 border-0 h-10 px-6 shadow-lg shadow-blue-200"
                    >
                      Post First Internship
                    </Button>
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    </Layouts>
  );
};

export default memo(IndustryDashboard);