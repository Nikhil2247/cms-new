import React, { useState } from 'react';
import { Form, Input, Button, Card, Select, Divider, Typography, theme } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined, BankOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../store/authSlice';
import toast from 'react-hot-toast';
import { USER_ROLES } from '../../../utils/constants';

const { Option } = Select;
const { Title, Text } = Typography;

const LoginForm = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading } = useSelector((state) => state.auth);
  const [form] = Form.useForm();
  const { token } = theme.useToken();

  const onFinish = async (values) => {
    try {
      const result = await dispatch(login(values)).unwrap();
      toast.success(`Welcome back, ${result.user.name}!`);
      navigate('/dashboard');
    } catch (error) {
      toast.error(error || 'Login failed');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background bg-gradient-to-br from-primary-50/30 to-background p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-16 h-16 flex items-center justify-center rounded-2xl bg-primary-50 text-primary text-3xl shadow-md">
            <BankOutlined />
          </div>
          <Title level={2} className="text-text-primary mb-2">
            Portal Login
          </Title>
          <Text className="text-text-secondary text-base">
            Access your administrative dashboard and tools
          </Text>
        </div>

        {/* Login Card */}
        <Card
          className="rounded-xl shadow-soft-lg border border-border overflow-hidden"
        >
          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            layout="vertical"
            size="large"
            initialValues={{ role: USER_ROLES.STATE }}
            requiredMark={false}
            className="mt-2"
          >
            <Form.Item
              name="email"
              label={<span className="font-medium text-text-primary">Email Address</span>}
              rules={[
                { required: true, message: 'Please enter your email' },
                { type: 'email', message: 'Please enter a valid email' },
              ]}
            >
              <Input
                prefix={<UserOutlined className="text-text-tertiary mr-2" />}
                placeholder="Enter your registered email"
                className="h-12 rounded-lg"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span className="font-medium text-text-primary">Password</span>}
              rules={[{ required: true, message: 'Please enter your password' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-text-tertiary mr-2" />}
                placeholder="Enter your password"
                className="h-12 rounded-lg"
              />
            </Form.Item>

            <Form.Item
              name="role"
              label={<span className="font-medium text-text-primary">Login As</span>}
              rules={[{ required: true, message: 'Please select your role' }]}
            >
              <Select
                placeholder="Select your role"
                className="h-12 rounded-lg"
                suffixIcon={<SafetyOutlined className="text-text-tertiary" />}
              >
                <Option value={USER_ROLES.STATE}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    State Admin
                  </div>
                </Option>
                <Option value={USER_ROLES.PRINCIPAL}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Principal
                  </div>
                </Option>
                <Option value={USER_ROLES.FACULTY}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Faculty
                  </div>
                </Option>
                <Option value={USER_ROLES.STUDENT}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    Student
                  </div>
                </Option>
                <Option value={USER_ROLES.INDUSTRY}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Industry Partner
                  </div>
                </Option>
              </Select>
            </Form.Item>

            <div className="text-right mb-4">
              <Link
                to="/forgot-password"
                className="text-primary hover:text-primary-600 font-medium text-sm no-underline"
              >
                Forgot Password?
              </Link>
            </div>

            <Form.Item className="mb-4">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                className="h-12 rounded-xl font-bold text-base shadow-lg shadow-primary/20"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </Form.Item>
          </Form>

          <Divider className="my-6 border-border">
            <span className="text-text-tertiary text-xs uppercase tracking-wider font-bold">Need Help?</span>
          </Divider>

          <div className="text-center space-y-4">
            <p className="text-text-secondary text-sm">
              Student?{' '}
              <Link to="/student-login" className="text-primary hover:text-primary-700 font-bold no-underline">
                Login here
              </Link>
            </p>
            <p className="text-text-tertiary text-xs leading-relaxed">
              By signing in, you agree to our{' '}
              <a href="#" className="text-primary hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-primary hover:underline">Privacy Policy</a>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LoginForm;