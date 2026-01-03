import React, { useEffect, useState } from 'react';
import { Form, Input, Select, DatePicker, Button, Row, Col, message, Upload, Spin, Modal, Divider } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { createStudent, updateStudent, fetchStudents } from '../store/principalSlice';
import { UploadOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useLookup } from '../../shared/hooks/useLookup';
import { getImageUrl, getPresignedUrl } from '../../../utils/imageUtils';

const StudentModal = ({ open, onClose, studentId, onSuccess }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  const { students } = useSelector(state => state.principal);
  const student = studentId ? students.list?.find(s => s.id === studentId) : null;
  const isEditMode = !!studentId;

  // Use global lookup data
  const { activeBatches, activeBranches, isLoading: lookupLoading } = useLookup({
    include: ['batches', 'branches']
  });

  useEffect(() => {
    if (open) {
      const loadData = async () => {
        setInitialLoading(true);
        try {
          // Only fetch student data if editing and student not in list
          if (studentId && !student) {
            await dispatch(fetchStudents({}));
          }
        } finally {
          setInitialLoading(false);
        }
      };
      loadData();
    }
  }, [dispatch, studentId, student, open]);

  useEffect(() => {
    const setFormValues = async () => {
      if (open && student) {
        let profileImageValue = undefined;
        if (student.profileImage) {
          if (typeof student.profileImage === 'string') {
            let urlToDisplay = student.profileImage;
            
            try {
              // Logic to resolve presigned URL, similar to ProfileAvatar
              if (urlToDisplay.startsWith('http')) {
                if (urlToDisplay.includes('minio') || urlToDisplay.includes('127.0.0.1:9000') || urlToDisplay.includes('cms-uploads')) {
                  urlToDisplay = await getPresignedUrl(urlToDisplay);
                }
              } else {
                // Relative path
                const fullUrl = getImageUrl(urlToDisplay);
                urlToDisplay = await getPresignedUrl(fullUrl);
              }
            } catch (err) {
              console.error('Failed to resolve profile image URL:', err);
              // Fallback to basic URL generation if presigning fails
              if (!urlToDisplay.startsWith('http')) {
                urlToDisplay = getImageUrl(urlToDisplay);
              }
            }

            profileImageValue = [{
              uid: '-1',
              name: 'Profile Image',
              status: 'done',
              url: urlToDisplay,
            }];
          } else if (Array.isArray(student.profileImage)) {
            profileImageValue = student.profileImage;
          }
        }

        form.setFieldsValue({
          ...student,
          dateOfBirth: student.dateOfBirth ? dayjs(student.dateOfBirth) : null,
          profileImage: profileImageValue,
        });
      } else if (open && !isEditMode) {
        form.resetFields();
      }
    };

    setFormValues();
  }, [student, form, open, isEditMode]);

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const formattedValues = {
        ...values,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : null,
      };

      if (isEditMode) {
        await dispatch(updateStudent({ id: studentId, data: formattedValues })).unwrap();
        message.success('Student updated successfully');
      } else {
        await dispatch(createStudent(formattedValues)).unwrap();
        message.success('Student created successfully');
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
      title={isEditMode ? 'Edit Student' : 'Add New Student'}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={800}
      destroyOnHidden
    >
      {initialLoading || lookupLoading ? (
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
                name="rollNumber"
                label="Roll Number"
                rules={[{ required: true, message: 'Please enter roll number' }]}
              >
                <Input placeholder="Enter roll number" />
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
                  { required: true, message: 'Please enter phone number' },
                  { pattern: /^\+?[0-9]{10,15}$/, message: 'Please enter valid phone number (10-15 digits)' }
                ]}
              >
                <Input placeholder="Enter phone number" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="dateOfBirth"
                label="Date of Birth"
              >
                <DatePicker
                  style={{ width: '100%' }}
                  format="DD/MM/YYYY"
                  disabledDate={(current) => current && current > dayjs().endOf('day')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="gender"
                label="Gender"
              >
                <Select placeholder="Select gender" allowClear>
                  <Select.Option value="MALE">Male</Select.Option>
                  <Select.Option value="FEMALE">Female</Select.Option>
                  <Select.Option value="OTHER">Other</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider plain>Academic Information</Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="batchId"
                label="Batch"
              >
                <Select placeholder="Select batch" allowClear>
                  {activeBatches?.map(batch => (
                    <Select.Option key={batch.id} value={batch.id}>
                      {batch.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="batchYear"
                label="Batch Year"
              >
                <Select placeholder="Select year" allowClear>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <Select.Option key={year} value={year}>
                      {year}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="branchId"
                label="Branch"
              >
                <Select placeholder="Select branch" allowClear>
                  {activeBranches?.map(branch => (
                    <Select.Option key={branch.id} value={branch.id}>
                      {branch.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="bloodGroup" label="Blood Group">
                <Select placeholder="Select blood group" allowClear>
                  <Select.Option value="A+">A+</Select.Option>
                  <Select.Option value="A-">A-</Select.Option>
                  <Select.Option value="B+">B+</Select.Option>
                  <Select.Option value="B-">B-</Select.Option>
                  <Select.Option value="AB+">AB+</Select.Option>
                  <Select.Option value="AB-">AB-</Select.Option>
                  <Select.Option value="O+">O+</Select.Option>
                  <Select.Option value="O-">O-</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider plain>Parent/Guardian Information</Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="parentName" label="Parent/Guardian Name">
                <Input placeholder="Enter parent/guardian name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="parentPhone"
                label="Parent/Guardian Phone"
                rules={[{ pattern: /^\+?[0-9]{10,15}$/, message: 'Please enter valid phone number (10-15 digits)' }]}
              >
                <Input placeholder="Enter parent/guardian phone" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="address" label="Address">
                <Input.TextArea rows={2} placeholder="Enter address" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                name="profileImage"
                label="Profile Image"
                valuePropName="fileList"
                getValueFromEvent={normFile}
              >
                <Upload beforeUpload={() => false} maxCount={1} accept="image/*">
                  <Button icon={<UploadOutlined />} className="rounded-lg">Click to Upload</Button>
                </Upload>
              </Form.Item>
            </Col>
          </Row>

          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button onClick={handleClose} className="rounded-lg">
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />} className="rounded-lg shadow-md shadow-primary/20">
              {isEditMode ? 'Update Student' : 'Create Student'}
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
};

export default StudentModal;

