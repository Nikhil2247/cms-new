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
  theme,
  Row,
  Col,
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
  LinkOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useDispatch } from 'react-redux';
import {
  updateInternship,
  uploadJoiningLetter,
  deleteJoiningLetter,
  deleteMonthlyReport,
  uploadMonthlyReport,
} from '../../store/facultySlice';
import { openFileWithPresignedUrl } from '../../../../utils/imageUtils';
import ProfileAvatar from '../../../../components/common/ProfileAvatar';
import { getTotalExpectedCount } from '../../../../utils/monthlyCycle';
import UnifiedVisitLogModal from '../../visits/UnifiedVisitLogModal';

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
  const { token } = theme.useToken();
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditingInternship, setIsEditingInternship] = useState(false);
  const [editForm] = Form.useForm();
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
      DRAFT: 'default',
    };
    return colors[status] || 'default';
  };

  // Calculate duration (use effectiveInternship for optimistic updates)
  const getDuration = () => {
    const app = localInternshipData || internshipApp;
    if (!app?.startDate || !app?.endDate) return 'N/A';
    const start = dayjs(app.startDate);
    const end = dayjs(app.endDate);
    const months = end.diff(start, 'month');
    const days = end.diff(start.add(months, 'month'), 'day');
    if (months > 0 && days > 0) return `${months} m ${days} d`;
    if (months > 0) return `${months} months`;
    return `${end.diff(start, 'day')} days`;
  };

  /**
   * Calculate total expected reports using monthly cycles.
   * Returns total for entire internship period (not just as of today).
   * Always calculates dynamically based on dates to reflect date changes.
   */
  const getExpectedReports = () => {
    if (!internshipApp?.startDate || !internshipApp?.endDate) return 0;

    const startDate = new Date(internshipApp.startDate);
    const endDate = new Date(internshipApp.endDate);

    return getTotalExpectedCount(startDate, endDate);
  };

  /**
   * Calculate total expected visits using monthly cycles.
   * Returns total for entire internship period (not just as of today).
   * Always calculates dynamically based on dates to reflect date changes.
   */
  const getExpectedVisits = () => {
    if (!internshipApp?.startDate || !internshipApp?.endDate) return 0;

    const startDate = new Date(internshipApp.startDate);
    const endDate = new Date(internshipApp.endDate);

    return getTotalExpectedCount(startDate, endDate);
  };

  // Local state for optimistic updates
  const [localInternshipData, setLocalInternshipData] = useState(null);

  // Reset local state when modal opens with new student
  useEffect(() => {
    if (visible && internshipApp) {
      setLocalInternshipData(null); // Reset to use original data
    }
  }, [visible, internshipApp?.id]);

  // Get effective internship data (local optimistic or original)
  const effectiveInternship = localInternshipData || internshipApp;

  // Handle edit internship
  const handleEditInternship = () => {
    const app = effectiveInternship;
    editForm.setFieldsValue({
      // Company Info
      companyName: app?.companyName,
      companyAddress: app?.companyAddress || app?.location,
      companyContact: app?.companyContact,
      companyEmail: app?.companyEmail,
      // HR/Supervisor Info
      hrName: app?.hrName,
      hrDesignation: app?.hrDesignation,
      hrContact: app?.hrContact,
      hrEmail: app?.hrEmail,
      // Internship Details
      startDate: app?.startDate ? dayjs(app.startDate) : null,
      endDate: app?.endDate ? dayjs(app.endDate) : null,
      stipend: app?.stipend ? Number(app.stipend) : null,
      internshipDuration: app?.internshipDuration,
      jobProfile: app?.jobProfile,
      // Notes
      notes: app?.notes,
    });
    setIsEditingInternship(true);
  };

  // Save internship changes with optimistic update
  const handleSaveInternship = async () => {
    try {
      const values = await editForm.validateFields();
      setSaving(true);

      const updateData = {
        // Company Information
        companyName: values.companyName,
        companyAddress: values.companyAddress,
        companyContact: values.companyContact,
        companyEmail: values.companyEmail,
        // HR/Supervisor Information
        hrName: values.hrName,
        hrDesignation: values.hrDesignation,
        hrContact: values.hrContact,
        hrEmail: values.hrEmail,
        // Internship Duration & Compensation
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
        stipend: values.stipend,
        internshipDuration: values.internshipDuration,
        jobProfile: values.jobProfile,
        // Notes
        notes: values.notes,
        location: values.companyAddress, // Alias for backend compatibility
      };

      // Optimistic update - immediately update local state
      const optimisticData = {
        ...effectiveInternship,
        ...updateData,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
        _isOptimistic: true,
      };
      setLocalInternshipData(optimisticData);
      setIsEditingInternship(false);
      message.success('Internship details updated successfully');

      // API call in background
      try {
        const response = await dispatch(updateInternship({ internshipId: internshipApp.id, data: updateData })).unwrap();
        // Update with server response
        if (response?.data) {
          setLocalInternshipData(response.data);
        }
        // Refresh parent data in background (non-blocking)
        onRefresh?.();
      } catch (apiError) {
        // Revert optimistic update on failure
        setLocalInternshipData(null);
        const errorMessage = typeof apiError === 'string' ? apiError : apiError?.message || 'Failed to save changes. Please try again.';
        message.error(errorMessage);
        setIsEditingInternship(true); // Re-open edit form
      }
    } catch (error) {
      message.error(error.message || 'Please fill in required fields');
    } finally {
      setSaving(false);
    }
  };

  // Handle visit log success (from UnifiedVisitLogModal)
  const handleVisitSuccess = () => {
    setVisitModalVisible(false);
    onRefresh?.();
  };

  // Handle joining letter upload
  const handleJoiningLetterUpload = async (file) => {
    setUploadingJoiningLetter(true);
    try {
      await dispatch(uploadJoiningLetter({ applicationId: internshipApp?.id, file })).unwrap();
      message.success('Joining letter uploaded successfully');
      onRefresh?.();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to upload joining letter';
      message.error(errorMessage);
    } finally {
      setUploadingJoiningLetter(false);
    }
    return false; // Prevent default upload
  };

  // Handle joining letter delete
  const handleDeleteJoiningLetter = async () => {
    try {
      await dispatch(deleteJoiningLetter(internshipApp?.id)).unwrap();
      message.success('Joining letter deleted successfully');
      onRefresh?.();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to delete joining letter';
      message.error(errorMessage);
    }
  };

  // Handle monthly report delete
  const handleDeleteReport = async (reportId) => {
    try {
      await dispatch(deleteMonthlyReport(reportId)).unwrap();
      message.success('Report deleted successfully');
      onRefresh?.();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to delete report';
      message.error(errorMessage);
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

      await dispatch(uploadMonthlyReport(formData)).unwrap();
      message.success('Monthly report uploaded successfully');
      onRefresh?.();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to upload report';
      message.error(errorMessage);
    } finally {
      setUploadingReport(false);
    }
    return false;
  };

  // View document
  const handleViewDocument = async (url) => {
    if (url) {
      await openFileWithPresignedUrl(url);
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
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card size="small" className="text-center border shadow-sm" style={{ borderColor: token.colorBorder }}>
              <div className="text-xl font-bold" style={{ color: token.colorPrimary }}>
                {visits.length}<span className="text-xs font-normal" style={{ color: token.colorTextSecondary }}>/{getExpectedVisits()}</span>
              </div>
              <Text style={{ color: token.colorTextSecondary }} className="text-xs">Visits Logged</Text>
            </Card>
            <Card size="small" className="text-center border shadow-sm" style={{ borderColor: token.colorBorder }}>
              <div className="text-xl font-bold" style={{ color: token.colorSuccess }}>
                {monthlyReports.length}<span className="text-xs font-normal" style={{ color: token.colorTextSecondary }}>/{getExpectedReports()}</span>
              </div>
              <Text style={{ color: token.colorTextSecondary }} className="text-xs">Reports Submitted</Text>
            </Card>
            <Card size="small" className="text-center border shadow-sm" style={{ borderColor: token.colorBorder }}>
              <div className="text-xl font-bold" style={{ color: token.colorWarning }}>
                {monthlyReports.filter(r => r.status === 'DRAFT').length}
              </div>
              <Text style={{ color: token.colorTextSecondary }} className="text-xs">Pending Review</Text>
            </Card>
          </div>

          <Row gutter={[16, 16]}>
            {/* Student Info - Left Column */}
            <Col xs={24} md={8}>
              <Card 
                size="small" 
                title={<span className="font-semibold text-sm">Contact Info</span>}
                className="h-full border shadow-sm" 
                style={{ borderColor: token.colorBorder }}
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <MailOutlined className="mt-1" style={{ color: token.colorTextTertiary }} />
                    <div>
                      <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Email</Text>
                      <Text className="text-sm break-all">{studentData?.email || 'N/A'}</Text>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <PhoneOutlined className="mt-1" style={{ color: token.colorTextTertiary }} />
                    <div>
                      <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Phone</Text>
                      <Text className="text-sm">{studentData?.phone || studentData?.mobileNumber || 'N/A'}</Text>
                    </div>
                  </div>
                  <Divider className="my-2" />
                  <div className="flex items-start gap-2">
                    <BankOutlined className="mt-1" style={{ color: token.colorTextTertiary }} />
                    <div>
                      <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>College & Branch</Text>
                      <Text className="text-sm block">{studentData?.collegeName || studentData?.college?.name || 'N/A'}</Text>
                      <Text className="text-xs" style={{ color: token.colorTextSecondary }}>{studentData?.branchName || studentData?.branch?.name || 'N/A'}</Text>
                    </div>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Internship Info - Right Column */}
            <Col xs={24} md={16}>
              <Card
                size="small"
                title={
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm">Internship Details</span>
                    {!isEditingInternship && (
                      <Button type="text" size="small" icon={<EditOutlined />} onClick={handleEditInternship} className="text-xs">Edit</Button>
                    )}
                  </div>
                }
                className="h-full border shadow-sm"
                style={{ borderColor: token.colorBorder }}
              >
                {isEditingInternship ? (
                  <Form form={editForm} layout="vertical" size="small" className="max-h-[60vh] overflow-y-auto pr-2">
                    {/* Company Information */}
                    <Text strong className="text-xs block mb-2" style={{ color: token.colorPrimary }}>Company Information</Text>
                    <div className="grid grid-cols-2 gap-3">
                      <Form.Item name="companyName" label="Company Name" rules={[{ required: true }]} className="mb-2">
                        <Input placeholder="Enter company name" />
                      </Form.Item>
                      <Form.Item name="jobProfile" label="Job Profile / Role" className="mb-2">
                        <Input placeholder="e.g., Software Developer Intern" />
                      </Form.Item>
                      <Form.Item name="companyAddress" label="Company Address" className="mb-2 col-span-2">
                        <Input placeholder="Enter company address" />
                      </Form.Item>
                      <Form.Item name="companyContact" label="Company Phone" className="mb-2">
                        <Input placeholder="e.g., +91 9876543210" />
                      </Form.Item>
                      <Form.Item name="companyEmail" label="Company Email" className="mb-2">
                        <Input placeholder="e.g., hr@company.com" type="email" />
                      </Form.Item>
                    </div>

                    <Divider className="my-3" />

                    {/* HR/Supervisor Information */}
                    <Text strong className="text-xs block mb-2" style={{ color: token.colorPrimary }}>HR / Supervisor Details</Text>
                    <div className="grid grid-cols-2 gap-3">
                      <Form.Item name="hrName" label="HR/Supervisor Name" className="mb-2">
                        <Input placeholder="Enter HR name" />
                      </Form.Item>
                      <Form.Item name="hrDesignation" label="Designation" className="mb-2">
                        <Input placeholder="e.g., HR Manager" />
                      </Form.Item>
                      <Form.Item name="hrContact" label="Contact Number" className="mb-2">
                        <Input placeholder="e.g., +91 9876543210" />
                      </Form.Item>
                      <Form.Item name="hrEmail" label="Email Address" className="mb-2">
                        <Input placeholder="e.g., hr@company.com" type="email" />
                      </Form.Item>
                    </div>

                    <Divider className="my-3" />

                    {/* Internship Duration & Stipend */}
                    <Text strong className="text-xs block mb-2" style={{ color: token.colorPrimary }}>Internship Duration & Compensation</Text>
                    <div className="grid grid-cols-2 gap-3">
                      <Form.Item name="startDate" label="Start Date" rules={[{ required: true }]} className="mb-2">
                        <DatePicker className="w-full" format="DD MMM YYYY" />
                      </Form.Item>
                      <Form.Item name="endDate" label="End Date" rules={[{ required: true }]} className="mb-2">
                        <DatePicker className="w-full" format="DD MMM YYYY" />
                      </Form.Item>
                      <Form.Item name="stipend" label="Stipend (₹/month)" className="mb-2">
                        <InputNumber className="w-full" placeholder="e.g., 15000" min={0} />
                      </Form.Item>
                      <Form.Item name="internshipDuration" label="Duration Text" className="mb-2">
                        <Input placeholder="e.g., 6 months" />
                      </Form.Item>
                    </div>

                    <Divider className="my-3" />

                    {/* Notes */}
                    {/* <Form.Item name="notes" label="Notes / Additional Information" className="mb-2">
                      <TextArea rows={2} placeholder="Any additional notes about the internship..." />
                    </Form.Item> */}

                    <div className="flex justify-end gap-2 mt-3 pt-2 border-t" style={{ borderColor: token.colorBorderSecondary }}>
                      <Button size="small" onClick={() => setIsEditingInternship(false)}>Cancel</Button>
                      <Button type="primary" size="small" onClick={handleSaveInternship} loading={saving}>Save Changes</Button>
                    </div>
                  </Form>
                ) : (
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {/* Company Name & Status */}
                    <div className="flex justify-between">
                      <div>
                        <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Company</Text>
                        <Text strong className="text-sm">{effectiveInternship?.companyName || 'Not Assigned'}</Text>
                      </div>
                      <div className="text-right">
                        <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Status</Text>
                        <Tag color={getStatusColor(effectiveInternship?.status)} className="mr-0">
                          {effectiveInternship?.status || 'N/A'}
                        </Tag>
                      </div>
                    </div>

                    {/* Job Profile & Stipend */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Job Profile / Role</Text>
                        <Text className="text-sm">{effectiveInternship?.jobProfile || 'N/A'}</Text>
                      </div>
                      <div>
                        <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Stipend (₹/month)</Text>
                        <Text className="text-sm">{effectiveInternship?.stipend ? `₹${Number(effectiveInternship.stipend).toLocaleString('en-IN')}` : 'N/A'}</Text>
                      </div>
                    </div>

                    {/* Duration Details */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Start Date</Text>
                        <Text className="text-sm">{effectiveInternship?.startDate ? dayjs(effectiveInternship.startDate).format('DD MMM YYYY') : 'N/A'}</Text>
                      </div>
                      <div>
                        <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>End Date</Text>
                        <Text className="text-sm">{effectiveInternship?.endDate ? dayjs(effectiveInternship.endDate).format('DD MMM YYYY') : 'N/A'}</Text>
                      </div>
                      <div>
                        <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Duration</Text>
                        <Text className="text-sm">{getDuration()}</Text>
                      </div>
                    </div>

                    {/* Company Contact Details */}
                    {(effectiveInternship?.companyAddress || effectiveInternship?.companyContact || effectiveInternship?.companyEmail) && (
                      <div className="pt-2 border-t border-dashed" style={{ borderColor: token.colorBorder }}>
                        <Text className="text-xs font-medium block mb-2" style={{ color: token.colorPrimary }}>Company Contact</Text>
                        <div className="grid grid-cols-1 gap-1">
                          {(effectiveInternship?.companyAddress || effectiveInternship?.location) && (
                            <div className="flex items-start gap-2">
                              <EnvironmentOutlined className="text-xs mt-0.5" style={{ color: token.colorTextTertiary }} />
                              <Text className="text-xs" style={{ color: token.colorTextSecondary }}>
                                {effectiveInternship?.companyAddress || effectiveInternship?.location}
                              </Text>
                            </div>
                          )}
                          {effectiveInternship?.companyContact && (
                            <div className="flex items-center gap-2">
                              <PhoneOutlined className="text-xs" style={{ color: token.colorTextTertiary }} />
                              <Text className="text-xs" style={{ color: token.colorTextSecondary }}>{effectiveInternship.companyContact}</Text>
                            </div>
                          )}
                          {effectiveInternship?.companyEmail && (
                            <div className="flex items-center gap-2">
                              <MailOutlined className="text-xs" style={{ color: token.colorTextTertiary }} />
                              <Text className="text-xs" style={{ color: token.colorTextSecondary }}>{effectiveInternship.companyEmail}</Text>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* HR/Supervisor Details */}
                    {(effectiveInternship?.hrName || effectiveInternship?.hrContact || effectiveInternship?.hrEmail || effectiveInternship?.hrDesignation) && (
                      <div className="pt-2 border-t border-dashed" style={{ borderColor: token.colorBorder }}>
                        <Text className="text-xs font-medium block mb-2" style={{ color: token.colorPrimary }}>HR / Supervisor</Text>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Name</Text>
                            <Text className="text-sm">{effectiveInternship?.hrName || 'N/A'}</Text>
                          </div>
                          {effectiveInternship?.hrDesignation && (
                            <div>
                              <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Designation</Text>
                              <Text className="text-sm">{effectiveInternship.hrDesignation}</Text>
                            </div>
                          )}
                          {effectiveInternship?.hrContact && (
                            <div>
                              <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Contact</Text>
                              <div className="flex items-center gap-1">
                                <PhoneOutlined className="text-xs" style={{ color: token.colorTextTertiary }} />
                                <Text className="text-sm">{effectiveInternship.hrContact}</Text>
                              </div>
                            </div>
                          )}
                          {effectiveInternship?.hrEmail && (
                            <div>
                              <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Email</Text>
                              <div className="flex items-center gap-1">
                                <MailOutlined className="text-xs" style={{ color: token.colorTextTertiary }} />
                                <Text className="text-sm truncate" title={effectiveInternship.hrEmail}>{effectiveInternship.hrEmail}</Text>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {/* {effectiveInternship?.notes && (
                      <div className="pt-2 border-t border-dashed" style={{ borderColor: token.colorBorder }}>
                        <Text className="text-xs font-medium block mb-1" style={{ color: token.colorPrimary }}>Notes</Text>
                        <Text className="text-xs" style={{ color: token.colorTextSecondary }}>{effectiveInternship.notes}</Text>
                      </div>
                    )} */}
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          {/* Joining Letter Section - Compact */}
          <Card size="small" className="border shadow-sm" style={{ borderColor: token.colorBorder }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileTextOutlined style={{ fontSize: '16px', color: token.colorPrimary }} />
                <div>
                  <Text className="font-medium">Joining Letter</Text>
                  <div className="text-xs mt-0.5">
                    {internshipApp?.joiningLetterUrl ? (
                      <Space size={4}>
                        <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                        <span style={{ color: token.colorSuccess }}>Uploaded</span>
                        <span style={{ color: token.colorTextTertiary }}>•</span>
                        <a 
                          onClick={(e) => { e.preventDefault(); handleViewDocument(internshipApp.joiningLetterUrl); }}
                          className="hover:underline"
                        >
                          View Document
                        </a>
                      </Space>
                    ) : (
                      <span style={{ color: token.colorTextTertiary }}>Not uploaded yet</span>
                    )}
                  </div>
                </div>
              </div>
              <Space>
                <Upload
                  showUploadList={false}
                  beforeUpload={handleJoiningLetterUpload}
                  accept=".pdf,.jpg,.jpeg,.png"
                >
                  <Button
                    size="small"
                    icon={<UploadOutlined />}
                    loading={uploadingJoiningLetter}
                  >
                    {internshipApp?.joiningLetterUrl ? 'Replace' : 'Upload'}
                  </Button>
                </Upload>
                {internshipApp?.joiningLetterUrl && (
                  <Popconfirm
                    title="Delete joining letter?"
                    onConfirm={handleDeleteJoiningLetter}
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                )}
              </Space>
            </div>
          </Card>
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
              className="mt-2"
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
                      <div className="text-sm mt-1" style={{ color: token.colorTextSecondary }}>
                        <EnvironmentOutlined className="mr-1" />
                        {visit.visitLocation}
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
                <Card key={report.id || idx} size="small" className="border shadow-sm" style={{ borderColor: token.colorBorder }}>
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
                        <>
                          <Tooltip title="View">
                            <Button
                              type="text"
                              size="small"
                              icon={<EyeOutlined />}
                              onClick={() => handleViewDocument(report.reportFileUrl)}
                            />
                          </Tooltip>
                          <Tooltip title="Download">
                            <Button
                              type="text"
                              size="small"
                              icon={<DownloadOutlined />}
                              onClick={() => handleViewDocument(report.reportFileUrl)}
                            />
                          </Tooltip>
                        </>
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
                    <Text className="text-xs block mt-1" style={{ color: token.colorTextSecondary }}>
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
            <ProfileAvatar size={40} profileImage={studentData?.profileImage} className="bg-primary" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Title level={5} className="m-0 truncate">
                  {studentData?.name || 'Student Details'}
                </Title>
                <Tag className="m-0 text-[10px] uppercase">{studentData?.rollNumber}</Tag>
              </div>
              <Text className="text-xs truncate block" style={{ color: token.colorTextSecondary }}>
                {internshipApp?.companyName ? internshipApp.companyName : 'No Active Internship'}
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
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Spin spinning={loading}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="small"
            className="mb-0"
          />
        </Spin>
      </Modal>

      {/* Unified Visit Log Modal */}
      <UnifiedVisitLogModal
        visible={visitModalVisible}
        onClose={() => setVisitModalVisible(false)}
        onSuccess={handleVisitSuccess}
        selectedStudent={studentData}
        students={[{ student: studentData, ...student }]}
      />
    </>
  );
};

export default StudentDetailsModal;