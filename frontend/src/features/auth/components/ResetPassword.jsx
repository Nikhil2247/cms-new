// src/components/ResetPassword.jsx
import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  Button, 
  Card, 
  Typography, 
  Space,
  Alert,
  Spin,
  Result,
  Progress
} from 'antd';
import { 
  LockOutlined, 
  CheckCircleOutlined,
  CloseCircleOutlined,
  SafetyOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone
} from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import API from '../../../services/api';
import { toast } from 'react-hot-toast';

const { Title, Text, Paragraph } = Typography;

const ResetPassword = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const navigate = useNavigate();
  
  // Get token from URL params or query string
  const { token: paramToken } = useParams();
  const [searchParams] = useSearchParams();
  const queryToken = searchParams.get('token');
  const token = paramToken || queryToken;

  useEffect(() => {
    if (token) {
      verifyToken();
    } else {
      setVerifying(false);
      setTokenError('No reset token provided');
    }
  }, [token]);

  const verifyToken = async () => {
    setVerifying(true);
    try {
      const response = await API.get(`/auth/verify-reset-token/${token}`);
      
      if (response.data.valid) {
        setTokenValid(true);
        setUserEmail(response.data.email);
      } else {
        setTokenValid(false);
        setTokenError('Invalid or expired reset token');
      }
    } catch (error) {
      console.error('Token verification error:', error);
      setTokenValid(false);
      setTokenError(
        error.response?.data?.message || 
        'Invalid or expired reset token'
      );
    } finally {
      setVerifying(false);
    }
  };

  const calculatePasswordStrength = (password) => {
    if (!password) return 0;
    
    let strength = 0;
    
    // Length check
    if (password.length >= 6) strength += 20;
    if (password.length >= 8) strength += 20;
    if (password.length >= 12) strength += 20;
    
    // Character variety checks
    if (/[a-z]/.test(password)) strength += 10;
    if (/[A-Z]/.test(password)) strength += 10;
    if (/[0-9]/.test(password)) strength += 10;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 10;
    
    return Math.min(strength, 100);
  };

  const getStrengthColor = (strength) => {
    if (strength < 40) return token.colorError;
    if (strength < 70) return token.colorWarning;
    return token.colorSuccess;
  };

  const getStrengthText = (strength) => {
    if (strength < 40) return 'Weak';
    if (strength < 70) return 'Medium';
    return 'Strong';
  };

  const handlePasswordChange = (e) => {
    const password = e.target.value;
    const strength = calculatePasswordStrength(password);
    setPasswordStrength(strength);
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const response = await API.post('/auth/reset-password', {
        token: token,
        newPassword: values.newPassword,
      });

      if (response.data.success) {
        setResetSuccess(true);
        toast.success('Password reset successfully!');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (error) {
      console.error('Reset password error:', error);
      toast.error(
        error.response?.data?.message || 
        'Failed to reset password. Please try again.'
      );
      
      // If token expired, show error
      if (error.response?.status === 400) {
        setTokenValid(false);
        setTokenError(error.response?.data?.message || 'Token has expired');
      }
    } finally {
      setLoading(false);
    }
  };

  // Loading state while verifying token
  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background bg-gradient-to-br from-primary-50/30 to-background">
        <Card className="w-full max-w-md shadow-soft-lg rounded-2xl border border-border text-center p-8">
          <Spin size="large" className="mb-6" />
          <Title level={4} className="text-text-primary mb-2">
            Verifying reset link...
          </Title>
          <Text className="text-text-secondary">
            Please wait while we verify your reset token
          </Text>
        </Card>
      </div>
    );
  }

  // Success state
  if (resetSuccess) {
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
                Password Reset Successfully!
              </Title>
            }
            subTitle={
              <div className="space-y-4">
                <Paragraph className="text-text-secondary text-center mb-0">
                  Your password has been changed successfully. You can now log in with your new password.
                </Paragraph>
                <Paragraph className="text-text-tertiary text-xs italic mt-4">
                  Redirecting to login page in 3 seconds...
                </Paragraph>
              </div>
            }
            extra={[
              <Button
                key="login"
                type="primary"
                size="large"
                onClick={() => navigate('/login')}
                className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20"
              >
                Go to Login
              </Button>
            ]}
          />
        </Card>
      </div>
    );
  }

  // Invalid token state
  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background bg-gradient-to-br from-primary-50/30 to-background p-4">
        <Card 
          className="w-full max-w-md shadow-soft-lg rounded-2xl border border-border overflow-hidden"
        >
          <Result
            status="error"
            icon={<div className="w-16 h-16 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto mb-4"><CloseCircleOutlined className="text-3xl" /></div>}
            title={
              <Title level={3} className="!mt-0 text-text-primary">
                Invalid Reset Link
              </Title>
            }
            subTitle={
              <div className="space-y-4 px-4">
                <Paragraph className="text-text-secondary text-center mb-0">
                  {tokenError || 'This password reset link is invalid or has expired.'}
                </Paragraph>
                <Paragraph className="text-text-tertiary text-xs italic">
                  Reset links expire after 1 hour for security reasons.
                </Paragraph>
              </div>
            }
            extra={[
              <Button
                key="forgot"
                type="primary"
                size="large"
                onClick={() => navigate('/forgot-password')}
                className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20"
              >
                Request New Link
              </Button>,
              <Button
                key="login"
                type="text"
                size="large"
                onClick={() => navigate('/login')}
                className="mt-2 text-text-secondary hover:text-primary font-medium"
              >
                Back to Login
              </Button>
            ]}
          />
        </Card>
      </div>
    );
  }

  // Reset password form
  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-gradient-to-br from-primary-50/30 to-background p-4">
      <Card 
        className="w-full max-w-md shadow-soft-lg rounded-2xl border border-border"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-success-50 text-success flex items-center justify-center shadow-md">
              <SafetyOutlined className="text-3xl" />
            </div>
          </div>
          <Title level={2} className="!mb-1 text-text-primary">
            Reset Password
          </Title>
          <Text className="text-text-secondary text-base">
            Enter your new password below
          </Text>
          {userEmail && (
            <div className="mt-3 py-1 px-3 bg-background-tertiary rounded-lg inline-block border border-border/50">
              <Text className="text-xs text-text-secondary uppercase tracking-wider">
                For: <Text strong className="text-text-primary">{userEmail}</Text>
              </Text>
            </div>
          )}
        </div>

        {/* Alert */}
        <Alert
          message={<span className="font-semibold">Security Tip</span>}
          description="Use at least 8 characters with a mix of uppercase, lowercase, numbers, and symbols."
          type="info"
          showIcon
          className="mb-8 rounded-xl border-primary/20 bg-primary-50/50"
        />

        {/* Form */}
        <Form
          form={form}
          name="reset-password"
          onFinish={handleSubmit}
          layout="vertical"
          size="large"
          className="mt-2"
        >
          <Form.Item
            name="newPassword"
            label={<Text className="text-text-primary font-medium">New Password</Text>}
            rules={[
              {
                required: true,
                message: 'Please enter your new password',
              },
              {
                min: 6,
                message: 'Password must be at least 6 characters',
              },
            ]}
            hasFeedback
          >
            <Input.Password
              prefix={<LockOutlined className="text-text-tertiary mr-2" />}
              placeholder="Enter new password"
              className="rounded-lg h-12"
              onChange={handlePasswordChange}
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          {/* Password Strength Indicator */}
          {passwordStrength > 0 && (
            <div className="mb-6 px-1">
              <div className="flex justify-between mb-1.5">
                <Text className="text-[10px] uppercase font-bold text-text-tertiary">Strength</Text>
                <Text className="text-[10px] uppercase font-bold" style={{ color: getStrengthColor(passwordStrength) }}>
                  {getStrengthText(passwordStrength)}
                </Text>
              </div>
              <Progress
                percent={passwordStrength}
                strokeColor={getStrengthColor(passwordStrength)}
                showInfo={false}
                size={4}
                className="mb-0"
              />
            </div>
          )}

          <Form.Item
            name="confirmPassword"
            label={<Text className="text-text-primary font-medium">Confirm New Password</Text>}
            dependencies={['newPassword']}
            hasFeedback
            rules={[
              {
                required: true,
                message: 'Please confirm your new password',
              },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-text-tertiary mr-2" />}
              placeholder="Confirm new password"
              className="rounded-lg h-12"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
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
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </Button>
          </Form.Item>
        </Form>

        {/* Security Tips */}
        <div className="mt-8 p-5 bg-warning-50/50 rounded-2xl border border-warning-border/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
              <SafetyOutlined className="text-xs" />
            </div>
            <Text strong className="text-xs uppercase tracking-widest text-warning-800">
              Security Best Practices
            </Text>
          </div>
          <ul className="text-xs text-text-secondary space-y-2 list-none p-0 m-0">
            <li className="flex items-start gap-2">
              <span className="text-success mt-0.5">✓</span>
              <span>Use a unique password you don't use elsewhere</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success mt-0.5">✓</span>
              <span>Include uppercase, lowercase, numbers & symbols</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success mt-0.5">✓</span>
              <span>Avoid common words or personal information</span>
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default ResetPassword;