import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Popconfirm,
  message,
  Tag,
  Typography,
  Row,
  Col,
  Statistic,
  Tooltip,
  Spin,
  Badge,
  Divider,
  Checkbox,
  Alert,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BankOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  GlobalOutlined,
  CalendarOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  ReloadOutlined,
  UploadOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { toast } from "react-hot-toast";
import {
  fetchInstitutionAsync,
  createInstitutionAsync,
  updateInstitutionAsync,
  deleteInstitutionAsync,
  createPrincipalAsync,
  selectInstitutions,
  selectInstitutionsLoading,
  selectInstitutionsCreating,
  selectInstitutionsUpdating,
  selectInstitutionsDeleting,
  markInstitutionDataStale,
  optimisticallyAddInstitution,
  optimisticallyUpdateInstitution,
  optimisticallyDeleteInstitution,
  rollbackInstitutionOperation,
} from "../../../store/slices/institutionSlice";
import { useDebounce } from "../../../hooks/useDebounce";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const InstituteManagement = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const institutes = useSelector(selectInstitutions);
  const loadingFromRedux = useSelector(selectInstitutionsLoading);
  const creating = useSelector(selectInstitutionsCreating);
  const updating = useSelector(selectInstitutionsUpdating);
  const deleting = useSelector(selectInstitutionsDeleting);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingInstitute, setEditingInstitute] = useState(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState("");
  const debouncedSearchText = useDebounce(searchText, 300);
  const [filteredInstitutes, setFilteredInstitutes] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    autonomous: 0,
  });
  const [createPrincipal, setCreatePrincipal] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [instituteToDelete, setInstituteToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Pagination state
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // Institution types
  const institutionTypes = [
    "POLYTECHNIC",
    "ENGINEERING_COLLEGE",
    "UNIVERSITY",
    "DEGREE_COLLEGE",
    "ITI",
    "SKILL_CENTER",
  ];

  // Fetch institutes using Redux with cache invalidation
  const fetchInstitutes = async () => {
    try {
      // Mark data as stale to force refetch
      dispatch(markInstitutionDataStale());
      await dispatch(fetchInstitutionAsync()).unwrap();
      toast.success("Institutes loaded successfully");
    } catch (error) {
      console.error("Error fetching institutes:", error);
      toast.error("Failed to load institutes");
    }
  };

  // Refresh institutes - mark cache as stale and refetch
  const handleRefresh = async () => {
    try {
      dispatch(markInstitutionDataStale());
      await dispatch(fetchInstitutionAsync()).unwrap();
      toast.success("Institutes refreshed successfully");
    } catch (error) {
      console.error("Error refreshing institutes:", error);
      toast.error("Failed to refresh institutes");
    }
  };

  useEffect(() => {
    dispatch(fetchInstitutionAsync());
  }, [dispatch]);

  // Update filtered institutes and stats when institutes or debounced search changes
  useEffect(() => {
    if (institutes && institutes.length > 0) {
      // Apply global filter to exclude 'SD' institutes
      let filteredData = institutes.filter(inst => inst.shortName !== 'SD');

      // Apply search filter with debounced value
      if (debouncedSearchText) {
        filteredData = filteredData.filter(
          (inst) =>
            inst.name?.toLowerCase().includes(debouncedSearchText.toLowerCase()) ||
            inst.code?.toLowerCase().includes(debouncedSearchText.toLowerCase()) ||
            inst.city?.toLowerCase().includes(debouncedSearchText.toLowerCase()) ||
            inst.state?.toLowerCase().includes(debouncedSearchText.toLowerCase())
        );
      }

      setFilteredInstitutes(filteredData);

      // Update pagination total
      setPagination(prev => ({
        ...prev,
        total: filteredData.length,
        current: 1, // Reset to first page when filter changes
      }));

      // Calculate stats using the filtered data
      setStats({
        total: filteredData.length,
        active: filteredData.filter((inst) => inst.isActive).length,
        inactive: filteredData.filter((inst) => !inst.isActive).length,
        autonomous: filteredData.filter((inst) => inst.autonomousStatus).length,
      });
    }
  }, [institutes, debouncedSearchText]);

  // Handle create/edit modal
  const showModal = (institute = null) => {
    setEditingInstitute(institute);
    setCreatePrincipal(false); // Reset principal creation checkbox
    if (institute) {
      form.setFieldsValue({
        ...institute,
        autonomousStatus: institute.autonomousStatus ? "true" : "false",
        isActive: institute.isActive ? "true" : "false",
      });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  // Handle form submission with optimistic updates
  const handleSubmit = async (values) => {
    const formattedData = {
      ...values,
      autonomousStatus: values.autonomousStatus === "true",
      isActive: values.isActive === "true",
      establishedYear: values.establishedYear
        ? parseInt(values.establishedYear)
        : null,
      totalStudentSeats: values.totalStudentSeats
        ? parseInt(values.totalStudentSeats)
        : null,
      totalStaffSeats: values.totalStaffSeats
        ? parseInt(values.totalStaffSeats)
        : null,
    };

    let institutionData;
    let principalName, principalEmail, principalPhone, principalDesignation;

    // Only remove principal fields if we're creating a new institute with principal
    if (!editingInstitute && createPrincipal) {
      const {
        principalName: pName,
        principalPhone: pPhone,
        principalDesignation: pDesignation,
        ...restData
      } = formattedData;

      principalName = pName;
      principalEmail = formattedData.contactEmail; // Use college email for principal
      principalPhone = pPhone;
      principalDesignation = pDesignation;
      institutionData = restData;
    } else {
      // When editing or creating without principal, use all data
      institutionData = formattedData;
    }

    // Save snapshot for rollback
    const snapshot = { list: [...institutes] };

    try {
      let institutionId;

      if (editingInstitute) {
        // Optimistic update for edit
        dispatch(optimisticallyUpdateInstitution({ id: editingInstitute.id, data: institutionData }));

        // Make actual API call through Redux
        await dispatch(updateInstitutionAsync({ id: editingInstitute.id, data: institutionData })).unwrap();
        toast.success("Institute updated successfully!");
        institutionId = editingInstitute.id;
      } else {
        // Optimistic add for create
        dispatch(optimisticallyAddInstitution(institutionData));

        // Make actual API call through Redux
        const response = await dispatch(createInstitutionAsync(institutionData)).unwrap();
        toast.success("Institute created successfully!");
        institutionId = response.id;
      }

      // Create principal if checkbox is checked and we have the required fields
      if (createPrincipal && principalName && principalEmail && principalPhone) {
        try {
          const principalData = {
            name: principalName,
            email: principalEmail,
            phoneNo: principalPhone,
            designation: principalDesignation || "Principal",
            institutionId: institutionId,
          };

          const principalResponse = await dispatch(createPrincipalAsync(principalData)).unwrap();

          if (principalResponse.success) {
            toast.success(
              `Principal created successfully! Password: ${principalResponse.data.password}`,
              {
                duration: 8000,
              }
            );

            toast.success(
              `Credentials sent to ${principalEmail}`,
              {
                duration: 5000,
              }
            );
          }
        } catch (principalError) {
          console.error("Error creating principal:", principalError);
          toast.error(
            principalError || "Failed to create principal, but institute was created successfully"
          );
        }
      }

      setModalVisible(false);
      form.resetFields();
      setCreatePrincipal(false);
    } catch (error) {
      // Rollback on error
      dispatch(rollbackInstitutionOperation({ snapshot }));
      console.error("Error saving institute:", error);
      toast.error(error || "Failed to save institute");
    }
  };

  // Show delete confirmation modal
  const showDeleteModal = (institute) => {
    setInstituteToDelete(institute);
    setDeleteConfirmText("");
    setDeleteModalVisible(true);
  };

  // Handle delete after confirmation with optimistic updates
  const handleDelete = async () => {
    if (!instituteToDelete) return;

    // Save snapshot for rollback
    const snapshot = { list: [...institutes] };

    // Optimistic delete
    dispatch(optimisticallyDeleteInstitution(instituteToDelete.id));

    try {
      await dispatch(deleteInstitutionAsync(instituteToDelete.id)).unwrap();
      toast.success("Institute deleted successfully!");
      setDeleteModalVisible(false);
      setInstituteToDelete(null);
      setDeleteConfirmText("");
    } catch (error) {
      // Rollback on error
      dispatch(rollbackInstitutionOperation({ snapshot }));
      console.error("Error deleting institute:", error);
      toast.error(error || "Failed to delete institute");
    }
  };

  // Handle view details - navigate to progress page with selected institute
  const handleViewDetails = (institute) => {
    navigate("/state/institutes", {
      state: { selectedInstitute: institute }
    });
  };

  // Handle table pagination change
  const handleTableChange = (newPagination) => {
    setPagination({
      current: newPagination.current,
      pageSize: newPagination.pageSize,
      total: pagination.total,
    });
  };

  // Table columns
  const columns = [
    // {
    //   title: "Code",
    //   dataIndex: "code",
    //   key: "code",
    //   width: 100,
    //   fixed: "left",
    //   render: (code) => (
    //     <Tag color="blue" style={{ fontWeight: 600 }}>
    //       {code}
    //     </Tag>
    //   ),
    // },
    {
      title: "Institution Name",
      dataIndex: "name",
      key: "name",
      width: 250,
      render: (name, record) => (
        <div>
          <Text strong className="text-slate-800">{name || record.shortName || "N/A"}</Text>
          <br />
          <Text className="text-slate-600" style={{ fontSize: "12px" }}>
            {record.type?.replace("_", " ")}
          </Text>
        </div>
      ),
    },
    {
      title: "Location",
      key: "location",
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: "13px" }} className="text-slate-700">
            <EnvironmentOutlined className="text-slate-500" /> {record.city}, {record.state}
          </Text>
          <Text className="text-slate-600" style={{ fontSize: "12px" }}>
            PIN: {record.pinCode}
          </Text>
        </Space>
      ),
    },
    {
      title: "Contact",
      key: "contact",
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: "12px" }} className="text-slate-700">
            <PhoneOutlined className="text-slate-500" /> {record.contactPhone}
          </Text>
          <Text style={{ fontSize: "12px" }} className="text-slate-700">
            <MailOutlined className="text-slate-500" /> {record.contactEmail}
          </Text>
        </Space>
      ),
    },
    {
      title: "Established",
      dataIndex: "establishedYear",
      key: "establishedYear",
      width: 100,
      align: "center",
      render: (year) => <Text className="text-slate-700">{year || "N/A"}</Text>,
    },
    {
      title: "Status",
      key: "status",
      width: 150,
      align: "center",
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Tag
            color={record.isActive ? "success" : "error"}
            icon={
              record.isActive ? (
                <CheckCircleOutlined />
              ) : (
                <CloseCircleOutlined />
              )
            }
          >
            {record.isActive ? "Active" : "Inactive"}
          </Tag>
          {record.autonomousStatus && <Tag color="purple">Autonomous</Tag>}
        </Space>
      ),
    },
    {
      title: "Capacity",
      key: "capacity",
      width: 120,
      align: "center",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          {record.totalStudentSeats && (
            <Text style={{ fontSize: "12px" }} className="text-slate-700">
              <TeamOutlined className="text-slate-500" /> {record.totalStudentSeats} Students
            </Text>
          )}
          {record.totalStaffSeats && (
            <Text style={{ fontSize: "12px" }} className="text-slate-700">
              Staff: {record.totalStaffSeats}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 180,
      align: "center",
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="default"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="primary"
              icon={<EditOutlined />}
              size="small"
              onClick={() => showModal(record)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              danger
              icon={<DeleteOutlined />}
              size="small"
              onClick={() => showDeleteModal(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <Title level={2} className="!text-slate-800">
          <BankOutlined className="mr-2" /> Institution Management
        </Title>
        <Text className="text-slate-600">
          Manage all educational institutions in the state
        </Text>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border-slate-200">
            <Statistic
              title={<span className="text-slate-600">Total Institutes</span>}
              value={stats.total}
              prefix={<BankOutlined className="text-blue-500" />}
              valueStyle={{ color: '#0f172a', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border-slate-200">
            <Statistic
              title={<span className="text-slate-600">Active Institutes</span>}
              value={stats.active}
              prefix={<CheckCircleOutlined className="text-green-500" />}
              valueStyle={{ color: '#0f172a', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border-slate-200">
            <Statistic
              title={<span className="text-slate-600">Inactive Institutes</span>}
              value={stats.inactive}
              prefix={<CloseCircleOutlined className="text-red-500" />}
              valueStyle={{ color: '#0f172a', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border-slate-200">
            <Statistic
              title={<span className="text-slate-600">Autonomous Institutes</span>}
              value={stats.autonomous}
              prefix={<CheckCircleOutlined className="text-purple-500" />}
              valueStyle={{ color: '#0f172a', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content Card */}
      <Card className="shadow-sm border-slate-200">
        {/* Toolbar */}
        <Row gutter={16} style={{ marginBottom: "16px" }} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search by name, code, city, or state"
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              className="rounded-md"
            />
          </Col>
          <Col xs={24} sm={12} md={16} style={{ textAlign: "right" }}>
            <Space wrap>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loadingFromRedux}
              >
                Refresh
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => showModal()}
                style={{
                  border: "none",
                }}
              >
                Add New Institute
              </Button>
            </Space>
          </Col>
        </Row>

        <Divider style={{ margin: "16px 0" }} />

        {/* Table */}
        <Table
          columns={columns}
          dataSource={filteredInstitutes}
          rowKey="id"
          loading={loadingFromRedux}
          scroll={{ x: "max-content" }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} institutes`,
          }}
          onChange={handleTableChange}
        />
      </Card>


        {/* Create/Edit Modal */}
        <Modal
          title={
            <Space>
              <BankOutlined />
              <span>
                {editingInstitute ? "Edit Institute" : "Add New Institute"}
              </span>
            </Space>
          }
          open={modalVisible}
          onCancel={() => {
            setModalVisible(false);
            form.resetFields();
            setEditingInstitute(null);
          }}
          footer={null}
          width={900}
          destroyOnHidden
          styles={{
            body: {
              maxHeight: "calc(100vh - 200px)",
              overflowY: "auto",
              scrollBehavior: "smooth",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            },
          }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              country: "India",
              state: "Punjab",
              autonomousStatus: "false",
              isActive: "true",
              type: "POLYTECHNIC",
            }}
          >
            <Row gutter={16}>
              {/* Basic Information */}
              <Col span={24}>
                <Title level={5}>Basic Information</Title>
              </Col>

              {/* <Col xs={24} md={12}>
                <Form.Item
                  name="code"
                  label="Institution Code"
                  // rules={[
                  //   {
                  //     required: true,
                  //     message: "Please enter institution code",
                  //   },
                  //   {
                  //     pattern: /^[A-Z0-9]+$/,
                  //     message: "Only uppercase letters and numbers allowed",
                  //   },
                  // ]}
                >
                  <Input
                    placeholder="e.g., INST001"
                    disabled={!!editingInstitute}
                  />
                </Form.Item>
              </Col> */}

              <Col xs={24} md={12}>
                <Form.Item
                  name="type"
                  label="Institution Type"
                  rules={[
                    {
                      required: true,
                      message: "Please select institution type",
                    },
                  ]}
                >
                  <Select placeholder="Select type">
                    {institutionTypes.map((type) => (
                      <Option key={type} value={type}>
                        {type.replace("_", " ")}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="name" label="Full Name">
                  <Input placeholder="Full institution name" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="shortName" label="Short Name">
                  <Input placeholder="Abbreviated name" />
                </Form.Item>
              </Col>

              {/* Location Details */}
              <Col span={24}>
                <Divider />
                <Title level={5}>Location Details</Title>
              </Col>

              <Col xs={24}>
                <Form.Item
                  name="address"
                  label="Address"
                  rules={[{ required: true, message: "Please enter address" }]}
                >
                  <TextArea rows={2} placeholder="Full address" />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  name="city"
                  label="City"
                  // rules={[{ required: true, message: "Please enter city" }]}
                >
                  <Input placeholder="City" />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  name="district"
                  label="District"
                >
                  <Input placeholder="District" />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  name="state"
                  label="State"
                  rules={[{ required: true, message: "Please enter state" }]}
                >
                  <Input placeholder="State" />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item
                  name="pinCode"
                  label="PIN Code"
                  // rules={[
                  //   { required: true, message: "Please enter PIN code" },
                  //   {
                  //     pattern: /^[0-9]{6}$/,
                  //     message: "PIN code must be 6 digits",
                  //   },
                  // ]}
                >
                  <Input placeholder="6-digit PIN code" maxLength={6} />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="country"
                  label="Country"
                  rules={[{ required: true, message: "Please enter country" }]}
                >
                  <Input placeholder="Country" />
                </Form.Item>
              </Col>

              {/* Contact Information */}
              <Col span={24}>
                <Divider />
                <Title level={5}>Contact Information</Title>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="contactEmail"
                  label="Email"
                  rules={[
                    { required: true, message: "Please enter email" },
                    { type: "email", message: "Please enter valid email" },
                  ]}
                >
                  <Input
                    prefix={<MailOutlined />}
                    placeholder="contact@institution.edu"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="contactPhone"
                  label="Phone"
                  rules={[
                    { required: true, message: "Please enter phone number" },
                    {
                      pattern: /^[0-9]{10}$/,
                      message: "Phone must be 10 digits",
                    },
                  ]}
                >
                  <Input
                    prefix={<PhoneOutlined />}
                    placeholder="10-digit phone"
                    maxLength={10}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  name="alternatePhone"
                  label="Alternate Phone"
                  rules={[
                    {
                      pattern: /^[0-9]{10}$/,
                      message: "Phone must be 10 digits",
                    },
                  ]}
                >
                  <Input
                    prefix={<PhoneOutlined />}
                    placeholder="10-digit phone (optional)"
                    maxLength={10}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="website" label="Website">
                  <Input
                    prefix={<GlobalOutlined />}
                    placeholder="https://www.institution.edu"
                  />
                </Form.Item>
              </Col>

              {/* Additional Details */}
              <Col span={24}>
                <Divider />
                <Title level={5}>Additional Details</Title>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item name="establishedYear" label="Established Year">
                  <Input
                    type="number"
                    placeholder="e.g., 1990"
                    min={1800}
                    max={new Date().getFullYear()}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item name="totalStudentSeats" label="Student Capacity">
                  <Input type="number" placeholder="Total seats" min={0} />
                </Form.Item>
              </Col>

              <Col xs={24} md={8}>
                <Form.Item name="totalStaffSeats" label="Staff Capacity">
                  <Input type="number" placeholder="Total staff" min={0} />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="affiliatedTo" label="Affiliated To">
                  <Input placeholder="University/Board name" />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item name="recognizedBy" label="Recognized By">
                  <Input placeholder="e.g., AICTE, UGC" />
                </Form.Item>
              </Col>

              {/* <Col xs={24} md={8}>
                <Form.Item name="naacGrade" label="NAAC Grade">
                  <Select placeholder="Select grade" allowClear>
                    <Option value="A++">A++</Option>
                    <Option value="A+">A+</Option>
                    <Option value="A">A</Option>
                    <Option value="B++">B++</Option>
                    <Option value="B+">B+</Option>
                    <Option value="B">B</Option>
                    <Option value="C">C</Option>
                  </Select>
                </Form.Item>
              </Col> */}

              {/* <Col xs={24} md={8} >
                <Form.Item
                  name="autonomousStatus"
                  label="Autonomous Status"
                  rules={[{ required: true }]}
                >
                  <Select>
                    <Option value="true">Yes</Option>
                    <Option value="false">No</Option>
                  </Select>
                </Form.Item>
              </Col> */}

              <Col xs={24} md={8} className="!hidden">
                <Form.Item
                  name="isActive"
                  label="Status"
                  rules={[{ required: true }]}
                >
                  <Select>
                    <Option value="true">Active</Option>
                    <Option value="false">Inactive</Option>
                  </Select>
                </Form.Item>
              </Col>

              {/* Principal Creation Section - Only for new institutes */}
              {!editingInstitute && (
                <>
                  <Col span={24}>
                    <Divider />
                    <Checkbox
                      checked={createPrincipal}
                      onChange={(e) => setCreatePrincipal(e.target.checked)}
                    >
                      <Title level={5} style={{ display: "inline", marginLeft: 8 }}>
                        Also Create Principal for this Institute
                      </Title>
                    </Checkbox>
                  </Col>

                  {createPrincipal && (
                    <>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="principalName"
                          label="Principal Name"
                          rules={[
                            {
                              required: createPrincipal,
                              message: "Please enter principal name",
                            },
                            {
                              min: 3,
                              message: "Name must be at least 3 characters",
                            },
                          ]}
                        >
                          <Input
                            prefix={<TeamOutlined />}
                            placeholder="Full name"
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="principalPhone"
                          label="Principal Phone"
                          rules={[
                            {
                              required: createPrincipal,
                              message: "Please enter phone number",
                            },
                            {
                              pattern: /^[0-9]{10}$/,
                              message: "Phone must be 10 digits",
                            },
                          ]}
                        >
                          <Input
                            prefix={<PhoneOutlined />}
                            placeholder="10-digit phone"
                            maxLength={10}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12} className="!hidden">
                        <Form.Item
                          name="principalDesignation"
                          label="Principal Designation"
                        >
                          <Input placeholder="Principal (optional)" />
                        </Form.Item>
                      </Col>

                      <Col xs={24}>
                        <Alert
                          title="Principal email will use the college contact email"
                          description="Password format: First 4 letters of name + @ + First 4 digits of phone. Credentials will be sent to the college email address."
                          type="info"
                          showIcon
                          style={{ marginBottom: 16 }}
                        />
                      </Col>
                    </>
                  )}
                </>
              )}
            </Row>

            {/* Form Actions */}
            <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
              <Space style={{ width: "100%", justifyContent: "flex-end" }}>
                <Button
                  onClick={() => {
                    setModalVisible(false);
                    form.resetFields();
                    setEditingInstitute(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={editingInstitute ? updating : creating}
                  icon={editingInstitute ? <EditOutlined /> : <PlusOutlined />}
                  style={{
                    border: "none",
                  }}
                >
                  {editingInstitute ? "Update Institute" : "Create Institute"}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          title={
            <Space>
              <DeleteOutlined />
              <span>Delete Institute</span>
            </Space>
          }
          open={deleteModalVisible}
          onCancel={() => {
            setDeleteModalVisible(false);
            setInstituteToDelete(null);
            setDeleteConfirmText("");
          }}
          footer={[
            <Button
              key="cancel"
              onClick={() => {
                setDeleteModalVisible(false);
                setInstituteToDelete(null);
                setDeleteConfirmText("");
              }}
            >
              Cancel
            </Button>,
            <Button
              key="delete"
              type="primary"
              danger
              loading={deleting}
              disabled={deleteConfirmText !== instituteToDelete?.name}
              onClick={handleDelete}
              icon={<DeleteOutlined />}
            >
              Delete
            </Button>,
          ]}
          width={500}
        >
          {instituteToDelete && (
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              {/* Warning Alert */}
              <Alert
                title="Warning: This action cannot be undone"
                description="Deleting this institute will disconnect all associated users, students, and academic records."
                type="error"
                showIcon
              />

              {/* Confirmation Input */}
              <div>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Type institute name to confirm:
                </Text>
                <Text
                  code
                  style={{
                    display: "block",
                    marginBottom: 12,
                    padding: "8px 12px",
                    borderRadius: "4px",
                  }}
                >
                  {instituteToDelete.name || instituteToDelete.shortName}
                </Text>
                <Input
                  placeholder="Type institute name here..."
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  status={deleteConfirmText && deleteConfirmText !== instituteToDelete?.name ? "error" : ""}
                  prefix={<BankOutlined />}
                />
                {deleteConfirmText && deleteConfirmText !== instituteToDelete?.name && (
                  <Text type="danger" style={{ fontSize: "12px", marginTop: "4px", display: "block" }}>
                    Name does not match
                  </Text>
                )}
              </div>
            </Space>
          )}
        </Modal>
      </div>
    </Layout>
  );
};

export default InstituteManagement;