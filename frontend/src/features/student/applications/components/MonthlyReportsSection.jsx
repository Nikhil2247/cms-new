import React, { useState } from 'react';
import {
  Card,
  Button,
  Tag,
  Empty,
  Spin,
  Progress,
  Select,
  Popconfirm,
  Typography,
  message,
} from 'antd';
import {
  FileTextOutlined,
  UploadOutlined,
  DeleteOutlined,
  SendOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { MONTH_NAMES, getAllowedReportMonths } from '../utils/applicationUtils';

const { Text } = Typography;

const getReportStatusConfig = (status) => {
  const configs = {
    DRAFT: { color: 'default', label: 'Draft', icon: <FileTextOutlined /> },
    SUBMITTED: { color: 'blue', label: 'Submitted', icon: <ClockCircleOutlined /> },
    APPROVED: { color: 'green', label: 'Approved', icon: <CheckCircleOutlined /> },
    REJECTED: { color: 'red', label: 'Rejected', icon: <ExclamationCircleOutlined /> },
  };
  return configs[status] || configs.DRAFT;
};

const MonthlyReportsSection = ({
  application,
  reports,
  loading,
  uploading,
  missingReports,
  onUpload,
  onSubmit,
  onDelete,
  onRefresh,
  hasStarted,
}) => {
  const [reportFile, setReportFile] = useState(null);
  const [autoSelect, setAutoSelect] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const allowedMonths = getAllowedReportMonths(application);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        message.error('Please upload a PDF file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        message.error('File size should be less than 10MB');
        return;
      }
      setReportFile(file);
    }
  };

  const handleUpload = async () => {
    if (!reportFile) {
      message.warning('Please select a file');
      return;
    }

    const month = autoSelect ? new Date().getMonth() + 1 : selectedMonth;
    const year = autoSelect ? new Date().getFullYear() : selectedYear;

    try {
      await onUpload(application.id, reportFile, month, year);
      setReportFile(null);
      onRefresh();
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleSubmitReport = async (reportId) => {
    try {
      await onSubmit(reportId);
      onRefresh();
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDeleteReport = async (reportId, status) => {
    if (status !== 'DRAFT') {
      message.warning('Only draft reports can be deleted');
      return;
    }
    try {
      await onDelete(reportId);
      onRefresh();
    } catch (error) {
      // Error handled in hook
    }
  };

  if (!hasStarted) {
    return (
      <Card className="rounded-xl">
        <Empty
          description={
            <div className="text-center">
              <Text className="text-gray-500">
                Monthly reports will be available once your internship starts
              </Text>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <Card className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UploadOutlined className="text-blue-600 text-lg" />
            <Text strong>Upload Monthly Report</Text>
          </div>
          <div className="flex items-center gap-2">
            <Text className="text-sm text-gray-500">Auto-select month:</Text>
            <input
              type="checkbox"
              checked={autoSelect}
              onChange={(e) => setAutoSelect(e.target.checked)}
              className="rounded"
            />
          </div>
        </div>

        {!autoSelect && (
          <div className="flex gap-4 mb-4">
            <Select
              value={selectedMonth}
              onChange={setSelectedMonth}
              className="w-40"
              options={allowedMonths.map((m) => ({
                value: m.value,
                label: m.label,
              }))}
            />
            <Select
              value={selectedYear}
              onChange={setSelectedYear}
              className="w-28"
              options={[
                { value: 2024, label: '2024' },
                { value: 2025, label: '2025' },
                { value: 2026, label: '2026' },
              ]}
            />
          </div>
        )}

        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="hidden"
            id="report-file-input"
          />
          <label
            htmlFor="report-file-input"
            className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 transition-colors"
          >
            {reportFile ? (
              <div className="flex items-center justify-center gap-2">
                <FileTextOutlined className="text-blue-600" />
                <span className="text-blue-600">{reportFile.name}</span>
              </div>
            ) : (
              <div className="text-gray-500">
                <UploadOutlined className="text-2xl mb-1" />
                <p>Click to select PDF file (max 10MB)</p>
              </div>
            )}
          </label>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={handleUpload}
            loading={uploading}
            disabled={!reportFile}
            className="bg-blue-600"
          >
            Upload
          </Button>
        </div>
      </Card>

      {/* Missing Reports Alert */}
      {missingReports.length > 0 && (
        <Card className="rounded-xl bg-yellow-50 border-yellow-200">
          <div className="flex items-center gap-2 mb-2">
            <ExclamationCircleOutlined className="text-yellow-600" />
            <Text strong className="text-yellow-700">Missing Reports</Text>
          </div>
          <div className="flex flex-wrap gap-2">
            {missingReports.map((m, idx) => (
              <Tag key={idx} color="warning">
                {MONTH_NAMES[m.month - 1]} {m.year}
              </Tag>
            ))}
          </div>
        </Card>
      )}

      {/* Reports List */}
      <Card className="rounded-xl" title="Submitted Reports">
        {loading ? (
          <div className="text-center py-8">
            <Spin />
          </div>
        ) : reports.length === 0 ? (
          <Empty description="No reports submitted yet" />
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const statusConfig = getReportStatusConfig(report.status);
              return (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileTextOutlined className="text-blue-600 text-xl" />
                    </div>
                    <div>
                      <Text strong>
                        {MONTH_NAMES[report.reportMonth - 1]} {report.reportYear}
                      </Text>
                      <div className="text-xs text-gray-500">
                        Uploaded: {new Date(report.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Tag color={statusConfig.color} icon={statusConfig.icon}>
                      {statusConfig.label}
                    </Tag>

                    {report.status === 'DRAFT' && (
                      <>
                        <Button
                          type="primary"
                          size="small"
                          icon={<SendOutlined />}
                          onClick={() => handleSubmitReport(report.id)}
                          className="bg-green-600"
                        >
                          Submit
                        </Button>
                        <Popconfirm
                          title="Delete this report?"
                          onConfirm={() => handleDeleteReport(report.id, report.status)}
                        >
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                          />
                        </Popconfirm>
                      </>
                    )}

                    {report.reportFileUrl && (
                      <Button
                        size="small"
                        type="link"
                        onClick={() => window.open(report.reportFileUrl, '_blank')}
                      >
                        View
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Progress */}
      {reports.length > 0 && (
        <Card className="rounded-xl">
          <Text strong className="block mb-2">Report Submission Progress</Text>
          <Progress
            percent={Math.round(
              (reports.filter((r) => r.status === 'APPROVED').length / 6) * 100
            )}
            status="active"
            strokeColor={{ from: '#108ee9', to: '#87d068' }}
          />
          <Text className="text-xs text-gray-500">
            {reports.filter((r) => r.status === 'APPROVED').length} of 6 reports approved
          </Text>
        </Card>
      )}
    </div>
  );
};

export default MonthlyReportsSection;
