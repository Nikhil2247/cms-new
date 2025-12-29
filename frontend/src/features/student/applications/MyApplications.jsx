import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, Tabs, Empty, Spin, Button, Typography, Row, Col, Tag, Statistic, theme } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  ExportOutlined,
  BankOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

import {
  ApplicationsTable,
  ApplicationDetailsView,
} from './components';
import { useMonthlyReports, useFacultyVisits } from './hooks/useApplications';
import { fetchApplications } from '../store/studentSlice';
import {
  selectApplicationsLoading,
  selectPlatformApplications,
  selectSelfIdentifiedApplications,
  selectApplicationsLastFetched,
} from '../store/studentSelectors';

const { Title, Text } = Typography;

const MyApplications = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { token } = theme.useToken();

  // Redux state
  const loading = useSelector(selectApplicationsLoading);
  const applications = useSelector(selectPlatformApplications);
  const selfIdentifiedApplications = useSelector(selectSelfIdentifiedApplications);
  const lastFetched = useSelector(selectApplicationsLastFetched);

  // Memoize derived data
  const derivedData = useMemo(() => {
    const platformCount = applications?.length || 0;
    const selfIdentifiedCount = selfIdentifiedApplications?.length || 0;
    const totalCount = platformCount + selfIdentifiedCount;
    const hasPlatformApplications = platformCount > 0;
    const hasSelfIdentifiedApplications = selfIdentifiedCount > 0;
    const hasAnyApplications = totalCount > 0;

    // Count by status
    const allApps = [...(applications || []), ...(selfIdentifiedApplications || [])];
    const activeCount = allApps.filter(a =>
      ['SELECTED', 'APPROVED', 'JOINED'].includes(a.status)
    ).length;
    const pendingCount = allApps.filter(a =>
      ['APPLIED', 'SHORTLISTED', 'PENDING'].includes(a.status)
    ).length;

    return {
      platformCount,
      selfIdentifiedCount,
      totalCount,
      hasPlatformApplications,
      hasSelfIdentifiedApplications,
      hasAnyApplications,
      activeCount,
      pendingCount,
    };
  }, [applications, selfIdentifiedApplications]);

  // Fetch applications on mount
  useEffect(() => {
    if (!lastFetched) {
      dispatch(fetchApplications({}));
    }
  }, [dispatch, lastFetched]);

  const refetch = useCallback(() => {
    dispatch(fetchApplications({ forceRefresh: true }));
  }, [dispatch]);

  // State
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showDetailsView, setShowDetailsView] = useState(false);
  const [activeTab, setActiveTab] = useState('platform');

  const {
    reports: monthlyReports,
    progress: monthlyReportsProgress,
    loading: monthlyReportsLoading,
    uploading: monthlyReportsUploading,
    fetchReports,
    uploadReport,
    deleteReport,
  } = useMonthlyReports();

  const {
    visits: facultyVisits,
    progress: facultyVisitsProgress,
    loading: facultyVisitsLoading,
    fetchVisits,
  } = useFacultyVisits();

  // Handlers
  const handleViewDetails = useCallback(async (application) => {
    setSelectedApplication(application);
    setShowDetailsView(true);

    await Promise.all([
      fetchReports(application.id),
      fetchVisits(application.id),
    ]);
  }, [fetchReports, fetchVisits]);

  const handleCloseDetailsView = useCallback(() => {
    setShowDetailsView(false);
    setSelectedApplication(null);
  }, []);

  const handleRefreshReports = useCallback(async () => {
    if (selectedApplication) {
      await fetchReports(selectedApplication.id);
    }
  }, [selectedApplication, fetchReports]);

  const handleRefreshApplication = useCallback(async () => {
    await dispatch(fetchApplications({ forceRefresh: true }));

    if (selectedApplication) {
      await Promise.all([
        fetchReports(selectedApplication.id),
        fetchVisits(selectedApplication.id),
      ]);
    }
  }, [dispatch, selectedApplication, fetchReports, fetchVisits]);

  // Render loading state
  if (loading && !lastFetched) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: token.colorBgLayout }}>
        <Spin size="large" />
      </div>
    );
  }

  // Render details view
  if (showDetailsView && selectedApplication) {
    return (
      <div className="min-h-screen p-4 md:p-6" style={{ backgroundColor: token.colorBgLayout }}>
        <ApplicationDetailsView
          application={selectedApplication}
          onBack={handleCloseDetailsView}
          monthlyReports={monthlyReports}
          monthlyReportsProgress={monthlyReportsProgress}
          monthlyReportsLoading={monthlyReportsLoading}
          monthlyReportsUploading={monthlyReportsUploading}
          onUploadReport={uploadReport}
          onDeleteReport={deleteReport}
          onRefreshReports={handleRefreshReports}
          facultyVisits={facultyVisits}
          facultyVisitsProgress={facultyVisitsProgress}
          facultyVisitsLoading={facultyVisitsLoading}
          onRefresh={handleRefreshApplication}
        />
      </div>
    );
  }

  // Tab items for Ant Design 5
  const tabItems = [
    {
      key: 'platform',
      label: (
        <span className="flex items-center gap-2">
          <BankOutlined />
          Platform Internships
          <Tag color="blue" className="rounded-md font-bold">{derivedData.platformCount}</Tag>
        </span>
      ),
      children: derivedData.hasPlatformApplications ? (
        <Card bordered={false} className="rounded-2xl shadow-sm" style={{ backgroundColor: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}` }}>
          <ApplicationsTable
            applications={applications}
            loading={loading}
            onViewDetails={handleViewDetails}
          />
        </Card>
      ) : (
        <Card bordered={false} className="rounded-2xl shadow-sm" style={{ backgroundColor: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}` }}>
          <Empty
            image={<BankOutlined style={{ fontSize: 60, color: token.colorTextDisabled }} />}
            imageStyle={{ height: 80 }}
            description={
              <div className="text-center py-4">
                <Title level={4} className="mb-2" style={{ color: token.colorTextSecondary }}>No applications yet</Title>
                <Text style={{ color: token.colorTextTertiary }}>Browse available internships and start applying</Text>
              </div>
            }
          >
            <Button
              type="primary"
              icon={<ExportOutlined />}
              onClick={() => navigate('/internships')}
              size="large"
              className="rounded-xl h-11 px-6 font-bold shadow-lg"
              style={{ backgroundColor: token.colorPrimary, boxShadow: `0 10px 15px -3px ${token.colorPrimary}40` }}
            >
              Browse Internships
            </Button>
          </Empty>
        </Card>
      ),
    },
    {
      key: 'self-identified',
      label: (
        <span className="flex items-center gap-2">
          <RocketOutlined />
          Self-Identified
          <Tag color="purple" className="rounded-md font-bold">{derivedData.selfIdentifiedCount}</Tag>
        </span>
      ),
      children: derivedData.hasSelfIdentifiedApplications ? (
        <Card bordered={false} className="rounded-2xl shadow-sm" style={{ backgroundColor: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}` }}>
          <ApplicationsTable
            applications={selfIdentifiedApplications}
            loading={loading}
            onViewDetails={handleViewDetails}
            isSelfIdentified
          />
        </Card>
      ) : (
        <Card bordered={false} className="rounded-2xl shadow-sm" style={{ backgroundColor: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}` }}>
          <Empty
            image={<RocketOutlined style={{ fontSize: 60, color: token.colorTextDisabled }} />}
            imageStyle={{ height: 80 }}
            description={
              <div className="text-center py-4">
                <Title level={4} className="mb-2" style={{ color: token.colorTextSecondary }}>No self-identified internships</Title>
                <Text style={{ color: token.colorTextTertiary }}>Submit internships you found from other platforms</Text>
              </div>
            }
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/self-identified-internship')}
              size="large"
              className="rounded-xl h-11 px-6 font-bold shadow-lg"
              style={{ backgroundColor: '#9333ea', boxShadow: '0 10px 15px -3px rgba(147, 51, 234, 0.4)' }}
            >
              Add Self-Identified Internship
            </Button>
          </Empty>
        </Card>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-8 min-h-screen" style={{ backgroundColor: token.colorBgLayout }}>
      {/* Header Section */}
      <div className="mb-8 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm"
              style={{ 
                backgroundColor: token.colorBgContainer, 
                border: `1px solid ${token.colorBorderSecondary}`,
                color: token.colorPrimary 
              }}
            >
              <BankOutlined className="text-2xl" />
            </div>
            <div>
              <Title level={2} className="!mb-1 !text-2xl lg:!text-3xl tracking-tight" style={{ color: token.colorText }}>
                My Applications
              </Title>
              <Text style={{ color: token.colorTextSecondary }}>
                Track and manage your internship applications
              </Text>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              icon={<ReloadOutlined spin={loading} />}
              onClick={refetch}
              loading={loading}
              className="rounded-xl h-11 px-4"
              style={{ 
                borderColor: token.colorBorder, 
                color: token.colorTextSecondary,
                backgroundColor: token.colorBgContainer
              }}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/self-identified-internship')}
              className="rounded-xl h-11 px-6 font-bold shadow-lg border-0"
              style={{ 
                backgroundColor: token.colorPrimary,
                boxShadow: `0 10px 15px -3px ${token.colorPrimary}40`
              }}
            >
              Add Internship
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Card 
              bordered={false} 
              className="rounded-2xl shadow-sm hover:shadow-md transition-all duration-300"
              style={{ backgroundColor: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}` }}
            >
              <Statistic
                title={<span className="text-xs font-bold uppercase tracking-wider" style={{ color: token.colorTextQuaternary }}>Total Applications</span>}
                value={derivedData.totalCount}
                prefix={<BankOutlined style={{ color: token.colorPrimary }} className="mr-2" />}
                valueStyle={{ fontWeight: 700, color: token.colorText }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card 
              bordered={false} 
              className="rounded-2xl shadow-sm hover:shadow-md transition-all duration-300"
              style={{ backgroundColor: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}` }}
            >
              <Statistic
                title={<span className="text-xs font-bold uppercase tracking-wider" style={{ color: token.colorTextQuaternary }}>Active Internships</span>}
                value={derivedData.activeCount}
                valueStyle={{ color: token.colorSuccess, fontWeight: 700 }}
                prefix={<CheckCircleOutlined style={{ color: token.colorSuccess }} className="mr-2" />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card 
              bordered={false} 
              className="rounded-2xl shadow-sm hover:shadow-md transition-all duration-300"
              style={{ backgroundColor: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}` }}
            >
              <Statistic
                title={<span className="text-xs font-bold uppercase tracking-wider" style={{ color: token.colorTextQuaternary }}>Pending</span>}
                value={derivedData.pendingCount}
                valueStyle={{ color: token.colorWarning, fontWeight: 700 }}
                prefix={<ClockCircleOutlined style={{ color: token.colorWarning }} className="mr-2" />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card 
              bordered={false} 
              className="rounded-2xl shadow-sm hover:shadow-md transition-all duration-300"
              style={{ backgroundColor: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}` }}
            >
              <Statistic
                title={<span className="text-xs font-bold uppercase tracking-wider" style={{ color: token.colorTextQuaternary }}>Self-Identified</span>}
                value={derivedData.selfIdentifiedCount}
                valueStyle={{ color: '#8b5cf6', fontWeight: 700 }}
                prefix={<RocketOutlined style={{ color: '#8b5cf6' }} className="mr-2" />}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        className="applications-tabs custom-tabs"
        size="large"
      />
    </div>
  );
};

export default MyApplications;

