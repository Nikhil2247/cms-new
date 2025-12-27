import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  Modal,
  Form,
  Select,
  Input,
  Button,
  Upload,
  Space,
  message,
  Row,
  Col,
  Alert,
  Spin,
} from 'antd';
import {
  CameraOutlined,
  EnvironmentOutlined,
  UploadOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import PropTypes from 'prop-types';
import { createVisitLog } from '../store/facultySlice';
import facultyService from '../../../services/faculty.service';

const { Option } = Select;
const { TextArea } = Input;

// Constant styles outside component
const UPLOAD_BUTTON_STYLE = { marginTop: 8 };
const SPACE_COMPACT_STYLE = { width: '100%' };
const IMG_WINDOW_STYLE = { width: '100%' };

const QuickVisitModal = React.memo(({ visible, onClose, onSubmit, students, loading }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [visitType, setVisitType] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [location, setLocation] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (visible) {
      form.resetFields();
      setVisitType(null);
      setLocation(null);
      setFileList([]);
      setSelectedApplicationId(null);
    }
  }, [visible, form]);

  // Handle student selection - extract applicationId from nested structure
  const handleStudentSelect = useCallback((studentId) => {
    // Find student in the list (handle both flat and nested structures)
    const found = students.find(s =>
      s.student?.id === studentId || s.id === studentId
    );

    if (found) {
      // Get applications from the found item (could be at top level or nested under student)
      const applications = found.internshipApplications ||
                           found.student?.internshipApplications ||
                           [];

      if (applications.length > 0) {
        setSelectedApplicationId(applications[0].id);
      } else {
        setSelectedApplicationId(null);
        message.warning('No active internship found for this student');
      }
    }
  }, [students]);

  // Handle GPS location capture
  const captureLocation = () => {
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
        setLocation(coords);

        // Auto-fill location field with coordinates
        const locationText = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
        form.setFieldsValue({ visitLocation: locationText });

        message.success('Location captured successfully');
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
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Handle visit type change
  const handleVisitTypeChange = (value) => {
    setVisitType(value);

    // Reset location if not physical visit
    if (value !== 'PHYSICAL') {
      setLocation(null);
      form.setFieldsValue({ visitLocation: '' });
    }
  };

  // Handle file upload
  const handleFileChange = ({ fileList: newFileList }) => {
    setFileList(newFileList);
  };

  // Before upload validation
  const beforeUpload = (file) => {
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

  // Handle form submission
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Validate applicationId is available
      if (!selectedApplicationId) {
        message.error('No active internship application found for this student. Cannot log visit.');
        return;
      }

      setSubmitting(true);

      // Upload photos first if any
      const photoUrls = [];
      if (fileList.length > 0) {
        for (const file of fileList) {
          if (file.originFileObj) {
            try {
              const result = await facultyService.uploadVisitDocument(file.originFileObj, 'visit-photo');
              photoUrls.push(result.url);
            } catch (error) {
              console.error('Photo upload error:', error);
            }
          }
        }
      }

      // Prepare visit data with applicationId
      const visitData = {
        applicationId: selectedApplicationId,
        visitType: values.visitType,
        visitDate: new Date().toISOString(),
        status: 'COMPLETED',
        // Location for physical visits
        ...(values.visitType === 'PHYSICAL' && {
          visitLocation: values.visitLocation,
          // GPS coordinates if captured
          ...(location && {
            latitude: location.latitude,
            longitude: location.longitude,
            gpsAccuracy: location.accuracy,
          }),
        }),
        // Optional notes
        ...(values.notes && { notes: values.notes, observationsAboutStudent: values.notes }),
        // Photos
        ...(photoUrls.length > 0 && { visitPhotos: photoUrls }),
      };

      // Use Redux thunk for creating visit
      await dispatch(createVisitLog(visitData)).unwrap();
      message.success('Visit logged successfully!');
      onSubmit?.(); // Notify parent (for refresh)
      onClose();
    } catch (error) {
      if (error.errorFields) {
        message.error('Please fill in all required fields');
      } else {
        message.error(error?.message || error || 'Failed to log visit. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Custom upload button
  const uploadButton = (
    <div>
      <PlusOutlined />
      <div style={UPLOAD_BUTTON_STYLE}>Upload Photo</div>
    </div>
  );

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <CameraOutlined className="text-primary" />
          <span>Quick Log Visit</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleSubmit}
          loading={submitting}
          icon={<CameraOutlined />}
        >
          Log Visit
        </Button>,
      ]}
      width={600}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" className="mt-4">
        {/* Student Selection - Required */}
        <Form.Item
          name="studentId"
          label="Student"
          rules={[{ required: true, message: 'Please select a student' }]}
        >
          <Select
            placeholder="Select student"
            showSearch
            loading={loading}
            filterOption={(input, option) =>
              option.children?.toLowerCase?.().includes(input.toLowerCase())
            }
            onChange={handleStudentSelect}
            size="large"
          >
            {students?.map((item) => {
              // Handle both nested (MentorAssignment) and flat student structures
              const student = item.student || item;
              return (
                <Option key={student.id} value={student.id}>
                  {student.name} {student.rollNumber ? `(${student.rollNumber})` : ''}
                </Option>
              );
            })}
          </Select>
        </Form.Item>

        {/* Visit Type - Required */}
        <Form.Item
          name="visitType"
          label="Visit Type"
          rules={[{ required: true, message: 'Please select visit type' }]}
        >
          <Select
            placeholder="Select visit type"
            onChange={handleVisitTypeChange}
            size="large"
          >
            <Option value="PHYSICAL">Physical Visit</Option>
            <Option value="VIRTUAL">Virtual Visit</Option>
            <Option value="TELEPHONIC">Telephonic</Option>
          </Select>
        </Form.Item>

        {/* Location - Required for Physical Visits */}
        {visitType === 'PHYSICAL' && (
          <Form.Item
            name="visitLocation"
            label="Location"
            rules={[
              {
                required: true,
                message: 'Please enter location or capture GPS coordinates',
              },
            ]}
          >
            <Space.Compact style={SPACE_COMPACT_STYLE}>
              <Input
                placeholder="Enter location or use GPS"
                size="large"
                prefix={<EnvironmentOutlined />}
              />
              <Button
                type="primary"
                icon={<EnvironmentOutlined />}
                onClick={captureLocation}
                loading={capturing}
                size="large"
              >
                {capturing ? 'Capturing...' : 'GPS'}
              </Button>
            </Space.Compact>
          </Form.Item>
        )}

        {/* Show location info if captured */}
        {location && (
          <Alert
            title="GPS Location Captured"
            description={
              <div className="text-xs">
                <div>Latitude: {location.latitude.toFixed(6)}</div>
                <div>Longitude: {location.longitude.toFixed(6)}</div>
                <div>Accuracy: {location.accuracy.toFixed(2)} meters</div>
              </div>
            }
            type="success"
            showIcon
            className="mb-4"
          />
        )}

        {/* Photo Upload Section */}
        <Form.Item label="Photos (Optional)">
          <Upload
            listType="picture-card"
            fileList={fileList}
            onChange={handleFileChange}
            beforeUpload={beforeUpload}
            multiple
            maxCount={5}
            accept="image/*"
            onPreview={(file) => {
              const src = file.url || URL.createObjectURL(file.originFileObj);
              const imgWindow = window.open(src);
              imgWindow?.document.write(`<img src="${src}" style="width: 100%;" />`);
            }}
          >
            {fileList.length >= 5 ? null : uploadButton}
          </Upload>
          <div className="text-gray-500 text-xs mt-2">
            Upload up to 5 photos. Max 5MB per photo. Drag and drop or click to select.
          </div>
        </Form.Item>

        {/* Optional Notes */}
        <Form.Item name="notes" label="Notes (Optional)">
          <TextArea
            rows={3}
            placeholder="Add any observations, feedback, or notes about this visit..."
            maxLength={500}
            showCount
          />
        </Form.Item>

        {/* Quick tip */}
        <Alert
          title="Quick Tip"
          description="This form is designed for rapid visit logging during field visits. All fields are optimized for speed - log a visit in under 10 seconds!"
          type="info"
          showIcon
          className="mt-2"
        />
      </Form>
    </Modal>
  );
});

QuickVisitModal.displayName = 'QuickVisitModal';

QuickVisitModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  students: PropTypes.array,
  loading: PropTypes.bool,
};

QuickVisitModal.defaultProps = {
  students: [],
  loading: false,
};

export default QuickVisitModal;
