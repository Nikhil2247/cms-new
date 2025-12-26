import React, { useState } from 'react';
import { Card, Tag, Button, Space, Modal, Input, message, Empty, Badge, Tooltip, Avatar } from 'antd';
import {
  FileTextOutlined,
  RightOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import facultyService from '../../../../services/faculty.service';

const { TextArea } = Input;

const getStatusConfig = (status) => {
  const configs = {
    PENDING: { color: 'orange', label: 'Pending Review', icon: <ClockCircleOutlined /> },
    SUBMITTED: { color: 'blue', label: 'Submitted', icon: <FileTextOutlined /> },
    APPROVED: { color: 'green', label: 'Approved', icon: <CheckCircleOutlined /> },
    REJECTED: { color: 'red', label: 'Rejected', icon: <CloseCircleOutlined /> },
    DRAFT: { color: 'default', label: 'Draft', icon: <FileTextOutlined /> },
  };
  return configs[status] || configs.PENDING;
};

const MonthlyReportsCard = ({ reports = [], loading, onRefresh, onViewAll }) => {
  const navigate = useNavigate();
  const [reviewModal, setReviewModal] = useState({ visible: false, report: null, action: null });
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const handleApprove = async () => {
    if (!reviewModal.report) return;
    setActionLoading(true);
    try {
      await facultyService.approveMonthlyReport(reviewModal.report.id, remarks);
      message.success('Report approved successfully');
      setReviewModal({ visible: false, report: null, action: null });
      setRemarks('');
      onRefresh?.();
    } catch (error) {
      message.error(error.message || 'Failed to approve report');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!reviewModal.report || !remarks.trim()) {
      message.warning('Please provide a reason for rejection');
      return;
    }
    setActionLoading(true);
    try {
      await facultyService.rejectMonthlyReport(reviewModal.report.id, remarks);
      message.success('Report rejected');
      setReviewModal({ visible: false, report: null, action: null });
      setRemarks('');
      onRefresh?.();
    } catch (error) {
      message.error(error.message || 'Failed to reject report');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = async (report) => {
    try {
      const blob = await facultyService.downloadMonthlyReport(report.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `monthly_report_${report.student?.name || 'report'}_${report.reportMonth}_${report.reportYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      message.error('Failed to download report');
    }
  };

  // FIXED: Only count reports that are after internship start date
  const pendingCount = reports.filter(r => {
    const isPending = r.status === 'PENDING' || r.status === 'SUBMITTED';
    if (!isPending) return false;

    // Check if report is after internship start date
    const internshipStartDate = r.application?.internship?.startDate ||
                                 r.student?.activeInternship?.startDate;

    if (internshipStartDate) {
      // Report month should be >= internship start month
      const startDate = new Date(internshipStartDate);
      const reportDate = new Date(r.reportYear, r.reportMonth - 1, 1);
      return reportDate >= new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    }

    // If no start date available, include the report
    return true;
  }).length;

  return (
    <>
      <Card
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-primary" />
            <span>Monthly Reports</span>
            {pendingCount > 0 && (
              <Badge count={pendingCount} className="ml-2" />
            )}
          </div>
        }
        extra={
          <Button type="link" onClick={onViewAll || (() => navigate('/monthly-reports'))}>
            View All <RightOutlined />
          </Button>
        }
        className="h-full border border-border rounded-xl"
        styles={{ body: { padding: reports.length > 0 ? 0 : 24 } }}
      >
        {reports.length > 0 ? (
          <div className="flex flex-col">
            {reports.slice(0, 5).map((report, index) => {
              // FIXED: Filter out reports that are before internship start date
              const internshipStartDate = report.application?.internship?.startDate ||
                                           report.student?.activeInternship?.startDate;

              if (internshipStartDate) {
                const startDate = new Date(internshipStartDate);
                const reportDate = new Date(report.reportYear, report.reportMonth - 1, 1);
                const internshipStartMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

                // Skip reports before internship start
                if (reportDate < internshipStartMonth) {
                  return null;
                }
              }

              const statusConfig = getStatusConfig(report.status);
              const monthName = dayjs().month(report.reportMonth - 1).format('MMMM');

              return (
                <div
                  key={report.id || index}
                  className={`px-4 py-3 hover:bg-surface-hover flex items-start gap-4 ${index !== reports.slice(0, 5).length - 1 ? 'border-b border-border/50' : ''}`}
                >
                  <Avatar icon={<UserOutlined />} className="bg-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium truncate mr-2">{report.student?.name || 'Unknown Student'}</span>
                      <Tag color={statusConfig.color} icon={statusConfig.icon} className="m-0">
                        {statusConfig.label}
                      </Tag>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-text-secondary">
                        {monthName} {report.reportYear}
                      </div>
                      {report.submittedAt && (
                        <div className="text-xs text-text-tertiary">
                          Submitted: {dayjs(report.submittedAt).format('DD/MM/YYYY')}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Space size="small">
                        {report.reportFileUrl && (
                          <Tooltip title="Download">
                            <Button
                              type="text"
                              size="small"
                              icon={<DownloadOutlined />}
                              onClick={() => handleDownload(report)}
                            />
                          </Tooltip>
                        )}
                        {(report.status === 'PENDING' || report.status === 'SUBMITTED') && (
                          <>
                            <Tooltip title="Approve">
                              <Button
                                type="text"
                                size="small"
                                icon={<CheckCircleOutlined className="text-green-500" />}
                                onClick={() => setReviewModal({ visible: true, report, action: 'approve' })}
                              />
                            </Tooltip>
                            <Tooltip title="Reject">
                              <Button
                                type="text"
                                size="small"
                                icon={<CloseCircleOutlined className="text-red-500" />}
                                onClick={() => setReviewModal({ visible: true, report, action: 'reject' })}
                              />
                            </Tooltip>
                          </>
                        )}
                      </Space>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No monthly reports to review"
          />
        )}
      </Card>

      {/* Review Modal */}
      <Modal
        title={reviewModal.action === 'approve' ? 'Approve Report' : 'Reject Report'}
        open={reviewModal.visible}
        onCancel={() => {
          setReviewModal({ visible: false, report: null, action: null });
          setRemarks('');
        }}
        footer={[
          <Button key="cancel" onClick={() => setReviewModal({ visible: false, report: null, action: null })}>
            Cancel
          </Button>,
          reviewModal.action === 'approve' ? (
            <Button key="approve" type="primary" loading={actionLoading} onClick={handleApprove}>
              Approve
            </Button>
          ) : (
            <Button key="reject" type="primary" danger loading={actionLoading} onClick={handleReject}>
              Reject
            </Button>
          ),
        ]}
      >
        {reviewModal.report && (
          <div className="mb-4">
            <p><strong>Student:</strong> {reviewModal.report.student?.name}</p>
            <p><strong>Period:</strong> {dayjs().month(reviewModal.report.reportMonth - 1).format('MMMM')} {reviewModal.report.reportYear}</p>
          </div>
        )}
        <TextArea
          rows={4}
          placeholder={reviewModal.action === 'approve' ? 'Add remarks (optional)' : 'Reason for rejection (required)'}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </Modal>
    </>
  );
};

export default MonthlyReportsCard;
