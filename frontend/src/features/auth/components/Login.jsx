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
  UserOutlined,
} from "@ant-design/icons";
import API from "../../../services/api";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "react-hot-toast";
import { tokenStorage } from "../../../utils/tokenManager";
import { setCredentials } from "../store/authSlice";

const { Text, Title } = Typography;

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("email");
  const { token } = theme.useToken();

  // Navigate to dashboard after login - DashboardRouter handles role-based routing
  const navigateByRole = () => {
    navigate("/dashboard");
  };

  const onFinishEmail = async (values) => {
    setLoading(true);
    try {
      const res = await API.post("/auth/login", values);
      const accessToken = res.data.access_token;
      const refreshToken = res.data.refresh_token || res.data.refreshToken;

      // Store tokens
      tokenStorage.setToken(accessToken);
      if (refreshToken) {
        tokenStorage.setRefreshToken(refreshToken);
      }

      // Store login response in localStorage for components that need user data
      localStorage.setItem("loginResponse", JSON.stringify(res.data));

      // Update Redux auth state
      dispatch(setCredentials({
        user: res.data.user,
        token: accessToken
      }));

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
      const accessToken = res.data.access_token;
      const refreshToken = res.data.refresh_token || res.data.refreshToken;

      // Store tokens
      tokenStorage.setToken(accessToken);
      if (refreshToken) {
        tokenStorage.setRefreshToken(refreshToken);
      }

      // Store login response in localStorage for components that need user data
      localStorage.setItem("loginResponse", JSON.stringify(res.data));

      // Update Redux auth state
      dispatch(setCredentials({
        user: res.data.user,
        token: accessToken
      }));

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
    const accessToken = urlParams.get("token");
    const id = urlParams.get("id");
    const name = urlParams.get("name");
    const email = urlParams.get("email");
    const needsPasswordChange = urlParams.get("needsPasswordChange");

    if (accessToken && id && name && email) {
      const user = {
        id,
        name,
        email,
      };

      // If role is present in query params (backend may include it), attach it
      const roleParam = urlParams.get("role");
      if (roleParam) {
        user.role = roleParam;
      }

      // Get institutionId if present
      const institutionIdParam = urlParams.get("institutionId");
      if (institutionIdParam) {
        user.institutionId = institutionIdParam;
      }

      // Save token via centralized manager
      tokenStorage.setToken(accessToken);

      // Store login response in localStorage for components that need user data
      localStorage.setItem("loginResponse", JSON.stringify({
        user,
        access_token: accessToken
      }));

      // Update Redux auth state
      dispatch(setCredentials({
        user,
        token: accessToken
      }));

      toast.success("Welcome back!");

      // Check if user needs to change password and redirect to change password page
      if (needsPasswordChange === "true") {
        navigate("/change-password");
      } else {
        // Navigate after saving
        navigateByRole();
      }
    } else if (urlParams.get("error")) {
      console.error("❌ Google login failed");
      toast.error("Google login failed. Please try again.");
    }
  }, [location.search, navigate, dispatch]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-white dark:from-slate-900 dark:via-slate-800 dark:to-slate-950 p-4 relative overflow-hidden">
      
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-200/20 dark:bg-blue-900/10 rounded-full blur-[100px]" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] bg-indigo-200/20 dark:bg-indigo-900/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-[10%] left-[20%] w-[30%] h-[30%] bg-purple-200/20 dark:bg-purple-900/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md z-10">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface shadow-xl shadow-blue-100/50 dark:shadow-none mb-6">
            <UserOutlined className="text-3xl text-blue-600 dark:text-blue-400" />
          </div>
          <Title level={2} className="!mb-2 !text-gray-900 dark:!text-white !font-bold tracking-tight">
            Welcome Back
          </Title>
          <Text className="text-gray-500 dark:text-slate-400 text-base">
            Access your academic dashboard and manage your journey
          </Text>
        </div>

        {/* Form Card */}
        <Card 
          bordered={false}
          className="rounded-3xl shadow-2xl shadow-gray-200/50 dark:shadow-black/50 bg-surface/80 backdrop-blur-xl border border-white/20 overflow-hidden animate-slide-up"
          styles={{ body: { padding: '32px' } }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            centered
            size="large"
            className="custom-tabs mb-6"
            items={[
              {
                key: "email",
                label: (
                  <span className="flex items-center gap-2 px-2">
                    <MailOutlined /> Staff/Faculty
                  </span>
                ),
                children: (
                  <Form onFinish={onFinishEmail} layout="vertical" size="large" className="mt-4">
                    <Form.Item
                      name="email"
                      label={<span className="font-medium text-gray-700 dark:text-slate-300">Email Address</span>}
                      rules={[{ required: true, message: "Please enter your email" }]}
                    >
                      <Input
                        placeholder="Enter your email address"
                        prefix={<MailOutlined className="text-gray-400" />}
                        className="rounded-xl h-12 bg-background-secondary border-border hover:bg-surface focus:bg-surface transition-all"
                      />
                    </Form.Item>

                    <Form.Item
                      name="password"
                      label={<span className="font-medium text-gray-700 dark:text-slate-300">Password</span>}
                      rules={[
                        { required: true, message: "Please enter your password" },
                      ]}
                    >
                      <Input.Password
                        placeholder="Enter your password"
                        prefix={<LockOutlined className="text-gray-400" />}
                        className="rounded-xl h-12 bg-background-secondary border-border hover:bg-surface focus:bg-surface transition-all"
                      />
                    </Form.Item>

                    <div className="flex justify-end mb-6">
                      <Link
                        to="/forgot-password"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm transition-colors"
                      >
                        Forgot Password?
                      </Link>
                    </div>

                    <Form.Item className="mb-2">
                      <Button
                        type="primary"
                        htmlType="submit"
                        block
                        loading={loading}
                        icon={!loading && <LoginOutlined />}
                        className="h-12 rounded-xl font-bold text-base shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all transform hover:-translate-y-0.5"
                      >
                        {loading ? "Signing In..." : "Sign In"}
                      </Button>
                    </Form.Item>
                  </Form>
                ),
              },
              {
                key: "rollNumber",
                label: (
                  <span className="flex items-center gap-2 px-2">
                    <IdcardOutlined /> Student
                  </span>
                ),
                children: (
                  <Form onFinish={onFinishRollNumber} layout="vertical" size="large" className="mt-4">
                    <Form.Item
                      name="rollNumber"
                      label={<span className="font-medium text-gray-700 dark:text-slate-300">Registration Number</span>}
                      rules={[{ required: true, message: "Please enter your registration number" }]}
                    >
                      <Input
                        placeholder="Enter your registration number"
                        prefix={<IdcardOutlined className="text-gray-400" />}
                        className="rounded-xl h-12 bg-background-secondary border-border hover:bg-surface focus:bg-surface transition-all"
                      />
                    </Form.Item>

                    <Form.Item
                      name="password"
                      label={<span className="font-medium text-gray-700 dark:text-slate-300">Password</span>}
                      rules={[
                        { required: true, message: "Please enter your password" },
                        { min: 5, message: "Password must be at least 5 characters" },
                      ]}
                    >
                      <Input.Password
                        placeholder="Enter your password"
                        prefix={<LockOutlined className="text-gray-400" />}
                        className="rounded-xl h-12 bg-background-secondary border-border hover:bg-surface focus:bg-surface transition-all"
                      />
                    </Form.Item>

                    <div className="flex justify-end mb-6">
                      <Link
                        to="/forgot-password"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm transition-colors"
                      >
                        Forgot Password?
                      </Link>
                    </div>

                    <Form.Item className="mb-2">
                      <Button
                        type="primary"
                        htmlType="submit"
                        block
                        loading={loading}
                        icon={!loading && <LoginOutlined />}
                        className="h-12 rounded-xl font-bold text-base shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all transform hover:-translate-y-0.5"
                      >
                        {loading ? "Signing In..." : "Student Login"}
                      </Button>
                    </Form.Item>
                  </Form>
                ),
              },
            ]}
          />
        </Card>
        
        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500 dark:text-slate-500">
          Having trouble accessing your account? <br />
          <Link to="/support" className="text-gray-700 dark:text-slate-400 font-semibold hover:underline">Contact Support</Link>
        </div>
      </div>
    </div>
  );
}

export default Login;