// src/pages/industry/PostInternship.jsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Row,
  Col,
  Typography,
  message,
  DatePicker,
  InputNumber,
  Checkbox,
  Tag,
  Space,
  Alert,
  Spin,
} from "antd";
import {
  SaveOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  FileTextOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  DollarOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

import API from "../../../services/api"; // Assuming you have a file that exports an Axios instance or similar
import Layouts from "../../../components/Layout";
import { toast } from "react-hot-toast";
const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const PostInternship = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const navigate = useNavigate();

  const branches = ["CSE", "IT", "ECE", "EE", "ME", "CE", "CHEM", "AUTO"];
  const branchOptions = branches.map((shortForm) => {
    let fullName = "";
    switch (shortForm) {
      case "CSE":
        fullName = "Computer Science Engineering";
        break;
      case "IT":
        fullName = "Information Technology";
        break;
      case "ECE":
        fullName = "Electronics Communication Engineering";
        break;
      case "EE":
        fullName = "Electrical Engineering";
        break;
      case "ME":
        fullName = "Mechanical Engineering";
        break;
      case "CE":
        fullName = "Civil Engineering";
        break;
      case "CHEM":
        fullName = "Chemical Engineering";
        break;
      case "AUTO":
        fullName = "Automobile Engineering";
        break;
      default:
        fullName = shortForm;
    }
    return {
      value: shortForm,
      label: fullName,
    };
  });

  const workLocations = [
    { value: "ON_SITE", label: "On-site" },
    { value: "REMOTE", label: "Remote" },
    { value: "HYBRID", label: "Hybrid" },
  ];

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await API.get("/industries/profile");

      if (response) {
        setProfile(response.data);
        if (!response.data.isApproved) {
          toast.error(
            "Your profile is not approved yet. You cannot post internships."
          );
          navigate("/industry/dashboard");
        }
      } else {
        toast.error("Please complete your profile first");
        navigate("/industry/create");
      }
    } catch (error) {
      toast.error("Please complete your profile first");
      navigate("/industry/create");
    }
  };

  // console.log(profile.id)

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const formattedData = {
        ...values,
        // Assuming the industryId is available in the fetched profile.
        // The API backend should validate this from the authenticated user.
        // We'll pass it in the payload for clarity, but the backend implementation
        // in the prompt suggests it will get it from the request object (req.user.industryId).
        // This is a good practice for security, but we include it here to match the schema.
        industryId: profile?.id,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
        applicationDeadline: values.applicationDeadline?.toISOString(),
        requiredSkills: values.requiredSkills || [],
        preferredSkills: values.preferredSkills || [],
        eligibleBranches: values.eligibleBranches || [],
        eligibleSemesters:
          values.eligibleSemesters?.map((sem) => sem.toString()) || [],
        stipendAmount: values.isStipendProvided ? values.stipendAmount : null,
      };

      // Call the API endpoint to create the internship
      const response = await API.post("/internships", formattedData);

      if (response.data) {
        toast.success("Internship posted successfully!");
        navigate("/industry/internships?tab=manage");
      } else {
        toast.error(response.data.message || "Error posting internship");
      }
    } catch (error) {
      console.error("API call error:", error);
      toast.error(
        error.response?.data?.message ||
          "An unexpected error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!profile?.isApproved) {
    return (
      // <div
      //   style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px" }}
      // >
      //   <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      //     <Alert
      //       title="Profile Not Approved"
      //       description="Your company profile needs to be approved before you can post internships. Please wait for approval or contact the institution."
      //       type="warning"
      //       showIcon
      //       action={
      //         <Button
      //           size="small"
      //           onClick={() => navigate("/industry/dashboard")}
      //         >
      //           Go to Dashboard
      //         </Button>
      //       }
      //     />
      //   </div>

      // </div>
      <Layouts>
        <div className="flex justify-center items-center min-h-screen">
          <Spin size="small" />
          {/* <Text className="ml-4 text-gray-600">Loading dashboard...</Text> */}
        </div>
      </Layouts>
    );
  }

  return (
    <Layouts>
      <div className="min-h-screen ">
        <div className="max-w-5xl mx-auto">
                    {/* Enhanced Header */}
                    <Card className="mb-5 border-border shadow-sm rounded-2xl overflow-hidden">
                      <div className="relative">
                        {/* Gradient header with animations */}
                        <div className="bg-gradient-to-r from-primary-600 via-secondary-600 to-primary-700 -mx-6 -mt-6 px-8 py-6 mb-6">
                          <div className="relative z-10 text-center">
                            <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 rounded-2xl mb-4 backdrop-blur-sm border border-white/30 shadow-lg">
                              <PlusOutlined className="text-white text-3xl" />
                            </div>
                            <Title level={1} className="text-white mb-2">
                              Post Internship Opportunity
                            </Title>
                            <Text className="text-white/80 text-base">
                              Connect with talented students and build your future workforce
                            </Text>
                          </div>
                        </div>
                      </div>
                    </Card>
          
                    {/* Enhanced Internship Form */}
                    <Card className="border-border shadow-sm rounded-2xl">
                      <Form
                        form={form}
                        layout="vertical"
                        onFinish={onFinish}
                        requiredMark={false}
                        className="p-2"
                        initialValues={{
                          isStipendProvided: false,
                          isRemoteAllowed: false,
                          workLocation: "ON_SITE",
                          eligibleSemesters: [5, 6],
                        }}
                      >
                        {/* Basic Information Section */}
                        <div className="mb-10">
                          <div className="flex items-center mb-6 pb-4 border-b border-border">
                            <div className="flex items-center justify-center w-12 h-12 bg-primary rounded-xl mr-4 shadow-sm">
                              <FileTextOutlined className="text-white text-xl" />
                            </div>
                            <div>
                              <Title level={3} className="mb-0 text-text-primary">
                                Basic Information
                              </Title>
                              <Text className="text-text-secondary">
                                Tell us about this internship opportunity
                              </Text>
                            </div>
                          </div>
                          <Row gutter={[16, 16]}>
                            <Col xs={24} md={16}>
                              <Form.Item
                                name="title"
                                label="Internship Title"
                                rules={[
                                  {
                                    required: true,
                                    message: "Please enter internship title",
                                  },
                                  {
                                    min: 5,
                                    message: "Title must be at least 5 characters",
                                  },
                                ]}
                              >
                                <Input
                                  placeholder="e.g., Full Stack Developer Intern"
                                  size="large"
                                  className="rounded-xl border-border"
                                />
                              </Form.Item>
                            </Col>
          
                            <Col xs={24} md={8}>
                              <Form.Item
                                name="fieldOfWork"
                                label="Field of Work"
                                rules={[
                                  {
                                    required: true,
                                    message: "Please enter field of work",
                                  },
                                ]}
                              >
                                <Input
                                  placeholder="e.g., Software Development"
                                  size="large"
                                  className="rounded-xl border-border"
                                />
                              </Form.Item>
                            </Col>
          
                            <Col xs={24}>
                              <Form.Item
                                name="description"
                                label="Short Description"
                                rules={[
                                  { required: true, message: "Please enter description" },
                                  {
                                    max: 200,
                                    message: "Description cannot exceed 200 characters",
                                  },
                                ]}
                              >
                                <TextArea
                                  rows={3}
                                  placeholder="Brief description of the internship role..."
                                  className="rounded-xl border-border"
                                  showCount
                                  maxLength={200}
                                />
                              </Form.Item>
                            </Col>
          
                            <Col xs={24}>
                              <Form.Item
                                name="detailedDescription"
                                label="Detailed Description"
                                rules={[
                                  {
                                    max: 1000,
                                    message: "Description cannot exceed 1000 characters",
                                  },
                                ]}
                              >
                                <TextArea
                                  rows={6}
                                  placeholder="Detailed description including responsibilities, learning outcomes, project details..."
                                  className="rounded-xl border-border"
                                  showCount
                                  maxLength={1000}
                                />
                              </Form.Item>
                            </Col>
                          </Row>
                        </div>
          
                        {/* Position & Duration Section */}
                        <div className="mb-10">
                          <div className="flex items-center mb-6 pb-4 border-b border-border">
                            <div className="flex items-center justify-center w-12 h-12 bg-primary rounded-xl mr-4 shadow-sm">
                              <TeamOutlined className="text-white text-xl" />
                            </div>
                            <div>
                              <Title level={3} className="mb-0 text-text-primary">
                                Position & Duration
                              </Title>
                              <Text className="text-text-secondary">
                                Define the role requirements and timeline
                              </Text>
                            </div>
                          </div>
                          <Row gutter={[16, 16]}>
                            <Col xs={24} md={8}>
                              <Form.Item
                                name="numberOfPositions"
                                label="Number of Positions"
                                rules={[
                                  {
                                    required: true,
                                    message: "Please enter number of positions",
                                  },
                                  {
                                    type: "number",
                                    min: 1,
                                    max: 50,
                                    message: "Positions must be between 1 and 50",
                                  },
                                ]}
                              >
                                <InputNumber
                                  placeholder="Enter number of positions"
                                  size="large"
                                  className="w-full rounded-xl border-border"
                                  min={1}
                                  max={50}
                                />
                              </Form.Item>
                            </Col>
          
                            <Col xs={24} md={8}>
                              <Form.Item
                                name="duration"
                                label="Duration"
                                rules={[
                                  { required: true, message: "Please enter duration" },
                                ]}
                              >
                                <Select
                                  placeholder="Select duration"
                                  size="large"
                                  className="rounded-xl border-border"
                                >
                                  <Option value="1 month">1 Month</Option>
                                  <Option value="2 months">2 Months</Option>
                                  <Option value="3 months">3 Months</Option>
                                  <Option value="4 months">4 Months</Option>
                                  <Option value="5 months">5 Months</Option>
                                  <Option value="6 months">6 Months</Option>
                                </Select>
                              </Form.Item>
                            </Col>
          
                            <Col xs={24} md={8}>
                              <Form.Item
                                name="workLocation"
                                label="Work Location"
                                rules={[
                                  {
                                    required: true,
                                    message: "Please select work location",
                                  },
                                ]}
                              >
                                <Select
                                  placeholder="Select work location"
                                  size="large"
                                  className="rounded-xl border-border"
                                >
                                  {workLocations.map((location) => (
                                    <Option key={location.value} value={location.value}>
                                      {location.label}
                                    </Option>
                                  ))}
                                </Select>
                              </Form.Item>
                            </Col>
          
                            <Col xs={24} md={12}>
                              <Form.Item
                                name="startDate"
                                label="Expected Start Date"
                                rules={[
                                  { required: true, message: "Please select start date" },
                                ]}
                              >
                                <DatePicker
                                  placeholder="Select start date"
                                  size="large"
                                  className="w-full rounded-xl border-border"
                                  disabledDate={(current) =>
                                    current && current < new Date()
                                  }
                                />
                              </Form.Item>
                            </Col>
          
                            <Col xs={24} md={12}>
                              <Form.Item
                                name="applicationDeadline"
                                label="Application Deadline"
                                rules={[
                                  {
                                    required: true,
                                    message: "Please select application deadline",
                                  },
                                ]}
                              >
                                <DatePicker
                                  placeholder="Select deadline"
                                  size="large"
                                  className="w-full rounded-xl border-border"
                                  disabledDate={(current) =>
                                    current && current < new Date()
                                  }
                                />
                              </Form.Item>
                            </Col>
                          </Row>
                        </div>
          
                        {/* Eligibility Section */}
                        <div className="mb-10">
                          <div className="flex items-center mb-6 pb-4 border-b border-border">
                            <div className="flex items-center justify-center w-12 h-12 bg-success rounded-xl mr-4 shadow-sm">
                              <SafetyCertificateOutlined className="text-white text-xl" />
                            </div>
                            <div>
                              <Title level={3} className="mb-0 text-text-primary">
                                Eligibility Criteria
                              </Title>
                              <Text className="text-text-secondary">
                                Set requirements for applicants
                              </Text>
                            </div>
                          </div>
                          <Row gutter={[16, 16]}>
                            <Col xs={24} md={12}>
                              <Form.Item
                                name="eligibleBranches"
                                label="Eligible Branches"
                                rules={[
                                  {
                                    required: true,
                                    message: "Please select eligible branches",
                                  },
                                ]}
                              >
                                <Select
                                  mode="multiple"
                                  placeholder="Select eligible branches"
                                  size="large"
                                  className="rounded-xl border-border"
                                  options={branchOptions} // Use the new options array
                                />
                              </Form.Item>
                            </Col>
          
                            <Col xs={24} md={12}>
                              <Form.Item
                                name="eligibleSemesters"
                                label="Eligible Semesters"
                                rules={[
                                  {
                                    required: true,
                                    message: "Please select eligible semesters",
                                  },
                                ]}
                              >
                                <Select
                                  mode="multiple"
                                  placeholder="Select eligible semesters"
                                  size="large"
                                  className="rounded-xl border-border"
                                >
                                  {[1, 2, 3, 4, 5, 6].map((sem) => (
                                    <Option key={sem} value={sem}>
                                      Semester {sem}
                                    </Option>
                                  ))}
                                </Select>
                              </Form.Item>
                            </Col>
          
                            <Col xs={24} md={12}>
                              <Form.Item
                                name="minimumPercentage"
                                label="Minimum Percentage Required"
                                rules={[
                                  {
                                    type: "number",
                                    min: 50,
                                    max: 100,
                                    message: "Percentage must be between 50 and 100",
                                  },
                                ]}
                              >
                                <InputNumber
                                  placeholder="Enter minimum percentage"
                                  size="large"
                                  className="w-full rounded-xl border-border"
                                  min={50}
                                  max={100}
                                  step={0.1}
                                  formatter={(value) => `${value}%`}
                                  parser={(value) => value.replace("%", "")}
                                />
                              </Form.Item>
                            </Col>
                          </Row>
          
                          {/* Skills */}
                          <Title level={4} className="text-text-primary mt-6 mb-4">Skills Requirements</Title>
                          <Row gutter={[16, 16]}>
                            <Col xs={24} md={12}>
                              <Form.Item
                                name="requiredSkills"
                                label="Required Skills"
                                tooltip="Skills that are mandatory for this internship"
                              >
                                <Select
                                  mode="tags"
                                  placeholder="Enter required skills"
                                  size="large"
                                  className="rounded-xl border-border"
                                />
                              </Form.Item>
                            </Col>
          
                            <Col xs={24} md={12}>
                              <Form.Item
                                name="preferredSkills"
                                label="Preferred Skills"
                                tooltip="Skills that are good to have but not mandatory"
                              >
                                <Select
                                  mode="tags"
                                  placeholder="Enter preferred skills"
                                  size="large"
                                  className="rounded-xl border-border"
                                />
                              </Form.Item>
                            </Col>
                          </Row>
                        </div>
          
                        {/* Stipend Section */}
                        <div className="mb-10">
                          <div className="flex items-center mb-6 pb-4 border-b border-border">
                            <div className="flex items-center justify-center w-12 h-12 bg-secondary rounded-xl mr-4 shadow-sm">
                              <DollarOutlined className="text-white text-xl" />
                            </div>
                            <div>
                              <Title level={3} className="mb-0 text-text-primary">
                                Stipend Information
                              </Title>
                              <Text className="text-text-secondary">
                                Define compensation details
                              </Text>
                            </div>
                          </div>
                          <Row gutter={[16, 16]}>
                            <Col xs={24}>
                              <Form.Item name="isStipendProvided" valuePropName="checked">
                                <Checkbox className="text-text-primary font-medium">This internship provides stipend</Checkbox>
                              </Form.Item>
                            </Col>
          
                            <Form.Item
                              shouldUpdate={(prevValues, currentValues) =>
                                prevValues.isStipendProvided !==
                                currentValues.isStipendProvided
                              }
                              noStyle
                            >
                              {({ getFieldValue }) =>
                                getFieldValue("isStipendProvided") ? (
                                  <>
                                    <Col xs={24} md={12}>
                                      <Form.Item
                                        name="stipendAmount"
                                        label="Stipend Amount (₹)"
                                        rules={[
                                          {
                                            required: true,
                                            message: "Please enter stipend amount",
                                          },
                                          {
                                            type: "number",
                                            min: 1000,
                                            message: "Minimum stipend should be ₹1000",
                                          },
                                        ]}
                                      >
                                        <InputNumber
                                          placeholder="Enter stipend amount"
                                          size="large"
                                          className="w-full rounded-xl border-border"
                                          min={1000}
                                          formatter={(value) =>
                                            `₹ ${value}`.replace(
                                              /\B(?=(\d{3})+(?!\d))/g,
                                              ","
                                            )
                                          }
                                          parser={(value) =>
                                            value.replace(/\₹\s?|(,*)/g, "")
                                          }
                                        />
                                      </Form.Item>
                                    </Col>
                                    <Col xs={24}>
                                      <Form.Item
                                        name="stipendDetails"
                                        label="Stipend Details"
                                        tooltip="Additional information about stipend, benefits, etc."
                                      >
                                        <TextArea
                                          rows={3}
                                          placeholder="Additional stipend details, frequency, benefits..."
                                          className="rounded-xl border-border"
                                        />
                                      </Form.Item>
                                    </Col>
                                  </>
                                ) : null
                              }
                            </Form.Item>
                          </Row>
                        </div>
          
                        {/* Enhanced Submit Section */}
                        <div className="text-center mt-12 pt-8 border-t border-border">
                          <Card className="rounded-2xl p-8 mb-8 bg-background-tertiary/20 border-border">
                            <Title level={4} className="mb-3 text-text-primary">
                              Ready to Post Your Internship? 🚀
                            </Title>
                            <Text className="text-text-secondary block mb-6">
                              Your internship opportunity will be visible to thousands of
                              talented students across various disciplines.
                            </Text>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                              <Card className="rounded-xl p-4 border-border bg-background shadow-sm">
                                <Text className="text-2xl block mb-1">📋</Text>
                                <Text className="text-sm font-medium text-text-primary">
                                  Review & Edit Anytime
                                </Text>
                              </Card>
                              <Card className="rounded-xl p-4 border-border bg-background shadow-sm">
                                <Text className="text-2xl block mb-1">📊</Text>
                                <Text className="text-sm font-medium text-text-primary">
                                  Track Applications
                                </Text>
                              </Card>
                              <Card className="rounded-xl p-4 border-border bg-background shadow-sm">
                                <Text className="text-2xl block mb-1">🎯</Text>
                                <Text className="text-sm font-medium text-text-primary">
                                  Find Top Talent
                                </Text>
                              </Card>
                            </div>
                          </Card>
          
                          <div className="flex flex-wrap justify-center gap-4">
                            <Button
                              size="large"
                              onClick={() => navigate("/industry/dashboard")}
                              className="h-14 px-10 rounded-2xl border-2 border-border text-text-secondary hover:text-text-primary font-medium transition-all duration-200"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="primary"
                              htmlType="submit"
                              loading={loading}
                              size="large"
                              icon={!loading && <SaveOutlined />}
                              className="h-14 px-12 rounded-2xl bg-primary border-0 font-bold text-lg shadow-xl shadow-primary/20 hover:shadow-2xl transition-all duration-300"
                            >
                              {loading ? (
                                <div className="flex items-center space-x-2">
                                  <LoadingOutlined className="animate-spin" />
                                  <span>Publishing Internship...</span>
                                </div>
                              ) : (
                                "Publish Internship"
                              )}
                            </Button>
                          </div>
          
                          <div className="mt-8 text-center">
                            <Text className="text-text-tertiary text-sm italic">
                              Your internship will be live immediately and visible to
                              eligible students
                            </Text>
                          </div>
                        </div>
                      </Form>
                    </Card>
                  </div>
                </div>
              </Layouts>
            );
          };        </div>
      </div>
    </Layouts>
  );
};

export default PostInternship;