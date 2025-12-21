import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Form, Input, Select, DatePicker, Button, message, Row, Col, Divider, Upload, Spin } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons';
import { createVisitLog, updateVisitLog, fetchVisitLogById } from '../../../store/slices/facultySlice';
import { fetchAssignedStudents } from '../../../store/slices/facultySlice';
import { fetchCompanies } from '../../../store/slices/companySlice';
import dayjs from 'dayjs';

const VisitLogForm = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [fileList, setFileList] = useState([]);

  const { visitLogs, students } = useSelector((state) => state.faculty);
  const currentVisitLog = visitLogs?.current;
  const assignedStudents = students?.list || [];
  const { companies } = useSelector((state) => state.company || { companies: [] });

  useEffect(() => {
    const loadData = async () => {
      setDataLoading(true);
      try {
        await Promise.all([
          dispatch(fetchAssignedStudents()),
          dispatch(fetchCompanies()),
        ]);

        if (isEdit && id) {
          await dispatch(fetchVisitLogById(id));
        }
      } catch (error) {
        message.error('Failed to load data');
      } finally {
        setDataLoading(false);
      }
    };

    loadData();
  }, [dispatch, isEdit, id]);

  useEffect(() => {
    if (isEdit && currentVisitLog) {
      form.setFieldsValue({
        ...currentVisitLog,
        visitDate: currentVisitLog.visitDate ? dayjs(currentVisitLog.visitDate) : null,
        studentId: currentVisitLog.student?.id,
        companyId: currentVisitLog.company?.id,
      });
    }
  }, [isEdit, currentVisitLog, form]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const formData = new FormData();

      // Append form fields
      Object.keys(values).forEach(key => {
        if (values[key] && key !== 'visitDate' && key !== 'attachments') {
          formData.append(key, values[key]);
        }
      });

      // Append date
      if (values.visitDate) {
        formData.append('visitDate', values.visitDate.format('YYYY-MM-DD'));
      }

      // Append files
      fileList.forEach(file => {
        formData.append('attachments', file.originFileObj);
      });

      if (isEdit) {
        await dispatch(updateVisitLog({ id, data: formData })).unwrap();
        message.success('Visit log updated successfully');
      } else {
        await dispatch(createVisitLog(formData)).unwrap();
        message.success('Visit log created successfully');
      }
      navigate('/faculty/visit-logs');
    } catch (error) {
      message.error(error?.message || `Failed to ${isEdit ? 'update' : 'create'} visit log`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = ({ fileList: newFileList }) => {
    setFileList(newFileList);
  };

  const uploadProps = {
    beforeUpload: (file) => {
      const isValidSize = file.size / 1024 / 1024 < 10; // 10MB limit
      if (!isValidSize) {
        message.error('File must be smaller than 10MB!');
        return Upload.LIST_IGNORE;
      }
      return false;
    },
    fileList,
    onChange: handleFileChange,
    maxCount: 5,
    multiple: true,
  };

  if (dataLoading) {
    return (
      <div className="p-6 text-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card
        title={isEdit ? 'Edit Visit Log' : 'Add Visit Log'}
        extra={
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/faculty/visit-logs')}
          >
            Back
          </Button>
        }
        variant="borderless"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          style={{ maxWidth: 900 }}
        >
          <Divider plain>Visit Information</Divider>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="visitDate"
                label="Visit Date"
                rules={[{ required: true, message: 'Please select visit date' }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="Select visit date"
                  format="DD/MM/YYYY"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true, message: 'Please select status' }]}
              >
                <Select
                  placeholder="Select status"
                  options={[
                    { value: 'scheduled', label: 'Scheduled' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'cancelled', label: 'Cancelled' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="studentId"
                label="Student"
                rules={[{ required: true, message: 'Please select student' }]}
              >
                <Select
                  placeholder="Select student"
                  showSearch
                  filterOption={(input, option) =>
                    option.label.toLowerCase().includes(input.toLowerCase())
                  }
                  options={assignedStudents?.map(student => ({
                    value: student.id,
                    label: `${student.name} (${student.rollNumber})`,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="companyId"
                label="Company"
                rules={[{ required: true, message: 'Please select company' }]}
              >
                <Select
                  placeholder="Select company"
                  showSearch
                  filterOption={(input, option) =>
                    option.label.toLowerCase().includes(input.toLowerCase())
                  }
                  options={companies?.map(company => ({
                    value: company.id,
                    label: company.name,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="contactPerson"
                label="Contact Person"
              >
                <Input placeholder="Enter contact person name" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="contactNumber"
                label="Contact Number"
                rules={[
                  { pattern: /^[0-9]{10}$/, message: 'Please enter a valid 10-digit phone number' }
                ]}
              >
                <Input placeholder="Enter contact number" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="purpose"
            label="Purpose of Visit"
            rules={[
              { required: true, message: 'Please enter purpose of visit' },
              { min: 10, message: 'Please provide at least 10 characters' }
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Describe the purpose of the visit..."
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="duration"
                label="Duration"
                tooltip="Approximate duration of the visit"
              >
                <Input placeholder="e.g., 2 hours, 1 day" />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain>Visit Details</Divider>

          <Form.Item
            name="observations"
            label="Observations"
            tooltip="Key observations during the visit"
          >
            <Input.TextArea
              rows={4}
              placeholder="Record your observations during the visit..."
              showCount
              maxLength={1000}
            />
          </Form.Item>

          <Form.Item
            name="feedback"
            label="Feedback"
            tooltip="Feedback from the company or student"
          >
            <Input.TextArea
              rows={4}
              placeholder="Record feedback received..."
              showCount
              maxLength={1000}
            />
          </Form.Item>

          <Form.Item
            name="actionItems"
            label="Action Items"
            tooltip="Follow-up actions required"
          >
            <Input.TextArea
              rows={3}
              placeholder="List any action items or follow-ups required..."
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Form.Item
            name="recommendations"
            label="Recommendations"
          >
            <Input.TextArea
              rows={3}
              placeholder="Any recommendations or suggestions..."
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Divider plain>Attachments</Divider>

          <Form.Item
            name="attachments"
            label="Attachments"
            tooltip="Upload supporting documents, photos, or reports"
          >
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>
                Upload Files
              </Button>
            </Upload>
            <div className="text-gray-500 text-xs mt-2">
              Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB per file, up to 5 files)
            </div>
          </Form.Item>

          <Form.Item className="mt-6">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<SaveOutlined />}
              size="large"
            >
              {isEdit ? 'Update Visit Log' : 'Create Visit Log'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default VisitLogForm;