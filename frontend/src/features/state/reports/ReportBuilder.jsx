import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Row,
  Col,
  Select,
  DatePicker,
  Form,
  Button,
  Table,
  Tag,
  Steps,
  Space,
  Typography,
  Empty,
  Spin,
  Tooltip,
  Input,
  InputNumber,
} from 'antd';
import {
  BarChartOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  DownloadOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import {
  fetchReportCatalog,
  fetchReportConfig,
  generateNewReport,
  fetchReportHistory,
  checkReportStatus,
} from '../store/stateSlice';
import reportService from '../../../services/report.service';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { Step } = Steps;

const ReportBuilder = () => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [pollingReports, setPollingReports] = useState(new Set());

  const { catalog: catalogData, config, history: historyData, generating, loading, error } = useSelector(
    (state) => state.state.reportBuilder
  );

  // Ensure history is always an array
  const history = React.useMemo(() => {
    if (Array.isArray(historyData)) {
      return historyData;
    }
    if (historyData?.data && Array.isArray(historyData.data)) {
      return historyData.data;
    }
    return [];
  }, [historyData]);

  // Convert catalog to array if it's an object (grouped by category)
  const catalog = React.useMemo(() => {
    let reports = [];
    if (Array.isArray(catalogData)) {
      reports = catalogData;
    } else if (catalogData && typeof catalogData === 'object') {
      // Flatten all reports from all categories
      reports = Object.values(catalogData).flat();
    }
    // Filter out items with null/undefined type values to avoid Select warnings
    return reports.filter((r) => r && r.type != null);
  }, [catalogData]);

  useEffect(() => {
    dispatch(fetchReportCatalog());
    dispatch(fetchReportHistory({ page: 1, limit: 10 }));
  }, [dispatch]);

  // Polling for report status
  useEffect(() => {
    if (pollingReports.size === 0) return;

    const interval = setInterval(async () => {
      const reportIds = Array.from(pollingReports);
      for (const id of reportIds) {
        try {
          const result = await dispatch(checkReportStatus(id)).unwrap();
          if (result.status === 'completed' || result.status === 'failed') {
            setPollingReports((prev) => {
              const updated = new Set(prev);
              updated.delete(id);
              return updated;
            });
            if (result.status === 'completed') {
              toast.success(`Report ${result.type} completed successfully!`);
            } else {
              toast.error(`Report ${result.type} failed to generate.`);
            }
          }
        } catch (err) {
          console.error('Failed to check report status:', err);
        }
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [pollingReports, dispatch]);

  const handleTypeSelect = async (type) => {
    setSelectedType(type);
    form.resetFields();
    setCurrentStep(1);
    try {
      await dispatch(fetchReportConfig(type)).unwrap();
    } catch (err) {
      toast.error('Failed to load report configuration');
    }
  };

  const handleGenerate = async (values) => {
    if (!selectedType) {
      toast.error('Please select a report type');
      return;
    }

    setCurrentStep(2);
    const filters = { ...values };

    // Convert date ranges to ISO strings
    if (filters.dateRange) {
      filters.startDate = filters.dateRange[0].toISOString();
      filters.endDate = filters.dateRange[1].toISOString();
      delete filters.dateRange;
    }

    const reportData = {
      type: selectedType,
      filters,
      format: selectedFormat,
    };

    try {
      const result = await dispatch(generateNewReport(reportData)).unwrap();
      toast.success('Report generation started!');
      setPollingReports((prev) => new Set(prev).add(result.id));
      setCurrentStep(3);
      dispatch(fetchReportHistory({ page: 1, limit: 10 }));
    } catch (err) {
      toast.error(err || 'Failed to generate report');
      setCurrentStep(1);
    }
  };

  const handleDownload = async (reportId, reportType) => {
    try {
      const blob = await reportService.downloadReport(reportId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}_${dayjs().format('YYYY-MM-DD')}.${selectedFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded successfully!');
    } catch (err) {
      toast.error('Failed to download report');
    }
  };

  const getReportIcon = (type) => {
    const icons = {
      student_performance: FileTextOutlined,
      institution_analytics: BarChartOutlined,
      placement_summary: FileSearchOutlined,
      default: FileTextOutlined,
    };
    const IconComponent = icons[type] || icons.default;
    return <IconComponent style={{ fontSize: 20 }} />;
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      pending: { color: 'blue', icon: <ClockCircleOutlined /> },
      processing: { color: 'orange', icon: <SyncOutlined spin /> },
      completed: { color: 'green', icon: <CheckCircleOutlined /> },
      failed: { color: 'red', icon: <CloseCircleOutlined /> },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Tag color={config.color} icon={config.icon}>
        {status?.toUpperCase()}
      </Tag>
    );
  };

  const getFormatIcon = (format) => {
    const icons = {
      pdf: <FilePdfOutlined className="text-red-500" />,
      excel: <FileExcelOutlined className="text-green-500" />,
      csv: <FileTextOutlined className="text-blue-500" />,
    };
    return icons[format] || icons.pdf;
  };

  const renderFilterField = (filter) => {
    switch (filter.type) {
      case 'select':
        return (
          <Form.Item
            key={filter.key}
            name={filter.key}
            label={filter.label}
            rules={[{ required: filter.required, message: `${filter.label} is required` }]}
          >
            <Select placeholder={`Select ${filter.label}`} allowClear>
              {filter.options?.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        );

      case 'date_range':
        return (
          <Form.Item
            key={filter.key}
            name={filter.key}
            label={filter.label}
            rules={[{ required: filter.required, message: `${filter.label} is required` }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
        );

      case 'number':
        return (
          <Form.Item
            key={filter.key}
            name={filter.key}
            label={filter.label}
            rules={[{ required: filter.required, message: `${filter.label} is required` }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder={filter.placeholder}
              min={filter.min}
              max={filter.max}
            />
          </Form.Item>
        );

      case 'text':
      default:
        return (
          <Form.Item
            key={filter.key}
            name={filter.key}
            label={filter.label}
            rules={[{ required: filter.required, message: `${filter.label} is required` }]}
          >
            <Input placeholder={filter.placeholder} />
          </Form.Item>
        );
    }
  };

  const historyColumns = [
    {
      title: 'Report Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Space>
          {getReportIcon(type)}
          <Text strong>{type?.replace(/_/g, ' ').toUpperCase()}</Text>
        </Space>
      ),
    },
    {
      title: 'Format',
      dataIndex: 'format',
      key: 'format',
      render: (format) => (
        <Space>
          {getFormatIcon(format)}
          <Text>{format?.toUpperCase()}</Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => getStatusTag(status),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('MMM DD, YYYY HH:mm'),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          {record.status === 'completed' ? (
            <Tooltip title="Download Report">
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={() => handleDownload(record.id, record.type)}
                size="small"
              >
                Download
              </Button>
            </Tooltip>
          ) : record.status === 'processing' || record.status === 'pending' ? (
            <Tag icon={<SyncOutlined spin />} color="processing">
              Generating...
            </Tag>
          ) : (
            <Tag color="error">Failed</Tag>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <BarChartOutlined /> Report Builder
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Generate custom reports with configurable filters and export in multiple formats
      </Text>

      <Steps current={currentStep} style={{ marginBottom: 32 }}>
        <Step title="Select Type" description="Choose report type" />
        <Step title="Configure Filters" description="Set parameters" />
        <Step title="Generate" description="Queue report" />
        <Step title="Download" description="Get your report" />
      </Steps>

      <Row gutter={24}>
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <FileTextOutlined />
                <span>Report Configuration</span>
              </Space>
            }
            loading={loading && !catalog.length}
          >
            <Form form={form} layout="vertical" onFinish={handleGenerate}>
              <Form.Item label="Report Type" required>
                <Select
                  placeholder="Select a report type"
                  value={selectedType}
                  onChange={handleTypeSelect}
                  size="large"
                  loading={loading}
                >
                  {catalog.map((report) => (
                    <Option key={report.type} value={report.type}>
                      <Space>
                        {getReportIcon(report.type)}
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {report.name || report.type?.replace(/_/g, ' ')}
                          </div>
                          {report.description && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {report.description}
                            </Text>
                          )}
                        </div>
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              {selectedType && config?.filters && (
                <>
                  <div style={{ marginTop: 24, marginBottom: 16 }}>
                    <Text strong>Filters</Text>
                  </div>
                  {config.filters.map((filter) => renderFilterField(filter))}
                </>
              )}

              <Form.Item label="Export Format" required>
                <Select
                  value={selectedFormat}
                  onChange={setSelectedFormat}
                  size="large"
                >
                  <Option value="pdf">
                    <Space>
                      <FilePdfOutlined className="text-red-500" />
                      PDF Document
                    </Space>
                  </Option>
                  <Option value="excel">
                    <Space>
                      <FileExcelOutlined className="text-green-500" />
                      Excel Spreadsheet
                    </Space>
                  </Option>
                  <Option value="csv">
                    <Space>
                      <FileTextOutlined className="text-blue-500" />
                      CSV File
                    </Space>
                  </Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  loading={generating}
                  disabled={!selectedType}
                  icon={<BarChartOutlined />}
                >
                  {generating ? 'Generating Report...' : 'Generate Report'}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <FileSearchOutlined />
                <span>Report History</span>
              </Space>
            }
            extra={
              <Button
                icon={<SyncOutlined />}
                onClick={() => dispatch(fetchReportHistory({ page: 1, limit: 10 }))}
              >
                Refresh
              </Button>
            }
          >
            {loading && !history.length ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
              </div>
            ) : history.length === 0 ? (
              <Empty
                description="No reports generated yet"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Table
                columns={historyColumns}
                dataSource={history}
                rowKey="id"
                pagination={{
                  pageSize: 5,
                  showSizeChanger: false,
                }}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ReportBuilder;