import React, { useState, useCallback } from 'react';
import { Card, Tabs, Empty, Spin, Button, Typography, Form } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ExportOutlined } from '@ant-design/icons';

import {
  ApplicationsTable,
  ApplicationDetailsView,
  FeedbackModal,
  MonthlyFeedbackModal,
} from './components';
import {
  useApplications,
  useCompletionFeedback,
  useMonthlyReports,
  useMonthlyFeedback,
} from './hooks/useApplications';
import { hasInternshipStarted } from './utils/applicationUtils';
import { toast } from 'react-hot-toast';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const MyApplications = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();

  // State
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showDetailsView, setShowDetailsView] = useState(false);
  const [activeTab, setActiveTab] = useState('1');
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [monthlyFeedbackModalVisible, setMonthlyFeedbackModalVisible] = useState(false);

  // Hooks
  const { loading, applications, selfIdentifiedApplications, refetch } = useApplications();
  const {
    feedback: completionFeedback,
    loading: feedbackLoading,
    fetchFeedback,
    submitFeedback,
    setFeedback,
  } = useCompletionFeedback();
  const {
    reports: monthlyReports,
    loading: monthlyReportsLoading,
    uploading: monthlyReportsUploading,
    missingReports,
    fetchReports,
    uploadReport,
    submitReport,
    deleteReport,
  } = useMonthlyReports();
  const {
    feedbacks: monthlyFeedbacks,
    loading: monthlyFeedbacksLoading,
    submitting: monthlyFeedbackSubmitting,
    fetchFeedbacks,
    submitFeedback: submitMonthlyFeedback,
  } = useMonthlyFeedback();

  // Handlers
  const handleViewDetails = useCallback(async (application) => {
    setSelectedApplication(application);
    setShowDetailsView(true);

    // Fetch related data
    const feedback = await fetchFeedback(application.id);
    await fetchReports(application.id);
    await fetchFeedbacks(application.id);
  }, [fetchFeedback, fetchReports, fetchFeedbacks]);

  const handleCloseDetailsView = useCallback(() => {
    setShowDetailsView(false);
    setSelectedApplication(null);
    setFeedback(null);
  }, [setFeedback]);

  const handleOpenFeedbackModal = useCallback(async (application) => {
    setSelectedApplication(application);
    const feedback = await fetchFeedback(application.id);
    setFeedbackModalVisible(true);
  }, [fetchFeedback]);

  const handleCloseFeedbackModal = useCallback(() => {
    setFeedbackModalVisible(false);
    form.resetFields();
  }, [form]);

  const handleSubmitFeedback = useCallback(async (values) => {
    if (!selectedApplication) return;

    try {
      await submitFeedback(selectedApplication.id, values);
      toast.success('Feedback submitted successfully!');
      handleCloseFeedbackModal();
      // Refresh feedback
      await fetchFeedback(selectedApplication.id);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit feedback');
    }
  }, [selectedApplication, submitFeedback, handleCloseFeedbackModal, fetchFeedback]);

  const handleOpenMonthlyFeedbackModal = useCallback((application) => {
    setSelectedApplication(application);
    setMonthlyFeedbackModalVisible(true);
  }, []);

  const handleCloseMonthlyFeedbackModal = useCallback(() => {
    setMonthlyFeedbackModalVisible(false);
  }, []);

  const handleSubmitMonthlyFeedback = useCallback(async (imageFile) => {
    if (!selectedApplication) return;

    try {
      await submitMonthlyFeedback(selectedApplication.id, imageFile);
      handleCloseMonthlyFeedbackModal();
      // Refresh feedbacks
      await fetchFeedbacks(selectedApplication.id);
    } catch (error) {
      // Error handled in hook
    }
  }, [selectedApplication, submitMonthlyFeedback, handleCloseMonthlyFeedbackModal, fetchFeedbacks]);

  const handleRefreshReports = useCallback(async () => {
    if (selectedApplication) {
      await fetchReports(selectedApplication.id);
    }
  }, [selectedApplication, fetchReports]);

  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  // Render details view
  if (showDetailsView && selectedApplication) {
    return (
      <div className="min-h-screen">
        <div className="mx-auto">
          <ApplicationDetailsView
            application={selectedApplication}
            onBack={handleCloseDetailsView}
            onOpenFeedbackModal={handleOpenFeedbackModal}
            onOpenMonthlyFeedbackModal={handleOpenMonthlyFeedbackModal}
            completionFeedback={completionFeedback}
            monthlyReports={monthlyReports}
            monthlyReportsLoading={monthlyReportsLoading}
            monthlyReportsUploading={monthlyReportsUploading}
            missingReports={missingReports}
            onUploadReport={uploadReport}
            onSubmitReport={submitReport}
            onDeleteReport={deleteReport}
            onRefreshReports={handleRefreshReports}
            monthlyFeedbacks={monthlyFeedbacks}
            monthlyFeedbacksLoading={monthlyFeedbacksLoading}
          />

          {/* Feedback Modal */}
          <FeedbackModal
            visible={feedbackModalVisible}
            onCancel={handleCloseFeedbackModal}
            onSubmit={handleSubmitFeedback}
            loading={feedbackLoading}
            form={form}
            existingFeedback={completionFeedback}
          />

          {/* Monthly Feedback Modal */}
          <MonthlyFeedbackModal
            visible={monthlyFeedbackModalVisible}
            onCancel={handleCloseMonthlyFeedbackModal}
            onSubmit={handleSubmitMonthlyFeedback}
            loading={monthlyFeedbackSubmitting}
          />
        </div>
      </div>
    );
  }

  // Render applications list
  return (
    <div className="min-h-screen">
      <div className="mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Title level={2} className="mb-2">My Applications</Title>
          <Text type="secondary">
            Track and manage your internship applications
          </Text>
        </div>

        {/* Tabs */}
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          {/* Platform Applications */}
          <TabPane tab={`Platform Internships (${applications.length})`} key="1">
            {applications.length > 0 ? (
              <Card className="rounded-2xl">
                <ApplicationsTable
                  applications={applications}
                  loading={loading}
                  onViewDetails={handleViewDetails}
                />
              </Card>
            ) : (
              <Card className="rounded-2xl text-center py-16">
                <Empty
                  description={
                    <div>
                      <Title level={4} className="text-gray-500 mb-2">
                        No applications yet
                      </Title>
                      <Text className="text-gray-400">
                        Browse available internships and start applying
                      </Text>
                    </div>
                  }
                >
                  <Button
                    type="primary"
                    icon={<ExportOutlined />}
                    onClick={() => navigate('/internships')}
                    className="bg-blue-600"
                  >
                    Browse Internships
                  </Button>
                </Empty>
              </Card>
            )}
          </TabPane>

          {/* Self-Identified Applications */}
          <TabPane tab={`Self-Identified (${selfIdentifiedApplications.length})`} key="2">
            {selfIdentifiedApplications.length > 0 ? (
              <Card className="rounded-2xl">
                <ApplicationsTable
                  applications={selfIdentifiedApplications}
                  loading={loading}
                  onViewDetails={handleViewDetails}
                  isSelfIdentified
                />
              </Card>
            ) : (
              <Card className="rounded-2xl text-center py-16">
                <Empty
                  description={
                    <div>
                      <Title level={4} className="text-gray-500 mb-2">
                        No self-identified applications yet
                      </Title>
                      <Text className="text-gray-400">
                        Submit internships you found from other platforms
                      </Text>
                    </div>
                  }
                >
                  <Button
                    type="primary"
                    onClick={() => navigate('/internships/self-identified')}
                    className="bg-purple-600"
                  >
                    Submit Self-Identified Internship
                  </Button>
                </Empty>
              </Card>
            )}
          </TabPane>
        </Tabs>
      </div>
    </div>
  );
};

export default MyApplications;
