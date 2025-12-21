import React, { useState } from 'react';
import {
  Card,
  Steps,
  Upload,
  Button,
  Table,
  Progress,
  Alert,
  message,
  Typography,
  Space,
  Row,
  Col,
  Tag,
  Statistic,
} from 'antd';
import {
  InboxOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { bulkService } from '../../../services/bulk.service';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const BulkUpload = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Step 0: Upload File
  const handleFileChange = (info) => {
    const { status } = info.file;
    if (status === 'done' || status === 'uploading') {
      setFile(info.file.originFileObj || info.file);
    }
  };

  const beforeUpload = (file) => {
    const isCSV = file.type === 'text/csv';
    const isExcel =
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel';

    if (!isCSV && !isExcel) {
      message.error('You can only upload CSV or Excel files');
      return Upload.LIST_IGNORE;
    }

    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('File must be smaller than 10MB');
      return Upload.LIST_IGNORE;
    }

    setFile(file);
    return false; // Prevent auto upload
  };

  const handleNext = () => {
    if (currentStep === 0 && file) {
      handleValidate();
    } else if (currentStep === 1 && validationResult) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      handleUpload();
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setFile(null);
    setValidationResult(null);
    setUploadProgress(0);
    setUploadResult(null);
  };

  // Step 1: Validate
  const handleValidate = async () => {
    if (!file) {
      message.warning('Please select a file first');
      return;
    }

    setLoading(true);
    try {
      const result = await bulkService.validateInstitutions(file);
      setValidationResult(result);
      setCurrentStep(1);
      message.success('Validation completed');
    } catch (error) {
      message.error(error.response?.data?.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Upload
  const handleUpload = async () => {
    setLoading(true);
    setCurrentStep(2);

    try {
      const result = await bulkService.uploadInstitutions(file, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percentCompleted);
      });

      setUploadResult(result);
      setCurrentStep(3);
      message.success('Upload completed');
    } catch (error) {
      message.error(error.response?.data?.message || 'Upload failed');
      setCurrentStep(1);
    } finally {
      setLoading(false);
    }
  };

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const blob = await bulkService.downloadInstitutionTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'institution_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('Template downloaded');
    } catch (error) {
      message.error('Failed to download template');
    }
  };

  // Download error report
  const handleDownloadErrors = () => {
    if (!validationResult?.errors || validationResult.errors.length === 0) return;

    const errorData = validationResult.errors.map((err) => ({
      Row: err.row,
      Field: err.field,
      Error: err.message,
    }));

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Row,Field,Error', ...errorData.map((e) => `${e.Row},${e.Field},"${e.Error}"`)].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'validation_errors.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    message.success('Error report downloaded');
  };

  // Table columns for preview
  const getPreviewColumns = () => {
    if (!validationResult?.data || validationResult.data.length === 0) return [];

    const firstRow = validationResult.data[0];
    const keys = Object.keys(firstRow);

    return keys.map((key) => ({
      title: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      dataIndex: key,
      key: key,
      render: (text, record, index) => {
        const rowErrors = validationResult.errors?.filter((err) => err.row === index + 2);
        const fieldError = rowErrors?.find((err) => err.field === key);

        if (fieldError) {
          return (
            <Space direction="vertical" size={0}>
              <Text type="danger">{text}</Text>
              <Text type="danger" style={{ fontSize: '12px' }}>
                {fieldError.message}
              </Text>
            </Space>
          );
        }

        return text;
      },
    }));
  };

  const getPreviewData = () => {
    if (!validationResult?.data) return [];
    return validationResult.data.map((row, index) => ({
      key: index,
      ...row,
    }));
  };

  const steps = [
    {
      title: 'Upload File',
      icon: <UploadOutlined />,
    },
    {
      title: 'Validate',
      icon: <CheckCircleOutlined />,
    },
    {
      title: 'Review',
      icon: <WarningOutlined />,
    },
    {
      title: 'Complete',
      icon: <CheckCircleOutlined />,
    },
  ];

  return (
    <div className="p-6">
      <Card className="shadow-sm border-slate-200">
        <Title level={2} className="!text-slate-900">Bulk Institution Upload</Title>
        <Paragraph className="text-slate-600">
          Upload multiple institutions at once using Excel or CSV files. Follow the steps below to validate and import
          your data.
        </Paragraph>

        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleDownloadTemplate}
          style={{ marginBottom: '24px' }}
        >
          Download Template
        </Button>

        <Steps current={currentStep} items={steps} style={{ marginBottom: '32px' }} />

        {/* Step 0: Upload File */}
        {currentStep === 0 && (
          <Card>
            <Dragger
              name="file"
              multiple={false}
              beforeUpload={beforeUpload}
              onChange={handleFileChange}
              accept=".csv,.xlsx,.xls"
              maxCount={1}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag file to this area to upload</p>
              <p className="ant-upload-hint">
                Support for CSV and Excel files only. Maximum file size is 10MB.
              </p>
            </Dragger>

            {file && (
              <Alert
                title="File Selected"
                description={`${file.name} (${(file.size / 1024).toFixed(2)} KB)`}
                type="success"
                showIcon
                style={{ marginTop: '16px' }}
              />
            )}

            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <Button type="primary" onClick={handleNext} disabled={!file} loading={loading}>
                Validate File
              </Button>
            </div>
          </Card>
        )}

        {/* Step 1: Validate Results */}
        {currentStep === 1 && validationResult && (
          <Card>
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Total Rows"
                    value={validationResult.total || 0}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Valid Rows"
                    value={validationResult.valid || 0}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Error Rows"
                    value={validationResult.errors?.length || 0}
                    prefix={<CloseCircleOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            {validationResult.errors && validationResult.errors.length > 0 && (
              <Alert
                title="Validation Errors Found"
                description={`${validationResult.errors.length} error(s) found in the uploaded file. Please review the errors below.`}
                type="error"
                showIcon
                action={
                  <Button size="small" danger onClick={handleDownloadErrors}>
                    Download Errors
                  </Button>
                }
                style={{ marginBottom: '16px' }}
              />
            )}

            <Title level={4}>Data Preview</Title>
            <Table
              columns={getPreviewColumns()}
              dataSource={getPreviewData()}
              scroll={{ x: true }}
              pagination={{ pageSize: 10 }}
            />

            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <Space>
                <Button onClick={handleBack}>Back</Button>
                <Button
                  type="primary"
                  onClick={handleNext}
                  disabled={validationResult.errors && validationResult.errors.length > 0}
                >
                  Continue to Upload
                </Button>
              </Space>
            </div>
          </Card>
        )}

        {/* Step 2: Upload Progress */}
        {currentStep === 2 && (
          <Card>
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <Title level={3}>Uploading Institutions...</Title>
              <Progress
                percent={uploadProgress}
                status={uploadProgress === 100 ? 'success' : 'active'}
                style={{ marginTop: '24px' }}
              />
              <Paragraph type="secondary" style={{ marginTop: '16px' }}>
                Please wait while we process your file. Do not close this window.
              </Paragraph>
            </div>
          </Card>
        )}

        {/* Step 3: Complete */}
        {currentStep === 3 && uploadResult && (
          <Card>
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <CheckCircleOutlined className="text-green-500" style={{ fontSize: '64px' }} />
              <Title level={2} style={{ marginTop: '16px' }}>
                Upload Complete!
              </Title>
            </div>

            <Row gutter={16} style={{ marginTop: '24px' }}>
              <Col span={12}>
                <Card>
                  <Statistic
                    title="Successfully Created"
                    value={uploadResult.success || 0}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card>
                  <Statistic
                    title="Failed"
                    value={uploadResult.failed || 0}
                    prefix={<CloseCircleOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <Alert
                title="Some institutions failed to upload"
                description={
                  <div>
                    <Paragraph>The following errors occurred:</Paragraph>
                    <ul>
                      {uploadResult.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>
                          Row {err.row}: {err.message}
                        </li>
                      ))}
                    </ul>
                    {uploadResult.errors.length > 5 && (
                      <Text type="secondary">...and {uploadResult.errors.length - 5} more errors</Text>
                    )}
                  </div>
                }
                type="warning"
                showIcon
                style={{ marginTop: '24px' }}
              />
            )}

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <Button type="primary" size="large" onClick={handleReset}>
                Upload Another File
              </Button>
            </div>
          </Card>
        )}
      </Card>
    </div>
  );
};

export default BulkUpload;