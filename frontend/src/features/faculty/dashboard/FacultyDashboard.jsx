import React, { useState, useCallback, memo } from 'react';
import { Row, Col, Spin, Alert, Modal, message, FloatButton, Layout } from 'antd';
import { SyncOutlined, CameraOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

import { useFacultyDashboard } from '../hooks/useFacultyDashboard';
import {
  DashboardHeader,
  StatisticsGrid,
  AssignedStudentsList,
  VisitLogsCard,
  PendingApprovalsCard,
  MonthlyReportsCard,
  JoiningLettersCard,
  StudentDetailsModal,
} from './components';
import QuickVisitModal from '../visits/QuickVisitModal';
import UnifiedVisitLogModal from '../visits/UnifiedVisitLogModal';

dayjs.extend(isBetween);

const FacultyDashboard = () => {
  const navigate = useNavigate();

  // Use custom hook for dashboard data with SWR
  const {
    isLoading,
    isRevalidating, // NEW: SWR revalidation state
    lastFetched, // Timestamp of most recent data fetch
    dashboard,
    students,
    visitLogs,
    mentor,
    grievances,
    applications,
    stats,
    pendingApprovals,
    upcomingVisits,
    error,
    refresh,
    handleDeleteVisitLog,
    handleApproveApplication,
    handleRejectApplication,
    handleSubmitFeedback,
    handleReviewReport,
  } = useFacultyDashboard();

  // Local UI state
  const [visitModalVisible, setVisitModalVisible] = useState(false);
  const [quickVisitModalVisible, setQuickVisitModalVisible] = useState(false);
  const [studentDetailsModalVisible, setStudentDetailsModalVisible] = useState(false);
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState(null);

  // Handle creating a new visit log - opens UnifiedVisitLogModal
  const handleNewVisit = useCallback(() => {
    setVisitModalVisible(true);
  }, []);

  // Handle visit modal success
  const handleVisitSuccess = useCallback(() => {
    setVisitModalVisible(false);
    refresh();
  }, [refresh]);

  // Handle deleting a visit log
  const handleDeleteVisit = useCallback(async (visitId) => {
    Modal.confirm({
      title: 'Delete Visit Log',
      content: 'Are you sure you want to delete this visit log?',
      okText: 'Yes, Delete',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await handleDeleteVisitLog(visitId);
          message.success('Visit log deleted successfully');
        } catch (err) {
          message.error('Failed to delete visit log');
        }
      },
    });
  }, [handleDeleteVisitLog]);

  // Handle application approval
  const handleApprove = useCallback(async (application) => {
    try {
      await handleApproveApplication(application.id);
      message.success('Application approved successfully');
    } catch (err) {
      message.error('Failed to approve application');
    }
  }, [handleApproveApplication]);

  // Handle application rejection
  const handleReject = useCallback(async (application) => {
    Modal.confirm({
      title: 'Reject Application',
      content: (
        <div>
          <p>Are you sure you want to reject this application?</p>
          <Input.TextArea
            placeholder="Reason for rejection (optional)"
            id="rejectionReason"
            rows={3}
            className="rounded-lg mt-2"
          />
        </div>
      ),
      okText: 'Reject',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        const reason = document.getElementById('rejectionReason')?.value;
        try {
          await handleRejectApplication(application.id, reason);
          message.success('Application rejected');
        } catch (err) {
          message.error('Failed to reject application');
        }
      },
    });
  }, [handleRejectApplication]);

  // Open student details modal
  const handleViewStudent = useCallback((studentId) => {
    // Find the student from the list
    const student = students.find(s =>
      s.id === studentId ||
      s.studentId === studentId ||
      s.student?.id === studentId
    );
    if (student) {
      setSelectedStudentForDetails(student);
      setStudentDetailsModalVisible(true);
    }
  }, [students]);

  // Handle quick visit submission - just refresh data (modal handles actual submission)
  const handleQuickVisitSubmit = useCallback(async () => {
    // Modal handles submission via Redux thunk, we just need to refresh
    await refresh();
    return true;
  }, [refresh]);

  // Show error state
  if (error) {
    return (
      <div className="p-8 flex justify-center items-center min-h-[50vh]">
        <Alert
          type="error"
          message={<span className="font-bold text-lg">Dashboard Error</span>}
          description={error}
          showIcon
          className="rounded-2xl shadow-sm border-red-100 bg-red-50 max-w-lg w-full"
          action={
            <button 
              onClick={refresh} 
              className="text-red-600 font-semibold hover:text-red-800 hover:underline px-4 py-2"
            >
              Try Again
            </button>
          }
        />
      </div>
    );
  }

  return (
    <>
      <Spin spinning={isLoading} tip="Loading dashboard..." size="large">
        <div className="p-4 md:p-8 bg-background-secondary min-h-screen">
          {/* Subtle Revalidation Indicator */}
          {isRevalidating && !isLoading && (
            <div className="fixed top-0 left-0 right-0 z-50 bg-blue-50/90 backdrop-blur-sm border-b border-blue-100 px-4 py-2 flex items-center justify-center gap-2 text-blue-700 text-sm font-medium animate-slide-down shadow-sm">
              <SyncOutlined spin />
              <span>Updating dashboard data...</span>
            </div>
          )}

          <div className="max-w-[1600px] mx-auto space-y-8 pb-20">
            {/* Header Section */}
            <DashboardHeader
              facultyName={mentor?.name}
              stats={stats}
              onRefresh={refresh}
              loading={isLoading}
              isRevalidating={isRevalidating}
              lastFetched={lastFetched}
            />

            {/* Statistics Grid */}
            <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <StatisticsGrid stats={stats} />
            </div>

            {/* Main Content Grid */}
            <div className="space-y-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              {/* Assigned Students List - Full Width */}
              <AssignedStudentsList
                students={students}
                loading={isLoading}
                onViewStudent={handleViewStudent}
                onScheduleVisit={refresh}
                onViewAll={() => navigate('/assigned-students')}
              />

              {/* Secondary Content Grid */}
              <Row gutter={[24, 24]}>
                {/* Visit Logs */}
                <Col xs={24} xl={12}>
                  <VisitLogsCard
                    visitLogs={visitLogs}
                    loading={isLoading}
                    onCreateNew={() => handleNewVisit()}
                    onViewAll={() => navigate('/visit-logs')}
                  />
                </Col>

                {/* Pending Approvals */}
                <Col xs={24} xl={12}>
                  <PendingApprovalsCard
                    applications={pendingApprovals}
                    loading={isLoading}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onViewAll={() => navigate('/approvals')}
                  />
                </Col>
              </Row>

              {/* Monthly Reports & Joining Letters */}
              <Row gutter={[24, 24]}>
                <Col xs={24} xl={12}>
                  <MonthlyReportsCard
                    reports={dashboard?.monthlyReports || []}
                    loading={isLoading}
                    onRefresh={refresh}
                    onViewAll={() => navigate('/monthly-reports')}
                  />
                </Col>
                <Col xs={24} xl={12}>
                  <JoiningLettersCard
                    letters={dashboard?.joiningLetters || []}
                    loading={isLoading}
                    onRefresh={refresh}
                    onViewAll={() => navigate('/joining-letters')}
                  />
                </Col>
              </Row>
            </div>
          </div>
        </div>
      </Spin>

      {/* Unified Visit Log Modal */}
      <UnifiedVisitLogModal
        visible={visitModalVisible}
        onClose={() => setVisitModalVisible(false)}
        onSuccess={handleVisitSuccess}
        students={students}
      />

      {/* Quick Visit Modal */}
      <QuickVisitModal
        visible={quickVisitModalVisible}
        onClose={() => setQuickVisitModalVisible(false)}
        onSubmit={handleQuickVisitSubmit}
        students={students}
        loading={isLoading}
      />

      {/* Floating Quick Log Button */}
      <FloatButton
        icon={<CameraOutlined />}
        type="primary"
        tooltip="Quick Log Visit"
        onClick={() => setQuickVisitModalVisible(true)}
        style={{
          right: 32,
          bottom: 32,
          width: 64,
          height: 64,
        }}
        className="shadow-lg shadow-blue-500/30"
        badge={{ count: 'Quick', color: '#10b981', offset: [-5, 5] }}
      />

      {/* Student Details Modal */}
      <StudentDetailsModal
        visible={studentDetailsModalVisible}
        student={selectedStudentForDetails}
        onClose={() => {
          setStudentDetailsModalVisible(false);
          setSelectedStudentForDetails(null);
        }}
        onScheduleVisit={refresh}
        onRefresh={refresh}
        loading={isLoading}
      />
    </>
  );
};

export default memo(FacultyDashboard);