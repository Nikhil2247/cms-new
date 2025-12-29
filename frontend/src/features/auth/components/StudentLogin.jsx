import {
  Button,
  Card,
  Form,
  Input,
  Typography,
  Divider,
  theme,
} from "antd";
import {
  IdcardOutlined,
  LockOutlined,
  LoginOutlined,
  BookOutlined,
} from "@ant-design/icons";
import API from "../../../services/api";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "react-hot-toast";
import { tokenStorage } from "../../../utils/tokenManager";
import { setCredentials } from "../store/authSlice";

const { Text, Title } = Typography;

function StudentLogin() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const { token } = theme.useToken();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const res = await API.post("/auth/student-login", values);
      const accessToken = res.data.access_token;
      const refreshToken = res.data.refresh_token || res.data.refreshToken;

      // Store tokens
      tokenStorage.setToken(accessToken);
      if (refreshToken) {
        tokenStorage.setRefreshToken(refreshToken);
      }

      // Update Redux auth state
      dispatch(setCredentials({
        user: res.data.user,
        token: accessToken
      }));

      toast.success("Login successful!");
      navigate("/dashboard");
    } catch (error) {
      console.error("Login error:", error);
      // Check for rate limiting (429 status code)
      if (error.response?.status === 429) {
        toast.error("Too many login attempts. Please wait a minute and try again.");
      } else {
        toast.error(
          error.response?.data?.message ||
            "Login failed. Please check your roll number and password."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-background bg-gradient-to-br from-primary-50/30 to-background p-4"
    >
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-16 h-16 flex items-center justify-center rounded-2xl bg-primary-50 text-primary text-3xl shadow-md">
            <BookOutlined />
          </div>
          <Title level={2} className="text-text-primary mb-2">
            Student Portal Login
          </Title>
          <Text className="text-text-secondary text-base">
            Login with your roll number to access your dashboard
          </Text>
        </div>

        {/* Form Card */}
        <Card className="rounded-xl shadow-soft-lg border border-border overflow-hidden">
          <Form onFinish={onFinish} layout="vertical" size="large" className="mt-2">
            <Form.Item
              name="rollNumber"
              label={
                <span className="text-text-primary font-medium">
                  Registration Number
                </span>
              }
              rules={[
                {
                  required: true,
                  message: "Please enter your registration number",
                },
              ]}
            >
              <Input
                placeholder="Enter your Registration Number"
                prefix={
                  <IdcardOutlined className="text-text-tertiary mr-2" />
                }
                className="h-12 rounded-lg"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span className="text-text-primary font-medium">Password</span>}
              rules={[
                { required: true, message: "Please enter your password" },
                { min: 5, message: "Password must be at least 5 characters" },
              ]}
            >
              <Input.Password
                placeholder="Enter your password"
                prefix={<LockOutlined className="text-text-tertiary mr-2" />}
                className="h-12 rounded-lg"
              />
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
                block
                loading={loading}
                className="h-12 rounded-xl font-bold text-base shadow-lg shadow-primary/20"
              >
                {loading ? "Signing In..." : "Sign In with Roll Number"}
              </Button>
            </Form.Item>
          </Form>

          <Divider className="my-6 border-border">
            <span className="text-text-tertiary text-xs uppercase tracking-wider font-bold">Alternative Options</span>
          </Divider>

          <div className="text-center space-y-4">
            <p className="text-text-secondary text-sm">
              Want to login with email?{" "}
              <Link
                to="/login"
                className="text-primary hover:text-primary-600 font-bold no-underline"
              >
                Email Login
              </Link>
            </p>
            <p className="text-text-secondary text-sm">
              Don't have an account?{" "}
              <Link
                to="/student-signup"
                className="text-primary hover:text-primary-600 font-bold no-underline"
              >
                Create Account
              </Link>
            </p>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <Text className="text-text-tertiary text-sm">
            © 2025 College Management System
          </Text>
          <br />
          <Text className="text-text-tertiary text-xs">
            Empowering students for successful careers
          </Text>
        </div>
      </div>
    </div>
  );
}

export default StudentLogin;