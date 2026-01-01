import React, { useState, useEffect } from 'react';
import {
  Modal,
  Avatar,
  Form,
  Input,
  Button,
  Tag,
  Spin,
  message,
  Divider,
  Tabs,
  Switch,
  Popconfirm,
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  IdcardOutlined,
  SafetyOutlined,
  EditOutlined,
  BankOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LockOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';
import API from '../services/api';
import { authService } from '../features/auth/services/auth.service';
import MfaSetup from '../features/auth/components/MfaSetup';

const UserProfile = ({ visible, onClose }) => {
  const [form] = Form.useForm();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(false);
  const { darkMode } = useTheme();

  // MFA state
  const [activeTab, setActiveTab] = useState('profile');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  const fetchUserProfile = async () => {
    setFetchingProfile(true);
    try {
      const response = await API.get('/auth/me');
      const data = response.data;
      setUserData(data);
      setMfaEnabled(data.mfaEnabled || false);
      form.setFieldsValue({
        name: data.name,
        email: data.email,
        phoneNo: data.phoneNo || '',
        designation: data.designation || '',
        branchName: data.branchName || '',
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      message.error(error.response?.data?.message || 'Failed to load profile');
    } finally {
      setFetchingProfile(false);
    }
  };

  const handleMfaSetupSuccess = () => {
    setMfaEnabled(true);
    setShowMfaSetup(false);
    message.success('Two-factor authentication enabled');
  };

  const handleDisableMfa = async () => {
    if (!disableCode || disableCode.length !== 6) {
      message.warning('Please enter a 6-digit code');
      return;
    }

    setMfaLoading(true);
    try {
      await authService.disableMfa(disableCode);
      setMfaEnabled(false);
      setDisableCode('');
      message.success('Two-factor authentication disabled');
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to disable MFA');
    } finally {
      setMfaLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchUserProfile();
    } else {
      setEditing(false);
      setUserData(null);
      setActiveTab('profile');
      setDisableCode('');
    }
  }, [visible]);

  const handleUpdate = async (values) => {
    setLoading(true);
    try {
      const response = await API.post('/auth/profile', values);
      if (response.data.success) {
        message.success('Profile updated successfully');
        setUserData(response.data.data);
        setEditing(false);

        if (values.name !== userData.name || values.email !== userData.email) {
          const loginResponse = localStorage.getItem('loginResponse');
          if (loginResponse) {
            const parsedResponse = JSON.parse(loginResponse);
            if (parsedResponse.user) {
              parsedResponse.user.name = response.data.data.name;
              parsedResponse.user.email = response.data.data.email;
              localStorage.setItem('loginResponse', JSON.stringify(parsedResponse));
            }
          }
          window.dispatchEvent(new Event('userProfileUpdated'));
        }
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      message.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (editing) {
      form.setFieldsValue({
        name: userData.name,
        email: userData.email,
        phoneNo: userData.phoneNo || '',
        designation: userData.designation || '',
        branchName: userData.branchName || '',
      });
      setEditing(false);
    } else {
      onClose();
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRoleConfig = (role) => {
    const config = {
      PRINCIPAL: { color: '#722ed1', bg: '#f9f0ff', label: 'Principal' },
      STUDENT: { color: '#1890ff', bg: '#e6f7ff', label: 'Student' },
      TEACHER: { color: '#52c41a', bg: '#f6ffed', label: 'Teacher' },
      FACULTY_SUPERVISOR: { color: '#13c2c2', bg: '#e6fffb', label: 'Faculty Supervisor' },
      INDUSTRY: { color: '#fa8c16', bg: '#fff7e6', label: 'Industry' },
      STATE_DIRECTORATE: { color: '#f5222d', bg: '#fff1f0', label: 'State Directorate' },
      SYSTEM_ADMIN: { color: '#eb2f96', bg: '#fff0f6', label: 'System Admin' },
      ACCOUNTANT: { color: '#faad14', bg: '#fffbe6', label: 'Accountant' },
      ADMISSION_OFFICER: { color: '#13c2c2', bg: '#e6fffb', label: 'Admission Officer' },
    };
    return config[role] || { color: '#8c8c8c', bg: '#fafafa', label: role?.replace(/_/g, ' ') || 'User' };
  };

  const roleConfig = userData ? getRoleConfig(userData.role) : {};

  return (
    <Modal
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={720}
      centered
      destroyOnClose
      closable={!editing}
      maskClosable={!editing}
      className="profile-modal"
      styles={{
        content: { padding: 0, overflow: 'hidden', borderRadius: 16 },
        body: { padding: 0 },
      }}
    >
      {fetchingProfile ? (
        <div className="flex flex-col justify-center items-center py-16">
          <Spin size="large" />
          <span className="mt-4 text-gray-500">Loading profile...</span>
        </div>
      ) : userData ? (
        <div>
          {/* Header Banner */}
          <div
            className="relative h-24"
            style={{
              background: `linear-gradient(135deg, ${roleConfig.color}20 0%, ${roleConfig.color}40 100%)`,
            }}
          >
            {/* Edit/Close Button */}
            <div className="absolute top-3 right-3 flex gap-2">
              {editing ? (
                <>
                  <Button
                    size="small"
                    onClick={handleCancel}
                    className="bg-white/80 hover:bg-white border-0 shadow-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    loading={loading}
                    onClick={() => form.submit()}
                    icon={<CheckCircleOutlined />}
                  >
                    Save
                  </Button>
                </>
              ) : (
                <Button
                  size="small"
                  onClick={() => setEditing(true)}
                  icon={<EditOutlined />}
                  className="bg-white/80 hover:bg-white border-0 shadow-sm"
                >
                  Edit Profile
                </Button>
              )}
            </div>
          </div>

          {/* Avatar & Name Section */}
          <div className="px-6 -mt-12 mb-4">
            <div className="flex items-end gap-4">
              <Avatar
                size={80}
                icon={<UserOutlined />}
                src={userData.profileImage || userData.avatar}
                className="border-4 border-white shadow-lg"
                style={{ backgroundColor: roleConfig.color }}
              />
              <div className="pb-2">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 m-0 leading-tight">
                  {userData.name || 'User'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: roleConfig.bg, color: roleConfig.color }}
                  >
                    {roleConfig.label}
                  </span>
                  <span className={`flex items-center gap-1 text-xs ${userData.active ? 'text-green-600' : 'text-red-500'}`}>
                    {userData.active ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                    {userData.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            className="px-6"
            items={[
              {
                key: 'profile',
                label: (
                  <span className="flex items-center gap-2">
                    <UserOutlined />
                    Profile
                  </span>
                ),
                children: (
                  <div className="py-4">
                    {editing ? (
                      /* Edit Mode */
                      <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleUpdate}
                        requiredMark={false}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                          <Form.Item
                            name="name"
                            label={<span className="text-gray-600 dark:text-gray-300 font-medium">Full Name</span>}
                            rules={[{ required: true, message: 'Name is required' }, { min: 2, message: 'Min 2 characters' }]}
                            className="mb-0"
                          >
                            <Input
                              prefix={<UserOutlined className="text-gray-400" />}
                              placeholder="Enter your name"
                              className="rounded-lg"
                            />
                          </Form.Item>

                          <Form.Item
                            name="email"
                            label={<span className="text-gray-600 dark:text-gray-300 font-medium">Email Address</span>}
                            rules={[{ required: true, message: 'Email is required' }, { type: 'email', message: 'Invalid email' }]}
                            className="mb-0"
                          >
                            <Input
                              prefix={<MailOutlined className="text-gray-400" />}
                              placeholder="Enter your email"
                              className="rounded-lg"
                            />
                          </Form.Item>

                          <Form.Item
                            name="phoneNo"
                            label={<span className="text-gray-600 dark:text-gray-300 font-medium">Phone Number</span>}
                            rules={[{ pattern: /^[0-9]{10}$/, message: 'Enter valid 10-digit number' }]}
                            className="mb-0"
                          >
                            <Input
                              prefix={<PhoneOutlined className="text-gray-400" />}
                              placeholder="Enter phone number"
                              maxLength={10}
                              className="rounded-lg"
                            />
                          </Form.Item>

                          <Form.Item
                            name="designation"
                            label={<span className="text-gray-600 dark:text-gray-300 font-medium">Designation</span>}
                            className="mb-0"
                          >
                            <Input
                              prefix={<IdcardOutlined className="text-gray-400" />}
                              placeholder="Enter designation"
                              className="rounded-lg"
                            />
                          </Form.Item>

                          <Form.Item
                            name="branchName"
                            label={<span className="text-gray-600 dark:text-gray-300 font-medium">Branch / Department</span>}
                            className="mb-0 sm:col-span-2"
                          >
                            <Input
                              prefix={<BankOutlined className="text-gray-400" />}
                              placeholder="Enter branch or department"
                              className="rounded-lg"
                            />
                          </Form.Item>
                        </div>
                      </Form>
                    ) : (
                      /* View Mode */
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Contact Info */}
                        <InfoCard
                          icon={<MailOutlined />}
                          label="Email"
                          value={userData.email}
                          color="#1890ff"
                        />
                        <InfoCard
                          icon={<PhoneOutlined />}
                          label="Phone"
                          value={userData.phoneNo}
                          color="#52c41a"
                        />
                        {userData.rollNumber && (
                          <InfoCard
                            icon={<IdcardOutlined />}
                            label="Roll Number"
                            value={userData.rollNumber}
                            color="#722ed1"
                          />
                        )}

                        {/* Professional Info */}
                        {userData.designation && (
                          <InfoCard
                            icon={<SafetyOutlined />}
                            label="Designation"
                            value={userData.designation}
                            color="#fa8c16"
                          />
                        )}
                        {userData.branchName && (
                          <InfoCard
                            icon={<BankOutlined />}
                            label="Branch"
                            value={userData.branchName}
                            color="#13c2c2"
                          />
                        )}
                        {userData.Institution?.name && (
                          <InfoCard
                            icon={<BankOutlined />}
                            label="Institution"
                            value={userData.Institution.name}
                            color="#eb2f96"
                          />
                        )}

                        {/* Account Info */}
                        <InfoCard
                          icon={<CalendarOutlined />}
                          label="Member Since"
                          value={formatDate(userData.createdAt)}
                          color="#8c8c8c"
                        />
                        {userData.lastLoginAt && (
                          <InfoCard
                            icon={<CalendarOutlined />}
                            label="Last Login"
                            value={formatDate(userData.lastLoginAt)}
                            color="#8c8c8c"
                          />
                        )}
                        {userData.loginCount > 0 && (
                          <InfoCard
                            icon={<UserOutlined />}
                            label="Total Logins"
                            value={userData.loginCount}
                            color="#8c8c8c"
                          />
                        )}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'security',
                label: (
                  <span className="flex items-center gap-2">
                    <LockOutlined />
                    Security
                  </span>
                ),
                children: (
                  <div className="py-4 space-y-6">
                    {/* Two-Factor Authentication */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                            <KeyOutlined className="text-lg" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-1">
                              Two-Factor Authentication
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Add an extra layer of security to your account using an authenticator app.
                            </p>
                          </div>
                        </div>
                        <div>
                          {mfaEnabled ? (
                            <Tag color="success" className="m-0">Enabled</Tag>
                          ) : (
                            <Tag color="default" className="m-0">Disabled</Tag>
                          )}
                        </div>
                      </div>

                      <Divider className="my-4" />

                      {mfaEnabled ? (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            To disable 2FA, enter a code from your authenticator app:
                          </p>
                          <div className="flex gap-3">
                            <Input
                              value={disableCode}
                              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="Enter 6-digit code"
                              maxLength={6}
                              className="w-40 font-mono"
                            />
                            <Popconfirm
                              title="Disable Two-Factor Authentication?"
                              description="Your account will be less secure without 2FA."
                              onConfirm={handleDisableMfa}
                              okText="Disable"
                              okButtonProps={{ danger: true }}
                            >
                              <Button
                                danger
                                loading={mfaLoading}
                                disabled={disableCode.length !== 6}
                              >
                                Disable 2FA
                              </Button>
                            </Popconfirm>
                          </div>
                        </div>
                      ) : (
                        <Button
                          type="primary"
                          icon={<SafetyOutlined />}
                          onClick={() => setShowMfaSetup(true)}
                        >
                          Enable Two-Factor Authentication
                        </Button>
                      )}
                    </div>

                    {/* Password Section */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                          <LockOutlined className="text-lg" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-1">
                            Password
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            Change your password regularly for better security.
                          </p>
                          <Button
                            onClick={() => {
                              onClose();
                              window.location.href = '/app/change-password';
                            }}
                          >
                            Change Password
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              },
            ]}
          />

          {/* Footer */}
          {!editing && (
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
              <div className="flex justify-end">
                <Button onClick={onClose} className="rounded-lg">
                  Close
                </Button>
              </div>
            </div>
          )}

          {/* MFA Setup Modal */}
          <MfaSetup
            visible={showMfaSetup}
            onClose={() => setShowMfaSetup(false)}
            onSuccess={handleMfaSetupSuccess}
          />
        </div>
      ) : (
        <div className="text-center py-16 text-gray-500">
          Unable to load profile data
        </div>
      )}
    </Modal>
  );
};

// Elegant Info Card Component
const InfoCard = ({ icon, label, value, color }) => (
  <div className="group flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
    <div
      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
      style={{ backgroundColor: `${color}15`, color: color }}
    >
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</div>
      <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
        {value || <span className="text-gray-400 font-normal italic">Not provided</span>}
      </div>
    </div>
  </div>
);

export default UserProfile;
