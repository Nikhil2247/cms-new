import React, { useState, useEffect } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Upload,
  DatePicker,
  InputNumber,
  message,
  Divider,
  Space,
  Select,
  Spin,
  Row,
  Col,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import API from "../../../services/api";
import {
  fetchInstituteAsync,
  selectInstitute,
  selectInstituteLoading,
} from "../../../store/slices/instituteSlice";
import { toast } from "react-hot-toast";

const { TextArea } = Input;
const { Option } = Select;

const SelfIdentifiedInternship = () => {
  const dispatch = useDispatch();
  const institute = useSelector(selectInstitute);
  const instituteLoading = useSelector(selectInstituteLoading);

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [joiningLetterFile, setJoiningLetterFile] = useState(null);
  const [facultyMentors, setFacultyMentors] = useState([]);
  const [internshipDuration, setInternshipDuration] = useState("");

  // Fetch institute data on mount
  useEffect(() => {
    dispatch(fetchInstituteAsync());
  }, [dispatch]);

  // Extract faculty mentors from institute data
  useEffect(() => {
    if (institute?.users) {
      const mentors = institute.users.filter(
        (user) => user.role === "TEACHER" || user.role === "FACULTY_SUPERVISOR"
      );
      setFacultyMentors(mentors);
    }
  }, [institute]);

  // Calculate internship duration when dates change
  const calculateDuration = (startDate, endDate) => {
    if (!startDate || !endDate) {
      setInternshipDuration("");
      form.setFieldsValue({ internshipDuration: "" });
      return;
    }

    const start = startDate.startOf('day');
    const end = endDate.startOf('day');

    if (end.isBefore(start)) {
      setInternshipDuration("");
      form.setFieldsValue({ internshipDuration: "" });
      message.warning("End date cannot be before start date");
      return;
    }

    // Calculate difference in months and days
    const totalDays = end.diff(start, 'days');
    const months = Math.floor(totalDays / 30);
    const days = totalDays % 30;

    let duration = "";
    if (months > 0 && days > 0) {
      duration = `${months} month${months > 1 ? 's' : ''} ${days} day${days > 1 ? 's' : ''}`;
    } else if (months > 0) {
      duration = `${months} month${months > 1 ? 's' : ''}`;
    } else {
      duration = `${days} day${days > 1 ? 's' : ''}`;
    }

    setInternshipDuration(duration);
    form.setFieldsValue({ internshipDuration: duration });
  };

  // Handle date changes
  const handleStartDateChange = (date) => {
    const endDate = form.getFieldValue('endDate');
    calculateDuration(date, endDate);
  };

  const handleEndDateChange = (date) => {
    const startDate = form.getFieldValue('startDate');
    calculateDuration(startDate, date);
  };

  const handleSubmit = async (values) => {
    try {
      // Get login data
      const loginData = JSON.parse(localStorage.getItem("loginResponse"));
      const studentId = loginData?.user?.studentId;
      const assignerId =
        loginData?.user?.id ||
        loginData?.user?.userId ||
        loginData?.user?.staffId;

      if (!studentId) {
        toast.error("Student ID not found. Please login again.");
        return;
      }

      // Prevent creating a new self-identified internship if student already has
      // an active application. Only applications with status === 'WITHDRAWN'
      // are allowed to be replaced.
      try {
        const res = await API.get(`/internship-applications/my-applications`);
        const apps = (res.data && (res.data.data || res.data)) || [];
        const hasActive = apps.some((a) => (a.status || "").toUpperCase() !== "WITHDRAWN");
        if (hasActive) {
          toast.error(
            "You already have an active internship application. Ask your mentor to deactivate it before adding another."
          );
          return;
        }
      } catch (err) {
        // If the lookup fails (endpoint missing or network error), do not block
        // the student from submitting. Log for debugging and continue.
        // eslint-disable-next-line no-console
        console.warn("Could not verify existing applications:", err?.response || err?.message || err);
      }

      setLoading(true);

      // Get selected mentor details
      const mentorDetails = values.mentorId
        ? facultyMentors.find((m) => m.id === values.mentorId)
        : null;

      // Create FormData
      const formData = new FormData();

      // Append basic fields
      formData.append("studentId", studentId);
      formData.append("companyName", values.companyName || "");
      formData.append("companyAddress", values.companyAddress || "");
      formData.append("companyContact", values.companyContact || "");
      formData.append("companyEmail", values.companyEmail || "");
      formData.append("jobProfile", values.jobProfile || "");
      formData.append("internshipDuration", values.internshipDuration || "");
      formData.append("hrName", values.hrName || "");
      formData.append("hrContact", values.hrContact || "");
      formData.append("hrEmail", values.hrEmail || "");

      // Append optional fields only if they have values
      if (values.stipend) {
        formData.append("stipend", values.stipend.toString());
      }

      if (values.startDate) {
        formData.append("startDate", values.startDate.toISOString());
      }

      if (values.endDate) {
        formData.append("endDate", values.endDate.toISOString());
      }

      // Append self-identified flags
      formData.append("isSelfIdentified", "true");
      formData.append("internshipStatus", "SELF_IDENTIFIED");
      formData.append("status", "PENDING");
      formData.append(
        "notes",
        "Self-identified internship submitted by student"
      );

      // **CRITICAL: Append mentor fields if mentor is selected**
      if (values.mentorId && mentorDetails) {
        formData.append("mentorId", values.mentorId);
        formData.append("mentorAssignedAt", new Date().toISOString());
        formData.append("mentorAssignedBy", assignerId || "");
        formData.append("facultyMentorName", mentorDetails.name || "");
        formData.append(
          "facultyMentorContact",
          mentorDetails.contact || mentorDetails.phone || ""
        );
        formData.append("facultyMentorEmail", mentorDetails.email || "");
        formData.append(
          "facultyMentorDesignation",
          mentorDetails.designation || "Assistant Professor"
        );
      }

      // Append file if selected
      if (joiningLetterFile) {
        formData.append("joiningLetter", joiningLetterFile);
        formData.append("joiningLetterUploadedAt", new Date().toISOString());
      }

      // Debug: Log FormData contents (remove in production)
      // console.log("FormData contents:");
      for (let [key, value] of formData.entries()) {
        // console.log(key, value);
      }

      // Validate joining letter file before upload
      if (joiningLetterFile) {
        console.log(`Uploading file: ${joiningLetterFile.name}, Size: ${(joiningLetterFile.size / (1024 * 1024)).toFixed(2)}MB`);
        if (joiningLetterFile.size > 5 * 1024 * 1024) {
          toast.error(`File too large (${(joiningLetterFile.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 5MB. Please compress or use a smaller file.`);
          return;
        }
      }

      // Submit to backend
      const response = await API.post(
        "/self-identified-internships",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 60000,
          maxContentLength: 5 * 1024 * 1024, // 5MB
          maxBodyLength: 5 * 1024 * 1024, // 5MB
        }
      );

      const applicationData = response.data.data || response.data;
      const applicationId = applicationData?.id || applicationData?._id;

      if (!applicationId) {
        throw new Error("Failed to get application ID from response");
      }

      // Backend handles mentor assignment linking if mentorId was provided in the payload.
      toast.success(
        values.mentorId
          ? "Self-identified internship submitted and mentor assignment requested"
          : "Self-identified internship submitted successfully!"
      );

      // Reset form
      form.resetFields();
      setJoiningLetterFile(null);
    } catch (error) {
      console.error("Submission error:", error);
      
      // Enhanced error handling
      if (error.code === 'ERR_NETWORK') {
        toast.error(
          "Unable to connect to server. Please try again later."
        );
      } else if (error.code === 'ECONNABORTED') {
        toast.error(
          "Upload timeout: The request is taking too long. Please try with a smaller file or check your internet connection."
        );
      } else if (error.response?.status === 413) {
        const fileSizeMB = joiningLetterFile ? (joiningLetterFile.size / (1024 * 1024)).toFixed(2) : 'unknown';
        toast.error(
          `File too large (${fileSizeMB}MB): The server rejected your file. Maximum allowed size is 5MB. Please compress your file or use a smaller one.`
        );
      } else if (error.response?.status === 400) {
        toast.error(
          error.response.data?.message || "Invalid data or file format. Please check your inputs and try again."
        );
      } else {
        toast.error(
          error.response?.data?.message ||
          error.message ||
          "Failed to submit application. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

    return (
      <div className="max-w-5xl mx-auto p-4 md:p-6 bg-background-secondary min-h-screen">

        <h1 className="text-3xl font-bold text-text-primary mb-2">Submit Internship Details</h1>

        <p className="text-text-secondary text-base mb-8">

            Submit internships you found on your own or college provided. Fill in

            the details below and upload your joining letter for approval.

          </p>

  

          <Card className="rounded-xl border-border shadow-sm">

            <Form

              form={form}

              layout="vertical"

              onFinish={handleSubmit}

              autoComplete="off"

              className="mt-2"

            >

              <Divider plain className="!text-text-secondary uppercase text-[10px] tracking-widest font-bold">Company Details</Divider>

              <Row gutter={24}>

                <Col xs={24} sm={24} md={12}>

                  <Form.Item

                    label="Company Name"

                    name="companyName"

                    rules={[

                      { required: true, message: "Please enter company name" },

                    ]}

                  >

                    <Input placeholder="e.g., Google India" className="rounded-lg h-10" />

                  </Form.Item>

                </Col>

  

                <Col xs={24} sm={24} md={12}>

                  <Form.Item

                    label="Company Contact"

                    name="companyContact"

                    rules={[

                      {

                        required: true,

                        message: "Please enter company contact number",

                      },

                    ]}

                  >

                    <Input placeholder="Phone number" className="rounded-lg h-10" />

                  </Form.Item>

                </Col>

              </Row>

  

              <Row gutter={24}>

                <Col xs={24}>

                  <Form.Item

                    label="Company Address"

                    name="companyAddress"

                    rules={[

                      { required: true, message: "Please enter company address" },

                    ]}

                  >

                    <TextArea

                      rows={2}

                      placeholder="Full address of the company"

                      className="rounded-lg"

                    />

                  </Form.Item>

                </Col>

              </Row>

  

              <Row gutter={24}>

                <Col xs={24} sm={24} md={12}>

                  <Form.Item

                    label="Company Email"

                    name="companyEmail"

                    rules={[

                      { type: "email", message: "Please enter a valid email" },

                    ]}

                  >

                    <Input placeholder="company@example.com" className="rounded-lg h-10" />

                  </Form.Item>

                </Col>

  

                <Col xs={24} sm={24} md={12}>

                  <Form.Item

                    label="Job Profile"

                    name="jobProfile"

                    rules={[

                      { required: true, message: "Please enter job profile" },

                    ]}

                  >

                    <Input placeholder="e.g., Software Development Intern" className="rounded-lg h-10" />

                  </Form.Item>

                </Col>

              </Row>

  

              <Row gutter={24}>

                <Col xs={24} sm={24} md={12}>

                  <Form.Item

                    label="Start Date"

                    name="startDate"

                    rules={[

                      { required: true, message: "Please select start date" },

                    ]}

                  >

                    <DatePicker 

                      className="w-full rounded-lg h-10"

                      format="DD/MM/YYYY"

                      onChange={handleStartDateChange}

                    />

                  </Form.Item>

                </Col>

  

                <Col xs={24} sm={24} md={12}>

                  <Form.Item

                    label="End Date"

                    name="endDate"

                    rules={[

                      { required: true, message: "Please select end date" },

                    ]}

                  >

                    <DatePicker 

                      className="w-full rounded-lg h-10"

                      format="DD/MM/YYYY"

                      onChange={handleEndDateChange}

                    />

                  </Form.Item>

                </Col>

              </Row>

  

              <Row gutter={24}>

                <Col xs={24} sm={24} md={12}>

                  <Form.Item

                    label="Internship Duration"

                    name="internshipDuration"

                    rules={[{ required: true, message: "Duration will be calculated automatically" }]}

                    extra={<Text className="text-[10px] text-text-tertiary">Duration is calculated automatically based on dates</Text>}

                  >

                    <Input 

                      placeholder="Auto-calculated duration" 

                      disabled

                      className="rounded-lg h-10"

                      value={internshipDuration}

                    />

                  </Form.Item>

                </Col>

  

                <Col xs={24} sm={24} md={12}>

                  <Form.Item label="Stipend (₹ per month)" name="stipend">

                    <InputNumber

                      className="w-full rounded-lg h-10"

                      placeholder="Enter amount (0 for unpaid)"

                      min={0}

                    />

                  </Form.Item>

                </Col>

              </Row>

  

              <Divider plain className="!text-text-secondary uppercase text-[10px] tracking-widest font-bold mt-10">Industry Supervisor Details</Divider>

              <Row gutter={24}>

                <Col xs={24} sm={24} md={12}>

                  <Form.Item

                    label="Industry Supervisor Name"

                    name="hrName"

                  >

                    <Input placeholder="Full name of industry supervisor" className="rounded-lg h-10" />

                  </Form.Item>

                </Col>

  

                <Col xs={24} sm={24} md={12}>

                  <Form.Item

                    label="Industry Supervisor Contact Number"

                    name="hrContact"

                  >

                    <Input placeholder="Phone number (optional)" className="rounded-lg h-10" />

                  </Form.Item>

                </Col>

              </Row>

  

              <Row gutter={24}>

                <Col xs={24} sm={24} md={12}>

                  <Form.Item

                    label="Industry Supervisor Email"

                    name="hrEmail"

                    rules={[

                      { type: "email", message: "Please enter a valid email" },

                    ]}

                  >

                    <Input placeholder="Supervisor email address" className="rounded-lg h-10" />

                  </Form.Item>

                </Col>

              </Row>

  

              <Divider plain className="!text-text-secondary uppercase text-[10px] tracking-widest font-bold mt-10">Upload Joining Letter</Divider>

              <Row>

                <Col xs={24}>

                  <Form.Item

                    label="Joining Letter"

                    extra={<Text className="text-[10px] text-text-tertiary italic">Upload your offer letter or joining letter (PDF, max 5MB)</Text>}

                    rules={[

                      { required: true, message: "Please upload joining letter" },

                    ]}

                  >

                    <Upload

                      accept=".pdf"

                      maxCount={1}

                      beforeUpload={(file) => {

                        const isLt5M = file.size / 1024 / 1024 < 5;

                        if (!isLt5M) {

                          message.error("File must be smaller than 5MB!");

                          return Upload.LIST_IGNORE;

                        }

                        setJoiningLetterFile(file);

                        return false; // Prevent auto upload

                      }}

                      onRemove={() => {

                        setJoiningLetterFile(null);

                      }}

                      fileList={

                        joiningLetterFile

                          ? [

                              {

                                uid: "-1",

                                name: joiningLetterFile.name,

                                status: "done",

                              },

                            ]

                          : []

                      }

                    >

                      <Button icon={<UploadOutlined />} className="rounded-lg h-10">

                        Select Joining Letter (PDF)

                      </Button>

                    </Upload>

                  </Form.Item>

                </Col>

              </Row>

  

              <Divider className="my-8" />

  

              <Form.Item className="!mb-0">

                <Button

                  type="primary"

                  htmlType="submit"

                  loading={loading}

                  block

                  size="large"

                  className="h-12 rounded-xl text-lg font-semibold shadow-lg shadow-primary/20"

                >

                  Submit for Approval

                </Button>

              </Form.Item>

            </Form>

          </Card>

        </div>
    );

  };

export default SelfIdentifiedInternship;