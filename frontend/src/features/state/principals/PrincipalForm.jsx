import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Form, Input, Select, DatePicker, Button, message, Row, Col, Divider, Spin, Switch } from 'antd';
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { createPrincipal, updatePrincipal, fetchPrincipalById, fetchInstitutions, clearCurrentPrincipal } from '../store/stateSlice';
import dayjs from 'dayjs';

const PrincipalForm = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const { currentPrincipal } = useSelector((state) => state.state);
  const institutions = useSelector((state) => state.state?.institutions?.list || []);
  const institutionsLoading = useSelector((state) => state.state?.institutions?.loading || false);


  useEffect(() => {
    const loadData = async () => {
      setDataLoading(true);
      try {
        // Fetch all institutions for dropdown (no pagination limit)
        dispatch(fetchInstitutions({ limit: 1000 }));

        if (isEdit && id) {
          await dispatch(fetchPrincipalById(id));
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
    if (isEdit && currentPrincipal) {
      form.setFieldsValue({
        name: currentPrincipal.name,
        email: currentPrincipal.email,
        phone: currentPrincipal.phoneNo,
        dateOfBirth: currentPrincipal.dob ? dayjs(currentPrincipal.dob) : null,
        institutionId: currentPrincipal.Institution?.id || currentPrincipal.institutionId,
        designation: currentPrincipal.designation,
        isActive: currentPrincipal.active !== false,
      });
    }
  }, [isEdit, currentPrincipal, form]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispatch(clearCurrentPrincipal());
    };
  }, [dispatch]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      // Map frontend field names to backend field names
      const payload = {
        name: values.name,
        email: values.email,
        phoneNo: values.phone,
        institutionId: values.institutionId,
        designation: values.designation || 'Principal',
        dob: values.dateOfBirth?.format('YYYY-MM-DD'),
        active: values.isActive !== false,
      };

      if (isEdit) {
        await dispatch(updatePrincipal({ id, data: payload })).unwrap();
        message.success('Principal updated successfully');
      } else {
        // For create, include password
        const createPayload = {
          ...payload,
          password: values.password || 'Principal@123', // Default password
        };
        await dispatch(createPrincipal(createPayload)).unwrap();
        message.success('Principal created successfully');
      }
      navigate('/principals', { state: { refresh: true } });
    } catch (error) {
      message.error(error?.message || `Failed to ${isEdit ? 'update' : 'create'} principal`);
    } finally {
      setLoading(false);
    }
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
        title={isEdit ? 'Edit Principal' : 'Add New Principal'}
        extra={
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/principals')}
          >
            Back
          </Button>
        }
        variant="borderless"
      >
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 800 }}>
          <Divider plain>Personal Information</Divider>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="Full Name"
                rules={[
                  { required: true, message: 'Please enter full name' },
                  { min: 3, message: 'Name must be at least 3 characters' }
                ]}
              >
                <Input placeholder="Enter full name" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Please enter a valid email' }
                ]}
                extra={isEdit ? "Note: Changing email will affect login credentials" : null}
              >
                <Input placeholder="Enter email" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="phone"
                label="Phone Number"
                rules={[
                  { required: true, message: 'Please enter phone number' },
                  { pattern: /^[0-9]{10}$/, message: 'Please enter a valid 10-digit phone number' }
                ]}
              >
                <Input placeholder="Enter phone number" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="dateOfBirth"
                label="Date of Birth"
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="Select date of birth"
                  disabledDate={(current) => current && current > dayjs().subtract(25, 'years')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain>Professional Information</Divider>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="institutionId"
                label="Institution"
                rules={[{ required: true, message: 'Please select institution' }]}
              >
                <Select
                  placeholder="Select institution"
                  showSearch
                  allowClear
                  filterOption={(input, option) =>
                    (option?.children || '').toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {institutions.map(inst => (
                    <Select.Option key={inst.id} value={inst.id}>
                      {inst.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="designation"
                label="Designation"
                initialValue="Principal"
              >
                <Input placeholder="Enter designation" />
              </Form.Item>
            </Col>
          </Row>

          {!isEdit && (
            <>
              <Divider plain>Account Credentials</Divider>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="password"
                    label="Password"
                    rules={[
                      { required: true, message: 'Please enter password' },
                      { min: 8, message: 'Password must be at least 8 characters' }
                    ]}
                    initialValue="Principal@123"
                  >
                    <Input.Password placeholder="Enter password" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          <Divider plain>Account Settings</Divider>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="isActive"
                label="Account Status"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item className="mt-6">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<SaveOutlined />}
              size="large"
            >
              {isEdit ? 'Update Principal' : 'Create Principal'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default PrincipalForm;