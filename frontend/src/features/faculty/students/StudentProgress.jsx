import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Row,
  Col,
  Card,
  List,
  Avatar,
  Typography,
  Input,
  Button,
  Statistic,
  Progress,
  Tag,
  Tabs,
  Modal,
  Form,
  DatePicker,
  Spin,
  Rate,
  Timeline,
  Empty,
  Divider,
  Alert,
  Tooltip,
  Select,
  Upload,
  Popconfirm,
  Space,
} from "antd";
import {
  UserOutlined,
  EditOutlined,
  PhoneOutlined,
  MailOutlined,
  TeamOutlined,
  BarChartOutlined,
  EyeOutlined,
  MessageOutlined,
  CommentOutlined,
  PlusOutlined,
  ShopOutlined,
  StarOutlined,
  CalendarOutlined,
  SearchOutlined,
  BankOutlined,
  FileOutlined,
  ReloadOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  TrophyOutlined,
  EnvironmentOutlined,
  DeleteOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import API from "../../../services/api";
import { toast } from "react-hot-toast";
import {
  fetchAssignedStudents,
  selectStudents,
} from "../store/facultySlice";
import { getDocumentUrl, getImageUrl } from "../../../utils/imageUtils";

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { TextArea } = Input;

// Helper to format dates consistently
const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return dayjs(dateString).format("DD MMM YYYY");
};
// const fmt = (d) => (d ? dayjs(d).format("DD MMM YYYY") : "N/A");
// --- Data Computation (Moved from component body for clarity) ---
function computeMetrics(assignment) {
  if (!assignment || !assignment.student) return {};
  const student = assignment.student;
  const internshipApps = student.internshipApplications || [];

  // Create copies of arrays before any operations that might mutate them
  const monthlyFeedbacks = [
    ...internshipApps.flatMap((a) => a.monthlyFeedbacks || []),
  ];
  const completionFeed = [
    ...internshipApps.flatMap((a) => a.completionFeedback || []),
  ];
  const monthlyReports = [
    ...internshipApps.flatMap((a) => a.monthlyReports || []),
  ];
  const allVisits = [
    ...internshipApps.flatMap((app) => app.facultyVisitLogs || []),
  ];

  const avg = (list, f) =>
    list.length
      ? Math.round(
          (list.reduce((s, x) => s + (x[f] || 0), 0) / list.length) * 10
        ) / 10
      : 0;

  const ratingProgress = {
    attendance: avg(monthlyFeedbacks, "attendanceRating"),
    performance: avg(monthlyFeedbacks, "performanceRating"),
    punctuality: avg(monthlyFeedbacks, "punctualityRating"),
    technicalSkills: avg(monthlyFeedbacks, "technicalSkillsRating"), // Fixed typo
  };

  const averageRating =
    Math.round(
      (Object.values(ratingProgress).reduce((a, b) => a + b, 0) / 4) * 10
    ) / 10;

  const visitAverageRating = avg(allVisits, "overallSatisfactionRating");

  return {
    // Create new sorted arrays instead of mutating existing ones
    internshipApps: [...internshipApps].sort(
      (a, b) => new Date(b.applicationDate) - new Date(a.applicationDate)
    ),
    monthlyFeedbacks: monthlyFeedbacks.sort(
      (a, b) => new Date(b.feedbackMonth) - new Date(a.feedbackMonth)
    ),
    completionFeedbacks: completionFeed.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    ),
    monthlyReports: monthlyReports.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    ),
    visits: allVisits.sort(
      (a, b) => new Date(b.visitDate) - new Date(a.visitDate)
    ),
    ratingProgress,
    averageRating,
    visitAverageRating,
  };
}

const StudentProgressPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Use Redux for students
  const studentsState = useSelector(selectStudents);
  const students = studentsState?.list || [];
  const loading = studentsState?.loading || false;
  const error = studentsState?.error || null;

  const [selected, setSelected] = useState(null);

  // Fetch students on mount
  useEffect(() => {
    dispatch(fetchAssignedStudents());
  }, [dispatch]);

  // Force refresh function
  const forceRefresh = useCallback(() => {
    dispatch(fetchAssignedStudents({ forceRefresh: true }));
  }, [dispatch]);

  const [search, setSearch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("feedback"); // 'feedback' or 'assignment'
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("overview");
  
  // Monthly report management state
  const [isReportUploadModalVisible, setIsReportUploadModalVisible] = useState(false);
  const [reportFile, setReportFile] = useState(null);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [selectedReportMonth, setSelectedReportMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedReportYear, setSelectedReportYear] = useState(() => new Date().getFullYear());

  // Handle URL parameters for auto-selection
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const studentId = params.get('studentId');
    const tab = params.get('tab');

    if (studentId && students.length > 0) {
      // Find and select the student
      const studentAssignment = students.find(s => s.student?.id === studentId);
      if (studentAssignment) {
        setSelected(studentAssignment);
        
        // Set the tab if provided
        if (tab) {
          setActiveTab(tab);
          
          // Show a notification
          toast.success(`Navigated to ${studentAssignment.student?.name}'s ${tab.replace('-', ' ')}`, {
            duration: 3000,
          });
        }
        
        // Clear the URL parameters after handling
        navigate(location.pathname, { replace: true });
      }
    }
  }, [location.search, students, navigate, location.pathname]);

  // useEffect(() => {
  //   fetchStudents();
  // }, []);

  // const fetchStudents = async () => {
  //   setLoading(true);
  //   try {
  //     const res = await API.get("/mentor/my-students");
  //     const assignments = res.data?.data || [];
  //     setStudents(assignments);
  //     // if (assignments.length && !selected) {
  //     //   setSelected(assignments[0]);
  //     // }
  //     // console.log(assignments)
  //   } catch {
  //     toast.error("Failed to load students");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const filtered = useMemo(() => {
    try {
      // Ensure students is an array
      if (!Array.isArray(students)) {
        console.warn("Students is not an array:", students);
        return [];
      }

      let result = students;

      // Filter by search
      if (search) {
        result = result.filter((item) => {
          // Safely check if item and student exist
          if (!item || !item.student) return false;

          const searchString = `${item.student.name || ""} ${
            item.student.rollNumber || ""
          }`.toLowerCase();
          return searchString.includes(search.toLowerCase());
        });
      }

      // Filter by branch
      if (selectedBranch) {
        result = result.filter((item) => {
          if (!item || !item.student) return false;
          const studentBranch = item.student.branchName || item.student.branch;
          return studentBranch === selectedBranch;
        });
      }

      // Deduplicate students based on student ID
      const seenStudentIds = new Set();
      const deduplicated = [];
      
      for (const item of result) {
        if (!item || !item.student || !item.student.id) continue;
        
        const studentId = item.student.id;
        
        if (!seenStudentIds.has(studentId)) {
          seenStudentIds.add(studentId);
          deduplicated.push(item);
        }
      }

      return deduplicated;
    } catch (err) {
      console.error("Error filtering students:", err);
      return [];
    }
  }, [students, search, selectedBranch]);

  const metrics = useMemo(
    () => (selected ? computeMetrics(selected) : {}),
    [selected]
  );

  // Get unique branches from all students
  const availableBranches = useMemo(() => {
    try {
      if (!Array.isArray(students)) return [];

      const branches = students
        .map((item) => item?.student?.branchName || item?.student?.branch)
        .filter(Boolean);
      return [...new Set(branches)].sort();
    } catch (err) {
      console.error("Error getting branches:", err);
      return [];
    }
  }, [students]);

  const profileKPIs = useMemo(() => {
    const apps = metrics.internshipApps || [];
    const active = apps.some((a) => a.status === "JOINED");
    return {
      status: active ? "Active Internship" : "No Active Internship",
      applications: apps.length,
      visits: metrics.visits?.length ?? 0,
      monthly: metrics.monthlyFeedbacks?.length ?? 0,
      completion: metrics.completionFeedbacks?.length ?? 0,
      monthlyReports: metrics.monthlyReports?.length ?? 0,
      progressPct: Math.round((metrics.averageRating || 0) * 20), // 5-star rating to percentage
      visitAvg: metrics.visitAverageRating || 0,
    };
  }, [metrics]);

  const openModal = (type) => {
    setModalType(type);
    setModalOpen(true);
    form.resetFields();
  };

  const submit = async (vals) => {
    if (!selected?.student?.id) {
      toast.error("No student selected.");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        ...vals,
        studentId: selected.student.id,
        dueDate: vals.dueDate?.toISOString(),
      };
      if (modalType === "feedback") {
        await API.post("/mentor/feedback", body);
      } else {
        await API.post("/assignments", body);
      }
      setModalOpen(false);
      // Optimistically update or refetch
      forceRefresh();
      toast.success(
        `${
          modalType.charAt(0).toUpperCase() + modalType.slice(1)
        } saved successfully!`
      );
    } catch {
      toast.error(`Failed to save ${modalType}.`);
    } finally {
      setSubmitting(false);
    }
  };

  // Monthly Report Handlers
  const handleOpenReportUpload = () => {
    if (!selected?.student?.id) {
      toast.error("No student selected");
      return;
    }
    
    // Find active application
    const activeApp = selected.student?.internshipApplications?.find(
      (app) => app.status === "ACTIVE" || app.status === "ACCEPTED" || app.hasJoined
    );
    
    if (!activeApp) {
      toast.error("Student has no active internship application");
      return;
    }
    
    setReportFile(null);
    setSelectedReportMonth(new Date().getMonth() + 1);
    setSelectedReportYear(new Date().getFullYear());
    setIsReportUploadModalVisible(true);
  };

  const handleReportUpload = async () => {
    if (!reportFile) {
      toast.error("Please select a file to upload");
      return;
    }

    if (!selected?.student?.id) {
      toast.error("No student selected");
      return;
    }

    // Find active application
    const activeApp = selected.student?.internshipApplications?.find(
      (app) => app.status === "ACTIVE" || app.status === "ACCEPTED" || app.hasJoined
    );

    if (!activeApp?.id) {
      toast.error("No active internship application found");
      return;
    }

    try {
      setUploadingReport(true);

      const formData = new FormData();
      formData.append("file", reportFile);
      formData.append("studentId", selected.student.id);
      formData.append("applicationId", activeApp.id);
      formData.append("month", selectedReportMonth.toString());
      formData.append("year", selectedReportYear.toString());

      await API.post("/monthly-reports/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("Monthly report uploaded successfully!");
      setIsReportUploadModalVisible(false);
      setReportFile(null);
      forceRefresh(); // Refresh student data
    } catch (error) {
      console.error("Error uploading monthly report:", error);
      toast.error(
        error.response?.data?.message || "Failed to upload monthly report"
      );
    } finally {
      setUploadingReport(false);
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!selected?.student?.id) {
      toast.error("No student selected");
      return;
    }

    try {
      await API.delete(`/monthly-reports/${reportId}`, {
        data: { studentId: selected.student.id },
      });
      
      toast.success("Monthly report deleted successfully!");
      forceRefresh(); // Refresh student data
    } catch (error) {
      console.error("Error deleting monthly report:", error);
      toast.error(
        error.response?.data?.message || "Failed to delete monthly report"
      );
    }
  };

  const reportFileProps = {
    beforeUpload: (file) => {
      const isPDF = file.type === "application/pdf";
      if (!isPDF) {
        toast.error("You can only upload PDF files!");
        return Upload.LIST_IGNORE;
      }
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) {
        toast.error("File must be smaller than 5MB!");
        return Upload.LIST_IGNORE;
      }
      setReportFile(file);
      return false; // Prevent auto upload
    },
    onRemove: () => {
      setReportFile(null);
    },
    fileList: reportFile ? [reportFile] : [],
  };

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="small" />
        <Text className="ml-3 text-lg">Loading Students...</Text>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Alert
          title="Error Loading Students"
          description={error}
          type="error"
          showIcon
          className="mb-4"
        />
        <Button
          type="primary"
          onClick={forceRefresh}
          icon={<ReloadOutlined />}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="">
        <div className="flex flex-wrap justify-between items-center mb-3">
          <Title level={3} className="text-blue-800 mb-0">
            <span className="pb-2">Student Internship Progress</span>
          </Title>
          <div className="flex gap-2">
            <Button
              icon={<ReloadOutlined />}
              onClick={forceRefresh}
              loading={loading}
              type="default"
            >
              Refresh Data
            </Button>
          </div>
        </div>

        <Row gutter={[16, 16]}>
          {/* Students List - Left Column */}
          <Col
            xs={24}
            sm={24}
            md={8}
            lg={6}
            xl={6}
            className="hide-scrollbar overflow-y-auto"
            style={{
              maxHeight: window.innerWidth < 768 ? "300px" : "80vh",
            }}
          >
            <Card
              title={
                <div className="flex items-center text-blue-800">
                  <TeamOutlined className="mr-2" /> My Students
                  <Text type="secondary" className="ml-auto text-xs">
                    {filtered.length} students
                  </Text>
                </div>
              }
              className="rounded-lg border-0"
              styles={{
                header: {
                  borderBottom: "2px solid #e6f7ff",
                  backgroundColor: "#f0f7ff",
                },
                body: {
                  padding: "0.5rem",
                  maxHeight: window.innerWidth < 768 ? "250px" : "none",
                  overflowY: "auto",
                },
              }}
            >
              <Input
                placeholder="Search Student..."
                className="mb-3 rounded-lg"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                prefix={<UserOutlined className="text-gray-400" />}
                allowClear
              />

              {/* Branch Filter */}
              <Select
                placeholder="Filter by Branch"
                className="mb-4 w-full"
                value={selectedBranch}
                onChange={setSelectedBranch}
                allowClear
                suffixIcon={<BankOutlined />}
              >
                {availableBranches.map((branch) => (
                  <Option key={branch} value={branch}>
                    {branch}
                  </Option>
                ))}
              </Select>

              <List
                itemLayout="horizontal"
                dataSource={filtered}
                locale={{ emptyText: "No students found" }}
                renderItem={(st) => (
                  <List.Item
                    onClick={() => setSelected(st)}
                    className={`
        cursor-pointer my-2 rounded-xl transition-all duration-300 ease-in-out

        ${
          selected?.id === st.id
            ? `bg-gradient-to-r from-blue-50 via-indigo-50 to-indigo-100 
               border-l-4 border-l-blue-500 shadow-sm
               dark:bg-gradient-to-r dark:from-blue-900/20 dark:via-indigo-900/30 dark:to-indigo-900/20
               dark:border-l-blue-400`
            : `hover:!bg-gray-100 dark:hover:!bg-gray-800/50 
               hover:shadow-md hover:translate-x-1`
        }
        dark:border-gray-700/30
      `}
                  >
                    <List.Item.Meta
                      className="px-3 py-1"
                      avatar={
                        <Avatar
                          size={50}
                          src={getImageUrl(st.student?.profileImage)}
                          icon={<UserOutlined />}
                          className={
                            selected?.id === st.id
                              ? "border-2 border-blue-400 dark:border-blue-500"
                              : "border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                          }
                        />
                      }
                      title={
                        <Title className="font-semibold !text-sm !text-gray-600 ">
                          {st.student?.name}
                        </Title>
                      }
                      description={
                        <div>
                          <Tag color="blue">{st.student?.branchName}</Tag>
                          <div className="mt-1 text-xs ">
                            {st.student?.rollNumber}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          {/* Student Details - Right Column */}
          <Col
            xs={24}
            sm={24}
            md={16}
            lg={18}
            xl={18}
            className="h-full hide-scrollbar overflow-y-auto"
            style={{ maxHeight: "80vh" }}
          >
            {selected ? (
              <div className="space-y-6">
                {/* Profile Header */}
                <Card className="border-0 rounded-lg">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <Avatar
                      size={90}
                      src={getImageUrl(selected.student?.profileImage)}
                      icon={<UserOutlined />}
                      className="border-4 border-white shadow-lg"
                    />
                    <div className="flex-grow text-center md:text-left">
                      <Title level={3} className="mb-0 text-blue-800">
                        {selected.student?.name}
                      </Title>
                      <Text className="text-gray-500">
                        {`${selected.student?.rollNumber} • ${selected.student?.branchName}`}
                      </Text>
                      <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                        {/* <Tag
                          color={
                            profileKPIs.status === "Active Internship"
                              ? "green"
                              : "red"
                          }
                          className="px-3 py-1 rounded-full"
                        >
                          {profileKPIs.status}
                        </Tag> */}
                        <Tag color="blue" className="px-3 py-1 rounded-full">
                          Applications: {profileKPIs.applications}
                        </Tag>
                        <Tag color="cyan" className="px-3 py-1 rounded-full">
                          Visits Logged: {profileKPIs.visits}
                        </Tag>
                        <Tag color="purple" className="px-3 py-1 rounded-full">
                          Monthly Reports: {profileKPIs.monthlyReports}
                        </Tag>
                        {/* <Tag color="purple" className="px-3 py-1 rounded-full">
                          Feedbacks: {profileKPIs.feedbacks}
                        </Tag> */}
                        {/* <Tag color="purple">
                          Monthly FB: {profileKPIs.monthly}
                        </Tag> */}
                        {/* <Tag color="purple">
                          Completion FB: {profileKPIs.completion}
                        </Tag> */}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* <div>
                        <Progress
                          type="dashboard"
                          percent={profileKPIs.progressPct}
                          format={(percent) => `${(percent / 20).toFixed(1)}/5`}
                          width={90}
                          strokeColor={{
                            "0%": "#faad14",
                            "100%": "#52c41a",
                          }}
                        />
                        <p className="text-sm mr-5">Overall Progress</p>
                      </div> */}
                      {/* <Statistic
                        value={profileKPIs.visitAvg}
                        precision={1}
                        suffix="/ 5"
                        title="Avg. Visit Rating"
                        prefix={<StarOutlined />}
                        className="text-center"
                      /> */}
                    </div>
                  </div>
                </Card>

                {/* Detailed Information in Tabs */}
                <Card className="rounded-lg !mt-3" styles={{ body: { padding: 0 } }}>
                  <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    tabBarStyle={{
                      padding: "10px 16px 0",
                      marginBottom: 0,
                    }}
                  >
                    <TabPane
                      tab={
                        <span>
                          <BarChartOutlined /> Overview
                        </span>
                      }
                      key="overview"
                      className="p-4"
                    >
                      <Row gutter={[16, 16]}>
                        {/* internship list */}
                        <Col xs={24} md={12}>
                          <Card
                            title={
                              <div className="flex items-center justify-between">
                                <span className="flex items-center">
                                  <ShopOutlined className="mr-2 text-blue-500" />
                                  Internship Applications
                                </span>
                                <Text type="secondary" className="text-sm">
                                  {metrics.internshipApps?.length || 0} total
                                </Text>
                              </div>
                            }
                            size="small"
                            className="border-0 h-full "
                            extra={
                              metrics.internshipApps?.length > 3 && (
                                <Button type="link" size="small">
                                  View All ({metrics.internshipApps.length})
                                </Button>
                              )
                            }
                          >
                            {metrics.internshipApps?.length ? (
                              <List
                                dataSource={metrics.internshipApps.slice(0, 3)} // Show only first 3
                                renderItem={(app, index) => {
                                  // Check if it's a self-identified internship
                                  const isSelfIdentified =
                                    !app.internshipId || !app.internship;

                                  return (
                                    <List.Item
                                      key={app.id}
                                      className={`rounded-lg !p-3 mb-3 border-l-4`}
                                      style={{
                                        borderLeftColor: isSelfIdentified
                                          ? "#722ed1"
                                          : "#1890ff",
                                      }}
                                    >
                                      <div className="w-full">
                                        {/* Self-Identified Badge */}
                                        {isSelfIdentified && (
                                          <Tag
                                            color="purple"
                                            className="!mb-2"
                                            icon={<BankOutlined />}
                                          >
                                            Self-Identified
                                          </Tag>
                                        )}

                                        {/* Header with Title and Status */}
                                        <div className="flex items-start justify-between mb-2">
                                          <div className="flex-1">
                                            <Text
                                              strong
                                              className="text-base block mb-1"
                                            >
                                              {isSelfIdentified
                                                ? app.companyName ||
                                                  "Self-Identified Position"
                                                : app.internship?.title ||
                                                  "Untitled Position"}
                                            </Text>
                                            {!isSelfIdentified && (
                                              <div className="flex items-center gap-2 mb-2">
                                                <BankOutlined className="text-gray-500" />
                                                <Text className="text-sm text-gray-600">
                                                  {app.internship?.industry
                                                    ?.companyName ||
                                                    "Company Name"}
                                                </Text>
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex flex-col items-end gap-1">
                                            <Tag
                                              color={
                                                app.hasJoined
                                                  ? "green"
                                                  : app.status === "COMPLETED"
                                                  ? "green"
                                                  : app.status === "REJECTED"
                                                  ? "red"
                                                  : app.status ===
                                                    "UNDER_REVIEW"
                                                  ? "orange"
                                                  : "blue"
                                              }
                                              className="font-medium"
                                            >
                                              {app.hasJoined
                                                ? "ACTIVE"
                                                : app.status}
                                            </Tag>
                                            {app.isSelected &&
                                              !app.hasJoined && (
                                                <Tag color="gold" size="small">
                                                  <StarOutlined className="mr-1" />
                                                  Selected
                                                </Tag>
                                              )}
                                            {app.isApproved && (
                                              <Tag color="green" size="small">
                                                Approved
                                              </Tag>
                                            )}
                                          </div>
                                        </div>

                                        {/* Internship Details - Only for regular internships */}
                                        {!isSelfIdentified ? (
                                          <>
                                            <div className="grid grid-cols-2 gap-4 mb-3">
                                              <div>
                                                <Text className="text-xs text-gray-500 block">
                                                  Duration
                                                </Text>
                                                <Text className="text-sm font-medium">
                                                  {app.internship?.duration ||
                                                    "Not specified"}
                                                </Text>
                                              </div>
                                              <div>
                                                <Text className="text-xs text-gray-500 block">
                                                  Location
                                                </Text>
                                                <Text className="text-sm font-medium">
                                                  {app.internship
                                                    ?.workLocation ||
                                                    app.internship?.industry
                                                      ?.address ||
                                                    "Not specified"}
                                                </Text>
                                              </div>
                                              <div>
                                                <Text className="text-xs text-gray-500 block">
                                                  Stipend
                                                </Text>
                                                <Text className="text-sm font-medium text-green-600">
                                                  {app.internship?.stipendAmount
                                                    ? `₹${app.internship.stipendAmount}`
                                                    : "Not disclosed"}
                                                </Text>
                                              </div>
                                              <div>
                                                <Text className="text-xs text-gray-500 block">
                                                  Mode
                                                </Text>
                                                <Text className="text-sm font-medium">
                                                  {app.internship
                                                    ?.workLocation ||
                                                    "Not specified"}
                                                </Text>
                                              </div>
                                            </div>
                                          </>
                                        ) : (
                                          <div className="bg-purple-150 border border-purple-200 p-2 rounded-lg mb-3">
                                            <Text className="text-xs text-purple-600">
                                              Self-identified internship
                                            </Text>
                                          </div>
                                        )}

                                        {/* Important Dates */}
                                        <div className="grid grid-cols-2 gap-4 mb-3">
                                          <div className="flex items-center gap-2">
                                            <CalendarOutlined className="text-blue-500 text-xs" />
                                            <div>
                                              <Text className="text-xs text-gray-500 block">
                                                Applied
                                              </Text>
                                              <Text className="text-xs font-medium">
                                                {formatDate(
                                                  app.applicationDate
                                                )}
                                              </Text>
                                            </div>
                                          </div>
                                          {app.proposedFirstVisit && (
                                            <div className="flex items-center gap-2">
                                              <EyeOutlined className="text-green-500 text-xs" />
                                              <div>
                                                <Text className="text-xs text-gray-500 block">
                                                  First Visit
                                                </Text>
                                                <Text className="text-xs font-medium">
                                                  {formatDate(
                                                    app.proposedFirstVisit
                                                  )}
                                                </Text>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </List.Item>
                                  );
                                }}
                                className="max-h-96 overflow-y-auto hide-scrollbar"
                              />
                            ) : (
                              <Empty
                                description={
                                  <div className="text-center py-4">
                                    <Text className="text-gray-400">
                                      No internship applications
                                    </Text>
                                    <br />
                                    <Text className="text-xs text-gray-500">
                                      Applications will appear here once the
                                      student applies for internships
                                    </Text>
                                  </div>
                                }
                                image={
                                  <ShopOutlined className="text-4xl text-gray-300" />
                                }
                              />
                            )}
                          </Card>
                        </Col>

                        {/* skills */}
                        {/* <Col xs={24} md={7}>
                          <Card
                            title={
                              <div className="flex items-center gap-2">
                                <StarOutlined className="text-yellow-500" />
                                <span>Monthly Ratings</span>
                              </div>
                            }
                            size="small"
                            className="border-0 h-full"
                          >
                            {metrics.ratingProgress &&
                            Object.keys(metrics.ratingProgress).length ? (
                              <div className="space-y-4">
                           
                                <div className="grid grid-cols-2 gap-3">
                                  {Object.entries(metrics.ratingProgress).map(
                                    ([key, value]) => (
                                      <div
                                        key={key}
                                        className="text-center p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg hover:shadow-sm transition-all duration-200"
                                      >
                                        <div className="text-lg font-bold text-gray-800">
                                          {value.toFixed(1)}
                                        </div>
                                        <div className="text-xs text-gray-600 capitalize">
                                          {key.replace(/([A-Z])/g, " $1")}
                                        </div>
                             
                                        <div className="flex justify-center mt-1">
                                          <Rate
                                            disabled
                                            value={value}
                                            style={{ fontSize: 12 }}
                                            className="text-yellow-400"
                                          />
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>

                          
                                <div className="flex items-center justify-center pt-4 border-t border-gray-100">
                                  <div className="text-center">
                                    <div className="relative inline-flex items-center justify-center">
                                      <svg className="w-16 h-16 transform -rotate-90">
                                        <circle
                                          cx="32"
                                          cy="32"
                                          r="28"
                                          stroke="#f3f4f6"
                                          strokeWidth="4"
                                          fill="transparent"
                                        />
                                        <circle
                                          cx="32"
                                          cy="32"
                                          r="28"
                                          stroke="#3b82f6"
                                          strokeWidth="4"
                                          fill="transparent"
                                          strokeDasharray={`${
                                            metrics.averageRating * 20 * 1.76
                                          } 176`}
                                          className="transition-all duration-500 ease-in-out"
                                        />
                                      </svg>
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="text-sm font-bold text-gray-800">
                                          {metrics.averageRating.toFixed(1)}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      Average Score
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <Empty
                                description="No ratings available"
                                image={
                                  <StarOutlined className="text-4xl text-gray-300" />
                                }
                                className="py-8"
                              >
                                <Text className="text-gray-500 text-sm">
                                  Ratings will appear here once students submit
                                  monthly feedback
                                </Text>
                              </Empty>
                            )}
                          </Card>
                        </Col> */}

                        {/* visits */}
                        <Col xs={24} md={12}>
                          <Card
                            title="Recent Visits"
                            size="small"
                            className="border-0 h-full"
                          >
                            {metrics.visits?.length ? (
                              <Timeline
                                items={metrics.visits.slice(0, 5).map((v) => ({
                                  key: v.id,
                                  color: "blue",
                                  content: (
                                    <>
                                      <Text strong>
                                        {formatDate(v.visitDate)}
                                      </Text>
                                      <br />
                                      <Text type="secondary" className="text-xs">
                                        {v.application?.internship?.title ||
                                          v.internship?.title ||
                                          "Internship Title"}{" "}
                                        <br />
                                        {v.application?.internship?.industry
                                          ?.companyName ||
                                          v.application?.companyName ||
                                          v.internship?.industry?.companyName ||
                                          "Company"}
                                      </Text>
                                      <br />
                                      {/* <Rate
                                        disabled
                                        value={v.overallSatisfactionRating}
                                        style={{ fontSize: 12 }}
                                      /> */}
                                    </>
                                  ),
                                }))}
                              />
                            ) : (
                              <Empty description="No visits" />
                            )}
                          </Card>
                        </Col>
                      </Row>
                    </TabPane>

                    <TabPane
                      tab={
                        <span>
                          <EyeOutlined /> Visits ({metrics.visits?.length || 0})
                        </span>
                      }
                      key="visits"
                      className="p-4"
                    >
                      {metrics.visits?.length > 0 ? (
                        <div className="!space-y-4">
                          {metrics.visits.map((visit, index) => {
                            const getRemainingDays = (dateString) => {
                              if (!dateString) return null;
                              const targetDate = dayjs(dateString);
                              const currentDate = dayjs();
                              const daysDifference = targetDate.diff(
                                currentDate,
                                "day"
                              );

                              if (daysDifference < 0)
                                return {
                                  text: `${Math.abs(daysDifference)} days ago`,
                                  color: "red",
                                };
                              if (daysDifference === 0)
                                return { text: "Today", color: "orange" };
                              if (daysDifference <= 7)
                                return {
                                  text: `${daysDifference} days left`,
                                  color: "orange",
                                };
                              return {
                                text: `${daysDifference} days left`,
                                color: "green",
                              };
                            };

                            const nextVisitInfo = visit.nextVisitDate
                              ? getRemainingDays(visit.nextVisitDate)
                              : null;
                            const isLatestVisit = index === 0;

                            return (
                              <Card
                                key={visit.id}
                                size="small"
                                className={`shadow-sm`}
                              >
                                {/* Visit Header */}
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="font-medium ">
                                      Visit #{visit.visitNumber || index + 1}
                                    </div>
                                    {isLatestVisit && (
                                      <Tag
                                        color="green"
                                        icon={<CheckCircleOutlined />}
                                      >
                                        Latest
                                      </Tag>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <Tag
                                      color={
                                        visit.visitType === "PHYSICAL"
                                          ? "blue"
                                          : visit.visitType === "VIRTUAL"
                                          ? "green"
                                          : "orange"
                                      }
                                    >
                                      {visit.visitType}
                                    </Tag>
                                    {visit.followUpRequired && (
                                      <Tag
                                        color="orange"
                                        icon={<ExclamationCircleOutlined />}
                                      >
                                        Follow-up
                                      </Tag>
                                    )}
                                  </div>
                                </div>

                                {/* Visit Details Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                  {/* Left Column - Basic Info */}
                                  <div className="!space-y-2">
                                    <div className="flex items-center gap-2 text-sm ">
                                      <CalendarOutlined className="!text-blue-500" />
                                      <span>Visit Date:</span>
                                      <span className="font-medium ">
                                        {formatDate(visit.visitDate)}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm ">
                                      <UserOutlined className="!text-green-500" />
                                      <span>Faculty:</span>
                                      <span className="font-medium ">
                                        {visit.faculty?.name || "N/A"}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm ">
                                      <BankOutlined className="!text-purple-500" />
                                      <span>Company (Internship):</span>
                                      <span className="font-medium ">
                                        {visit.application?.internship?.industry
                                          ?.companyName ||
                                          visit.application?.companyName ||
                                          visit.internship?.industry
                                            ?.companyName ||
                                          "N/A"}
                                        {(visit.application?.internship
                                          ?.title ||
                                          visit.internship?.title) && (
                                          <span className="text-gray-500">
                                            {" "}
                                            (
                                            {visit.application?.internship
                                              ?.title ||
                                              visit.internship?.title}
                                            )
                                          </span>
                                        )}
                                      </span>
                                    </div>

                                    {visit.visitDuration && (
                                      <div className="flex items-center gap-2 text-sm ">
                                        <ClockCircleOutlined className="!text-orange-500" />
                                        <span>Duration:</span>
                                        <span className="font-medium ">
                                          {visit.visitDuration}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Right Column - Ratings & Additional Info */}
                                  <div className="!space-y-2">
                                    {/* {visit.overallSatisfactionRating && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <StarOutlined className="text-yellow-500" />
                                        <span className="text-gray-600">
                                          Overall:
                                        </span>
                                        <Rate
                                          disabled
                                          value={
                                            visit.overallSatisfactionRating
                                          }
                                          style={{ fontSize: 12 }}
                                          className="text-yellow-400"
                                        />
                                        <span className="text-xs text-gray-500">
                                          ({visit.overallSatisfactionRating}/5)
                                        </span>
                                      </div>
                                    )} */}

                                    {/* {visit.studentProgressRating && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <TrophyOutlined className="text-green-500" />
                                        <span className="text-gray-600">
                                          Student Progress:
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <div
                                            className={`w-2 h-2 rounded-full ${
                                              visit.studentProgressRating >= 4
                                                ? "bg-green-500"
                                                : visit.studentProgressRating >=
                                                  3
                                                ? "bg-yellow-500"
                                                : "bg-red-500"
                                            }`}
                                          />
                                          <span className="font-medium text-gray-800">
                                            {visit.studentProgressRating}/5
                                          </span>
                                        </div>
                                      </div>
                                    )} */}

                                    {/* {visit.workEnvironmentRating && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <EnvironmentOutlined className="text-blue-500" />
                                        <span className="text-gray-600">
                                          Environment:
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <div
                                            className={`w-2 h-2 rounded-full ${
                                              visit.workEnvironmentRating >= 4
                                                ? "bg-green-500"
                                                : visit.workEnvironmentRating >=
                                                  3
                                                ? "bg-yellow-500"
                                                : "bg-red-500"
                                            }`}
                                          />
                                          <span className="font-medium text-gray-800">
                                            {visit.workEnvironmentRating}/5
                                          </span>
                                        </div>
                                      </div>
                                    )} */}

                                    {/* {visit.attendeesList &&
                                      visit.attendeesList.length > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                          <TeamOutlined className="text-indigo-500" />
                                          <span>Attendees:</span>
                                          <span className="font-medium text-gray-800">
                                            {visit.attendeesList.length} person
                                            {visit.attendeesList.length > 1
                                              ? "s"
                                              : ""}
                                          </span>
                                        </div>
                                      )} */}
                                  </div>
                                </div>

                                {/* Next Visit Information */}
                                {visit.nextVisitDate && nextVisitInfo && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <CalendarOutlined className="!text-green-500" />
                                        <span className="text-sm ">
                                          Next Visit:
                                        </span>
                                        <span className="text-sm font-medium ">
                                          {formatDate(visit.nextVisitDate)}
                                        </span>
                                      </div>
                                      <Tag
                                        color={nextVisitInfo.color}
                                        className="font-medium"
                                      >
                                        {nextVisitInfo.text}
                                      </Tag>
                                    </div>
                                  </div>
                                )}

                                {/* Observations Section */}
                                {(visit.observationsAboutStudent ||
                                  visit.feedbackSharedWithStudent) && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <div className="space-y-3">
                                      {visit.observationsAboutStudent && (
                                        <div className="bg-purple-50 p-3 rounded-lg border-l-4 border-purple-500">
                                          <div className="flex items-center gap-2 mb-2">
                                            <MessageOutlined className="!text-purple-600" />
                                            <Text
                                              strong
                                              className="!text-purple-700 text-sm"
                                            >
                                              Observations About Student
                                            </Text>
                                          </div>
                                          <Text className="!text-gray-700 text-xs block">
                                            {visit.observationsAboutStudent}
                                          </Text>
                                        </div>
                                      )}

                                      {visit.feedbackSharedWithStudent && (
                                        <div className="bg-indigo-50 p-3 rounded-lg border-l-4 border-indigo-500">
                                          <div className="flex items-center gap-2 mb-2">
                                            <CommentOutlined className="!text-indigo-600" />
                                            <Text
                                              strong
                                              className="!text-indigo-700 text-sm"
                                            >
                                              Feedback Shared With Student
                                            </Text>
                                          </div>
                                          <Text className="!text-gray-700 text-xs block">
                                            {visit.feedbackSharedWithStudent}
                                          </Text>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Additional Information Section */}
                                {(visit.titleOfProjectWork ||
                                  visit.assistanceRequiredFromInstitute ||
                                  visit.responseFromOrganisation ||
                                  visit.remarksOfOrganisationSupervisor ||
                                  visit.significantChangeInPlan) && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <Text
                                      strong
                                      className="text-gray-700 text-sm block mb-3"
                                    >
                                      Additional Information
                                    </Text>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {visit.titleOfProjectWork && (
                                        <div className="bg-blue-50 p-2 rounded text-xs">
                                          <Text
                                            strong
                                            className="!text-blue-700 block mb-1"
                                          >
                                            Title of Project/Work:
                                          </Text>
                                          <Text className="!text-gray-700">
                                            {visit.titleOfProjectWork}
                                          </Text>
                                        </div>
                                      )}

                                      {visit.assistanceRequiredFromInstitute && (
                                        <div className="bg-green-50 p-2 rounded text-xs">
                                          <Text
                                            strong
                                            className="!text-green-700 block mb-1"
                                          >
                                            Assistance Required:
                                          </Text>
                                          <Text className="!text-gray-700">
                                            {visit.assistanceRequiredFromInstitute}
                                          </Text>
                                        </div>
                                      )}

                                      {visit.responseFromOrganisation && (
                                        <div className="bg-yellow-50 p-2 rounded text-xs">
                                          <Text
                                            strong
                                            className="!text-yellow-700 block mb-1"
                                          >
                                            Response from Organisation:
                                          </Text>
                                          <Text className="!text-gray-700">
                                            {visit.responseFromOrganisation}
                                          </Text>
                                        </div>
                                      )}

                                      {visit.remarksOfOrganisationSupervisor && (
                                        <div className="bg-orange-50 p-2 rounded text-xs">
                                          <Text
                                            strong
                                            className="!text-orange-700 block mb-1"
                                          >
                                            Supervisor Remarks:
                                          </Text>
                                          <Text className="!text-gray-700">
                                            {visit.remarksOfOrganisationSupervisor}
                                          </Text>
                                        </div>
                                      )}

                                      {visit.significantChangeInPlan && (
                                        <div className="bg-red-50 p-2 rounded text-xs md:col-span-2">
                                          <Text
                                            strong
                                            className="!text-red-700 block mb-1"
                                          >
                                            Significant Change in Plan:
                                          </Text>
                                          <Text className="!text-gray-700">
                                            {visit.significantChangeInPlan}
                                          </Text>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </Card>
                            );
                          })}
                        </div>
                      ) : (
                        <Empty
                          description="No faculty visits have been logged."
                          image={
                            <EyeOutlined className="text-4xl text-gray-300" />
                          }
                          className="py-12"
                        >
                          <Text className="text-gray-500">
                            Visit logs will appear here once faculty members
                            conduct visits
                          </Text>
                        </Empty>
                      )}
                    </TabPane>

                    {/* ─── Monthly Feedbacks ───────────────────────────────── */}
                    {/* <TabPane
                      key="3"
                      tab={
                        <span>
                          <MessageOutlined /> Monthly Feedbacks (
                          {metrics.monthlyFeedbacks?.length || 0})
                        </span>
                      }
                    >
                      {metrics.monthlyFeedbacks?.length ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-3">
                          {metrics.monthlyFeedbacks.map((fb) => (
                            <Card
                              key={fb.id}
                              size="small"
                              className="border-l-4 border-green-500 bg-green-50 shadow-sm hover:shadow-md transition-shadow"
                            >
                           
                              <div className="flex justify-between items-center mb-3">
                                <div>
                                  <Text strong className="text-sm">
                                    {dayjs(fb.feedbackMonth).format("MMM YYYY")}
                                  </Text>
                                  <div className="text-xs text-gray-500">
                                    {fb.industry?.companyName || "Company"}
                                  </div>
                                </div>
                                <div className="text-center">
                                  <Rate
                                    disabled
                                    value={fb.overallRating}
                                    style={{ fontSize: 12 }}
                                  />
                                  <div className="text-xs text-gray-500">
                                    Overall
                                  </div>
                                </div>
                              </div>

                             
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                {[
                                  {
                                    label: "Attendance",
                                    key: "attendanceRating",
                                    color: "blue",
                                  },
                                  {
                                    label: "Performance",
                                    key: "performanceRating",
                                    color: "green",
                                  },
                                  {
                                    label: "Punctuality",
                                    key: "punctualityRating",
                                    color: "orange",
                                  },
                                  {
                                    label: "Tech Skills",
                                    key: "technicalSkillsRating",
                                    color: "purple",
                                  },
                                ].map(({ label, key, color }) => (
                                  <div
                                    key={key}
                                    className="flex items-center justify-between"
                                  >
                                    <Text className="text-xs text-gray-600">
                                      {label}:
                                    </Text>
                                    <div className="flex items-center gap-1">
                                      <div
                                        className={`w-2 h-2 rounded-full bg-${color}-500`}
                                        style={{
                                          backgroundColor:
                                            color === "blue"
                                              ? "#3b82f6"
                                              : color === "green"
                                              ? "#10b981"
                                              : color === "orange"
                                              ? "#f59e0b"
                                              : "#8b5cf6",
                                        }}
                                      />
                                      <Text className="text-xs font-medium">
                                        {fb[key] || 0}/5
                                      </Text>
                                    </div>
                                  </div>
                                ))}
                              </div>

                            
                              <div className="space-y-2">
                                {fb.strengths && (
                                  <div className="bg-green-100 p-2 rounded">
                                    <Text
                                      strong
                                      className="text-xs !text-green-700"
                                    >
                                      Strengths:
                                    </Text>
                                    <p className="text-xs text-gray-700 mt-1 line-clamp-2">
                                      {fb.strengths}
                                    </p>
                                  </div>
                                )}

                                {fb.areasForImprovement && (
                                  <div className="bg-orange-100 p-2 rounded">
                                    <Text
                                      strong
                                      className="text-xs !text-orange-700"
                                    >
                                      Areas to Improve:
                                    </Text>
                                    <p className="text-xs text-gray-700 mt-1 line-clamp-2">
                                      {fb.areasForImprovement}
                                    </p>
                                  </div>
                                )}

                                {fb.overallComments && (
                                  <div className="bg-gray-100 p-2 rounded border-l-2 border-gray-400">
                                    <p className="text-xs text-gray-700 italic line-clamp-2">
                                      "{fb.overallComments}"
                                    </p>
                                  </div>
                                )}
                              </div>

                            
                              <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200">
                                <Text className="text-xs text-gray-400">
                                  <CalendarOutlined className="mr-1" />
                                  {formatDate(fb.submittedAt)}
                                </Text>
                              </div>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <Empty
                          description="No monthly feedback available"
                          image={
                            <MessageOutlined className="text-4xl text-gray-300" />
                          }
                        >
                          <Text className="text-gray-500 text-sm">
                            Monthly feedback will appear here once students
                            submit their reports
                          </Text>
                        </Empty>
                      )}
                    </TabPane> */}

                    {/* ─── Completion Feedbacks ────────────────────────────── */}
                    {/* <TabPane
                      key="4"
                      tab={
                        <span>
                          <MessageOutlined /> Completion Feedback (
                          {metrics.completionFeedbacks?.length || 0})
                        </span>
                      }
                    >
                      {metrics.completionFeedbacks?.length ? (
                        <div className="!space-y-6 ">
                          {metrics.completionFeedbacks.map((fb) => (
                            <Card
                              variant="borderless"
                              key={fb.id}
                              className="shadow-sm border-0"
                            >
                              <div className="flex justify-between items-start !mb-4">
                                <div>
                                  <Title level={4} className="mb-1">
                                    {fb.application?.internship?.title ||
                                      "Internship"}{" "}
                                    - Completion Feedback
                                  </Title>
                                  <Text type="secondary" className="text-sm">
                                    Created: {formatDate(fb.createdAt)} •
                                    Status:{" "}
                                    <Tag
                                      color={
                                        fb.isCompleted ? "green" : "orange"
                                      }
                                    >
                                      {fb.isCompleted ? "Completed" : "Pending"}
                                    </Tag>
                                  </Text>
                                </div>
                                {fb.completionCertificate && (
                                  <Button
                                    type="link"
                                    size="small"
                                    icon={<FileOutlined />}
                                  >
                                    Certificate
                                  </Button>
                                )}
                              </div>

                              <Row gutter={[24, 24]}>
                             
                                <Col xs={24} md={12}>
                                  <Card
                                    title={
                                      <span className="flex items-center text-blue-600">
                                        <UserOutlined className="mr-2" />
                                        Feedback by Student to Industry
                                      </span>
                                    }
                                    size="small"
                                    className="h-full border-l-4 border-blue-500 bg-blue-50"
                                  >
                                    {fb.studentSubmittedAt ? (
                                      <div className="space-y-3">
                                        <div className="text-xs text-gray-500 mb-3">
                                          Submitted:{" "}
                                          {formatDate(fb.studentSubmittedAt)}
                                        </div>

                                  
                                        <div>
                                          <Text strong className="block mb-1">
                                            Overall Experience Rating:
                                          </Text>
                                          <Rate
                                            disabled
                                            value={fb.studentRating}
                                          />
                                          <Text className="ml-2 text-sm">
                                            ({fb.studentRating || 0}/5)
                                          </Text>
                                        </div>

                            
                                        {fb.studentFeedback && (
                                          <div>
                                            <Text strong className="block mb-1">
                                              Feedback:
                                            </Text>
                                            <p className="text-sm bg-blue-200 text-gray-800 p-2 rounded border italic">
                                              "{fb.studentFeedback}"
                                            </p>
                                          </div>
                                        )}

                                  
                                        {fb.skillsLearned && (
                                          <div>
                                            <Text strong className="block mb-1">
                                              Skills Learned:
                                            </Text>
                                            <p className="text-sm bg-violet-200 text-gray-800 p-2 rounded border">
                                              {fb.skillsLearned}
                                            </p>
                                          </div>
                                        )}

                       
                                        {fb.careerImpact && (
                                          <div>
                                            <Text strong className="block mb-1">
                                              Career Impact:
                                            </Text>
                                            <p className="text-sm bg-orange-200 text-gray-800 p-2 rounded border">
                                              {fb.careerImpact}
                                            </p>
                                          </div>
                                        )}

                           
                                        <div>
                                          <Text strong className="block mb-1">
                                            Would Recommend:
                                          </Text>
                                          <Tag
                                            color={
                                              fb.wouldRecommend
                                                ? "green"
                                                : "red"
                                            }
                                          >
                                            {fb.wouldRecommend ? "Yes" : "No"}
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

                             
                                <Col xs={24} md={12}>
                                  <Card
                                    title={
                                      <span className="flex items-center text-green-600">
                                        <BankOutlined className="mr-2" />
                                        Feedback from Industry to Student
                                      </span>
                                    }
                                    size="small"
                                    className="h-full border-l-4 border-green-500 bg-green-50"
                                  >
                                    {fb.industrySubmittedAt ? (
                                      <div className="space-y-3">
                                        <div className="text-xs text-gray-500 mb-3">
                                          Submitted:{" "}
                                          {formatDate(fb.industrySubmittedAt)}
                                        </div>

                              
                                        <div>
                                          <Text strong className="block mb-1">
                                            Student Performance Rating:
                                          </Text>
                                          <Rate
                                            disabled
                                            value={fb.industryRating}
                                          />
                                          <Text className="ml-2 text-sm">
                                            ({fb.industryRating || 0}/5)
                                          </Text>
                                        </div>

                                
                                        {fb.industryFeedback && (
                                          <div>
                                            <Text strong className="block mb-1">
                                              Feedback:
                                            </Text>
                                            <p className="text-sm bg-blue-200 text-gray-800 p-2 rounded border italic">
                                              "{fb.industryFeedback}"
                                            </p>
                                          </div>
                                        )}

                                  
                                        {fb.finalPerformance && (
                                          <div>
                                            <Text strong className="block mb-1">
                                              Final Performance Assessment:
                                            </Text>
                                            <p className="text-sm bg-violet-200 text-gray-800 p-2 rounded border">
                                              {fb.finalPerformance}
                                            </p>
                                          </div>
                                        )}

                                   
                                        <div>
                                          <Text strong className="block mb-1">
                                            Recommend for Hire:
                                          </Text>
                                          <Tag
                                            color={
                                              fb.recommendForHire
                                                ? "green"
                                                : "orange"
                                            }
                                          >
                                            {fb.recommendForHire ? "Yes" : "No"}
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
                          ))}
                        </div>
                      ) : (
                        <Empty description="No completion feedback available" />
                      )}
                    </TabPane> */}

                    {/* ─── Monthly Reports ───────────────────────────────── */}
                    <TabPane
                      key="monthly-reports"
                      tab={
                        <span>
                          <FileOutlined /> Monthly Reports (
                          {metrics.monthlyReports?.length || 0})
                        </span>
                      }
                    >
                      <div className="mb-4 flex justify-end">
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={handleOpenReportUpload}
                          disabled={!selected?.student?.id}
                        >
                          Upload Monthly Report
                        </Button>
                      </div>
                      
                      {metrics.monthlyReports?.length ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-3">
                          {metrics.monthlyReports.map((rep) => (
                            <Card
                              key={rep.id}
                              size="small"
                              className="border-l-4 border-indigo-500 bg-indigo-50 shadow-sm hover:shadow-md transition-shadow"
                            >
                              <div className="flex justify-between items-center mb-3">
                                <div>
                                  <Text strong className="text-sm">
                                    {formatDate(
                                      rep.submittedAt || rep.createdAt
                                    )}
                                  </Text>
                                  <div className="text-xs text-gray-500">
                                    {rep.month && rep.year ? `${MONTH_NAMES[rep.month - 1]} ${rep.year}` : ""}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Tag color="blue" className="text-xs">
                                    {rep.status || "SUBMITTED"}
                                  </Tag>
                                  <Popconfirm
                                    title="Delete this report?"
                                    description="Are you sure you want to delete this monthly report?"
                                    onConfirm={() => handleDeleteReport(rep.id)}
                                    okText="Yes"
                                    cancelText="No"
                                  >
                                    <Button
                                      type="text"
                                      danger
                                      size="small"
                                      icon={<DeleteOutlined />}
                                      title="Delete report"
                                    />
                                  </Popconfirm>
                                </div>
                              </div>

                              {rep.summary && (
                                <div className="mb-3">
                                  <Text strong className="text-xs block mb-1">
                                    Summary
                                  </Text>
                                  <Text className="text-sm text-gray-700 line-clamp-3">
                                    {rep.summary}
                                  </Text>
                                </div>
                              )}

                              {rep.attachments?.length ? (
                                <div className="mt-2">
                                  <Text strong className="text-xs block mb-1">
                                    Attachments
                                  </Text>
                                  <div className="flex flex-col gap-1">
                                    {rep.attachments.map((att) => {
                                      const fileUrl = getDocumentUrl(att.fileUrl);
                                      return (
                                        <a
                                          key={att.id || att.url}
                                          href={att.url || fileUrl}
                                          target="_blank" // Changed to target="_blank"
                                            rel="noreferrer"
                                          className="text-sm text-indigo-700"
                                        >
                                          {att.name || att.fileName || "Download"}
                                        </a>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : rep.reportFileUrl ? (
                                <div className="mt-2">
                                  <a
                                    href={getDocumentUrl(rep.reportFileUrl)} // Changed to use getDocumentUrl
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm text-indigo-700"
                                  >
                                    Download Report
                                  </a>
                                </div>
                              ) : null}
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <Empty
                          description="No monthly reports available"
                          image={
                            <FileOutlined className="text-4xl text-gray-300" />
                          }
                        >
                          <Text className="text-gray-500 text-sm">
                            Monthly reports will appear here once submitted by
                            the student or industry
                          </Text>
                        </Empty>
                      )}
                    </TabPane>
                  </Tabs>
                </Card>
              </div>
            ) : (
              <Card className="min-h-[75vh] shadow-xl rounded-3xl bg-white/90 backdrop-blur-lg border-0 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto">
                  <div className="relative mb-8">
                    <div className="w-24 h-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded-3xl flex items-center justify-center mb-4 mx-auto">
                      <UserOutlined className="!text-gray-600 text-4xl" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                      <SearchOutlined className="!text-indigo-500 text-sm" />
                    </div>
                  </div>
                  <Title level={4} className="text-gray-600 mb-4">
                    Select an Student
                  </Title>
                  <Text className="text-gray-500 text-base block mb-6">
                    Choose an Student from the directory on the left to view
                    detailed information, manage applications, and track
                    progress.
                  </Text>
                  <Card className="!bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-4">
                    <Text className="!text-indigo-700 text-sm">
                      💡 Tip: Use the search and filters to quickly find
                      specific internships
                    </Text>
                  </Card>
                </div>
              </Card>
            )}
          </Col>
        </Row>
      </div>

      <Modal
        title={
          modalType === "feedback"
            ? "Add New Feedback"
            : "Create New Assignment"
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={submit} className="mt-4">
          {modalType === "feedback" ? (
            <>
              <Form.Item
                name="rating"
                label="Overall Rating"
                rules={[{ required: true, message: "Please provide a rating" }]}
              >
                <Rate />
              </Form.Item>
              <Form.Item
                name="overallComments"
                label="Comments"
                rules={[
                  { required: true, message: "Please enter your comments" },
                ]}
              >
                <TextArea
                  rows={4}
                  placeholder="Enter detailed feedback here..."
                />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name="title"
                label="Assignment Title"
                rules={[{ required: true, message: "Please enter a title" }]}
              >
                <Input placeholder="e.g., Weekly Progress Report" />
              </Form.Item>
              <Form.Item
                name="description"
                label="Description"
                rules={[
                  { required: true, message: "Please provide a description" },
                ]}
              >
                <TextArea
                  rows={4}
                  placeholder="Describe the assignment requirements..."
                />
              </Form.Item>
              <Form.Item
                name="dueDate"
                label="Due Date"
                rules={[
                  { required: true, message: "Please select a due date" },
                ]}
              >
                <DatePicker className="w-full" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* Monthly Report Upload Modal */}
      <Modal
        title="Upload Monthly Report"
        open={isReportUploadModalVisible}
        onCancel={() => {
          setIsReportUploadModalVisible(false);
          setReportFile(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setIsReportUploadModalVisible(false);
              setReportFile(null);
            }}
          >
            Cancel
          </Button>,
          <Button
            key="upload"
            type="primary"
            loading={uploadingReport}
            onClick={handleReportUpload}
            disabled={!reportFile}
            icon={<UploadOutlined />}
          >
            Upload Report
          </Button>,
        ]}
        width={600}
      >
        <div className="space-y-4">
          <Alert
            title="Upload Monthly Report"
            description="Select the month and year for this report, then upload the PDF file."
            type="info"
            showIcon
            className="mb-4"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Text strong className="block mb-2">
                Month
              </Text>
              <Select
                value={selectedReportMonth}
                onChange={setSelectedReportMonth}
                className="w-full"
                size="large"
              >
                {MONTH_NAMES.map((month, index) => (
                  <Select.Option key={index + 1} value={index + 1}>
                    {month}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <div>
              <Text strong className="block mb-2">
                Year
              </Text>
              <Select
                value={selectedReportYear}
                onChange={setSelectedReportYear}
                className="w-full"
                size="large"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(
                  (year) => (
                    <Select.Option key={year} value={year}>
                      {year}
                    </Select.Option>
                  )
                )}
              </Select>
            </div>
          </div>

          <div>
            <Text strong className="block mb-2">
              Report File (PDF only, max 5MB)
            </Text>
            <Upload.Dragger {...reportFileProps} maxCount={1}>
              <p className="ant-upload-drag-icon">
                <FileOutlined />
              </p>
              <p className="ant-upload-text">
                Click or drag PDF file to this area to upload
              </p>
              <p className="ant-upload-hint">
                Only PDF files are allowed. Maximum file size is 5MB.
              </p>
            </Upload.Dragger>
          </div>

          {selected?.student && (
            <Alert
              title={`Uploading report for: ${selected.student.name}`}
              type="success"
              showIcon
              className="mt-2"
            />
          )}
        </div>
      </Modal>
    </>
  );
};

export default StudentProgressPage;