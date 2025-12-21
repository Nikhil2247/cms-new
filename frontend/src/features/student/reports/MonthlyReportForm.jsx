import React, { useEffect, useState } from 'react';
import { Form, Input, Select, Button, Card, Row, Col, message, Upload, InputNumber } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { createMonthlyReport, updateMonthlyReport } from '../../../store/slices/studentSlice';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const MonthlyReportForm = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const { monthlyReports } = useSelector(state => state.student);
  const report = id ? monthlyReports.list?.find(r => r.id === id) : null;

  useEffect(() => {
    if (report) {
      form.setFieldsValue({
        ...report,
        skillsLearned: report.skillsLearned || [],
      });
    } else {
      // Set current month and year as default
      form.setFieldsValue({
        month: dayjs().month() + 1,
        year: dayjs().year(),
      });
    }
  }, [report, form]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      if (id) {
        await dispatch(updateMonthlyReport({ id, data: values })).unwrap();
        message.success('Monthly report updated successfully');
      } else {
        await dispatch(createMonthlyReport(values)).unwrap();
        message.success('Monthly report submitted successfully');
      }
      navigate('/student/reports');
    } catch (error) {
      message.error(error?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const normFile = (e) => {
    if (Array.isArray(e)) {
      return e;
    }
    return e?.fileList;
  };

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const currentYear = dayjs().year();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <Card title={id ? 'Edit Monthly Report' : 'Submit Monthly Report'}>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="month"
              label="Month"
              rules={[{ required: true, message: 'Please select month' }]}
            >
              <Select placeholder="Select month">
                {months.map(month => (
                  <Select.Option key={month.value} value={month.value}>
                    {month.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="year"
              label="Year"
              rules={[{ required: true, message: 'Please select year' }]}
            >
              <Select placeholder="Select year">
                {years.map(year => (
                  <Select.Option key={year} value={year}>
                    {year}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="hoursWorked"
              label="Hours Worked"
              rules={[{ required: true, message: 'Please enter hours worked' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="Enter total hours worked this month"
                min={0}
                max={744}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="daysPresent"
              label="Days Present"
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="Number of days present"
                min={0}
                max={31}
              />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              name="projectTitle"
              label="Project/Assignment Title"
            >
              <Input placeholder="Enter the title of your main project or assignment" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              name="tasksCompleted"
              label="Tasks Completed"
              rules={[{ required: true, message: 'Please describe tasks completed' }]}
            >
              <Input.TextArea
                rows={5}
                placeholder="List and describe the tasks you completed this month&#10;• Task 1: Description&#10;• Task 2: Description&#10;• Task 3: Description"
              />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              name="skillsLearned"
              label="Skills Learned"
              rules={[{ required: true, message: 'Please add skills learned' }]}
            >
              <Select
                mode="tags"
                placeholder="Type and press Enter to add skills (e.g., React, Python, Communication)"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              name="achievements"
              label="Achievements & Milestones"
            >
              <Input.TextArea
                rows={4}
                placeholder="Describe any notable achievements, milestones reached, or recognition received"
              />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              name="challenges"
              label="Challenges Faced"
            >
              <Input.TextArea
                rows={4}
                placeholder="Describe any challenges or difficulties you encountered and how you addressed them"
              />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              name="learningOutcomes"
              label="Key Learning Outcomes"
            >
              <Input.TextArea
                rows={4}
                placeholder="Summarize the most important things you learned this month"
              />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              name="nextMonthGoals"
              label="Goals for Next Month"
            >
              <Input.TextArea
                rows={3}
                placeholder="What do you plan to achieve or focus on next month?"
              />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              name="supervisorFeedback"
              label="Supervisor Feedback (if any)"
            >
              <Input.TextArea
                rows={3}
                placeholder="Any feedback received from your supervisor or mentor"
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="performanceRating"
              label="Self-Performance Rating"
            >
              <Select placeholder="Rate your performance this month">
                <Select.Option value={5}>Excellent (5/5)</Select.Option>
                <Select.Option value={4}>Very Good (4/5)</Select.Option>
                <Select.Option value={3}>Good (3/5)</Select.Option>
                <Select.Option value={2}>Fair (2/5)</Select.Option>
                <Select.Option value={1}>Needs Improvement (1/5)</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              name="attachments"
              label="Attachments (Screenshots, Documents, Certificates)"
              valuePropName="fileList"
              getValueFromEvent={normFile}
            >
              <Upload
                beforeUpload={() => false}
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              >
                <Button icon={<UploadOutlined />}>Click to Upload</Button>
              </Upload>
            </Form.Item>
            <div className="text-gray-500 text-xs -mt-3">
              Upload relevant documents, screenshots of work, certificates, etc.
            </div>
          </Col>
        </Row>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} size="large">
            {id ? 'Update Report' : 'Submit Report'}
          </Button>
          <Button style={{ marginLeft: 8 }} onClick={() => navigate('/student/reports')} size="large">
            Cancel
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default MonthlyReportForm;