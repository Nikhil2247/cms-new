// src/components/ForgotPassword.jsx
import React, { useState } from 'react';
import { 
  Form, 
  Input, 
  Button, 
  Card, 
  Typography, 
  message, 
  Space,
  Result 
} from 'antd';
import { 
  MailOutlined, 
  ArrowLeftOutlined,
  CheckCircleOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import API from '../../../services/api';
import { toast } from 'react-hot-toast';

const { Title, Text, Paragraph } = Typography;

const ForgotPassword = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const response = await API.post('/auth/forgot-password', {
        email: values.email,
      });

      if (response.data.success) {
        setSubmittedEmail(values.email);
        setEmailSent(true);
        toast.success('Password reset link sent to your email!');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      toast.error(
        error.response?.data?.message || 
        'Failed to send reset email. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background bg-gradient-to-br from-primary-50/30 to-background p-4">
        <Card 
          className="w-full max-w-md shadow-soft-lg rounded-2xl border border-border overflow-hidden"
        >
          <Result
            status="success"
            icon={<div className="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-4"><CheckCircleOutlined className="text-3xl" /></div>}
            title={
              <Title level={3} className="!mt-0 text-text-primary">
                Check Your Email
              </Title>
            }
            subTitle={
              <div className="space-y-4">
                <Paragraph className="text-text-secondary text-center mb-0">
                  We've sent a password reset link to:
                </Paragraph>
                <div className="py-2 px-4 bg-primary-50 rounded-xl inline-block border border-primary-100">
                  <Text strong className="text-lg text-primary">
                    {submittedEmail}
                  </Text>
                </div>
                <Paragraph className="text-text-tertiary text-sm mt-4">
                  Please check your inbox and click the link to reset your password.
                  The link will expire in 1 hour.
                </Paragraph>
                <Paragraph className="text-text-tertiary text-xs italic">
                  Don't see the email? Check your spam folder.
                </Paragraph>
              </div>
            }
            extra={[
              <Button
                key="back"
                type="primary"
                size="large"
                onClick={handleBackToLogin}
                className="w-full h-12 rounded-xl font-semibold shadow-lg shadow-primary/20"
              >
                Back to Login
              </Button>,
              <Button
                key="resend"
                type="text"
                size="large"
                onClick={() => setEmailSent(false)}
                className="mt-2 text-text-secondary hover:text-primary font-medium"
              >
                Try Different Email
              </Button>
            ]}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-gradient-to-br from-primary-50/30 to-background p-4">
      <Card 
        className="w-full max-w-md shadow-soft-lg rounded-2xl border border-border"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary flex items-center justify-center shadow-md">
              <MailOutlined className="text-3xl" />
            </div>
          </div>
          <Title level={2} className="!mb-1 text-text-primary">
            Forgot Password?
          </Title>
          <Text className="text-text-secondary text-base">
            No worries, we'll send you reset instructions
          </Text>
        </div>

        {/* Form */}
        <Form
          form={form}
          name="forgot-password"
          onFinish={handleSubmit}
          layout="vertical"
          size="large"
          className="mt-2"
        >
          <Form.Item
            name="email"
            label={<Text className="text-text-primary font-medium">Email Address</Text>}
            rules={[
              {
                required: true,
                message: 'Please enter your email address',
              },
              {
                type: 'email',
                message: 'Please enter a valid email address',
              },
            ]}
          >
            <Input
              prefix={<MailOutlined className="text-text-tertiary mr-2" />}
              placeholder="Enter your email"
              className="rounded-lg h-12"
            />
          </Form.Item>

          <Form.Item className="mb-4">
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              className="h-12 rounded-xl font-bold text-base shadow-lg shadow-primary/20"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </Form.Item>
        </Form>

        {/* Back to Login */}
        <div className="text-center">
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={handleBackToLogin}
            className="text-text-secondary hover:text-primary font-medium transition-all"
          >
            Back to Login
          </Button>
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-background-tertiary rounded-xl border border-border/50">
          <Text className="text-xs text-text-secondary leading-relaxed">
            <Text strong className="text-text-primary">Note:</Text> If you don't receive an email within 5 minutes, 
            please check your spam folder or try again.
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPassword;