import React, { useState, useCallback } from 'react';
import { Row, Col, Spin, Alert, Modal, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

import Layouts from '../../../components/Layout';
import { useStudentDashboard } from '../hooks/useStudentDashboard';
import {
  DashboardHeader,
  StatisticsGrid,
  ActiveInternshipCard,
  RecentApplicationsList,
  MonthlyReportsCard,
  GrievancesCard,
} from './components';
import {
  selectInstitute,
  selectInstituteLoading,
  fetchInstituteAsync,
} from '../../../store/slices/instituteSlice';

dayjs.extend(isSameOrBefore);

const StudentDashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Institute data
  const institute = useSelector(selectInstitute);
  const instituteLoading = useSelector(selectInstituteLoading);

  // Use custom hook for dashboard data
  const {
    isLoading,
    profile,
    internships,
    applications,
    reports,
    mentor,
    grievances,
    stats,
    activeInternships,
    recentApplications,
    monthlyReports,
    error,
    refresh,
    handleWithdrawApplication,
    handleUpdateApplication,
    handleSubmitReport,
    handleCreateGrievance,
  } = useStudentDashboard();

  // Local UI state
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [grievanceModalVisible, setGrievanceModalVisible] = useState(false);

  // Handle internship selection change
  const handleInternshipChange = useCallback((internshipId) => {
    const internship = activeInternships.find(i => i.id === internshipId);
    setSelectedInternship(internship);
  }, [activeInternships]);

  // Navigate to application details
  const handleViewApplication = useCallback((applicationId) => {
    navigate(`/applications/${applicationId}`);
  }, [navigate]);

  // Navigate to internship details
  const handleViewInternship = useCallback((internshipId) => {
    navigate(`/internships/${internshipId}`);
  }, [navigate]);

  // Handle application withdrawal with confirmation
  const handleWithdraw = useCallback(async (applicationId) => {
    Modal.confirm({
      title: 'Withdraw Application',
      content: 'Are you sure you want to withdraw this application?',
      okText: 'Yes, Withdraw',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await handleWithdrawApplication(applicationId);
          message.success('Application withdrawn successfully');
        } catch (err) {
          message.error('Failed to withdraw application');
        }
      },
    });
  }, [handleWithdrawApplication]);

  // Handle report submission
  const handleReportSubmit = useCallback(async (reportId, data) => {
    try {
      await handleSubmitReport(reportId, data);
      message.success('Report submitted successfully');
      setReportModalVisible(false);
    } catch (err) {
      message.error('Failed to submit report');
    }
  }, [handleSubmitReport]);

  // Handle grievance creation
  const handleGrievanceSubmit = useCallback(async (data) => {
    try {
      await handleCreateGrievance(data);
      message.success('Grievance submitted successfully');
      setGrievanceModalVisible(false);
    } catch (err) {
      message.error('Failed to submit grievance');
    }
  }, [handleCreateGrievance]);

  // Show error state
  if (error) {
    return (
      <Layouts>
        <div className="p-6">
          <Alert
            type="error"
            title="Error loading dashboard"
            description={error}
            showIcon
            action={
              <button onClick={refresh} className="text-blue-600 hover:underline">
                Try Again
              </button>
            }
          />
        </div>
      </Layouts>
    );
  }

  return (
    <Layouts>
      <Spin spinning={isLoading} tip="Loading dashboard...">
        <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
          {/* Header Section */}
          <DashboardHeader
            studentName={profile?.name}
            instituteName={institute?.name}
            mentorName={mentor?.name}
            onRefresh={refresh}
            loading={isLoading}
          />

          {/* Statistics Grid */}
          <div className="mb-6">
            <StatisticsGrid stats={stats} />
          </div>

          {/* Main Content Grid */}
          <Row gutter={[16, 16]}>
            {/* Active Internship Card */}
            <Col xs={24} lg={16}>
              <ActiveInternshipCard
                internships={activeInternships}
                selectedInternship={selectedInternship || activeInternships[0]}
                onInternshipChange={handleInternshipChange}
                onViewDetails={handleViewInternship}
                loading={isLoading}
              />
            </Col>

            {/* Recent Applications */}
            <Col xs={24} lg={8}>
              <RecentApplicationsList
                applications={recentApplications}
                loading={isLoading}
                onView={handleViewApplication}
                onWithdraw={handleWithdraw}
                onViewAll={() => navigate('/applications')}
              />
            </Col>
          </Row>

          {/* Secondary Content Grid */}
          <Row gutter={[16, 16]} className="mt-4">
            {/* Monthly Reports */}
            <Col xs={24} lg={12}>
              <MonthlyReportsCard
                reports={monthlyReports}
                loading={isLoading}
                onSubmitReport={(reportId) => {
                  setReportModalVisible(true);
                }}
                onViewAll={() => navigate('/reports')}
              />
            </Col>

            {/* Grievances */}
            <Col xs={24} lg={12}>
              <GrievancesCard
                grievances={grievances}
                loading={isLoading}
                onCreateNew={() => setGrievanceModalVisible(true)}
                onViewAll={() => navigate('/grievances')}
              />
            </Col>
          </Row>
        </div>
      </Spin>
    </Layouts>
  );
};

export default StudentDashboard;