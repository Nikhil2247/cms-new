import React, { useEffect, useState } from 'react';
import { Form, Input, Select, DatePicker, Button, Row, Col, message, Upload, Spin, Modal, Divider } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { createStaff, updateStaff, fetchStaff, fetchDepartments } from '../store/principalSlice';
import { UploadOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const StaffModal = ({ open, onClose, staffId, onSuccess }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  const { staff, departments } = useSelector(state => state.principal);
  const staffMember = staffId ? staff.list?.find(s => s.id === staffId) : null;
  const isEditMode = !!staffId;

  useEffect(() => {
    if (open) {
      const loadData = async () => {
        setInitialLoading(true);
        try {
          await Promise.all([
            dispatch(fetchDepartments()),
            staffId && !staffMember ? dispatch(fetchStaff({})) : Promise.resolve(),
          ]);
        } finally {
          setInitialLoading(false);
        }
      };
      loadData();
    }
  }, [dispatch, staffId, staffMember, open]);

  const transformImageToFileList = (imageUrl, name = 'Image') => {
    if (!imageUrl) return undefined;
    if (typeof imageUrl === 'string') {
      return [{
        uid: '-1',
        name: name,
        status: 'done',
        url: imageUrl,
      }];
    }
    if (Array.isArray(imageUrl)) return imageUrl;
    return undefined;
  };

  useEffect(() => {
    if (open && staffMember) {
      // Find matching department ID from the department name
      let departmentId = null;
      if (staffMember.department || staffMember.branchName) {
        const deptName = staffMember.department || staffMember.branchName;
        const matchingDept = departments?.list?.find(d =>
          d.name === deptName || d.shortName === deptName
        );
        departmentId = matchingDept?.id || null;
      }

      form.setFieldsValue({
        ...staffMember,
        departmentId, // Set the department ID for the select
        dateOfJoining: staffMember.dateOfJoining ? dayjs(staffMember.dateOfJoining) : null,
        profileImage: transformImageToFileList(staffMember.profileImage, 'Profile Image'),
        signature: transformImageToFileList(staffMember.signature, 'Signature'),
      });
    } else if (open && !isEditMode) {
      form.resetFields();
    }
  }, [staffMember, form, open, isEditMode, departments]);

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      // Transform departmentId to department name
      let departmentName = null;
      if (values.departmentId) {
        const selectedDept = departments?.list?.find(d => d.id === values.departmentId);
        departmentName = selectedDept?.name || null;
      }

      const formattedValues = {
        ...values,
        department: departmentName, // Send department name, not ID
        dateOfJoining: values.dateOfJoining ? values.dateOfJoining.format('YYYY-MM-DD') : null,
      };
      // Remove departmentId as backend expects 'department' string
      delete formattedValues.departmentId;

      if (isEditMode) {
        await dispatch(updateStaff({ id: staffId, data: formattedValues })).unwrap();
        message.success('Staff updated successfully');
      } else {
        await dispatch(createStaff(formattedValues)).unwrap();
        message.success('Staff created successfully');
      }
      handleClose();
      onSuccess?.();
    } catch (error) {
      message.error(error?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const normFile = (e) => {
    if (Array.isArray(e)) {
      return e;
    }
    return e?.fileList;
  };

  return (
    <Modal
      title={isEditMode ? 'Edit Staff Member' : 'Add New Staff Member'}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={600}
      destroyOnHidden
    >
      {initialLoading ? (
        <div className="flex justify-center items-center py-12">
          <Spin size="large" />
        </div>
      ) : (
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Divider plain>Personal Information</Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="name"
                label="Full Name"
                rules={[{ required: true, message: 'Please enter full name' }]}
              >
                <Input placeholder="Enter full name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="employeeId"
                label="Employee ID"
              >
                <Input placeholder="Enter employee ID" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Please enter valid email' }
                ]}
              >
                <Input placeholder="Enter email" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="phoneNo"
                label="Phone Number"
                rules={[
                  { pattern: /^\+?[0-9]{10,15}$/, message: 'Please enter valid phone number (10-15 digits)' }
                ]}
              >
                <Input placeholder="Enter phone number" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="gender" label="Gender">
                <Select placeholder="Select gender">
                  <Select.Option value="MALE">Male</Select.Option>
                  <Select.Option value="FEMALE">Female</Select.Option>
                  <Select.Option value="OTHER">Other</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider plain>Professional Information</Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="role"
                label="Role"
                rules={[{ required: true, message: 'Please select role' }]}
              >
                <Select placeholder="Select role">
                  <Select.Option value="TEACHER">Teacher</Select.Option>
                  <Select.Option value="MENTOR">Mentor</Select.Option>
                  <Select.Option value="HOD">Head of Department</Select.Option>
                  <Select.Option value="COORDINATOR">Coordinator</Select.Option>
                  <Select.Option value="ADMIN">Admin</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="departmentId"
                label="Department"
              >
                <Select placeholder="Select department" allowClear>
                  {departments?.list?.map(dept => (
                    <Select.Option key={dept.id} value={dept.id}>
                      {dept.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="designation"
                label="Designation"
              >
                <Input placeholder="Enter designation (e.g., Assistant Professor)" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="dateOfJoining"
                label="Date of Joining"
              >
                <DatePicker
                  style={{ width: '100%' }}
                  format="DD/MM/YYYY"
                  disabledDate={(current) => current && current > dayjs().endOf('day')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain>Academic Information</Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="qualification" label="Highest Qualification">
                <Select placeholder="Select qualification">
                  <Select.Option value="B.Tech">B.Tech</Select.Option>
                  <Select.Option value="M.Tech">M.Tech</Select.Option>
                  <Select.Option value="PhD">PhD</Select.Option>
                  <Select.Option value="MBA">MBA</Select.Option>
                  <Select.Option value="MCA">MCA</Select.Option>
                  <Select.Option value="Other">Other</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="specialization" label="Specialization">
                <Input placeholder="Enter specialization/area of expertise" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="experience" label="Years of Experience">
                <Input type="number" placeholder="Enter years of experience" min={0} />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain>Additional Information</Divider>

          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item name="address" label="Address">
                <Input.TextArea rows={2} placeholder="Enter address" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="qualifications" label="Qualifications & Certifications">
                <Input.TextArea
                  rows={2}
                  placeholder="Enter detailed qualifications, certifications, and achievements"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="resume"
                label="Resume/CV"
                valuePropName="fileList"
                getValueFromEvent={normFile}
              >
                <Upload beforeUpload={() => false} maxCount={1} accept=".pdf,.doc,.docx">
                  <Button icon={<UploadOutlined />}>Click to Upload</Button>
                </Upload>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="profileImage"
                label="Profile Image"
                valuePropName="fileList"
                getValueFromEvent={normFile}
              >
                <Upload beforeUpload={() => false} maxCount={1} accept="image/*">
                  <Button icon={<UploadOutlined />}>Click to Upload</Button>
                </Upload>
              </Form.Item>
            </Col>
          </Row>

          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button onClick={handleClose}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
              {isEditMode ? 'Update Staff' : 'Create Staff'}
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
};

export default StaffModal;
