import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Input,
  Modal,
  Row,
  Col,
  Avatar,
  Empty,
  Spin,
  Tooltip,
  Descriptions,
  Select,
  DatePicker,
  Progress,
  Timeline,
  Tabs,
  Badge,
  Dropdown,
} from "antd";
import {
  ShopOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  MailOutlined,
  PhoneOutlined,
  TeamOutlined,
  FileTextOutlined,
  BankOutlined,
  RiseOutlined,
  FilePdfOutlined,
  MoreOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
} from "@ant-design/icons";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import principalService from "../../../../services/principal.service";
import analyticsService from "../../../../services/analytics.service";
import {
  fetchInternshipStats,
  fetchPrincipalDashboard,
  selectInternshipStats,
} from "../../store/principalSlice";
import ProfileAvatar from "../../../../components/common/ProfileAvatar";

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const DashboardInternshipTable = () => {
  const dispatch = useDispatch();
  const internshipStats = useSelector(selectInternshipStats);
  const hasFetched = useRef(false);

  const [loading, setLoading] = useState(true);
  const [internships, setInternships] = useState([]);
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [filters, setFilters] = useState({
    status: "all",
    dateRange: null,
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  // Mentor assignment state
  const [mentors, setMentors] = useState([]);
  const [assignMentorVisible, setAssignMentorVisible] = useState(false);
  const [selectedMentorId, setSelectedMentorId] = useState(null);
  const [mentorAssignLoading, setMentorAssignLoading] = useState(false);
  const [singleAssignRecord, setSingleAssignRecord] = useState(null); // For single row mentor assignment

  // Fetch internships using student progress API (includes reports, visits, completion data)
  const fetchInternships = useCallback(async () => {
    try {
      setLoading(true);

      // Use getStudentProgress which returns comprehensive data including reports, visits, etc.
      const response = await analyticsService.getStudentProgress({
        page: 1,
        limit: 500, // Fetch all for client-side filtering and pagination
      });

      // Response structure: { students: [...], pagination, mentors, statusCounts }
      const students = response?.students || [];

      // Transform student progress data to internship format
      // Filter for students who have internship applications
      const internshipData = students
        .filter((s) => s.application !== null && s.application !== undefined)
        .map((student) => {
          const application = student.application;
          const company = application?.company;
          const facultyMentor = application?.facultyMentor;

          return {
            id: application?.id || student.id,
            studentId: student.id,
            studentName: student.user?.name || student.name,
            studentRollNumber: student.user?.rollNumber || student.rollNumber,
            studentEmail: student.user?.email || student.email,
            studentPhone: student.user?.phoneNo || student.phone,
            studentBatch: student.batch,
            studentDepartment: student.department,
            companyName: company?.name || "N/A",
            companyAddress: company?.address,
            companyContact: company?.contact || company?.phone,
            companyEmail: company?.email,
            jobProfile: application?.jobProfile || application?.internshipTitle,
            stipend: application?.stipendAmount,
            startDate: application?.startDate,
            endDate: application?.endDate,
            duration: application?.duration,
            status: application?.status || "APPROVED",
            internshipPhase: application?.internshipPhase || "NOT_STARTED",
            mentorName: facultyMentor?.name || student.mentor,
            mentorEmail: facultyMentor?.email,
            mentorContact: facultyMentor?.contact,
            mentorDesignation: facultyMentor?.designation,
            mentorId: student.mentorId,
            joiningLetterUrl: application?.joiningLetterUrl,
            joiningLetterUploadedAt: application?.joiningLetterUploadedAt,
            hasJoiningLetter: application?.hasJoiningLetter,
            submittedAt: application?.joiningDate || student.createdAt,
            updatedAt: application?.updatedAt,
            isSelfIdentified: application?.isSelfIdentified ?? true,
            // Counter fields come at student level from API, not inside application
            reportsSubmitted: student.reportsSubmitted ?? 0,
            totalReports: student.totalReports ?? 0,
            expectedReportsAsOfNow: student.expectedReportsAsOfNow || 0,
            completionPercentage: student.completionPercentage || 0,
            facultyVisitsCount: student.facultyVisitsCount ?? 0,
            totalExpectedVisits: student.totalExpectedVisits ?? 0,
            expectedVisitsAsOfNow: student.expectedVisitsAsOfNow || 0,
            lastFacultyVisit: student.lastFacultyVisit,
            timeline: student.timeline || [],
            monthlyReports: student.monthlyReports || [],
          };
        });

      setInternships(internshipData);
      setPagination((prev) => ({
        ...prev,
        total: response?.pagination?.total || internshipData.length,
      }));
    } catch (error) {
      console.error("Failed to fetch internships:", error);
      toast.error(error.message || "Failed to load internships");
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies - fetch all data once

  // Fetch mentors
  const fetchMentors = useCallback(async () => {
    try {
      const response = await principalService.getMentors({ limit: 100 });
      // getMentors returns array directly, not { data: [...] }
      setMentors(Array.isArray(response) ? response : response?.data || []);
    } catch (error) {
      console.error("Failed to fetch mentors:", error);
      setMentors([]);
    }
  }, []);

  // Initial fetch - only runs once
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    fetchInternships();
    fetchMentors();
    dispatch(fetchInternshipStats());
  }, [fetchInternships, fetchMentors, dispatch]);

  // Filter internships
  const filteredInternships = useMemo(() => {
    let filtered = [...internships];

    // Tab filter
    if (activeTab === "approved") {
      // "Active" tab shows approved, joined, and selected internships
      filtered = filtered.filter((i) =>
        ["APPROVED", "JOINED", "SELECTED"].includes(i.status)
      );
    } else if (activeTab === "completed") {
      filtered = filtered.filter((i) => i.status === "COMPLETED");
    }

    // Status filter
    if (filters.status !== "all") {
      filtered = filtered.filter((i) => i.status === filters.status);
    }

    // Date range filter
    if (filters.dateRange && filters.dateRange.length === 2) {
      filtered = filtered.filter((i) => {
        const date = dayjs(i.submittedAt);
        return (
          date.isAfter(filters.dateRange[0]) &&
          date.isBefore(filters.dateRange[1])
        );
      });
    }

    // Search filter
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.studentName?.toLowerCase().includes(search) ||
          i.companyName?.toLowerCase().includes(search) ||
          i.studentRollNumber?.toLowerCase().includes(search) ||
          i.jobProfile?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [internships, activeTab, filters, searchText]);

  // Status helpers - Self-identified internships are auto-approved
  const getStatusConfig = (status) => {
    const configs = {
      APPROVED: {
        color: "success",
        icon: <CheckCircleOutlined />,
        text: "Active",
      },
      JOINED: { color: "processing", icon: <RiseOutlined />, text: "Ongoing" },
      COMPLETED: {
        color: "default",
        icon: <CheckCircleOutlined />,
        text: "Completed",
      },
      APPLIED: {
        color: "warning",
        icon: <ClockCircleOutlined />,
        text: "Processing",
      },
      NOT_STARTED: {
        color: "default",
        icon: <ClockCircleOutlined />,
        text: "Not Started",
      },
    };
    return (
      configs[status] || {
        color: "default",
        icon: <ClockCircleOutlined />,
        text: status,
      }
    );
  };

  // Calculate stats - use API stats for totals, fallback to local calculation
  const stats = useMemo(() => {
    // Use API stats if available (more accurate for totals across all pages)
    if (internshipStats?.total) {
      return {
        total: internshipStats.total || 0,
        ongoing:
          (internshipStats.approved || 0) +
          (internshipStats.joined || 0) +
          (internshipStats.selected || 0),
        completed: internshipStats.completed || 0,
        // Use totalUniqueCompanies (actual count) instead of byCompany.length (top 10 only)
        uniqueCompanies:
          internshipStats.totalUniqueCompanies ||
          internshipStats.byCompany?.length ||
          0,
      };
    }

    // Fallback to local calculation from current page data
    const total = pagination.total || internships.length;
    const ongoing = internships.filter((i) =>
      ["APPROVED", "JOINED", "SELECTED"].includes(i.status)
    ).length;
    const completed = internships.filter(
      (i) => i.status === "COMPLETED"
    ).length;
    const uniqueCompanies = new Set(internships.map((i) => i.companyName)).size;

    return { total, ongoing, completed, uniqueCompanies };
  }, [internships, internshipStats, pagination.total]);

  const handleViewDetails = (internship) => {
    setSelectedInternship(internship);
    setDetailsVisible(true);
  };

  const handleRefresh = () => {
    fetchInternships();
    fetchMentors();
    dispatch(fetchInternshipStats());
    dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
    toast.success("Data refreshed");
  };

  // Assign mentor (handles both bulk and single)
  const handleAssignMentor = async () => {
    if (!selectedMentorId) {
      toast.error("Please select a mentor");
      return;
    }

    // For single record assignment
    if (singleAssignRecord) {
      if (!singleAssignRecord.studentId) {
        toast.error("Student ID not found");
        return;
      }

      try {
        setMentorAssignLoading(true);
        const currentYear = new Date().getFullYear();
        await principalService.assignMentor({
          mentorId: selectedMentorId,
          studentIds: [singleAssignRecord.studentId],
          academicYear: `${currentYear}-${currentYear + 1}`,
        });
        toast.success(
          `Mentor ${
            singleAssignRecord.mentorName ? "changed" : "assigned"
          } successfully`
        );
        setAssignMentorVisible(false);
        setSelectedMentorId(null);
        setSingleAssignRecord(null);
        fetchInternships();
        // Refresh dashboard stats to update Un-assigned Students count
        dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
      } catch (error) {
        console.error("Failed to assign mentor:", error);
        toast.error(error.message || "Failed to assign mentor");
      } finally {
        setMentorAssignLoading(false);
      }
      return;
    }

    // For bulk assignment
    const selectedStudentIds = selectedRowKeys
      .map((key) => {
        const internship = internships.find((i) => i.id === key);
        return internship?.studentId;
      })
      .filter(Boolean);

    if (selectedStudentIds.length === 0) {
      toast.error("No valid students selected");
      return;
    }

    try {
      setMentorAssignLoading(true);
      const currentYear = new Date().getFullYear();
      await principalService.assignMentor({
        mentorId: selectedMentorId,
        studentIds: selectedStudentIds,
        academicYear: `${currentYear}-${currentYear + 1}`,
      });
      toast.success(
        `Mentor assigned to ${selectedStudentIds.length} student(s)`
      );
      setAssignMentorVisible(false);
      setSelectedMentorId(null);
      setSelectedRowKeys([]);
      fetchInternships();
      // Refresh dashboard stats to update Un-assigned Students count
      dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
    } catch (error) {
      console.error("Failed to assign mentor:", error);
      toast.error(error.message || "Failed to assign mentor");
    } finally {
      setMentorAssignLoading(false);
    }
  };

  // Bulk unassign mentor
  const handleBulkUnassignMentor = async () => {
    const selectedStudentIds = selectedRowKeys
      .map((key) => {
        const internship = internships.find((i) => i.id === key);
        return internship?.studentId;
      })
      .filter(Boolean);

    if (selectedStudentIds.length === 0) {
      toast.error("No valid students selected");
      return;
    }

    try {
      setBulkActionLoading(true);
      await principalService.bulkUnassignMentors(selectedStudentIds);
      toast.success(
        `Mentor unassigned from ${selectedStudentIds.length} student(s)`
      );
      setSelectedRowKeys([]);
      fetchInternships();
      // Refresh dashboard stats to update Un-assigned Students count
      dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
    } catch (error) {
      console.error("Failed to unassign mentors:", error);
      toast.error(error.message || "Failed to unassign mentors");
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Single row mentor assignment
  const handleSingleMentorAssign = (record) => {
    setSingleAssignRecord(record);
    setSelectedMentorId(record.mentorId || null);
    setAssignMentorVisible(true);
  };

  // Remove mentor from single student
  const handleRemoveMentor = async (record) => {
    if (!record.studentId) {
      toast.error("Student ID not found");
      return;
    }

    Modal.confirm({
      title: "Remove Mentor",
      content: `Are you sure you want to remove the mentor from ${record.studentName}?`,
      okText: "Remove",
      okType: "danger",
      onOk: async () => {
        try {
          await principalService.bulkUnassignMentors([record.studentId]);
          toast.success("Mentor removed successfully");
          fetchInternships();
          // Refresh dashboard stats to update Un-assigned Students count
          dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
        } catch (error) {
          console.error("Failed to remove mentor:", error);
          toast.error(error.message || "Failed to remove mentor");
        }
      },
    });
  };

  // Row selection for bulk actions
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
    getCheckboxProps: (record) => ({
      disabled: false,
    }),
  };

  // Bulk action menu items
  const bulkActionItems = [
    { type: "group", label: "Mentor Actions" },
    {
      key: "ASSIGN_MENTOR",
      label: "Assign Mentor",
      icon: <UserAddOutlined className="text-green-500" />,
      action: "mentor",
    },
    {
      key: "UNASSIGN_MENTOR",
      label: "Unassign Mentor",
      icon: <UserDeleteOutlined className="text-orange-500" />,
      action: "mentor",
    },
  ];

  // Table columns
  const columns = [
    {
      title: "Student",
      key: "student",
      width: 220,
      fixed: "left",
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <ProfileAvatar
            profileImage={record.studentProfileImage}
            className="bg-primary/10 text-primary"
          />
          <div className="min-w-0">
            <Text className="block font-medium text-text-primary truncate">
              {record.studentName}
            </Text>
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <span>{record.studentRollNumber}</span>
              {record.studentBatch && (
                <>
                  <span>•</span>
                  <span>{record.studentBatch}</span>
                </>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Company",
      key: "company",
      width: 200,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
            <BankOutlined className="text-secondary" />
          </div>
          <div className="min-w-0">
            <Tooltip title={record.companyName}>
              <Text className="block font-medium text-text-primary truncate">
                {record.companyName}
              </Text>
            </Tooltip>
            {record.jobProfile && (
              <Text className="text-xs text-text-tertiary truncate block">
                {record.jobProfile}
              </Text>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Duration",
      key: "duration",
      width: 150,
      render: (_, record) => (
        <div>
          <Text className="text-sm text-text-primary block">
            {record.duration || "N/A"}
          </Text>
          {record.startDate && (
            <Text className="text-xs text-text-tertiary">
              {dayjs(record.startDate).format("DD MMM")} -{" "}
              {record.endDate
                ? dayjs(record.endDate).format("DD MMM YY")
                : "Ongoing"}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "Stipend",
      key: "stipend",
      width: 100,
      render: (_, record) =>
        record.stipend ? (
          <Tag color="green" className="rounded-full">
            ₹{record.stipend}/mo
          </Tag>
        ) : (
          <Tag color="default" className="rounded-full">
            Unpaid
          </Tag>
        ),
    },
    {
      title: "Reports",
      key: "reports",
      width: 110,
      render: (_, record) => {
        const submitted = record.reportsSubmitted || 0;
        const expectedNow = record.expectedReportsAsOfNow || 0;
        const total = record.totalReports || 0;
        const isOnTrack = submitted >= expectedNow;

        return (
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-text-tertiary" />
            <div className="flex items-center gap-1">
              <Text
                className="text-sm font-medium"
                style={{ color: isOnTrack ? "#52c41a" : "#ff4d4f" }}
              >
                {submitted}
              </Text>
              <Text className="text-text-tertiary text-sm">/</Text>
              <Tooltip title={`${expectedNow} due by now`}>
                <Text className="text-sm text-text-secondary">{total}</Text>
              </Tooltip>
            </div>
          </div>
        );
      },
    },
    {
      title: "Completion",
      key: "completion",
      width: 120,
      render: (_, record) => (
        <div className="w-full">
          <Progress
            percent={record.completionPercentage}
            size="small"
            strokeColor={
              record.completionPercentage >= 80
                ? "#52c41a"
                : record.completionPercentage >= 50
                ? "#1890ff"
                : record.completionPercentage >= 30
                ? "#faad14"
                : "#ff4d4f"
            }
            format={(percent) => <span className="text-xs">{percent}%</span>}
          />
        </div>
      ),
    },
    {
      title: "Faculty Visits",
      key: "facultyVisits",
      width: 130,
      render: (_, record) => {
        const completed = record.facultyVisitsCount || 0;
        const expectedNow = record.expectedVisitsAsOfNow || 0;
        const total = record.totalExpectedVisits || 0;
        const isOnTrack = completed >= expectedNow;

        return (
          <div>
            <div className="flex items-center gap-1">
              <Text
                className="text-sm font-medium"
                style={{ color: isOnTrack ? "#52c41a" : "#ff4d4f" }}
              >
                {completed}
              </Text>
              <Text className="text-text-tertiary text-sm">/</Text>
              <Tooltip title={`${expectedNow} due by now`}>
                <Text className="text-sm text-text-secondary">{total}</Text>
              </Tooltip>
            </div>
            {record.lastFacultyVisit && (
              <Text className="text-xs text-text-tertiary">
                Last: {dayjs(record.lastFacultyVisit).format("DD MMM")}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: "Mentor",
      key: "mentor",
      width: 150,
      render: (_, record) =>
        record.mentorName ? (
          <div className="flex items-center gap-2">
            <Avatar
              size="small"
              icon={<TeamOutlined />}
              className="bg-success/10 text-success"
            />
            <Text className="text-sm text-text-primary truncate">
              {record.mentorName}
            </Text>
          </div>
        ) : (
          <Tag color="warning" className="rounded-full">
            Unassigned
          </Tag>
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status) => {
        const config = getStatusConfig(status);
        return (
          <Tag
            icon={config.icon}
            color={config.color}
            className="rounded-full px-3"
          >
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 50,
      fixed: "right",
      render: (_, record) => {
        const menuItems = [
          {
            key: "view",
            label: "View Details",
            icon: <EyeOutlined />,
            onClick: () => handleViewDetails(record),
          },
          ...(record.joiningLetterUrl
            ? [
                {
                  key: "joiningLetter",
                  label: "View Joining Letter",
                  icon: <FilePdfOutlined />,
                  onClick: () => window.open(record.joiningLetterUrl, "_blank"),
                },
              ]
            : []),
          { type: "divider" },
          ...(record.mentorName
            ? [
                {
                  key: "changeMentor",
                  label: "Change Mentor",
                  icon: <TeamOutlined />,
                  onClick: () => handleSingleMentorAssign(record),
                },
                {
                  key: "removeMentor",
                  label: "Remove Mentor",
                  icon: <UserDeleteOutlined />,
                  danger: true,
                  onClick: () => handleRemoveMentor(record),
                },
              ]
            : [
                {
                  key: "assignMentor",
                  label: "Assign Mentor",
                  icon: <UserAddOutlined />,
                  onClick: () => handleSingleMentorAssign(record),
                },
              ]),
        ];

        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <Button
              type="text"
              icon={<MoreOutlined style={{ fontSize: "18px" }} />}
              className="flex items-center justify-center"
            />
          </Dropdown>
        );
      },
    },
  ];

  // Tab items
  const tabItems = [
    {
      key: "all",
      label: (
        <span className="flex items-center gap-2">
          <ShopOutlined />
          All ({stats.total})
        </span>
      ),
    },
    {
      key: "approved",
      label: (
        <span className="flex items-center gap-2">
          <CheckCircleOutlined />
          Active ({stats.ongoing})
        </span>
      ),
    },
    {
      key: "completed",
      label: (
        <span className="flex items-center gap-2">
          <CheckCircleOutlined />
          Completed ({stats.completed})
        </span>
      ),
    },
  ];

  if (loading && internships.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px] gap-4">
        <Spin size="large" />
        <Text className="text-text-secondary animate-pulse">
          Loading internships...
        </Text>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Simple Header */}
      {/* <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-2">
          <ShopOutlined className="text-lg text-primary" />
          <h2 className="text-lg font-semibold text-text-primary m-0">All Internships</h2>
        </div>
        <Tooltip title="Refresh data">
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            Refresh
          </Button>
        </Tooltip>
      </div> */}

      {/* Table */}
      <Card
        className="rounded-2xl border-border shadow-sm"
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={internships}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1600 }}
          expandable={{
            expandedRowRender: (record) => (
              <div className="p-4 bg-background-secondary/30 rounded-lg space-y-4">
                <Row gutter={[24, 16]}>
                  {/* Monthly Reports Section */}
                  <Col xs={24} lg={14}>
                    <div>
                      <Text className="text-xs uppercase font-bold text-text-tertiary block mb-3">
                        <FileTextOutlined className="mr-1" />
                        Monthly Reports ({record.reportsSubmitted}/
                        {record.totalReports})
                      </Text>
                      {record.monthlyReports &&
                      record.monthlyReports.length > 0 ? (
                        <Table
                          dataSource={record.monthlyReports}
                          rowKey="id"
                          size="small"
                          pagination={false}
                          columns={[
                            {
                              title: "Month",
                              dataIndex: "monthName",
                              key: "monthName",
                              render: (text, r) => `${text} ${r.year}`,
                            },
                            {
                              title: "Status",
                              dataIndex: "status",
                              key: "status",
                              render: (status) => (
                                <Tag
                                  color={
                                    status === "APPROVED"
                                      ? "success"
                                      : status === "SUBMITTED"
                                      ? "processing"
                                      : status === "REJECTED"
                                      ? "error"
                                      : "default"
                                  }
                                >
                                  {status}
                                </Tag>
                              ),
                            },
                            {
                              title: "Submitted",
                              dataIndex: "submittedAt",
                              key: "submittedAt",
                              render: (date) =>
                                date ? dayjs(date).format("DD MMM YYYY") : "-",
                            },
                            {
                              title: "Report",
                              key: "report",
                              render: (_, r) =>
                                r.reportFileUrl ? (
                                  <Button
                                    type="link"
                                    size="small"
                                    icon={<FilePdfOutlined />}
                                    onClick={() =>
                                      window.open(r.reportFileUrl, "_blank")
                                    }
                                  >
                                    View
                                  </Button>
                                ) : (
                                  "-"
                                ),
                            },
                          ]}
                        />
                      ) : (
                        <Empty
                          description="No reports submitted yet"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          className="py-4"
                        />
                      )}
                    </div>
                  </Col>

                  {/* Timeline Section */}
                  <Col xs={24} lg={10}>
                    <div>
                      <Text className="text-xs uppercase font-bold text-text-tertiary block mb-3">
                        <ClockCircleOutlined className="mr-1" />
                        Progress Timeline
                      </Text>
                      {record.timeline && record.timeline.length > 0 ? (
                        <Timeline
                          items={record.timeline.map((item, index) => ({
                            key: index,
                            color: item.color,
                            children: item.children,
                          }))}
                        />
                      ) : (
                        <Empty
                          description="No timeline events yet"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          className="py-4"
                        />
                      )}
                    </div>
                  </Col>
                </Row>
              </div>
            ),
            rowExpandable: (record) =>
              record.monthlyReports?.length > 0 || record.timeline?.length > 0,
          }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: internships.length,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} internships`,
            onChange: (page, pageSize) =>
              setPagination({ ...pagination, current: page, pageSize }),
          }}
          locale={{
            emptyText: (
              <Empty
                description={
                  <div className="text-center py-4">
                    <Text className="text-text-tertiary block mb-2">
                      No internships found
                    </Text>
                    <Text className="text-text-tertiary text-xs">
                      Students will appear here once they submit self-identified
                      internships
                    </Text>
                  </div>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>

      {/* Details Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-text-primary">
            <ShopOutlined className="text-purple-500" />
            <span>Internship Details</span>
            {selectedInternship && (
              <Tag color="purple" className="ml-2 rounded-full">
                Self-Identified
              </Tag>
            )}
          </div>
        }
        open={detailsVisible}
        onCancel={() => setDetailsVisible(false)}
        width={800}
        footer={
          <Space>
            <Button onClick={() => setDetailsVisible(false)}>Close</Button>
            {selectedInternship?.joiningLetterUrl && (
              <Button
                type="primary"
                icon={<FilePdfOutlined />}
                onClick={() =>
                  window.open(selectedInternship.joiningLetterUrl, "_blank")
                }
              >
                View Joining Letter
              </Button>
            )}
          </Space>
        }
      >
        {selectedInternship && (
          <div className="space-y-6">
            {/* Status Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ProfileAvatar
                    size={48}
                    profileImage={selectedInternship.studentProfileImage}
                    className="bg-primary/10 text-primary"
                  />
                  <div>
                    <Text className="font-bold text-lg text-text-primary block">
                      {selectedInternship.studentName}
                    </Text>
                    <Text className="text-text-secondary text-sm">
                      {selectedInternship.studentRollNumber}
                    </Text>
                  </div>
                </div>
                <Tag
                  icon={getStatusConfig(selectedInternship.status).icon}
                  color={getStatusConfig(selectedInternship.status).color}
                  className="rounded-full px-4 py-1 text-sm"
                >
                  {getStatusConfig(selectedInternship.status).text}
                </Tag>
              </div>
            </div>

            {/* Company Details */}
            <div>
              <Text className="text-xs uppercase font-bold text-text-tertiary block mb-3">
                <BankOutlined className="mr-1" />
                Company Information
              </Text>
              <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label="Company Name" span={2}>
                  <Text strong>{selectedInternship.companyName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Job Profile">
                  {selectedInternship.jobProfile || "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="Stipend">
                  {selectedInternship.stipend ? (
                    <Tag color="green">{selectedInternship.stipend}/month</Tag>
                  ) : (
                    <Tag color="default">Unpaid</Tag>
                  )}
                </Descriptions.Item>
                {selectedInternship.companyAddress && (
                  <Descriptions.Item label="Address" span={2}>
                    <div className="flex items-start gap-1">
                      <EnvironmentOutlined className="text-text-tertiary mt-1" />
                      <span>{selectedInternship.companyAddress}</span>
                    </div>
                  </Descriptions.Item>
                )}
                {selectedInternship.companyContact && (
                  <Descriptions.Item label="Contact">
                    <div className="flex items-center gap-1">
                      <PhoneOutlined className="text-text-tertiary" />
                      <span>{selectedInternship.companyContact}</span>
                    </div>
                  </Descriptions.Item>
                )}
                {selectedInternship.companyEmail && (
                  <Descriptions.Item label="Email">
                    <div className="flex items-center gap-1">
                      <MailOutlined className="text-text-tertiary" />
                      <span>{selectedInternship.companyEmail}</span>
                    </div>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </div>

            {/* Duration Details */}
            <div>
              <Text className="text-xs uppercase font-bold text-text-tertiary block mb-3">
                <CalendarOutlined className="mr-1" />
                Internship Duration
              </Text>
              <Descriptions bordered column={{ xs: 1, sm: 3 }} size="small">
                <Descriptions.Item label="Start Date">
                  {selectedInternship.startDate
                    ? dayjs(selectedInternship.startDate).format("DD MMM YYYY")
                    : "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="End Date">
                  {selectedInternship.endDate
                    ? dayjs(selectedInternship.endDate).format("DD MMM YYYY")
                    : "Ongoing"}
                </Descriptions.Item>
                <Descriptions.Item label="Duration">
                  <Tag color="blue">{selectedInternship.duration || "N/A"}</Tag>
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* Mentor Details */}
            {selectedInternship.mentorName && (
              <div>
                <Text className="text-xs uppercase font-bold text-text-tertiary block mb-3">
                  <TeamOutlined className="mr-1" />
                  Faculty Mentor
                </Text>
                <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                  <Descriptions.Item label="Name">
                    <Text strong>{selectedInternship.mentorName}</Text>
                  </Descriptions.Item>
                  {selectedInternship.mentorDesignation && (
                    <Descriptions.Item label="Designation">
                      {selectedInternship.mentorDesignation}
                    </Descriptions.Item>
                  )}
                  {selectedInternship.mentorEmail && (
                    <Descriptions.Item label="Email" span={2}>
                      <div className="flex items-center gap-1">
                        <MailOutlined className="text-text-tertiary" />
                        <span>{selectedInternship.mentorEmail}</span>
                      </div>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </div>
            )}

            {/* Student Contact */}
            <div>
              <Text className="text-xs uppercase font-bold text-text-tertiary block mb-3">
                <UserOutlined className="mr-1" />
                Student Contact
              </Text>
              <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                {selectedInternship.studentEmail && (
                  <Descriptions.Item label="Email">
                    <div className="flex items-center gap-1">
                      <MailOutlined className="text-text-tertiary" />
                      <span>{selectedInternship.studentEmail}</span>
                    </div>
                  </Descriptions.Item>
                )}
                {selectedInternship.studentPhone && (
                  <Descriptions.Item label="Phone">
                    <div className="flex items-center gap-1">
                      <PhoneOutlined className="text-text-tertiary" />
                      <span>{selectedInternship.studentPhone}</span>
                    </div>
                  </Descriptions.Item>
                )}
                {selectedInternship.studentBatch && (
                  <Descriptions.Item label="Batch">
                    {selectedInternship.studentBatch}
                  </Descriptions.Item>
                )}
                {selectedInternship.studentDepartment && (
                  <Descriptions.Item label="Department">
                    {selectedInternship.studentDepartment}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </div>
          </div>
        )}
      </Modal>

      {/* Assign Mentor Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-text-primary">
            <UserAddOutlined className="text-green-500" />
            <span>
              {singleAssignRecord
                ? singleAssignRecord.mentorName
                  ? "Change Mentor"
                  : "Assign Mentor"
                : "Assign Mentor to Selected Students"}
            </span>
          </div>
        }
        open={assignMentorVisible}
        onCancel={() => {
          setAssignMentorVisible(false);
          setSelectedMentorId(null);
          setSingleAssignRecord(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setAssignMentorVisible(false);
              setSelectedMentorId(null);
              setSingleAssignRecord(null);
            }}
          >
            Cancel
          </Button>,
          <Button
            key="assign"
            type="primary"
            loading={mentorAssignLoading}
            onClick={handleAssignMentor}
            disabled={!selectedMentorId}
            icon={<UserAddOutlined />}
          >
            {singleAssignRecord?.mentorName ? "Change Mentor" : "Assign Mentor"}
          </Button>,
        ]}
        width={500}
      >
        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <Text className="text-sm text-blue-700">
              {singleAssignRecord ? (
                <>
                  Assigning mentor to{" "}
                  <strong>{singleAssignRecord.studentName}</strong>
                </>
              ) : (
                <>
                  <strong>{selectedRowKeys.length}</strong> student(s) selected
                  for mentor assignment
                </>
              )}
            </Text>
          </div>

          <div>
            <Text className="block text-sm font-medium text-text-primary mb-2">
              Select Faculty Mentor
            </Text>
            <Select
              placeholder="Search and select a mentor..."
              value={selectedMentorId}
              onChange={setSelectedMentorId}
              className="w-full"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                option?.children?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {mentors.map((mentor) => (
                <Select.Option key={mentor.id} value={mentor.id}>
                  {mentor.name} - {mentor.designation || mentor.role}
                </Select.Option>
              ))}
            </Select>
          </div>

          {selectedMentorId && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <Text className="text-sm text-green-700">
                Selected mentor will be assigned to all {selectedRowKeys.length}{" "}
                student(s)
              </Text>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default DashboardInternshipTable;
