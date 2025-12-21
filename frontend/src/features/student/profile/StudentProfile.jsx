import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import API from "../../../services/api";
import { getImageUrl } from "../../../utils/imageUtils";
import {
  Card,
  Col,
  Row,
  Typography,
  Spin,
  Avatar,
  Tag,
  Progress,
  Tabs,
  Statistic,
  Table,
  Button,
  Empty,
  Form,
  Input,
  Select,
  Upload,
  Modal,
} from "antd";
import ImgCrop from "antd-img-crop";
import {
  UserOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  CalendarOutlined,
  DollarOutlined,
  BookOutlined,
  TrophyOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  EditOutlined,
  TeamOutlined,
  UploadOutlined,
  BulbOutlined,
  LaptopOutlined,
  BankOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  DollarCircleOutlined,
  SolutionOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  StopOutlined,
  CameraOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import Layouts from "../../../components/Layout";
import toast from "react-hot-toast";

const { Title, Text } = Typography;
const { TabPane } = Tabs;

export default function StudentProfile() {
  //const {id} = useParams();
  const [id, setId] = useState(null);
  const [student, setStudent] = useState(null);
  const [semesters, setSemesters] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const rawResults = student?.results || [];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [uploadForm] = Form.useForm();
  const [uploadModal, setUploadModal] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [profileImageList, setProfileImageList] = useState([]);
  const [imageUploading, setImageUploading] = useState(false);
  const toastShownRef = useRef(false);

  // State-wise District and Tehsil data
  const stateDistrictTehsilData = {
    Punjab: {
      Amritsar: ["Amritsar-I", "Amritsar-II", "Ajnala", "Attari", "Baba Bakala", "Majitha", "Rayya", "Tarn Taran"],
      Barnala: ["Barnala", "Mehal Kalan", "Tapa"],
      Bathinda: ["Bathinda", "Sangat", "Talwandi Sabo", "Rampura Phul", "Maur"],
      Faridkot: ["Faridkot", "Jaito", "Kotkapura"],
      "Fatehgarh Sahib": ["Fatehgarh Sahib", "Amloh", "Bassi Pathana", "Khamanon", "Mandi Gobindgarh", "Sirhind"],
      Fazilka: ["Fazilka", "Abohar", "Jalalabad"],
      "Ferozepur": ["Ferozepur", "Fazilka", "Guru Har Sahai", "Zira", "Makhu"],
      Gurdaspur: ["Gurdaspur", "Batala", "Dera Baba Nanak", "Dhariwal", "Kahnuwan", "Kalanaur", "Pathankot", "Qadian", "Sri Hargobindpur", "Sujanpur"],
      Hoshiarpur: ["Hoshiarpur", "Dasuya", "Garhshankar", "Hariana", "Mukerian", "Talwara"],
      Jalandhar: ["Jalandhar-I", "Jalandhar-II", "Adampur", "Bhogpur", "Goraya", "Nakodar", "Phillaur", "Shahkot"],
      Kapurthala: ["Kapurthala", "Bhulath", "Dhilwan", "Phagwara", "Sultanpur Lodhi"],
      Ludhiana: ["Ludhiana East", "Ludhiana West", "Doraha", "Jagraon", "Khanna", "Payal", "Raikot", "Samrala"],
      Mansa: ["Mansa", "Budhlada", "Sardulgarh"],
      Moga: ["Moga", "Baghapurana", "Dharamkot", "Nihal Singh Wala"],
      "Mohali (S.A.S Nagar)": ["Mohali", "Derabassi", "Kharar", "Kurali"],
      "Muktsar": ["Muktsar", "Gidderbaha", "Malout"],
      "Pathankot": ["Pathankot", "Dhar Kalan", "Sujanpur"],
      Patiala: ["Patiala", "Nabha", "Rajpura", "Patran", "Samana"],
      Rupnagar: ["Rupnagar", "Anandpur Sahib", "Chamkaur Sahib", "Morinda", "Nangal"],
      "Sangrur": ["Sangrur", "Ahmedgarh", "Barnala", "Bhawanigarh", "Dhuri", "Dirba", "Lehragaga", "Longowal", "Malerkotla", "Moonak", "Sunam"],
      "Shaheed Bhagat Singh Nagar": ["Nawanshahr", "Balachaur", "Banga", "Garhshankar"],
      "Tarn Taran": ["Tarn Taran", "Khadur Sahib", "Patti", "Khem Karan"],
    },
    "Himachal Pradesh": {
      Bilaspur: ["Bilaspur", "Ghumarwin", "Jhandutta", "Sadar"],
      Chamba: ["Chamba", "Bharmour", "Churah", "Dalhousie", "Pangi", "Salooni"],
      Hamirpur: ["Hamirpur", "Barsar", "Bhoranj", "Nadaun", "Sujanpur"],
      Kangra: ["Kangra", "Baijnath", "Baroh", "Dehra", "Dharamshala", "Fatehpur", "Indora", "Jawalamukhi", "Jaisinghpur", "Kangra", "Khundian", "Nurpur", "Palampur", "Pragpur", "Rakkar", "Shahpur", "Sulah"],
      Kinnaur: ["Kinnaur", "Hangrang", "Kalpa", "Moorang", "Nichar", "Pooh"],
      Kullu: ["Kullu", "Ani", "Banjar", "Bhuntar", "Kullu", "Manali", "Naggar", "Nirmand"],
      "Lahaul and Spiti": ["Lahaul", "Spiti", "Keylong", "Udaipur"],
      Mandi: ["Mandi", "Aut", "Balh", "Bali Chowki", "Chachiot", "Dharmpur", "Gohar", "Jogindernagar", "Karsog", "Padhar", "Sarkaghat", "Sundernagar", "Thunag"],
      Shimla: ["Shimla", "Chirgaon", "Chopal", "Jubbal", "Kotkhai", "Kumarsain", "Nankhari", "Rampur", "Rohru", "Theog"],
      Sirmaur: ["Sirmaur", "Nahan", "Pachhad", "Paonta Sahib", "Rajgarh", "Sangrah", "Shillai"],
      Solan: ["Solan", "Arki", "Dharampur", "Kandaghat", "Kasauli", "Nalagarh"],
      Una: ["Una", "Amb", "Bangana", "Bharwain", "Gagret", "Haroli"]
    }
  };

  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");

  const resultsBySemester = useMemo(() => {
    // clone & sort
    const sorted = [...rawResults].sort(
      (a, b) =>
        Number(a.Subject?.semesterNumber || 0) -
        Number(b.Subject?.semesterNumber || 0)
    );
    // group
    return sorted.reduce((acc, res) => {
      const sem = res.Subject?.semesterNumber ?? "Unknown";
      (acc[sem] = acc[sem] || []).push(res);
      return acc;
    }, {});
  }, [rawResults]);

  const semesterList = Object.keys(resultsBySemester)
    .map((s) => (s === "Unknown" ? s : Number(s)))
    .sort((a, b) => {
      if (a === "Unknown") return 1;
      if (b === "Unknown") return -1;
      return a - b;
    });

  // useEffect(() => {
  //   const loginData = localStorage.getItem("loginResponse");

  //   if (loginData) {
  //     try {
  //       const parsed = JSON.parse(loginData);
  //       // console.log(parsed.user.id)
  //       // adjust these paths based on your actual response shape
  //       setId(parsed.user.id);
  //     } catch (e) {
  //       console.error("Failed to parse loginResponse:", e);
  //     }
  //   }
  // }, []);

  // helper to map category → tag color
  const getCategoryColor = (cat) => {
    switch (cat) {
      case "GENERAL":
        return "blue";
      case "OBC":
        return "orange";
      case "SC":
        return "green";
      case "ST":
        return "purple";
      default:
        return "default";
    }
  };

  const getPlacementStatusColor = (status) => {
    switch (status) {
      case "ACCEPTED":
        return "success";
      case "JOINED":
        return "green";
      case "OFFERED":
        return "processing";
      case "REJECTED":
        return "error";
      default:
        return "default";
    }
  };

  const fetchSemesters = async () => {
    try {
      const res = await API.get("/semesters");
      setSemesters(res.data);
    } catch {
      console.error("Failed to fetch semesters");
    }
  };
  useEffect(() => {
    fetchSemesters();
  }, []);

  const getInternshipStatusColor = (status) => {
    const statusColors = {
      APPLIED: "blue",
      UNDER_REVIEW: "orange",
      SELECTED: "green",
      REJECTED: "red",
      JOINED: "purple",
      COMPLETED: "cyan",
    };
    return statusColors[status] || "default";
  };

  const getInternshipProgress = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (now < start) return 0;
    if (now > end) return 100;

    const total = end - start;
    const elapsed = now - start;

    return Math.round((elapsed / total) * 100);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // helper to look up semester name if you need it later
  const getSemesterName = (id) => {
    const semester = semesters.find((s) => s.id === id);
    return semester ? `Semester ${semester.number}` : id;
  };

  const fetchStudent = async () => {
    const loginData = localStorage.getItem("loginResponse");

    const parsed = JSON.parse(loginData);
    // console.log(parsed.user.id)
    // adjust these paths based on your actual response shape
    setId(parsed.user.id);

    try {
      const res = await API.get(`/students/profile/${parsed.user.id}`);
      setStudent(res.data);

      // Check for missing required fields
      const studentData = res.data;
      const requiredFields = [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'contact', label: 'Contact' },
        { key: 'parentName', label: 'Parent Name' },
        { key: 'parentContact', label: 'Parent Contact' },
        { key: 'gender', label: 'Gender' },
        { key: 'pinCode', label: 'Pin Code' },
        { key: 'address', label: 'Address' },
        { key: 'city', label: 'City/Village' },
        { key: 'state', label: 'State' },
        { key: 'tehsil', label: 'Tehsil' },
        { key: 'district', label: 'District' },
        { key: 'category', label: 'Category' }
      ];

      const missingFields = requiredFields.filter(field => 
        !studentData[field.key] || studentData[field.key].toString().trim() === ''
      );

      if (missingFields.length > 0 && !toastShownRef.current) {
        const toastId = toast.error(
          (t) => (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span>Please complete your profile!</span>
              <button
                onClick={() => toast.dismiss(t.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '0',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                ✕
              </button>
            </div>
          ),
          {
            duration: Infinity,
            position: 'top-right',
            style: {
              fontWeight: 'bold',
              padding: '16px',
              borderRadius: '8px',
              minWidth: '300px',
            },
            icon: '⚠️',
          }
        );
        toastShownRef.current = toastId;
      }

      // compute stats
      const fees = res.data.fees || [];
      const totalDue = fees.reduce((sum, f) => sum + f.amountDue, 0);
      // compute original totals per-semester:
      const totalPaid = fees.reduce((sum, f) => sum + f.amountPaid, 0);
      const totalOriginal = fees.reduce(
        (sum, f) => sum + (f.amountPaid + f.amountDue),
        0
      );
      const feePct =
        totalOriginal > 0 ? Math.round((totalPaid / totalOriginal) * 100) : 0;

      const results = res.data.results || [];
      const passed = results.filter((r) => r.marks >= 30).length;
      const totalSubj = results.length;
      const passPct =
        totalSubj > 0 ? Math.round((passed / totalSubj) * 100) : 0;

      setStats({
        feePercentage: feePct,
        passPercentage: passPct,
      });
    } catch (e) {
      console.error(e);
      setError("Failed to load student profile.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchStudent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditSubmit = async (values) => {
    try {
      setImageUploading(true);

      // Create FormData for multipart request
      const formData = new FormData();

      // Add all form values to FormData
      Object.keys(values).forEach((key) => {
        if (values[key] !== undefined && values[key] !== null) {
          formData.append(key, values[key]);
        }
      });

      // Add profile image if selected
      if (profileImageList.length > 0 && profileImageList[0].originFileObj) {
        formData.append("profileImage", profileImageList[0].originFileObj);
      }

      await API.put(`/students/update-student/${student.id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("Student updated successfully", {
        duration: 4000,
        position: 'top-center',
      });
      setIsModalOpen(false);
      setProfileImageList([]);
      fetchStudent();
    } catch (error) {
      console.error("Update error:", error);
      toast.error(error.response?.data?.message || "Failed to update student", {
        duration: 5000,
        position: 'top-center',
      });
    } finally {
      setImageUploading(false);
    }
  };

  const openEditModal = () => {
    // Dismiss the profile incomplete toast if it exists
    if (toastShownRef.current) {
      toast.dismiss(toastShownRef.current);
      toastShownRef.current = false;
    }

    form.setFieldsValue({
      name: student.name,
      email: student.email,
      contact: student.contact,
      parentName: student.parentName,
      parentContact: student.parentContact,
      address: student.address,
      dob: student.dob ? student.dob.slice(0, 10) : null,
      city: student.city,
      state: student.state,
      pinCode: student.pinCode,
      tehsil: student.tehsil,
      gender: student.gender,
      district: student.district,
      tenthper: student.tenthper,
      twelthper: student.twelthper,
      rollNumber: student.rollNumber,
      // admissionNumber: student.admissionNumber,
      admissionType: student.admissionType,
      category: student.category,
      batchId: student.batch?.id,
    });

    // Set selected state and district for cascading dropdowns
    if (student.state) {
      setSelectedState(student.state);
    }
    if (student.district) {
      setSelectedDistrict(student.district);
    }

    // Reset image upload state
    setProfileImageList([]);
    setImageUploading(false);

    setIsModalOpen(true);
  };

  const openUploadModal = () => {
    uploadForm.resetFields();
    setFileList([]);
    setUploadModal(true);
  };

  const handleUpload = async (values) => {
    if (!fileList.length) return toast.error("Please select a file.");
    const formData = new FormData();
    formData.append("studentId", student.id);
    formData.append("type", values.type);
    formData.append("file", fileList[0]);

    try {
      setUploading(true);
      await API.post("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Document uploaded successfully");
      setUploadModal(false);
      fetchStudent();
    } catch {
      toast.error("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  if (loading)
    return (
      <Layouts>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100vh",
          }}
        >
          <Spin size="small" tip="Loading profile..." />
        </div>
      </Layouts>
    );
  if (error)
    return (
      <Layouts>
        <div style={{ padding: "32px" }}>
          <Text type="danger">{error}</Text>
        </div>
      </Layouts>
    );

  return (
    <Layouts>
      <div className="h-full overflow-y-auto py-4">
        <div className="max-w-full mx-auto">
          {/* Action Buttons */}
          <div className="flex gap-2 justify-end mb-4 flex-wrap">
            <Button icon={<EditOutlined />} onClick={openEditModal} className="rounded-lg">
              Edit Profile
            </Button>
            <Button
              type="primary"
              onClick={openUploadModal}
              icon={<UploadOutlined />}
              className="rounded-lg shadow-md shadow-primary/20"
            >
              Add Document
            </Button>
          </div>

          {/* Profile Header Card */}
          <Card className="mb-4 rounded-2xl border-border shadow-sm">
            <Row gutter={[24, 24]}>
              {/* Avatar and Basic Info */}
              <Col xs={24} lg={18}>
                <Row gutter={16} align="middle">
                  <Col flex="none">
                    <Avatar
                      size={80}
                      src={getImageUrl(student.profileImage)}
                      icon={<UserOutlined />}
                      className="border-2 border-background shadow-sm"
                    />
                  </Col>
                  <Col flex="auto">
                    <Title level={3} className="!mb-1 text-text-primary">
                      {student.name}
                    </Title>
                    <div className="mb-3">
                      <Text className="text-text-secondary">
                        <IdcardOutlined className="mr-1" /> {student.rollNumber} 
                      </Text>
                    </div>

                    {/* Tags */}
                    <div className="flex gap-2 flex-wrap">
                      <Tag className="rounded-md">{student.branchName}</Tag>
                      <Tag color={getCategoryColor(student.category)} className="rounded-md">
                        {student.category}
                      </Tag>
                      <Tag className="rounded-md">{student.admissionType}</Tag>
                      {student.batch && <Tag className="rounded-md">{student.batch.name}</Tag>}
                      <Tag color={student.isActive ? "success" : "error"} className="rounded-md">
                        {student.isActive ? "Active" : "Inactive"}
                      </Tag>
                      {student.clearanceStatus && (
                        <Tag
                          color={
                            student.clearanceStatus === "CLEARED"
                              ? "success"
                              : student.clearanceStatus === "PENDING"
                              ? "processing"
                              : "warning"
                          }
                          className="rounded-md"
                        >
                          {student.clearanceStatus}
                        </Tag>
                      )}
                    </div>
                  </Col>
                </Row>
              </Col>
            </Row>

            {/* Contact Info */}
            <Row
              gutter={[16, 16]}
              className="mt-6 pt-6 border-t border-border"
            >
              <Col xs={24} sm={8}>
                <div className="flex items-center gap-3">
                  <Avatar
                    size={32}
                    icon={<MailOutlined />}
                    className="bg-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <Text className="text-[10px] uppercase tracking-wider text-text-secondary font-bold block">
                      Email
                    </Text>
                    <Text ellipsis className="text-sm font-medium text-text-primary">
                      {student.email}
                    </Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div className="flex items-center gap-3">
                  <Avatar
                    size={32}
                    icon={<PhoneOutlined />}
                    className="bg-success"
                  />
                  <div className="flex-1 min-w-0">
                    <Text className="text-[10px] uppercase tracking-wider text-text-secondary font-bold block">
                      Contact
                    </Text>
                    <Text className="text-sm font-medium text-text-primary">
                      {student.contact || "N/A"}
                    </Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div className="flex items-center gap-3">
                  <Avatar
                    size={32}
                    icon={<CalendarOutlined />}
                    className="bg-warning"
                  />
                  <div className="flex-1 min-w-0">
                    <Text className="text-[10px] uppercase tracking-wider text-text-secondary font-bold block">
                      Date of Birth
                    </Text>
                    <Text className="text-sm font-medium text-text-primary">
                      {student.dob?.slice(0, 10) || "N/A"}
                    </Text>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>

          {/* Detailed Tabs */}
          <Card styles={{ body: { padding: 0 } }} className="rounded-2xl border-border shadow-sm overflow-hidden">
            <Tabs defaultActiveKey="1" className="px-4">
              {/* Personal Info */}
              <TabPane
                tab={
                  <span className="flex items-center gap-2">
                    <UserOutlined /> Personal Info
                  </span>
                }
                key="1"
              >
                <div className="py-6 px-2">
                  <Row gutter={[24, 24]}>
                    {/* Basic Information */}
                    <Col xs={24} lg={12}>
                      <div>
                        <Title
                          level={5}
                          className="pb-2 border-b border-border text-text-primary"
                        >
                          Basic Information
                        </Title>
                        <div className="mt-4 space-y-1">
                          <Row className="py-2 border-b border-border/50">
                            <Col span={8}>
                              <Text className="text-text-secondary">Gender</Text>
                            </Col>
                            <Col span={16} className="text-right">
                              <Text className="text-text-primary font-medium">{student.gender || "N/A"}</Text>
                            </Col>
                          </Row>
                          <Row className="py-2 border-b border-border/50">
                            <Col span={8}>
                              <Text className="text-text-secondary">Category</Text>
                            </Col>
                            <Col span={16} className="text-right">
                              <Tag color={getCategoryColor(student.category)} className="rounded-md">
                                {student.category}
                              </Tag>
                            </Col>
                          </Row>
                          <Row className="py-2 border-b border-border/50">
                            <Col span={8}>
                              <Text className="text-text-secondary">Admission Type</Text>
                            </Col>
                            <Col span={16} className="text-right">
                              <Text className="text-text-primary font-medium">{student.admissionType}</Text>
                            </Col>
                          </Row>
                          <Row className="py-2 border-b border-border/50">
                            <Col span={8}>
                              <Text className="text-text-secondary">Roll Number</Text>
                            </Col>
                            <Col span={16} className="text-right">
                              <Text className="text-text-primary font-medium">{student.rollNumber}</Text>
                            </Col>
                          </Row>
                          <Row className="py-2">
                            <Col span={8}>
                              <Text className="text-text-secondary">Batch</Text>
                            </Col>
                            <Col span={16} className="text-right">
                              <Text className="text-text-primary font-medium">{student.batch?.name || "N/A"}</Text>
                            </Col>
                          </Row>
                        </div>
                      </div>
                    </Col>

                    {/* Contact Information */}
                    <Col xs={24} lg={12}>
                      <div>
                        <Title
                          level={5}
                          className="pb-2 border-b border-border text-text-primary"
                        >
                          Contact Information
                        </Title>
                        <div className="mt-4 space-y-1">
                          <Row className="py-2 border-b border-border/50">
                            <Col span={8}>
                              <Text className="text-text-secondary">Email</Text>
                            </Col>
                            <Col span={16} className="text-right">
                              <Text ellipsis className="text-text-primary font-medium">
                                {student.email}
                              </Text>
                            </Col>
                          </Row>
                          <Row className="py-2 border-b border-border/50">
                            <Col span={8}>
                              <Text className="text-text-secondary">Contact</Text>
                            </Col>
                            <Col span={16} className="text-right">
                              <Text className="text-text-primary font-medium">{student.contact || "N/A"}</Text>
                            </Col>
                          </Row>
                          <Row className="py-2 border-b border-border/50">
                            <Col span={8}>
                              <Text className="text-text-secondary">Address</Text>
                            </Col>
                            <Col span={16} className="text-right">
                              <Text className="text-text-primary font-medium">{student.address || "N/A"}</Text>
                            </Col>
                          </Row>
                          <Row className="py-2 border-b border-border/50">
                            <Col span={8}>
                              <Text className="text-text-secondary">Parent Name</Text>
                            </Col>
                            <Col span={16} className="text-right">
                              <Text className="text-text-primary font-medium">{student.parentName || "N/A"}</Text>
                            </Col>
                          </Row>
                          <Row className="py-2">
                            <Col span={8}>
                              <Text className="text-text-secondary">Parent Contact</Text>
                            </Col>
                            <Col span={16} className="text-right">
                              <Text className="text-text-primary font-medium">
                                {student.parentContact || "N/A"}
                              </Text>
                            </Col>
                          </Row>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              </TabPane>

              {/* Documents */}
              <TabPane
                tab={
                  <span className="flex items-center gap-2">
                    <FileTextOutlined /> Documents
                  </span>
                }
                key="4"
              >
                <div className="p-6">
                  {student.document?.length > 0 ? (
                    <Row gutter={[16, 16]}>
                      {student.document.map((doc, idx) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={idx}>
                          <Card
                            hoverable
                            size="small"
                            className="rounded-xl border-border overflow-hidden"
                            onClick={() =>
                              window.open(getImageUrl(doc.fileUrl), "_blank")
                            }
                            cover={
                              <div className="h-40 flex items-center justify-center overflow-hidden p-2 bg-background-tertiary/30">
                                <img
                                  src={getImageUrl(doc.fileUrl)}
                                  alt={doc.fileName}
                                  className="max-h-full max-w-full object-contain"
                                />
                              </div>
                            }
                          >
                            <Card.Meta
                              title={
                                <Text ellipsis className="text-text-primary font-medium">
                                  {doc.type.replaceAll("_", " ")}
                                </Text>
                              }
                              description={
                                <Text
                                  ellipsis
                                  className="text-text-tertiary text-xs"
                                >
                                  {doc.fileName}
                                </Text>
                              }
                            />
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  ) : (
                    <Empty
                      description="No documents uploaded"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      className="py-10"
                    >
                      <Button type="primary" onClick={openUploadModal} className="rounded-lg">
                        Add Document
                      </Button>
                    </Empty>
                  )}
                </div>
              </TabPane>

              {/* Placements Tab */}
              <TabPane
                tab={
                  <span className="flex items-center gap-2">
                    <BulbOutlined /> Placements
                  </span>
                }
                key="5"
              >
                <div className="p-6">
                  {(student.placements || []).length > 0 ? (
                    <Row gutter={[16, 16]}>
                      {(student.placements || []).map((placement, index) => (
                        <Col xs={24} md={12} lg={8} key={placement.id || index}>
                          <Card
                            size="small"
                            className={`rounded-xl border-l-4 ${
                              placement.status === "ACCEPTED" ||
                              placement.status === "JOINED"
                                ? "border-success bg-success-50"
                                : placement.status === "OFFERED"
                                ? "border-primary bg-primary-50"
                                : "border-error bg-error-50"
                            }`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <Title level={5} className="!m-0 text-text-primary">
                                {placement.companyName}
                              </Title>
                              <Tag
                                color={getPlacementStatusColor(
                                  placement.status
                                )}
                                className="rounded-md"
                              >
                                {placement.status}
                              </Tag>
                            </div>
                            <div className="flex flex-col gap-2">
                              <div className="flex items-start gap-2">
                                <SolutionOutlined className="mt-1 text-text-tertiary" />
                                <div>
                                  <Text className="text-text-secondary text-xs">Job Role: </Text>
                                  <Text className="text-text-primary text-sm font-medium">
                                    {placement.jobRole || "N/A"}
                                  </Text>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <DollarCircleOutlined className="mt-1 text-text-tertiary" />
                                <div>
                                  <Text className="text-text-secondary text-xs">Salary: </Text>
                                  <Text className="text-text-primary text-sm font-medium">
                                    {placement.salary
                                      ? `₹ ${placement.salary.toFixed(2)} LPA`
                                      : "N/A"}
                                  </Text>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <CalendarOutlined className="mt-1 text-text-tertiary" />
                                <div>
                                  <Text className="text-text-secondary text-xs">Offer Date: </Text>
                                  <Text className="text-text-primary text-sm font-medium">
                                    {formatDate(placement.offerDate)}
                                  </Text>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  ) : (
                    <Empty
                      description="No placement records available"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      className="py-10"
                    />
                  )}
                </div>
              </TabPane>

              {/* Internships Tab */}
              <TabPane
                tab={
                  <span className="flex items-center gap-2">
                    <LaptopOutlined />{" "}
                    <span className="hidden sm:inline">Internships</span>
                  </span>
                }
                key="6"
              >
                <div className="p-6">
                  {(student.internshipApplications || []).length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {(student.internshipApplications || [])
                        .sort(
                          (a, b) =>
                            new Date(b.appliedDate) - new Date(a.appliedDate)
                        )
                        .map((application, index) => {
                          const isSelfIdentified =
                            !application.internshipId ||
                            !application.internship;

                          return (
                            <div
                              key={application.id || index}
                              className={`
                                border-l-4 rounded-xl p-4 transition-shadow hover:shadow-md
                                ${
                                  isSelfIdentified
                                    ? "border-secondary bg-secondary-50"
                                    : application.status === "SELECTED" ||
                                      application.status === "JOINED"
                                    ? "border-success-200 bg-success-50"
                                    : application.status === "COMPLETED"
                                    ? "border-secondary-200 bg-secondary-50"
                                    : application.status === "UNDER_REVIEW"
                                    ? "border-warning-200 bg-warning-50"
                                    : application.status === "APPLIED"
                                    ? "border-primary-200 bg-primary-50"
                                    : "border-error-200 bg-error-50"
                                }
                              `}
                            >
                              {/* Self-Identified Badge */}
                              {isSelfIdentified && (
                                <Tag
                                  color="purple"
                                  className="mb-3 rounded-md"
                                  icon={<BankOutlined />}
                                >
                                  Self-Identified Internship
                                </Tag>
                              )}

                              {/* Header */}
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                  <div className="text-xs text-text-secondary mb-1">
                                    {isSelfIdentified
                                      ? "Self-Identified Position"
                                      : application.internship?.title ||
                                        "Internship Position"}
                                  </div>
                                  <div className="font-semibold text-base text-text-primary">
                                    {isSelfIdentified
                                      ? application.companyName ||
                                        "Company Name Not Provided"
                                      : application.internship?.industry
                                          ?.companyName || "Unknown Company"}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1 items-end">
                                  <Tag
                                    color={getInternshipStatusColor(
                                      application.status
                                    )}
                                    className="!m-0 rounded-full"
                                  >
                                    {application.status?.replace("_", " ") ||
                                      "UNKNOWN"}
                                  </Tag>
                                  {application.isApproved && (
                                    <Tag color="green" className="!m-0 rounded-full">
                                      Approved
                                    </Tag>
                                  )}
                                </div>
                              </div>

                              {/* Details */}
                              <div className="space-y-2 text-sm">
                                {!isSelfIdentified && (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <BankOutlined className="text-text-tertiary flex-shrink-0" />
                                      <Text className="text-text-secondary text-xs">Field:</Text>
                                      <Text className="text-text-primary font-medium">
                                        {application.internship?.fieldOfWork || "N/A"}
                                      </Text>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <ClockCircleOutlined className="text-text-tertiary flex-shrink-0" />
                                      <Text className="text-text-secondary text-xs">Duration:</Text>
                                      <Text className="text-text-primary font-medium">
                                        {application.internship?.duration || "N/A"}
                                      </Text>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <EnvironmentOutlined className="text-text-tertiary flex-shrink-0" />
                                      <Text className="text-text-secondary text-xs">Location:</Text>
                                      <Text className="text-text-primary font-medium text-xs">
                                        {application.internship?.workLocation?.replace("_", " ") || "N/A"}
                                      </Text>
                                    </div>
                                  </>
                                )}

                                {isSelfIdentified && (
                                  <div className="bg-background-tertiary/50 border border-border p-3 rounded-lg">
                                    <div className="flex items-center gap-2 text-text-primary mb-1">
                                      <InfoCircleOutlined className="text-primary" />
                                      <span className="font-medium text-xs uppercase tracking-wide">
                                        Self-Identified
                                      </span>
                                    </div>
                                    <div className="text-xs text-text-secondary">
                                      Internship was self-identified by student.
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-center gap-2">
                                  <CalendarOutlined className="text-text-tertiary flex-shrink-0" />
                                  <Text className="text-text-secondary text-xs">Applied:</Text>
                                  <Text className="text-text-primary font-medium">
                                    {formatDate(application.appliedDate)}
                                  </Text>
                                </div>
                              </div>

                              {/* Progress indicator */}
                              {(application.status === "JOINED" ||
                                application.status === "COMPLETED") &&
                                application.internship?.startDate &&
                                application.internship?.endDate && (
                                  <div className="mt-4 pt-3 border-t border-border">
                                    <div className="flex justify-between text-[10px] uppercase text-text-secondary mb-1">
                                      <span>Progress</span>
                                      <span>
                                        {getInternshipProgress(
                                          application.internship.startDate,
                                          application.internship.endDate
                                        )}
                                        %
                                      </span>
                                    </div>
                                    <Progress
                                      percent={getInternshipProgress(
                                        application.internship.startDate,
                                        application.internship.endDate
                                      )}
                                      size="small"
                                      status={
                                        application.status === "COMPLETED"
                                          ? "success"
                                          : "active"
                                      }
                                      showInfo={false}
                                    />
                                  </div>
                                )}
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <Empty
                      description="No internship applications yet"
                      className="py-10"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  )}
                </div>
              </TabPane>
            </Tabs>
          </Card>
        </div>
      </div>
      {/* Modals remain mostly the same */}
      <Modal
        title="Edit Student Details"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={imageUploading}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleEditSubmit}>
          <Row gutter={16}>
            {/* Profile Image Upload */}
            <Col span={24}>
              <Form.Item label="Profile Image">
                <div className="flex items-center gap-4">
                  <Avatar
                    size={80}
                    src={getImageUrl(student?.profileImage)}
                    icon={<UserOutlined />}
                  />
                  <ImgCrop
                    rotationSlider
                    aspect={1}
                    quality={0.8}
                    modalTitle="Crop Profile Image"
                    modalOk="Crop"
                    modalCancel="Cancel"
                  >
                    <Upload
                      listType="picture-card"
                      fileList={profileImageList}
                      onChange={({ fileList: newFileList }) => {
                        setProfileImageList(newFileList);
                      }}
                      beforeUpload={(file) => {
                        const isJpgOrPng =
                          file.type === "image/jpeg" || file.type === "image/jpg" || file.type === "image/png";
                        if (!isJpgOrPng) {
                          toast.error("You can only upload JPG/JPEG/PNG files!");
                          return Upload.LIST_IGNORE;
                        }
                        const isLt2M = file.size / 1024 / 1024 < 2;
                        if (!isLt2M) {
                          toast.error("Image must be smaller than 2MB!");
                          return Upload.LIST_IGNORE;
                        }
                        return false;
                      }}
                      maxCount={1}
                      className="avatar-uploader"
                    >
                      {profileImageList.length < 1 && (
                        <div>
                          <CameraOutlined />
                          <div style={{ marginTop: 8 }}>Upload</div>
                        </div>
                      )}
                    </Upload>
                  </ImgCrop>
                </div>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                <Input prefix={<UserOutlined className="text-gray-400" />} />
              </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item
                  name="email"
                  label="Email"
                  rules={[{ required: true, type: "email" }]}
                >
                  <Input prefix={<MailOutlined className="text-gray-400" />} />
                </Form.Item>
              </Col>

            <Col span={12}>
              <Form.Item
                name="contact"
                label="Contact"
                rules={[{ required: true }]}
              >
                <Input prefix={<PhoneOutlined className="text-gray-400" />} />
              </Form.Item>
            </Col>
            {/* <Col span={12}>
                <Form.Item
                  name="rollNumber"
                  label="Roll Number"
                  rules={[{ required: true }]}
                >
                  <Input
                    prefix={<IdcardOutlined className="text-gray-400" />}
                  />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  name="admissionNumber"
                  label="Admission Number"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="admissionType"
                  label="Admission Type"
                  rules={[{ required: true }]}
                >
                  <Select placeholder="Select Type">
                    <Select.Option value="REGULAR">Regular</Select.Option>
                    <Select.Option value="LEET">LEET</Select.Option>
                  </Select>
                </Form.Item>
              </Col>*/}

              <Col span={12}>
                <Form.Item
                  name="category"
                  label="Category"
                  rules={[{ required: true }]}
                >
                  <Select placeholder="Select Category">
                    <Select.Option value="GENERAL">General</Select.Option>
                    <Select.Option value="SC">SC</Select.Option>
                    <Select.Option value="ST">ST</Select.Option>
                    <Select.Option value="OBC">OBC</Select.Option>
                  </Select>
                </Form.Item>
              </Col> 

            <Col span={12}>
              <Form.Item
                name="parentName"
                label="Parent Name"
                rules={[{ required: true }]}
              >
                <Input prefix={<TeamOutlined className="text-gray-400" />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="parentContact"
                label="Parent Contact"
                rules={[{ required: true }]}
              >
                <Input prefix={<PhoneOutlined className="text-gray-400" />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="gender"
                label="Gender"
                rules={[{ required: true }]}
              >
                <Select placeholder="Gender">
                  <Option value="Male">Male</Option>
                  <Option value="Female">Female</Option>
                  <Option value="Others">Others</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dob"
                label="Date of Birth"
                rules={[{ required: false }]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="pinCode"
                label="Pin Code"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="address"
                label="Address"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="city"
                label="City/Village"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="state"
                label="State"
                rules={[{ required: true, message: 'Please select state' }]}
              >
                <Select 
                  placeholder="Select State"
                  showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                  onChange={(value) => {
                    setSelectedState(value);
                    setSelectedDistrict("");
                    form.setFieldsValue({ district: undefined, tehsil: undefined }); // Reset district and tehsil when state changes
                  }}
                >
                  {Object.keys(stateDistrictTehsilData).sort().map((state) => (
                    <Select.Option key={state} value={state}>
                      {state}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="district"
                label="District"
                rules={[{ required: true, message: 'Please select district' }]}
              >
                <Select 
                  placeholder={selectedState ? "Select District" : "Select State First"}
                  disabled={!selectedState}
                  showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                  onChange={(value) => {
                    setSelectedDistrict(value);
                    form.setFieldsValue({ tehsil: undefined }); // Reset tehsil when district changes
                  }}
                >
                  {selectedState && Object.keys(stateDistrictTehsilData[selectedState] || {}).sort().map((district) => (
                    <Select.Option key={district} value={district}>
                      {district}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="tehsil"
                label="Tehsil"
                rules={[{ required: true, message: 'Please select tehsil' }]}
              >
                <Select 
                  placeholder={selectedDistrict ? "Select Tehsil" : "Select District First"}
                  disabled={!selectedDistrict}
                  showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {selectedState && selectedDistrict && stateDistrictTehsilData[selectedState]?.[selectedDistrict]?.map((tehsil) => (
                    <Select.Option key={tehsil} value={tehsil}>
                      {tehsil}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="Upload Document"
        open={uploadModal}
        onCancel={() => setUploadModal(false)}
        onOk={() => uploadForm.submit()}
      >
        <Form form={uploadForm} layout="vertical" onFinish={handleUpload}>
          <Form.Item
            name="type"
            label="Document Type"
            rules={[{ required: true }]}
          >
            <Select placeholder="Select type">
              <Option value="MARKSHEET_10TH">10th Marksheet</Option>
              <Option value="MARKSHEET_12TH">12th Marksheet</Option>
              <Option value="CASTE_CERTIFICATE">Caste Certificate</Option>
              <Option value="PHOTO">Photo</Option>
              <Option value="OTHER">Other</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Upload File">
            <Upload
              beforeUpload={(file) => {
                const isUnderLimit = file.size / 1024 <= 200;
                if (!isUnderLimit) {
                  toast.error("File must be less than 200KB.");
                  return Upload.LIST_IGNORE;
                }
                setFileList([file]);
                return false;
              }}
              fileList={fileList}
              onRemove={() => setFileList([])}
              maxCount={1}
              listType="picture"
            >
              <Button
                loading={uploading}
                icon={<UploadOutlined />}
                className="w-full"
              >
                Select File (Max 200KB)
              </Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </Layouts>
  );
}