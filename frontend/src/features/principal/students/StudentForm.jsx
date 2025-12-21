import React, { useEffect, useState } from 'react';
import { Form, Input, Select, DatePicker, Button, Card, Row, Col, message, Upload, Spin } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { createStudent, updateStudent, fetchStudents, fetchBatches, fetchDepartments } from '../store/principalSlice';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const StudentForm = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const { students, batches, departments } = useSelector(state => state.principal);
  const student = id ? students.list?.find(s => s.id === id) : null;

  // Fetch batches and departments on mount
  useEffect(() => {
    const loadData = async () => {
      setInitialLoading(true);
      try {
        await Promise.all([
          dispatch(fetchBatches()),
          dispatch(fetchDepartments()),
          // If editing and student not in state, fetch students
          id && !student ? dispatch(fetchStudents({})) : Promise.resolve(),
        ]);
      } finally {
        setInitialLoading(false);
      }
    };
    loadData();
  }, [dispatch, id, student]);

  // Set form values when student data is available
  useEffect(() => {
    if (student) {
      form.setFieldsValue({
        ...student,
        dateOfBirth: student.dateOfBirth ? dayjs(student.dateOfBirth) : null,
      });
    }
  }, [student, form]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const formattedValues = {
        ...values,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : null,
      };

      if (id) {
        await dispatch(updateStudent({ id, data: formattedValues })).unwrap();
        message.success('Student updated successfully');
      } else {
        await dispatch(createStudent(formattedValues)).unwrap();
        message.success('Student created successfully');
      }
      navigate('/students');
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

  if (initialLoading) {
    return (
      <Card>
        <div className="flex justify-center items-center py-12">
          <Spin size="large" tip="Loading..." />
        </div>
      </Card>
    );
  }

  return (
    <Card title={id ? 'Edit Student' : 'Add New Student'}>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="name"
              label="Full Name"
              rules={[{ required: true, message: 'Please enter full name' }]}
            >
              <Input placeholder="Enter full name" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="rollNumber"
              label="Roll Number"
              rules={[{ required: true, message: 'Please enter roll number' }]}
            >
              <Input placeholder="Enter roll number" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Please enter email' },
                { type: 'email', message: 'Please enter valid email' }
              ]}
            >
              <Input placeholder="Enter email" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="phoneNo"
              label="Phone Number"
              rules={[{ pattern: /^[0-9]{10}$/, message: 'Please enter valid 10-digit phone number' }]}
            >
              <Input placeholder="Enter phone number" maxLength={10} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="dateOfBirth"
              label="Date of Birth"
              rules={[{ required: true, message: 'Please select date of birth' }]}
            >
              <DatePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                disabledDate={(current) => current && current > dayjs().endOf('day')}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="gender"
              label="Gender"
              rules={[{ required: true, message: 'Please select gender' }]}
            >
              <Select placeholder="Select gender">
                <Select.Option value="MALE">Male</Select.Option>
                <Select.Option value="FEMALE">Female</Select.Option>
                <Select.Option value="OTHER">Other</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="batchId"
              label="Batch"
              rules={[{ required: true, message: 'Please select batch' }]}
            >
              <Select placeholder="Select batch">
                {batches?.list?.map(batch => (
                  <Select.Option key={batch.id} value={batch.id}>
                    {batch.name} ({batch.year})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="departmentId"
              label="Department"
              rules={[{ required: true, message: 'Please select department' }]}
            >
              <Select placeholder="Select department">
                {departments?.list?.map(dept => (
                  <Select.Option key={dept.id} value={dept.id}>
                    {dept.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="bloodGroup" label="Blood Group">
              <Select placeholder="Select blood group">
                <Select.Option value="A+">A+</Select.Option>
                <Select.Option value="A-">A-</Select.Option>
                <Select.Option value="B+">B+</Select.Option>
                <Select.Option value="B-">B-</Select.Option>
                <Select.Option value="AB+">AB+</Select.Option>
                <Select.Option value="AB-">AB-</Select.Option>
                <Select.Option value="O+">O+</Select.Option>
                <Select.Option value="O-">O-</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="parentName" label="Parent/Guardian Name">
              <Input placeholder="Enter parent/guardian name" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="parentPhone"
              label="Parent/Guardian Phone"
              rules={[{ pattern: /^[0-9]{10}$/, message: 'Please enter valid 10-digit phone number' }]}
            >
              <Input placeholder="Enter parent/guardian phone" maxLength={10} />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="address" label="Address">
              <Input.TextArea rows={3} placeholder="Enter address" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              name="profileImage"
              label="Profile Image"
              valuePropName="fileList"
              getValueFromEvent={normFile}
            >
              <Upload beforeUpload={() => false} maxCount={1} accept="image/*">
                <Button icon={<UploadOutlined />}>Click to Upload</Button>
              </Upload>
            </Form.Item>
          </Col>
        </Row>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} size="large">
            {id ? 'Update Student' : 'Create Student'}
          </Button>
          <Button style={{ marginLeft: 8 }} onClick={() => navigate('/students')} size="large">
            Cancel
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default StudentForm;