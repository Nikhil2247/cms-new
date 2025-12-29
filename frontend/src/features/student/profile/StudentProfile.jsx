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
  Button,
  Empty,
  Form,
  Input,
  Select,
  Upload,
  Modal,
  theme,
} from "antd";
import ImgCrop from "antd-img-crop";
import {
  UserOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  CalendarOutlined,
  FileTextOutlined,
  EditOutlined,
  TeamOutlined,
  UploadOutlined,
  BulbOutlined,
  LaptopOutlined,
  BankOutlined,
  SolutionOutlined,
  CheckCircleOutlined,
  StopOutlined,
  CameraOutlined,
} from "@ant-design/icons";
import toast from "react-hot-toast";

const { Title, Text } = Typography;
const { Option } = Select;

export default function StudentProfile() {
  const [id, setId] = useState(null);
  const [student, setStudent] = useState(null);
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
  const { token } = theme.useToken();

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

  // helper to format semester name
  const getSemesterName = (semesterNumber) => {
    if (semesterNumber === "Unknown") return "Unknown Semester";
    return `Semester ${semesterNumber}`;
  };

  const fetchStudent = async () => {
    // Try to get user ID from JWT token first, then fallback to loginResponse
    let userId = null;

    const token = localStorage.getItem("auth_token");
    if (token) {
      try {
        // Decode JWT to get user info
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload?.userId || payload?.id || payload?.sub;
      } catch (e) {
        console.error("Failed to decode token:", e);
      }
    }

    // Fallback to loginResponse if token doesn't have userId
    if (!userId) {
      const loginData = localStorage.getItem("loginResponse");
      if (loginData) {
        try {
          const parsed = JSON.parse(loginData);
          userId = parsed?.user?.id || parsed?.userId || parsed?.id;
        } catch (e) {
          console.error("Failed to parse loginResponse:", e);
        }
      }
    }

    if (!userId) {
      setError("Not logged in. Please log in again.");
      setLoading(false);
      return;
    }

    setId(userId);

    try {
      // Use /student/profile - backend extracts userId from JWT token
      const res = await API.get(`/student/profile`);
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
      <div className="flex justify-center items-center min-h-screen" style={{ backgroundColor: token.colorBgLayout }}>
        <Spin size="large" tip="Loading profile..." />
      </div>
    );
  if (error)
    return (
      <div className="p-8 text-center" style={{ backgroundColor: token.colorBgLayout }}>
        <Text type="danger">{error}</Text>
      </div>
    );

  return (
    <div className="p-4 md:p-8 min-h-screen overflow-y-auto hide-scrollbar" style={{ backgroundColor: token.colorBgLayout }}>
      <div className="max-w-7xl mx-auto space-y-6 pb-10">
        {/* Action Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
          <div>
            <Title level={2} className="!mb-0 !text-2xl lg:!text-3xl font-bold tracking-tight" style={{ color: token.colorText }}>My Profile</Title>
            <Text className="text-sm" style={{ color: token.colorTextSecondary }}>View and manage your personal and academic information</Text>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button 
              icon={<EditOutlined />} 
              onClick={openEditModal} 
              className="rounded-xl h-10 px-6 font-semibold flex-1 sm:flex-none"
              style={{ borderColor: token.colorBorder, color: token.colorText }}
            >
              Edit Profile
            </Button>
            <Button
              type="primary"
              onClick={openUploadModal}
              icon={<UploadOutlined />}
              className="rounded-xl h-10 px-6 font-semibold flex-1 sm:flex-none shadow-lg"
              style={{ backgroundColor: token.colorPrimary, boxShadow: `0 10px 15px -3px ${token.colorPrimary}40` }}
            >
              Add Document
            </Button>
          </div>
        </div>

        {/* Profile Header Card */}
        <Card bordered={false} className="rounded-2xl shadow-sm overflow-hidden" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorderSecondary }} styles={{ body: { padding: '32px' } }}>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative group">
              <Avatar
                size={120}
                src={getImageUrl(student.profileImage)}
                icon={<UserOutlined />}
                className="rounded-3xl border-4 shadow-lg group-hover:scale-105 transition-transform duration-300"
                style={{ borderColor: token.colorBgContainer }}
              />
              <div 
                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg flex items-center justify-center border-2 shadow-sm"
                style={{ backgroundColor: student.isActive ? token.colorSuccess : token.colorError, borderColor: token.colorBgContainer }}
              >
                {student.isActive ? <CheckCircleOutlined style={{ color: '#fff', fontSize: '14px' }} /> : <StopOutlined style={{ color: '#fff', fontSize: '14px' }} />}
              </div>
            </div>
            
            <div className="flex-grow text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                <Title level={2} className="!mb-0 text-3xl font-bold tracking-tight" style={{ color: token.colorText }}>
                  {student.name}
                </Title>
                <Tag 
                  className="rounded-full px-3 py-1 font-bold uppercase tracking-wide text-[10px]"
                  style={{ backgroundColor: token.colorPrimaryBg, color: token.colorPrimary, borderColor: token.colorPrimaryBorder }}
                >
                  {student.branchName}
                </Tag>
              </div>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2 text-sm mb-6" style={{ color: token.colorTextSecondary }}>
                <span className="flex items-center gap-2 font-medium">
                  <IdcardOutlined style={{ color: token.colorTextTertiary }} /> {student.rollNumber}
                </span>
                <span className="hidden md:inline w-1 h-1 rounded-full bg-gray-300" />
                <span className="flex items-center gap-2 font-medium">
                  <BankOutlined style={{ color: token.colorTextTertiary }} /> Batch of {student.batch?.name || 'N/A'}
                </span>
              </div>

              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                <Tag color={getCategoryColor(student.category)} className="rounded-lg border-0 px-3 py-1 font-bold text-[10px] uppercase tracking-wider m-0">
                  {student.category}
                </Tag>
                <Tag className="rounded-lg border-0 px-3 py-1 font-bold text-[10px] uppercase tracking-wider m-0" style={{ backgroundColor: token.colorFillQuaternary, color: token.colorTextSecondary }}>
                  {student.admissionType}
                </Tag>
                {student.clearanceStatus && (
                  <Tag 
                    className="rounded-lg border-0 px-3 py-1 font-bold text-[10px] uppercase tracking-wider m-0"
                    color={student.clearanceStatus === "CLEARED" ? "success" : "warning"}
                  >
                    {student.clearanceStatus}
                  </Tag>
                )}
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-10 pl-10 border-l" style={{ borderColor: token.colorBorderSecondary }}>
              <div className="text-center">
                <div className="text-3xl font-bold" style={{ color: token.colorText }}>{stats?.passPercentage || 0}%</div>
                <div className="text-[10px] uppercase font-bold tracking-widest mt-1" style={{ color: token.colorTextTertiary }}>Pass Rate</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold" style={{ color: token.colorSuccess }}>{stats?.feePercentage || 0}%</div>
                <div className="text-[10px] uppercase font-bold tracking-widest mt-1" style={{ color: token.colorTextTertiary }}>Fees Paid</div>
              </div>
            </div>
          </div>

          {/* Quick Contact Info Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-8 border-t" style={{ borderColor: token.colorBorderSecondary }}>
            <div className="flex items-center gap-4 p-4 rounded-2xl transition-colors border border-transparent group" style={{ backgroundColor: token.colorFillQuaternary }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-colors" style={{ backgroundColor: token.colorBgContainer, color: token.colorPrimary }}>
                <MailOutlined className="text-xl" />
              </div>
              <div className="min-w-0">
                <Text className="text-[10px] uppercase font-bold tracking-wider block mb-0.5" style={{ color: token.colorTextTertiary }}>Email Address</Text>
                <Text ellipsis className="text-sm font-semibold block" style={{ color: token.colorText }}>{student.email}</Text>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl transition-colors border border-transparent group" style={{ backgroundColor: token.colorFillQuaternary }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-colors" style={{ backgroundColor: token.colorBgContainer, color: token.colorSuccess }}>
                <PhoneOutlined className="text-xl" />
              </div>
              <div className="min-w-0">
                <Text className="text-[10px] uppercase font-bold tracking-wider block mb-0.5" style={{ color: token.colorTextTertiary }}>Phone Number</Text>
                <Text ellipsis className="text-sm font-semibold block" style={{ color: token.colorText }}>{student.contact || "N/A"}</Text>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl transition-colors border border-transparent group" style={{ backgroundColor: token.colorFillQuaternary }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-colors" style={{ backgroundColor: token.colorBgContainer, color: '#a855f7' }}>
                <CalendarOutlined className="text-xl" />
              </div>
              <div className="min-w-0">
                <Text className="text-[10px] uppercase font-bold tracking-wider block mb-0.5" style={{ color: token.colorTextTertiary }}>Date of Birth</Text>
                <Text ellipsis className="text-sm font-semibold block" style={{ color: token.colorText }}>{student.dob?.slice(0, 10) || "N/A"}</Text>
              </div>
            </div>
          </div>
        </Card>

        {/* Detailed Tabs Container */}
        <Card bordered={false} className="rounded-2xl border shadow-sm overflow-hidden" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorderSecondary }} styles={{ body: { padding: 0 } }}>
          <Tabs 
            defaultActiveKey="1" 
            className="custom-tabs"
            items={[
              {
                key: "1",
                label: (
                  <span className="flex items-center px-4 py-3 font-bold text-xs uppercase tracking-widest">
                    <UserOutlined className="mr-2" /> Personal Details
                  </span>
                ),
                children: (
                  <div className="p-8">
                    <Row gutter={[48, 32]}>
                      <Col xs={24} lg={12}>
                        <div className="space-y-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-1 h-6 rounded-full" style={{ backgroundColor: token.colorPrimary }} />
                            <Title level={4} className="!mb-0 font-bold" style={{ color: token.colorText }}>Academic Profile</Title>
                          </div>
                          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: token.colorFillQuaternary, borderColor: token.colorBorderSecondary }}>
                            <div className="p-4 flex justify-between items-center border-b" style={{ borderColor: token.colorBorderSecondary }}>
                              <Text className="font-medium" style={{ color: token.colorTextSecondary }}>Roll Number</Text>
                              <Text className="font-bold" style={{ color: token.colorText }}>{student.rollNumber}</Text>
                            </div>
                            <div className="p-4 flex justify-between items-center border-b" style={{ borderColor: token.colorBorderSecondary }}>
                              <Text className="font-medium" style={{ color: token.colorTextSecondary }}>Branch</Text>
                              <Tag className="m-0 px-3 py-1 rounded-full border-0 font-bold text-[10px] uppercase tracking-wide" style={{ backgroundColor: token.colorPrimaryBg, color: token.colorPrimary }}>
                                {student.branchName}
                              </Tag>
                            </div>
                            <div className="p-4 flex justify-between items-center border-b" style={{ borderColor: token.colorBorderSecondary }}>
                              <Text className="font-medium" style={{ color: token.colorTextSecondary }}>Batch</Text>
                              <Text className="font-bold" style={{ color: token.colorText }}>{student.batch?.name || "N/A"}</Text>
                            </div>
                            <div className="p-4 flex justify-between items-center">
                              <Text className="font-medium" style={{ color: token.colorTextSecondary }}>Admission Type</Text>
                              <Tag className="m-0 px-3 py-1 rounded-full border-0 font-bold text-[10px] uppercase tracking-wide" style={{ backgroundColor: token.colorBgContainerDisabled, color: token.colorTextSecondary }}>
                                {student.admissionType}
                              </Tag>
                            </div>
                          </div>
                        </div>
                      </Col>

                      <Col xs={24} lg={12}>
                        <div className="space-y-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-1 h-6 rounded-full" style={{ backgroundColor: token.colorSuccess }} />
                            <Title level={4} className="!mb-0 font-bold" style={{ color: token.colorText }}>Contact & Address</Title>
                          </div>
                          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: token.colorFillQuaternary, borderColor: token.colorBorderSecondary }}>
                            <div className="p-4 flex justify-between items-start border-b" style={{ borderColor: token.colorBorderSecondary }}>
                              <Text className="font-medium shrink-0 mr-4" style={{ color: token.colorTextSecondary }}>Home Address</Text>
                              <Text className="font-bold text-right max-w-[60%]" style={{ color: token.colorText }}>{student.address || "N/A"}, {student.city}, {student.district}, {student.state} - {student.pinCode}</Text>
                            </div>
                            <div className="p-4 flex justify-between items-center border-b" style={{ borderColor: token.colorBorderSecondary }}>
                              <Text className="font-medium" style={{ color: token.colorTextSecondary }}>Parent/Guardian</Text>
                              <Text className="font-bold" style={{ color: token.colorText }}>{student.parentName || "N/A"}</Text>
                            </div>
                            <div className="p-4 flex justify-between items-center">
                              <Text className="font-medium" style={{ color: token.colorTextSecondary }}>Parent Contact</Text>
                              <Text className="font-bold" style={{ color: token.colorText }}>{student.parentContact || "N/A"}</Text>
                            </div>
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </div>
                ),
              },
              {
                key: "4",
                label: (
                  <span className="flex items-center px-4 py-3 font-bold text-xs uppercase tracking-widest">
                    <FileTextOutlined className="mr-2" /> Academic Records
                  </span>
                ),
                children: (
                  <div className="p-8">
                    {student.document?.length > 0 ? (
                      <Row gutter={[20, 20]}>
                        {student.document.map((doc, idx) => (
                          <Col xs={24} sm={12} md={8} lg={6} key={idx}>
                            <Card
                              hoverable
                              bordered={false}
                              className="rounded-2xl border shadow-sm overflow-hidden group hover:shadow-md transition-all duration-300"
                              style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorderSecondary }}
                              styles={{ body: { padding: '16px' } }}
                              onClick={() => window.open(getImageUrl(doc.fileUrl), "_blank")}
                            >
                              <div className="h-48 rounded-xl flex items-center justify-center p-4 mb-4 border overflow-hidden transition-colors" style={{ backgroundColor: token.colorFillQuaternary, borderColor: token.colorBorderSecondary }}>
                                <img
                                  src={getImageUrl(doc.fileUrl)}
                                  alt={doc.fileName}
                                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500"
                                />
                              </div>
                              <div className="px-1">
                                <Text className="text-xs uppercase font-bold tracking-wider block truncate mb-1" style={{ color: token.colorText }}>
                                  {doc.type.replaceAll("_", " ")}
                                </Text>
                                <Text className="text-[10px] truncate block font-medium" style={{ color: token.colorTextTertiary }}>
                                  {doc.fileName}
                                </Text>
                              </div>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    ) : (
                      <div className="py-20 text-center rounded-2xl border border-dashed flex flex-col items-center justify-center" style={{ backgroundColor: token.colorFillQuaternary, borderColor: token.colorBorderSecondary }}>
                        <Empty description={false} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        <Title level={5} className="mt-4 !font-normal" style={{ color: token.colorTextSecondary }}>No documents found</Title>
                        <Button type="primary" onClick={openUploadModal} className="mt-6 rounded-xl font-bold px-8 h-10 shadow-lg" style={{ backgroundColor: token.colorPrimary, boxShadow: `0 10px 15px -3px ${token.colorPrimary}40` }}>
                          Upload Document
                        </Button>
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "5",
                label: (
                  <span className="flex items-center px-4 py-3 font-bold text-xs uppercase tracking-widest">
                    <BulbOutlined className="mr-2" /> Placements
                  </span>
                ),
                children: (
                  <div className="p-8">
                    {(student.placements || []).length > 0 ? (
                      <Row gutter={[20, 20]}>
                        {(student.placements || []).map((p, i) => (
                          <Col xs={24} md={12} lg={8} key={i}>
                            <div className="p-6 rounded-2xl border hover:shadow-md transition-all duration-300" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorderSecondary }}>
                              <div className="flex justify-between items-start mb-4">
                                <Title level={5} className="!mb-0 text-lg font-bold leading-tight flex-1 mr-2" style={{ color: token.colorText }}>{p.companyName}</Title>
                                <Tag color={getPlacementStatusColor(p.status)} className="m-0 px-2 py-1 rounded-md border-0 font-bold uppercase tracking-wider text-[10px]">
                                  {p.status}
                                </Tag>
                              </div>
                              <div className="p-4 rounded-xl border mb-4" style={{ backgroundColor: token.colorSuccessBg, borderColor: token.colorSuccessBorder }}>
                                <Text className="text-[10px] uppercase font-bold tracking-widest block mb-1" style={{ color: token.colorSuccess }}>Annual CTC</Text>
                                <Text className="text-2xl font-black leading-none" style={{ color: token.colorSuccessText }}>
                                  ₹ {p.salary?.toFixed(2)} <span className="text-xs font-bold">LPA</span>
                                </Text>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <SolutionOutlined className="text-sm" style={{ color: token.colorTextTertiary }} />
                                  <Text className="text-sm font-semibold truncate" style={{ color: token.colorTextSecondary }}>{p.jobRole}</Text>
                                </div>
                                <div className="flex items-center gap-2">
                                  <CalendarOutlined className="text-sm" style={{ color: token.colorTextTertiary }} />
                                  <Text className="text-sm font-semibold" style={{ color: token.colorTextSecondary }}>{formatDate(p.offerDate)}</Text>
                                </div>
                              </div>
                            </div>
                          </Col>
                        ))}
                      </Row>
                    ) : (
                      <div className="py-20 text-center rounded-2xl border border-dashed flex flex-col items-center justify-center" style={{ backgroundColor: token.colorFillQuaternary, borderColor: token.colorBorderSecondary }}>
                        <Empty description={<span className="font-medium" style={{ color: token.colorTextSecondary }}>No placement offers found yet</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "6",
                label: (
                  <span className="flex items-center px-4 py-3 font-bold text-xs uppercase tracking-widest">
                    <LaptopOutlined className="mr-2" /> Career Track
                  </span>
                ),
                children: (
                  <div className="p-8 space-y-10">
                    <section>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-1 h-6 rounded-full" style={{ backgroundColor: '#6366f1' }} />
                        <Title level={4} className="!mb-0 font-bold" style={{ color: token.colorText }}>Internship History</Title>
                      </div>
                      
                      {(student.internshipApplications || []).length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {(student.internshipApplications || [])
                            .sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate))
                            .map((app, i) => {
                              const isSelf = !app.internshipId || !app.internship;
                              return (
                                <div key={i} className="p-6 rounded-2xl border hover:shadow-md transition-all duration-300" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorderSecondary }}>
                                  <div className="flex justify-between items-start mb-4">
                                    <div>
                                      {isSelf && (
                                        <Tag className="m-0 mb-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: '#f3e8ff', color: '#9333ea', borderColor: '#e9d5ff' }}>
                                          Self-Identified
                                        </Tag>
                                      )}
                                      <Title level={5} className="!mb-1 text-lg font-bold" style={{ color: token.colorText }}>
                                        {isSelf ? app.companyName : app.internship?.title}
                                      </Title>
                                      <Text className="font-bold text-xs uppercase tracking-wide block" style={{ color: '#6366f1' }}>
                                        {!isSelf ? app.internship?.industry?.companyName : 'External Position'}
                                      </Text>
                                    </div>
                                    <Tag color={getInternshipStatusColor(app.status)} className="m-0 px-2 py-1 rounded-full border-0 font-bold uppercase tracking-widest text-[10px]">
                                      {app.status}
                                    </Tag>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4 py-4 border-y mb-4" style={{ borderColor: token.colorBorderSecondary }}>
                                    <div>
                                      <Text className="text-[10px] uppercase font-bold block leading-none mb-1.5" style={{ color: token.colorTextTertiary }}>Duration</Text>
                                      <Text className="font-bold text-sm" style={{ color: token.colorText }}>{app.internship?.duration || app.internshipDuration || 'N/A'}</Text>
                                    </div>
                                    <div>
                                      <Text className="text-[10px] uppercase font-bold block leading-none mb-1.5" style={{ color: token.colorTextTertiary }}>Applied On</Text>
                                      <Text className="font-bold text-sm" style={{ color: token.colorText }}>{formatDate(app.appliedDate)}</Text>
                                    </div>
                                  </div>
                                  
                                  {(app.status === "JOINED" || app.status === "COMPLETED") && (
                                    <div>
                                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: token.colorTextTertiary }}>
                                        <span>Course Progress</span>
                                        <span>{getInternshipProgress(app.internship?.startDate, app.internship?.endDate)}%</span>
                                      </div>
                                      <Progress
                                        percent={getInternshipProgress(app.internship?.startDate, app.internship?.endDate)}
                                        size="small"
                                        showInfo={false}
                                        strokeColor="#4f46e5"
                                        trailColor={token.colorFillQuaternary}
                                        className="!m-0"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="py-20 text-center rounded-2xl border border-dashed flex flex-col items-center justify-center" style={{ backgroundColor: token.colorFillQuaternary, borderColor: token.colorBorderSecondary }}>
                          <Empty description={<span className="font-medium" style={{ color: token.colorTextSecondary }}>No internship history recorded</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        </div>
                      )}
                    </section>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>

      {/* Modals */}
      <Modal
        title={<span className="text-xl font-bold" style={{ color: token.colorText }}>Edit Student Details</span>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={imageUploading}
        onOk={() => form.submit()}
        width={700}
        className="rounded-2xl overflow-hidden"
        styles={{ content: { borderRadius: '24px', padding: '24px' } }}
        footer={[
          <Button key="back" onClick={() => setIsModalOpen(false)} className="rounded-xl h-10 font-medium">
            Cancel
          </Button>,
          <Button key="submit" type="primary" loading={imageUploading} onClick={() => form.submit()} className="rounded-xl h-10 font-bold px-6 shadow-lg" style={{ backgroundColor: token.colorPrimary, boxShadow: `0 10px 15px -3px ${token.colorPrimary}40` }}>
            Save Changes
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" onFinish={handleEditSubmit} className="mt-6">
          <Row gutter={24}>
            {/* Profile Image Upload */}
            <Col span={24}>
              <Form.Item label={<span className="font-medium" style={{ color: token.colorTextSecondary }}>Profile Image</span>}>
                <div className="flex items-center gap-6 p-4 rounded-2xl border" style={{ backgroundColor: token.colorFillQuaternary, borderColor: token.colorBorderSecondary }}>
                  <Avatar
                    size={80}
                    src={getImageUrl(student?.profileImage)}
                    icon={<UserOutlined />}
                    className="border-2 shadow-md"
                    style={{ borderColor: token.colorBgContainer }}
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
                        <div className="flex flex-col items-center justify-center" style={{ color: token.colorTextTertiary }}>
                          <CameraOutlined className="text-xl mb-1" />
                          <div className="text-xs font-medium">Upload</div>
                        </div>
                      )}
                    </Upload>
                  </ImgCrop>
                </div>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item name="name" label={<span className="font-medium" style={{ color: token.colorTextSecondary }}>Name</span>} rules={[{ required: true }]}>
                <Input prefix={<UserOutlined style={{ color: token.colorTextTertiary }} />} className="rounded-lg h-11" />
              </Form.Item>
            </Col>
            <Col span={12}>
                <Form.Item
                  name="email"
                  label={<span className="font-medium" style={{ color: token.colorTextSecondary }}>Email</span>}
                  rules={[{ required: true, type: "email" }]}
                >
                  <Input prefix={<MailOutlined style={{ color: token.colorTextTertiary }} />} className="rounded-lg h-11" />
                </Form.Item>
              </Col>

            <Col span={12}>
              <Form.Item
                name="contact"
                label={<span className="font-medium" style={{ color: token.colorTextSecondary }}>Contact</span>}
                rules={[{ required: true }]}
              >
                <Input prefix={<PhoneOutlined style={{ color: token.colorTextTertiary }} />} className="rounded-lg h-11" />
              </Form.Item>
            </Col>

              <Col span={12}>
                <Form.Item
                  name="category"
                  label={<span className="font-medium" style={{ color: token.colorTextSecondary }}>Category</span>}
                  rules={[{ required: true }]}
                >
                  <Select placeholder="Select Category" className="h-11 rounded-lg">
                    <Option value="GENERAL">General</Option>
                    <Option value="SC">SC</Option>
                    <Option value="ST">ST</Option>
                    <Option value="OBC">OBC</Option>
                  </Select>
                </Form.Item>
              </Col> 

            <Col span={12}>
              <Form.Item
                name="parentName"
                label={<span className="font-medium" style={{ color: token.colorTextSecondary }}>Parent Name</span>}
                rules={[{ required: true }]}
              >
                <Input prefix={<TeamOutlined style={{ color: token.colorTextTertiary }} />} className="rounded-lg h-11" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="parentContact"
                label={<span className="font-medium" style={{ color: token.colorTextSecondary }}>Parent Contact</span>}
                rules={[{ required: true }]}
              >
                <Input prefix={<PhoneOutlined style={{ color: token.colorTextTertiary }} />} className="rounded-lg h-11" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="gender"
                label={<span className="font-medium" style={{ color: token.colorTextSecondary }}>Gender</span>}
                rules={[{ required: true }]}
              >
                <Select placeholder="Gender" className="h-11 rounded-lg">
                  <Option value="Male">Male</Option>
                  <Option value="Female">Female</Option>
                  <Option value="Others">Others</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dob"
                label={<span className="font-medium" style={{ color: token.colorTextSecondary }}>Date of Birth</span>}
                rules={[{ required: false }]}
              >
                <Input type="date" className="rounded-lg h-11" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="pinCode"
                label={<span className="font-medium" style={{ color: token.colorTextSecondary }}>Pin Code</span>}
                rules={[{ required: true }]}
              >
                <Input className="rounded-lg h-11" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="address"
                label={<span className="font-medium" style={{ color: token.colorTextSecondary }}>Address</span>}
                rules={[{ required: true }]}
              >
                <Input className="rounded-lg h-11" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="city"
                label={<span className="font-medium" style={{ color: token.colorTextSecondary }}>City/Village</span>}
                rules={[{ required: true }]}
              >
                <Input className="rounded-lg h-11" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="state"
                label={<span className="font-medium" style={{ color: token.colorTextSecondary }}>State</span>}
                rules={[{ required: true, message: 'Please select state' }]}
              >
                <Select 
                  placeholder="Select State"
                  showSearch
                  className="h-11 rounded-lg"
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
                    <Option key={state} value={state}>
                      {state}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="district"
                label={<span className="font-medium" style={{ color: token.colorTextSecondary }}>District</span>}
                rules={[{ required: true, message: 'Please select district' }]}
              >
                <Select 
                  placeholder={selectedState ? "Select District" : "Select State First"}
                  disabled={!selectedState}
                  showSearch
                  className="h-11 rounded-lg"
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                  onChange={(value) => {
                    setSelectedDistrict(value);
                    form.setFieldsValue({ tehsil: undefined }); // Reset tehsil when district changes
                  }}
                >
                  {selectedState && Object.keys(stateDistrictTehsilData[selectedState] || {}).sort().map((district) => (
                    <Option key={district} value={district}>
                      {district}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="tehsil"
                label={<span className="font-medium" style={{ color: token.colorTextSecondary }}>Tehsil</span>}
                rules={[{ required: true, message: 'Please select tehsil' }]}
              >
                <Select 
                  placeholder={selectedDistrict ? "Select Tehsil" : "Select District First"}
                  disabled={!selectedDistrict}
                  showSearch
                  className="h-11 rounded-lg"
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {selectedState && selectedDistrict && stateDistrictTehsilData[selectedState]?.[selectedDistrict]?.map((tehsil) => (
                    <Option key={tehsil} value={tehsil}>
                      {tehsil}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={<span className="text-xl font-bold" style={{ color: token.colorText }}>Upload Document</span>}
        open={uploadModal}
        onCancel={() => setUploadModal(false)}
        onOk={() => uploadForm.submit()}
        className="rounded-2xl"
        styles={{ content: { borderRadius: '24px', padding: '24px' } }}
        footer={[
          <Button key="back" onClick={() => setUploadModal(false)} className="rounded-xl h-10 font-medium">
            Cancel
          </Button>,
          <Button key="submit" type="primary" loading={uploading} onClick={() => uploadForm.submit()} className="rounded-xl h-10 font-bold px-6 shadow-lg" style={{ backgroundColor: token.colorPrimary, boxShadow: `0 10px 15px -3px ${token.colorPrimary}40` }}>
            Upload
          </Button>,
        ]}
      >
        <Form form={uploadForm} layout="vertical" onFinish={handleUpload} className="mt-6">
          <Form.Item
            name="type"
            label={<span className="font-medium" style={{ color: token.colorTextSecondary }}>Document Type</span>}
            rules={[{ required: true }]}
          >
            <Select placeholder="Select type" className="h-11 rounded-lg">
              <Option value="MARKSHEET_10TH">10th Marksheet</Option>
              <Option value="MARKSHEET_12TH">12th Marksheet</Option>
              <Option value="CASTE_CERTIFICATE">Caste Certificate</Option>
              <Option value="PHOTO">Photo</Option>
              <Option value="OTHER">Other</Option>
            </Select>
          </Form.Item>
          <Form.Item label={<span className="font-medium" style={{ color: token.colorTextSecondary }}>Upload File</span>}>
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
              className="w-full"
            >
              <Button
                loading={uploading}
                icon={<UploadOutlined />}
                className="w-full h-12 rounded-xl border-dashed"
                style={{ borderColor: token.colorBorder }}
              >
                Select File (Max 200KB)
              </Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
