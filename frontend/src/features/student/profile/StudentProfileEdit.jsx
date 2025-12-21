import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Form, Input, DatePicker, Upload, Button, message, Row, Col, Avatar, Divider } from 'antd';
import { SaveOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons';
import { fetchProfile, updateProfile } from '../../../store/slices/studentSlice';
import dayjs from 'dayjs';

const StudentProfileEdit = () => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const { profile } = useSelector((state) => state.student);

  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

  useEffect(() => {
    if (profile) {
      form.setFieldsValue({
        ...profile,
        dateOfBirth: profile.dateOfBirth ? dayjs(profile.dateOfBirth) : null,
      });
    }
  }, [profile, form]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const formData = new FormData();

      // Append text fields
      Object.keys(values).forEach(key => {
        if (values[key] && key !== 'dateOfBirth') {
          formData.append(key, values[key]);
        }
      });

      // Append date
      if (values.dateOfBirth) {
        formData.append('dateOfBirth', values.dateOfBirth.format('YYYY-MM-DD'));
      }

      // Append files
      if (profileImage) {
        formData.append('profileImage', profileImage);
      }
      if (resumeFile) {
        formData.append('resume', resumeFile);
      }

      await dispatch(updateProfile(formData)).unwrap();
      message.success('Profile updated successfully');
    } catch (error) {
      message.error(error?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (info) => {
    if (info.file.status !== 'uploading') {
      setProfileImage(info.file.originFileObj);
    }
  };

  const handleResumeChange = (info) => {
    if (info.file.status !== 'uploading') {
      setResumeFile(info.file.originFileObj);
    }
  };

  const imageProps = {
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('You can only upload image files!');
        return Upload.LIST_IGNORE;
      }
      const isLt2M = file.size / 1024 / 1024 < 2;
      if (!isLt2M) {
        message.error('Image must be smaller than 2MB!');
        return Upload.LIST_IGNORE;
      }
      return false;
    },
    onChange: handleImageChange,
    maxCount: 1,
  };

  const resumeProps = {
    beforeUpload: (file) => {
      const isPDF = file.type === 'application/pdf';
      if (!isPDF) {
        message.error('You can only upload PDF files!');
        return Upload.LIST_IGNORE;
      }
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) {
        message.error('File must be smaller than 5MB!');
        return Upload.LIST_IGNORE;
      }
      return false;
    },
    onChange: handleResumeChange,
    maxCount: 1,
  };

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      <Card 
        title={<span className="text-text-primary font-semibold">Edit Profile</span>} 
        className="rounded-xl border-border shadow-sm max-w-4xl mx-auto"
      >
        <div className="text-center mb-10 bg-background-tertiary/30 p-8 rounded-2xl border border-border/50">
          <Avatar
            size={120}
            icon={<UserOutlined />}
            src={profile?.profileImage}
            className="mb-6 shadow-md border-4 border-background"
          />
          <div>
            <Upload {...imageProps} showUploadList={false}>
              <Button icon={<UploadOutlined />} className="rounded-lg">Change Profile Picture</Button>
            </Upload>
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          className="mt-2"
        >
          <Divider plain className="!text-text-secondary uppercase text-[10px] tracking-widest font-bold">Personal Information</Divider>

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="Full Name"
                rules={[{ required: true, message: 'Please enter your name' }]}
              >
                <Input placeholder="Enter your full name" className="rounded-lg" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Please enter a valid email' }
                ]}
              >
                <Input placeholder="Enter your email" disabled className="rounded-lg" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="phone"
                label="Phone Number"
                rules={[
                  { required: true, message: 'Please enter your phone number' },
                  { pattern: /^[0-9]{10}$/, message: 'Please enter a valid 10-digit phone number' }
                ]}
              >
                <Input placeholder="Enter your phone number" className="rounded-lg" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="dateOfBirth"
                label="Date of Birth"
              >
                <DatePicker
                  className="w-full rounded-lg"
                  placeholder="Select your date of birth"
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain className="!text-text-secondary uppercase text-[10px] tracking-widest font-bold mt-10">Academic Information</Divider>

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="rollNumber"
                label="Roll Number"
              >
                <Input placeholder="Enter your roll number" disabled className="rounded-lg" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="department"
                label="Department"
              >
                <Input placeholder="Your department" disabled className="rounded-lg" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="batch"
                label="Batch"
              >
                <Input placeholder="Your batch" disabled className="rounded-lg" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="currentSemester"
                label="Current Semester"
              >
                <Input placeholder="Current semester" disabled className="rounded-lg" />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain className="!text-text-secondary uppercase text-[10px] tracking-widest font-bold mt-10">Address & Contact</Divider>

          <Form.Item
            name="address"
            label="Address"
          >
            <Input.TextArea
              rows={3}
              placeholder="Enter your complete address"
              className="rounded-lg"
            />
          </Form.Item>

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="city"
                label="City"
              >
                <Input placeholder="Enter your city" className="rounded-lg" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="state"
                label="State"
              >
                <Input placeholder="Enter your state" className="rounded-lg" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="pincode"
                label="Pincode"
                rules={[
                  { pattern: /^[0-9]{6}$/, message: 'Please enter a valid 6-digit pincode' }
                ]}
              >
                <Input placeholder="Enter pincode" className="rounded-lg" />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain className="!text-text-secondary uppercase text-[10px] tracking-widest font-bold mt-10">Professional Information</Divider>

          <Form.Item
            name="skills"
            label="Skills"
            tooltip="Add your technical and soft skills"
          >
            <Input.TextArea
              rows={3}
              placeholder="List your skills (e.g., React, Node.js, Communication, Teamwork)"
              className="rounded-lg"
            />
          </Form.Item>

          <Form.Item
            name="bio"
            label="Bio"
          >
            <Input.TextArea
              rows={4}
              placeholder="Write a brief bio about yourself..."
              showCount
              maxLength={500}
              className="rounded-lg"
            />
          </Form.Item>

          <Form.Item
            label="Resume"
            tooltip="Upload your latest resume in PDF format"
          >
            <Upload {...resumeProps}>
              <Button icon={<UploadOutlined />} className="rounded-lg">Upload Resume (PDF)</Button>
            </Upload>
            {profile?.resumeUrl && (
              <div className="mt-3 p-3 bg-primary-50 rounded-xl border border-primary-200 inline-block">
                <a href={profile.resumeUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                  View Current Resume
                </a>
              </div>
            )}
          </Form.Item>

          <Divider plain className="!text-text-secondary uppercase text-[10px] tracking-widest font-bold mt-10">Social Links</Divider>

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="linkedinUrl"
                label="LinkedIn Profile"
              >
                <Input placeholder="https://linkedin.com/in/yourprofile" className="rounded-lg" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="githubUrl"
                label="GitHub Profile"
              >
                <Input placeholder="https://github.com/yourusername" className="rounded-lg" />
              </Form.Item>
            </Col>
          </Row>

          <Divider className="my-8" />

          <Form.Item className="!mb-0">
            <div className="flex justify-end">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<SaveOutlined />}
                size="large"
                className="rounded-xl px-10 h-12 shadow-lg shadow-primary/20"
              >
                Update Profile
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default StudentProfileEdit;