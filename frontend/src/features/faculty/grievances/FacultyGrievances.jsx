import React, { useState, useEffect } from "react";
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
  Tabs,
} from "antd";
import {
  EyeOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  AlertOutlined,
  FileTextOutlined,
  UserOutlined,
  BankOutlined,
  TeamOutlined,
  CommentOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import API from "../../../services/api";
import toast from "react-hot-toast";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

export default function FacultyGrievances() {
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [escalateModalVisible, setEscalateModalVisible] = useState(false);
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [updateForm] = Form.useForm();
  const [escalateForm] = Form.useForm();
  const [updating, setUpdating] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState("");
  const [institutionId, setInstitutionId] = useState(null);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    escalated: 0,
  });
  const [escalationHistory, setEscalationHistory] = useState(null);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);

  useEffect(() => {
    const loginData = localStorage.getItem("loginResponse");
    if (loginData) {
      try {
        const parsed = JSON.parse(loginData);
        setUserId(parsed.user.id);
        setUserName(parsed.user.name);
        setInstitutionId(parsed.user.institutionId);
      } catch (e) {
        console.error("Failed to parse loginResponse:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (userId && institutionId) {
      fetchGrievances();
      fetchAssignableUsers();
    }
  }, [userId, institutionId]);

  const fetchGrievances = async () => {
    try {
      setLoading(true);
      // Use the new faculty-specific endpoint
      const response = await API.get(`/grievance/faculty/${userId}`, {
        params: { institutionId }
      });
      const assignedGrievances = response.data || [];

      setGrievances(assignedGrievances);

      // Calculate stats
      const stats = {
        total: assignedGrievances.length,
        pending: assignedGrievances.filter(
          (g) => g.status === "PENDING" || g.status === "SUBMITTED"
        ).length,
        inProgress: assignedGrievances.filter(
          (g) => g.status === "IN_PROGRESS" || g.status === "UNDER_REVIEW"
        ).length,
        resolved: assignedGrievances.filter((g) => g.status === "RESOLVED").length,
        escalated: assignedGrievances.filter((g) => g.status === "ESCALATED").length,
      };

      setStats(stats);
    } catch (error) {
      console.error("Error fetching grievances:", error);
      toast.error("Failed to load grievances");
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignableUsers = async () => {
    try {
      if (!institutionId) return;

      // Use the grievance service endpoint
      const response = await API.get(`/grievance/assignable-users/list`, {
        params: { institutionId }
      });

      setAssignableUsers(response.data || []);
    } catch (error) {
      console.error("Error fetching assignable users:", error);
      toast.error("Failed to load assignable users");
    }
  };

  const getStatusColor = (status) => {
    const statusColors = {
      SUBMITTED: "blue",
      PENDING: "orange",
      UNDER_REVIEW: "cyan",
      IN_PROGRESS: "processing",
      RESOLVED: "success",
      CLOSED: "default",
      ESCALATED: "red",
      ADDRESSED: "green",
      REJECTED: "red",
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

  const handleUpdateGrievance = async (values) => {
    try {
      setUpdating(true);

      const updateData = {
        ...values,
        addressedDate:
          values.status === "ADDRESSED" ? new Date().toISOString() : undefined,
        resolvedDate:
          values.status === "RESOLVED" ? new Date().toISOString() : undefined,
      };

      await API.put(`/grievance/${selectedGrievance.id}`, updateData);

      toast.success("Grievance updated successfully");
      setUpdateModalVisible(false);
      updateForm.resetFields();
      setSelectedGrievance(null);
      fetchGrievances();
    } catch (error) {
      console.error("Error updating grievance:", error);
      toast.error(
        error.response?.data?.message || "Failed to update grievance"
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleEscalateGrievance = async (values) => {
    try {
      setEscalating(true);

      await API.put(`/grievance/${selectedGrievance.id}/escalate`, {
        assignedToId: values.assignedToId,
        escalatedById: userId, // Add the current user who is escalating
        escalationNote: values.escalationNote,
      });

      toast.success("Grievance escalated successfully");
      setEscalateModalVisible(false);
      escalateForm.resetFields();
      setSelectedGrievance(null);
      fetchGrievances();
    } catch (error) {
      console.error("Error escalating grievance:", error);
      toast.error(
        error.response?.data?.message || "Failed to escalate grievance"
      );
    } finally {
      setEscalating(false);
    }
  };

  const fetchEscalationHistory = async (grievanceId) => {
    try {
      const response = await API.get(`/grievance/${grievanceId}/escalation-history`);
      setEscalationHistory(response.data);
      setHistoryModalVisible(true);
    } catch (error) {
      console.error("Error fetching escalation history:", error);
      toast.error("Failed to load escalation history");
    }
  };

  const openDetailModal = (grievance) => {
    setSelectedGrievance(grievance);
    setDetailModalVisible(true);
  };

  const openUpdateModal = (grievance) => {
    setSelectedGrievance(grievance);
    updateForm.setFieldsValue({
      status: grievance.status,
      resolution: grievance.resolution || "",
      comments: grievance.comments || "",
    });
    setUpdateModalVisible(true);
  };

  const openEscalateModal = (grievance) => {
    setSelectedGrievance(grievance);
    escalateForm.setFieldsValue({
      assignedToId: grievance.assignedToId || undefined,
      escalationNote: "",
    });
    setEscalateModalVisible(true);
  };

  const columns = [
    {
      title: "Priority",
      dataIndex: "severity",
      key: "severity",
      width: 100,
      render: (severity) => (
        <Tag
          color={getSeverityColor(severity)}
          icon={
            severity === "CRITICAL" || severity === "HIGH" ? (
              <WarningOutlined />
            ) : null
          }
        >
          {severity}
        </Tag>
      ),
      sorter: (a, b) => {
        const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      },
    },
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: "Student",
      dataIndex: ["student", "user", "name"],
      key: "student",
      render: (name, record) => (
        <Space direction="vertical" size={0}>
          <Text>{name || record.student?.name || "N/A"}</Text>
          <Text type="secondary" className="text-xs">
            {record.student?.rollNumber}
          </Text>
        </Space>
      ),
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
              : status === "IN_PROGRESS" || status === "UNDER_REVIEW"
              ? "processing"
              : "default"
          }
          text={status.replace(/_/g, " ")}
        />
      ),
      filters: [
        { text: "Submitted", value: "SUBMITTED" },
        { text: "Pending", value: "PENDING" },
        { text: "Under Review", value: "UNDER_REVIEW" },
        { text: "In Progress", value: "IN_PROGRESS" },
        { text: "Resolved", value: "RESOLVED" },
        { text: "Escalated", value: "ESCALATED" },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: "Submitted",
      dataIndex: "submittedDate",
      key: "submittedDate",
      render: (date) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.submittedDate) - new Date(b.submittedDate),
    },
    {
      title: "Action",
      key: "action",
      fixed: "right",
      width: 300,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => openDetailModal(record)}
            size="small"
          >
            View
          </Button>
          {/* Only show Update and Escalate buttons if grievance is assigned to current user */}
          {record.assignedToId === userId && (
            <>
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => openUpdateModal(record)}
                size="small"
              >
                Update
              </Button>
              <Button
                danger
                icon={<AlertOutlined />}
                onClick={() => openEscalateModal(record)}
                size="small"
              >
                Escalate
              </Button>
            </>
          )}
          {record.escalationCount > 0 && (
            <Button
              icon={<ClockCircleOutlined />}
              onClick={() => fetchEscalationHistory(record.id)}
              size="small"
            >
              History ({record.escalationCount})
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const filteredGrievances = (status) => {
    if (status === "all") return grievances;
    if (status === "pending")
      return grievances.filter(
        (g) => g.status === "SUBMITTED" || g.status === "PENDING"
      );
    if (status === "inProgress")
      return grievances.filter(
        (g) => g.status === "IN_PROGRESS" || g.status === "UNDER_REVIEW"
      );
    if (status === "resolved")
      return grievances.filter((g) => g.status === "RESOLVED");
    if (status === "escalated")
      return grievances.filter((g) => g.status === "ESCALATED");
    return grievances;
  };

  return (
    <>
      <div className="h-full overflow-y-auto hide-scrollbar py-4">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <Title level={2} className="!mb-1">
                {/* <AlertOutlined className="mr-2" /> */}
                Assigned Grievances
              </Title>
              <Text type="secondary">
                Manage and resolve grievances assigned to you
              </Text>
            </div>
          </div>

          {/* Statistics Cards */}
          <Row gutter={[16, 16]} className="mb-5">
            <Col xs={24} sm={12} lg={8} xl={5}>
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm border-0 hover:shadow-md transition-all duration-200 h-full">
                <div className="text-center">
                  <div className="mx-auto w-14 h-14 rounded-full bg-blue-200 flex items-center justify-center mb-3">
                    <FileTextOutlined className="text-2xl !text-blue-700" />
                  </div>
                  <Text className="text-gray-600 text-xs font-semibold uppercase tracking-wide block mb-2">
                    Total Grievances
                  </Text>
                  <div className="text-4xl font-bold text-blue-700 mb-2">
                    {stats.total}
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8} xl={5}>
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-sm border-0 hover:shadow-md transition-all duration-200 h-full">
                <div className="text-center">
                  <div className="mx-auto w-14 h-14 rounded-full bg-orange-200 flex items-center justify-center mb-3">
                    <ClockCircleOutlined className="text-2xl !text-orange-700" />
                  </div>
                  <Text className="text-gray-600 text-xs font-semibold uppercase tracking-wide block mb-2">
                    Pending
                  </Text>
                  <div className="text-4xl font-bold text-orange-700 mb-2">
                    {stats.pending}
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8} xl={5}>
              <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl shadow-sm border-0 hover:shadow-md transition-all duration-200 h-full">
                <div className="text-center">
                  <div className="mx-auto w-14 h-14 rounded-full bg-cyan-200 flex items-center justify-center mb-3">
                    <ExclamationCircleOutlined className="text-2xl !text-cyan-700" />
                  </div>
                  <Text className="text-gray-600 text-xs font-semibold uppercase tracking-wide block mb-2">
                    In Progress
                  </Text>
                  <div className="text-4xl font-bold text-cyan-700 mb-2">
                    {stats.inProgress}
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8} xl={5}>
              <Card className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border-0 hover:shadow-md transition-all duration-200 h-full">
                <div className="text-center">
                  <div className="mx-auto w-14 h-14 rounded-full bg-green-200 flex items-center justify-center mb-3">
                    <CheckCircleOutlined className="text-2xl !text-green-700" />
                  </div>
                  <Text className="text-gray-600 text-xs font-semibold uppercase tracking-wide block mb-2">
                    Resolved
                  </Text>
                  <div className="text-4xl font-bold text-green-700 mb-2">
                    {stats.resolved}
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8} xl={4}>
              <Card className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-sm border-0 hover:shadow-md transition-all duration-200 h-full">
                <div className="text-center">
                  <div className="mx-auto w-14 h-14 rounded-full bg-red-200 flex items-center justify-center mb-3">
                    <WarningOutlined className="text-2xl !text-red-700" />
                  </div>
                  <Text className="text-gray-600 text-xs font-semibold uppercase tracking-wide block mb-2">
                    Escalated
                  </Text>
                  <div className="text-4xl font-bold text-red-700 mb-2">
                    {stats.escalated}
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* Info Alert */}
          {/* {stats.pending > 0 && (
            <Alert
              title={`You have ${stats.pending} pending grievance${
                stats.pending > 1 ? "s" : ""
              } requiring attention`}
              type="warning"
              showIcon
              closable
            />
          )} */}

          {/* Grievances Table with Tabs */}
          <Card className="border border-gray-200 shadow-sm">
            <Tabs defaultActiveKey="all">
              <TabPane tab={`All (${stats.total})`} key="all">
                {loading ? (
                  <div className="flex justify-center items-center py-12">
                    <Spin size="small" />
                  </div>
                ) : (
                  <Table
                    dataSource={filteredGrievances("all")}
                    columns={columns}
                    rowKey="id"
                    scroll={{ x: "max-content" }}
                    pagination={{
                      pageSize: 5,
                      showSizeChanger: true,
                      showTotal: (total) => `Total ${total} grievances`,
                    }}
                    locale={{
                      emptyText: (
                        <Empty
                          description="No grievances assigned to you"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      ),
                    }}
                  />
                )}
              </TabPane>
              <TabPane tab={`Pending (${stats.pending})`} key="pending">
                <Table
                  dataSource={filteredGrievances("pending")}
                  columns={columns}
                  rowKey="id"
                    scroll={{ x: "max-content" }}
                  pagination={{
                    pageSize: 5,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} grievances`,
                  }}
                  locale={{
                    emptyText: (
                      <Empty
                        description="No pending grievances"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    ),
                  }}
                />
              </TabPane>
              <TabPane
                tab={`In Progress (${stats.inProgress})`}
                key="inProgress"
              >
                <Table
                  dataSource={filteredGrievances("inProgress")}
                  columns={columns}
                  rowKey="id"
                  scroll={{ x: "max-content" }}
                  pagination={{
                    pageSize: 5,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} grievances`,
                  }}
                  locale={{
                    emptyText: (
                      <Empty
                        description="No grievances in progress"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    ),
                  }}
                />
              </TabPane>
              <TabPane tab={`Resolved (${stats.resolved})`} key="resolved">
                <Table
                  dataSource={filteredGrievances("resolved")}
                  columns={columns}
                  rowKey="id"
                  scroll={{ x: "max-content" }}
                  pagination={{
                    pageSize: 5,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} grievances`,
                  }}
                  locale={{
                    emptyText: (
                      <Empty
                        description="No resolved grievances"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    ),
                  }}
                />
              </TabPane>
              <TabPane tab={`Escalated (${stats.escalated})`} key="escalated">
                <Table
                  dataSource={filteredGrievances("escalated")}
                  columns={columns}
                  rowKey="id"
                  scroll={{ x: "max-content" }}
                  pagination={{
                    pageSize: 5,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} grievances`,
                  }}
                  locale={{
                    emptyText: (
                      <Empty
                        description="No escalated grievances"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    ),
                  }}
                />
              </TabPane>
            </Tabs>
          </Card>

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
            footer={[
              <Button
                key="close"
                onClick={() => {
                  setDetailModalVisible(false);
                  setSelectedGrievance(null);
                }}
              >
                Close
              </Button>,
              // Only show Update Status button if the grievance is still assigned to this user
              selectedGrievance?.assignedToId === userId && (
                <Button
                  key="update"
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setDetailModalVisible(false);
                    openUpdateModal(selectedGrievance);
                  }}
                >
                  Update Status
                </Button>
              ),
            ].filter(Boolean)}
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
                      ? "This grievance has been resolved."
                      : selectedGrievance.status === "ESCALATED"
                      ? `This grievance has been escalated ${selectedGrievance.escalationCount || 1} time${selectedGrievance.escalationCount > 1 ? "s" : ""}.`
                      : selectedGrievance.status === "IN_PROGRESS"
                      ? "You are actively working on this grievance."
                      : "This grievance is awaiting action."
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

                {/* Not Assigned to Current User Info */}
                {selectedGrievance.assignedToId !== userId && (
                  <Alert
                    title="View Only"
                    description={
                      <Space direction="vertical" size="small">
                        <Text>
                          This grievance is currently assigned to{" "}
                          <Text strong>{selectedGrievance.assignedTo?.name}</Text>
                          {selectedGrievance.assignedTo?.role && (
                            <Text type="secondary">
                              {" "}({selectedGrievance.assignedTo.role.replace(/_/g, " ")})
                            </Text>
                          )}
                        </Text>
                        <Text type="secondary">
                          You can view this grievance but cannot update its status.
                        </Text>
                      </Space>
                    }
                    type="info"
                    showIcon
                    className="mt-2"
                  />
                )}

                {/* Escalation Info */}
                {selectedGrievance.escalationCount > 0 && (
                  <Alert
                    title={
                      <div className="flex justify-between items-center">
                        <span>
                          <WarningOutlined className="mr-2" />
                          Escalation Information
                        </span>
                        <Button
                          size="small"
                          type="link"
                          onClick={() => fetchEscalationHistory(selectedGrievance.id)}
                        >
                          View Full History ({selectedGrievance.escalationCount})
                        </Button>
                      </div>
                    }
                    description={
                      <Space direction="vertical" size="small">
                        {selectedGrievance.escalatedAt && (
                          <Text type="secondary">
                            Last escalated: {new Date(selectedGrievance.escalatedAt).toLocaleString()}
                          </Text>
                        )}
                        {selectedGrievance.previousAssignees && selectedGrievance.previousAssignees.length > 0 && (
                          <div>
                            <Text type="secondary">Previously handled by: </Text>
                            <Text strong>{selectedGrievance.previousAssignees.length} staff member(s)</Text>
                          </div>
                        )}
                      </Space>
                    }
                    type="warning"
                    showIcon
                    className="mt-2"
                  />
                )}

                {/* Student Information */}
                <Card size="small" title="Student Information">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Name">
                      <Text strong>
                        {selectedGrievance.student?.user?.name ||
                          selectedGrievance.student?.name ||
                          "N/A"}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Roll Number">
                      {selectedGrievance.student?.rollNumber}
                    </Descriptions.Item>
                    <Descriptions.Item label="Email">
                      {selectedGrievance.student?.user?.email ||
                        selectedGrievance.student?.email}
                    </Descriptions.Item>
                    <Descriptions.Item label="Branch">
                      {selectedGrievance.student?.branchName}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                {/* Grievance Information */}
                <Card size="small" title="Grievance Information">
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
                    {selectedGrievance.preferredContactMethod && (
                      <Descriptions.Item label="Preferred Contact">
                        {selectedGrievance.preferredContactMethod}
                      </Descriptions.Item>
                    )}
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
                  selectedGrievance.facultySupervisor ||
                  selectedGrievance.assignedTo) && (
                  <Card size="small" title="Related Information">
                    <Descriptions column={1} size="small">
                      {selectedGrievance.internship && (
                        <Descriptions.Item label="Internship">
                          <Space>
                            <BankOutlined />
                            {selectedGrievance.internship.title}
                          </Space>
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
                      {selectedGrievance.assignedTo && (
                        <Descriptions.Item label="Assigned To">
                          <Space>
                            <TeamOutlined />
                            <div>
                              <Text strong>
                                {selectedGrievance.assignedTo.name}
                              </Text>
                              <br />
                              <Text type="secondary" className="text-xs">
                                {selectedGrievance.assignedTo.role?.replace(
                                  /_/g,
                                  " "
                                )}{" "}
                                - {selectedGrievance.assignedTo.email}
                              </Text>
                            </div>
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

          {/* Update Modal */}
          <Modal
            title={
              <span>
                <EditOutlined className="mr-2" />
                Update Grievance Status
              </span>
            }
            open={updateModalVisible}
            onCancel={() => {
              setUpdateModalVisible(false);
              updateForm.resetFields();
              setSelectedGrievance(null);
            }}
            footer={null}
            width={600}
          >
            <Form
              form={updateForm}
              layout="vertical"
              onFinish={handleUpdateGrievance}
              className="mt-4"
            >
              <Alert
                title="Update Grievance Status"
                description="Update the status and add resolution notes for this grievance."
                type="info"
                showIcon
                className="mb-4"
              />

              <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true, message: "Please select a status" }]}
              >
                <Select placeholder="Select status" size="large">
                  <Option value="PENDING">Pending</Option>
                  <Option value="UNDER_REVIEW">Under Review</Option>
                  <Option value="IN_PROGRESS">In Progress</Option>
                  <Option value="ADDRESSED">Addressed</Option>
                  <Option value="RESOLVED">Resolved</Option>
                  <Option value="ESCALATED">Escalated</Option>
                  <Option value="CLOSED">Closed</Option>
                </Select>
              </Form.Item>

              <Form.Item name="resolution" label="Resolution (Optional)">
                <TextArea
                  rows={4}
                  placeholder="Describe the resolution or actions taken..."
                />
              </Form.Item>

              <Form.Item name="comments" label="Comments/Notes">
                <TextArea
                  rows={3}
                  placeholder="Add any additional comments or notes..."
                />
              </Form.Item>

              <Divider />

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => {
                    setUpdateModalVisible(false);
                    updateForm.resetFields();
                    setSelectedGrievance(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<CheckCircleOutlined />}
                  loading={updating}
                >
                  Update Grievance
                </Button>
              </div>
            </Form>
          </Modal>

          {/* Escalate Modal */}
          <Modal
            title={
              <span>
                <AlertOutlined className="mr-2 text-orange-500" />
                Escalate Grievance
              </span>
            }
            open={escalateModalVisible}
            onCancel={() => {
              setEscalateModalVisible(false);
              escalateForm.resetFields();
              setSelectedGrievance(null);
            }}
            footer={null}
            width={600}
          >
            <Form
              form={escalateForm}
              layout="vertical"
              onFinish={handleEscalateGrievance}
              className="mt-4"
            >
              <Alert
                title="Escalate Grievance"
                description="Reassign this grievance to another faculty member or administrator who can better handle it."
                type="warning"
                showIcon
                className="mb-4"
              />

              {selectedGrievance && (
                <Card size="small" className="mb-4 bg-gray-50">
                  <Descriptions size="small" column={1}>
                    <Descriptions.Item label="Title">
                      <Text strong>{selectedGrievance.title}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Current Status">
                      <Tag color={getStatusColor(selectedGrievance.status)}>
                        {selectedGrievance.status?.replace(/_/g, " ")}
                      </Tag>
                    </Descriptions.Item>
                    {selectedGrievance.assignedTo && (
                      <Descriptions.Item label="Currently Assigned To">
                        <Text>{selectedGrievance.assignedTo.name}</Text>
                        <Text type="secondary" className="ml-2">
                          (
                          {selectedGrievance.assignedTo.role?.replace(
                            /_/g,
                            " "
                          )}
                          )
                        </Text>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>
              )}

              <Form.Item
                name="assignedToId"
                label="Assign To"
                rules={[
                  {
                    required: true,
                    message: "Please select a person to assign",
                  },
                ]}
              >
                <Select
                  placeholder="Select faculty or administrator"
                  size="large"
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    String(option.children).toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {assignableUsers && assignableUsers.filter(u => (String(u.role || '').toUpperCase() === 'PRINCIPAL')).length > 0 ? (
                    assignableUsers
                      .filter((user) => String(user.role || '').toUpperCase() === 'PRINCIPAL')
                      .map((user) => (
                        <Option key={user.id} value={user.id}>
                          {user.name} - {user.role?.replace(/_/g, " ")}
                          {user.email && (
                            <Text type="secondary" className="ml-2 text-xs">
                              ({user.email})
                            </Text>
                          )}
                        </Option>
                      ))
                  ) : (
                    <Option value={undefined} disabled>
                      No principal users available
                    </Option>
                  )}
                </Select>
              </Form.Item>

              <Form.Item
                name="escalationNote"
                label="Escalation Note"
                rules={[
                  {
                    required: true,
                    message: "Please provide a reason for escalation",
                  },
                ]}
              >
                <TextArea
                  rows={4}
                  placeholder="Explain why this grievance is being escalated and provide any relevant context..."
                />
              </Form.Item>

              <Divider />

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => {
                    setEscalateModalVisible(false);
                    escalateForm.resetFields();
                    setSelectedGrievance(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  danger
                  htmlType="submit"
                  icon={<AlertOutlined />}
                  loading={escalating}
                >
                  Escalate Grievance
                </Button>
              </div>
            </Form>
          </Modal>

          {/* Escalation History Modal */}
          <Modal
            title={
              <span>
                <ClockCircleOutlined className="mr-2 text-blue-500" />
                Escalation History
              </span>
            }
            open={historyModalVisible}
            onCancel={() => {
              setHistoryModalVisible(false);
              setEscalationHistory(null);
            }}
            footer={[
              <Button
                key="close"
                type="primary"
                onClick={() => {
                  setHistoryModalVisible(false);
                  setEscalationHistory(null);
                }}
              >
                Close
              </Button>,
            ]}
            width={800}
          >
            {escalationHistory && (
              <div className="space-y-4">
                {/* Summary Card */}
                <Card size="small" className="bg-blue-50 border-blue-200">
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="Grievance Title">
                      <Text strong>{escalationHistory.title}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Total Escalations">
                      <Badge
                        count={escalationHistory.escalationCount}
                        showZero
                        style={{ backgroundColor: "#ff4d4f" }}
                      />
                    </Descriptions.Item>
                    {escalationHistory.escalatedAt && (
                      <Descriptions.Item label="Last Escalated" span={2}>
                        {new Date(escalationHistory.escalatedAt).toLocaleString()}
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>

                {/* Previous Assignees */}
                {escalationHistory.previousAssignees &&
                  escalationHistory.previousAssignees.length > 0 && (
                    <Card size="small" title="Previous Handlers">
                      <Space wrap>
                        {escalationHistory.previousAssignees.map(
                          (assignee, idx) => (
                            <Tag
                              key={idx}
                              icon={<UserOutlined />}
                              color="blue"
                            >
                              {assignee.name} ({assignee.role?.replace(/_/g, " ")})
                            </Tag>
                          )
                        )}
                      </Space>
                    </Card>
                  )}

                {/* Escalation Timeline */}
                <Card size="small" title="Escalation Timeline">
                  {escalationHistory.escalationHistory &&
                  escalationHistory.escalationHistory.length > 0 ? (
                    <Timeline
                      mode="start"
                      items={escalationHistory.escalationHistory.map(
                        (record, idx) => ({
                          key: idx,
                          color: idx === 0 ? "red" : "blue",
                          icon:
                            idx === 0 ? (
                              <AlertOutlined style={{ fontSize: "16px" }} />
                            ) : (
                              <ClockCircleOutlined style={{ fontSize: "16px" }} />
                            ),
                          content: (
                            <Card size="small" className="mt-2">
                              <Space direction="vertical" size="small" className="w-full">
                                {/* Timestamp */}
                                <Text type="secondary" className="text-xs">
                                  {new Date(record.escalatedAt).toLocaleString()}
                                </Text>

                                {/* Escalation Flow */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {record.fromUser && (
                                    <>
                                      <Tag color="orange">
                                        <UserOutlined className="mr-1" />
                                        {record.fromUser.name}
                                      </Tag>
                                      <span>→</span>
                                    </>
                                  )}
                                  {record.toUser && (
                                    <Tag color="green">
                                      <UserOutlined className="mr-1" />
                                      {record.toUser.name}
                                    </Tag>
                                  )}
                                </div>

                                {/* Escalated By */}
                                {record.escalatedBy && (
                                  <div>
                                    <Text type="secondary" className="text-xs">
                                      Escalated by:{" "}
                                    </Text>
                                    <Text strong className="text-xs">
                                      {record.escalatedBy.name}
                                    </Text>
                                    <Text type="secondary" className="text-xs ml-1">
                                      ({record.escalatedBy.role?.replace(/_/g, " ")})
                                    </Text>
                                  </div>
                                )}

                                {/* Previous Status */}
                                {record.previousStatus && (
                                  <div>
                                    <Text type="secondary" className="text-xs">
                                      Previous Status:{" "}
                                    </Text>
                                    <Tag
                                      size="small"
                                      color={getStatusColor(record.previousStatus)}
                                    >
                                      {record.previousStatus?.replace(/_/g, " ")}
                                    </Tag>
                                  </div>
                                )}

                                {/* Escalation Note */}
                                {record.note && (
                                  <Alert
                                    title="Escalation Reason"
                                    description={record.note}
                                    type="info"
                                    showIcon
                                    className="mt-2"
                                  />
                                )}
                              </Space>
                            </Card>
                          ),
                        })
                      )}
                    />
                  ) : (
                    <Empty
                      description="No escalation history available"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  )}
                </Card>
              </div>
            )}
          </Modal>
        </div>
      </div>
    </>
  );
}