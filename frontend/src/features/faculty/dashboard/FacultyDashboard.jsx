import React, { useState, useCallback } from 'react';
import { Row, Col, Spin, Alert, Modal, Form, Input, Select, DatePicker, message } from 'antd';
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

dayjs.extend(isBetween);

const { TextArea } = Input;
const { Option } = Select;

const FacultyDashboard = () => {
  const navigate = useNavigate();
  const [visitForm] = Form.useForm();

  // Use custom hook for dashboard data
  const {
    isLoading,
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
          {/* Header Section */}
          <DashboardHeader
            facultyName={mentor?.name}
            stats={stats}
            onRefresh={refresh}
            loading={isLoading}
          />

          {/* Statistics Grid */}
          <div className="mb-6">
            <StatisticsGrid stats={stats} />
          </div>

          {/* Main Content Grid */}
          <Row gutter={[16, 16]}>
            {/* Assigned Students List */}
            <Col xs={24} lg={14}>
              <AssignedStudentsList
                students={students}
                loading={isLoading}
                onViewStudent={handleViewStudent}
                onScheduleVisit={handleNewVisit}
                onViewAll={() => navigate('/assigned-students')}
              />
            </Col>

            {/* Visit Logs */}
            <Col xs={24} lg={10}>
              <VisitLogsCard
                visitLogs={visitLogs}
                loading={isLoading}
                onCreateNew={() => handleNewVisit()}
                onViewAll={() => navigate('/visit-logs')}
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

          {/* Pending Approvals */}
          <div className="mt-4">
            <PendingApprovalsCard
              applications={pendingApprovals}
              loading={isLoading}
              onApprove={handleApprove}
              onReject={handleReject}
              onViewAll={() => navigate('/approvals')}
            />
          </div>
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
    </>
  );
};

export default FacultyDashboard;