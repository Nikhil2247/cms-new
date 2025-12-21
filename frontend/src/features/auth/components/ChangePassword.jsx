import {
  Button,
  Card,
  Form,
  Input,
  Typography,
  theme,
  Alert,
} from "antd";
import {
  LockOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import API from "../../../services/api";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useThemeStyles } from "../../../hooks/useThemeStyles";

const { Text, Title } = Typography;

function ChangePassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const { token } = theme.useToken();
  const styles = useThemeStyles();

  // Navigate based on role after password change
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
      resp?.user?.role ||
      resp?.role ||
      (Array.isArray(resp?.roles) && resp.roles[0]) ||
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

  const onFinish = async (values) => {
    setLoading(true);
    try {
      // Call the change password API
      await API.put("/auth/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      toast.success("Password changed successfully!");

      // Get login response from localStorage to navigate
      const loginResponse = localStorage.getItem("loginResponse");
      if (loginResponse) {
        const parsedResponse = JSON.parse(loginResponse);
        // Update the needsPasswordChange flag in localStorage
        parsedResponse.needsPasswordChange = false;
        localStorage.setItem("loginResponse", JSON.stringify(parsedResponse));
        
        // Navigate to appropriate dashboard
        navigateByRole(parsedResponse);
      } else {
        // Fallback to main page
        navigate("/main");
      }
    } catch (error) {
      console.error("Password change error:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to change password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (_, value) => {
    if (!value) {
      return Promise.reject(new Error("Please enter your new password"));
    }
    if (value.length < 6) {
      return Promise.reject(
        new Error("Password must be at least 6 characters")
      );
    }
    if (value === form.getFieldValue("currentPassword")) {
      return Promise.reject(
        new Error("New password must be different from current password")
      );
    }
    return Promise.resolve();
  };

  const validateConfirmPassword = (_, value) => {
    if (!value) {
      return Promise.reject(new Error("Please confirm your password"));
    }
    if (value !== form.getFieldValue("newPassword")) {
      return Promise.reject(new Error("Passwords do not match"));
    }
    return Promise.resolve();
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-background bg-gradient-to-br from-primary-50/30 to-background"
    >
      <div className="w-full max-w-xl px-4 mt-5">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-16 h-16 flex items-center justify-center rounded-2xl bg-primary-50 text-primary text-3xl shadow-md">
            <SafetyOutlined />
          </div>
          <Title level={2} className="text-text-primary mb-2">
            Change Your Password
          </Title>
          <Text className="text-text-secondary text-base">
            For security reasons, please change your default password
          </Text>
        </div>

        {/* Form Card */}
        <Card className="rounded-xl shadow-soft-lg border border-border">
          <Alert
            message={<span className="font-semibold">Security Notice</span>}
            description="You are using a default password. Please create a strong, unique password to secure your account."
            type="warning"
            showIcon
            icon={<LockOutlined />}
            className="mb-6 rounded-xl border-warning/20 bg-warning-50/50"
          />

          <Form
            form={form}
            onFinish={onFinish}
            layout="vertical"
            size="large"
            className="mt-2"
          >
            <Form.Item
              name="currentPassword"
              label={
                <span className="text-text-primary font-medium">
                  Current Password
                </span>
              }
              rules={[
                { required: true, message: "Please enter your current password" },
              ]}
            >
              <Input.Password
                placeholder="Enter your current password"
                prefix={<LockOutlined className="text-primary mr-2" />}
                className="rounded-lg h-12"
              />
            </Form.Item>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="newPassword"
                label={
                  <span className="text-text-primary font-medium">New Password</span>
                }
                rules={[{ validator: validatePassword }]}
              >
                <Input.Password
                  placeholder="Enter new password"
                  prefix={<LockOutlined className="text-primary mr-2" />}
                  className="rounded-lg h-12"
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label={
                  <span className="text-text-primary font-medium">
                    Confirm Password
                  </span>
                }
                rules={[{ validator: validateConfirmPassword }]}
              >
                <Input.Password
                  placeholder="Confirm password"
                  prefix={<CheckCircleOutlined className="text-primary mr-2" />}
                  className="rounded-lg h-12"
                />
              </Form.Item>
            </div>

            <Form.Item className="mt-4 mb-0">
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                icon={!loading && <SafetyOutlined />}
                className="h-12 rounded-xl font-bold text-base shadow-lg shadow-primary/20"
              >
                {loading ? "Changing Password..." : "Change Password"}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
}

export default ChangePassword;