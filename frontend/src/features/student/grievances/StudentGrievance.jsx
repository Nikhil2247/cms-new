import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  Table,
  Tag,
  Button,
  Typography,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Empty,
  Spin,
  Descriptions,
  Timeline,
  Alert,
  Divider,
  Row,
  Col,
  Badge,
} from "antd";
import {
  PlusOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  SendOutlined,
  AlertOutlined,
  CommentOutlined,
  UserOutlined,
  BankOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import API from "../../../services/api";
import toast from "react-hot-toast";
import Layouts from "../../../components/Layout";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export default function StudentGrievance() {
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [studentId, setStudentId] = useState(null);
  const [internships, setInternships] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [facultyMembers, setFacultyMembers] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [assignedMentor, setAssignedMentor] = useState(null);

  useEffect(() => {
    const loginData = localStorage.getItem("loginResponse");
    if (loginData) {
      try {
        const parsed = JSON.parse(loginData);
        setStudentId(parsed.user.studentId);
      } catch (e) {
        console.error("Failed to parse loginResponse:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (studentId) {
      fetchGrievances();
      fetchInternships();
      fetchAssignedMentor();
    }
  }, [studentId]);

  const fetchGrievances = async () => {
    try {
      setLoading(true);
      const response = await API.get(`/grievance/student/${studentId}`);
      setGrievances(response.data || []);
    } catch (error) {
      console.error("Error fetching grievances:", error);
      toast.error("Failed to load grievances");
    } finally {
      setLoading(false);
    }
  };

  const fetchInternships = async () => {
    try {
      const response = await API.get(
        `/internship-applications/my-applications`,
        {
          params: { studentId },
        }
      );

      // Check if response has the nested data structure
      const applications = response.data?.data || response.data || [];

      // Extract unique internships and industries
      const uniqueInternships = applications
        .filter((app) => app.internship)
        .map((app) => ({
          id: app.internship.id,
          title: app.internship.title,
          company: app.internship.industry?.companyName,
          industryId: app.internship.industry?.id,
        }));

      const uniqueIndustries = applications
        .filter((app) => app.internship?.industry)
        .map((app) => ({
          id: app.internship.industry.id,
          companyName: app.internship.industry.companyName,
        }))
        .filter(
          (industry, index, self) =>
            index === self.findIndex((i) => i.id === industry.id)
        );

      setInternships(uniqueInternships);
      setIndustries(uniqueIndustries);
    } catch (error) {
      console.error("Error fetching internships:", error);
      toast.error("Failed to load internships");
    }
  };

  const fetchFacultyMembers = async () => {
    try {
      const loginData = localStorage.getItem("loginResponse");
      const parsed = JSON.parse(loginData);
      const institutionId = parsed.user.institutionId;

      const response = await API.get(`/institutions/${institutionId}`);
      const users = response.data.users || [];

      const faculty = users.filter(
        (user) => user.role === "TEACHER" || user.role === "FACULTY_SUPERVISOR"
      );

      setFacultyMembers(faculty);
    } catch (error) {
      console.error("Error fetching faculty:", error);
    }
  };

  const fetchAssignableUsers = async () => {
    try {
      const loginData = localStorage.getItem("loginResponse");
      const parsed = JSON.parse(loginData);
      const institutionId = parsed.user.institutionId;

      const response = await API.get(`/grievance/assignable-users/list`, {
        params: { institutionId },
      });

      setAssignableUsers(response.data || []);
    } catch (error) {
      console.error("Error fetching assignable users:", error);
      toast.error("Failed to load assignable users");
    }
  };

  const fetchAssignedMentor = async () => {
    try {
      const response = await API.get(`/mentor/my-mentor`);
      const assignment = response.data?.data;

      if (assignment?.mentor) {
        setAssignedMentor(assignment.mentor);
      } else {
        setAssignedMentor(null);
      }
    } catch (error) {
      console.error("Error fetching assigned mentor:", error);
      setAssignedMentor(null);
    }
  };

  useEffect(() => {
    if (createModalVisible) {
      fetchFacultyMembers();
      fetchAssignableUsers();
    }
  }, [createModalVisible]);

  useEffect(() => {
    if (createModalVisible) {
      if (assignedMentor) {
        form.setFieldsValue({ assignedToId: assignedMentor.id, facultySupervisorId: assignedMentor.id });
      } else {
        form.setFieldsValue({ assignedToId: undefined, facultySupervisorId: undefined });
      }
    }
  }, [createModalVisible, assignedMentor, form]);

  const combinedAssignableUsers = useMemo(() => {
    if (!assignedMentor) {
      return assignableUsers;
    }

    const alreadyIncluded = assignableUsers.some(
      (user) => user.id === assignedMentor.id
    );

    return alreadyIncluded
      ? assignableUsers
      : [assignedMentor, ...assignableUsers];
  }, [assignedMentor, assignableUsers]);

  const handleOpenCreateModal = () => {
    if (!assignedMentor) {
      toast.error("Mentor not assigned yet. Please contact your institution.");
      return;
    }
    setCreateModalVisible(true);
  };

  const getStatusColor = (status) => {
    const statusColors = {
      SUBMITTED: "blue",
      UNDER_REVIEW: "orange",
      IN_PROGRESS: "processing",
      RESOLVED: "success",
      CLOSED: "default",
      ESCALATED: "red",
    };
    return statusColors[status] || "default";
  };

  const getSeverityColor = (severity) => {
    const colors = {
      LOW: "green",
      MEDIUM: "orange",
      HIGH: "red",
      CRITICAL: "purple",
    };
    return colors[severity] || "default";
  };

  const handleCreateGrievance = async (values) => {
    try {
      setSubmitting(true);

      const grievanceData = {
        studentId,
        ...values,
        submittedDate: new Date().toISOString(),
        status: "SUBMITTED",
      };

      await API.post("/grievance", grievanceData);

      toast.success("Grievance submitted successfully");
      setCreateModalVisible(false);
      form.resetFields();
      fetchGrievances();
    } catch (error) {
      console.error("Error creating grievance:", error);
      toast.error(
        error.response?.data?.message || "Failed to submit grievance"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openDetailModal = (grievance) => {
    setSelectedGrievance(grievance);
    setDetailModalVisible(true);
  };

  const columns = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      render: (category) => (
        <Tag color="blue">{category?.replace(/_/g, " ")}</Tag>
      ),
    },
    {
      title: "Severity",
      dataIndex: "severity",
      key: "severity",
      render: (severity) => (
        <Tag color={getSeverityColor(severity)}>{severity}</Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => (
        <Badge
          status={
            status === "RESOLVED"
              ? "success"
              : status === "ESCALATED"
              ? "error"
              : status === "IN_PROGRESS"
              ? "processing"
              : "default"
          }
          text={status.replace(/_/g, " ")}
        />
      ),
    },
    {
      title: "Submitted",
      dataIndex: "submittedDate",
      key: "submittedDate",
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => openDetailModal(record)}
        >
          View Details
        </Button>
      ),
    },
  ];

  return (
    <Layouts>
      <div className="h-full overflow-y-auto hide-scrollbar">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <Title level={2} className="!mb-1">
                {/* <AlertOutlined className="mr-2" /> */}
                My Grievances
              </Title>
              <Text type="secondary">
                Submit and track your internship-related concerns
              </Text>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="medium"
              onClick={handleOpenCreateModal}
            >
              Submit New Grievance
            </Button>
          </div>

          {/* Info Alert */}
          <Alert
            title="Grievance Support"
            description="Submit any concerns or issues you face during your internship. Our team will review and address them promptly."
            type="info"
            showIcon
            closable
          />

          {/* Grievances Table */}
          <Card className="border border-gray-200 shadow-sm !mt-3">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Spin size="small" />
              </div>
            ) : (
              <Table
                dataSource={grievances}
                columns={columns}
                rowKey="id"
                pagination={{
                  pageSize: 5,
                  showSizeChanger: true,
                  showTotal: (total) => `Total ${total} grievances`,
                }}
                locale={{
                  emptyText: (
                    <Empty
                      description="No grievances submitted yet"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    >
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleOpenCreateModal}
                      >
                        Submit Your First Grievance
                      </Button>
                    </Empty>
                  ),
                }}
              />
            )}
          </Card>

          {/* Create Grievance Modal */}
          <Modal
            title={
              <span>
                <FileTextOutlined className="mr-2" />
                Submit New Grievance
              </span>
            }
            open={createModalVisible}
            onCancel={() => {
              setCreateModalVisible(false);
              form.resetFields();
            }}
            footer={null}
            width={700}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleCreateGrievance}
              className="mt-4"
            >
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    name="title"
                    label="Grievance Title"
                    rules={[
                      { required: true, message: "Please enter a title" },
                      {
                        min: 10,
                        message: "Title must be at least 10 characters",
                      },
                    ]}
                  >
                    <Input
                      placeholder="Brief summary of your concern"
                      size="large"
                    />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="category"
                    label="Category"
                    rules={[
                      { required: true, message: "Please select a category" },
                    ]}
                  >
                    <Select placeholder="Select category" size="large">
                      <Option value="INTERNSHIP_RELATED">
                        Internship Related
                      </Option>
                      <Option value="MENTOR_RELATED">Mentor Related</Option>
                      <Option value="INDUSTRY_RELATED">Industry Related</Option>
                      <Option value="PAYMENT_ISSUE">Payment Issue</Option>
                      <Option value="WORKPLACE_HARASSMENT">
                        Workplace Harassment
                      </Option>
                      <Option value="WORK_CONDITION">Work Condition</Option>
                      <Option value="DOCUMENTATION">Documentation</Option>
                      <Option value="WORK_ENVIRONMENT">Work Environment</Option>
                      <Option value="HARASSMENT">Harassment</Option>
                      <Option value="SAFETY_CONCERN">Safety Concern</Option>
                      <Option value="DISCRIMINATION">Discrimination</Option>
                      <Option value="WORK_HOURS">Work Hours</Option>
                      <Option value="MENTORSHIP">Mentorship</Option>
                      <Option value="LEARNING_OPPORTUNITY">
                        Learning Opportunity
                      </Option>
                      <Option value="OTHER">Other</Option>
                    </Select>
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="severity"
                    label="Severity"
                    rules={[
                      { required: true, message: "Please select severity" },
                    ]}
                  >
                    <Select placeholder="Select severity" size="large">
                      <Option value="LOW">Low</Option>
                      <Option value="MEDIUM">Medium</Option>
                      <Option value="HIGH">High</Option>
                      <Option value="CRITICAL">Critical</Option>
                    </Select>
                  </Form.Item>
                </Col>

                {/* <Col span={12}>
                  <Form.Item name="internshipId" label="Related Internship">
                    <Select
                      placeholder="Select internship (optional)"
                      size="large"
                      allowClear
                      showSearch
                      optionFilterProp="children"
                    >
                      {internships.map((internship) => (
                        <Option key={internship.id} value={internship.id}>
                          {internship.title} - {internship.company}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col> */}
                {/* 
                <Col span={12}>
                  <Form.Item name="industryId" label="Related Company">
                    <Select
                      placeholder="Select company (optional)"
                      size="large"
                      allowClear
                      showSearch
                      optionFilterProp="children"
                    >
                      {industries.map((industry) => (
                        <Option key={industry.id} value={industry.id}>
                          {industry.companyName}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col> */}

                <Col span={12} className="!hidden">
                  <Form.Item
                    name="facultySupervisorId"
                    label="Faculty Supervisor"
                  >
                      <Select
                      placeholder="Select  Faculty Supervisor"
                      size="large"
                      showSearch
                      disabled
                      optionFilterProp="children"
                      filterOption={(input, option) =>
                        option.children
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                    >
                      {combinedAssignableUsers.map((user) => (
                        <Option key={user.id} value={user.id}>
                          {user.name} - {(user.role || "").replace(/_/g, " ")}
                          {assignedMentor && user.id === assignedMentor.id
                            ? " (Assigned Mentor)"
                            : ""}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item name="assignedToId" label="Assign To">
                    <Select
                      placeholder="Select Principal or Faculty to assign"
                      size="large"
                      showSearch
                      disabled
                      optionFilterProp="children"
                      filterOption={(input, option) =>
                        option.children
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                    >
                      {combinedAssignableUsers.map((user) => (
                        <Option key={user.id} value={user.id}>
                          {user.name} - {(user.role || "").replace(/_/g, " ")}
                          {assignedMentor && user.id === assignedMentor.id
                            ? " (Assigned Mentor)"
                            : ""}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="preferredContactMethod"
                    label="Preferred Contact"
                  >
                    <Select
                      placeholder="How should we contact you?"
                      size="large"
                    >
                      <Option value="EMAIL">Email</Option>
                      <Option value="PHONE">Phone</Option>
                      <Option value="IN_PERSON">In Person</Option>
                    </Select>
                  </Form.Item>
                </Col>

                <Col span={24}>
                  <Form.Item
                    name="description"
                    label="Detailed Description"
                    rules={[
                      {
                        required: true,
                        message: "Please describe your grievance",
                      },
                      {
                        min: 50,
                        message: "Description must be at least 50 characters",
                      },
                    ]}
                  >
                    <TextArea
                      rows={6}
                      placeholder="Provide detailed information about your concern..."
                    />
                  </Form.Item>
                </Col>

                <Col span={24}>
                  <Form.Item name="actionRequested" label="Action Requested">
                    <TextArea
                      rows={3}
                      placeholder="What would you like to happen? (Optional)"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => {
                    setCreateModalVisible(false);
                    form.resetFields();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SendOutlined />}
                  loading={submitting}
                >
                  Submit Grievance
                </Button>
              </div>
            </Form>
          </Modal>

          {/* Detail Modal */}
          <Modal
            title={
              <span>
                <FileTextOutlined className="mr-2" />
                Grievance Details
              </span>
            }
            open={detailModalVisible}
            onCancel={() => {
              setDetailModalVisible(false);
              setSelectedGrievance(null);
            }}
            footer={null}
            width={800}
          >
            {selectedGrievance && (
              <div className="space-y-4">
                {/* Status Banner */}
                <Alert
                  title={
                    <span className="font-semibold">
                      Status: {selectedGrievance.status.replace(/_/g, " ")}
                    </span>
                  }
                  description={
                    selectedGrievance.status === "RESOLVED"
                      ? "Your grievance has been resolved."
                      : selectedGrievance.status === "IN_PROGRESS"
                      ? "We are actively working on your grievance."
                      : "Your grievance is under review."
                  }
                  type={
                    selectedGrievance.status === "RESOLVED"
                      ? "success"
                      : selectedGrievance.status === "ESCALATED"
                      ? "error"
                      : "info"
                  }
                  showIcon
                />

                {/* Basic Information */}
                <Card size="small" title="Basic Information">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Title">
                      <Text strong>{selectedGrievance.title}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Category">
                      <Tag color="blue">
                        {selectedGrievance.category?.replace(/_/g, " ")}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Severity">
                      <Tag color={getSeverityColor(selectedGrievance.severity)}>
                        {selectedGrievance.severity}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Submitted Date">
                      {new Date(
                        selectedGrievance.submittedDate
                      ).toLocaleString()}
                    </Descriptions.Item>
                    {selectedGrievance.resolvedDate && (
                      <Descriptions.Item label="Resolved Date">
                        {new Date(
                          selectedGrievance.resolvedDate
                        ).toLocaleString()}
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>

                {/* Description */}
                <Card size="small" title="Description">
                  <Paragraph>{selectedGrievance.description}</Paragraph>
                </Card>

                {/* Action Requested */}
                {selectedGrievance.actionRequested && (
                  <Card size="small" title="Action Requested">
                    <Paragraph>{selectedGrievance.actionRequested}</Paragraph>
                  </Card>
                )}

                {/* Related Information */}
                {(selectedGrievance.internship ||
                  selectedGrievance.industry ||
                  selectedGrievance.facultySupervisor) && (
                  <Card size="small" title="Related Information">
                    <Descriptions column={1} size="small">
                      {selectedGrievance.internship && (
                        <Descriptions.Item
                          label="Internship"
                          icon={<BankOutlined />}
                        >
                          {selectedGrievance.internship.title}
                        </Descriptions.Item>
                      )}
                      {selectedGrievance.industry && (
                        <Descriptions.Item label="Company">
                          {selectedGrievance.industry.companyName}
                        </Descriptions.Item>
                      )}
                      {selectedGrievance.facultySupervisor && (
                        <Descriptions.Item label="Faculty Supervisor">
                          <Space>
                            <UserOutlined />
                            {selectedGrievance.facultySupervisor.name}
                          </Space>
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  </Card>
                )}

                {/* Resolution */}
                {selectedGrievance.resolution && (
                  <Card
                    size="small"
                    title="Resolution"
                    className="border-green-200 bg-green-50"
                  >
                    <Paragraph>{selectedGrievance.resolution}</Paragraph>
                  </Card>
                )}

                {/* Assigned To */}
                {selectedGrievance.assignedTo && (
                  <Card size="small" title="Assigned To">
                    <Space>
                      <TeamOutlined />
                      <Text>
                        {selectedGrievance.assignedTo.name} (
                        {selectedGrievance.assignedTo.role})
                      </Text>
                    </Space>
                  </Card>
                )}

                {/* Comments/Notes */}
                {selectedGrievance.comments && (
                  <Card size="small" title="Comments">
                    <Timeline
                      items={[
                        {
                          icon: <CommentOutlined />,
                          content: (
                            <>
                              <Text type="secondary">
                                {new Date(
                                  selectedGrievance.updatedAt ||
                                    selectedGrievance.submittedDate
                                ).toLocaleString()}
                              </Text>
                              <Paragraph className="mt-2">
                                {selectedGrievance.comments}
                              </Paragraph>
                            </>
                          ),
                        },
                      ]}
                    />
                  </Card>
                )}
              </div>
            )}
          </Modal>
        </div>
      </div>
    </Layouts>
  );
}