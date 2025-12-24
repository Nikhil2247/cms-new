import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Switch,
  message,
  Typography,
  Space,
  Row,
  Col,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  BankOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import {
  createInstitution,
  updateInstitution,
  fetchInstitutions,
  selectInstitutions,
  selectInstitutionsLoading,
} from '../store/stateSlice';

const { Title, Text } = Typography;
const { Option } = Select;

const InstitutionForm = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const institutions = useSelector(selectInstitutions);
  const loading = useSelector(selectInstitutionsLoading);
  const [submitting, setSubmitting] = useState(false);

  const isEditMode = !!id;

  useEffect(() => {
    if (isEditMode) {
      const institution = institutions.find((i) => i.id === id);
      if (institution) {
        form.setFieldsValue(institution);
      } else {
        dispatch(fetchInstitutions({ id }));
      }
    }
  }, [dispatch, id, institutions, isEditMode, form]);

  const onFinish = async (values) => {
    setSubmitting(true);
    try {
      if (isEditMode) {
        await dispatch(updateInstitution({ id, data: values })).unwrap();
        message.success('Institution updated successfully');
      } else {
        await dispatch(createInstitution(values)).unwrap();
        message.success('Institution created successfully');
      }
      navigate('/institutions');
    } catch (error) {
      message.error(error.message || 'Failed to save institution');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center">
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/institutions')} 
            className="mr-4 w-10 h-10 flex items-center justify-center rounded-xl border-border hover:border-primary hover:text-primary transition-all"
          />
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-primary shadow-sm mr-3">
            <BankOutlined className="text-lg" />
          </div>
          <div>
            <Title level={2} className="mb-0 text-text-primary text-2xl">
              {isEditMode ? 'Edit Institution' : 'Add Institution'}
            </Title>
            <Text className="text-text-secondary text-sm">
              {isEditMode ? 'Update institution details and settings' : 'Register a new institution in the system'}
            </Text>
          </div>
        </div>
      </div>

      <Card 
        className="rounded-2xl border-border shadow-sm bg-surface overflow-hidden"
        styles={{ body: { padding: '32px' } }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          requiredMark="optional"
          initialValues={{ isActive: true }}
        >
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6 text-text-primary">
              <InfoCircleOutlined className="text-primary" />
              <span className="font-bold text-sm uppercase tracking-widest">Basic Information</span>
            </div>
            
            <Row gutter={24}>
              <Col xs={24} md={16}>
                <Form.Item
                  name="name"
                  label={<span className="font-medium text-text-primary">Institution Name</span>}
                  rules={[{ required: true, message: 'Please enter institution name' }]}
                >
                  <Input prefix={<BankOutlined className="text-text-tertiary" />} placeholder="e.g. Government Polytechnic College" className="rounded-lg h-11 bg-background border-border" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="code"
                  label={<span className="font-medium text-text-primary">Institution Code</span>}
                  rules={[{ required: true, message: 'Please enter institution code' }]}
                >
                  <Input placeholder="e.g. GPC-001" className="rounded-lg h-11 bg-background border-border" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="type"
                  label={<span className="font-medium text-text-primary">Institution Type</span>}
                  rules={[{ required: true, message: 'Please select institution type' }]}
                >
                  <Select placeholder="Select type" className="rounded-lg h-11">
                    <Option value="GOVERNMENT">Government</Option>
                    <Option value="AIDED">Aided</Option>
                    <Option value="PRIVATE">Private</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="website"
                  label={<span className="font-medium text-text-primary">Website</span>}
                >
                  <Input prefix={<GlobalOutlined className="text-text-tertiary" />} placeholder="https://example.com" className="rounded-lg h-11 bg-background border-border" />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <Divider className="border-border" />

          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6 text-text-primary">
              <EnvironmentOutlined className="text-success" />
              <span className="font-bold text-sm uppercase tracking-widest">Location & Contact</span>
            </div>

            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="email"
                  label={<span className="font-medium text-text-primary">Official Email</span>}
                  rules={[
                    { required: true, message: 'Please enter email' },
                    { type: 'email', message: 'Please enter a valid email' },
                  ]}
                >
                  <Input prefix={<MailOutlined className="text-text-tertiary" />} placeholder="admin@college.edu" className="rounded-lg h-11 bg-background border-border" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="contactNumber"
                  label={<span className="font-medium text-text-primary">Contact Number</span>}
                  rules={[{ required: true, message: 'Please enter contact number' }]}
                >
                  <Input prefix={<PhoneOutlined className="text-text-tertiary" />} placeholder="+91 XXXXX XXXXX" className="rounded-lg h-11 bg-background border-border" />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item
                  name="address"
                  label={<span className="font-medium text-text-primary">Address</span>}
                  rules={[{ required: true, message: 'Please enter address' }]}
                >
                  <Input.TextArea rows={3} placeholder="Full address" className="rounded-lg bg-background border-border p-3" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="city"
                  label={<span className="font-medium text-text-primary">City</span>}
                  rules={[{ required: true, message: 'Please enter city' }]}
                >
                  <Input placeholder="City" className="rounded-lg h-11 bg-background border-border" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="state"
                  label={<span className="font-medium text-text-primary">State</span>}
                  rules={[{ required: true, message: 'Please enter state' }]}
                >
                  <Input placeholder="State" className="rounded-lg h-11 bg-background border-border" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="pincode"
                  label={<span className="font-medium text-text-primary">Pincode</span>}
                  rules={[{ required: true, message: 'Please enter pincode' }]}
                >
                  <Input placeholder="Pincode" className="rounded-lg h-11 bg-background border-border" />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <Divider className="border-border" />

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-text-primary">
              <span className="font-bold text-sm uppercase tracking-widest">Settings</span>
            </div>
            <Form.Item name="isActive" valuePropName="checked" className="mb-0">
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t border-border">
            <Button 
              size="large"
              onClick={() => navigate('/institutions')}
              className="rounded-xl h-12 px-8 font-medium"
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              icon={<SaveOutlined />}
              size="large"
              className="rounded-xl h-12 px-8 font-bold shadow-lg shadow-primary/20 bg-primary border-0"
            >
              Save Institution
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default InstitutionForm;