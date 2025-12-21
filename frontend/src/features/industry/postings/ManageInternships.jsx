// src/pages/industry/ManageInternships.jsx
import React, { useState, useEffect } from "react";
import {
  Card,
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
  Dropdown,
  Progress,
  Tooltip,
  List,
  Avatar,
  Descriptions,
  Divider,
  Empty,
  Statistic,
  Tabs,
  Table,
  Alert,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  MoreOutlined,
  StopOutlined,
  PlayCircleOutlined,
  ExclamationCircleOutlined,
  CalendarOutlined,
  TeamOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  BankOutlined,
  ContactsOutlined,
  ShopOutlined,
  StarOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import API from "../../../services/api";
import Layouts from "../../../components/Layout";
import Paragraph from "antd/es/skeleton/Paragraph";
import { toast } from "react-hot-toast";
import EditInternshipModal from "../../../components/EditInternshipModal";
import { useDispatch, useSelector } from "react-redux";
import {
  selectIndustryError,
  selectIndustryLoading,
  selectIndustryProfile,
  setIndustryProfile,
} from "../../../store/slices/industrySlice";
import { useSmartIndustry } from "../../../hooks";
import { useDebounce } from "../../../hooks/useDebounce";
const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;
const { confirm } = Modal;
const { TabPane } = Tabs;

const ManageInternships = () => {
  const dispatch = useDispatch();

  // Use smart fetching hook
  const { data: profile, loading, error, isStale, forceRefresh, clearError } =
    useSmartIndustry();

  // const [loading, setLoading] = useState(true);
  // const [internships, setInternships] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const debouncedSearchText = useDebounce(searchText, 300);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [activeTab, setActiveTab] = useState("1");
  const navigate = useNavigate();
  const [editModalVisible, setEditModalVisible] = useState(false);
  // Get internships from Redux profile
  const internships = profile?.internships || [];
  useEffect(() => {
    filterData();
  }, [debouncedSearchText, statusFilter, internships]);

  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  // useEffect(() => {
  //   // Auto-select first internship when data loads
  //   if (filteredData.length > 0 && !selectedInternship) {
  //     setSelectedInternship(filteredData[0]);
  //   }
  // }, [filteredData]);

  // const fetchInternships = async () => {
  //   setLoading(true);
  //   try {
  //     const response = await API.get("/industries/profile");
  //     const internshipsFromProfile = response.data.internships;
  //     setInternships(internshipsFromProfile);
  //     await new Promise((resolve) => setTimeout(resolve, 1000));
  //   } catch (error) {
  //     toast.error("Error fetching internships");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const filterData = () => {
    let filtered = internships;

    if (debouncedSearchText) {
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(debouncedSearchText.toLowerCase()) ||
          item.fieldOfWork.toLowerCase().includes(debouncedSearchText.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    setFilteredData(filtered);
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await API.patch(`/internships/${id}/status`, { status: newStatus });
      // Update Redux store
      const updatedProfile = {
        ...profile,
        internships: profile.internships.map((item) =>
          item.id === id ? { ...item, status: newStatus } : item
        ),
      };
      dispatch(setIndustryProfile(updatedProfile));

      // Update selected internship if it's the one being changed
      if (selectedInternship && selectedInternship.id === id) {
        setSelectedInternship((prev) => ({ ...prev, status: newStatus }));
      }

      toast.success(`Internship ${newStatus.toLowerCase()} successfully`);
    } catch (error) {
      toast.error("Error updating status");
    }
  };

  const handleDelete = async (id, title) => {
    try {
      const industryId = profile.id;
      await API.delete(`/internships/${id}`, { data: { industryId } });
      const updatedProfile = {
        ...profile,
        internships: profile.internships.filter((item) => item.id !== id),
      };
      dispatch(setIndustryProfile(updatedProfile));

      if (selectedInternship && selectedInternship.id === id) {
        const remaining = filteredData.filter((item) => item.id !== id);
        setSelectedInternship(remaining.length > 0 ? remaining[0] : null);
      }
      toast.success(`"${title}" deleted successfully`);
    } catch (error) {
      toast.error("Error deleting internship");
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      ACTIVE: "green",
      INACTIVE: "orange",
      COMPLETED: "blue",
      CANCELLED: "red",
    };
    return colors[status] || "default";
  };

  const getStatusIcon = (status) => {
    const icons = {
      ACTIVE: <CheckCircleOutlined />,
      INACTIVE: <ClockCircleOutlined />,
      COMPLETED: <CheckCircleOutlined />,
      CANCELLED: <ClockCircleOutlined />,
    };
    return icons[status] || <ClockCircleOutlined />;
  };

  const handleEdit = (internship) => {
    setSelectedInternship(internship);
    setEditModalVisible(true);
  };

  const handleEditSuccess = (updatedInternship) => {
    // Update Redux store immediately
    const updatedProfile = {
      ...profile,
      internships: profile.internships.map((item) =>
        item.id === updatedInternship.id ? updatedInternship : item
      ),
    };
    dispatch(setIndustryProfile(updatedProfile));

    // Mark data as stale for other components
    dispatch(markDataStale());
    setSelectedInternship(updatedInternship);
    toast.success("Internship updated successfully!");
  };

  const getActionsMenu = (record) => ({
    items: [
      {
        key: "view",
        label: "View Applications",
        icon: <EyeOutlined />,
        onClick: () =>
          navigate(
            `/industry/internships?tab=applicants&internshipId=${record.id}`
          ),
      },
      {
        key: "edit",
        label: "Edit",
        icon: <EditOutlined />,
        onClick: () => handleEdit(record),
        disabled: record.status === "COMPLETED",
      },
      {
        key: "divider1",
        type: "divider",
      },
      {
        key: "activate",
        label: record.status === "ACTIVE" ? "Deactivate" : "Activate",
        icon:
          record.status === "ACTIVE" ? (
            <StopOutlined />
          ) : (
            <PlayCircleOutlined />
          ),
        onClick: () =>
          handleStatusChange(
            record.id,
            record.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
          ),
        disabled: record.status === "COMPLETED",
      },
      {
        key: "divider2",
        type: "divider",
      },
      {
        key: "delete",
        label: "Delete",
        icon: <DeleteOutlined />,
        danger: true,
        onClick: () => handleDelete(record.id, record.title),
        disabled: record.applications > 0,
      },
    ],
  });

  // Calculate stats for selected internship
  const calculateStats = (internship) => {
    if (!internship) return null;

    const applications = internship.applications || [];
    const selectedCount = applications.filter(
      (app) => app.status === "SELECTED"
    ).length;
    const applicationRate =
      internship.numberOfPositions > 0
        ? Math.round((applications.length / internship.numberOfPositions) * 100)
        : 0;
    const selectionRate =
      applications.length > 0
        ? Math.round((selectedCount / applications.length) * 100)
        : 0;

    return {
      totalApplications: applications.length,
      selectedCount,
      applicationRate,
      selectionRate,
    };
  };

  const stats = calculateStats(selectedInternship);
  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Alert
          title="Error Loading Internships"
          description={error}
          type="error"
          showIcon
          className="mb-4"
        />
        <Button type="primary" onClick={forceRefresh} icon={<ReloadOutlined />}>
          Retry
        </Button>
      </div>
    );
  }

  // No profile state
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Empty
          description="No profile found. Please complete your company profile first."
          className="mb-4"
        />
        <Button
          type="primary"
          onClick={() => navigate("/industry/profile")}
          icon={<UserOutlined />}
        >
          Complete Profile
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      {/* Stale data indicator */}
      {isStale && (
        <Alert
          message="Data may be outdated"
          description="Your internship data might not reflect the latest changes. Click refresh to update."
          type="warning"
          showIcon
          action={
            <Button
              size="small"
              type="primary"
              onClick={forceRefresh}
              icon={<ReloadOutlined />}
              className="rounded-md"
            >
              Refresh
            </Button>
          }
          className="mb-6 rounded-2xl border-warning/20 bg-warning-50/50 shadow-sm"
        />
      )}

      {/* Header Section */}
      <div className="flex flex-wrap justify-between items-center mb-6">
        <Title level={3} className="text-primary mb-0">
          Internship Management
        </Title>
      </div>

      <Row gutter={[24, 24]}>
        {/* Internships List - Left Column */}
        <Col
          xs={24}
          md={8}
          lg={7}
          xl={6}
        >
          <Card
            title={
              <div className="flex items-center text-primary font-semibold">
                <ShopOutlined className="mr-2" /> Internships Directory
              </div>
            }
            className="shadow-sm rounded-xl border-border h-[calc(100vh-200px)] flex flex-col"
            styles={{
              header: { borderBottom: "1px solid rgba(var(--color-border), 0.5)" },
              body: { padding: "12px", overflowY: "auto", flex: 1 },
            }}
          >
            <div className="mb-4 space-y-3">
              <Search
                placeholder="Search internships..."
                className="rounded-lg"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                prefix={<SearchOutlined className="text-text-tertiary" />}
                allowClear
              />

              <div className="flex justify-between items-center gap-2">
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  className="flex-1 rounded-lg"
                  placeholder="Filter by status"
                >
                  <Option value="all">All Status</Option>
                  <Option value="ACTIVE">Active</Option>
                  <Option value="INACTIVE">Inactive</Option>
                  <Option value="COMPLETED">Completed</Option>
                  <Option value="CANCELLED">Cancelled</Option>
                </Select>

                <Link to="/industry/post-internship">
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    className="rounded-lg shadow-md shadow-primary/20"
                  >
                    New
                  </Button>
                </Link>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Spin size="small" />
              </div>
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={filteredData}
                locale={{ emptyText: "No internships found" }}
                renderItem={(internship) => (
                  <List.Item
                    onClick={() => setSelectedInternship(internship)}
                    className={`
                      cursor-pointer my-2 px-3 py-3 rounded-xl transition-all duration-200
                      ${
                        selectedInternship?.id === internship.id
                          ? "bg-primary-50 border border-primary/30 shadow-sm"
                          : "hover:bg-background-tertiary/50 border border-transparent"
                      }
                    `}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          size={40}
                          icon={<BankOutlined />}
                          className={`${
                            selectedInternship?.id === internship.id
                              ? "bg-primary text-white"
                              : "bg-background-tertiary text-text-tertiary"
                          } rounded-lg`}
                        />
                      }
                      title={
                        <Text strong className={`text-sm block line-clamp-1 ${
                          selectedInternship?.id === internship.id ? "text-primary" : "text-text-primary"
                        }`}>
                          {internship.title}
                        </Text>
                      }
                      description={
                        <div className="space-y-1 mt-1">
                          <div className="flex flex-wrap gap-1">
                            <Tag color={getStatusColor(internship.status)} className="text-[10px] px-1.5 leading-tight m-0 rounded-md">
                              {internship.status}
                            </Tag>
                            <Tag className="text-[10px] px-1.5 leading-tight m-0 rounded-md bg-background-tertiary border-0">
                              {internship.numberOfPositions} Pos
                            </Tag>
                          </div>
                          <div className="text-[10px] text-text-tertiary flex items-center gap-1 font-medium">
                            <ContactsOutlined className="text-[9px]" />
                            {internship.applications?.length || 0} Applicants
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Internship Details - Right Column */}
        <Col
          xs={24}
          md={16}
          lg={17}
          xl={18}
        >
          {selectedInternship ? (
            <div className="space-y-6">
              {/* Header Info */}
              <Card className="shadow-sm rounded-xl border-border bg-background overflow-hidden">
                <div className="flex flex-col md:flex-row items-center gap-6 p-2">
                  <Avatar
                    size={80}
                    icon={<BankOutlined />}
                    className="shadow-lg bg-primary text-white rounded-2xl"
                  />
                  <div className="flex-grow text-center md:text-left">
                    <Title level={3} className="mb-1 text-text-primary">
                      {selectedInternship.title}
                    </Title>
                    <div className="flex justify-center md:justify-start items-center text-text-secondary text-base mb-3 font-medium">
                      <ShopOutlined className="mr-2 text-text-tertiary" />
                      {selectedInternship.fieldOfWork} •{" "}
                      {selectedInternship.duration}
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-start gap-2">
                      <Tag
                        color={getStatusColor(selectedInternship.status)}
                        className="px-3 py-0.5 rounded-full font-medium"
                      >
                        {selectedInternship.status}
                      </Tag>
                      <Tag className="px-3 py-0.5 rounded-full border-border bg-background-tertiary text-text-primary font-medium">
                        {selectedInternship.numberOfPositions} Positions
                      </Tag>
                      <Tag className="px-3 py-0.5 rounded-full border-border bg-background-tertiary text-text-primary font-medium">
                        {selectedInternship.workLocation?.replace("_", " ") || "On-site"}
                      </Tag>
                      {selectedInternship.isStipendProvided && (
                        <Tag color="success" className="px-3 py-0.5 rounded-full font-medium">
                          ₹{selectedInternship.stipendAmount?.toLocaleString()}/mo
                        </Tag>
                      )}
                    </div>
                  </div>

                  {/* Actions Dropdown */}
                  <div className="shrink-0">
                    <Dropdown
                      menu={getActionsMenu(selectedInternship)}
                      trigger={["click"]}
                      placement="bottomRight"
                    >
                      <Button
                        type="text"
                        icon={<MoreOutlined className="text-xl" />}
                        className="hover:bg-background-tertiary rounded-xl w-10 h-10 flex items-center justify-center"
                      />
                    </Dropdown>
                  </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 p-4 bg-background-tertiary/30 rounded-2xl border border-border/50">
                  <div className="flex items-center p-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mr-3">
                      <ContactsOutlined className="text-lg" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-text-tertiary">Applications</div>
                      <div className="text-base font-bold text-text-primary">
                        {selectedInternship.applications?.length || 0}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center p-2">
                    <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center mr-3">
                      <CheckCircleOutlined className="text-lg" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-text-tertiary">Selected</div>
                      <div className="text-base font-bold text-text-primary">
                        {stats?.selectedCount || 0}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center p-2">
                    <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center mr-3">
                      <CalendarOutlined className="text-lg" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-text-tertiary">Deadline</div>
                      <div className="text-sm font-bold text-text-primary">
                        {dayjs(selectedInternship.applicationDeadline).format("DD MMM YYYY")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center p-2">
                    <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center mr-3">
                      <ClockCircleOutlined className="text-lg" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-text-tertiary">Start Date</div>
                      <div className="text-sm font-bold text-text-primary">
                        {dayjs(selectedInternship.startDate).format("DD MMM YYYY")}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Tabs Content */}
              <Card className="shadow-sm rounded-xl border-border" styles={{ body: { padding: 0 } }}>
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  className="px-6"
                >
                  <TabPane
                    tab={
                      <span className="flex items-center gap-2 py-2">
                        <InfoCircleOutlined /> Basic Information
                      </span>
                    }
                    key="1"
                  >
                    <div className="py-6 space-y-8">
                      {/* Description */}
                      <div className="bg-background-tertiary/30 p-6 rounded-2xl border border-border/50">
                        <Title level={5} className="mb-4 flex items-center text-text-primary uppercase text-xs tracking-widest font-bold">
                          <FileTextOutlined className="mr-2 text-primary" />
                          About Internship
                        </Title>
                        <div className="space-y-4">
                          <Text className="text-text-primary text-base leading-relaxed block">
                            {selectedInternship.description}
                          </Text>
                          {selectedInternship.detailedDescription && (
                            <div className="pt-4 border-t border-border/50">
                              <Text className="text-text-secondary leading-relaxed block">
                                {selectedInternship.detailedDescription}
                              </Text>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Details Row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="rounded-2xl border-border bg-background shadow-sm" size="small" title={<Text className="text-xs uppercase font-bold text-text-tertiary">Work Information</Text>}>
                          <Descriptions column={1} size="small" className="mt-2">
                            <Descriptions.Item label="Field">{selectedInternship.fieldOfWork}</Descriptions.Item>
                            <Descriptions.Item label="Location">{selectedInternship.workLocation?.replace("_", " ")}</Descriptions.Item>
                            <Descriptions.Item label="Positions">{selectedInternship.numberOfPositions}</Descriptions.Item>
                          </Descriptions>
                        </Card>
                        <Card className="rounded-2xl border-border bg-background shadow-sm" size="small" title={<Text className="text-xs uppercase font-bold text-text-tertiary">Compensation</Text>}>
                          <Descriptions column={1} size="small" className="mt-2">
                            <Descriptions.Item label="Stipend">
                              {selectedInternship.isStipendProvided ? (
                                <Tag color="success" className="rounded-md m-0">₹{selectedInternship.stipendAmount}/mo</Tag>
                              ) : (
                                <Tag className="rounded-md m-0">Unpaid</Tag>
                              )}
                            </Descriptions.Item>
                            {selectedInternship.stipendDetails && (
                              <Descriptions.Item label="Details">{selectedInternship.stipendDetails}</Descriptions.Item>
                            )}
                          </Descriptions>
                        </Card>
                      </div>
                    </div>
                  </TabPane>

                  <TabPane
                    tab={
                      <span className="flex items-center gap-2 py-2">
                        <SafetyCertificateOutlined /> Eligibility & Skills
                      </span>
                    }
                    key="2"
                  >
                    <div className="py-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="rounded-2xl border-border shadow-sm" size="small" title={<Text className="text-xs uppercase font-bold text-text-tertiary">Criteria</Text>}>
                          <div className="space-y-4 py-2">
                            <div className="flex justify-between items-center">
                              <Text className="text-text-secondary">Min Percentage</Text>
                              <Text strong className="text-primary">{selectedInternship.minimumPercentage || "N/A"}%</Text>
                            </div>
                            <Divider className="my-2" />
                            <div>
                              <Text className="text-text-secondary block mb-2">Target Branches</Text>
                              <div className="flex flex-wrap gap-1.5">
                                {selectedInternship.eligibleBranches?.map(b => <Tag key={b} className="rounded-md bg-background-tertiary border-border m-0">{b}</Tag>)}
                              </div>
                            </div>
                          </div>
                        </Card>
                        <Card className="rounded-2xl border-border shadow-sm" size="small" title={<Text className="text-xs uppercase font-bold text-text-tertiary">Required Skills</Text>}>
                          <div className="py-2 flex flex-wrap gap-2">
                            {selectedInternship.requiredSkills?.map(s => <Tag key={s} color="error" className="rounded-md m-0">{s}</Tag>)}
                            {selectedInternship.preferredSkills?.map(s => <Tag key={s} color="processing" className="rounded-md m-0">{s}</Tag>)}
                          </div>
                        </Card>
                      </div>
                    </div>
                  </TabPane>

                  <TabPane
                    tab={
                      <span className="flex items-center gap-2 py-2">
                        <UserOutlined /> Applications
                      </span>
                    }
                    key="3"
                  >
                    <div className="py-8 text-center max-w-lg mx-auto">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                        <ContactsOutlined className="text-2xl" />
                      </div>
                      <Title level={4} className="text-text-primary mb-2">Manage Applicants</Title>
                      <Text className="text-text-secondary block mb-8">
                        View profiles, review cover letters, and select candidates for your internship program.
                      </Text>
                      <Button
                        type="primary"
                        size="large"
                        icon={<EyeOutlined />}
                        onClick={() => navigate(`/industry/internships?tab=applicants&internshipId=${selectedInternship.id}`)}
                        className="rounded-xl px-10 h-12 shadow-lg shadow-primary/20"
                      >
                        View Applicants ({selectedInternship.applications?.length || 0})
                      </Button>
                    </div>
                  </TabPane>
                </Tabs>
              </Card>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center py-20">
              <Empty
                image={<div className="text-6xl mb-4 opacity-20"><ShopOutlined /></div>}
                description={
                  <div className="max-w-xs mx-auto">
                    <Title level={4} className="text-text-tertiary">Select Internship</Title>
                    <Text className="text-text-tertiary">Choose an internship from the directory to view details and manage applicants.</Text>
                  </div>
                }
              />
            </div>
          )}
        </Col>
      </Row>
      
      <EditInternshipModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        internship={selectedInternship}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};
      <EditInternshipModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        internship={selectedInternship}
        onSuccess={handleEditSuccess}
      />
    </div>

    // </Layouts>
  );
};

export default ManageInternships;