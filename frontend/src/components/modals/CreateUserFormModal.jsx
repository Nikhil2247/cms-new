import React, { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
  Alert,
  Divider,
  Row,
  Col,
} from "antd";
import {
  UserAddOutlined,
  MailOutlined,
  PhoneOutlined,
  BankOutlined,
  TeamOutlined,
  KeyOutlined,
} from "@ant-design/icons";
import API from "../../services/api";
import { toast } from "react-hot-toast";

const { Option } = Select;
const { Title, Text } = Typography;

const CreateUserFormModal = ({
  visible,
  onCancel,
  onSuccess,
  institutionId = null,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [institutions, setInstitutions] = useState([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  const [selectedRole, setSelectedRole] = useState("TEACHER");
  const [generatedPassword, setGeneratedPassword] = useState("");

  useEffect(() => {
    if (visible) {
      fetchInstitutions();
      form.resetFields();
      setGeneratedPassword("");

      // Set institution if provided via prop or from localStorage
      const getInstitutionId = () => {
        if (institutionId) return institutionId;

        try {
          const loginResponse = localStorage.getItem("loginResponse");
          if (loginResponse) {
            const parsed = JSON.parse(loginResponse);
            return parsed.user?.institutionId;
          }
        } catch (error) {
          console.error("Error getting institution ID from localStorage:", error);
        }
        return null;
      };

      const instId = getInstitutionId();
      if (instId) {
        form.setFieldsValue({ institutionId: instId });
      }
    }
  }, [visible, institutionId]);

  const fetchInstitutions = async () => {
    setLoadingInstitutions(true);
    try {
      const response = await API.get("/institutions/minimal/list");
      // Filter out SD institution
      //   const filteredInstitutions = response.data.filter(
      //     (inst) => inst.shortName !== "SD"
      //   );
      setInstitutions(response.data);
    } catch (error) {
      console.error("Error fetching institutions:", error);
      toast.error("Failed to load institutions");
    } finally {
      setLoadingInstitutions(false);
    }
  };

  const generatePasswordPreview = (name, phoneNo) => {
    if (!name || !phoneNo || phoneNo.length < 4) return "";
    const namePart = name.replace(/\s+/g, "").substring(0, 4).toLowerCase();
    const phonePart = phoneNo.substring(0, 4);
    return `${namePart}@${phonePart}`;
  };

  const handleValuesChange = (changedValues, allValues) => {
    if (changedValues.role) {
      setSelectedRole(changedValues.role);
    }

    if (changedValues.name || changedValues.phoneNo) {
      const preview = generatePasswordPreview(
        allValues.name,
        allValues.phoneNo
      );
      setGeneratedPassword(preview);
    }
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      let response;
      const userData = {
        name: values.name,
        email: values.email,
        phoneNo: values.phoneNo,
        designation: values.designation,
        institutionId: values.institutionId,
        role: values.role,
        branchName: values.branchName,
      };

      if (values.role === "PRINCIPAL") {
        response = await API.post("/users/principal/create", userData);
      } else {
        // TEACHER or FACULTY_SUPERVISOR
        userData.role = values.role;
        response = await API.post("/users/staff/create", userData);
      }

      if (response.data.success) {
        const userType = values.role === "PRINCIPAL" ? "Principal" : "Staff";

        toast.success(
          `${userType} user created successfully! Password: ${response.data.data.password}`,
          {
            duration: 8000,
            icon: "🎉",
          }
        );

        toast.success(`Credentials sent to ${values.email}`, {
          duration: 5000,
          icon: "📧",
        });

        form.resetFields();
        setGeneratedPassword("");
        if (onSuccess) onSuccess();
        if (onCancel) onCancel();
      }
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error(error.response?.data?.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <Space className="text-primary">
          <UserAddOutlined className="text-xl" />
          <span className="font-semibold text-lg">Create New User</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={1000}
      destroyOnHidden
      className="rounded-xl overflow-hidden"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        onValuesChange={handleValuesChange}
        initialValues={{
          role: "TEACHER",
          institutionId: institutionId,
        }}
        className="mt-4"
      >
        <Divider orientation="left" className="!text-text-secondary !text-xs uppercase tracking-wider">User Role</Divider>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="role"
              label="Role"
              rules={[{ required: true, message: "Please select a role" }]}
            >
              <Select
                placeholder="Select role"
                size="large"
                className="rounded-lg"
                disabled={!!institutionId || (() => {
                  try {
                    const loginResponse = localStorage.getItem("loginResponse");
                    if (loginResponse) {
                      const parsed = JSON.parse(loginResponse);
                      return !!parsed.user?.institutionId;
                    }
                  } catch (error) {
                    console.error("Error checking institution ID:", error);
                  }
                  return false;
                })()}
              >
                <Option value="PRINCIPAL">
                  <TeamOutlined /> Principal
                </Option>
                <Option value="TEACHER">
                  <TeamOutlined /> Teacher
                </Option>
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="institutionId"
              label="Institution"
              rules={[
                { required: true, message: "Please select institution" },
              ]}
            >
              <Select
                placeholder="Select institution"
                size="large"
                className="rounded-lg"
                loading={loadingInstitutions}
                showSearch
                filterOption={(input, option) =>
                  option.children.toLowerCase().includes(input.toLowerCase())
                }
                disabled={!!institutionId || (() => {
                  try {
                    const loginResponse = localStorage.getItem("loginResponse");
                    if (loginResponse) {
                      const parsed = JSON.parse(loginResponse);
                      return !!parsed.user?.institutionId;
                    }
                  } catch (error) {
                    console.error("Error checking institution ID:", error);
                  }
                  return false;
                })()}
              >
                {institutions.map((inst) => (
                  <Option key={inst.id} value={inst.id}>
                    <BankOutlined /> {inst.name || inst.shortName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {selectedRole === "PRINCIPAL" && (
          <Alert
            message="Institutional Access"
            description="Only one principal is allowed per institution."
            type="warning"
            showIcon
            className="mb-6 rounded-xl border-warning/30 bg-warning-50/50"
          />
        )}

        <Divider orientation="left" className="!text-text-secondary !text-xs uppercase tracking-wider">Personal Information</Divider>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="name"
              label="Full Name"
              rules={[
                { required: true, message: "Please enter full name" },
                { min: 3, message: "Name must be at least 3 characters" },
              ]}
            >
              <Input
                prefix={<UserAddOutlined className="text-text-tertiary" />}
                placeholder="Enter full name"
                size="large"
                className="rounded-lg"
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="designation"
              label="Designation"
            >
              <Input
                placeholder={
                  selectedRole === "PRINCIPAL"
                    ? "Principal"
                    : "Senior Lecturer, HOD, etc."
                }
                size="large"
                className="rounded-lg"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="branchName"
              label="Branch Name"
            >
              <Select
                placeholder="Select branch"
                size="large"
                allowClear
                className="rounded-lg"
              >
                <Option value="CSE">CSE - Computer Science Engineering</Option>
                <Option value="ECE">ECE - Electronics & Communication</Option>
                <Option value="EE">EE - Electrical Engineering</Option>
                <Option value="MECH">MECH - Mechanical Engineering</Option>
                <Option value="CIVIL">CIVIL - Civil Engineering</Option>
                <Option value="CHEM">CHEM - Chemical Engineering</Option>
                <Option value="AS">AS - Applied Science</Option>
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="email"
              label="Email Address"
              rules={[
                { required: true, message: "Please enter email" },
                { type: "email", message: "Please enter valid email" },
              ]}
            >
              <Input
                prefix={<MailOutlined className="text-text-tertiary" />}
                placeholder="user@institution.edu"
                size="large"
                className="rounded-lg"
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="phoneNo"
              label="Phone Number"
              rules={[
                { required: true, message: "Please enter phone number" },
                {
                  pattern: /^[0-9]{10}$/,
                  message: "Phone number must be exactly 10 digits",
                },
              ]}
            >
              <Input
                prefix={<PhoneOutlined className="text-text-tertiary" />}
                placeholder="10-digit phone number"
                maxLength={10}
                size="large"
                className="rounded-lg"
              />
            </Form.Item>
          </Col>
        </Row>

        {generatedPassword && (
          <Alert
            message="Auto-generated Password"
            description={
              <div>
                <Text type="secondary">The password for this user will be: </Text>
                <Text code strong className="text-base text-primary">
                  <KeyOutlined /> {generatedPassword}
                </Text>
                <div className="mt-2 text-[11px] text-text-tertiary">
                  Format: First 4 letters of name + @ + First 4 digits of phone
                </div>
              </div>
            }
            type="info"
            showIcon
            className="mb-6 rounded-xl border-primary/20 bg-primary-50/10"
          />
        )}

        <Divider />

        <Form.Item className="!mb-0">
          <div className="flex justify-end gap-3">
            <Button onClick={onCancel} size="large" className="rounded-xl px-6">
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<UserAddOutlined />}
              size="large"
              className="rounded-xl px-8 shadow-lg shadow-primary/20"
            >
              Create {selectedRole === "PRINCIPAL" ? "Principal" : "User"}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateUserFormModal;