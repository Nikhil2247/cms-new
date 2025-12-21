import React, { useEffect, useState } from 'react';
import { Form, Input, Select, Button, Card, Row, Col, message, Switch } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { createInstitution, updateInstitution } from '../store/stateSlice';

const InstitutionForm = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const { institutions, principals } = useSelector(state => state.state);
  const institution = id ? institutions.list?.find(i => i.id === id) : null;

  useEffect(() => {
    if (institution) {
      form.setFieldsValue(institution);
    }
  }, [institution, form]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      if (id) {
        await dispatch(updateInstitution({ id, data: values })).unwrap();
        message.success('Institution updated successfully');
      } else {
        await dispatch(createInstitution(values)).unwrap();
        message.success('Institution created successfully');
      }
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/institutions');
      }
    } catch (error) {
      message.error(error?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Go back to where the user came from (list/dashboard/etc.)
    // Fallback for direct-entry (no meaningful browser history)
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/institutions');
  };

  return (
    <Card title={id ? 'Edit Institution' : 'Add New Institution'} className="shadow-sm border-slate-200">
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ isActive: true }}
      >
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="name"
              label="Institution Name"
              rules={[{ required: true, message: 'Please enter institution name' }]}
            >
              <Input aria-label="Institution name" placeholder="Enter institution name" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="code"
              label="Institution Code"
              rules={[{ required: true, message: 'Please enter institution code' }]}
            >
              <Input aria-label="Institution code" placeholder="Enter unique institution code" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="type"
              label="Institution Type"
              rules={[{ required: true, message: 'Please select institution type' }]}
            >
              <Select placeholder="Select institution type">
                <Select.Option value="ENGINEERING">Engineering College</Select.Option>
                <Select.Option value="ARTS">Arts & Science College</Select.Option>
                <Select.Option value="MEDICAL">Medical College</Select.Option>
                <Select.Option value="POLYTECHNIC">Polytechnic</Select.Option>
                <Select.Option value="UNIVERSITY">University</Select.Option>
                <Select.Option value="OTHER">Other</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="affiliatedTo"
              label="Affiliated To"
            >
              <Input aria-label="Affiliated to" placeholder="Enter university/board affiliation" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="email"
              label="Official Email"
              rules={[
                { required: true, message: 'Please enter email' },
                { type: 'email', message: 'Please enter valid email' }
              ]}
            >
              <Input aria-label="Official email" placeholder="Enter official email" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="phone"
              label="Contact Phone"
              rules={[
                { required: true, message: 'Please enter phone number' },
                { pattern: /^[0-9]{10}$/, message: 'Please enter valid 10-digit phone number' }
              ]}
            >
              <Input aria-label="Contact phone" placeholder="Enter contact phone" maxLength={10} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="website" label="Website">
              <Input aria-label="Website" placeholder="Enter website URL" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="principalId"
              label="Principal"
              rules={[{ required: true, message: 'Please select principal' }]}
            >
              <Select placeholder="Select principal" showSearch optionFilterProp="children">
                {principals?.list?.map(principal => (
                  <Select.Option key={principal.id} value={principal.id}>
                    {principal.name} - {principal.email}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              name="address"
              label="Address"
              rules={[{ required: true, message: 'Please enter address' }]}
            >
              <Input.TextArea rows={2} placeholder="Enter street address" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="city"
              label="City"
              rules={[{ required: true, message: 'Please enter city' }]}
            >
              <Input aria-label="City" placeholder="Enter city" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="state"
              label="State"
              rules={[{ required: true, message: 'Please enter state' }]}
            >
              <Input aria-label="State" placeholder="Enter state" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="pincode"
              label="Pincode"
              rules={[
                { required: true, message: 'Please enter pincode' },
                { pattern: /^[0-9]{6}$/, message: 'Please enter valid 6-digit pincode' }
              ]}
            >
              <Input aria-label="Pincode" placeholder="Enter pincode" maxLength={6} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="establishedYear" label="Established Year">
              <Input aria-label="Established year" type="number" placeholder="Enter year of establishment" min={1800} max={new Date().getFullYear()} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="studentCapacity" label="Student Capacity">
              <Input aria-label="Student capacity" type="number" placeholder="Enter total student capacity" min={0} />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="description" label="Description">
              <Input.TextArea rows={3} placeholder="Enter institution description and facilities" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              name="isActive"
              label="Active Status"
              valuePropName="checked"
            >
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} size="large">
            {id ? 'Update Institution' : 'Create Institution'}
          </Button>
          <Button style={{ marginLeft: 8 }} onClick={handleCancel} size="large">
            Cancel
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default InstitutionForm;