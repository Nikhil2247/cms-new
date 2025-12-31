import React, { useState } from 'react';
import { Card, Typography, Avatar, Row, Col, Button, Modal, Form, Input, message, Tooltip } from 'antd';
import {
  CalendarOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  UserOutlined,
  StarOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { formatDisplayDate, formatCurrency } from '../../utils/applicationUtils';
import { getImageUrl } from '../../../../../utils/imageUtils';
import studentService from '../../../../../services/student.service';

const { Text } = Typography;
const { TextArea } = Input;

const ApplicationDetailsTab = ({ application, isSelfIdentified, internship, industry, onApplicationUpdate }) => {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  // Handle opening edit modal
  const handleOpenEditModal = () => {
    form.setFieldsValue({
      companyName: application.companyName || '',
      companyAddress: application.companyAddress || '',
      companyContact: application.companyContact || '',
      companyEmail: application.companyEmail || '',
      hrName: application.hrName || '',
      hrContact: application.hrContact || '',
      hrEmail: application.hrEmail || '',
      jobProfile: application.jobProfile || '',
    });
    setEditModalVisible(true);
  };

  // Handle saving company info
  const handleSaveCompanyInfo = async (values) => {
    try {
      setSaving(true);
      await studentService.updateApplication(application.id, values);
      message.success('Company information updated successfully');
      setEditModalVisible(false);

      // Notify parent to refresh data
      if (onApplicationUpdate) {
        onApplicationUpdate();
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to update company information');
    } finally {
      setSaving(false);
    }
  };

  return (
  <>
  <div className="space-y-4 p-4">
    {/* Edit Button for Self-Identified */}
    {isSelfIdentified && (
      <div className="flex justify-end">
        <Tooltip title="Edit company information">
          <Button
            type="default"
            size="small"
            icon={<EditOutlined />}
            onClick={handleOpenEditModal}
          >
            Edit Details
          </Button>
        </Tooltip>
      </div>
    )}

    {/* Details Grid */}
    <Row gutter={[16, 16]}>
      <Col xs={24} md={12}>
        <Card className="rounded-xl h-full" title="Duration & Schedule">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarOutlined className="text-blue-500" />
              <div>
                <Text type="secondary" className="block text-xs">Start Date</Text>
                <Text>
                  {formatDisplayDate(
                    isSelfIdentified
                      ? application.startDate
                      : internship?.startDate
                  )}
                </Text>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CalendarOutlined className="text-green-500" />
              <div>
                <Text type="secondary" className="block text-xs">End Date</Text>
                <Text>
                  {formatDisplayDate(
                    isSelfIdentified
                      ? application.endDate
                      : internship?.endDate
                  )}
                </Text>
              </div>
            </div>
            {!isSelfIdentified && internship?.stipend && (
              <div className="flex items-center gap-2">
                <StarOutlined className="text-yellow-500" />
                <div>
                  <Text type="secondary" className="block text-xs">Stipend</Text>
                  <Text>{formatCurrency(internship.stipend)}</Text>
                </div>
              </div>
            )}
          </div>
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card className="rounded-xl h-full" title="Contact Information">
          <div className="space-y-3">
            {(industry?.address || application.companyAddress) && (
              <div className="flex items-center gap-2">
                <EnvironmentOutlined className="text-red-500" />
                <div>
                  <Text type="secondary" className="block text-xs">Location</Text>
                  <Text>{industry?.address || application.companyAddress}</Text>
                </div>
              </div>
            )}
            {industry?.phone && (
              <div className="flex items-center gap-2">
                <PhoneOutlined className="text-green-500" />
                <div>
                  <Text type="secondary" className="block text-xs">Phone</Text>
                  <Text>{industry.phone}</Text>
                </div>
              </div>
            )}
            {industry?.email && (
              <div className="flex items-center gap-2">
                <MailOutlined className="text-blue-500" />
                <div>
                  <Text type="secondary" className="block text-xs">Email</Text>
                  <Text>{industry.email}</Text>
                </div>
              </div>
            )}
          </div>
        </Card>
      </Col>
    </Row>

    {/* Mentor Info */}
    {application.mentor && (
      <Card className="rounded-xl" title="Assigned Mentor">
        <div className="flex items-center gap-4">
          <Avatar
            src={application.mentor.profileImage ? getImageUrl(application.mentor.profileImage) : null}
            icon={<UserOutlined />}
            size={48}
            className="bg-purple-100 text-purple-600"
          />
          <div>
            <Text strong>{application.mentor.name}</Text>
            <br />
            <Text type="secondary" className="text-sm">
              {application.mentor.designation || 'Faculty Mentor'}
            </Text>
            {application.mentor.email && (
              <div className="text-xs text-gray-500">{application.mentor.email}</div>
            )}
          </div>
        </div>
      </Card>
    )}

    {/* Self-Identified: HR Contact Info */}
    {isSelfIdentified && (application.hrName || application.hrContact || application.hrEmail) && (
      <Card className="rounded-xl" title="HR / Contact Person">
        <div className="space-y-3">
          {application.hrName && (
            <div className="flex items-center gap-2">
              <UserOutlined className="text-purple-500" />
              <div>
                <Text type="secondary" className="block text-xs">Name</Text>
                <Text>{application.hrName}</Text>
              </div>
            </div>
          )}
          {application.hrContact && (
            <div className="flex items-center gap-2">
              <PhoneOutlined className="text-green-500" />
              <div>
                <Text type="secondary" className="block text-xs">Phone</Text>
                <Text>{application.hrContact}</Text>
              </div>
            </div>
          )}
          {application.hrEmail && (
            <div className="flex items-center gap-2">
              <MailOutlined className="text-blue-500" />
              <div>
                <Text type="secondary" className="block text-xs">Email</Text>
                <Text>{application.hrEmail}</Text>
              </div>
            </div>
          )}
        </div>
      </Card>
    )}
  </div>

  {/* Edit Company Info Modal */}
  <Modal
    title={
      <div className="flex items-center gap-2">
        <EditOutlined className="text-primary" />
        <span>Edit Company Information</span>
      </div>
    }
    open={editModalVisible}
    onCancel={() => setEditModalVisible(false)}
    footer={null}
    width={600}
  >
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSaveCompanyInfo}
      className="mt-4"
    >
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="Company Name"
            name="companyName"
            rules={[{ required: true, message: 'Company name is required' }]}
          >
            <Input placeholder="Enter company name" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Job Profile / Role"
            name="jobProfile"
            rules={[{ required: true, message: 'Job profile is required' }]}
          >
            <Input placeholder="e.g., Data Analyst Intern" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        label="Company Address"
        name="companyAddress"
      >
        <TextArea rows={2} placeholder="Full address of the internship location" />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="Company Contact"
            name="companyContact"
          >
            <Input placeholder="Phone number" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Company Email"
            name="companyEmail"
            rules={[{ type: 'email', message: 'Please enter a valid email' }]}
          >
            <Input placeholder="company@example.com" />
          </Form.Item>
        </Col>
      </Row>

      <div className="border-t pt-4 mt-4">
        <Text strong className="block mb-3">HR / Contact Person</Text>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="HR Name"
              name="hrName"
            >
              <Input placeholder="Contact person name" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="HR Contact"
              name="hrContact"
            >
              <Input placeholder="Phone number" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          label="HR Email"
          name="hrEmail"
          rules={[{ type: 'email', message: 'Please enter a valid email' }]}
        >
          <Input placeholder="hr@company.com" />
        </Form.Item>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button onClick={() => setEditModalVisible(false)} icon={<CloseOutlined />}>
          Cancel
        </Button>
        <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
          Save Changes
        </Button>
      </div>
    </Form>
  </Modal>
  </>
);
};

export default ApplicationDetailsTab;
