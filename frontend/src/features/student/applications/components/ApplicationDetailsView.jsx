import React, { memo, useState } from 'react';
import { Card, Button, Typography, Tabs, Tag, Upload, Modal, message, Progress, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  UploadOutlined,
  EyeOutlined,
  DeleteOutlined,
  BankOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { hasInternshipStarted } from '../utils/applicationUtils';
import {
  ApplicationDetailsTab,
  ApplicationTimelineTab,
  ApplicationProgressTab,
} from './tabs';
import FacultyVisitsSection from './FacultyVisitsSection';
import studentService from '../../../../services/student.service';
import { openFileWithPresignedUrl } from '../../../../utils/imageUtils';

const { Text } = Typography;

const ApplicationDetailsView = ({
  application,
  onBack,
  monthlyReports,
  monthlyReportsProgress,
  monthlyReportsLoading,
  monthlyReportsUploading,
  onUploadReport,
  onDeleteReport,
  onRefreshReports,
  facultyVisits = [],
  facultyVisitsProgress = {},
  facultyVisitsLoading = false,
  onRefresh,
}) => {
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  if (!application) return null;

  const isSelfIdentified = application.isSelfIdentified || !application.internship;
  const internship = application.internship;
  const industry = internship?.industry || {};
  const internshipStarted = hasInternshipStarted(application);

  const company = isSelfIdentified
    ? { companyName: application.companyName, city: application.companyAddress?.split(',')[0] }
    : industry;

  const hasJoiningLetter = !!(application?.joiningLetterUrl || application?.joiningLetter);
  const joiningLetterUrl = application?.joiningLetterUrl || application?.joiningLetter;

  // Calculate progress
  const startDate = application.joiningDate || application.startDate || internship?.startDate;
  const endDate = application.endDate || internship?.endDate;
  const totalDays = endDate && startDate ? dayjs(endDate).diff(dayjs(startDate), 'day') : 0;
  const daysCompleted = startDate ? Math.max(0, dayjs().diff(dayjs(startDate), 'day')) : 0;
  const progressPercent = totalDays > 0 ? Math.min(Math.round((daysCompleted / totalDays) * 100), 100) : 0;

  const handleFileSelect = (file) => {
    if (file.type !== 'application/pdf') {
      message.error('Only PDF files are allowed');
      return false;
    }
    if (file.size / 1024 / 1024 > 5) {
      message.error('File must be smaller than 5MB');
      return false;
    }
    setSelectedFile(file);
    return false;
  };

  const handleUploadJoiningLetter = async () => {
    if (!selectedFile) return;
    try {
      setUploading(true);
      await studentService.uploadJoiningLetter(application.id, selectedFile);
      message.success('Joining letter uploaded successfully');
      setUploadModalVisible(false);
      setSelectedFile(null);
      onRefresh?.();
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to upload');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteJoiningLetter = async () => {
    try {
      setUploading(true);
      await studentService.deleteJoiningLetter(application.id);
      message.success('Joining letter deleted');
      setDeleteConfirmVisible(false);
      onRefresh?.();
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to delete');
    } finally {
      setUploading(false);
    }
  };

  const handleViewJoiningLetter = () => {
    if (joiningLetterUrl) openFileWithPresignedUrl(joiningLetterUrl);
  };

  const getStatusColor = (status) => {
    const colors = {
      APPLIED: 'blue', SHORTLISTED: 'orange', SELECTED: 'green',
      APPROVED: 'green', JOINED: 'purple', COMPLETED: 'cyan',
      REJECTED: 'red', WITHDRAWN: 'default',
    };
    return colors[status] || 'default';
  };

  const tabItems = [
    {
      key: 'details',
      label: <span className="flex items-center gap-1.5 text-sm"><FileTextOutlined />Details</span>,
      children: (
        <ApplicationDetailsTab
          application={application}
          isSelfIdentified={isSelfIdentified}
          internship={internship}
          industry={industry}
        />
      ),
    },
    {
      key: 'timeline',
      label: <span className="flex items-center gap-1.5 text-sm"><ClockCircleOutlined />Timeline</span>,
      children: <ApplicationTimelineTab application={application} />,
    },
    {
      key: 'reports',
      label: (
        <span className="flex items-center gap-1.5 text-sm">
          <CalendarOutlined />Reports
          {monthlyReportsProgress?.pending > 0 && (
            <Tag color="warning" className="!ml-1 !px-1.5 !py-0 text-[10px] rounded-full">{monthlyReportsProgress.pending}</Tag>
          )}
        </span>
      ),
      children: (
        <ApplicationProgressTab
          application={application}
          monthlyReports={monthlyReports}
          monthlyReportsProgress={monthlyReportsProgress}
          monthlyReportsLoading={monthlyReportsLoading}
          monthlyReportsUploading={monthlyReportsUploading}
          internshipStarted={internshipStarted}
          onUploadReport={onUploadReport}
          onDeleteReport={onDeleteReport}
          onRefreshReports={onRefreshReports}
        />
      ),
    },
    {
      key: 'visits',
      label: <span className="flex items-center gap-1.5 text-sm"><TeamOutlined />Faculty Visits</span>,
      children: (
        <FacultyVisitsSection
          application={application}
          visits={facultyVisits}
          progress={facultyVisitsProgress}
          loading={facultyVisitsLoading}
          hasStarted={internshipStarted}
        />
      ),
    },
  ];

  return (
    <div className="!space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          type="text"
          className="text-text-secondary hover:text-text-primary"
        >
          Back
        </Button>
        <Tag color={getStatusColor(application.status)} className="rounded-full px-3">
          {application.status?.replace(/_/g, ' ')}
        </Tag>
      </div>

      {/* Company Info Card */}
      <Card className="rounded-xl border border-gray-100 shadow-sm" styles={{ body: { padding: '16px' } }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BankOutlined className="text-lg text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Text strong className="text-base">{company.companyName || 'Company'}</Text>
                {isSelfIdentified && <Tag color="purple" className="text-[10px] rounded-full">Self-Identified</Tag>}
              </div>
              <Text className="text-xs text-text-tertiary">{application.jobProfile || internship?.title || 'Internship'}</Text>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="hidden sm:flex items-center gap-4">
            <Tooltip title="Reports Submitted">
              <div className="text-center">
                <Text className="text-lg font-bold text-primary block">{monthlyReportsProgress?.approved || 0}/{monthlyReportsProgress?.total || 0}</Text>
                <Text className="text-[10px] text-text-tertiary">Reports</Text>
              </div>
            </Tooltip>
            <Tooltip title="Faculty Visits">
              <div className="text-center">
                <Text className="text-lg font-bold text-purple-500 block">{facultyVisitsProgress?.completed || 0}/{facultyVisitsProgress?.total || 0}</Text>
                <Text className="text-[10px] text-text-tertiary">Visits</Text>
              </div>
            </Tooltip>
          </div>
        </div>

        {/* Progress Bar */}
        {internshipStarted && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center mb-1.5">
              <Text className="text-xs text-text-tertiary">Progress</Text>
              <Text className="text-xs font-semibold text-primary">{progressPercent}%</Text>
            </div>
            <Progress
              percent={progressPercent}
              showInfo={false}
              strokeColor={{ '0%': '#3b82f6', '100%': '#10b981' }}
              size="small"
            />
            <div className="flex justify-between text-[10px] text-text-tertiary mt-1">
              <span>{startDate ? dayjs(startDate).format('MMM D, YYYY') : 'N/A'}</span>
              <span>{daysCompleted} days</span>
              <span>{endDate ? dayjs(endDate).format('MMM D, YYYY') : 'N/A'}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Joining Letter - Compact */}
      {isSelfIdentified && (
        <Card className="rounded-xl border border-gray-100 shadow-sm" styles={{ body: { padding: '12px 16px' } }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${hasJoiningLetter ? 'bg-green-100' : 'bg-orange-100'}`}>
                <FileTextOutlined className={`text-base ${hasJoiningLetter ? 'text-green-600' : 'text-orange-600'}`} />
              </div>
              <div>
                <Text strong className="text-sm block">Joining Letter</Text>
                <Text className={`text-[10px] ${hasJoiningLetter ? 'text-green-600' : 'text-orange-600'}`}>
                  {hasJoiningLetter ? 'Uploaded' : 'Required'}
                </Text>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {hasJoiningLetter ? (
                <>
                  <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} onClick={handleViewJoiningLetter} /></Tooltip>
                  <Tooltip title="Replace"><Button type="text" size="small" icon={<UploadOutlined />} onClick={() => setUploadModalVisible(true)} /></Tooltip>
                  <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => setDeleteConfirmVisible(true)} /></Tooltip>
                </>
              ) : (
                <Button type="primary" size="small" icon={<UploadOutlined />} onClick={() => setUploadModalVisible(true)}>
                  Upload
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Card className="rounded-xl border border-gray-100 shadow-sm" styles={{ body: { padding: '0' } }}>
        <Tabs
          defaultActiveKey="details"
          items={tabItems}
          className="!px-4"
          size="small"
        />
      </Card>

      {/* Upload Modal */}
      <Modal
        title="Upload Joining Letter"
        open={uploadModalVisible}
        onCancel={() => { setUploadModalVisible(false); setSelectedFile(null); }}
        footer={[
          <Button key="cancel" onClick={() => { setUploadModalVisible(false); setSelectedFile(null); }}>Cancel</Button>,
          <Button key="upload" type="primary" loading={uploading} disabled={!selectedFile} onClick={handleUploadJoiningLetter}>
            Upload
          </Button>,
        ]}
        width={400}
      >
        <Upload.Dragger
          accept=".pdf"
          maxCount={1}
          beforeUpload={handleFileSelect}
          onRemove={() => setSelectedFile(null)}
          fileList={selectedFile ? [{ uid: '-1', name: selectedFile.name, status: 'done' }] : []}
        >
          <p className="ant-upload-drag-icon"><UploadOutlined className="text-3xl text-primary" /></p>
          <p className="ant-upload-text text-sm">Click or drag PDF file</p>
          <p className="ant-upload-hint text-xs text-text-tertiary">Max 5MB</p>
        </Upload.Dragger>
      </Modal>

      {/* Delete Modal */}
      <Modal
        title={<span className="text-red-500">Delete Joining Letter</span>}
        open={deleteConfirmVisible}
        onCancel={() => setDeleteConfirmVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setDeleteConfirmVisible(false)}>Cancel</Button>,
          <Button key="delete" danger loading={uploading} onClick={handleDeleteJoiningLetter}>Delete</Button>,
        ]}
        width={360}
      >
        <p className="text-sm">Are you sure you want to delete the joining letter?</p>
        <p className="text-xs text-red-500">This action cannot be undone.</p>
      </Modal>
    </div>
  );
};

ApplicationDetailsView.displayName = 'ApplicationDetailsView';

export default memo(ApplicationDetailsView);
