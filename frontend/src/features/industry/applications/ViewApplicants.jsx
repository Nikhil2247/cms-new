// src/pages/industry/ViewApplicants.jsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Typography,
  Input,
  Select,
  Row,
  Col,
  Modal,
  message,
  Avatar,
  Descriptions,
  Tabs,
  Badge,
  Progress,
  Statistic,
  Rate,
  Empty,
} from "antd";
import {
  UserOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  DownloadOutlined,
  StarOutlined,
  PhoneOutlined,
  MailOutlined,
  FilterOutlined,
  BankOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  CalendarOutlined,
  TrophyOutlined,
  FileOutlined,
} from "@ant-design/icons";
import { useSearchParams, useNavigate } from "react-router-dom";
import API from "../../../services/api";
import Layouts from "../../../components/Layout";
import dayjs from "dayjs";
import { toast } from "react-hot-toast";
import CompletionFeedbackModal from "../../../components/CompletionFeedbackModal";
import MonthlyFeedbackModal from "../../../components/MonthlyFeedbackModal";
import { useDispatch, useSelector } from "react-redux";
import {
  selectIndustryError,
  selectIndustryLoading,
  selectIndustryProfile,
  setIndustryProfile,
} from "../../../store/slices/industrySlice";
// Import the CompletionFeedbackModal

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Search } = Input;
const { TabPane } = Tabs;
const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return dayjs(dateString).format("DD MMM YYYY");
};
const ViewApplicants = () => {
  const dispatch = useDispatch();

  // Redux selectors
  const profile = useSelector(selectIndustryProfile);
  const loading = useSelector(selectIndustryLoading);
  const error = useSelector(selectIndustryError);

  // const [loading, setLoading] = useState(true);
  // const [applications, setApplications] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [detailsModal, setDetailsModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentInternship, setCurrentInternship] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [existingMonthlyFeedbacks, setExistingMonthlyFeedbacks] = useState([]);
  const [existingCompletionFeedbacks, setExistingCompletionFeedbacks] =
    useState([]);

  // Add CompletionFeedbackModal state
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const [completionModalAppId, setCompletionModalAppId] = useState(null);
  const [completionModalStudentName, setCompletionModalStudentName] =
    useState(null);
  const [editingCompletionFeedback, setEditingCompletionFeedback] = useState(null);

  // Add to state variables
  const [monthlyModalVisible, setMonthlyModalVisible] = useState(false);
  const [monthlyModalAppId, setMonthlyModalAppId] = useState(null);
  const [monthlyModalStudentName, setMonthlyModalStudentName] = useState(null);
  const [editingMonthlyFeedback, setEditingMonthlyFeedback] = useState(null);
  const internshipId = searchParams.get("internshipId");
  // Get applications from Redux profile
  const applications = React.useMemo(() => {
    if (!profile?.internships) return [];

    const allApplications = [];
    let targetInternship = null;

    profile.internships.forEach((internship) => {
      internship.applications?.forEach((application) => {
        if (!internshipId || internship.id === internshipId) {
          if (internship.id === internshipId) {
            targetInternship = internship;
          }
          allApplications.push({
            ...application,
            internship: {
              id: internship.id,
              title: internship.title,
              fieldOfWork: internship.fieldOfWork,
              duration: internship.duration,
            },
          });
        }
      });
    });

    // Update current internship if it changed
    if (targetInternship !== currentInternship) {
      setCurrentInternship(targetInternship);
    }

    return allApplications;
  }, [profile, internshipId, currentInternship]);

  useEffect(() => {
    // Fetch profile data if not already loaded
    if (!profile) {
      dispatch(fetchIndustryAsync());
    }
    fetchExistingFeedbacks();
  }, [dispatch, profile]);

  useEffect(() => {
    filterData();
  }, [searchText, statusFilter, branchFilter, applications]);

  const handleBackToInternships = () => {
    // Clear all current query parameters and navigate with clean URL
    navigate("/industry/internships?tab=manage", { replace: true });
    window.location.reload();
  };

  // Add this function to fetch existing feedbacks
  const fetchExistingFeedbacks = async () => {
    try {
      const [monthlyRes, completionRes] = await Promise.all([
        API.get("/monthly-feedback"),
        API.get("/completion-feedback/industry/my-feedbacks"),
      ]);

      setExistingMonthlyFeedbacks(
        Array.isArray(monthlyRes.data)
          ? monthlyRes.data
          : monthlyRes.data?.data || []
      );
      setExistingCompletionFeedbacks(
        Array.isArray(completionRes.data)
          ? completionRes.data
          : completionRes.data?.data || []
      );
    } catch (error) {
      console.error("Error fetching existing feedbacks:", error);
    }
  };

  // Helper functions to check if feedback exists
  const getMonthlyFeedbackForApp = (applicationId) => {
    return existingMonthlyFeedbacks.find(
      (feedback) => feedback.applicationId === applicationId
    );
  };

  const getCompletionFeedbackForApp = (applicationId) => {
    return existingCompletionFeedbacks.find(
      (feedback) => feedback.applicationId === applicationId
    );
  };

  // Add function to open monthly modal
  const openMonthlyModal = (application, existingFeedback = null) => {
    setMonthlyModalAppId(application?.id);
    setMonthlyModalStudentName(application?.student?.name);
    setEditingMonthlyFeedback(existingFeedback);
    setMonthlyModalVisible(true);
  };

  // Add success handler
  const handleMonthlyModalSuccess = () => {
    setMonthlyModalVisible(false);
    setMonthlyModalAppId(null);
    setMonthlyModalStudentName(null);
    setEditingMonthlyFeedback(null);
    fetchExistingFeedbacks();
    dispatch(fetchIndustryAsync());
  };

  // Function to open CompletionFeedbackModal
  const openCompletionModal = (application, existingFeedback = null) => {
    setCompletionModalAppId(application?.id);
    setCompletionModalStudentName(application?.student?.name);
    setEditingCompletionFeedback(existingFeedback);
    setCompletionModalVisible(true);
  };

  // Handle completion modal success
  const handleCompletionModalSuccess = () => {
    setCompletionModalVisible(false);
    setCompletionModalAppId(null);
    setCompletionModalStudentName(null);
    setEditingCompletionFeedback(null);
    // Refresh existing feedbacks to update the UI
    fetchExistingFeedbacks();
    // Optionally refresh applications data
    dispatch(fetchIndustryAsync());
  };

  // const fetchApplications = async () => {
  //   setLoading(true);
  //   try {
  //     const response = await API.get("/industries/profile");

  //     if (response.data) {
  //       const allApplications = [];
  //       let targetInternship = null;

  //       response.data.internships?.forEach((internship) => {
  //         internship.applications?.forEach((application) => {
  //           if (!internshipId || internship.id === internshipId) {
  //             if (internship.id === internshipId) {
  //               targetInternship = internship;
  //             }
  //             allApplications.push({
  //               ...application,
  //               internship: {
  //                 id: internship.id,
  //                 title: internship.title,
  //                 fieldOfWork: internship.fieldOfWork,
  //                 duration: internship.duration,
  //               },
  //             });
  //           }
  //         });
  //       });

  //       setApplications(allApplications);
  //       setCurrentInternship(targetInternship);
  //     }
  //   } catch (error) {
  //     toast.error("Error fetching applications");
  //     console.error("Error:", error);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const filterData = () => {
    let filtered = applications;

    if (searchText) {
      filtered = filtered.filter(
        (item) =>
          item.student?.name
            ?.toLowerCase()
            .includes(searchText.toLowerCase()) ||
          item.student?.rollNumber
            ?.toLowerCase()
            .includes(searchText.toLowerCase()) ||
          item.student?.email?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    if (branchFilter !== "all") {
      filtered = filtered.filter(
        (item) => item.student?.branchName === branchFilter
      );
    }

    setFilteredData(filtered);
  };

  const handleStatusChange = async (applicationId, newStatus) => {
    console.log(
      `Attempting to change status to: ${newStatus} for application: ${applicationId}`
    );

    try {
      let payload = { status: newStatus };

      if (newStatus === "REJECTED") {
        const reason = await new Promise((resolve) => {
          let rejectionReason = "";
          Modal.confirm({
            title: "Reject Application",
            content: (
              <div className="mt-4">
                <Text className="block mb-2">
                  Please provide a reason for rejection:
                </Text>
                <Input.TextArea
                  rows={3}
                  placeholder="Enter rejection reason..."
                  onChange={(e) => (rejectionReason = e.target.value)}
                  maxLength={500}
                  showCount
                />
              </div>
            ),
            onOk: () => resolve(rejectionReason),
            onCancel: () => resolve(null),
          });
        });

        if (reason && reason.trim()) {
          payload.rejectionReason = reason.trim();
        } else {
          toast.error("Rejection reason is required");
          return;
        }
      }

      const response = await API.patch(
        `/internship-applications/${applicationId}/status`,
        payload
      );

      // console.log("API Response:", response.data);
      const updatedStatus = response.data?.status || newStatus;

      if (updatedStatus !== newStatus) {
        console.warn(
          `Status mismatch: Expected ${newStatus}, got ${updatedStatus}`
        );
        toast.error(
          `Status was changed to ${updatedStatus} instead of ${newStatus}`
        );
      }

      // Update Redux store
      const updatedProfile = {
        ...profile,
        internships: profile.internships.map((internship) => ({
          ...internship,
          applications: internship.applications?.map((app) =>
            app.id === applicationId
              ? {
                  ...app,
                  status: updatedStatus,
                  rejectionReason: payload.rejectionReason,
                }
              : app
          ),
        })),
      };
      dispatch(setIndustryProfile(updatedProfile));

      toast.success(
        `Application ${updatedStatus
          .toLowerCase()
          .replace("_", " ")} successfully`
      );

      // Refresh data after a delay
      setTimeout(() => {
        dispatch(fetchIndustryAsync());
      }, 1000);
    } catch (error) {
      console.error("Status change error:", error);
      toast.error(error?.response?.data?.message || "Error updating status");
      fetchApplications();
    }
  };

  const showDetails = (record) => {
    setSelectedApplication(record);
    setDetailsModal(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      APPLIED: "blue",
      UNDER_REVIEW: "orange",
      SELECTED: "green",
      REJECTED: "red",
      JOINED: "purple",
      COMPLETED: "gray",
    };
    return colors[status] || "default";
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      APPLIED: "processing",
      UNDER_REVIEW: "warning",
      SELECTED: "success",
      REJECTED: "error",
      JOINED: "processing",
      COMPLETED: "default",
    };
    return colors[status] || "default";
  };

  const columns = [
    {
      title: "Student Details",
      key: "student",
      render: (_, record) => (
        <div className="flex items-center space-x-3">
          <Avatar
            size="large"
            src={record.student?.profileImage}
            icon={!record.student?.profileImage && <UserOutlined />}
            className="flex-shrink-0 bg-blue-500"
          />
          <div className="ml-3">
            <Text strong className="text-base block">
              {record.student?.name}
            </Text>
            <Text className="text-gray-600 text-sm block">
              {record.student?.rollNumber} • {record.student?.branchName}
            </Text>
            <Text className="text-gray-500 text-xs">
              {record.student?.tenthper}% (10th) • {record.student?.twelthper}%
              (12th)
            </Text>
          </div>
        </div>
      ),
      width: "25%",
    },
    {
      title: "Internship",
      key: "internship",
      render: (_, record) => (
        <div>
          <Text strong className="block">
            {record.internship?.title}
          </Text>
          <Text className="text-gray-600 text-sm">
            {record.internship?.fieldOfWork}
          </Text>
        </div>
      ),
      width: "20%",
    },
    {
      title: "Application Date",
      key: "appliedDate",
      render: (_, record) => (
        <div>
          <Text>{new Date(record.appliedDate).toLocaleDateString()}</Text>
          <br />
          <Text className="text-gray-500 text-xs">
            {Math.ceil(
              (new Date() - new Date(record.appliedDate)) /
                (1000 * 60 * 60 * 24)
            )}{" "}
            days ago
          </Text>
        </div>
      ),
      width: "15%",
    },
    {
      title: "Status",
      key: "status",
      render: (_, record) => (
        <div className="space-y-2">
          <Select
            value={record.status}
            onChange={(newStatus) => handleStatusChange(record.id, newStatus)}
            style={{ width: "100%" }}
            size="small"
          >
            <Option value="APPLIED" disabled={record.status !== "APPLIED"}>
              Applied
            </Option>
            <Option
              disabled={
                record.status === "SELECTED" || record.status === "COMPLETED"
              }
              value="UNDER_REVIEW"
            >
              Under Review
            </Option>
            <Option
              value="SELECTED"
              disabled={
                record.status === "REJECTED" || record.status === "COMPLETED"
              }
            >
              Selected
            </Option>
            <Option
              value="REJECTED"
              disabled={
                record.status === "SELECTED" ||
                record.status === "JOINED" ||
                record.status === "COMPLETED"
              }
            >
              Rejected
            </Option>
            <Option value="JOINED" disabled={record.status !== "SELECTED"}>
              Joined
            </Option>
            <Option value="COMPLETED">Completed</Option>
          </Select>
          <div>
            <Tag color={getStatusColor(record.status)} size="small">
              {record.status.replace("_", " ")}
            </Tag>
          </div>
        </div>
      ),
      width: "20%",
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_, record) => {
        const monthlyFeedback = getMonthlyFeedbackForApp(record.id);
        const completionFeedback = getCompletionFeedbackForApp(record.id);
        return (
          <Space direction="vertical" size="small">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => showDetails(record)}
              className="text-blue-600"
            >
              Details
            </Button>

            {/* Monthly Feedback Action */}
            {(record.status === "SELECTED" || record.status === "JOINED") && (
              <Button
                size="small"
                type={monthlyFeedback ? "default" : "primary"}
                icon={monthlyFeedback ? <EditOutlined /> : <PlusOutlined />}
                onClick={() => openMonthlyModal(record, monthlyFeedback)}
                className={
                  monthlyFeedback
                    ? "text-orange-600 border-orange-300 hover:bg-orange-50"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }
              >
                {monthlyFeedback
                  ? "Edit Monthly Feedback"
                  : "Add Monthly Feedback"}
              </Button>
            )}

            {/* Updated Completion Feedback Action - Now opens modal */}
            {(record.status === "JOINED" || record.status === "COMPLETED") && (
              <Button
                size="small"
                type={completionFeedback ? "default" : "primary"}
                icon={completionFeedback ? <EditOutlined /> : <PlusOutlined />}
                onClick={() => openCompletionModal(record, completionFeedback)}
                className={
                  completionFeedback
                    ? "text-purple-600 border-purple-300 hover:bg-purple-50"
                    : "bg-purple-600 hover:bg-purple-700 text-white"
                }
              >
                {completionFeedback
                  ? "Edit Completion Feedback"
                  : "Add Completion Feedback"}
              </Button>
            )}

            {/* Rest of your existing action buttons for APPLIED status */}
            {record.status === "APPLIED" && (
              <div className="flex gap-1">
                {/* Your existing select/reject buttons */}
              </div>
            )}
          </Space>
        );
      },
    },
  ];

  const getStatusCounts = () => {
    return {
      total: applications.length,
      applied: applications.filter((app) => app.status === "APPLIED").length,
      underReview: applications.filter((app) => app.status === "UNDER_REVIEW")
        .length,
      selected: applications.filter((app) => app.status === "SELECTED").length,
      rejected: applications.filter((app) => app.status === "REJECTED").length,
    };
  };

  const statusCounts = getStatusCounts();

  // Get unique branches for filter
  const uniqueBranches = [
    ...new Set(
      applications.map((app) => app.student?.branchName).filter(Boolean)
    ),
  ];

  // Dynamic title based on whether it's for a specific internship
  const getPageTitle = () => {
    if (currentInternship) {
      return `Applications for "${currentInternship.title}"`;
    }
    return "All Internship Applications";
  };

  const getPageDescription = () => {
    if (currentInternship) {
      return `Review and manage applications for ${currentInternship.title} internship in ${currentInternship.fieldOfWork}`;
    }
    return "Review and manage applications for all your internships";
  };

  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="mx-auto p-4 md:p-6">
        {/* Header */}
        <Card className="mb-4 rounded-2xl border-border bg-background/95 shadow-sm">
          <div className="mb-6">
            {currentInternship && (
              <div className="flex items-center mb-4">
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={handleBackToInternships}
                  className="mr-3 rounded-lg"
                >
                  Back to Internships
                </Button>
                <div className="flex items-center text-primary font-medium">
                  <BankOutlined className="mr-2" />
                  <Text className="text-sm">
                    {currentInternship.fieldOfWork} •{" "}
                    {currentInternship.duration}
                  </Text>
                </div>
              </div>
            )}
            <Title level={3} className="mb-2 text-text-primary">
              {getPageTitle()}
            </Title>
            <Text className="text-text-secondary text-lg">
              {getPageDescription()}
            </Text>
          </div>

          {/* Status Overview */}
          <Row gutter={[16, 16]} className="mb-8">
            <Col xs={24} sm={6}>
              <Card
                size="small"
                className="text-center rounded-xl border-border shadow-sm bg-gradient-to-r from-primary-50 to-primary-100/50"
              >
                <Statistic
                  title={<Text className="text-[10px] uppercase font-bold text-primary-700">Total Applications</Text>}
                  value={statusCounts.total}
                  valueStyle={{ color: "var(--ant-primary-color)", fontWeight: "bold" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card
                size="small"
                className="text-center rounded-xl border-border shadow-sm bg-gradient-to-r from-warning-50 to-warning-100/50"
              >
                <Statistic
                  title={<Text className="text-[10px] uppercase font-bold text-warning-700">Pending Review</Text>}
                  value={statusCounts.applied}
                  valueStyle={{ color: "var(--ant-warning-color)", fontWeight: "bold" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card
                size="small"
                className="text-center rounded-xl border-border shadow-sm bg-gradient-to-r from-success-50 to-success-100/50"
              >
                <Statistic
                  title={<Text className="text-[10px] uppercase font-bold text-success-700">Selected</Text>}
                  value={statusCounts.selected}
                  valueStyle={{ color: "var(--ant-success-color)", fontWeight: "bold" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card
                size="small"
                className="text-center rounded-xl border-border shadow-sm bg-gradient-to-r from-error-50 to-error-100/50"
              >
                <Statistic
                  title={<Text className="text-[10px] uppercase font-bold text-error-700">Rejected</Text>}
                  value={statusCounts.rejected}
                  valueStyle={{ color: "var(--ant-error-color)", fontWeight: "bold" }}
                />
              </Card>
            </Col>
          </Row>

          {/* Filters */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Search
                placeholder="Search students..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="rounded-lg"
                size="large"
                allowClear
              />
            </Col>
            <Col xs={24} sm={8}>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                className="w-full rounded-lg"
                placeholder="Filter by status"
                size="large"
              >
                <Option value="all">All Status</Option>
                <Option value="APPLIED">Applied</Option>
                <Option value="UNDER_REVIEW">Under Review</Option>
                <Option value="SELECTED">Selected</Option>
                <Option value="REJECTED">Rejected</Option>
                <Option value="JOINED">Joined</Option>
                <Option value="COMPLETED">Completed</Option>
              </Select>
            </Col>
            <Col xs={24} sm={8}>
              <Select
                value={branchFilter}
                onChange={setBranchFilter}
                className="w-full rounded-lg"
                placeholder="Filter by branch"
                size="large"
              >
                <Option value="all">All Branches</Option>
                {uniqueBranches.map((branch) => (
                  <Option key={branch} value={branch}>
                    {branch}
                  </Option>
                ))}
              </Select>
            </Col>
          </Row>
        </Card>
        {/* Applications Table */}
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="id"
            loading={loading}
            scroll={{ x: "max-content" }}
            pagination={{
              total: filteredData.length,
              pageSize: 5,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} applications`,
            }}
            locale={{
              emptyText: (
                <div className="text-center py-12">
                  <UserOutlined className="text-4xl text-text-tertiary mb-4" />
                  <Text className="text-text-secondary block text-lg font-medium">
                    No applications found
                  </Text>
                  <Text className="text-text-tertiary">
                    Applications will appear here once students apply
                  </Text>
                </div>
              ),
            }}
            className="custom-table"
          />
        </Card>
        {/* Application Details Modal */}
        <Modal
          title={
            <div className="flex items-center text-primary font-semibold">
              <UserOutlined className="mr-2" />
              Application Details
            </div>
          }
          open={detailsModal}
          onCancel={() => setDetailsModal(false)}
          width={900}
          footer={null}
          className="rounded-2xl overflow-hidden"
        >
          {selectedApplication && (
            <div className="space-y-6 mt-6">
              <Tabs defaultActiveKey="details" className="custom-tabs">
                <TabPane tab="Student Details" key="details">
                  <div className="flex items-start space-x-6 mb-8">
                    <Avatar
                      size={100}
                      src={selectedApplication.student?.profileImage}
                      icon={
                        !selectedApplication.student?.profileImage && (
                          <UserOutlined />
                        )
                      }
                      className="flex-shrink-0 bg-primary border-4 border-background shadow-lg"
                    />
                    <div className="flex-1">
                      <Title level={4} className="mb-1 text-text-primary">
                        {selectedApplication.student?.name}
                      </Title>
                      <Text className="text-text-secondary text-lg block mb-3 font-medium">
                        {selectedApplication.student?.rollNumber}
                      </Text>
                      <div className="flex flex-wrap gap-2">
                        <Tag color="blue" className="px-3 py-1 rounded-full border-0 font-medium">
                          {selectedApplication.student?.branchName}
                        </Tag>
                        <Tag color="green" className="px-3 py-1 rounded-full border-0 font-medium">
                          10th: {selectedApplication.student?.tenthper}%
                        </Tag>
                        <Tag color="purple" className="px-3 py-1 rounded-full border-0 font-medium">
                          12th: {selectedApplication.student?.twelthper}%
                        </Tag>
                        <Tag color="orange" className="px-3 py-1 rounded-full border-0 font-medium">
                          {selectedApplication.student?.category}
                        </Tag>
                      </div>
                    </div>
                  </div>

                  <Descriptions bordered column={2} className="mb-6 rounded-xl overflow-hidden">
                    <Descriptions.Item label="Email" span={1}>
                      <Space>
                        <MailOutlined className="text-primary" />
                        <a
                          href={`mailto:${selectedApplication.student?.email}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {selectedApplication.student?.email}
                        </a>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Contact" span={1}>
                      <Space>
                        <PhoneOutlined className="text-success" />
                        <a
                          href={`tel:${selectedApplication.student?.contact}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {selectedApplication.student?.contact}
                        </a>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Address" span={2}>
                      {selectedApplication.student?.address},{" "}
                      {selectedApplication.student?.city},{" "}
                      {selectedApplication.student?.state} -{" "}
                      {selectedApplication.student?.pinCode}
                    </Descriptions.Item>
                    <Descriptions.Item label="Parent Name">
                      {selectedApplication.student?.parentName}
                    </Descriptions.Item>
                    <Descriptions.Item label="Parent Contact">
                      <a
                        href={`tel:${selectedApplication.student?.parentContact}`}
                        className="text-primary hover:underline"
                      >
                        {selectedApplication.student?.parentContact}
                      </a>
                    </Descriptions.Item>
                    <Descriptions.Item label="Application Date" span={2}>
                      {formatDate(selectedApplication.appliedDate)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Status" span={2}>
                      <Tag color={getStatusColor(selectedApplication.status)} className="font-medium px-3 rounded-full">
                        {selectedApplication.status}
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </TabPane>

                <TabPane tab="Application" key="application">
                  <div className="space-y-6">
                    <div>
                      <Title level={5} className="text-text-primary mb-3">
                        Internship Applied For
                      </Title>
                      <div className="bg-primary-50 p-4 rounded-xl border border-primary-200">
                        <Text strong className="text-lg block text-primary-800">
                          {selectedApplication.internship?.title}
                        </Text>
                        <Text className="text-primary-700">
                          {selectedApplication.internship?.fieldOfWork} •{" "}
                          {selectedApplication.internship?.duration}
                        </Text>
                      </div>
                    </div>

                    <div>
                      <Title level={5} className="text-text-primary mb-3">
                        Cover Letter
                      </Title>
                      <div className="bg-background-tertiary p-6 rounded-xl border border-border">
                        <Paragraph className="mb-0 text-text-primary leading-relaxed text-base">
                          {selectedApplication.coverLetter}
                        </Paragraph>
                      </div>
                    </div>

                    {selectedApplication.additionalInfo && (
                      <div>
                        <Title level={5} className="text-text-primary mb-3">
                          Additional Information
                        </Title>
                        <div className="bg-background-tertiary/50 p-6 rounded-xl border border-border/50">
                          <Paragraph className="mb-0 text-text-primary leading-relaxed text-base">
                            {selectedApplication.additionalInfo}
                          </Paragraph>
                        </div>
                      </div>
                    )}

                    {selectedApplication.rejectionReason && (
                      <div>
                        <Title level={5} className="text-error mb-3">
                          Rejection Reason
                        </Title>
                        <div className="bg-error-50 p-6 rounded-xl border border-error-border">
                          <Paragraph className="mb-0 text-error-700 leading-relaxed text-base">
                            {selectedApplication.rejectionReason}
                          </Paragraph>
                        </div>
                      </div>
                    )}
                  </div>
                </TabPane>

                {/* Monthly Feedbacks Tab */}
                {selectedApplication.monthlyFeedbacks?.length > 0 && (
                  <TabPane
                    tab={
                      <span className="flex items-center">
                        <CalendarOutlined className="mr-2" />
                        Monthly Feedbacks
                        {selectedApplication.monthlyFeedbacks?.length > 0 && (
                          <Badge
                            count={selectedApplication.monthlyFeedbacks.length}
                            size="small"
                            className="ml-2"
                          />
                        )}
                      </span>
                    }
                    key="monthly"
                  >
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <Title level={5} className="!mb-0">
                          Monthly Progress Feedbacks
                        </Title>
                      </div>

                      {selectedApplication.monthlyFeedbacks?.length > 0 ? (
                        <div className="space-y-4">
                          {[...selectedApplication.monthlyFeedbacks]
                            .sort(
                              (a, b) =>
                                new Date(b.feedbackMonth) -
                                new Date(a.feedbackMonth)
                            )
                            .map((feedback, index) => (
                              <Card
                                key={feedback.id}
                                className="shadow-sm border-0"
                                title={
                                  <div className="flex justify-between items-center">
                                    <span>
                                      {dayjs(feedback.feedbackMonth).format(
                                        "MMMM YYYY"
                                      )}{" "}
                                      - Monthly Progress
                                    </span>
                                    <Text className="text-gray-500 text-sm font-normal">
                                      Submitted:{" "}
                                      {dayjs(feedback.submittedAt).format(
                                        "MMM DD, YYYY"
                                      )}
                                    </Text>
                                  </div>
                                }
                              >
                                <Row gutter={[24, 24]}>
                                  {/* Industry Feedback (Left Side) */}
                                  <Col xs={24} md={12}>
                                    <Card
                                      title={
                                        <span className="flex items-center text-blue-600">
                                          <BankOutlined className="mr-2" />
                                          Feedback by Industry
                                        </span>
                                      }
                                      size="small"
                                      className="h-full border-l-4 border-blue-500 bg-blue-50"
                                    >
                                      {feedback.industryId ? (
                                        <div className="space-y-3">
                                          {/* Overall Rating */}
                                          <div className="text-center p-3 bg-white rounded-lg border border-blue-200 mb-3">
                                            <div className="text-2xl font-bold text-blue-600">
                                              {feedback.overallRating || "N/A"}
                                            </div>
                                            <div className="text-sm text-gray-600">
                                              Overall Rating
                                            </div>
                                          </div>

                                          {/* Ratings Grid */}
                                          <div className="space-y-2 bg-white p-3 rounded-lg border border-blue-200">
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm">
                                                Attendance:
                                              </span>
                                              <Rate
                                                disabled
                                                value={
                                                  feedback.attendanceRating
                                                }
                                                size="small"
                                              />
                                            </div>
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm">
                                                Performance:
                                              </span>
                                              <Rate
                                                disabled
                                                value={
                                                  feedback.performanceRating
                                                }
                                                size="small"
                                              />
                                            </div>
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm">
                                                Punctuality:
                                              </span>
                                              <Rate
                                                disabled
                                                value={
                                                  feedback.punctualityRating
                                                }
                                                size="small"
                                              />
                                            </div>
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm">
                                                Technical Skills:
                                              </span>
                                              <Rate
                                                disabled
                                                value={
                                                  feedback.technicalSkillsRating
                                                }
                                                size="small"
                                              />
                                            </div>
                                          </div>

                                          {/* Text Feedbacks */}
                                          {feedback.strengths && (
                                            <div>
                                              <Text
                                                strong
                                                className="block mb-1"
                                              >
                                                Strengths:
                                              </Text>
                                              <p className="text-sm bg-white text-gray-800 p-3 rounded border border-blue-200">
                                                {feedback.strengths}
                                              </p>
                                            </div>
                                          )}

                                          {feedback.areasForImprovement && (
                                            <div>
                                              <Text
                                                strong
                                                className="block mb-1"
                                              >
                                                Areas for Improvement:
                                              </Text>
                                              <p className="text-sm bg-orange-100 text-gray-800 p-3 rounded border border-orange-200">
                                                {feedback.areasForImprovement}
                                              </p>
                                            </div>
                                          )}

                                          {feedback.tasksAssigned && (
                                            <div>
                                              <Text
                                                strong
                                                className="block mb-1"
                                              >
                                                Tasks Assigned:
                                              </Text>
                                              <p className="text-sm bg-purple-100 text-gray-800 p-3 rounded border border-purple-200">
                                                {feedback.tasksAssigned}
                                              </p>
                                            </div>
                                          )}

                                          {feedback.tasksCompleted && (
                                            <div>
                                              <Text
                                                strong
                                                className="block mb-1"
                                              >
                                                Tasks Completed:
                                              </Text>
                                              <p className="text-sm bg-green-100 text-gray-800 p-3 rounded border border-green-200">
                                                {feedback.tasksCompleted}
                                              </p>
                                            </div>
                                          )}

                                          {feedback.overallComments && (
                                            <div>
                                              <Text
                                                strong
                                                className="block mb-1"
                                              >
                                                Overall Comments:
                                              </Text>
                                              <p className="text-sm bg-white text-gray-800 p-3 rounded border italic border-blue-200">
                                                "{feedback.overallComments}"
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <Empty
                                          description="Industry feedback not submitted yet"
                                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                                        />
                                      )}
                                    </Card>
                                  </Col>

                                  {/* Student Feedback (Right Side) */}
                                  <Col xs={24} md={12}>
                                    <Card
                                      title={
                                        <span className="flex items-center text-green-600">
                                          <UserOutlined className="mr-2" />
                                          Feedback by Student
                                        </span>
                                      }
                                      size="small"
                                      className="h-full border-l-4 border-green-500 bg-green-50"
                                    >
                                      {feedback.studentId &&
                                      feedback.imageUrl ? (
                                        <div className="space-y-3">
                                          <div className="text-xs text-gray-500 mb-3">
                                            Submitted:{" "}
                                            {dayjs(
                                              feedback.submittedAt
                                            ).format("MMM DD, YYYY")}
                                          </div>

                                          {/* Student Image */}
                                          <div>
                                            <Text
                                              strong
                                              className="block mb-2"
                                            >
                                              Monthly Progress Image:
                                            </Text>
                                            <div className="bg-white p-2 rounded-lg border border-green-200">
                                              <img
                                                src={feedback.imageUrl}
                                                alt="Student feedback"
                                                className="w-full h-auto rounded-lg shadow-sm"
                                                style={{
                                                  maxHeight: "400px",
                                                  objectFit: "contain",
                                                }}
                                              />
                                            </div>
                                          </div>

                                          {/* View Full Image Button */}
                                          <Button
                                            type="link"
                                            icon={<EyeOutlined />}
                                            onClick={() =>
                                              window.open(
                                                feedback.imageUrl,
                                                "_blank"
                                              )
                                            }
                                            className="p-0"
                                          >
                                            View Full Image
                                          </Button>
                                        </div>
                                      ) : (
                                        <Empty
                                          description="Student feedback not submitted yet"
                                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                                        >
                                          <Text className="text-gray-400 text-sm block mb-3">
                                            Student can submit their monthly
                                            progress image
                                          </Text>
                                        </Empty>
                                      )}
                                    </Card>
                                  </Col>
                                </Row>
                              </Card>
                            ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                          <CalendarOutlined className="text-4xl text-gray-300 mb-4" />
                          <Title level={5} className="text-gray-500 mb-2">
                            No Monthly Feedbacks Yet
                          </Title>
                          <Text className="text-gray-400 block mb-4">
                            Monthly progress feedbacks will appear here once
                            submitted
                          </Text>
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() =>
                              navigate(
                                `/industry/reports?tab=monthly&applicationId=${selectedApplication.id}&studentName=${selectedApplication.student?.name}&mode=create`
                              )
                            }
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            Submit First Monthly Feedback
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabPane>
                )}

                {/* Completion Feedback Tab */}
                {selectedApplication.completionFeedback && (
                  <TabPane
                    tab={
                      <span className="flex items-center">
                        <TrophyOutlined className="mr-2" />
                        Completion Feedback
                        {selectedApplication.completionFeedback && (
                          <Badge status="success" className="ml-2" />
                        )}
                      </span>
                    }
                    key="completion"
                  >
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <Title level={5} className="!mb-0">
                          Internship Completion Assessment
                        </Title>
                      </div>

                      {selectedApplication.completionFeedback ? (
                        <>
                          {/* Summary Overview */}
                          <Card className="border border-purple-100 bg-purple-50 !mb-3">
                            <Row gutter={[24, 16]} className="mb-6">
                              <Col span={8}>
                                <div className="text-center p-4 bg-purple-50 rounded-lg">
                                  <div className="flex items-center justify-center mb-2">
                                    <StarOutlined className="text-purple-600 mr-1" />
                                    <span className="text-2xl font-bold text-purple-600">
                                      {selectedApplication.completionFeedback
                                        .industryRating || "N/A"}
                                    </span>
                                    <span className="text-purple-600 ml-1">
                                      /5
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    Overall Industry Rating
                                  </div>
                                </div>
                              </Col>
                              <Col span={8}>
                                <div className="text-center p-4 bg-green-50 rounded-lg">
                                  <div className="text-lg font-bold text-green-600 mb-1">
                                    {selectedApplication.completionFeedback
                                      .recommendForHire
                                      ? "YES"
                                      : "NO"}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    Recommend for Hire
                                  </div>
                                </div>
                              </Col>
                              <Col span={8}>
                                <div className="text-center p-4 bg-blue-50 rounded-lg">
                                  <div className="text-lg font-bold text-blue-600 mb-1">
                                    {selectedApplication.completionFeedback
                                      .isCompleted
                                      ? "COMPLETED"
                                      : "ONGOING"}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    Internship Status
                                  </div>
                                </div>
                              </Col>
                            </Row>
                          </Card>

                          {/* Detailed Feedback Cards */}
                          <div className="space-y-6">
                            <Card
                              className="shadow-sm border-0"
                              title={
                                <div className="flex justify-between items-center">
                                  <span>
                                    {selectedApplication.internship?.title ||
                                      "Internship"}{" "}
                                    - Completion Feedback
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Tag
                                      color={
                                        selectedApplication.completionFeedback
                                          .isCompleted
                                          ? "green"
                                          : "orange"
                                      }
                                    >
                                      {selectedApplication.completionFeedback
                                        .isCompleted
                                        ? "Completed"
                                        : "Pending"}
                                    </Tag>
                                    {selectedApplication.completionFeedback
                                      .completionCertificate && (
                                      <Button
                                        type="link"
                                        size="small"
                                        icon={<FileOutlined />}
                                      >
                                        Certificate
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              }
                            >
                              <Text type="secondary" className="block mb-4">
                                Created:{" "}
                                {formatDate(
                                  selectedApplication.completionFeedback
                                    .createdAt
                                )}
                              </Text>

                              <Row gutter={[24, 24]}>
                                {/* Student Feedback Column */}
                                <Col xs={24} md={12}>
                                  <Card
                                    title={
                                      <span className="flex items-center text-blue-600">
                                        <UserOutlined className="mr-2" />
                                        Feedback from Student to Industry
                                      </span>
                                    }
                                    size="small"
                                    className="h-full border-l-4 border-blue-500 bg-blue-50"
                                  >
                                    {selectedApplication.completionFeedback
                                      .studentSubmittedAt ? (
                                      <div className="space-y-3">
                                        <div className="text-xs text-gray-500 mb-3">
                                          Submitted:{" "}
                                          {formatDate(
                                            selectedApplication
                                              .completionFeedback
                                              .studentSubmittedAt
                                          )}
                                        </div>

                                        {/* Student Rating */}
                                        <div>
                                          <Text strong className="block mb-1">
                                            Overall Experience Rating:
                                          </Text>
                                          <Rate
                                            disabled
                                            value={
                                              selectedApplication
                                                .completionFeedback
                                                .studentRating
                                            }
                                          />
                                          <Text className="ml-2 text-sm">
                                            (
                                            {selectedApplication
                                              .completionFeedback
                                              .studentRating || 0}
                                            /5)
                                          </Text>
                                        </div>

                                        {/* Student Feedback */}
                                        {selectedApplication.completionFeedback
                                          .studentFeedback && (
                                          <div>
                                            <Text strong className="block mb-1">
                                              Feedback:
                                            </Text>
                                            <p className="text-sm bg-white text-gray-800 p-3 rounded border italic border-blue-200">
                                              "
                                              {
                                                selectedApplication
                                                  .completionFeedback
                                                  .studentFeedback
                                              }
                                              "
                                            </p>
                                          </div>
                                        )}

                                        {/* Skills Learned */}
                                        {selectedApplication.completionFeedback
                                          .skillsLearned && (
                                          <div>
                                            <Text strong className="block mb-1">
                                              Skills Learned:
                                            </Text>
                                            <p className="text-sm bg-yellow-200 text-gray-800 p-3 rounded border border-yellow-200">
                                              {
                                                selectedApplication
                                                  .completionFeedback
                                                  .skillsLearned
                                              }
                                            </p>
                                          </div>
                                        )}

                                        {/* Career Impact */}
                                        {selectedApplication.completionFeedback
                                          .careerImpact && (
                                          <div>
                                            <Text strong className="block mb-1">
                                              Career Impact:
                                            </Text>
                                            <p className="text-sm bg-orange-200 text-gray-800 p-3 rounded border border-orange-200">
                                              {
                                                selectedApplication
                                                  .completionFeedback
                                                  .careerImpact
                                              }
                                            </p>
                                          </div>
                                        )}

                                        {/* Recommendation */}
                                        <div>
                                          <Text strong className="block mb-1">
                                            Would Recommend:
                                          </Text>
                                          <Tag
                                            color={
                                              selectedApplication
                                                .completionFeedback
                                                .wouldRecommend
                                                ? "green"
                                                : "red"
                                            }
                                          >
                                            {selectedApplication
                                              .completionFeedback.wouldRecommend
                                              ? "Yes"
                                              : "No"}
                                          </Tag>
                                        </div>
                                      </div>
                                    ) : (
                                      <Empty
                                        description="Student feedback not submitted yet"
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                      />
                                    )}
                                  </Card>
                                </Col>

                                {/* Industry Feedback Column */}
                                <Col xs={24} md={12}>
                                  <Card
                                    title={
                                      <span className="flex items-center text-green-600">
                                        <BankOutlined className="mr-2" />
                                        Feedback by Industry to Student
                                      </span>
                                    }
                                    size="small"
                                    className="h-full border-l-4 border-green-500 bg-green-50"
                                  >
                                    {selectedApplication.completionFeedback
                                      .industrySubmittedAt ? (
                                      <div className="space-y-3">
                                        <div className="text-xs text-gray-500 mb-3">
                                          Submitted:{" "}
                                          {formatDate(
                                            selectedApplication
                                              .completionFeedback
                                              .industrySubmittedAt
                                          )}
                                        </div>

                                        {/* Industry Rating */}
                                        <div>
                                          <Text strong className="block mb-1">
                                            Student Performance Rating:
                                          </Text>
                                          <Rate
                                            disabled
                                            value={
                                              selectedApplication
                                                .completionFeedback
                                                .industryRating
                                            }
                                          />
                                          <Text className="ml-2 text-sm">
                                            (
                                            {selectedApplication
                                              .completionFeedback
                                              .industryRating || 0}
                                            /5)
                                          </Text>
                                        </div>

                                        {/* Industry Feedback */}
                                        {selectedApplication.completionFeedback
                                          .industryFeedback && (
                                          <div>
                                            <Text strong className="block mb-1">
                                              Feedback:
                                            </Text>
                                            <p className="text-sm bg-white text-gray-800 p-3 rounded border italic border-green-200">
                                              "
                                              {
                                                selectedApplication
                                                  .completionFeedback
                                                  .industryFeedback
                                              }
                                              "
                                            </p>
                                          </div>
                                        )}

                                        {/* Final Performance */}
                                        {selectedApplication.completionFeedback
                                          .finalPerformance && (
                                          <div>
                                            <Text strong className="block mb-1">
                                              Final Performance Assessment:
                                            </Text>
                                            <p className="text-sm bg-violet-200 text-gray-800 p-3 rounded border border-violet-200">
                                              {
                                                selectedApplication
                                                  .completionFeedback
                                                  .finalPerformance
                                              }
                                            </p>
                                          </div>
                                        )}

                                        {/* Hire Recommendation */}
                                        <div>
                                          <Text strong className="block mb-1">
                                            Recommend for Hire:
                                          </Text>
                                          <Tag
                                            color={
                                              selectedApplication
                                                .completionFeedback
                                                .recommendForHire
                                                ? "green"
                                                : "orange"
                                            }
                                          >
                                            {selectedApplication
                                              .completionFeedback
                                              .recommendForHire
                                              ? "Yes"
                                              : "No"}
                                          </Tag>
                                        </div>
                                      </div>
                                    ) : (
                                      <Empty
                                        description="Industry feedback not submitted yet"
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                      />
                                    )}
                                  </Card>
                                </Col>
                              </Row>
                            </Card>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                          <TrophyOutlined className="text-4xl text-gray-300 mb-4" />
                          <Title level={5} className="text-gray-500 mb-2">
                            No Completion Feedback Yet
                          </Title>
                          <Text className="text-gray-400 block mb-4">
                            Submit final assessment once the internship is
                            completed.
                          </Text>
                          <Button
                            type="primary"
                            icon={<CheckCircleOutlined />}
                            onClick={() =>
                              openCompletionModal(selectedApplication, null)
                            }
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            Complete Final Assessment
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabPane>
                )}
              </Tabs>
            </div>
          )}
        </Modal>
        {/* CompletionFeedbackModal Integration */}
        <CompletionFeedbackModal
          visible={completionModalVisible}
          onCancel={() => {
            setCompletionModalVisible(false);
            setCompletionModalAppId(null);
            setCompletionModalStudentName(null);
            setEditingCompletionFeedback(null);
          }}
          onSuccess={handleCompletionModalSuccess}
          preSelectedApplicationId={completionModalAppId}
          preSelectedStudentName={completionModalStudentName}
          editingFeedback={editingCompletionFeedback}
        />
        {/* Add the MonthlyFeedbackModal component before the closing div */}
        <MonthlyFeedbackModal
          visible={monthlyModalVisible}
          onCancel={() => {
            setMonthlyModalVisible(false);
            setMonthlyModalAppId(null);
            setMonthlyModalStudentName(null);
            setEditingMonthlyFeedback(null);
          }}
          onSuccess={handleMonthlyModalSuccess}
          preSelectedApplicationId={monthlyModalAppId}
          preSelectedStudentName={monthlyModalStudentName}
          editingFeedback={editingMonthlyFeedback}
        />
      </div>
    </div>
  );
};

export default ViewApplicants;