import {
  Button,
  Card,
  Form,
  Input,
  Typography,
  theme,
  Tabs,
} from "antd";
import {
  MailOutlined,
  LockOutlined,
  LoginOutlined,
  IdcardOutlined,
} from "@ant-design/icons";
import API from "../../../services/api";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { tokenStorage } from "../../../utils/tokenManager";

const { Text, Title } = Typography;

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("email");
  const { token } = theme.useToken();

  // Navigate based on role stored in the login response (role expected uppercase)
  const navigateByRole = (loginResp) => {
    let resp = loginResp;
    if (typeof resp === "string") {
      try {
        resp = JSON.parse(resp);
      } catch (e) {
        resp = {};
      }
    }

    const roleRaw =
      resp?.user?.role || resp?.role || (Array.isArray(resp?.roles) && resp.roles[0]) ||
      (Array.isArray(resp?.user?.roles) && resp.user.roles[0]);

    const role = (roleRaw || "").toString().toUpperCase();

    if (role === "TEACHER" || role === "FACULTY_SUPERVISOR") {
      navigate("/faculty/supervision");
    } else if (role === "PRINCIPAL") {
      navigate("/principal/analytics");
    } else if (role === "STUDENT") {
      navigate("/internships/dashboard");
    } else if (role === "STATE_DIRECTORATE") {
      navigate("/state/dashboard");
    } else {
      navigate("/main");
    }
  };

  const onFinishEmail = async (values) => {
    setLoading(true);
    try {
      const res = await API.post("/auth/login", values);
      tokenStorage.setToken(res.data.access_token);
      if (res.data.refresh_token || res.data.refreshToken) {
        tokenStorage.setRefreshToken(res.data.refresh_token || res.data.refreshToken);
      }
      toast.success("Login successful!");
      
      // Check if user needs to change password and redirect to change password page
      if (res.data.needsPasswordChange) {
        navigate("/change-password");
      } else {
        navigateByRole(res.data);
      }
    } catch (error) {
      console.error("Login error:", error);
      // Check for rate limiting (429 status code)
      if (error.response?.status === 429) {
        toast.error("Too many login attempts. Please wait a minute and try again.");
      } else {
        toast.error(
          error.response?.data?.message || 
          "Login failed. Please check your credentials."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const onFinishRollNumber = async (values) => {
    setLoading(true);
    try {
      const res = await API.post("/auth/student-login", values);
      tokenStorage.setToken(res.data.access_token);
      if (res.data.refresh_token || res.data.refreshToken) {
        tokenStorage.setRefreshToken(res.data.refresh_token || res.data.refreshToken);
      }
      toast.success("Login successful!");
      
      // Check if user needs to change password and redirect to change password page
      if (res.data.needsPasswordChange) {
        navigate("/change-password");
      } else {
        navigateByRole(res.data);
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error(
        error.response?.data?.message ||
          "Login failed. Please check your roll number and password."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get("token");
    const id = urlParams.get("id");
    const name = urlParams.get("name");
    const email = urlParams.get("email");
    const needsPasswordChange = urlParams.get("needsPasswordChange");

    if (token && id && name && email) {

      const loginResponse = {
        access_token: token,
        user: {
          id,
          name,
          email,
        },
      };

      // If role is present in query params (backend may include it), attach it
      const roleParam = urlParams.get("role");
      if (roleParam) {
        loginResponse.user.role = roleParam;
      }

      // Save token via centralized manager
      tokenStorage.setToken(token);

      toast.success("Welcome back!");
      
      // Check if user needs to change password and redirect to change password page
      if (needsPasswordChange === "true") {
        navigate("/change-password");
      } else {
        // Navigate after saving
        navigateByRole(loginResponse);
      }
    } else if (urlParams.get("error")) {
      console.error("❌ Google login failed");
      toast.error("Google login failed. Please try again.");
    }
  }, [location.search, navigate]);

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-background bg-gradient-to-br from-primary-50/30 to-background dark:from-primary-900/10"
    >
      <div className="w-full max-w-lg px-4 mt-5">
        {/* Header */}
        <div className="text-center mb-8">
          <Title level={2} className="text-text-primary mb-2">
            Portal Login
          </Title>
          <Text className="text-text-secondary">
            Access your academic dashboard and internship opportunities
          </Text>
        </div>

        {/* Form Card */}
        <Card className="rounded-xl shadow-soft-lg border border-border bg-surface">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            centered
            size="large"
            items={[
              {
                key: "email",
                label: (
                  <span>
                    <MailOutlined /> Email Login
                  </span>
                ),
                children: (
                  <Form onFinish={onFinishEmail} layout="vertical" size="large">
                    <Form.Item
                      name="email"
                      label={
                        <span className="text-text-primary">
                          Email Address
                        </span>
                      }
                      rules={[
                        { required: true, message: "Please enter your email" },
                      ]}
                    >
                      <Input
                        placeholder="Enter your student email address"
                        prefix={
                          <MailOutlined className="text-text-tertiary" />
                        }
                      />
                    </Form.Item>

                    <Form.Item
                      name="password"
                      label={
                        <span className="text-text-primary">Password</span>
                      }
                      rules={[
                        { required: true, message: "Please enter your password" },
                        {
                          min: 5,
                          message: "Password must be at least 6 characters",
                        },
                      ]}
                    >
                      <Input.Password
                        placeholder="Enter your password"
                        prefix={
                          <LockOutlined className="text-text-tertiary" />
                        }
                      />
                    </Form.Item>

                    <div className="text-right mb-4">
                      <Link
                        to="/forgot-password"
                        style={{
                          color: token.colorPrimary,
                          textDecoration: "none",
                          fontSize: "14px",
                        }}
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
                        icon={!loading && <LoginOutlined />}
                        className="h-12 font-medium"
                      >
                        {loading ? "Signing In..." : "Sign In with Email"}
                      </Button>
                    </Form.Item>
                  </Form>
                ),
              },
              {
                key: "rollNumber",
                label: (
                  <span>
                    <IdcardOutlined /> Registration Number
                  </span>
                ),
                children: (
                  <Form onFinish={onFinishRollNumber} layout="vertical" size="large">
                    <Form.Item
                      name="rollNumber"
                      label={
                        <span className="text-text-primary">
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
                          <IdcardOutlined
                            className="text-text-tertiary"
                          />
                        }
                      />
                    </Form.Item>

                    <Form.Item
                      name="password"
                      label={
                        <span className="text-text-primary">Password</span>
                      }
                      rules={[
                        { required: true, message: "Please enter your password" },
                        {
                          min: 5,
                          message: "Password must be at least 5 characters",
                        },
                      ]}
                    >
                      <Input.Password
                        placeholder="Enter your password"
                        prefix={
                          <LockOutlined className="text-text-tertiary" />
                        }
                      />
                    </Form.Item>

                    <div className="text-right mb-4">
                      <Link
                        to="/forgot-password"
                        style={{
                          color: token.colorPrimary,
                          textDecoration: "none",
                          fontSize: "14px",
                        }}
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
                        icon={!loading && <LoginOutlined />}
                        className="h-12 font-medium"
                      >
                        {loading ? "Signing In..." : "Sign In with Registration Number"}
                      </Button>
                    </Form.Item>
                  </Form>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

export default Login;