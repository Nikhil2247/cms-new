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
  <Card size="small" className="rounded-xl border-border shadow-sm hover:shadow-md transition-all h-full">
    <div className="flex items-center gap-3 p-1">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bgClass} ${colorClass}`}>
        <Icon className="text-lg" />
      </div>
      <div>
        <div className="text-2xl font-bold text-text-primary leading-none mb-1">
          {value || 0}
        </div>
        <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-wider">{title}</div>
      </div>
    </div>
  </Card>
);

// ... (keep FloatingQuickActions as is for now)

const IndustryDashboard = () => {
  // ... (keep state and hooks)

  const statsConfigs = [
    {
      title: "Total Internships",
      value: dashboardData?.stats?.totalInternships || 0,
      icon: ShopOutlined,
      colorClass: "text-primary",
      bgClass: "bg-primary/10",
    },
    {
      title: "Active Positions",
      value: dashboardData?.stats?.activeInternships || 0,
      icon: CheckCircleOutlined,
      colorClass: "text-success",
      bgClass: "bg-success/10",
    },
    {
      title: "Applications",
      value: dashboardData?.stats?.totalApplications || 0,
      icon: ContactsOutlined,
      colorClass: "text-info",
      bgClass: "bg-info/10",
    },
    {
      title: "Selected Students",
      value: dashboardData?.stats?.selectedStudents || 0,
      icon: TrophyOutlined,
      colorClass: "text-warning",
      bgClass: "bg-warning/10",
    },
  ];

  return (
    <Layouts>
      <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stale data indicator */}
          {isStale && (
            <Alert
              title="Data update required"
              description="Your dashboard data might be outdated. Click refresh to sync."
              type="warning"
              showIcon
              action={
                <Button
                  size="small"
                  type="primary"
                  onClick={forceRefresh}
                  className="rounded-lg"
                >
                  Refresh
                </Button>
              }
              className="rounded-xl border-warning/20 bg-warning-50/50"
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
                  onClick={() => navigate("/postings")}
                  key="post"
                  className="h-10 rounded-xl font-bold bg-primary border-0 shadow-lg shadow-primary/20"
                >
                  Post Internship
                </Button>
              ) : (
                <Tag color="warning" className="rounded-full px-4 py-1 font-bold border-0 uppercase text-[10px] tracking-widest" key="status">
                  PENDING APPROVAL
                </Tag>
              ),
            ]}
          >
            {/* Status indicator */}
            <div className="mt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background-tertiary border border-border">
                <div className={`w-2 h-2 rounded-full ${profile?.isApproved ? 'bg-success animate-pulse' : 'bg-warning animate-pulse'}`} />
                <Text className={`font-bold uppercase tracking-widest text-[10px] ${profile?.isApproved ? 'text-success' : 'text-warning'}`}>
                  {profile?.isApproved ? 'Profile Approved' : 'Under Review'}
                </Text>
              </div>
            </div>
          </PageHeader>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statsConfigs.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </div>

          {/* Modern Content Grid */}
          <Row gutter={[24, 24]}>
            {/* Recent Applications */}
            <Col xs={24} lg={16}>
              <Card
                className="rounded-2xl border-border shadow-sm overflow-hidden bg-surface"
                styles={{ header: { borderBottom: '1px solid var(--color-border)', padding: '16px 24px' }, body: { padding: 0 } }}
                title={
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ContactsOutlined className="text-primary" />
                    </div>
                    <span className="font-bold text-text-primary text-base">Recent Applications</span>
                    <Badge
                      count={dashboardData.recentApplications.length}
                      className="ml-auto"
                      style={{ backgroundColor: 'rgb(var(--color-primary))' }}
                    />
                  </div>
                }
                extra={
                  <Link to="/applications">
                    <Button
                      type="text"
                      icon={<EyeOutlined />}
                      className="text-primary hover:bg-primary/10 rounded-xl font-bold text-xs px-4"
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
                          rounded-xl p-4 transition-all duration-200 flex items-start gap-4 hover:bg-background-tertiary
                          ${index !== dashboardData.recentApplications.length - 1 ? 'border-b border-border/50' : ''}
                        `}
                      >
                        <Avatar
                          className="bg-primary/10 text-primary border-primary/20 rounded-xl shrink-0"
                          size={48}
                          icon={<UserOutlined />}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div className="min-w-0">
                              <Text className="font-bold text-base text-text-primary block leading-none mb-1 truncate">
                                {item.studentName}
                              </Text>
                              <Text className="font-medium text-sm text-primary truncate block">
                                {item.internshipTitle}
                              </Text>
                            </div>
                            <Tag
                              color={getStatusColor(item.status)}
                              className="m-0 px-3 py-0.5 rounded-full border-0 font-bold uppercase tracking-widest text-[10px] shrink-0"
                            >
                              {item.status.replace("_", " ")}
                            </Tag>
                          </div>
                          <div className="flex items-center gap-4 mt-3 text-xs text-text-tertiary font-medium">
                            <span className="flex items-center gap-1.5">
                              <BankOutlined className="text-[10px]" />
                              {item.branch}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-text-tertiary opacity-30 shrink-0" />
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
                  <div className="p-20 text-center flex flex-col items-center">
                    <Empty
                      description={false}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                    <Title level={5} className="text-text-secondary mt-4">No applications yet</Title>
                    <Text className="text-text-tertiary">Applications will appear here once students apply</Text>
                  </div>
                )}
              </Card>
            </Col>

            {/* Active Internships */}
            <Col xs={24} lg={8}>
              <Card
                className="rounded-2xl border-border shadow-sm overflow-hidden bg-surface"
                styles={{ header: { borderBottom: '1px solid var(--color-border)', padding: '16px 24px' }, body: { padding: 0 } }}
                title={
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                      <ShopOutlined className="text-success" />
                    </div>
                    <span className="font-bold text-text-primary text-base">Active Internships</span>
                  </div>
                }
                extra={
                  <Link to="/postings">
                    <Button
                      type="text"
                      icon={<SettingOutlined />}
                      className="text-success hover:bg-success/10 rounded-xl font-bold text-xs px-4"
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
                          rounded-xl p-4 transition-all duration-200 flex flex-col gap-4 hover:bg-background-tertiary
                          ${index !== dashboardData.activeInternships.length - 1 ? 'border-b border-border/50' : ''}
                        `}
                      >
                        <div className="w-full">
                          <div className="flex items-start gap-3 mb-4">
                            <div className="bg-success/10 text-success p-2 rounded-xl shrink-0">
                              <BankOutlined className="text-lg" />
                            </div>
                            <div className="min-w-0">
                              <Text className="font-bold text-sm text-text-primary block truncate mb-1">
                                {item.title}
                              </Text>
                              <div className="flex items-center gap-2 text-[10px] text-text-tertiary font-bold uppercase tracking-wider">
                                <CalendarOutlined />
                                Ends: {new Date(item.deadline).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-background-secondary p-3 rounded-xl border border-border/50">
                            <div className="flex justify-between text-[10px] uppercase font-black text-text-tertiary mb-2 tracking-widest">
                              <span>Applicants</span>
                              <span className="text-primary">
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
                  <div className="p-12 text-center flex flex-col items-center">
                    <Empty
                      description={false}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                    <Text className="text-text-tertiary mt-4 mb-4">Post your first internship to get started</Text>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => navigate("/postings")}
                      className="rounded-xl font-bold bg-primary border-0"
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

      {/* Floating Quick Actions */}
      <FloatingQuickActions profile={profile} dashboardData={dashboardData} />
    </Layouts>
  );
};

export default memo(IndustryDashboard);