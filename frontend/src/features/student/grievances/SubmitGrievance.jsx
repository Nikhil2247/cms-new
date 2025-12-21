import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Typography,
  Row,
  Col,
  Divider,
  Alert,
  Table,
  Tag,
  Badge,
  Space,
  Modal,
  Descriptions,
  Timeline,
  Upload,
  message as antdMessage,
} from 'antd';
import {
  PlusOutlined,
  SendOutlined,
  EyeOutlined,
  InboxOutlined,
  AlertOutlined,
  FileTextOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { grievanceService } from '../../../services/grievance.service';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { Dragger } = Upload;

// Constants
const CATEGORIES = [
  { value: 'ACADEMIC', label: 'Academic', description: 'Issues related to academic matters' },
  { value: 'INTERNSHIP', label: 'Internship', description: 'Internship-related concerns' },
  { value: 'FACULTY', label: 'Faculty', description: 'Faculty interaction or support issues' },
  { value: 'INDUSTRY', label: 'Industry', description: 'Industry partner related issues' },
  { value: 'PLACEMENT', label: 'Placement', description: 'Placement and career concerns' },
  { value: 'TECHNICAL', label: 'Technical', description: 'Technical or infrastructure issues' },
  { value: 'OTHER', label: 'Other', description: 'Other concerns' },
];

const PRIORITIES = [
  { value: 'LOW', label: 'Low', color: 'default', description: 'Non-urgent matters' },
  { value: 'MEDIUM', label: 'Medium', color: 'blue', description: 'Standard priority' },
  { value: 'HIGH', label: 'High', color: 'orange', description: 'Requires prompt attention' },
  { value: 'URGENT', label: 'Urgent', color: 'red', description: 'Requires immediate attention' },
];

const STATUSES = [
  { value: 'SUBMITTED', label: 'Submitted', color: 'blue', badge: 'processing' },
  { value: 'IN_REVIEW', label: 'In Review', color: 'orange', badge: 'warning' },
  { value: 'ESCALATED', label: 'Escalated', color: 'red', badge: 'error' },
  { value: 'RESOLVED', label: 'Resolved', color: 'green', badge: 'success' },
  { value: 'CLOSED', label: 'Closed', color: 'default', badge: 'default' },
];

const SubmitGrievance = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [grievances, setGrievances] = useState([]);
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    const loginData = localStorage.getItem('loginResponse');
    if (loginData) {
      try {
        const parsed = JSON.parse(loginData);
        setUserInfo(parsed.user);
      } catch (e) {
        console.error('Failed to parse loginResponse:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (userInfo?.id) {
      fetchMyGrievances();
    }
  }, [userInfo]);

  const fetchMyGrievances = async () => {
    try {
      setLoading(true);
      const response = await grievanceService.getByUser(userInfo.id);
      setGrievances(response || []);
    } catch (error) {
      console.error('Error fetching grievances:', error);
      toast.error('Failed to load your grievances');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);

      const grievanceData = {
        category: values.category,
        subject: values.subject,
        description: values.description,
        priority: values.priority,
        attachments: fileList.map(file => file.response?.url || file.url).filter(Boolean),
        isAnonymous: values.isAnonymous || false,
      };

      await grievanceService.submit(grievanceData);
      toast.success('Grievance submitted successfully!');
      form.resetFields();
      setFileList([]);
      fetchMyGrievances();
    } catch (error) {
      console.error('Error submitting grievance:', error);
      toast.error(error.response?.data?.message || 'Failed to submit grievance');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetail = (record) => {
    setSelectedGrievance(record);
    setDetailModalVisible(true);
  };

  const getStatusConfig = (status) => {
    return STATUSES.find(s => s.value === status) || STATUSES[0];
  };

  const getPriorityConfig = (priority) => {
    return PRIORITIES.find(p => p.value === priority) || PRIORITIES[1];
  };

  const getCategoryConfig = (category) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[6];
  };

  const uploadProps = {
    name: 'file',
    multiple: true,
    fileList,
    onChange(info) {
      setFileList(info.fileList);
      if (info.file.status === 'done') {
        antdMessage.success(`${info.file.name} file uploaded successfully`);
      } else if (info.file.status === 'error') {
        antdMessage.error(`${info.file.name} file upload failed`);
      }
    },
    onRemove(file) {
      setFileList(fileList.filter(f => f.uid !== file.uid));
    },
    beforeUpload(file) {
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) {
        antdMessage.error('File must be smaller than 5MB!');
      }
      return isLt5M;
    },
  };

  const columns = [
    {
      title: 'Subject',
      dataIndex: 'title',
      key: 'title',
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category) => {
        const config = getCategoryConfig(category);
        return <Tag color="blue">{config.label}</Tag>;
      },
    },
    {
      title: 'Priority',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity) => {
        const config = getPriorityConfig(severity);
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const config = getStatusConfig(status);
        return <Badge status={config.badge} text={config.label} />;
      },
    },
    {
      title: 'Submitted',
      dataIndex: 'submittedDate',
      key: 'submittedDate',
      render: (date, record) => {
        const displayDate = date || record.createdAt;
        return displayDate ? dayjs(displayDate).format('MMM DD, YYYY') : 'N/A';
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="h-full overflow-y-auto hide-scrollbar">
        <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6 bg-background-secondary min-h-screen">
          {/* Header */}
          <div>
            <Title level={2} className="mb-1 text-text-primary">
              Submit Grievance
            </Title>
            <Text className="text-text-secondary text-base">
              Report your concerns and track their resolution
            </Text>
          </div>

          {/* Info Alert */}
          <Alert
            message="How Grievances Work"
            description="Submit any academic, internship, or placement-related concerns. Our team will review and address them promptly. You can track the status of your grievances below."
            type="info"
            showIcon
            closable
            className="rounded-xl border-primary/20 bg-primary-50/50"
          />

          {/* Submit Form */}
          <Card
            title={
              <Space className="text-primary font-semibold">
                <FileTextOutlined />
                <span>Submit New Grievance</span>
              </Space>
            }
            className="rounded-xl border-border shadow-sm"
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              className="mt-2"
            >
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="category"
                    label="Category"
                    rules={[{ required: true, message: 'Please select a category' }]}
                  >
                    <Select
                      placeholder="Select category"
                      size="large"
                      className="rounded-lg"
                    >
                      {CATEGORIES.map(cat => (
                        <Option key={cat.value} value={cat.value}>
                          <div className="py-1">
                            <div className="font-semibold text-text-primary">{cat.label}</div>
                            <div className="text-[10px] text-text-tertiary leading-tight">{cat.description}</div>
                          </div>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    name="priority"
                    label="Priority"
                    rules={[{ required: true, message: 'Please select priority' }]}
                    initialValue="MEDIUM"
                  >
                    <Select
                      placeholder="Select priority level"
                      size="large"
                      className="rounded-lg"
                    >
                      {PRIORITIES.map(pri => (
                        <Option key={pri.value} value={pri.value}>
                          <div className="flex items-center gap-2">
                            <Tag color={pri.color} className="m-0 rounded-md">{pri.label}</Tag>
                            <span className="text-[10px] text-text-tertiary">
                              {pri.description}
                            </span>
                          </div>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="subject"
                    label="Subject"
                    rules={[
                      { required: true, message: 'Please enter a subject' },
                      { min: 10, message: 'Subject must be at least 10 characters' },
                    ]}
                  >
                    <Input
                      placeholder="Brief summary of your concern"
                      size="large"
                      className="rounded-lg"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="description"
                    label="Detailed Description"
                    rules={[
                      { required: true, message: 'Please describe your grievance' },
                      { min: 50, message: 'Description must be at least 50 characters' },
                    ]}
                  >
                    <TextArea
                      rows={6}
                      placeholder="Provide detailed information about your concern. Include relevant dates, people involved, and any actions you've already taken."
                      className="rounded-lg"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="attachments"
                    label="Attachments (Optional)"
                    extra={<Text className="text-[10px] text-text-tertiary italic">Upload supporting documents (max 5MB per file)</Text>}
                  >
                    <Dragger {...uploadProps} className="bg-background-tertiary/20 rounded-xl border-dashed">
                      <p className="ant-upload-drag-icon text-primary">
                        <InboxOutlined className="text-4xl" />
                      </p>
                      <p className="text-text-primary font-medium">
                        Click or drag file to this area to upload
                      </p>
                      <p className="text-text-tertiary text-xs">
                        Support for single or bulk upload. Max size 5MB.
                      </p>
                    </Dragger>
                  </Form.Item>
                </Col>
              </Row>

              <Divider className="my-8" />

              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => form.resetFields()}
                  size="large"
                  className="rounded-xl px-8"
                >
                  Reset
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SendOutlined />}
                  loading={submitting}
                  size="large"
                  className="rounded-xl px-10 h-12 shadow-lg shadow-primary/20"
                >
                  Submit Grievance
                </Button>
              </div>
            </Form>
          </Card>

          {/* My Grievances */}
          <Card
            title={
              <Space className="text-text-primary font-semibold">
                <AlertOutlined className="text-warning" />
                <span>My Grievances</span>
              </Space>
            }
            className="rounded-xl border-border shadow-sm overflow-hidden"
            styles={{ body: { padding: 0 } }}
          >
            <Table
              dataSource={grievances}
              columns={columns}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 5,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} grievances`,
              }}
              locale={{
                emptyText: (
                  <div className="py-12">
                    <Empty description="No grievances submitted yet" />
                  </div>
                ),
              }}
              className="custom-table"
            />
          </Card>

          {/* Detail Modal */}
          <Modal
            title={
              <Space className="text-primary font-semibold">
                <FileTextOutlined />
                <span>Grievance Details</span>
              </Space>
            }
            open={detailModalVisible}
            onCancel={() => {
              setDetailModalVisible(false);
              setSelectedGrievance(null);
            }}
            footer={
              <div className="flex justify-end py-2">
                <Button onClick={() => setDetailModalVisible(false)} className="rounded-lg px-6">
                  Close
                </Button>
              </div>
            }
            width={800}
            className="rounded-2xl overflow-hidden"
          >
            {selectedGrievance && (
              <div className="py-4 space-y-6">
                <div className="flex justify-between items-center bg-background-tertiary/30 p-4 rounded-xl border border-border/50">
                  <div className="flex items-center gap-3">
                    <Badge
                      status={getStatusConfig(selectedGrievance.status).badge}
                    />
                    <Text strong className="text-lg text-text-primary">
                      {getStatusConfig(selectedGrievance.status).label}
                    </Text>
                  </div>
                  <Tag color={getPriorityConfig(selectedGrievance.severity).color} className="rounded-md px-3 m-0">
                    {getPriorityConfig(selectedGrievance.severity).label} Priority
                  </Tag>
                </div>

                <Alert
                  message={<span className="font-semibold text-sm uppercase tracking-wider">Status Information</span>}
                  description={
                    <Text className="text-sm">
                      {selectedGrievance.status === 'RESOLVED'
                        ? 'Your grievance has been resolved.'
                        : selectedGrievance.status === 'IN_REVIEW'
                        ? 'We are actively reviewing your grievance.'
                        : selectedGrievance.status === 'ESCALATED'
                        ? 'Your grievance has been escalated for priority handling.'
                        : 'Your grievance has been submitted and is pending review.'}
                    </Text>
                  }
                  type={
                    selectedGrievance.status === 'RESOLVED'
                      ? 'success'
                      : selectedGrievance.status === 'ESCALATED'
                      ? 'error'
                      : 'info'
                  }
                  showIcon
                  className="rounded-xl border-border/50"
                />

                <Descriptions bordered column={1} size="small" className="rounded-xl overflow-hidden">
                  <Descriptions.Item label="Subject">
                    <Text strong className="text-text-primary">{selectedGrievance.title}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Category">
                    <Text className="text-text-primary">{getCategoryConfig(selectedGrievance.category).label}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Submitted">
                    <Space className="text-text-secondary">
                      <CalendarOutlined className="text-xs" />
                      {dayjs(selectedGrievance.submittedDate || selectedGrievance.createdAt).format('MMMM DD, YYYY HH:mm')}
                    </Space>
                  </Descriptions.Item>
                </Descriptions>

                <div className="bg-background-tertiary/20 p-6 rounded-2xl border border-border">
                  <Title level={5} className="!mb-3 text-xs uppercase tracking-widest text-text-tertiary font-bold">Concern Details</Title>
                  <Paragraph className="text-text-primary text-base leading-relaxed mb-0">
                    {selectedGrievance.description}
                  </Paragraph>
                </div>

                {selectedGrievance.resolution && (
                  <div className="bg-success-50 p-6 rounded-2xl border border-success-border/50">
                    <Title level={5} className="!mb-3 text-xs uppercase tracking-widest text-success-700 font-bold">Resolution</Title>
                    <Paragraph className="text-text-primary font-medium mb-3">{selectedGrievance.resolution}</Paragraph>
                    {selectedGrievance.resolvedDate && (
                      <Text className="text-xs text-success-600 block italic">
                        Resolved on: {dayjs(selectedGrievance.resolvedDate).format('MMMM DD, YYYY HH:mm')}
                      </Text>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t border-border/50">
                  <Title level={5} className="!mb-6 text-xs uppercase tracking-widest text-text-tertiary font-bold">Status History</Title>
                  <div className="px-2">
                    <Timeline
                      items={[
                        {
                          color: "blue",
                          children: (
                            <div className="pb-4">
                              <Text strong className="text-text-primary">Submitted</Text>
                              <br />
                              <Text className="text-xs text-text-secondary">
                                {dayjs(selectedGrievance.submittedDate || selectedGrievance.createdAt).format("MMMM DD, YYYY HH:mm")}
                              </Text>
                            </div>
                          ),
                        },
                        ...(selectedGrievance.addressedDate
                          ? [
                              {
                                color: "orange",
                                children: (
                                  <div className="pb-4">
                                    <Text strong className="text-text-primary">Under Review</Text>
                                    <br />
                                    <Text className="text-xs text-text-secondary">
                                      {dayjs(selectedGrievance.addressedDate).format("MMMM DD, YYYY HH:mm")}
                                    </Text>
                                  </div>
                                ),
                              },
                            ]
                          : []),
                        ...(selectedGrievance.escalatedAt
                          ? [
                              {
                                color: "red",
                                children: (
                                  <div className="pb-4">
                                    <Text strong className="text-text-primary">Escalated</Text>
                                    <br />
                                    <Text className="text-xs text-text-secondary">
                                      {dayjs(selectedGrievance.escalatedAt).format("MMMM DD, YYYY HH:mm")}
                                    </Text>
                                  </div>
                                ),
                              },
                            ]
                          : []),
                        ...(selectedGrievance.resolvedDate
                          ? [
                              {
                                color: "green",
                                children: (
                                  <div>
                                    <Text strong className="text-text-primary">Resolved</Text>
                                    <br />
                                    <Text className="text-xs text-text-secondary">
                                      {dayjs(selectedGrievance.resolvedDate).format("MMMM DD, YYYY HH:mm")}
                                    </Text>
                                  </div>
                                ),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                </div>
              </div>
            )}
          </Modal>
        </div>
      </div>
  );
};

export default SubmitGrievance;