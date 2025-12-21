import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Form, Input, Select, DatePicker, InputNumber, Upload, Button, message, Row, Col } from 'antd';
import { UploadOutlined, SaveOutlined } from '@ant-design/icons';
import { submitReport } from '../../../store/slices/studentSlice';

const StudentReportSubmit = () => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState([]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const formData = {
        ...values,
        month: values.month?.format('YYYY-MM'),
        attachments: fileList.map(file => file.originFileObj),
      };

      await dispatch(submitReport(formData)).unwrap();
      message.success('Report submitted successfully');
      form.resetFields();
      setFileList([]);
    } catch (error) {
      message.error(error?.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = ({ fileList: newFileList }) => {
    setFileList(newFileList);
  };

  const uploadProps = {
    beforeUpload: (file) => {
      const isValidSize = file.size / 1024 / 1024 < 5; // 5MB limit
      if (!isValidSize) {
        message.error('File must be smaller than 5MB!');
        return Upload.LIST_IGNORE;
      }
      return false;
    },
    fileList,
    onChange: handleFileChange,
    maxCount: 5,
    multiple: true,
  };

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      <Card 
        title={<span className="text-text-primary font-semibold">Submit Monthly Report</span>} 
        className="rounded-xl border-border shadow-sm max-w-4xl mx-auto"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          className="mt-2"
        >
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="month"
                label="Report Month"
                rules={[{ required: true, message: 'Please select report month' }]}
              >
                <DatePicker
                  picker="month"
                  className="w-full rounded-lg"
                  placeholder="Select month"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="hoursWorked"
                label="Hours Worked"
                rules={[
                  { required: true, message: 'Please enter hours worked' },
                  { type: 'number', min: 0, max: 200, message: 'Hours must be between 0 and 200' }
                ]}
              >
                <InputNumber
                  min={0}
                  max={200}
                  className="w-full rounded-lg"
                  placeholder="Enter total hours"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="tasksCompleted"
            label="Tasks Completed"
            rules={[
              { required: true, message: 'Please describe tasks completed' },
              { min: 50, message: 'Please provide at least 50 characters' }
            ]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Describe the tasks you completed this month in detail..."
              showCount
              maxLength={1000}
              className="rounded-lg"
            />
          </Form.Item>

          <Form.Item
            name="skillsLearned"
            label="Skills Learned"
            rules={[{ required: true, message: 'Please add skills learned' }]}
            tooltip="Press Enter after each skill to add multiple skills"
          >
            <Select
              mode="tags"
              placeholder="Add skills learned (e.g., React, Node.js, Communication)"
              className="w-full rounded-lg"
            />
          </Form.Item>

          <Form.Item
            name="challenges"
            label="Challenges Faced"
            tooltip="Describe any difficulties or obstacles encountered"
          >
            <Input.TextArea
              rows={3}
              placeholder="Any challenges you faced during this period..."
              showCount
              maxLength={500}
              className="rounded-lg"
            />
          </Form.Item>

          <Form.Item
            name="nextMonthPlan"
            label="Next Month Plan"
            tooltip="What you plan to accomplish in the next month"
          >
            <Input.TextArea
              rows={3}
              placeholder="What do you plan to work on next month..."
              showCount
              maxLength={500}
              className="rounded-lg"
            />
          </Form.Item>

          <Form.Item
            name="feedback"
            label="Feedback on Internship"
            tooltip="Your feedback about the internship experience"
          >
            <Input.TextArea
              rows={3}
              placeholder="Share your feedback about the internship program..."
              showCount
              maxLength={500}
              className="rounded-lg"
            />
          </Form.Item>

          <Form.Item
            name="attachments"
            label="Attachments"
            tooltip="Upload supporting documents (max 5 files, 5MB each)"
          >
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />} className="rounded-lg">
                Upload Supporting Documents
              </Button>
            </Upload>
            <div className="text-text-tertiary text-xs mt-2 italic">
              Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 5MB per file)
            </div>
          </Form.Item>

          <Divider className="my-8" />

          <Form.Item className="!mb-0">
            <div className="flex justify-end">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<SaveOutlined />}
                size="large"
                className="rounded-xl px-10 h-12 shadow-lg shadow-primary/20"
              >
                Submit Report
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default StudentReportSubmit;