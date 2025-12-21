import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Modal,
  message,
  Space,
  Tag,
  Alert,
  Progress,
  Switch,
  Tooltip,
  Typography,
  Divider,
  Badge,
} from 'antd';
import {
  SearchOutlined,
  LockOutlined,
  ReloadOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { credentialsService } from '../../../services/credentials.service';
import { apiClient } from '../../../services/api';

const { Title, Text, Paragraph } = Typography;

const CredentialsReset = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [bulkResetModalVisible, setBulkResetModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [sendEmail, setSendEmail] = useState(true);
  const [resetProgress, setResetProgress] = useState(0);
  const [resetResults, setResetResults] = useState(null);
  const [resultsModalVisible, setResultsModalVisible] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/state/users', { params: { limit: 500 } });
      const usersData = response.data?.data || response.data || [];
      setUsers(usersData);
    } catch (error) {
      message.error('Failed to fetch users: ' + (error.response?.data?.message || error.message));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSingleReset = (user) => {
    setCurrentUser(user);
    setResetModalVisible(true);
  };

  const handleBulkReset = () => {
    const selected = users.filter(user => selectedRowKeys.includes(user.id));
    setSelectedUsers(selected);
    setBulkResetModalVisible(true);
  };

  const confirmSingleReset = async () => {
    if (!currentUser) return;

    setResetting(true);
    setResetModalVisible(false);

    try {
      const result = await credentialsService.resetUserPassword(currentUser.id);

      message.success(
        <span>
          Password reset successfully for <strong>{currentUser.name}</strong>
          {result.newPassword && (
            <div style={{ marginTop: 8, fontSize: '12px' }}>
              New password: <code>{result.newPassword}</code>
            </div>
          )}
        </span>,
        8
      );

      setResetResults({
        total: 1,
        successful: 1,
        failed: 0,
        results: [result],
        errors: [],
      });
      setResultsModalVisible(true);
      // No need to refetch users - password reset doesn't change displayed data
    } catch (error) {
      message.error('Failed to reset password: ' + (error.response?.data?.message || error.message));
    } finally {
      setResetting(false);
      setCurrentUser(null);
    }
  };

  const confirmBulkReset = async () => {
    if (!selectedUsers.length) return;

    setResetting(true);
    setBulkResetModalVisible(false);
    setResetProgress(0);

    try {
      const userIds = selectedUsers.map(user => user.id);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setResetProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 300);

      const result = await credentialsService.bulkResetPasswords(userIds);

      clearInterval(progressInterval);
      setResetProgress(100);

      setTimeout(() => {
        setResetProgress(0);
        setResetResults(result);
        setResultsModalVisible(true);
        setSelectedRowKeys([]);
        setSelectedUsers([]);

        if (result.successful > 0) {
          message.success(`Successfully reset ${result.successful} password(s)`);
        }
        if (result.failed > 0) {
          message.warning(`Failed to reset ${result.failed} password(s)`);
        }
        // No need to refetch users - password reset doesn't change displayed data
      }, 500);
    } catch (error) {
      message.error('Bulk reset failed: ' + (error.response?.data?.message || error.message));
      setResetProgress(0);
    } finally {
      setResetting(false);
    }
  };

  const downloadResults = () => {
    if (!resetResults) return;

    const csvContent = [
      ['User ID', 'Name', 'Email', 'Status', 'New Password', 'Error'],
      ...resetResults.results.map(r => [
        r.userId,
        r.name || '',
        r.email || '',
        'Success',
        r.newPassword || 'Sent via email',
        '',
      ]),
      ...resetResults.errors.map(e => [
        e.userId,
        '',
        '',
        'Failed',
        '',
        e.error || '',
      ]),
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `password-reset-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredUsers = users.filter(user =>
    !searchText ||
    user.name?.toLowerCase().includes(searchText.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchText.toLowerCase()) ||
    user.institutionId?.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <UserOutlined />
          <div>
            <div className="font-medium">{text}</div>
            <div className="text-gray-500 text-xs">{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => {
        const roleColors = {
          SYSTEM_ADMIN: 'red',
          STATE_DIRECTORATE: 'purple',
          PRINCIPAL: 'blue',
          TEACHER: 'green',
          STUDENT: 'default',
          INDUSTRY: 'orange',
        };
        return <Tag color={roleColors[role] || 'default'}>{role}</Tag>;
      },
      filters: [
        { text: 'System Admin', value: 'SYSTEM_ADMIN' },
        { text: 'State Directorate', value: 'STATE_DIRECTORATE' },
        { text: 'Principal', value: 'PRINCIPAL' },
        { text: 'Teacher', value: 'TEACHER' },
        { text: 'Student', value: 'STUDENT' },
        { text: 'Industry', value: 'INDUSTRY' },
      ],
      onFilter: (value, record) => record.role === value,
    },
    {
      title: 'Institution',
      dataIndex: 'institutionId',
      key: 'institutionId',
      render: (institutionId) => institutionId || <Text type="secondary">Not Assigned</Text>,
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      render: (date) => date ? new Date(date).toLocaleString('en-IN') : <Text type="secondary">Never</Text>,
      sorter: (a, b) => {
        if (!a.lastLoginAt) return 1;
        if (!b.lastLoginAt) return -1;
        return new Date(a.lastLoginAt) - new Date(b.lastLoginAt);
      },
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      render: (active) => (
        <Badge
          status={active ? 'success' : 'error'}
          text={active ? 'Active' : 'Inactive'}
        />
      ),
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value, record) => record.active === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Tooltip title="Reset Password">
          <Button
            type="primary"
            icon={<LockOutlined />}
            size="small"
            onClick={() => handleSingleReset(record)}
            disabled={!record.active || resetting}
          >
            Reset
          </Button>
        </Tooltip>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys) => {
      setSelectedRowKeys(selectedKeys);
    },
    getCheckboxProps: (record) => ({
      disabled: !record.active,
    }),
  };

  return (
    <div className="p-6">
      <Card
        title={
          <Space>
            <LockOutlined style={{ fontSize: '24px' }} />
            <Title level={3} style={{ margin: 0 }}>Reset User Credentials</Title>
          </Space>
        }
        extra={
          <Space>
            <Tooltip title="Refresh user list">
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchUsers}
                loading={loading}
              >
                Refresh
              </Button>
            </Tooltip>
            {selectedRowKeys.length > 0 && (
              <Badge count={selectedRowKeys.length}>
                <Button
                  type="primary"
                  danger
                  icon={<LockOutlined />}
                  onClick={handleBulkReset}
                  disabled={resetting}
                >
                  Reset Selected
                </Button>
              </Badge>
            )}
          </Space>
        }
        variant="borderless"
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            title="Password Reset Guidelines"
            description={
              <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                <li>Passwords will be automatically generated (8 characters with uppercase, lowercase, and numbers)</li>
                <li>Users will be notified via email with their new credentials</li>
                <li>Users will be forced to change password on next login</li>
                <li>All active sessions will be terminated immediately</li>
                <li>Only active users can have their passwords reset</li>
              </ul>
            }
            type="info"
            showIcon
          />

          {resetting && resetProgress > 0 && (
            <Alert
              title="Resetting Passwords..."
              description={
                <Progress
                  percent={resetProgress}
                  status={resetProgress === 100 ? 'success' : 'active'}
                />
              }
              type="info"
              showIcon
            />
          )}

          <Input.Search
            placeholder="Search by name, email, or institution..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ maxWidth: 500 }}
            allowClear
            size="large"
          />

          <Table
            columns={columns}
            dataSource={filteredUsers}
            loading={loading}
            rowKey="id"
            rowSelection={rowSelection}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users`,
              pageSizeOptions: ['10', '20', '50', '100'],
            }}
            scroll={{ x: 1200 }}
          />
        </Space>
      </Card>

      {/* Single Reset Confirmation Modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined className="text-yellow-500" />
            <span>Confirm Password Reset</span>
          </Space>
        }
        open={resetModalVisible}
        onOk={confirmSingleReset}
        onCancel={() => {
          setResetModalVisible(false);
          setCurrentUser(null);
        }}
        okText="Reset Password"
        okButtonProps={{ danger: true }}
        confirmLoading={resetting}
      >
        {currentUser && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Paragraph>
              Are you sure you want to reset the password for:
            </Paragraph>
            <Card size="small">
              <p><strong>Name:</strong> {currentUser.name}</p>
              <p><strong>Email:</strong> {currentUser.email}</p>
              <p><strong>Role:</strong> <Tag color="blue">{currentUser.role}</Tag></p>
            </Card>
            <Alert
              title="This action will:"
              description={
                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                  <li>Generate a new random password</li>
                  <li>Logout the user from all devices</li>
                  <li>Send an email notification with new credentials</li>
                  <li>Require password change on next login</li>
                </ul>
              }
              type="warning"
              showIcon
            />
            <Divider style={{ margin: '12px 0' }} />
            <Space>
              <Switch checked={sendEmail} onChange={setSendEmail} />
              <Text>Send password reset email to user</Text>
            </Space>
          </Space>
        )}
      </Modal>

      {/* Bulk Reset Confirmation Modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined className="text-yellow-500" />
            <span>Confirm Bulk Password Reset</span>
          </Space>
        }
        open={bulkResetModalVisible}
        onOk={confirmBulkReset}
        onCancel={() => {
          setBulkResetModalVisible(false);
          setSelectedUsers([]);
        }}
        okText={`Reset ${selectedUsers.length} Password(s)`}
        okButtonProps={{ danger: true }}
        confirmLoading={resetting}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            title={`You are about to reset passwords for ${selectedUsers.length} user(s)`}
            type="warning"
            showIcon
          />
          <Paragraph>
            <strong>Selected Users:</strong>
          </Paragraph>
          <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #f0f0f0', padding: 8, borderRadius: 4 }}>
            {selectedUsers.map(user => (
              <div key={user.id} style={{ padding: '4px 0' }}>
                <Tag color="blue">{user.role}</Tag> {user.name} - {user.email}
              </div>
            ))}
          </div>
          <Alert
            title="This action will:"
            description={
              <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                <li>Generate new random passwords for all selected users</li>
                <li>Logout all users from all devices</li>
                <li>Send email notifications with new credentials</li>
                <li>Require password change on next login</li>
              </ul>
            }
            type="warning"
            showIcon
          />
          <Divider style={{ margin: '12px 0' }} />
          <Space>
            <Switch checked={sendEmail} onChange={setSendEmail} />
            <Text>Send password reset emails to users</Text>
          </Space>
        </Space>
      </Modal>

      {/* Results Modal */}
      <Modal
        title={
          <Space>
            {resetResults && resetResults.failed === 0 ? (
              <CheckCircleOutlined className="text-green-500" />
            ) : (
              <ExclamationCircleOutlined className="text-yellow-500" />
            )}
            <span>Password Reset Results</span>
          </Space>
        }
        open={resultsModalVisible}
        onCancel={() => {
          setResultsModalVisible(false);
          setResetResults(null);
        }}
        footer={[
          <Button
            key="download"
            icon={<DownloadOutlined />}
            onClick={downloadResults}
          >
            Download Report
          </Button>,
          <Button
            key="close"
            type="primary"
            onClick={() => {
              setResultsModalVisible(false);
              setResetResults(null);
            }}
          >
            Close
          </Button>,
        ]}
        width={700}
      >
        {resetResults && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div style={{ display: 'flex', gap: 16 }}>
              <Card size="small" style={{ flex: 1 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold' }}>{resetResults.total}</div>
                  <div className="text-gray-500">Total</div>
                </div>
              </Card>
              <Card size="small" className="flex-1 border-green-500">
                <div style={{ textAlign: 'center' }}>
                  <div className="text-2xl font-bold text-green-500">
                    {resetResults.successful}
                  </div>
                  <div className="text-gray-500">Successful</div>
                </div>
              </Card>
              <Card size="small" className="flex-1 border-red-500">
                <div style={{ textAlign: 'center' }}>
                  <div className="text-2xl font-bold text-red-500">
                    {resetResults.failed}
                  </div>
                  <div className="text-gray-500">Failed</div>
                </div>
              </Card>
            </div>

            {resetResults.results.length > 0 && (
              <>
                <Divider plain>Successful Resets</Divider>
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  {resetResults.results.map((result, index) => (
                    <Alert
                      key={index}
                      title={
                        <Space>
                          <CheckCircleOutlined className="text-green-500" />
                          <span>{result.name} ({result.email})</span>
                        </Space>
                      }
                      description={
                        result.newPassword && (
                          <Text copyable code style={{ fontSize: 12 }}>
                            New password: {result.newPassword}
                          </Text>
                        )
                      }
                      type="success"
                      style={{ marginBottom: 8 }}
                    />
                  ))}
                </div>
              </>
            )}

            {resetResults.errors.length > 0 && (
              <>
                <Divider plain>Failed Resets</Divider>
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  {resetResults.errors.map((error, index) => (
                    <Alert
                      key={index}
                      title={
                        <Space>
                          <CloseCircleOutlined className="text-red-500" />
                          <span>User ID: {error.userId}</span>
                        </Space>
                      }
                      description={error.error}
                      type="error"
                      style={{ marginBottom: 8 }}
                    />
                  ))}
                </div>
              </>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default CredentialsReset;