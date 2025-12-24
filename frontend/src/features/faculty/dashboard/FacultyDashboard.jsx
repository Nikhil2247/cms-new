import React, { useState, useCallback, memo } from 'react';
import { Row, Col, Spin, Alert, Modal, Form, Input, Select, DatePicker, message, FloatButton } from 'antd';
import { SyncOutlined, CameraOutlined } from '@ant-design/icons';
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
} from './components';
import QuickVisitModal from '../visits/QuickVisitModal';
import { facultyService } from '../../../services/faculty.service';

dayjs.extend(isBetween);

const { TextArea } = Input;
const { Option } = Select;

const FacultyDashboard = () => {
  const navigate = useNavigate();
  const [visitForm] = Form.useForm();

  // Use custom hook for dashboard data with SWR
  const {
    isLoading,
    isRevalidating, // NEW: SWR revalidation state
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
    handleCreateVisitLog,
    handleUpdateVisitLog,
    handleDeleteVisitLog,
    handleApproveApplication,
    handleRejectApplication,
    handleSubmitFeedback,
    handleReviewReport,
  } = useFacultyDashboard();

  // Local UI state
  const [visitModalVisible, setVisitModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editingVisit, setEditingVisit] = useState(null);
  const [quickVisitModalVisible, setQuickVisitModalVisible] = useState(false);

  // Handle creating a new visit log
  const handleNewVisit = useCallback((student = null) => {
    setSelectedStudent(student);
    setEditingVisit(null);
    visitForm.resetFields();
    if (student) {
      visitForm.setFieldsValue({
        studentId: student.id,
        applicationId: student.applicationId,
      });
    }
    setVisitModalVisible(true);
  }, [visitForm]);

  // Handle editing an existing visit log
  const handleEditVisit = useCallback((visit) => {
    setEditingVisit(visit);
    visitForm.setFieldsValue({
      ...visit,
      visitDate: dayjs(visit.visitDate),
    });
    setVisitModalVisible(true);
  }, [visitForm]);

  // Handle visit form submission
  const handleVisitSubmit = useCallback(async () => {
    try {
      const values = await visitForm.validateFields();
      const visitData = {
        ...values,
        visitDate: values.visitDate.toISOString(),
      };

      if (editingVisit) {
        await handleUpdateVisitLog(editingVisit.id, visitData);
        message.success('Visit log updated successfully');
      } else {
        await handleCreateVisitLog(visitData);
        message.success('Visit log created successfully');
      }

      setVisitModalVisible(false);
      visitForm.resetFields();
    } catch (err) {
      if (err.errorFields) {
        return; // Form validation error
      }
      message.error('Failed to save visit log');
    }
  }, [visitForm, editingVisit, handleCreateVisitLog, handleUpdateVisitLog]);

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

  // Navigate to student details
  const handleViewStudent = useCallback((studentId) => {
    navigate(`/students/${studentId}`);
  }, [navigate]);

  // Handle quick visit submission
  const handleQuickVisitSubmit = useCallback(async (formData) => {
    try {
      await facultyService.quickLogVisit(formData);
      // Refresh dashboard to show new visit
      await refresh();
      return true;
    } catch (error) {
      throw error;
    }
  }, [refresh]);

  // Show error state
  if (error) {
    return (
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
    );
  }

  return (
    <>
      <Spin spinning={isLoading} tip="Loading dashboard...">
        <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
          {/* Subtle Revalidation Indicator */}
          {isRevalidating && !isLoading && (
            <div
              className="fixed top-0 left-0 right-0 z-50 bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-center gap-2 text-blue-700 text-sm"
              style={{
                animation: 'slideDown 0.3s ease-out',
              }}
            >
              <SyncOutlined spin />
              <span>Updating dashboard data...</span>
            </div>
          )}

          {/* Header Section */}
          <DashboardHeader
            facultyName={mentor?.name}
            stats={stats}
            onRefresh={refresh}
            loading={isLoading}
            isRevalidating={isRevalidating}
          />

          {/* Statistics Grid */}
          <div className="mb-6">
            <StatisticsGrid stats={stats} />
          </div>

          {/* Main Content Grid */}
          <Row gutter={[16, 16]}>
            {/* Assigned Students List - Full Width */}
            <Col xs={24}>
              <AssignedStudentsList
                students={students}
                loading={isLoading}
                onViewStudent={handleViewStudent}
                onScheduleVisit={async (visitData) => {
                  await handleCreateVisitLog(visitData);
                }}
                onViewAll={() => navigate('/assigned-students')}
              />
            </Col>
          </Row>

          {/* Secondary Content Grid */}
          <Row gutter={[16, 16]} className="mt-4">
            {/* Visit Logs */}
            <Col xs={24} lg={12}>
              <VisitLogsCard
                visitLogs={visitLogs}
                loading={isLoading}
                onCreateNew={() => handleNewVisit()}
                onViewAll={() => navigate('/visit-logs')}
              />
            </Col>

            {/* Pending Approvals */}
            <Col xs={24} lg={12}>
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
          <Row gutter={[16, 16]} className="mt-4">
            <Col xs={24} lg={12}>
              <MonthlyReportsCard
                reports={dashboard?.monthlyReports || []}
                loading={isLoading}
                onRefresh={refresh}
                onViewAll={() => navigate('/monthly-reports')}
              />
            </Col>
            <Col xs={24} lg={12}>
              <JoiningLettersCard
                letters={dashboard?.joiningLetters || []}
                loading={isLoading}
                onRefresh={refresh}
                onViewAll={() => navigate('/joining-letters')}
              />
            </Col>
          </Row>
        </div>
      </Spin>

      {/* Visit Log Modal */}
      <Modal
        title={editingVisit ? 'Edit Visit Log' : 'Schedule New Visit'}
        open={visitModalVisible}
        onOk={handleVisitSubmit}
        onCancel={() => {
          setVisitModalVisible(false);
          visitForm.resetFields();
        }}
        okText={editingVisit ? 'Update' : 'Create'}
        width={600}
        className="rounded-xl overflow-hidden"
      >
        <Form form={visitForm} layout="vertical" className="mt-4">
          {!selectedStudent && (
            <Form.Item
              name="applicationId"
              label="Select Student"
              rules={[{ required: true, message: 'Please select a student' }]}
            >
              <Select placeholder="Select a student" className="rounded-lg">
                {students.map((student) => (
                  <Option key={student.applicationId || student.id} value={student.applicationId || student.id}>
                    {student.name} - {student.companyName || 'Company'}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item
            name="visitDate"
            label="Visit Date"
            rules={[{ required: true, message: 'Please select a date' }]}
          >
            <DatePicker className="w-full rounded-lg" showTime />
          </Form.Item>

          <Form.Item
            name="visitType"
            label="Visit Type"
            rules={[{ required: true, message: 'Please select visit type' }]}
          >
            <Select placeholder="Select visit type" className="rounded-lg">
              <Option value="PHYSICAL">Physical Visit</Option>
              <Option value="VIRTUAL">Virtual Visit</Option>
              <Option value="PHONE">Phone Call</Option>
            </Select>
          </Form.Item>

          <Form.Item name="visitLocation" label="Visit Location">
            <Input placeholder="Enter visit location" className="rounded-lg" />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Add any notes about this visit" className="rounded-lg" />
          </Form.Item>
        </Form>
      </Modal>

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
          right: 24,
          bottom: 24,
          width: 60,
          height: 60,
        }}
        badge={{ count: 'Quick Log', color: '#52c41a' }}
      />
    </>
  );
};

export default memo(FacultyDashboard);