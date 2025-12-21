// src/pages/internships/MyApplications.jsx
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
  Rate,
  message,
  Empty,
  Spin,
  Avatar,
  Progress,
  Timeline,
  Alert,
  Tabs,
  Switch,
  Row,
  Col,
  Select,
  Badge,
  Popconfirm,
} from "antd";
import {
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StarOutlined,
  BankOutlined,
  CalendarOutlined,
  CommentOutlined,
  FileTextOutlined,
  SendOutlined,
  TrophyOutlined,
  MessageOutlined,
  UserOutlined,
  ShopOutlined,
  TeamOutlined,
  BookOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  EditOutlined,
  ArrowLeftOutlined,
  UploadOutlined,
  DeleteOutlined,
  MailOutlined,
  ExportOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import Layouts from "../../../components/Layout";
import API from "../../../services/api";
import { toast } from "react-hot-toast";
import { getImageUrl } from "../../../utils/imageUtils";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrBefore);

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MyApplications = () => {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [selfIdentifiedApplications, setSelfIdentifiedApplications] = useState(
    []
  );
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showDetailsView, setShowDetailsView] = useState(false);
  const [activeTab, setActiveTab] = useState("1");

  // Feedback states
  const [feedbackModal, setFeedbackModal] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [completionFeedback, setCompletionFeedback] = useState(null);
  const [form] = Form.useForm();

  // Monthly Feedback states
  const [monthlyFeedbackModal, setMonthlyFeedbackModal] = useState(false);
  const [monthlyFeedbackLoading, setMonthlyFeedbackLoading] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [applicationMonthlyFeedbacks, setApplicationMonthlyFeedbacks] =
    useState([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);

  // Monthly Reports states
  const [monthlyReports, setMonthlyReports] = useState([]);
  const [monthlyReportsLoading, setMonthlyReportsLoading] = useState(false);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [reportFile, setReportFile] = useState(null);
  const [missingReports, setMissingReports] = useState([]);
  const [autoReportMonthSelection, setAutoReportMonthSelection] =
    useState(true);
  const [selectedReportMonth, setSelectedReportMonth] = useState(
    () => new Date().getMonth() + 1
  );
  const [selectedReportYear, setSelectedReportYear] = useState(
    () => new Date().getFullYear()
  );

  const reportMonthOptions = useMemo(
    () =>
      MONTH_NAMES.map((name, index) => ({
        value: index + 1,
        label: name,
      })),
    []
  );

  // Check if internship has started
  const hasInternshipStarted = useMemo(() => {
    if (!selectedApplication) return false;
    
    const startDate = selectedApplication.isSelfIdentified
      ? selectedApplication.startDate
      : selectedApplication.joiningDate || selectedApplication.internship?.startDate;
    
    if (!startDate) return false;
    
    return dayjs(startDate).isSameOrBefore(dayjs(), 'day');
  }, [selectedApplication]);

  const reportYearOptions = useMemo(() => {
    const currentYearValue = new Date().getFullYear();
    const years = [];
    // Include next 2 years, current year, and previous 6 years (descending)
    for (
      let y = currentYearValue + 2;
      y >= currentYearValue - 6;
      y--
    ) {
      years.push({
        value: y,
        label: y.toString(),
      });
    }
    return years;
  }, []);

  // Allowed report month options constrained to the selected application's internship period
  const allowedReportMonthOptions = useMemo(() => {
    const app = selectedApplication;
    if (!app) return reportMonthOptions;

    const startDate = app.isSelfIdentified
      ? app.startDate
      : app.joiningDate || app.internship?.startDate;
    const endDate = app.isSelfIdentified
      ? app.endDate
      : app.internship?.endDate;

    if (!startDate || !endDate) return reportMonthOptions;

    const start = dayjs(startDate).startOf("month");
    const end = dayjs(endDate).endOf("month");

    const options = [];
    let cursor = start.clone();
    while (cursor.isBefore(end) || cursor.isSame(end, "month")) {
      if (cursor.year() === selectedReportYear) {
        options.push({ value: cursor.month() + 1, label: cursor.format("MMMM") });
      }
      cursor = cursor.add(1, "month");
    }

    if (options.length === 0) {
      const all = [];
      cursor = start.clone();
      while (cursor.isBefore(end) || cursor.isSame(end, "month")) {
        all.push({ value: cursor.month() + 1, label: cursor.format("MMMM"), year: cursor.year() });
        cursor = cursor.add(1, "month");
      }
      if (all.length === 0) return reportMonthOptions;
      const unique = [];
      const seen = new Set();
      all.forEach((m) => {
        const key = `${m.year}-${m.value}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push({ value: m.value, label: `${m.label} ${m.year}` });
        }
      });
      return unique;
    }

    return options;
  }, [selectedApplication, selectedReportYear, reportMonthOptions]);

  // Keep selectedReportMonth in sync when switching to manual selection
  useEffect(() => {
    if (!autoReportMonthSelection) {
      if (Array.isArray(allowedReportMonthOptions) && allowedReportMonthOptions.length > 0) {
        if (!allowedReportMonthOptions.some((o) => o.value === selectedReportMonth)) {
          setSelectedReportMonth(allowedReportMonthOptions[0].value);
        }
      }
    }
  }, [autoReportMonthSelection, allowedReportMonthOptions]);

  const formatDisplayDate = (
    value,
    options = { year: "numeric", month: "short", day: "numeric" }
  ) => {
    if (!value) return "N/A";
    try {
      return new Date(value).toLocaleDateString(undefined, options);
    } catch (error) {
      return "N/A";
    }
  };

  const formatCurrency = (value) => {
    if (!value && value !== 0) return "Unpaid";
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return "Unpaid";
    return `₹${numericValue.toLocaleString()}`;
  };

  const navigate = useNavigate();

  useEffect(() => {
    fetchMyApplications();
    fetchSelfIdentifiedApplications();
  }, []);

  const fetchMyApplications = async () => {
    setLoading(true);
    try {
      const response = await API.get(
        "/internship-applications/my-applications"
      );
      if (response.data && response.data.success) {
        // Filter out self-identified internships (those without internshipId or internship)
        const platformApps = (response.data.data || []).filter(
          (app) => app.internshipId && app.internship
        );
        setApplications(platformApps);
      } else {
        setApplications([]);
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Error fetching applications"
      );
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSelfIdentifiedApplications = async () => {
    try {
      const response = await API.get(
        "/self-identified-internships/my-applications"
      );
      if (response.data && response.data.success) {
        setSelfIdentifiedApplications(response.data.data || []);
      } else {
        setSelfIdentifiedApplications([]);
      }
    } catch (error) {
      console.error("Error fetching self-identified applications:", error);
      setSelfIdentifiedApplications([]);
    }
  };

  // Fetch completion feedback for an application (contains both student and industry feedback)
  const fetchCompletionFeedback = async (applicationId) => {
    try {
      const response = await API.get(
        `/completion-feedback/application/${applicationId}`
      );
      if (response.data && response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      // If feedback doesn't exist, return null
      if (error.response?.status === 404) {
        return null;
      }
      console.error("Error fetching feedback:", error);
      return null;
    }
  };

  // Submit student portion of completion feedback
  const handleSubmitStudentFeedback = async (values) => {
    setFeedbackLoading(true);
    try {
      const payload = {
        studentFeedback: values.studentFeedback,
        studentRating: values.studentRating,
        skillsLearned: values.skillsLearned,
        careerImpact: values.careerImpact,
        wouldRecommend: values.wouldRecommend || false,
      };

      await API.post(
        `/completion-feedback/student/${selectedApplication.id}`,
        payload
      );

      toast.success("Your feedback has been submitted successfully!");
      setFeedbackModal(false);
      form.resetFields();

      // Refresh the feedback data
      const updatedFeedback = await fetchCompletionFeedback(
        selectedApplication.id
      );
      setCompletionFeedback(updatedFeedback);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to submit feedback"
      );
    } finally {
      setFeedbackLoading(false);
    }
  };

  // Open feedback modal
  const handleOpenFeedbackModal = async (application) => {
    setSelectedApplication(application);

    // Check if feedback already exists
    const feedback = await fetchCompletionFeedback(application.id);
    setCompletionFeedback(feedback);

    // Check if student has already submitted their part
    if (feedback && feedback.studentFeedback) {
      toast.error(
        "You have already submitted your feedback for this internship."
      );
      return;
    }

    setFeedbackModal(true);
    form.resetFields();
  };

  // Open monthly feedback modal
  const handleOpenMonthlyFeedbackModal = (application) => {
    setSelectedApplication(application);
    setMonthlyFeedbackModal(true);
    setSelectedImageFile(null);
    setImagePreview(null);
  };

  // Handle image file selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (!validTypes.includes(file.type)) {
        toast.error("Please upload a valid image file (jpg, png, gif, webp)");
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }

      setSelectedImageFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit monthly feedback
  const handleSubmitMonthlyFeedback = async () => {
    if (!selectedImageFile) {
      toast.error("Please select an image to upload");
      return;
    }

    setMonthlyFeedbackLoading(true);
    try {
      // Get studentId from localStorage
      const loginData = localStorage.getItem("loginResponse");
      let studentId = null;

      if (loginData) {
        const parsed = JSON.parse(loginData);
        studentId = parsed?.user?.studentId || parsed?.user?.id;
      }

      if (!studentId) {
        toast.error("Student ID not found. Please login again.");
        return;
      }

      const formData = new FormData();
      formData.append("image", selectedImageFile);
      formData.append("studentId", studentId);

      const response = await API.post(
        "/monthly-feedback/student/submit",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      toast.success("Monthly feedback submitted successfully!");
      setMonthlyFeedbackModal(false);
      setSelectedImageFile(null);
      setImagePreview(null);

      // Refresh monthly feedbacks for the current application
      if (selectedApplication?.id) {
        await fetchApplicationMonthlyFeedback(selectedApplication.id);
      }

      // Refresh applications to show new feedback
      fetchMyApplications();
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to submit monthly feedback"
      );
    } finally {
      setMonthlyFeedbackLoading(false);
    }
  };

  // Fetch monthly feedback for a specific application
  const fetchApplicationMonthlyFeedback = async (applicationId) => {
    setFeedbacksLoading(true);
    try {
      const response = await API.get(
        `/monthly-feedback/application/${applicationId}`
      );

      if (response.data && response.data.success) {
        setApplicationMonthlyFeedbacks(response.data.data.feedbacks || []);
      } else {
        setApplicationMonthlyFeedbacks([]);
      }
    } catch (error) {
      console.error("Error fetching monthly feedbacks:", error);
      toast.error("Failed to load monthly feedback");
      setApplicationMonthlyFeedbacks([]);
    } finally {
      setFeedbacksLoading(false);
    }
  };

  // Fetch monthly reports for a specific application
  const fetchMonthlyReports = async (applicationId) => {
    setMonthlyReportsLoading(true);
    try {
      const response = await API.get(
        `/monthly-reports/application/${applicationId}`
      );

      if (response.data) {
        setMonthlyReports(response.data || []);
      } else {
        setMonthlyReports([]);
      }
    } catch (error) {
      console.error("Error fetching monthly reports:", error);
      toast.error("Failed to load monthly reports");
      setMonthlyReports([]);
    } finally {
      setMonthlyReportsLoading(false);
    }
  };

  // Fetch missing reports
  // const fetchMissingReports = async (applicationId) => {
  //   try {
  //     const response = await API.get(
  //       `/monthly-reports/application/${applicationId}/missing`
  //     );

  //     if (response.data) {
  //       setMissingReports(response.data || []);
  //     } else {
  //       setMissingReports([]);
  //     }
  //   } catch (error) {
  //     console.error("Error fetching missing reports:", error);
  //     setMissingReports([]);
  //   }
  // };

  // Handle report file upload
  const handleReportFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type (PDF only)
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size should not exceed 5MB");
      return;
    }

    setReportFile(file);
  };

  // Upload monthly report
  const handleUploadMonthlyReport = async () => {
    if (!reportFile) {
      toast.error("Please select a file to upload");
      return;
    }

    if (!hasInternshipStarted) {
      toast.warning("Cannot upload reports - internship has not started yet");
      return;
    }

    setUploadingReport(true);
    try {
      // Get studentId from localStorage
      const loginData = localStorage.getItem("loginResponse");
      let studentId = null;

      if (loginData) {
        const parsed = JSON.parse(loginData);
        studentId =
          parsed?.user?.studentId ||
          parsed?.user?.Student?.id ||
          parsed?.user?.id;
      }

      if (!studentId) {
        toast.error("Student ID not found. Please login again.");
        return;
      }

      // Create form data for file upload
      const formData = new FormData();
      formData.append("file", reportFile);
      formData.append("applicationId", selectedApplication.id);
      formData.append("studentId", studentId);
      const now = new Date();
      const monthValue = autoReportMonthSelection
        ? now.getMonth() + 1
        : selectedReportMonth;
      const yearValue = autoReportMonthSelection
        ? now.getFullYear()
        : selectedReportYear;

      if (!monthValue || !yearValue) {
        toast.error("Please select report month and year");
        return;
      }

      formData.append("month", monthValue.toString());
      formData.append("year", yearValue.toString());

      // Upload to backend
      const response = await API.post("/monthly-reports/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data) {
        toast.success("Monthly report uploaded successfully");
        setReportFile(null);
        setAutoReportMonthSelection(true);
        const refreshedNow = new Date();
        setSelectedReportMonth(refreshedNow.getMonth() + 1);
        setSelectedReportYear(refreshedNow.getFullYear());
        // Refresh reports
        await fetchMonthlyReports(selectedApplication.id);
        // await fetchMissingReports(selectedApplication.id);
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to upload monthly report"
      );
    } finally {
      setUploadingReport(false);
    }
  };

  // Submit monthly report for review
  const handleSubmitReport = async (reportId) => {
    try {
      // Get studentId from localStorage
      const loginData = localStorage.getItem("loginResponse");
      let studentId = null;

      if (loginData) {
        const parsed = JSON.parse(loginData);
        studentId =
          parsed?.user?.studentId ||
          parsed?.user?.Student?.id ||
          parsed?.user?.id;
      }

      if (!studentId) {
        toast.error("Student ID not found. Please login again.");
        return;
      }

      const response = await API.patch(`/monthly-reports/${reportId}/submit`, {
        studentId: studentId,
      });

      if (response.data) {
        toast.success("Report submitted for review");
        await fetchMonthlyReports(selectedApplication.id);
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to submit report");
    }
  };

  // Delete monthly report (only drafts)
  const handleDeleteReport = async (reportId, reportStatus) => {
    if (reportStatus !== "DRAFT") {
      toast.error("Only draft reports can be deleted");
      return;
    }

    try {
      await API.delete(`/monthly-reports/${reportId}`);
      toast.success("Report deleted successfully");
      await fetchMonthlyReports(selectedApplication.id);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete report");
    }
  };

  // Handle view details with feedback data
  const handleViewDetails = async (application) => {
    setSelectedApplication(application);

    // Fetch feedback data for the details modal
    const feedback = await fetchCompletionFeedback(application.id);
    setCompletionFeedback(feedback);

    // Fetch monthly feedback for this application
    await fetchApplicationMonthlyFeedback(application.id);

    // Fetch monthly reports for this application
    await fetchMonthlyReports(application.id);
    // await fetchMissingReports(application.id);

    setAutoReportMonthSelection(true);
    const now = new Date();
    setSelectedReportMonth(now.getMonth() + 1);
    setSelectedReportYear(now.getFullYear());

    setShowDetailsView(true);
  };

  // Close details view and return to applications list
  const handleCloseDetailsView = () => {
    setShowDetailsView(false);
    setSelectedApplication(null);
    setCompletionFeedback(null);
    setApplicationMonthlyFeedbacks([]);
    setMonthlyReports([]);
    setMissingReports([]);
    setReportFile(null);
    setAutoReportMonthSelection(true);
    const now = new Date();
    setSelectedReportMonth(now.getMonth() + 1);
    setSelectedReportYear(now.getFullYear());
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

  const getStatusIcon = (status) => {
    const icons = {
      APPLIED: <ClockCircleOutlined />,
      UNDER_REVIEW: <ClockCircleOutlined />,
      SELECTED: <CheckCircleOutlined />,
      REJECTED: <CloseCircleOutlined />,
      JOINED: <CheckCircleOutlined />,
      COMPLETED: <CheckCircleOutlined />,
    };
    return icons[status] || <ClockCircleOutlined />;
  };

  const renderApplicationDetailsContent = () => {
    if (!selectedApplication) return null;

    const isSelfIdentified = !selectedApplication.internship;
    const internship = selectedApplication.internship;
    const industry = internship?.industry || {};

    const summaryHighlights = [
      // {
      //   key: "applicationId",
      //   label: "Application ID",
      //   value: selectedApplication.applicationNumber || selectedApplication.id,
      //   icon: <FileTextOutlined className="text-blue-600" />,
      //   iconBg: "bg-blue-100 text-blue-600",
      // },
      {
        key: "status",
        label: "Status",
        renderValue: () => (
          <Tag
            color={getStatusColor(selectedApplication.status)}
            className="!px-3 !py-1 text-xs font-medium"
          >
            {selectedApplication.status.replace("_", " ")}
          </Tag>
        ),
        icon: <CheckCircleOutlined className="text-green-600" />,
        iconBg: "bg-green-100 text-green-600",
      },
      {
        key: "applied",
        label: "Applied On",
        value: formatDisplayDate(
          selectedApplication.appliedDate || selectedApplication.createdAt
        ),
        icon: <CalendarOutlined className="text-purple-600" />,
        iconBg: "bg-purple-100 text-purple-600",
      },
      {
        key: "duration",
        label: "Duration",
        value:
          internship?.duration ||
          selectedApplication.internshipDuration ||
          "N/A",
        icon: <ClockCircleOutlined className="text-orange-600" />,
        iconBg: "bg-orange-100 text-orange-600",
      },
      {
        key: "stipend",
        label: "Stipend",
        value: formatCurrency(
          internship?.stipendAmount || selectedApplication.stipend
        ),
        icon: <StarOutlined className="text-amber-500" />,
        iconBg: "bg-amber-100 text-amber-500",
      },
    ];

    const locationText =
      [industry.address, industry.city, industry.state]
        .filter(Boolean)
        .join(", ") || selectedApplication.location;

    const detailSections = [
      {
        label: "Company",
        value: industry.companyName || selectedApplication.companyName,
        icon: <BankOutlined className="text-blue-500" />,
      },
      // {
      //   label: "Location",
      //   value: locationText || "N/A",
      //   icon: <EnvironmentOutlined className="text-emerald-500" />,
      // },
      // {
      //   label: "Internship Mode",
      //   value: internship?.mode || selectedApplication.workMode || "N/A",
      //   icon: <BookOutlined className="text-indigo-500" />,
      // },
      {
        label: "Start Date",
        value: formatDisplayDate(
          selectedApplication.startDate ||
            selectedApplication.joiningDate ||
            internship?.startDate
        ),
        icon: <CalendarOutlined className="text-teal-500" />,
      },
      {
        label: "End Date",
        value: formatDisplayDate(
          selectedApplication.endDate ||
            selectedApplication.completionDate ||
            internship?.endDate
        ),
        icon: <CalendarOutlined className="text-rose-500" />,
      },
      {
        label: "Department",
        value: internship?.department || selectedApplication.department,
        icon: <TeamOutlined className="text-cyan-500" />,
      },
    ].filter((item) => item.value);

    const contactDetails = [
      {
        label: "Point of Contact",
        value:
          industry.contactPersonName ||
          selectedApplication.hrName ||
          selectedApplication.facultyMentorName,
        icon: <UserOutlined className="text-blue-500" />,
      },
      {
        label: "Email",
        value:
          industry.primaryEmail ||
          selectedApplication.hrEmail ||
          selectedApplication.facultyMentorEmail,
        icon: <MailOutlined className="text-amber-500" />,
        href:
          industry.primaryEmail ||
          selectedApplication.hrEmail ||
          selectedApplication.facultyMentorEmail
            ? `mailto:${
                industry.primaryEmail ||
                selectedApplication.hrEmail ||
                selectedApplication.facultyMentorEmail
              }`
            : undefined,
      },
      {
        label: "Phone",
        value:
          industry.primaryPhone ||
          selectedApplication.hrContact ||
          selectedApplication.facultyMentorContact,
        icon: <PhoneOutlined className="text-emerald-500" />,
        href:
          industry.primaryPhone ||
          selectedApplication.hrContact ||
          selectedApplication.facultyMentorContact
            ? `tel:${
                industry.primaryPhone ||
                selectedApplication.hrContact ||
                selectedApplication.facultyMentorContact
              }`
            : undefined,
      },
    ].filter((item) => item.value);

    const mentorDetails = [
      {
        label: "Mentor Name",
        value: selectedApplication.facultyMentorName,
      },
      {
        label: "Designation",
        value: selectedApplication.facultyMentorDesignation,
      },
      {
        label: "Contact",
        value: selectedApplication.facultyMentorContact,
      },
      {
        label: "Email",
        value: selectedApplication.facultyMentorEmail,
      },
    ].filter((item) => item.value);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {summaryHighlights
            .filter((item) => item.renderValue || item.value)
            .map((item) => (
              <div
                key={item.key}
                className="bg-gradient-to-br from-background to-background-tertiary/30 border border-border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${item.iconBg}`}
                  >
                    {React.cloneElement(item.icon, { className: 'text-sm' })}
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-text-secondary font-bold">
                    {item.label}
                  </p>
                </div>
                <div className="text-sm font-semibold text-text-primary pl-9">
                  {item.renderValue ? item.renderValue() : item.value}
                </div>
              </div>
            ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <div className="xl:col-span-2 bg-background border border-border rounded-xl p-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div className="flex-1">
                <Text className="text-[10px] uppercase tracking-wider text-text-secondary font-bold mb-1 block">
                  Internship Role
                </Text>
                <Title level={5} className="!mb-2 !mt-0 text-text-primary">
                  {internship?.title ||
                    selectedApplication.jobProfile ||
                    "Role not specified"}
                </Title>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(industry.companyName || selectedApplication.companyName) && (
                    <Tag color="blue" className="text-xs px-2 py-0.5 rounded-md">
                      {industry.companyName || selectedApplication.companyName}
                    </Tag>
                  )}
                  {(internship?.fieldOfWork || selectedApplication.domain) && (
                    <Tag color="purple" className="text-xs px-2 py-0.5 rounded-md">
                      {internship?.fieldOfWork || selectedApplication.domain}
                    </Tag>
                  )}
                  {(internship?.mode || selectedApplication.workMode) && (
                    <Tag color="gold" className="text-xs px-2 py-0.5 rounded-md">
                      {internship?.mode || selectedApplication.workMode}
                    </Tag>
                  )}
                </div>
              </div>
            </div>

            {detailSections.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-4">
                {detailSections.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-border/50 bg-gradient-to-br from-background-tertiary/50 to-background p-2.5 flex items-center gap-2 hover:border-border transition-colors duration-150"
                  >
                    <div className="text-base flex-shrink-0">{item.icon}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase text-text-secondary tracking-wider font-bold leading-tight">
                        {item.label}
                      </p>
                      <p className="text-xs font-medium text-text-primary truncate">
                        {item.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {contactDetails.length > 0 && (
              <div className="rounded-xl border border-border bg-background p-3 shadow-sm">
                <Text className="text-[10px] uppercase tracking-wider text-text-secondary font-bold block mb-2">
                  Company Contact
                </Text>
                <div className="space-y-2">
                  {contactDetails.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-2 border border-border/50 rounded-xl p-2 bg-background hover:border-border transition-colors duration-150"
                    >
                      <div className="text-base flex-shrink-0">{item.icon}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase text-text-secondary font-bold leading-tight">
                          {item.label}
                        </p>
                        {item.href ? (
                          <a
                            href={item.href}
                            className="text-xs font-medium text-primary hover:text-primary-600 truncate block"
                          >
                            {item.value}
                          </a>
                        ) : (
                          <p className="text-xs font-medium text-text-primary truncate">
                            {item.value}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedApplication.joiningLetterUrl && (
              <div className="rounded-xl border border-primary-200 bg-primary-50 p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <Text className="text-[10px] uppercase tracking-wider text-primary font-bold block mb-0.5">
                      Joining Letter
                    </Text>
                    <Text className="text-xs text-primary-700">
                      View document
                    </Text>
                  </div>
                  <Button
                    type="primary"
                    size="small"
                    icon={<ExportOutlined />}
                    className="bg-primary border-0 flex-shrink-0"
                    href={getImageUrl(selectedApplication.joiningLetterUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {mentorDetails.length > 0 && (
          <div className="rounded-xl border border-border bg-background p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-6 h-6 rounded-lg bg-secondary-100 flex items-center justify-center">
                <UserOutlined className="text-secondary-600 text-sm" />
              </div>
              <Text strong className="text-sm text-text-primary">
                Faculty Mentor
              </Text>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {mentorDetails.map((item) => (
                <div
                  key={item.label}
                  className="border border-border/50 rounded-xl p-2 bg-background hover:border-border transition-colors duration-150"
                >
                  <p className="text-[10px] uppercase text-text-secondary font-bold leading-tight">
                    {item.label}
                  </p>
                  <p className="text-xs font-medium text-text-primary truncate mt-0.5">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedApplication.coverLetter && (
          <div className="rounded-xl border border-border bg-background p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-primary-50 flex items-center justify-center">
                <FileTextOutlined className="text-primary text-sm" />
              </div>
              <Text strong className="text-sm text-text-primary">
                Cover Letter
              </Text>
            </div>
            <Paragraph className="text-xs text-text-secondary whitespace-pre-line mb-0 leading-relaxed">
              {selectedApplication.coverLetter}
            </Paragraph>
          </div>
        )}

        {selectedApplication.additionalInfo && (
          <div className="rounded-xl border border-border bg-background p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-background-tertiary flex items-center justify-center">
                <FileTextOutlined className="text-text-secondary text-sm" />
              </div>
              <Text strong className="text-sm text-text-primary">
                Additional Information
              </Text>
            </div>
            <Paragraph className="text-xs text-text-secondary whitespace-pre-line mb-0 leading-relaxed">
              {selectedApplication.additionalInfo}
            </Paragraph>
          </div>
        )}
      </div>
    );
  };

  const columns = [
    {
      title: "Internship Details",
      key: "internship",
      render: (_, record) => (
        <div className="flex items-center space-x-4">
          <Avatar
            size={50}
            icon={<BankOutlined />}
            className="bg-primary flex-shrink-0"
          />
          <div className="ml-3">
            <Text strong className="text-base block text-text-primary">
              {record.internship?.title}
            </Text>
            <Text className="text-text-secondary">
              {record.internship?.industry?.companyName || record.companyName}
            </Text>
            <div className="mt-1">
              <Tag color="blue" size="small" className="rounded-md">
                {record.internship?.fieldOfWork || record.jobProfile}
              </Tag>
            </div>
          </div>
        </div>
      ),
      width: "30%",
    },
    {
      title: "Application Status",
      key: "status",
      render: (_, record) => (
        <div>
          <Tag
            color={getStatusColor(record.status)}
            icon={getStatusIcon(record.status)}
            className="mb-2 px-3 py-1 rounded-full font-medium"
          >
            {record.status.replace("_", " ")}
          </Tag>
        </div>
      ),
      width: "18%",
    },
    {
      title: "Applied Date",
      key: "appliedDate",
      render: (_, record) => (
        <div>
          <Text className="text-text-primary">
            {new Date(
              record.appliedDate || record.createdAt
            ).toLocaleDateString()}
          </Text>
          <br />
          <Text className="text-text-secondary text-sm">
            {Math.ceil(
              (new Date() - new Date(record.appliedDate || record.createdAt)) /
                (1000 * 60 * 60 * 24)
            )}{" "}
            days ago
          </Text>
        </div>
      ),
      width: "15%",
    },
    {
      title: "Duration & Stipend",
      key: "details",
      render: (_, record) => (
        <div>
          <div className="flex items-center mb-1">
            <CalendarOutlined className="text-primary mr-2" />
            <Text className="text-text-primary">{record.internship?.duration || record.internshipDuration}</Text>
          </div>
          <div className="flex items-center">
            <StarOutlined className="text-success mr-2" />
            <Text className="text-text-primary">
              {record.internship?.isStipendProvided || record.stipend
                ? `₹${
                    record.internship?.stipendAmount?.toLocaleString() ||
                    record.stipend?.toLocaleString()
                  }`
                : "Unpaid"}
            </Text>
          </div>
        </div>
      ),
      width: "15%",
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
            className="text-primary hover:bg-primary-50 rounded-lg"
          >
            View Details
          </Button>

          {/* Completion Feedback Button - only show for JOINED or COMPLETED status */}
          {(record.status === "JOINED" || record.status === "COMPLETED") && (
            <Button
              type="text"
              icon={<TrophyOutlined />}
              onClick={() => handleOpenFeedbackModal(record)}
              className="text-success hover:bg-success-50 rounded-lg"
            >
              Submit Feedback
            </Button>
          )}
        </Space>
      ),
      width: "22%",
    },
  ];

  // Columns for self-identified internships
  const selfIdentifiedColumns = [
    {
      title: "Company Details",
      key: "company",
      render: (_, record) => (
        <div className="flex items-center space-x-4">
          <Avatar
            size={50}
            icon={<BankOutlined />}
            className="bg-purple-500 flex-shrink-0"
          />
          <div className="ml-3">
            <Text strong className="text-base block">
              {record.companyName}
            </Text>
            <Text className="text-gray-600">{record.jobProfile}</Text>
            <div className="mt-1">
              <Tag color="purple" size="small">
                Self-Identified
              </Tag>
            </div>
          </div>
        </div>
      ),
      width: "30%",
    },
    {
      title: "Application Status",
      key: "status",
      render: (_, record) => (
        <div>
          <Tag
            color={getStatusColor(record.status)}
            icon={getStatusIcon(record.status)}
            className="mb-2 px-3 py-1 rounded-full font-medium"
          >
            {record.status.replace("_", " ")}
          </Tag>
        </div>
      ),
      width: "18%",
    },
    {
      title: "Submitted Date",
      key: "appliedDate",
      render: (_, record) => (
        <div>
          <Text>
            {new Date(
              record.appliedDate || record.createdAt
            ).toLocaleDateString()}
          </Text>
          <br />
          <Text className="text-gray-500 text-sm">
            {Math.ceil(
              (new Date() - new Date(record.appliedDate || record.createdAt)) /
                (1000 * 60 * 60 * 24)
            )}{" "}
            days ago
          </Text>
        </div>
      ),
      width: "15%",
    },
    {
      title: "Duration & Stipend",
      key: "details",
      render: (_, record) => (
        <div>
          <div className="flex items-center mb-1">
            <CalendarOutlined className="text-blue-500 mr-2" />
            <Text>{record.internshipDuration}</Text>
          </div>
          <div className="flex items-center">
            <StarOutlined className="text-green-500 mr-2" />
            <Text>
              {record.stipend
                ? `₹${record.stipend?.toLocaleString()}`
                : "Unpaid"}
            </Text>
          </div>
        </div>
      ),
      width: "15%",
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewSelfIdentifiedDetails(record)}
            className="text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            View Details
          </Button>
        </Space>
      ),
      width: "22%",
    },
  ];

  const handleViewSelfIdentifiedDetails = async (application) => {
    setSelectedApplication(application);

    // Fetch feedback data for the details modal
    const feedback = await fetchCompletionFeedback(application.id);
    setCompletionFeedback(feedback);

    // Fetch monthly feedback for this application
    await fetchApplicationMonthlyFeedback(application.id);

    // Fetch monthly reports for this application
    await fetchMonthlyReports(application.id);
    // await fetchMissingReports(application.id);

    setShowDetailsView(true);
  };

  const getTimelineItems = (application) => {
    const items = [
      {
        color: "blue",
        dot: <ClockCircleOutlined />,
        children: (
          <div>
            <Text strong>Application Submitted</Text>
            <br />
            <Text className="text-gray-500 text-sm">
              {new Date(
                application.appliedDate || application.createdAt
              ).toLocaleString()}
            </Text>
          </div>
        ),
      },
    ];

    if (
      ["UNDER_REVIEW", "SELECTED", "REJECTED", "JOINED", "COMPLETED"].includes(
        application.status
      )
    ) {
      items.push({
        color: "orange",
        dot: <ClockCircleOutlined />,
        children: (
          <div>
            <Text strong>Application Under Review</Text>
            <br />
            <Text className="text-gray-500 text-sm">
              {application.reviewedDate
                ? new Date(application.reviewedDate).toLocaleString()
                : "Review In Progress!"}
            </Text>
          </div>
        ),
      });
    }

    if (["SELECTED", "JOINED", "COMPLETED"].includes(application.status)) {
      items.push({
        color: "green",
        dot: <CheckCircleOutlined />,
        children: (
          <div>
            <Text strong>Selected for Internship</Text>
            <br />
            <Text className="text-gray-500 text-sm">
              {application.selectionDate
                ? new Date(application.selectionDate).toLocaleString()
                : "Congratulations!"}
            </Text>
          </div>
        ),
      });
    }

    if (application.status === "REJECTED") {
      items.push({
        color: "red",
        dot: <CloseCircleOutlined />,
        children: (
          <div>
            <Text strong>Application Rejected</Text>
            <br />
            <Text className="text-gray-500 text-sm">
              {application.rejectionReason || "Better luck next time!"}
            </Text>
          </div>
        ),
      });
    }

    if (["JOINED", "COMPLETED"].includes(application.status)) {
      items.push({
        color: "purple",
        dot: <CheckCircleOutlined />,
        children: (
          <div>
            <Text strong>Internship Started</Text>
            <br />
            <Text className="text-gray-500 text-sm">
              {application.joiningDate
                ? new Date(application.joiningDate).toLocaleString()
                : "Welcome aboard!"}
            </Text>
          </div>
        ),
      });
    }

    if (application.status === "COMPLETED") {
      items.push({
        color: "gray",
        dot: <CheckCircleOutlined />,
        children: (
          <div>
            <Text strong>Internship Completed</Text>
            <br />
            <Text className="text-gray-500 text-sm">
              {application.updatedAt
                ? new Date(application.updatedAt).toLocaleString()
                : "Congratulations on completion!"}
            </Text>
          </div>
        ),
      });
    }

    return items;
  };

  // New function to render faculty visit logs
  const getFacultyVisitItems = (facultyVisitLogs) => {
    if (!facultyVisitLogs || facultyVisitLogs.length === 0) {
      return [];
    }

    return facultyVisitLogs
      .sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
      .map((visit, index) => ({
        color: "blue",
        dot: <TeamOutlined />,
        children: (
          <div className="faculty-visit-item">
            <div className="flex justify-between items-start">
              <Text strong className="text-base text-gray-800">
                Faculty Visit #{facultyVisitLogs.length - index}
              </Text>
              <div className="text-right">
                <div className="text-sm text-gray-600">
                  {new Date(visit.visitDate).toLocaleDateString("en-US", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(visit.visitDate).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          </div>
        ),
      }));
  };

  if (loading) {
    return (
      <Layouts>
        <div className="flex justify-center items-center min-h-screen">
          <Spin size="small" />
          <Text className="ml-4 text-gray-600">
            Loading your applications...
          </Text>
        </div>
      </Layouts>
    );
  }

  return (
    <Layouts>
      <div className="min-h-screen">
        <div className="mx-auto">
          {/* Show Details View or Applications List */}
          {showDetailsView ? (
            <div className="mb-8">
              {/* Back Button */}
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={handleCloseDetailsView}
                className="mb-4"
                size="large"
              >
                Back to My Applications
              </Button>

              {/* Application Details Content */}
              {selectedApplication && (
                <Card className="rounded-2xl">
                  <div className="mb-6">
                    <Title level={3}>
                      <FileTextOutlined className="mr-2 text-blue-600" />
                      Application Details
                    </Title>
                  </div>

                  <Tabs defaultActiveKey="details">
                    <TabPane tab="Application Details" key="details">
                      {/* Status Alert */}
                      {/* <Alert
                        title={`Application ${selectedApplication.status.replace(
                          "_",
                          " "
                        )}`}
                        description={
                          selectedApplication.status === "SELECTED" || selectedApplication.status === "JOINED" || selectedApplication.status === "APPROVED"
                            ? "Congratulations! You have been selected for this internship."
                            : selectedApplication.status === "REJECTED"
                            ? "Unfortunately, your application was not selected this time."
                            : "Your application is being processed."
                        }
                        type={
                          selectedApplication.status === "SELECTED"
                            ? "success"
                            : selectedApplication.status === "REJECTED"
                            ? "error"
                            : "info"
                        }
                        showIcon
                        className="rounded-lg !mb-4"
                      /> */}
                      {renderApplicationDetailsContent()}

                    </TabPane>

                    {/* Faculty Visits Tab */}
                    <TabPane
                      tab={
                        <span className="flex items-center">
                          <TeamOutlined className="mr-2" />
                          Faculty Visits
                          {selectedApplication.facultyVisitLogs &&
                            selectedApplication.facultyVisitLogs.length > 0 && (
                              <Badge
                                count={
                                  selectedApplication.facultyVisitLogs.length
                                }
                                size="small"
                                className="ml-2"
                              />
                            )}
                        </span>
                      }
                      key="faculty-visits"
                    >
                      <div className="!space-y-4 ">
                        {selectedApplication.facultyVisitLogs &&
                        selectedApplication.facultyVisitLogs.length > 0 ? (
                          <div>

                            <div className="!gap-4 grid grid-cols-2">
                              {[...selectedApplication.facultyVisitLogs]
                                .sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
                                .map((visit, index) => {
                                  const getRemainingDays = (dateString) => {
                                    if (!dateString) return null;
                                    const targetDate = new Date(dateString);
                                    const currentDate = new Date();
                                    const daysDifference = Math.ceil((targetDate - currentDate) / (1000 * 60 * 60 * 24));

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
                                      className={`shadow-sm border-l-4 ${
                                        isLatestVisit ? 'border-l-blue-500 bg-blue-50' : 'border-l-gray-300'
                                      }`}
                                    >
                                      {/* Visit Header */}
                                      <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                          <div className="font-medium text-lg">
                                            Visit #{visit.visitNumber || (selectedApplication.facultyVisitLogs.length - index)}
                                          </div>
                                          {isLatestVisit && (
                                            <Tag
                                              color="blue"
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
                                            <Tag color="orange">
                                              Follow-up Required
                                            </Tag>
                                          )}
                                        </div>
                                      </div>

                                      {/* Visit Date */}
                                      <div className="mb-4">
                                        <div className="flex items-center gap-2">
                                          <CalendarOutlined className="text-blue-500" />
                                          <div>
                                            <Text className="text-sm text-gray-500">Visit Date</Text>
                                            <div className="font-medium">
                                              {new Date(visit.visitDate).toLocaleDateString('en-IN', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                              })}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Ratings */}
                                      {(visit.overallSatisfactionRating || visit.studentProgressRating) && (
                                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                                          <Text strong className="block mb-2">Ratings</Text>
                                          <div className="flex gap-4">
                                            {visit.overallSatisfactionRating && (
                                              <div className="text-center">
                                                <Rate
                                                  disabled
                                                  defaultValue={visit.overallSatisfactionRating}
                                                  size="small"
                                                />
                                                <div className="text-xs text-gray-500 mt-1">
                                                  Overall: {visit.overallSatisfactionRating}/5
                                                </div>
                                              </div>
                                            )}
                                            {visit.studentProgressRating && (
                                              <div className="text-center">
                                                <Rate
                                                  disabled
                                                  defaultValue={visit.studentProgressRating}
                                                  size="small"
                                                />
                                                <div className="text-xs text-gray-500 mt-1">
                                                  Progress: {visit.studentProgressRating}/5
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Feedback Sections */}
                                      <div className="space-y-3">
                                        {visit.observationsAboutStudent && (
                                          <div>
                                            <Text strong className="block mb-2 !text-blue-700">
                                              <CommentOutlined className="mr-1" />
                                              Observations about Student
                                            </Text>
                                            <div className="bg-blue-100 p-3 rounded-lg">
                                              <Text className="text-sm !text-black">{visit.observationsAboutStudent}</Text>
                                            </div>
                                          </div>
                                        )}

                                        {visit.feedbackSharedWithStudent && (
                                          <div>
                                            <Text strong className="block mb-2 !text-green-700">
                                              <MessageOutlined className="mr-1" />
                                              Feedback Shared with Student
                                            </Text>
                                            <div className="bg-green-100 p-3 rounded-lg">
                                              <Text className="text-sm !text-black">{visit.feedbackSharedWithStudent}</Text>
                                            </div>
                                          </div>
                                        )}

                                        {visit.responseFromOrganisation && (
                                          <div>
                                            <Text strong className="block mb-2 !text-purple-700">
                                              <ShopOutlined className="mr-1" />
                                              Response from Organisation
                                            </Text>
                                            <div className="bg-purple-100 p-3 rounded-lg">
                                              <Text className="text-sm !text-black">{visit.responseFromOrganisation}</Text>
                                            </div>
                                          </div>
                                        )}

                                        {visit.remarksOfOrganisationSupervisor && (
                                          <div>
                                            <Text strong className="block mb-2 !text-orange-700">
                                              <UserOutlined className="mr-1" />
                                              Remarks of Organisation Supervisor
                                            </Text>
                                            <div className="bg-orange-100 p-3 rounded-lg">
                                              <Text className="text-sm !text-black">{visit.remarksOfOrganisationSupervisor}</Text>
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Additional Information */}
                                      {(visit.assistanceRequiredFromInstitute) && (
                                        <div className="mt-4 pt-3 border-t border-gray-200">
                                          <Text strong className="block mb-3 text-gray-700">
                                            Additional Information
                                          </Text>
                                          <div className="grid grid-cols-1 gap-3">
                                            {visit.assistanceRequiredFromInstitute && (
                                              <div className="bg-green-100 p-2 rounded text-xs">
                                                <Text strong className="!text-green-700 block mb-1">
                                                  Assistance Required:
                                                </Text>
                                                <Text className="!text-gray-700">{visit.assistanceRequiredFromInstitute}</Text>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Next Visit Info */}
                                      {nextVisitInfo && (
                                        <div className="mt-3 p-2 bg-gray-100 rounded-lg flex items-center justify-between">
                                          <div>
                                            <Text className="text-sm font-medium !text-black">Next Visit:</Text>
                                            <Text className="text-sm ml-2 !text-black">
                                              {new Date(visit.nextVisitDate).toLocaleDateString('en-IN', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                              })}
                                            </Text>
                                          </div>
                                          <Tag color={nextVisitInfo.color} size="small">
                                            {nextVisitInfo.text}
                                          </Tag>
                                        </div>
                                      )}
                                    </Card>
                           
                                  );
                                })}
                            </div>

                            <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <Text strong className="!text-black">Total Faculty Visits: </Text>
                                  <Text className="!text-blue-600 text-lg font-semibold">
                                    {
                                      selectedApplication.facultyVisitLogs
                                        .length
                                    }
                                  </Text>
                                </div>
                                <div>
                                  <Text strong className="!text-black">Last Visit: </Text>
                                  <Text className="!text-gray-600">
                                    {selectedApplication.facultyVisitLogs
                                      .length > 0
                                      ? new Date(
                                          Math.max(
                                            ...selectedApplication.facultyVisitLogs.map(
                                              (visit) =>
                                                new Date(visit.visitDate)
                                            )
                                          )
                                        ).toLocaleDateString()
                                      : "N/A"}
                                  </Text>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <TeamOutlined className="text-6xl text-gray-300 mb-4" />
                            <Title level={4} className="text-gray-500 mb-2">
                              No Faculty Visits Yet
                            </Title>
                            <Text className="text-gray-400 block mb-4">
                              Faculty visits and supervision logs will appear
                              here once your internship begins.
                            </Text>
                            {(selectedApplication.status === "JOINED" ||
                              selectedApplication.status === "COMPLETED") && (
                              <Alert
                                title="Note"
                                description="Faculty visits are typically conducted after you join the internship. If you've already joined but don't see any visits, your faculty supervisor will schedule them soon."
                                type="warning"
                                showIcon
                                className="text-left"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </TabPane>

                    {/* Monthly Feedback Tab */}
                    {/* <TabPane
                      tab={
                        <span className="flex items-center">
                          <CalendarOutlined className="mr-2" />
                          Monthly Feedback
                          {applicationMonthlyFeedbacks &&
                            applicationMonthlyFeedbacks.length > 0 && (
                              <Badge
                                count={applicationMonthlyFeedbacks.length}
                                size="small"
                                className="ml-2"
                              />
                            )}
                        </span>
                      }
                      key="monthly-feedback"
                    >
                      <div className="space-y-4">
                        {feedbacksLoading ? (
                          <div className="text-center py-12">
                            <Spin size="small" />
                            <Text className="block mt-4 text-gray-500">
                              Loading monthly feedback...
                            </Text>
                          </div>
                        ) : applicationMonthlyFeedbacks &&
                          applicationMonthlyFeedbacks.length > 0 ? (
                          <div>
                            <Alert
                              title="Monthly Progress Tracking"
                              description="View monthly feedback from the company."
                              type="info"
                              showIcon
                              className="mb-6"
                            />

                            <div className="space-y-4">
                              {[...applicationMonthlyFeedbacks]
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
                                          {new Date(
                                            feedback.feedbackMonth
                                          ).toLocaleDateString("en-US", {
                                            month: "long",
                                            year: "numeric",
                                          })}{" "}
                                          - Progress Report
                                        </span>
                                        <Text className="text-gray-500 text-sm font-normal">
                                          Submitted:{" "}
                                          {new Date(
                                            feedback.submittedAt
                                          ).toLocaleDateString()}
                                        </Text>
                                      </div>
                                    }
                                  >
                              
                                    <Card
                                      title={
                                        <span className="flex items-center text-blue-600">
                                          <BankOutlined className="mr-2" />
                                          Company Assessment
                                        </span>
                                      }
                                      size="small"
                                      className="border-l-4 border-blue-500 bg-blue-50"
                                    >
                                      {feedback.overallRating ||
                                      feedback.attendanceRating ||
                                      feedback.performanceRating ||
                                      feedback.punctualityRating ||
                                      feedback.technicalSkillsRating ||
                                      feedback.strengths ||
                                      feedback.areasForImprovement ||
                                      feedback.tasksAssigned ||
                                      feedback.tasksCompleted ||
                                      feedback.overallComments ? (
                                        <div className="space-y-3">
                                       
                                          {feedback.overallRating && (
                                            <div className="text-center p-3 bg-white rounded-lg border border-blue-200 mb-3">
                                              <div className="text-2xl font-bold text-blue-600">
                                                {feedback.overallRating}
                                              </div>
                                              <div className="text-sm text-gray-600">
                                                Overall Rating
                                              </div>
                                            </div>
                                          )}

                                        
                                          {(feedback.attendanceRating ||
                                            feedback.performanceRating ||
                                            feedback.punctualityRating ||
                                            feedback.technicalSkillsRating) && (
                                            <div className="space-y-2 bg-white p-3 rounded-lg border border-blue-200">
                                              {feedback.attendanceRating && (
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
                                              )}
                                              {feedback.performanceRating && (
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
                                              )}
                                              {feedback.punctualityRating && (
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
                                              )}
                                              {feedback.technicalSkillsRating && (
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
                                              )}
                                            </div>
                                          )}

                                       
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
                                          description="Company feedback not submitted yet"
                                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                                        />
                                      )}
                                    </Card>
                                  </Card>
                                ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <CalendarOutlined className="text-6xl text-gray-300 mb-4" />
                            <Title level={4} className="text-gray-500 mb-2">
                              No Monthly Feedback Yet
                            </Title>
                            <Text className="text-gray-400 block mb-4">
                              Monthly progress tracking will begin once your
                              internship starts.
                            </Text>
                            {(selectedApplication.status === "JOINED" ||
                              selectedApplication.status === "COMPLETED") && (
                              <Alert
                                title="Company Feedback"
                                description="Monthly feedback from the company will appear here once they submit it."
                                type="info"
                                showIcon
                                className="text-left"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </TabPane> */}

                    {/* Completion Feedback Tab - Shows combined feedback */}
                    {completionFeedback && (
                      <TabPane
                        tab={
                          <span className="flex items-center">
                            <TrophyOutlined className="mr-2" />
                            Completion Feedback
                            {completionFeedback && (
                              <span className="ml-2">
                                {completionFeedback.studentFeedback && (
                                  <span className="text-blue-600">👤</span>
                                )}
                                {completionFeedback.industryFeedback && (
                                  <span className="text-green-600">🏢</span>
                                )}
                              </span>
                            )}
                          </span>
                        }
                        key="feedback"
                      >
                        <div className="space-y-4">
                          {completionFeedback ? (
                            /* Show combined feedback */
                            <div>
                              <Alert
                                title="Feedback Available"
                                description="View feedback from both you and the company below."
                                type="success"
                                showIcon
                                className="!mb-4"
                              />

                              <Row gutter={[16, 16]}>
                                {/* Student Feedback Column */}
                                <Col xs={24} lg={12}>
                                  <Card
                                    title={
                                      <span className="flex items-center">
                                        <UserOutlined className="mr-2 text-blue-600" />
                                        Your Feedback to Company
                                      </span>
                                    }
                                    className="border border-blue-100 h-full"
                                  >
                                    {completionFeedback.studentFeedback ? (
                                      <div className="space-y-4">
                                        <div className="text-center mb-4">
                                          <Rate
                                            disabled
                                            defaultValue={
                                              completionFeedback.studentRating
                                            }
                                            className="text-xl"
                                          />
                                          <div className="text-gray-500 mt-1">
                                            {completionFeedback.studentRating}/5
                                            Stars
                                          </div>
                                        </div>

                                        <div>
                                          <Text
                                            strong
                                            className="text-gray-800 block mb-2"
                                          >
                                            Your Experience
                                          </Text>
                                          <div className="bg-blue-50 p-3 rounded-lg">
                                            <Paragraph className="!mb-0 text-sm">
                                              {
                                                completionFeedback.studentFeedback
                                              }
                                            </Paragraph>
                                          </div>
                                        </div>

                                        {completionFeedback.skillsLearned && (
                                          <div>
                                            <Text
                                              strong
                                              className="text-gray-800 block mb-2"
                                            >
                                              Skills Learned
                                            </Text>
                                            <div className="bg-green-50 p-3 rounded-lg">
                                              <Paragraph className="!mb-0 text-sm">
                                                {
                                                  completionFeedback.skillsLearned
                                                }
                                              </Paragraph>
                                            </div>
                                          </div>
                                        )}

                                        {completionFeedback.careerImpact && (
                                          <div>
                                            <Text
                                              strong
                                              className="text-gray-800 block mb-2"
                                            >
                                              Career Impact
                                            </Text>
                                            <div className="bg-purple-50 p-3 rounded-lg">
                                              <Paragraph className="!mb-0 text-sm">
                                                {
                                                  completionFeedback.careerImpact
                                                }
                                              </Paragraph>
                                            </div>
                                          </div>
                                        )}

                                        <div className="bg-gray-50 p-3 rounded-lg">
                                          <div className="flex justify-between items-center">
                                            <Text className="text-sm">
                                              Would recommend:
                                            </Text>
                                            <Tag
                                              color={
                                                completionFeedback.wouldRecommend
                                                  ? "green"
                                                  : "red"
                                              }
                                            >
                                              {completionFeedback.wouldRecommend
                                                ? "Yes"
                                                : "No"}
                                            </Tag>
                                          </div>
                                        </div>

                                        {completionFeedback.studentSubmittedAt && (
                                          <div className="text-center text-gray-500 text-xs">
                                            Submitted:{" "}
                                            {new Date(
                                              completionFeedback.studentSubmittedAt
                                            ).toLocaleDateString()}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-center py-8">
                                        <MessageOutlined className="text-3xl text-gray-300 mb-3" />
                                        <Text className="text-gray-500 block mb-3">
                                          You haven't submitted your feedback
                                          yet
                                        </Text>
                                        {(selectedApplication.status ===
                                          "JOINED" ||
                                          selectedApplication.status ===
                                            "COMPLETED") && (
                                          <Button
                                            type="primary"
                                            size="small"
                                            onClick={() =>
                                              handleOpenFeedbackModal(
                                                selectedApplication
                                              )
                                            }
                                            className="bg-blue-600"
                                          >
                                            Submit Your Feedback
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                  </Card>
                                </Col>

                                {/* Industry Feedback Column */}
                                <Col xs={24} lg={12}>
                                  <Card
                                    title={
                                      <span className="flex items-center">
                                        <ShopOutlined className="mr-2 text-green-600" />
                                        Company Feedback to you
                                      </span>
                                    }
                                    className="border border-green-100 h-full"
                                  >
                                    {completionFeedback.industryFeedback ? (
                                      <div className="space-y-4">
                                        <div className="text-center mb-4">
                                          <Rate
                                            disabled
                                            defaultValue={
                                              completionFeedback.industryRating
                                            }
                                            className="text-xl"
                                          />
                                          <div className="text-gray-500 mt-1">
                                            {completionFeedback.industryRating}
                                            /5 Stars
                                          </div>
                                        </div>

                                        <div>
                                          <Text
                                            strong
                                            className="text-gray-800 block mb-2"
                                          >
                                            Company Assessment
                                          </Text>
                                          <div className="bg-green-50 p-3 rounded-lg">
                                            <Paragraph className="!mb-0 text-sm">
                                              {
                                                completionFeedback.industryFeedback
                                              }
                                            </Paragraph>
                                          </div>
                                        </div>

                                        {completionFeedback.finalPerformance && (
                                          <div>
                                            <Text
                                              strong
                                              className="text-gray-800 block mb-2"
                                            >
                                              Final Performance
                                            </Text>
                                            <div className="bg-blue-50 p-3 rounded-lg">
                                              <Paragraph className="!mb-0 text-sm">
                                                {
                                                  completionFeedback.finalPerformance
                                                }
                                              </Paragraph>
                                            </div>
                                          </div>
                                        )}

                                        <div className="bg-gray-50 p-3 rounded-lg">
                                          <div className="flex justify-between items-center mb-2">
                                            <Text className="text-sm">
                                              Recommend for hire:
                                            </Text>
                                            <Tag
                                              color={
                                                completionFeedback.recommendForHire
                                                  ? "green"
                                                  : "orange"
                                              }
                                            >
                                              {completionFeedback.recommendForHire
                                                ? "Yes"
                                                : "No"}
                                            </Tag>
                                          </div>
                                          <div className="flex justify-between items-center">
                                            <Text className="text-sm">
                                              Status:
                                            </Text>
                                            <Tag
                                              color={
                                                completionFeedback.isCompleted
                                                  ? "green"
                                                  : "blue"
                                              }
                                            >
                                              {completionFeedback.isCompleted
                                                ? "Completed"
                                                : "Ongoing"}
                                            </Tag>
                                          </div>
                                        </div>

                                        {completionFeedback.industrySubmittedAt && (
                                          <div className="text-center text-gray-500 text-xs">
                                            Submitted:{" "}
                                            {new Date(
                                              completionFeedback.industrySubmittedAt
                                            ).toLocaleDateString()}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-center py-8">
                                        <ClockCircleOutlined className="text-3xl text-gray-300 mb-3" />
                                        <Text className="text-gray-500 block">
                                          Company feedback not submitted yet
                                        </Text>
                                      </div>
                                    )}
                                  </Card>
                                </Col>
                              </Row>
                            </div>
                          ) : (
                            /* Show no feedback message */
                            <div>
                              {selectedApplication.status === "JOINED" ||
                              selectedApplication.status === "COMPLETED" ? (
                                <div className="text-center py-12">
                                  <TrophyOutlined className="text-6xl text-gray-300 mb-4" />
                                  <Title
                                    level={4}
                                    className="text-gray-500 mb-2"
                                  >
                                    Share Your Experience
                                  </Title>
                                  <Text className="text-gray-400 block mb-6">
                                    Help us improve by sharing your internship
                                    experience
                                  </Text>
                                  <Button
                                    type="primary"
                                    icon={<MessageOutlined />}
                                    onClick={() =>
                                      handleOpenFeedbackModal(
                                        selectedApplication
                                      )
                                    }
                                    className="bg-green-600 border-0"
                                    size="large"
                                  >
                                    Submit Your Feedback
                                  </Button>
                                </div>
                              ) : (
                                <div className="text-center py-12">
                                  <ClockCircleOutlined className="text-4xl text-gray-300 mb-4" />
                                  <Title
                                    level={4}
                                    className="text-gray-500 mb-2"
                                  >
                                    Feedback Not Available Yet
                                  </Title>
                                  <Text className="text-gray-400">
                                    Complete your internship to provide feedback
                                  </Text>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TabPane>
                    )}

                    {/* Monthly Reports Tab */}
                    <TabPane
                      tab={
                        <span className="flex items-center">
                          <FileTextOutlined className="mr-2" />
                          Monthly Reports
                          {monthlyReports && monthlyReports.length > 0 && (
                            <Badge
                              count={monthlyReports.length}
                              size="small"
                              className="ml-2"
                            />
                          )}
                        </span>
                      }
                      key="monthly-reports"
                    >
                      <div className="space-y-4">
                        {/* Missing Reports Alert */}
                        {/* {missingReports.length > 0 && (
                          <Alert
                            type="warning"
                            title="Missing Reports"
                            description={
                              <div>
                                <p className="mb-2">
                                  You have missing reports for the following
                                  months:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {missingReports.map((missing, index) => (
                                    <Tag key={index} color="orange">
                                      {missing.monthName} {missing.year}
                                    </Tag>
                                  ))}
                                </div>
                              </div>
                            }
                            className="mb-4"
                          />
                        )} */}

                        {/* Upload Section */}
                        <Card className="bg-blue-50 border-purple-200">
                          <Title level={5}>Upload New Monthly Report</Title>
                          {!hasInternshipStarted && (
                            <Alert
                              type="warning"
                              showIcon
                              title="Internship Not Started"
                              description="You can upload monthly reports once your internship begins."
                              className="mb-4"
                            />
                          )}
                          <div className="mt-4 space-y-4">
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),auto]">
                              <div>
                                <Text strong className="block mb-2">
                                  Select Report File (PDF)
                                </Text>
                                <input
                                  type="file"
                                  accept=".pdf"
                                  onChange={handleReportFileChange}
                                  disabled={!hasInternshipStarted}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                                {reportFile && (
                                  <Text className="text-green-600 text-sm mt-1 block">
                                    Selected: {reportFile.name}
                                  </Text>
                                )}
                              </div>
                              <Button
                                type="primary"
                                icon={<UploadOutlined />}
                                onClick={handleUploadMonthlyReport}
                                loading={uploadingReport}
                                disabled={
                                  !hasInternshipStarted ||
                                  !reportFile ||
                                  (!autoReportMonthSelection &&
                                    (!selectedReportMonth || !selectedReportYear))
                                }
                                className="bg-purple-600 border-0"
                              >
                                Upload Report
                              </Button>
                            </div>

                            <div className="bg-white border border-purple-100 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                              <div>
                                <Text strong className="block text-gray-800">
                                  Auto-detect reporting month
                                </Text>
                                <Text className="text-xs text-gray-500">
                                  Turn off to choose the report month and year manually before uploading.
                                </Text>
                              </div>
                              <Switch
                                checked={autoReportMonthSelection}
                                onChange={(checked) => {
                                  setAutoReportMonthSelection(checked);
                                  if (checked) {
                                    const current = new Date();
                                    setSelectedReportMonth(current.getMonth() + 1);
                                    setSelectedReportYear(current.getFullYear());
                                  }
                                }}
                              />
                            </div>

                            {!autoReportMonthSelection && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <Text className="text-sm font-medium block mb-2">
                                    Month
                                  </Text>
                                  <Select
                                    value={selectedReportMonth}
                                    onChange={setSelectedReportMonth}
                                    options={allowedReportMonthOptions}
                                    placeholder="Select month"
                                    disabled={!hasInternshipStarted}
                                    className="w-full"
                                  />
                                </div>
                                <div>
                                  <Text className="text-sm font-medium block mb-2">
                                    Year
                                  </Text>
                                  <Select
                                    value={selectedReportYear}
                                    onChange={setSelectedReportYear}
                                    options={reportYearOptions}
                                    placeholder="Select year"
                                    disabled={!hasInternshipStarted}
                                    className="w-full"
                                  />
                                </div>
                              </div>
                            )}

                            <Alert
                              type="info"
                              showIcon
                              title={
                                !hasInternshipStarted
                                  ? "Report uploads will be enabled once your internship begins."
                                  : autoReportMonthSelection
                                  ? "Current month and year will be assigned automatically."
                                  : "Select the reporting month and year before uploading your PDF."
                              }
                            />
                          </div>
                        </Card>

                        {/* Reports List */}
                        <div>
                          <Title level={5} className="mb-4">
                            Submitted Reports
                          </Title>
                          {monthlyReportsLoading ? (
                            <div className="text-center py-8">
                              <Spin />
                              <p className="text-gray-600 mt-2">
                                Loading reports...
                              </p>
                            </div>
                          ) : monthlyReports.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {monthlyReports.map((report) => (
                                <Card
                                  key={report.id}
                                  className="hover:shadow-lg transition-shadow"
                                >
                                  <div className="flex justify-between items-start mb-3">
                                    <div>
                                      <Text strong className="text-lg block">
                                        {report.monthName} {report.reportYear}
                                      </Text>
                                      <Text className="text-gray-500 text-sm">
                                        Submitted:{" "}
                                        {new Date(
                                          report.submittedAt || report.createdAt
                                        ).toLocaleDateString()}
                                      </Text>
                                    </div>
                                    <Badge
                                      status={
                                        report.status === "APPROVED"
                                          ? "success"
                                          : report.status === "REJECTED"
                                          ? "error"
                                          : report.status === "SUBMITTED"
                                          ? "processing"
                                          : "default"
                                      }
                                      text={report.status}
                                    />
                                  </div>

                                  <div className="mt-4 flex gap-2">
                                    <Button
                                      type="link"
                                      icon={<FileTextOutlined />}
                                      href={getImageUrl(report.reportFileUrl)}
                                      target="_blank"
                                      className="p-0"
                                    >
                                      View Report
                                    </Button>
                                    {report.status === "DRAFT" && (
                                      <>
                                        <Button
                                          type="primary"
                                          size="small"
                                          onClick={() =>
                                            handleSubmitReport(report.id)
                                          }
                                          className="bg-green-500 border-0"
                                        >
                                          Submit for Review
                                        </Button>
                                        <Popconfirm
                                          title="Delete Report"
                                          description="Are you sure you want to delete this report? This action cannot be undone."
                                          onConfirm={() =>
                                            handleDeleteReport(report.id, report.status)
                                          }
                                          okText="Yes, Delete"
                                          cancelText="Cancel"
                                          okButtonProps={{ danger: true }}
                                        >
                                          <Button
                                            type="primary"
                                            danger
                                            size="small"
                                            icon={<DeleteOutlined />}
                                          >
                                            Delete
                                          </Button>
                                        </Popconfirm>
                                      </>
                                    )}
                                  </div>

                                  {report.reviewComments && (
                                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                      <Text strong className="block text-sm">
                                        Review Comments:
                                      </Text>
                                      <Text className="text-sm text-gray-700">
                                        {report.reviewComments}
                                      </Text>
                                    </div>
                                  )}
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <Empty
                              description="No reports uploaded yet"
                              className="py-8"
                            />
                          )}
                        </div>
                      </div>
                    </TabPane>
                  </Tabs>
                </Card>
              )}
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-8 flex lg:flex-nowrap flex-wrap justify-between items-center">
                <div>
                  <Title level={2} className="!mb-2">
                    My Applications
                  </Title>
                  <Text className="text-gray-600 text-lg">
                    Track the status of your internship applications
                  </Text>
                </div>
                {/* <Button
                  type="primary"
                  onClick={() => navigate("/internships/browse")}
                  className="rounded-lg bg-gradient-to-r lg:mt-0 mt-3 from-blue-500 to-purple-600 border-0"
                >
                  Browse More Internships
                </Button> */}
              </div>

              {/* Tabs for Platform and Self-Identified Applications */}
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                className="mb-4"
              >
                {/* <TabPane tab="Platform Internships" key="1">
         
                  {applications.length > 0 ? (
                    <Card className="rounded-2xl">
                      <Table
                        dataSource={applications}
                        columns={columns}
                        rowKey="id"
                        scroll={{ x: "max-content" }}
                        pagination={{
                          pageSize: 5,
                          showSizeChanger: true,
                          showQuickJumper: true,
                          showTotal: (total, range) =>
                            `${range[0]}-${range[1]} of ${total} applications`,
                        }}
                        className="custom-table"
                      />
                    </Card>
                  ) : (
                    <Card className="rounded-2xl border-0 shadow-lg text-center py-20">
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <div>
                            <Title level={4} className="text-gray-500 mb-2">
                              No platform applications yet
                            </Title>
                            <Text className="text-gray-400">
                              Start applying for internships to see them here
                            </Text>
                          </div>
                        }
                      >
                        <Button
                          type="primary"
                          onClick={() => navigate("/internships/browse")}
                          className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 border-0"
                        >
                          Browse Internships
                        </Button>
                      </Empty>
                    </Card>
                  )}
                </TabPane> */}

                <TabPane tab="Self-Identified Internships" key="1">
                  {/* Self-Identified Applications Table */}
                  {selfIdentifiedApplications.length > 0 ? (
                    <Card className="rounded-2xl">
                      <Table
                        dataSource={selfIdentifiedApplications}
                        columns={selfIdentifiedColumns}
                        rowKey="id"
                        scroll={{ x: "max-content" }}
                        pagination={{
                          pageSize: 5,
                          showSizeChanger: true,
                          showQuickJumper: true,
                          showTotal: (total, range) =>
                            `${range[0]}-${range[1]} of ${total} applications`,
                        }}
                        className="custom-table"
                      />
                    </Card>
                  ) : (
                    <Card className="rounded-2xl border-0 shadow-lg text-center py-20">
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <div>
                            <Title level={4} className="text-gray-500 mb-2">
                              No self-identified applications yet
                            </Title>
                            <Text className="text-gray-400">
                              Submit internships you found from other platforms
                            </Text>
                          </div>
                        }
                      >
                        <Button
                          type="primary"
                          onClick={() =>
                            navigate("/internships/self-identified")
                          }
                          className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 border-0"
                        >
                          Submit Self-Identified Internship
                        </Button>
                      </Empty>
                    </Card>
                  )}
                </TabPane>
              </Tabs>
            </>
          )}
        </div>
      </div>

      {/* Student Feedback Submission Modal */}
      <Modal
        title={
          <div className="flex items-center text-green-700">
            <TrophyOutlined className="mr-2" />
            Submit Your Feedback
          </div>
        }
        open={feedbackModal}
        onCancel={() => {
          setFeedbackModal(false);
          form.resetFields();
        }}
        footer={null}
        width={700}
        className="rounded-2xl"
      >
        <div className="mt-6">
          <Alert
            title="Share Your Experience"
            description="Your feedback helps us improve the internship program and assists future students in making informed decisions."
            type="info"
            showIcon
            className="mb-6"
          />

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmitStudentFeedback}
          >
            <Form.Item
              name="studentRating"
              label="Overall Rating"
              rules={[{ required: true, message: "Please provide a rating" }]}
            >
              <Select placeholder="Select performance rating (1-5)">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Option key={value} value={value}>
                    <div className="flex items-center justify-between">
                      <span>
                        {value === 5
                          ? "Outstanding"
                          : value === 4
                          ? "Good"
                          : value === 3
                          ? "Satisfactory"
                          : value === 2
                          ? "Needs Improvement"
                          : "Unsatisfactory"}
                      </span>
                      <div className="flex">
                        {Array.from({ length: 5 }, (_, i) => (
                          <span
                            key={i}
                            className={`text-sm ${
                              i < value ? "text-yellow-400" : "text-gray-300"
                            }`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="studentFeedback"
              label="Your Feedback"
              rules={[
                { required: true, message: "Please provide your feedback" },
              ]}
            >
              <TextArea
                rows={4}
                placeholder="Share your overall experience, what you liked, challenges faced, and suggestions for improvement..."
                maxLength={1000}
                showCount
              />
            </Form.Item>

            <Form.Item name="skillsLearned" label="Skills Learned">
              <TextArea
                rows={3}
                placeholder="What new skills did you acquire during this internship?"
                maxLength={500}
                showCount
              />
            </Form.Item>

            <Form.Item name="careerImpact" label="Career Impact">
              <TextArea
                rows={3}
                placeholder="How has this internship impacted your career goals and future plans?"
                maxLength={500}
                showCount
              />
            </Form.Item>

            <Form.Item
              name="wouldRecommend"
              label="Would you recommend this internship to other students?"
              valuePropName="checked"
            >
              <Switch checkedChildren="Yes" unCheckedChildren="No" />
            </Form.Item>

            <div className="flex justify-end space-x-4 pt-4 border-t">
              <Button
                onClick={() => {
                  setFeedbackModal(false);
                  form.resetFields();
                }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={feedbackLoading}
                icon={<SendOutlined />}
                className="bg-green-600 border-0"
              >
                Submit Feedback
              </Button>
            </div>
          </Form>
        </div>
      </Modal>

      {/* Monthly Feedback Upload Modal */}
      <Modal
        title={
          <div className="flex items-center text-green-700">
            <CalendarOutlined className="mr-2" />
            Upload Monthly Progress
          </div>
        }
        open={monthlyFeedbackModal}
        onCancel={() => {
          setMonthlyFeedbackModal(false);
          setSelectedImageFile(null);
          setImagePreview(null);
        }}
        footer={null}
        width={600}
        className="rounded-2xl"
      >
        <div className="mt-6">
          <Alert
            title="Share Your Monthly Progress"
            description="Upload an image showing your work, achievements, or progress during this month of your internship."
            type="info"
            showIcon
            className="mb-6"
          />

          <div className="space-y-6">
            {/* Image Upload Section */}
            <div>
              <label className="block text-gray-700 font-medium mb-3">
                Select Progress Image *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 transition-colors">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                  id="monthly-feedback-image"
                />
                <label
                  htmlFor="monthly-feedback-image"
                  className="cursor-pointer"
                >
                  {imagePreview ? (
                    <div className="space-y-3">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-64 mx-auto rounded-lg shadow-md"
                      />
                      <Button type="link" className="text-green-600">
                        Change Image
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-5xl mb-3">📸</div>
                      <div className="text-gray-600 mb-2">
                        Click to upload an image
                      </div>
                      <div className="text-gray-400 text-sm">
                        Supported: JPG, PNG, GIF, WEBP (Max 5MB)
                      </div>
                    </div>
                  )}
                </label>
              </div>
              {selectedImageFile && (
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">Selected file:</span>{" "}
                  {selectedImageFile.name} (
                  {(selectedImageFile.size / 1024).toFixed(2)} KB)
                </div>
              )}
            </div>

            {/* Info Card */}
            <Card size="small" className="bg-green-50 border-green-200">
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>Upload screenshots of your work or projects</span>
                </div>
                <div className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>Share certificates or achievements</span>
                </div>
                <div className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>Document your learning progress</span>
                </div>
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 pt-4 border-t">
              <Button
                onClick={() => {
                  setMonthlyFeedbackModal(false);
                  setSelectedImageFile(null);
                  setImagePreview(null);
                }}
                disabled={monthlyFeedbackLoading}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={handleSubmitMonthlyFeedback}
                loading={monthlyFeedbackLoading}
                disabled={!selectedImageFile}
                className="bg-green-600 border-0"
                icon={<SendOutlined />}
              >
                Upload Progress
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Custom CSS for faculty visit styling */}
      <style jsx>{`
        .faculty-visit-item {
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .faculty-visit-item:hover {
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
          transform: translateY(-1px);
          transition: all 0.3s ease;
        }

        .ant-timeline-item-content {
          padding: 8px 0;
        }
      `}</style>
    </Layouts>
  );
};

export default MyApplications;
