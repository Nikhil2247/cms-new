import React, { useEffect, useState } from 'react';
import { Form, Input, Select, DatePicker, Button, Card, Row, Col, message, Upload, Spin } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { createStaff, updateStaff, fetchStaff, fetchDepartments } from '../store/principalSlice';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const StaffForm = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const { staff, departments } = useSelector(state => state.principal);
  const staffMember = id ? staff.list?.find(s => s.id === id) : null;

  // Fetch departments on mount
  useEffect(() => {
    const loadData = async () => {
      setInitialLoading(true);
      try {
        await Promise.all([
          dispatch(fetchDepartments()),
          // If editing and staff not in state, fetch staff
          id && !staffMember ? dispatch(fetchStaff({})) : Promise.resolve(),
        ]);
      } finally {
        setInitialLoading(false);
      }
    };
    loadData();
  }, [dispatch, id, staffMember]);

  // Set form values when staff data is available
  useEffect(() => {
    if (staffMember) {
      form.setFieldsValue({
        ...staffMember,
        dateOfJoining: staffMember.dateOfJoining ? dayjs(staffMember.dateOfJoining) : null,
      });
    }
  }, [staffMember, form]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const formattedValues = {
        ...values,
        dateOfJoining: values.dateOfJoining ? values.dateOfJoining.format('YYYY-MM-DD') : null,
      };

      if (id) {
        await dispatch(updateStaff({ id, data: formattedValues })).unwrap();
        message.success('Staff updated successfully');
      } else {
        await dispatch(createStaff(formattedValues)).unwrap();
        message.success('Staff created successfully');
      }
      navigate('/staff');
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
        <Spin spinning={true} tip="Loading..." size="large">
          <div className="flex justify-center items-center py-12" style={{ minHeight: '200px' }} />
        </Spin>
      </Card>
    );
  }

  return (
    <Card title={id ? 'Edit Staff Member' : 'Add New Staff Member'}>
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
              name="employeeId"
              label="Employee ID"
              rules={[{ required: true, message: 'Please enter employee ID' }]}
            >
              <Input placeholder="Enter employee ID" />
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
              rules={[
                { required: true, message: 'Please enter phone number' },
                { pattern: /^[0-9]{10}$/, message: 'Please enter valid 10-digit phone number' }
              ]}
            >
              <Input placeholder="Enter phone number" maxLength={10} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="role"
              label="Role"
              rules={[{ required: true, message: 'Please select role' }]}
            >
              <Select placeholder="Select role">
                <Select.Option value="TEACHER">Teacher</Select.Option>
                <Select.Option value="MENTOR">Mentor</Select.Option>
                <Select.Option value="HOD">Head of Department</Select.Option>
                <Select.Option value="COORDINATOR">Coordinator</Select.Option>
                <Select.Option value="ADMIN">Admin</Select.Option>
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
            <Form.Item
              name="designation"
              label="Designation"
              rules={[{ required: true, message: 'Please enter designation' }]}
            >
              <Input placeholder="Enter designation (e.g., Assistant Professor)" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="dateOfJoining"
              label="Date of Joining"
              rules={[{ required: true, message: 'Please select date of joining' }]}
            >
              <DatePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                disabledDate={(current) => current && current > dayjs().endOf('day')}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="qualification" label="Highest Qualification">
              <Select placeholder="Select qualification">
                <Select.Option value="B.Tech">B.Tech</Select.Option>
                <Select.Option value="M.Tech">M.Tech</Select.Option>
                <Select.Option value="PhD">PhD</Select.Option>
                <Select.Option value="MBA">MBA</Select.Option>
                <Select.Option value="MCA">MCA</Select.Option>
                <Select.Option value="Other">Other</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="specialization" label="Specialization">
              <Input placeholder="Enter specialization/area of expertise" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="experience" label="Years of Experience">
              <Input type="number" placeholder="Enter years of experience" min={0} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="gender" label="Gender">
              <Select placeholder="Select gender">
                <Select.Option value="MALE">Male</Select.Option>
                <Select.Option value="FEMALE">Female</Select.Option>
                <Select.Option value="OTHER">Other</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="address" label="Address">
              <Input.TextArea rows={3} placeholder="Enter address" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="qualifications" label="Qualifications & Certifications">
              <Input.TextArea
                rows={3}
                placeholder="Enter detailed qualifications, certifications, and achievements"
              />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              name="resume"
              label="Resume/CV"
              valuePropName="fileList"
              getValueFromEvent={normFile}
            >
              <Upload beforeUpload={() => false} maxCount={1} accept=".pdf,.doc,.docx">
                <Button icon={<UploadOutlined />}>Click to Upload</Button>
              </Upload>
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
            {id ? 'Update Staff' : 'Create Staff'}
          </Button>
          <Button style={{ marginLeft: 8 }} onClick={() => navigate('/staff')} size="large">
            Cancel
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default StaffForm;