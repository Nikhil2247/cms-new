import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, Empty, Spin, Button, Typography, Tag, theme } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  RocketOutlined,
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
  selectSelfIdentifiedApplications,
  selectApplicationsLastFetched,
} from '../store/studentSelectors';

const { Text } = Typography;

const MyApplications = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { token } = theme.useToken();

  // Redux state
  const loading = useSelector(selectApplicationsLoading);
  const selfIdentifiedApplications = useSelector(selectSelfIdentifiedApplications);
  const lastFetched = useSelector(selectApplicationsLastFetched);

  // Memoize derived data
  const derivedData = useMemo(() => {
    const selfIdentifiedCount = selfIdentifiedApplications?.length || 0;
    const hasSelfIdentifiedApplications = selfIdentifiedCount > 0;

    // Check if student has any active (non-withdrawn) application
    const hasActiveApplication = selfIdentifiedApplications?.some(
      (app) => (app.status || '').toUpperCase() !== 'WITHDRAWN'
    ) || false;

    return {
      selfIdentifiedCount,
      hasSelfIdentifiedApplications,
      hasActiveApplication,
    };
  }, [selfIdentifiedApplications]);

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
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  // Render details view
  if (showDetailsView && selectedApplication) {
    return (
      <div className="min-h-screen p-4 md:p-5">
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

  return (
    <div className="p-4 md:p-5 min-h-screen">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-purple-500" />
          <div>
            <h1 className="text-lg font-semibold text-text-primary m-0">My Applications</h1>
            <Text className="text-xs text-text-tertiary">Manage your internship applications</Text>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            type="text"
            icon={<ReloadOutlined spin={loading} />}
            onClick={refetch}
            className="rounded-lg"
          />
          {!derivedData.hasActiveApplication && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/self-identified-internship')}
              size="small"
              className="rounded-lg"
            >
              Add Internship
            </Button>
          )}
        </div>
      </div>

      {/* Applications List */}
      <Card
        className="rounded-xl border border-gray-100 shadow-sm"
        styles={{ body: { padding: 0 } }}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <RocketOutlined className="text-purple-500" />
            <Text className="font-medium text-text-primary">Self-Identified Internships</Text>
            <Tag color="purple" className="rounded-full text-xs ml-1">
              {derivedData.selfIdentifiedCount}
            </Tag>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {derivedData.hasSelfIdentifiedApplications ? (
            <ApplicationsTable
              applications={selfIdentifiedApplications}
              loading={loading}
              onViewDetails={handleViewDetails}
              isSelfIdentified
            />
          ) : (
            <Empty
              image={<RocketOutlined className="text-5xl text-gray-300" />}
              imageStyle={{ height: 60 }}
              description={
                <div className="text-center py-2">
                  <Text className="text-sm text-text-secondary block mb-1">No internships yet</Text>
                  <Text className="text-xs text-text-tertiary">Add your self-identified internship to get started</Text>
                </div>
              }
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/self-identified-internship')}
                className="rounded-lg"
                style={{ backgroundColor: '#9333ea' }}
              >
                Add Self-Identified Internship
              </Button>
            </Empty>
          )}
        </div>
      </Card>
    </div>
  );
};

export default MyApplications;
