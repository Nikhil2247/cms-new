import React, { useState, useEffect } from 'react';
import {
  Modal,
  Avatar,
  Typography,
  Descriptions,
  Button,
  Divider,
  Tag,
  Space,
  Tooltip,
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  IdcardOutlined,
  CalendarOutlined,
  BankOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';

const { Title, Text } = Typography;

const UserProfile = ({ visible, onClose }) => {
  const [user, setUser] = useState(null);
  const { darkMode } = useTheme();

  useEffect(() => {
    // Get user info from token
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
      } catch (error) {
        console.error('Failed to parse token:', error);
      }
    }

    // Also try to get more details from loginResponse
    const loginData = localStorage.getItem('loginResponse');
    if (loginData) {
      try {
        const parsed = JSON.parse(loginData);
        if (parsed?.user) {
          setUser(prev => ({ ...prev, ...parsed.user }));
        }
      } catch (error) {
        console.error('Failed to parse login data:', error);
      }
    }
  }, [visible]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getRoleColor = (role) => {
    const colors = {
      PRINCIPAL: 'purple',
      STUDENT: 'blue',
      TEACHER: 'green',
      FACULTY_SUPERVISOR: 'green',
      INDUSTRY: 'orange',
      STATE_DIRECTORATE: 'red',
      SYSTEM_ADMIN: 'magenta',
      ACCOUNTANT: 'gold',
      ADMISSION_OFFICER: 'cyan',
    };
    return colors[role] || 'default';
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <Avatar
            size={40}
            icon={<UserOutlined />}
            className="bg-primary/10 text-primary"
          />
          <div>
            <Title level={5} className="!m-0">
              User Profile
            </Title>
            <Text type="secondary" className="text-sm">
              Your account information
            </Text>
          </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={
        <div className="flex justify-between items-center">
          <Text type="secondary" className="text-xs">
            <ClockCircleOutlined className="mr-1" />
            Last login: {user?.lastLoginAt ? formatDate(user.lastLoginAt) : 'Just now'}
          </Text>
          <Button onClick={onClose} className="rounded-lg">Close</Button>
        </div>
      }
      width={520}
      centered
      className="rounded-xl overflow-hidden"
    >
      {user ? (
        <div className="py-4">
          {/* Profile Header */}
          <div
            className="flex items-center gap-4 p-4 rounded-xl mb-6 bg-background-tertiary/50 border border-border/50"
          >
            <Avatar
              size={72}
              icon={<UserOutlined />}
              src={user.profileImage || user.avatar}
              className="border-2 border-background shadow-sm"
            />
            <div className="flex-1">
              <Title level={4} className="!m-0">
                {user.name || user.email?.split('@')[0] || 'User'}
              </Title>
              <Text type="secondary">{user.email}</Text>
              <div className="mt-2">
                <Tag color={getRoleColor(user.role)} icon={<SafetyOutlined />} className="rounded-full px-3">
                  {user.role?.replace(/_/g, ' ') || 'Guest'}
                </Tag>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <Descriptions
            column={1}
            bordered
            size="small"
            className="rounded-xl overflow-hidden border-border/50"
          >
            <Descriptions.Item
              label={
                <Space className="text-text-secondary">
                  <UserOutlined />
                  Full Name
                </Space>
              }
            >
              <Text strong className="text-text-primary">{user.name || 'N/A'}</Text>
            </Descriptions.Item>

            <Descriptions.Item
              label={
                <Space className="text-text-secondary">
                  <MailOutlined />
                  Email
                </Space>
              }
            >
              <Text className="text-text-primary">{user.email || 'N/A'}</Text>
            </Descriptions.Item>

            {user.phone && (
              <Descriptions.Item
                label={
                  <Space className="text-text-secondary">
                    <PhoneOutlined />
                    Phone
                  </Space>
                }
              >
                <Text className="text-text-primary">{user.phone}</Text>
              </Descriptions.Item>
            )}

            {user.rollNumber && (
              <Descriptions.Item
                label={
                  <Space className="text-text-secondary">
                    <IdcardOutlined />
                    Roll Number
                  </Space>
                }
              >
                <Text className="text-text-primary">{user.rollNumber}</Text>
              </Descriptions.Item>
            )}

            {user.institutionName && (
              <Descriptions.Item
                label={
                  <Space className="text-text-secondary">
                    <BankOutlined />
                    Institution
                  </Space>
                }
              >
                <Text className="text-text-primary">{user.institutionName}</Text>
              </Descriptions.Item>
            )}

            {user.designation && (
              <Descriptions.Item
                label={
                  <Space className="text-text-secondary">
                    <IdcardOutlined />
                    Designation
                  </Space>
                }
              >
                <Text className="text-text-primary">{user.designation}</Text>
              </Descriptions.Item>
            )}

            <Descriptions.Item
              label={
                <Space className="text-text-secondary">
                  <SafetyOutlined />
                  Role
                </Space>
              }
            >
              <Tag color={getRoleColor(user.role)} className="rounded-md">
                {user.role?.replace(/_/g, ' ') || 'N/A'}
              </Tag>
            </Descriptions.Item>

            {user.createdAt && (
              <Descriptions.Item
                label={
                  <Space className="text-text-secondary">
                    <CalendarOutlined />
                    Member Since
                  </Space>
                }
              >
                <Text className="text-text-primary">{formatDate(user.createdAt)}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>

          {/* Account Status */}
          <div className="mt-6 p-3 rounded-xl border border-success-border bg-success-50 dark:bg-success-900/10">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <Text className="text-success-600 font-medium">Account Active</Text>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center">
          <Text type="secondary">Loading profile...</Text>
        </div>
      )}
    </Modal>
  );
};

export default UserProfile;