import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Table, Button, Modal, Upload, message, Switch, Select, Alert,
  Tag, Typography, Empty, Spin, Tooltip, Popconfirm
} from 'antd';
import {
  PlusOutlined, UploadOutlined, EyeOutlined,
  DeleteOutlined, FileTextOutlined, CalendarOutlined, ReloadOutlined,
  CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  InboxOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import API from '../../../services/api';
import studentService from '../../../services/student.service';
import { openFileWithPresignedUrl } from '../../../utils/imageUtils';

const { Text } = Typography;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const StudentReportSubmit = () => {
  const [reports, setReports] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [fileList, setFileList] = useState([]);

  // Auto month detection states
  const [autoMonthSelection, setAutoMonthSelection] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => dayjs().month() + 1);
  const [selectedYear, setSelectedYear] = useState(() => dayjs().year());

  // Month options
  const monthOptions = useMemo(() =>
    MONTH_NAMES.map((name, index) => ({
      value: index + 1,
      label: name,
    })), []
  );

  // Year options
  const yearOptions = useMemo(() => {
    const currentYear = dayjs().year();
    return Array.from({ length: 5 }, (_, i) => ({
      value: currentYear - i + 1,
      label: (currentYear - i + 1).toString(),
    }));
  }, []);

  // Allowed month options based on internship period
  const allowedMonthOptions = useMemo(() => {
    if (!selectedApplication) return monthOptions;

    const startDate = selectedApplication.startDate || selectedApplication.joiningDate;
    const endDate = selectedApplication.endDate;

    if (!startDate || !endDate) return monthOptions;

    const start = dayjs(startDate).startOf('month');
    const end = dayjs(endDate).endOf('month');

    const options = [];
    let cursor = start.clone();
    while (cursor.isBefore(end) || cursor.isSame(end, 'month')) {
      if (cursor.year() === selectedYear) {
        options.push({
          value: cursor.month() + 1,
          label: cursor.format('MMMM')
        });
      }
      cursor = cursor.add(1, 'month');
    }

    return options.length > 0 ? options : monthOptions;
  }, [selectedApplication, selectedYear, monthOptions]);

  // Sync selectedMonth when switching to manual
  useEffect(() => {
    if (!autoMonthSelection && allowedMonthOptions.length > 0) {
      if (!allowedMonthOptions.some(o => o.value === selectedMonth)) {
        setSelectedMonth(allowedMonthOptions[0].value);
      }
    }
  }, [autoMonthSelection, allowedMonthOptions, selectedMonth]);

  // Fetch active application on mount
  useEffect(() => {
    const fetchActiveApplication = async () => {
      try {
        // Get dashboard to find current internship
        const dashboardRes = await studentService.getDashboard();
        const currentInternship = dashboardRes?.currentInternship;

        if (currentInternship) {
          setSelectedApplication(currentInternship);
          setApplications([currentInternship]);
        } else {
          // Fallback: get all self-identified applications
          const appsRes = await studentService.getSelfIdentifiedApplications();
          const apps = appsRes?.applications || [];
          const activeApps = apps.filter(app =>
            ['APPROVED', 'JOINED'].includes(app.status)
          );
          setApplications(activeApps);
          if (activeApps.length > 0) {
            setSelectedApplication(activeApps[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching application:', error);
      }
    };

    fetchActiveApplication();
  }, []);

  // Fetch reports when application changes
  const fetchReports = useCallback(async () => {
    if (!selectedApplication?.id) return;

    setLoading(true);
    try {
      const response = await API.get(`/student/applications/${selectedApplication.id}/reports`);
      const data = response.data?.reports || [];
      setReports(Array.isArray(data) ? data : []);
    } catch (error) {
      message.error('Failed to fetch reports');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [selectedApplication?.id]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Handle file change
  const handleFileChange = useCallback(({ fileList: newFileList }) => {
    const file = newFileList[0]?.originFileObj;
    if (file && file.size > 5 * 1024 * 1024) {
      message.error('File must be smaller than 5MB');
      return;
    }
    setFileList(newFileList.slice(-1));
  }, []);

  // Open modal
  const handleAdd = useCallback(() => {
    if (!selectedApplication) {
      message.warning('No active internship found');
      return;
    }
    setEditingReport(null);
    setFileList([]);
    setAutoMonthSelection(true);
    setSelectedMonth(dayjs().month() + 1);
    setSelectedYear(dayjs().year());
    setModalVisible(true);
  }, [selectedApplication]);

  // Close modal
  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setEditingReport(null);
    setFileList([]);
    setAutoMonthSelection(true);
  }, []);

  // Submit file
  const handleSubmit = useCallback(async () => {
    if (!selectedApplication?.id) {
      message.error('No active internship selected');
      return;
    }

    if (fileList.length === 0) {
      message.error('Please select a file to upload');
      return;
    }

    const file = fileList[0]?.originFileObj || fileList[0];
    if (!file) {
      message.error('Invalid file');
      return;
    }

    const monthValue = autoMonthSelection ? dayjs().month() + 1 : selectedMonth;
    const yearValue = autoMonthSelection ? dayjs().year() : selectedYear;

    if (!monthValue || !yearValue) {
      message.error('Please select report month and year');
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Upload file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('applicationId', selectedApplication.id);
      formData.append('reportMonth', monthValue.toString());
      formData.append('reportYear', yearValue.toString());

      let fileUrl = null;
      try {
        const uploadResponse = await API.post('/student/monthly-reports/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        fileUrl = uploadResponse.data?.reportFileUrl || uploadResponse.data?.url;
      } catch (uploadErr) {
        // Fallback to generic upload
        const genericFormData = new FormData();
        genericFormData.append('file', file);
        const genericUpload = await API.post('/uploads', genericFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        fileUrl = genericUpload.data?.url || genericUpload.data?.path;
      }

      // Step 2: Submit report
      const response = await API.post('/student/monthly-reports', {
        applicationId: selectedApplication.id,
        reportMonth: monthValue,
        reportYear: yearValue,
        reportFileUrl: fileUrl,
      });

      if (response.data?.autoApproved) {
        message.success('Report uploaded and auto-approved!');
      } else {
        message.success('Report uploaded successfully!');
      }

      handleCloseModal();
      fetchReports();
    } catch (error) {
      message.error(error.response?.data?.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  }, [selectedApplication?.id, fileList, autoMonthSelection, selectedMonth, selectedYear, handleCloseModal, fetchReports]);

  // Delete report
  const handleDelete = useCallback(async (id) => {
    try {
      await studentService.deleteMonthlyReport(id);
      message.success('Report deleted');
      fetchReports();
    } catch (error) {
      message.error('Failed to delete report');
    }
  }, [fetchReports]);

  // View report
  const handleView = useCallback((url) => {
    if (url) openFileWithPresignedUrl(url);
  }, []);

  // Replace report
  const handleReplace = useCallback((report) => {
    setEditingReport(report);
    setFileList([]);
    setAutoMonthSelection(false);
    setSelectedMonth(report.reportMonth);
    setSelectedYear(report.reportYear);
    setModalVisible(true);
  }, []);

  // Status tag
  const getStatusTag = useCallback((status) => {
    const config = {
      APPROVED: { color: 'success', icon: <CheckCircleOutlined />, text: 'Approved' },
      SUBMITTED: { color: 'processing', icon: <ClockCircleOutlined />, text: 'Submitted' },
      PENDING: { color: 'warning', icon: <ExclamationCircleOutlined />, text: 'Pending' },
      DRAFT: { color: 'default', icon: <FileTextOutlined />, text: 'Draft' },
      REJECTED: { color: 'error', icon: <ExclamationCircleOutlined />, text: 'Rejected' },
    };
    const { color, icon, text } = config[status] || config.DRAFT;
    return <Tag color={color} icon={icon} className="rounded-full text-xs">{text}</Tag>;
  }, []);

  // Table columns
  const columns = [
    {
      title: 'Period',
      key: 'period',
      width: 140,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarOutlined className="text-primary text-sm" />
          </div>
          <div>
            <Text className="text-sm font-medium block">
              {MONTH_NAMES[record.reportMonth - 1]?.slice(0, 3) || record.reportMonth}
            </Text>
            <Text className="text-[10px] text-text-tertiary">{record.reportYear}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'File',
      key: 'file',
      ellipsis: true,
      render: (_, record) => (
        <Text className="text-xs">
          {record.reportFileUrl ? 'Uploaded' : '-'}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status) => getStatusTag(status),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <div className="flex items-center justify-center gap-1">
          {record.reportFileUrl && (
            <Tooltip title="View">
              <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleView(record.reportFileUrl)} />
            </Tooltip>
          )}
          {record.status !== 'APPROVED' && (
            <>
              <Tooltip title="Replace">
                <Button type="text" size="small" icon={<UploadOutlined />} onClick={() => handleReplace(record)} />
              </Tooltip>
              <Popconfirm title="Delete this report?" onConfirm={() => handleDelete(record.id)} okText="Yes" cancelText="No">
                <Tooltip title="Delete">
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </div>
      ),
    },
  ];

  // Stats
  const stats = {
    total: reports.length,
    approved: reports.filter(r => r.status === 'APPROVED').length,
    pending: reports.filter(r => r.status === 'PENDING' || r.status === 'SUBMITTED' || r.status === 'DRAFT').length,
  };

  // No application state
  if (!loading && !selectedApplication && applications.length === 0) {
    return (
      <div className="p-4 md:p-5 min-h-screen">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 rounded-full bg-primary" />
          <div>
            <h1 className="text-lg font-semibold text-text-primary m-0">Monthly Reports</h1>
            <Text className="text-xs text-text-tertiary">Track your internship progress</Text>
          </div>
        </div>
        <Card className="rounded-xl border border-gray-100 shadow-sm">
          <Empty
            image={<FileTextOutlined className="text-4xl text-gray-300" />}
            imageStyle={{ height: 50 }}
            description={
              <div className="text-center py-4">
                <Text className="text-sm text-text-secondary block mb-1">No Active Internship</Text>
                <Text className="text-xs text-text-tertiary">You need an active internship to submit reports</Text>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-5 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-primary" />
          <div>
            <h1 className="text-lg font-semibold text-text-primary m-0">Monthly Reports</h1>
            <Text className="text-xs text-text-tertiary">
              {selectedApplication?.companyName || 'Track your internship progress'}
            </Text>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip title="Refresh">
            <Button type="text" icon={<ReloadOutlined spin={loading} />} onClick={fetchReports} />
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="small" className="rounded-lg">
            Upload Report
          </Button>
        </div>
      </div>

      {/* Application Selector (if multiple) */}
      {applications.length > 1 && (
        <div className="mb-4">
          <Select
            value={selectedApplication?.id}
            onChange={(id) => setSelectedApplication(applications.find(a => a.id === id))}
            options={applications.map(app => ({
              value: app.id,
              label: app.companyName || 'Internship',
            }))}
            className="w-full max-w-xs"
            size="small"
          />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-background-secondary rounded-lg p-3 text-center">
          <Text className="text-lg font-bold text-primary block">{stats.total}</Text>
          <Text className="text-[10px] text-text-tertiary">Total</Text>
        </div>
        <div className="bg-background-secondary rounded-lg p-3 text-center">
          <Text className="text-lg font-bold text-green-500 block">{stats.approved}</Text>
          <Text className="text-[10px] text-text-tertiary">Approved</Text>
        </div>
        <div className="bg-background-secondary rounded-lg p-3 text-center">
          <Text className="text-lg font-bold text-orange-500 block">{stats.pending}</Text>
          <Text className="text-[10px] text-text-tertiary">Pending</Text>
        </div>
      </div>

      {/* Reports Table */}
      <Card className="rounded-xl border border-gray-100 shadow-sm" styles={{ body: { padding: 0 } }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spin />
          </div>
        ) : reports.length === 0 ? (
          <Empty
            image={<FileTextOutlined className="text-4xl text-gray-300" />}
            imageStyle={{ height: 50 }}
            description={
              <div className="text-center">
                <Text className="text-sm text-text-secondary block">No reports yet</Text>
                <Text className="text-xs text-text-tertiary">Upload your first monthly report</Text>
              </div>
            }
            className="py-12"
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Upload Report</Button>
          </Empty>
        ) : (
          <Table
            dataSource={reports}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10, size: 'small', showSizeChanger: false }}
            className="[&_.ant-table-thead_th]:!bg-background-secondary [&_.ant-table-thead_th]:!text-xs [&_.ant-table-thead_th]:!font-medium"
          />
        )}
      </Card>

      {/* Upload Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-primary" />
            <span>{editingReport ? 'Replace Report' : 'Upload Monthly Report'}</span>
          </div>
        }
        open={modalVisible}
        onCancel={handleCloseModal}
        footer={[
          <Button key="cancel" onClick={handleCloseModal}>Cancel</Button>,
          <Button
            key="submit"
            type="primary"
            loading={submitting}
            onClick={handleSubmit}
            disabled={fileList.length === 0 || (!autoMonthSelection && (!selectedMonth || !selectedYear))}
            icon={<UploadOutlined />}
          >
            {editingReport ? 'Replace' : 'Upload'}
          </Button>
        ]}
        width={480}
        destroyOnClose
      >
        <div className="py-4 space-y-4">
          {/* Replacing info */}
          {editingReport && (
            <div className="p-3 bg-background-secondary rounded-lg">
              <Text className="text-xs text-text-tertiary block">Replacing report for</Text>
              <Text className="text-sm font-medium">
                {MONTH_NAMES[editingReport.reportMonth - 1]} {editingReport.reportYear}
              </Text>
            </div>
          )}

          {/* File Upload */}
          <div>
            <Text className="text-xs font-medium block mb-2">Select Report File (PDF)</Text>
            <Upload.Dragger
              accept=".pdf"
              maxCount={1}
              fileList={fileList}
              onChange={handleFileChange}
              beforeUpload={() => false}
              onRemove={() => setFileList([])}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined className="text-3xl text-primary" />
              </p>
              <p className="ant-upload-text text-sm">Click or drag PDF file to upload</p>
              <p className="ant-upload-hint text-xs text-text-tertiary">Max 5MB</p>
            </Upload.Dragger>
          </div>

          {/* Auto Month Detection Toggle */}
          {!editingReport && (
            <>
              <div className="bg-background-secondary rounded-lg p-3 flex items-center justify-between">
                <div>
                  <Text className="text-sm font-medium block">Auto-detect month</Text>
                  <Text className="text-[10px] text-text-tertiary">
                    Turn off to select month manually
                  </Text>
                </div>
                <Switch
                  checked={autoMonthSelection}
                  onChange={(checked) => {
                    setAutoMonthSelection(checked);
                    if (checked) {
                      setSelectedMonth(dayjs().month() + 1);
                      setSelectedYear(dayjs().year());
                    }
                  }}
                  size="small"
                />
              </div>

              {/* Manual Month/Year Selection */}
              {!autoMonthSelection && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Text className="text-xs font-medium block mb-1.5">Month</Text>
                    <Select
                      value={selectedMonth}
                      onChange={setSelectedMonth}
                      options={allowedMonthOptions}
                      placeholder="Select month"
                      className="w-full"
                      size="small"
                    />
                  </div>
                  <div>
                    <Text className="text-xs font-medium block mb-1.5">Year</Text>
                    <Select
                      value={selectedYear}
                      onChange={setSelectedYear}
                      options={yearOptions}
                      placeholder="Select year"
                      className="w-full"
                      size="small"
                    />
                  </div>
                </div>
              )}

              {/* Info Alert */}
              <Alert
                type="info"
                showIcon
                message={
                  <Text className="text-xs">
                    {autoMonthSelection
                      ? `Report will be uploaded for ${MONTH_NAMES[dayjs().month()]} ${dayjs().year()}`
                      : `Report will be uploaded for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
                    }
                  </Text>
                }
                className="!py-2"
              />
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default StudentReportSubmit;
