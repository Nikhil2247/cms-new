import React, { useState, useEffect } from 'react';
import {
  Modal,
  Tabs,
  Descriptions,
  Tag,
  Button,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  message,
  Spin,
  Empty,
  Timeline,
  Card,
  Space,
  Divider,
  Avatar,
  Typography,
  Tooltip,
  Upload,
  Popconfirm,
} from 'antd';
import {
  UserOutlined,
  BankOutlined,
  PhoneOutlined,
  MailOutlined,
  CalendarOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EnvironmentOutlined,
  EditOutlined,
  EyeOutlined,
  DownloadOutlined,
  DeleteOutlined,
  UploadOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import facultyService from '../../../../services/faculty.service';
import { getImageUrl } from '../../../../utils/imageUtils';
import {
  getExpectedReportsAsOfToday,
  getExpectedVisitsAsOfToday,
} from '../../../../utils/fourWeekCycle';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const StudentDetailsModal = ({
  visible,
  student,
  onClose,
  onScheduleVisit,
  onRefresh,
  loading = false,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditingInternship, setIsEditingInternship] = useState(false);
  const [editForm] = Form.useForm();
  const [visitForm] = Form.useForm();
  const [visitModalVisible, setVisitModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingJoiningLetter, setUploadingJoiningLetter] = useState(false);
  const [uploadingReport, setUploadingReport] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setActiveTab('overview');
      setIsEditingInternship(false);
    }
  }, [visible]);

  // Helper to get nested data
  const getStudentData = () => {
    if (!student) return null;
    return student.student || student;
  };

  const getInternshipApp = () => {
    const s = getStudentData();
    return s?.internshipApplications?.[0] ||
           student?.internshipApplications?.[0] ||
           student?.activeInternship ||
           null;
  };

  const studentData = getStudentData();
  const internshipApp = getInternshipApp();

  // Get visits from nested structure
  const visits = internshipApp?.facultyVisitLogs ||
                 student?.visits ||
                 student?.visitLogs ||
                 [];

  // Get monthly reports from nested structure
  const monthlyReports = internshipApp?.monthlyReports ||
                         student?.monthlyReports ||
                         [];

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      APPROVED: 'green',
      VERIFIED: 'green',
      ACTIVE: 'green',
      PENDING: 'orange',
      SUBMITTED: 'blue',
      REJECTED: 'red',
      DRAFT: 'default',
    };
    return colors[status] || 'default';
  };

  // Calculate duration
  const getDuration = () => {
    if (!internshipApp?.startDate || !internshipApp?.endDate) return 'N/A';
    const start = dayjs(internshipApp.startDate);
    const end = dayjs(internshipApp.endDate);
    const months = end.diff(start, 'month');
    const days = end.diff(start.add(months, 'month'), 'day');
    if (months > 0 && days > 0) return `${months} months ${days} days`;
    if (months > 0) return `${months} months`;
    return `${end.diff(start, 'day')} days`;
  };

  /**
   * Calculate expected reports using 4-week cycles.
   * Reports are due every 4 weeks from internship startDate + 5 days grace period.
   */
  const getExpectedReports = () => {
    if (internshipApp?.totalExpectedReports) return internshipApp.totalExpectedReports;
    if (!internshipApp?.startDate || !internshipApp?.endDate) return 0;

    const startDate = new Date(internshipApp.startDate);
    const endDate = new Date(internshipApp.endDate);
    const now = new Date();

    if (startDate > now) return 0;

    return getExpectedReportsAsOfToday(startDate, endDate);
  };

  /**
   * Calculate expected visits using 4-week cycles.
   * Visits are aligned with report cycles - 1 visit per 4-week cycle.
   */
  const getExpectedVisits = () => {
    if (internshipApp?.totalExpectedVisits) return internshipApp.totalExpectedVisits;
    if (!internshipApp?.startDate || !internshipApp?.endDate) return 0;

    const startDate = new Date(internshipApp.startDate);
    const endDate = new Date(internshipApp.endDate);
    const now = new Date();

    if (startDate > now) return 0;

    return getExpectedVisitsAsOfToday(startDate, endDate);
  };

  // Handle edit internship
  const handleEditInternship = () => {
    editForm.setFieldsValue({
      companyName: internshipApp?.companyName,
      startDate: internshipApp?.startDate ? dayjs(internshipApp.startDate) : null,
      endDate: internshipApp?.endDate ? dayjs(internshipApp.endDate) : null,
      stipend: internshipApp?.stipend,
      location: internshipApp?.location || internshipApp?.city,
    });
    setIsEditingInternship(true);
  };

  // Save internship changes
  const handleSaveInternship = async () => {
    try {
      const values = await editForm.validateFields();
      setSaving(true);

      const updateData = {
        companyName: values.companyName,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
        stipend: values.stipend,
        location: values.location,
      };

      await facultyService.updateInternship(internshipApp.id, updateData);
      message.success('Internship details updated successfully');
      setIsEditingInternship(false);
      onRefresh?.();
    } catch (error) {
      message.error(error.message || 'Failed to update internship details');
    } finally {
      setSaving(false);
    }
  };

  // Handle visit form submission
  const handleVisitSubmit = async () => {
    try {
      const values = await visitForm.validateFields();
      const visitData = {
        ...values,
        applicationId: internshipApp?.id || student?.applicationId || student?.id,
        visitDate: values.visitDate.toISOString(),
      };

      if (onScheduleVisit) {
        await onScheduleVisit(visitData);
        message.success('Visit logged successfully');
        setVisitModalVisible(false);
        visitForm.resetFields();
        onRefresh?.();
      }
    } catch (err) {
      if (!err.errorFields) {
        message.error('Failed to create visit log');
      }
    }
  };

  // Handle joining letter upload
  const handleJoiningLetterUpload = async (file) => {
    setUploadingJoiningLetter(true);
    try {
      await facultyService.uploadJoiningLetter(internshipApp?.id, file);
      message.success('Joining letter uploaded successfully');
      onRefresh?.();
    } catch (error) {
      message.error(error.message || 'Failed to upload joining letter');
    } finally {
      setUploadingJoiningLetter(false);
    }
    return false; // Prevent default upload
  };

  // Handle joining letter delete
  const handleDeleteJoiningLetter = async () => {
    try {
      await facultyService.deleteJoiningLetter(internshipApp?.id);
      message.success('Joining letter deleted successfully');
      onRefresh?.();
    } catch (error) {
      message.error(error.message || 'Failed to delete joining letter');
    }
  };

  // Handle monthly report delete
  const handleDeleteReport = async (reportId) => {
    try {
      await facultyService.deleteMonthlyReport(reportId);
      message.success('Report deleted successfully');
      onRefresh?.();
    } catch (error) {
      message.error(error.message || 'Failed to delete report');
    }
  };

  // Handle monthly report upload
  const handleReportUpload = async (file) => {
    setUploadingReport(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('applicationId', internshipApp?.id);
      formData.append('reportMonth', dayjs().month() + 1);
      formData.append('reportYear', dayjs().year());

      await facultyService.uploadMonthlyReport(formData);
      message.success('Monthly report uploaded successfully');
      onRefresh?.();
    } catch (error) {
      message.error(error.message || 'Failed to upload report');
    } finally {
      setUploadingReport(false);
    }
    return false;
  };

  // View document
  const handleViewDocument = (url) => {
    if (url) {
      window.open(url, '_blank');
    } else {
      message.info('Document not available');
    }
  };

  // Tab items
  const tabItems = [
    {
      key: 'overview',
      label: 'Overview',
      children: (
        <div className="space-y-4">
          {/* Student Info Card */}
          <Card size="small" title="Student Information" className="border-border">
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Name">
                <Text strong>{studentData?.name || 'N/A'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Roll Number">
                {studentData?.rollNumber || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {studentData?.email || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {studentData?.phone || studentData?.mobileNumber || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Branch">
                {studentData?.branchName || studentData?.branch?.name || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="College">
                {studentData?.collegeName || studentData?.college?.name || 'N/A'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Internship Info Card */}
          <Card
            size="small"
            title="Internship Information"
            className="border-border"
            extra={
              !isEditingInternship ? (
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={handleEditInternship}
                  size="small"
                >
                  Edit
                </Button>
              ) : (
                <Space>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSaveInternship}
                    size="small"
                    loading={saving}
                  >
                    Save
                  </Button>
                  <Button
                    icon={<CloseOutlined />}
                    onClick={() => setIsEditingInternship(false)}
                    size="small"
                  >
                    Cancel
                  </Button>
                </Space>
              )
            }
          >
            {isEditingInternship ? (
              <Form form={editForm} layout="vertical" size="small">
                <div className="grid grid-cols-2 gap-4">
                  <Form.Item
                    name="companyName"
                    label="Company Name"
                    rules={[{ required: true, message: 'Required' }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item name="location" label="Location">
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="startDate"
                    label="Start Date"
                    rules={[{ required: true, message: 'Required' }]}
                  >
                    <DatePicker className="w-full" />
                  </Form.Item>
                  <Form.Item
                    name="endDate"
                    label="End Date"
                    rules={[{ required: true, message: 'Required' }]}
                  >
                    <DatePicker className="w-full" />
                  </Form.Item>
                  <Form.Item name="stipend" label="Stipend (₹)">
                    <InputNumber className="w-full" min={0} />
                  </Form.Item>
                </div>
              </Form>
            ) : (
              <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label="Company">
                  <Text strong>{internshipApp?.companyName || 'Not Assigned'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={getStatusColor(internshipApp?.status)}>
                    {internshipApp?.status || 'N/A'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Start Date">
                  {internshipApp?.startDate
                    ? dayjs(internshipApp.startDate).format('DD MMM YYYY')
                    : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="End Date">
                  {internshipApp?.endDate
                    ? dayjs(internshipApp.endDate).format('DD MMM YYYY')
                    : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Duration">
                  {getDuration()}
                </Descriptions.Item>
                <Descriptions.Item label="Location">
                  {internshipApp?.location || internshipApp?.city || 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Stipend">
                  {internshipApp?.stipend ? `₹${internshipApp.stipend}` : 'N/A'}
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>

          {/* Joining Letter Card */}
          <Card size="small" title="Joining Letter" className="border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileTextOutlined />
                <Text>
                  {internshipApp?.joiningLetterUrl ? 'Joining letter uploaded' : 'No joining letter'}
                </Text>
                {internshipApp?.joiningLetterUrl && (
                  <Tag color="green">Uploaded</Tag>
                )}
              </div>
              <Space>
                {internshipApp?.joiningLetterUrl && (
                  <>
                    <Tooltip title="View">
                      <Button
                        type="text"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewDocument(internshipApp.joiningLetterUrl)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title="Delete joining letter?"
                      description="This action cannot be undone."
                      onConfirm={handleDeleteJoiningLetter}
                      okText="Delete"
                      okButtonProps={{ danger: true }}
                    >
                      <Tooltip title="Delete">
                        <Button type="text" danger icon={<DeleteOutlined />} />
                      </Tooltip>
                    </Popconfirm>
                  </>
                )}
                <Upload
                  showUploadList={false}
                  beforeUpload={handleJoiningLetterUpload}
                  accept=".pdf,.jpg,.jpeg,.png"
                >
                  <Tooltip title={internshipApp?.joiningLetterUrl ? 'Replace' : 'Upload'}>
                    <Button
                      type={internshipApp?.joiningLetterUrl ? 'default' : 'primary'}
                      icon={<UploadOutlined />}
                      loading={uploadingJoiningLetter}
                      size="small"
                    >
                      {internshipApp?.joiningLetterUrl ? 'Replace' : 'Upload'}
                    </Button>
                  </Tooltip>
                </Upload>
              </Space>
            </div>
          </Card>

          {/* Quick Stats - Done/Expected */}
          <div className="grid grid-cols-3 gap-4">
            <Card size="small" className="text-center border-border">
              <div className="text-2xl font-bold text-primary">
                {visits.length}<span className="text-sm font-normal text-text-secondary">/{getExpectedVisits()}</span>
              </div>
              <Text type="secondary" className="text-xs">Visits</Text>
            </Card>
            <Card size="small" className="text-center border-border">
              <div className="text-2xl font-bold text-success">
                {monthlyReports.length}<span className="text-sm font-normal text-text-secondary">/{getExpectedReports()}</span>
              </div>
              <Text type="secondary" className="text-xs">Reports</Text>
            </Card>
            <Card size="small" className="text-center border-border">
              <div className="text-2xl font-bold text-warning">
                {monthlyReports.filter(r => r.status === 'PENDING' || r.status === 'SUBMITTED').length}
              </div>
              <Text type="secondary" className="text-xs">Pending Review</Text>
            </Card>
          </div>
        </div>
      ),
    },
    {
      key: 'visits',
      label: `Visits (${visits.length})`,
      children: (
        <div>
          <div className="flex justify-end mb-4">
            <Button
              type="primary"
              icon={<EnvironmentOutlined />}
              onClick={() => setVisitModalVisible(true)}
            >
              Log New Visit
            </Button>
          </div>
          {visits.length > 0 ? (
            <Timeline
              items={visits.map((visit, idx) => ({
                key: idx,
                color: dayjs(visit.visitDate).isAfter(dayjs()) ? 'blue' : 'green',
                children: (
                  <div className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <Text strong>
                          {dayjs(visit.visitDate).format('DD MMM YYYY, hh:mm A')}
                        </Text>
                        <Tag color={visit.visitType === 'PHYSICAL' ? 'green' : visit.visitType === 'VIRTUAL' ? 'blue' : 'orange'} className="ml-2">
                          {visit.visitType || 'PHYSICAL'}
                        </Tag>
                      </div>
                    </div>
                    {visit.visitLocation && (
                      <div className="text-text-secondary text-sm mt-1">
                        <EnvironmentOutlined className="mr-1" />
                        {visit.visitLocation}
                      </div>
                    )}
                    {visit.notes && (
                      <div className="text-text-secondary text-sm mt-1">
                        {visit.notes}
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          ) : (
            <Empty description="No visits recorded yet" />
          )}
        </div>
      ),
    },
    {
      key: 'reports',
      label: `Reports (${monthlyReports.length})`,
      children: (
        <div>
          <div className="flex justify-end mb-4">
            <Upload
              showUploadList={false}
              beforeUpload={handleReportUpload}
              accept=".pdf,.doc,.docx"
            >
              <Button
                type="primary"
                icon={<UploadOutlined />}
                loading={uploadingReport}
              >
                Upload Report
              </Button>
            </Upload>
          </div>
          {monthlyReports.length > 0 ? (
            <div className="space-y-3">
              {monthlyReports.map((report, idx) => (
                <Card key={report.id || idx} size="small" className="border-border">
                  <div className="flex justify-between items-center">
                    <div>
                      <Text strong>
                        {dayjs().month(report.reportMonth - 1).format('MMMM')} {report.reportYear}
                      </Text>
                      <Tag color={getStatusColor(report.status)} className="ml-2">
                        {report.status}
                      </Tag>
                    </div>
                    <Space size={4}>
                      {report.reportFileUrl && (
                        <Tooltip title="View Report">
                          <Button
                            type="text"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => handleViewDocument(report.reportFileUrl)}
                          />
                        </Tooltip>
                      )}
                      {report.reportFileUrl && (
                        <Tooltip title="Download">
                          <Button
                            type="text"
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={() => handleViewDocument(report.reportFileUrl)}
                          />
                        </Tooltip>
                      )}
                      <Popconfirm
                        title="Delete this report?"
                        description="This action cannot be undone."
                        onConfirm={() => handleDeleteReport(report.id)}
                        okText="Delete"
                        okButtonProps={{ danger: true }}
                      >
                        <Tooltip title="Delete">
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                          />
                        </Tooltip>
                      </Popconfirm>
                    </Space>
                  </div>
                  {report.submittedAt && (
                    <Text type="secondary" className="text-xs block mt-1">
                      Submitted: {dayjs(report.submittedAt).format('DD MMM YYYY')}
                    </Text>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Empty description="No monthly reports submitted yet" />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={
          <div className="flex items-center gap-3">
            <Avatar size={40} icon={<UserOutlined />} src={getImageUrl(studentData?.profileImage)} className="bg-primary" />
            <div>
              <Title level={5} className="m-0">
                {studentData?.name || 'Student Details'}
              </Title>
              <Text type="secondary" className="text-xs">
                {studentData?.rollNumber || ''}
                {internshipApp?.companyName && ` • ${internshipApp.companyName}`}
              </Text>
            </div>
          </div>
        }
        open={visible}
        onCancel={onClose}
        width={800}
        footer={[
          <Button key="close" onClick={onClose}>
            Close
          </Button>,
          <Button
            key="visit"
            type="primary"
            icon={<EnvironmentOutlined />}
            onClick={() => setVisitModalVisible(true)}
          >
            Log Visit
          </Button>,
        ]}
        className="student-details-modal"
      >
        <Spin spinning={loading}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
          />
        </Spin>
      </Modal>

      {/* Quick Visit Log Modal */}
      <Modal
        title={`Log Visit - ${studentData?.name || ''}`}
        open={visitModalVisible}
        onOk={handleVisitSubmit}
        onCancel={() => {
          setVisitModalVisible(false);
          visitForm.resetFields();
        }}
        okText="Create Visit Log"
        width={500}
      >
        <Form form={visitForm} layout="vertical" className="mt-4">
          <Form.Item
            name="visitDate"
            label="Visit Date"
            rules={[{ required: true, message: 'Please select a date' }]}
            initialValue={dayjs()}
          >
            <DatePicker className="w-full" showTime />
          </Form.Item>

          <Form.Item
            name="visitType"
            label="Visit Type"
            rules={[{ required: true, message: 'Please select visit type' }]}
          >
            <Select placeholder="Select visit type">
              <Option value="PHYSICAL">Physical Visit</Option>
              <Option value="VIRTUAL">Virtual Visit</Option>
              <Option value="PHONE">Phone Call</Option>
            </Select>
          </Form.Item>

          <Form.Item name="visitLocation" label="Visit Location">
            <Input placeholder="Enter visit location" />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Add any notes about this visit" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default StudentDetailsModal;
