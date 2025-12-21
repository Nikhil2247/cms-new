// src/pages/faculty/SelfIdentifiedApprovalPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  DatePicker,
  Row,
  Col,
  Descriptions,
  Divider,
  Typography,
  message,
  Badge,
  Tabs,
  Alert,
  Popconfirm,
  Select,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  PhoneOutlined,
  MailOutlined,
  BankOutlined,
  UserOutlined,
  CalendarOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import API from "../../../services/api";
import { toast } from "react-hot-toast";
import {
  fetchInstituteAsync,
  selectInstitute,
  selectInstituteLoading,
} from "../../../store/slices/instituteSlice";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export default function SelfIdentifiedApprovalPage() {
  const dispatch = useDispatch();
  const institute = useSelector(selectInstitute);
  const instituteLoading = useSelector(selectInstituteLoading);
  
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("pending");
  const [userId, setUserId] = useState(null);

  // Get user ID from localStorage
  useEffect(() => {
    const loginData = localStorage.getItem("loginResponse");
    if (loginData) {
      try {
        const parsedData = JSON.parse(loginData);
        if (parsedData.user) {
          setUserId(parsedData.user.id);
        }
        // console.log("Parsed login data:", parsedData.user.id);
      } catch (e) {
        console.error("Error parsing login data:", e);
      }
    }
  }, []);

  // Fetch self-identified applications
  useEffect(() => {
    if (userId) {
      fetchSelfIdentifiedApplications();
    }
  }, [userId]);

  const fetchSelfIdentifiedApplications = async () => {
    try {
      setLoading(true);
      const response = await API.get(`/internship-applications/self-identified/mentor/${userId}`);
      if (response.data.success) {
        setApplications(response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching self-identified applications:", error);
      toast.error("Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (record) => {
    setSelectedApplication(record);
    setDetailModalVisible(true);
  };

  const handleApprove = (record) => {
    setSelectedApplication(record);
    form.resetFields();
    form.setFieldsValue({
      hasJoined: true,
      joiningDate: dayjs(),
    });
    setApprovalModalVisible(true);
  };

  const handleReject = async (record) => {
    setActionLoading(true);
    try {
      await API.patch(`/internship-applications/${record.id}/joining-status`, {
        hasJoined: false,
      });
      
      toast.success("Internship application rejected");
      
      // Refresh the applications list
      await fetchSelfIdentifiedApplications();
    } catch (error) {
      console.error("Error rejecting application:", error);
      toast.error(error?.response?.data?.message || "Failed to reject application");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitApproval = async (values) => {
    setActionLoading(true);
    try {
      await API.patch(
        `/internship-applications/${selectedApplication.id}/joining-status`,
        {
          hasJoined: values.hasJoined,
          joiningDate: values.joiningDate ? values.joiningDate.toISOString() : new Date().toISOString(),
        }
      );

      toast.success("Internship application approved successfully");
      setApprovalModalVisible(false);
      form.resetFields();
      setSelectedApplication(null);
      
      // Refresh the applications list
      await fetchSelfIdentifiedApplications();
    } catch (error) {
      console.error("Error approving application:", error);
      toast.error(error?.response?.data?.message || "Failed to approve application");
    } finally {
      setActionLoading(false);
    }
  };

  // Filter applications by status
  const getPendingApplications = () => {
    return applications.filter(
      (app) =>
        (!app.hasJoined && app.status !== "JOINED") ||
        app.status === "UNDER_REVIEW"
    );
  };

  const getApprovedApplications = () => {
    return applications.filter((app) => app.hasJoined || app.status === "JOINED");
  };

  const columns = [
    {
      title: "Student Details",
      key: "student",
      width: "20%",
      render: (_, record) => (
        <div>
          <div className="font-semibold text-blue-600">{record.student?.name}</div>
          <div className="text-xs text-gray-500">{record.student?.rollNumber}</div>
          <div className="text-xs text-gray-500">{record.student?.branchName}</div>
        </div>
      ),
    },
    {
      title: "Company Details",
      key: "company",
      width: "20%",
      render: (_, record) => (
        <div>
          <div className="font-medium flex items-center">
            <BankOutlined className="mr-1 text-green-600" />
            {record.companyName || "N/A"}
          </div>
          {record.jobProfile && (
            <div className="text-xs text-gray-600 mt-1">
              Role: {record.jobProfile}
            </div>
          )}
          {record.companyAddress && (
            <div className="text-xs text-gray-500 mt-1">
              {record.companyAddress}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "HR Contact",
      key: "hr",
      width: "15%",
      render: (_, record) => (
        <div>
          <div className="text-sm font-medium">{record.hrName || "N/A"}</div>
          {record.hrContact && (
            <div className="text-xs text-gray-600 flex items-center mt-1">
              <PhoneOutlined className="mr-1" />
              {record.hrContact}
            </div>
          )}
          {record.hrEmail && (
            <div className="text-xs text-blue-500 flex items-center mt-1">
              <MailOutlined className="mr-1" />
              {record.hrEmail}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Duration & Stipend",
      key: "details",
      width: "15%",
      render: (_, record) => (
        <div>
          {record.internshipDuration && (
            <div className="text-sm flex items-center mb-1">
              <ClockCircleOutlined className="mr-1 text-blue-500" />
              {record.internshipDuration}
            </div>
          )}
          {record.stipend && (
            <div className="text-sm flex items-center text-green-600">
              <DollarOutlined className="mr-1" />
              ₹{record.stipend}
            </div>
          )}
          {record.startDate && (
            <div className="text-xs text-gray-500 mt-1">
              Start: {dayjs(record.startDate).format("MMM DD, YYYY")}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Application Date",
      dataIndex: "applicationDate",
      key: "applicationDate",
      width: "12%",
      sorter: (a, b) => new Date(a.applicationDate) - new Date(b.applicationDate),
      render: (date) => dayjs(date).format("MMM DD, YYYY"),
    },
    {
      title: "Status",
      key: "status",
      width: "10%",
      render: (_, record) => (
        <div>
          {record.hasJoined ? (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              Approved
            </Tag>
          ) : (
            <Tag color="orange" icon={<ClockCircleOutlined />}>
              Pending
            </Tag>
          )}
          {record.joiningLetterUrl && (
            <div className="mt-1">
              <Tag color="blue" icon={<FileTextOutlined />}>
                Letter
              </Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: "18%",
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
            size="small"
          >
            View Details
          </Button>
          {!record.hasJoined && record.status !== "JOINED" ? (
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record)}
              >
                Approve
              </Button>
              <Popconfirm
                title="Reject Application"
                description="Are you sure you want to reject this application?"
                onConfirm={() => handleReject(record)}
                okText="Yes"
                cancelText="No"
              >
                <Button
                  danger
                  size="small"
                  icon={<CloseCircleOutlined />}
                  loading={actionLoading}
                >
                  Reject
                </Button>
              </Popconfirm>
            </Space>
          ) : (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              Approved on {dayjs(record.joiningDate).format("MMM DD, YYYY")}
            </Tag>
          )}
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: "pending",
      label: (
        <Badge count={getPendingApplications().length} offset={[10, 0]}>
          <span>
            <ClockCircleOutlined className="mr-2" />
            Pending Approval
          </span>
        </Badge>
      ),
      children: (
        <Table
          dataSource={getPendingApplications()}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 5,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} applications`,
          }}
        />
      ),
    },
    {
      key: "approved",
      label: (
        <Badge count={getApprovedApplications().length} offset={[10, 0]}>
          <span>
            <CheckCircleOutlined className="mr-2" />
            Approved
          </span>
        </Badge>
      ),
      children: (
        <Table
          dataSource={getApprovedApplications()}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 5,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} applications`,
          }}
        />
      ),
    },
    {
      key: "all",
      label: (
        <Badge count={applications.length} offset={[10, 0]}>
          <span>
            <FileTextOutlined className="mr-2" />
            All Applications
          </span>
        </Badge>
      ),
      children: (
        <Table
          dataSource={applications}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 5,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} applications`,
          }}
        />
      ),
    },
  ];

  return (
    <>
      <div className="min-h-screen ">
        {/* Header */}
        <div className="mb-6">
          <Title level={2} className="!mb-2">
            Student Internships
          </Title>
          {/* <Text className="text-gray-600">
            Review and approve self-identified internship applications from students
          </Text> */}
        </div>

        {/* Statistics Cards */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={8}>
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <Text className="text-gray-600 text-sm block mb-1">
                    Pending Approval
                  </Text>
                  <Title level={2} className="!mb-0 text-orange-600">
                    {getPendingApplications().length}
                  </Title>
                </div>
                <ClockCircleOutlined className="text-4xl text-orange-500" />
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <Text className="text-gray-600 text-sm block mb-1">
                    Approved
                  </Text>
                  <Title level={2} className="!mb-0 text-green-600">
                    {getApprovedApplications().length}
                  </Title>
                </div>
                <CheckCircleOutlined className="text-4xl text-green-500" />
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <Text className="text-gray-600 text-sm block mb-1">
                    Total Applications
                  </Text>
                  <Title level={2} className="!mb-0 text-blue-600">
                    {applications.length}
                  </Title>
                </div>
                <FileTextOutlined className="text-4xl text-blue-500" />
              </div>
            </Card>
          </Col>
        </Row>

        {/* Main Content */}
        <Card className="shadow-sm">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="large"
          />
        </Card>

        {/* Detail View Modal */}
        <Modal
          title={
            <div className="flex items-center">
              <FileTextOutlined className="mr-2 text-blue-600" />
              <span>Self-Identified Internship Details</span>
            </div>
          }
          open={detailModalVisible}
          onCancel={() => {
            setDetailModalVisible(false);
            setSelectedApplication(null);
          }}
          footer={[
            <Button
              key="close"
              onClick={() => {
                setDetailModalVisible(false);
                setSelectedApplication(null);
              }}
            >
              Close
            </Button>,
            selectedApplication && !selectedApplication.hasJoined && (
              <Button
                key="approve"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => {
                  setDetailModalVisible(false);
                  handleApprove(selectedApplication);
                }}
              >
                Approve Application
              </Button>
            ),
          ]}
          width={900}
        >
          {selectedApplication && (
            <div className="!space-y-4">
              {/* Student Information */}
              <Card
                title={
                  <span className="text-blue-600 font-semibold">
                    <UserOutlined className="mr-2" />
                    Student Information
                  </span>
                }
                size="small"
              >
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="Name">
                    {selectedApplication.student?.name}
                  </Descriptions.Item>
                  <Descriptions.Item label="Roll Number">
                    {selectedApplication.student?.rollNumber}
                  </Descriptions.Item>
                  <Descriptions.Item label="Branch">
                    {selectedApplication.student?.branchName}
                  </Descriptions.Item>
                  <Descriptions.Item label="Email">
                    {selectedApplication.student?.email}
                  </Descriptions.Item>
                  <Descriptions.Item label="Contact">
                    {selectedApplication.student?.contact}
                  </Descriptions.Item>
                  <Descriptions.Item label="Application Date">
                    {dayjs(selectedApplication.applicationDate).format(
                      "MMMM DD, YYYY"
                    )}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {/* Company Information */}
              <Card
                title={
                  <span className="text-green-600 font-semibold">
                    <BankOutlined className="mr-2" />
                    Company Information
                  </span>
                }
                size="small"
              >
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="Company Name" span={2}>
                    {selectedApplication.companyName || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Address" span={2}>
                    {selectedApplication.companyAddress || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Job Profile" span={2}>
                    {selectedApplication.jobProfile || "N/A"}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {/* HR Contact Information */}
              <Card
                title={
                  <span className="text-purple-600 font-semibold">
                    <PhoneOutlined className="mr-2" />
                    HR Contact Information
                  </span>
                }
                size="small"
              >
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="HR Name">
                    {selectedApplication.hrName || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="HR Contact">
                    {selectedApplication.hrContact || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="HR Email" span={2}>
                    {selectedApplication.hrEmail || "N/A"}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {/* Internship Details */}
              <Card
                title={
                  <span className="text-orange-600 font-semibold">
                    <CalendarOutlined className="mr-2" />
                    Internship Details
                  </span>
                }
                size="small"
              >
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="Duration">
                    {selectedApplication.internshipDuration || "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Stipend">
                    {selectedApplication.stipend
                      ? `₹${selectedApplication.stipend}`
                      : "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Start Date">
                    {selectedApplication.startDate
                      ? dayjs(selectedApplication.startDate).format("MMM DD, YYYY")
                      : "N/A"}
                  </Descriptions.Item>
                  <Descriptions.Item label="End Date">
                    {selectedApplication.endDate
                      ? dayjs(selectedApplication.endDate).format("MMM DD, YYYY")
                      : "N/A"}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {/* Faculty Mentor Information */}
              {selectedApplication.facultyMentorName && (
                <Card
                  title={
                    <span className="text-indigo-600 font-semibold">
                      <UserOutlined className="mr-2" />
                      Faculty Mentor Information
                    </span>
                  }
                  size="small"
                >
                  <Descriptions column={2} bordered size="small">
                    <Descriptions.Item label="Name">
                      {selectedApplication.facultyMentorName}
                    </Descriptions.Item>
                    <Descriptions.Item label="Designation">
                      {selectedApplication.facultyMentorDesignation || "N/A"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Contact">
                      {selectedApplication.facultyMentorContact || "N/A"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Email">
                      {selectedApplication.facultyMentorEmail || "N/A"}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              )}

              {/* Joining Letter */}
              {selectedApplication.joiningLetterUrl && (
                <Card
                  title={
                    <span className="text-pink-600 font-semibold">
                      <FileTextOutlined className="mr-2" />
                      Joining Letter
                    </span>
                  }
                  size="small"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <Text>Uploaded on:</Text>
                      <Text strong className="ml-2">
                        {dayjs(selectedApplication.joiningLetterUploadedAt).format(
                          "MMM DD, YYYY HH:mm"
                        )}
                      </Text>
                    </div>
                    <Button
                      type="primary"
                      icon={<EyeOutlined />}
                      href={selectedApplication.joiningLetterUrl}
                      target="_blank"
                    >
                      View
                    </Button>
                  </div>
                </Card>
              )}

              {/* Additional Information */}
              {(selectedApplication.coverLetter ||
                selectedApplication.additionalInfo) && (
                <Card
                  title={
                    <span className="text-gray-600 font-semibold">
                      Additional Information
                    </span>
                  }
                  size="small"
                >
                  {selectedApplication.coverLetter && (
                    <div className="mb-3">
                      <Text strong>Cover Letter:</Text>
                      <Paragraph className="mt-1 bg-gray-50 p-3 rounded">
                        {selectedApplication.coverLetter}
                      </Paragraph>
                    </div>
                  )}
                  {selectedApplication.additionalInfo && (
                    <div>
                      <Text strong>Additional Info:</Text>
                      <Paragraph className="mt-1 bg-gray-50 p-3 rounded">
                        {selectedApplication.additionalInfo}
                      </Paragraph>
                    </div>
                  )}
                </Card>
              )}

              {/* Approval Status */}
              <Card size="small">
                <div className="flex items-center justify-between">
                  <div>
                    <Text strong>Approval Status:</Text>
                    {selectedApplication.hasJoined ? (
                      <Tag
                        color="green"
                        icon={<CheckCircleOutlined />}
                        className="ml-3"
                      >
                        Approved
                      </Tag>
                    ) : (
                      <Tag
                        color="orange"
                        icon={<ClockCircleOutlined />}
                        className="ml-3"
                      >
                        Pending Approval
                      </Tag>
                    )}
                  </div>
                  {selectedApplication.joiningDate && (
                    <div>
                      <Text type="secondary">Approved on: </Text>
                      <Text strong>
                        {dayjs(selectedApplication.joiningDate).format(
                          "MMM DD, YYYY"
                        )}
                      </Text>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}
        </Modal>

        {/* Approval Modal */}
        <Modal
          title={
            <div className="flex items-center">
              <CheckCircleOutlined className="mr-2 text-green-600" />
              <span>Approve Self-Identified Internship</span>
            </div>
          }
          open={approvalModalVisible}
          onCancel={() => {
            setApprovalModalVisible(false);
            setSelectedApplication(null);
            form.resetFields();
          }}
          onOk={() => form.submit()}
          okText="Approve"
          okButtonProps={{ loading: actionLoading, icon: <CheckCircleOutlined /> }}
          width={600}
        >
          {selectedApplication && (
            <div>
              <Alert
                title="Approval Confirmation"
                description={
                  <div>
                    <p>
                      You are about to approve the self-identified internship
                      application for:
                    </p>
                    <p className="font-semibold mt-2">
                      Student: {selectedApplication.student?.name} (
                      {selectedApplication.student?.rollNumber})
                    </p>
                    <p className="font-semibold">
                      Company: {selectedApplication.companyName}
                    </p>
                  </div>
                }
                type="info"
                showIcon
                className="mb-4"
              />

              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmitApproval}
                initialValues={{
                  hasJoined: true,
                  joiningDate: dayjs(),
                }}
              >
                <Form.Item
                  name="hasJoined"
                  label="Approval Status"
                  rules={[{ required: true }]}
                >
                  <Select>
                    <Option value={true}>Approve - Student has joined</Option>
                    <Option value={false}>Reject - Do not approve</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) =>
                    prevValues.hasJoined !== currentValues.hasJoined
                  }
                >
                  {({ getFieldValue }) =>
                    getFieldValue("hasJoined") === true ? (
                      <Form.Item
                        name="joiningDate"
                        label="Joining Date"
                        rules={[
                          { required: true, message: "Please select joining date" },
                        ]}
                      >
                        <DatePicker
                          style={{ width: "100%" }}
                          format="MMMM DD, YYYY"
                          placeholder="Select joining date"
                        />
                      </Form.Item>
                    ) : null
                  }
                </Form.Item>
              </Form>
            </div>
          )}
        </Modal>
      </div>
    </>
  );
}