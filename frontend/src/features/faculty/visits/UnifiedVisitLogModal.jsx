import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Modal,
  Form,
  Select,
  Input,
  Button,
  Upload,
  Space,
  message,
  Alert,
  DatePicker,
  Divider,
  Row,
  Col,
  Tooltip,
  Tag,
} from 'antd';
import {
  EnvironmentOutlined,
  UploadOutlined,
  PlusOutlined,
  SaveOutlined,
  FileTextOutlined,
  CameraOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import facultyService from '../../../services/faculty.service';
import { createVisitLog, updateVisitLog, selectVisitLogs } from '../store/facultySlice';

const { Option } = Select;
const { TextArea } = Input;

const VISIT_TYPES = [
  { value: 'PHYSICAL', label: 'Physical Visit', description: 'In-person visit to the company' },
  { value: 'VIRTUAL', label: 'Virtual Visit', description: 'Online meeting/video call' },
  { value: 'TELEPHONIC', label: 'Telephonic', description: 'Phone call' },
];

const STATUS_OPTIONS = [
  { value: 'COMPLETED', label: 'Completed', color: 'green' },
  { value: 'DRAFT', label: 'Save as Draft', color: 'orange' },
];

/**
 * Unified Visit Log Modal
 *
 * Required fields: date, student, type (company auto-populated from internship)
 * Optional: location (with GPS for PHYSICAL), notes, signed document, photos
 * Features: GPS capture for physical visits, draft saving, document upload
 */
const UnifiedVisitLogModal = ({
  visible,
  onClose,
  onSuccess,
  students = [],
  loading = false,
  // Optional: pre-select student (from StudentDetailsModal)
  selectedStudent = null,
  // Optional: edit mode
  visitLogId = null,
  existingData = null,
}) => {
  const dispatch = useDispatch();
  const { loading: visitLogsLoading } = useSelector(selectVisitLogs);

  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [visitType, setVisitType] = useState(null);

  // GPS state
  const [capturing, setCapturing] = useState(false);
  const [gpsLocation, setGpsLocation] = useState(null);

  // File upload states
  const [photoList, setPhotoList] = useState([]);
  const [signedDocList, setSignedDocList] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingSignedDoc, setUploadingSignedDoc] = useState(false);

  // Selected student's internship info (auto-populated company)
  const [selectedInternship, setSelectedInternship] = useState(null);
  // Track applicationId for the selected student
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);

  const isEdit = !!visitLogId;

  // Reset form when modal opens/closes
  useEffect(() => {
    if (visible) {
      form.resetFields();
      setVisitType(null);
      setGpsLocation(null);
      setPhotoList([]);
      setSignedDocList([]);
      setSelectedInternship(null);
      setSelectedApplicationId(null);

      // Pre-fill if student is selected (from StudentDetailsModal or other source)
      if (selectedStudent) {
        // Get student ID (handle both direct student and wrapped student object)
        const studentId = (selectedStudent.student || selectedStudent).id;
        form.setFieldsValue({ studentId: studentId });

        // Look up student in the students array to get internshipApplications
        // The students array has the full structure with applications
        const found = students.find(s =>
          s.student?.id === studentId || s.id === studentId
        );

        if (found) {
          // Get applications from the found item (could be at top level or nested)
          const applications = found.internshipApplications ||
                               found.student?.internshipApplications ||
                               [];

          if (applications.length > 0) {
            setSelectedApplicationId(applications[0].id);
            setSelectedInternship({
              companyName: applications[0].companyName ||
                           applications[0].internship?.industry?.companyName ||
                           'N/A',
              location: applications[0].companyAddress ||
                        applications[0].internship?.industry?.address ||
                        '',
            });
          }
        } else {
          // Fallback: Try to get from selectedStudent directly
          const apps = selectedStudent.internshipApplications ||
                       (selectedStudent.student || selectedStudent).internshipApplications ||
                       [];
          if (apps.length > 0) {
            setSelectedApplicationId(apps[0].id);
            setSelectedInternship({
              companyName: apps[0].companyName ||
                           apps[0].internship?.industry?.companyName ||
                           'N/A',
              location: apps[0].companyAddress ||
                        apps[0].internship?.industry?.address ||
                        '',
            });
          }
        }
      }

      // Pre-fill for edit mode
      if (existingData) {
        form.setFieldsValue({
          visitDate: existingData.visitDate ? dayjs(existingData.visitDate) : dayjs(),
          visitType: existingData.visitType,
          visitLocation: existingData.visitLocation,
          // Project Information fields
          titleOfProjectWork: existingData.titleOfProjectWork,
          assistanceRequiredFromInstitute: existingData.assistanceRequiredFromInstitute,
          responseFromOrganisation: existingData.responseFromOrganisation,
          remarksOfOrganisationSupervisor: existingData.remarksOfOrganisationSupervisor,
          significantChangeInPlan: existingData.significantChangeInPlan,
          // Observations & Feedback fields
          observationsAboutStudent: existingData.observationsAboutStudent,
          feedbackSharedWithStudent: existingData.feedbackSharedWithStudent,
          notes: existingData.notes,
          status: existingData.status || 'COMPLETED',
        });
        setVisitType(existingData.visitType);
        if (existingData.latitude && existingData.longitude) {
          setGpsLocation({
            latitude: existingData.latitude,
            longitude: existingData.longitude,
            accuracy: existingData.gpsAccuracy,
          });
        }
        // Set applicationId from existing data
        if (existingData.applicationId) {
          setSelectedApplicationId(existingData.applicationId);
        }
      } else {
        // Default values for new visit
        form.setFieldsValue({
          visitDate: dayjs(),
          status: 'COMPLETED',
        });
      }
    }
  }, [visible, selectedStudent, existingData, form, students]);

  // Handle student selection - auto-populate company info and applicationId
  const handleStudentSelect = useCallback((studentId) => {
    // Find student - handle both wrapped (MentorAssignment) and direct student structures
    const assignment = students.find(s => s.id === studentId || s.student?.id === studentId);
    const studentData = assignment?.student || assignment;

    if (studentData) {
      // Get internship applications - check both assignment level and student level
      const applications = assignment?.internshipApplications ||
                           studentData?.internshipApplications ||
                           [];

      if (applications.length > 0) {
        const activeApp = applications[0]; // Most recent application
        setSelectedApplicationId(activeApp.id);
        setSelectedInternship({
          companyName: activeApp.companyName ||
                       activeApp.internship?.industry?.companyName ||
                       'N/A',
          location: activeApp.companyAddress ||
                    activeApp.internship?.industry?.address ||
                    '',
        });
      } else {
        // No applications found - reset
        setSelectedApplicationId(null);
        setSelectedInternship(null);
        message.warning('No active internship found for this student');
      }
    }
  }, [students]);

  // Handle visit type change
  const handleVisitTypeChange = (value) => {
    setVisitType(value);
    // Reset GPS if not physical visit
    if (value !== 'PHYSICAL') {
      setGpsLocation(null);
      form.setFieldsValue({ visitLocation: '' });
    }
  };

  // Capture GPS location
  const captureGpsLocation = () => {
    if (!navigator.geolocation) {
      message.error('Geolocation is not supported by your browser');
      return;
    }

    setCapturing(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setGpsLocation(coords);

        // Auto-fill location field with coordinates
        const locationText = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
        form.setFieldsValue({ visitLocation: locationText });

        message.success('GPS location captured successfully');
        setCapturing(false);
      },
      (error) => {
        let errorMessage = 'Failed to capture location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
          default:
            errorMessage = 'An unknown error occurred';
        }
        message.error(errorMessage);
        setCapturing(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // Handle photo upload
  const handlePhotoChange = ({ fileList }) => {
    setPhotoList(fileList.slice(0, 5)); // Max 5 photos
  };

  const beforePhotoUpload = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('You can only upload image files!');
      return Upload.LIST_IGNORE;
    }
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('Image must be smaller than 5MB!');
      return Upload.LIST_IGNORE;
    }
    return false; // Prevent auto upload
  };

  // Handle signed document upload
  const handleSignedDocChange = ({ fileList }) => {
    setSignedDocList(fileList.slice(0, 1)); // Only 1 signed document
  };

  const beforeSignedDocUpload = (file) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      message.error('Please upload PDF or image file (JPEG, PNG)');
      return Upload.LIST_IGNORE;
    }
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('File must be smaller than 10MB!');
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  // Upload files to server
  const uploadFiles = async () => {
    const photoUrls = [];
    let signedDocUrl = null;

    // Upload photos
    if (photoList.length > 0) {
      setUploadingPhotos(true);
      for (const file of photoList) {
        if (file.originFileObj) {
          try {
            const result = await facultyService.uploadVisitDocument(file.originFileObj, 'visit-photo');
            photoUrls.push(result.url);
          } catch (error) {
            console.error('Photo upload error:', error);
          }
        } else if (file.url) {
          photoUrls.push(file.url);
        }
      }
      setUploadingPhotos(false);
    }

    // Upload signed document
    if (signedDocList.length > 0 && signedDocList[0].originFileObj) {
      setUploadingSignedDoc(true);
      try {
        const result = await facultyService.uploadVisitDocument(
          signedDocList[0].originFileObj,
          'signed-visit-document'
        );
        signedDocUrl = result.url;
      } catch (error) {
        console.error('Signed document upload error:', error);
      }
      setUploadingSignedDoc(false);
    } else if (signedDocList.length > 0 && signedDocList[0].url) {
      signedDocUrl = signedDocList[0].url;
    }

    return { photoUrls, signedDocUrl };
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Validate applicationId is available
      if (!isEdit && !selectedApplicationId) {
        message.error('No active internship application found for this student. Cannot log visit.');
        return;
      }

      setSubmitting(true);

      // Upload files first
      const { photoUrls, signedDocUrl } = await uploadFiles();

      // Prepare visit data - use applicationId instead of studentId
      const visitData = {
        applicationId: selectedApplicationId, // Required for backend lookup
        visitDate: values.visitDate.toISOString(),
        visitType: values.visitType,
        visitLocation: values.visitLocation || null,
        status: values.status || 'COMPLETED',
        // Project Information fields
        titleOfProjectWork: values.titleOfProjectWork || null,
        assistanceRequiredFromInstitute: values.assistanceRequiredFromInstitute || null,
        responseFromOrganisation: values.responseFromOrganisation || null,
        remarksOfOrganisationSupervisor: values.remarksOfOrganisationSupervisor || null,
        significantChangeInPlan: values.significantChangeInPlan || null,
        // Observations & Feedback fields
        observationsAboutStudent: values.observationsAboutStudent || null,
        feedbackSharedWithStudent: values.feedbackSharedWithStudent || null,
        notes: values.notes || null,
        // GPS coordinates
        ...(gpsLocation && {
          latitude: gpsLocation.latitude,
          longitude: gpsLocation.longitude,
          gpsAccuracy: gpsLocation.accuracy,
        }),
        // Files
        ...(photoUrls.length > 0 && { visitPhotos: photoUrls }),
        ...(signedDocUrl && { signedDocumentUrl: signedDocUrl }),
      };

      if (isEdit) {
        // Use Redux thunk for update
        const result = await dispatch(updateVisitLog({ id: visitLogId, data: visitData })).unwrap();
        if (result) {
          message.success('Visit log updated successfully');
        }
      } else {
        // Use Redux thunk for create
        const result = await dispatch(createVisitLog(visitData)).unwrap();
        if (result) {
          message.success(
            values.status === 'DRAFT'
              ? 'Visit saved as draft. You can complete it later.'
              : 'Visit logged successfully!'
          );
        }
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      if (error.errorFields) {
        message.error('Please fill in all required fields');
      } else {
        message.error(error?.message || error || 'Failed to save visit log');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Photo upload button
  const uploadButton = (
    <div>
      <PlusOutlined />
      <div style={{ marginTop: 8 }}>Upload</div>
    </div>
  );

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <CameraOutlined className="text-primary" />
          <span>{isEdit ? 'Edit Visit Log' : 'Log Visit'}</span>
          {selectedStudent && (
            <Tag color="blue">{selectedStudent.name}</Tag>
          )}
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleSubmit}
          loading={submitting || uploadingPhotos || uploadingSignedDoc}
          icon={<SaveOutlined />}
        >
          {isEdit ? 'Update Visit' : 'Save Visit'}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" className="mt-4">
        {/* Required Fields Section */}
        <Divider orientation="left" className="!text-sm !my-2">
          Required Information
        </Divider>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="visitDate"
              label="Visit Date & Time"
              rules={[{ required: true, message: 'Please select date' }]}
            >
              <DatePicker
                showTime
                className="w-full"
                format="DD/MM/YYYY HH:mm"
                placeholder="Select date and time"
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="visitType"
              label="Visit Type"
              rules={[{ required: true, message: 'Please select visit type' }]}
            >
              <Select
                placeholder="Select visit type"
                onChange={handleVisitTypeChange}
              >
                {VISIT_TYPES.map(type => (
                  <Option key={type.value} value={type.value}>
                    <div>
                      <span>{type.label}</span>
                      <span className="text-gray-400 text-xs ml-2">
                        ({type.description})
                      </span>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={selectedStudent ? 24 : 12}>
            {!selectedStudent && (
              <Form.Item
                name="studentId"
                label="Student"
                rules={[{ required: true, message: 'Please select student' }]}
              >
                <Select
                  placeholder="Select student"
                  showSearch
                  loading={loading}
                  filterOption={(input, option) =>
                    option.children?.toLowerCase().includes(input.toLowerCase())
                  }
                  onChange={handleStudentSelect}
                >
                  {students?.map((student) => {
                    const s = student.student || student;
                    return (
                      <Option key={s.id} value={s.id}>
                        {s.name} {s.rollNumber ? `(${s.rollNumber})` : ''}
                      </Option>
                    );
                  })}
                </Select>
              </Form.Item>
            )}
          </Col>

          {selectedInternship && (
            <Col xs={24}>
              <Alert
                message={
                  <Space>
                    <span className="font-medium">Company:</span>
                    <span>{selectedInternship.companyName}</span>
                    {selectedInternship.location && (
                      <>
                        <span className="text-gray-400">|</span>
                        <EnvironmentOutlined />
                        <span>{selectedInternship.location}</span>
                      </>
                    )}
                  </Space>
                }
                type="info"
                showIcon
                className="mb-4"
              />
            </Col>
          )}
        </Row>

        {/* Location for Physical Visits */}
        {visitType === 'PHYSICAL' && (
          <>
            <Divider orientation="left" className="!text-sm !my-2">
              Location (Physical Visit)
            </Divider>

            <Form.Item
              name="visitLocation"
              label="Visit Location"
              extra="Enter location or capture GPS coordinates"
            >
              <Space.Compact className="w-full">
                <Input
                  placeholder="Enter location or use GPS"
                  prefix={<EnvironmentOutlined />}
                  className="flex-1"
                />
                <Tooltip title="Capture GPS Location">
                  <Button
                    type="primary"
                    icon={<EnvironmentOutlined />}
                    onClick={captureGpsLocation}
                    loading={capturing}
                  >
                    {capturing ? 'Capturing...' : 'GPS'}
                  </Button>
                </Tooltip>
              </Space.Compact>
            </Form.Item>

            {gpsLocation && (
              <Alert
                message="GPS Location Captured"
                description={
                  <div className="text-xs">
                    <div>Latitude: {gpsLocation.latitude.toFixed(6)}</div>
                    <div>Longitude: {gpsLocation.longitude.toFixed(6)}</div>
                    <div>Accuracy: {gpsLocation.accuracy?.toFixed(2) || 'N/A'} meters</div>
                  </div>
                }
                type="success"
                showIcon
                className="mb-4"
              />
            )}
          </>
        )}

        {/* Project Information */}
        <Divider orientation="left" className="!text-sm !my-2">
          Project Information
        </Divider>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="titleOfProjectWork" label="Title of Project/Work">
              <Input
                placeholder="Enter the title of the project or work..."
                maxLength={200}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="assistanceRequiredFromInstitute" label="Assistance Required from Institute">
              <TextArea
                rows={2}
                placeholder="Describe any assistance required..."
                maxLength={500}
                showCount
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="responseFromOrganisation" label="Response from Organisation">
              <TextArea
                rows={2}
                placeholder="Enter response from organisation..."
                maxLength={500}
                showCount
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="remarksOfOrganisationSupervisor" label="Remarks of Organisation Supervisor">
              <TextArea
                rows={2}
                placeholder="Enter supervisor remarks..."
                maxLength={500}
                showCount
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="significantChangeInPlan" label="Any Significant Change with Respect to the Plan of Project/Work">
          <TextArea
            rows={2}
            placeholder="Describe any significant changes in the project plan..."
            maxLength={500}
            showCount
          />
        </Form.Item>

        {/* Observations & Feedback */}
        <Divider orientation="left" className="!text-sm !my-2">
          Observations & Feedback
        </Divider>

        <Form.Item
          name="observationsAboutStudent"
          label="Observations about the Student"
          extra="Please provide at least 100 words"
        >
          <TextArea
            rows={4}
            placeholder="Enter your observations about the student (at least 100 words)..."
            maxLength={2000}
            showCount
          />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="feedbackSharedWithStudent" label="Feedback Shared with Student">
              <TextArea
                rows={2}
                placeholder="Enter feedback shared with student..."
                maxLength={500}
                showCount
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="notes" label="Additional Notes">
              <TextArea
                rows={2}
                placeholder="Any additional notes or comments..."
                maxLength={1000}
                showCount
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Document Uploads */}
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item label="Photos (Optional)">
              <Upload
                listType="picture-card"
                fileList={photoList}
                onChange={handlePhotoChange}
                beforeUpload={beforePhotoUpload}
                multiple
                maxCount={5}
                accept="image/*"
              >
                {photoList.length >= 5 ? null : uploadButton}
              </Upload>
              <div className="text-gray-500 text-xs">
                Max 5 photos, 5MB each
              </div>
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              label={
                <Space>
                  <FileTextOutlined />
                  <span>Signed Visit Document</span>
                </Space>
              }
            >
              <Upload
                fileList={signedDocList}
                onChange={handleSignedDocChange}
                beforeUpload={beforeSignedDocUpload}
                maxCount={1}
                accept=".pdf,.jpg,.jpeg,.png"
              >
                <Button icon={<UploadOutlined />}>
                  {signedDocList.length > 0 ? 'Replace Document' : 'Upload Document'}
                </Button>
              </Upload>
              <div className="text-gray-500 text-xs mt-1">
                PDF or image of signed visit form (max 10MB)
              </div>
            </Form.Item>
          </Col>
        </Row>

        {/* Status Selection */}
        <Divider orientation="left" className="!text-sm !my-2">
          Save Options
        </Divider>

        <Form.Item
          name="status"
          label="Status"
          extra="Save as draft to complete later, or mark as completed"
        >
          <Select placeholder="Select status">
            {STATUS_OPTIONS.map(status => (
              <Option key={status.value} value={status.value}>
                <Space>
                  <Tag color={status.color}>{status.label}</Tag>
                  {status.value === 'DRAFT' && (
                    <span className="text-gray-400 text-xs">
                      (can add details later)
                    </span>
                  )}
                </Space>
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* Quick tip for drafts */}
        {form.getFieldValue('status') === 'DRAFT' && (
          <Alert
            message="Saving as Draft"
            description="You can complete this visit log later from the Visit Logs page (Drafts tab)."
            type="info"
            showIcon
            icon={<ClockCircleOutlined />}
            className="mt-2"
          />
        )}
      </Form>
    </Modal>
  );
};

export default UnifiedVisitLogModal;
