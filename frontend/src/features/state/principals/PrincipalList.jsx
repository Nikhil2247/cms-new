import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, Table, Button, Tag, Space, Modal, message, Input, Avatar, Dropdown, App } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UserOutlined, ReloadOutlined, MoreOutlined, KeyOutlined } from '@ant-design/icons';
import { fetchPrincipals, deletePrincipal, resetPrincipalPassword } from '../store/stateSlice';

const PrincipalList = () => {
  const { modal } = App.useApp();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { list: principals, loading, pagination } = useSelector((state) => state.state.principals);
  const [searchText, setSearchText] = useState('');
  const [tableParams, setTableParams] = useState({
    page: 1,
    limit: 10,
  });

  const loadPrincipals = useCallback((params = {}) => {
    dispatch(fetchPrincipals({
      page: tableParams.page,
      limit: tableParams.limit,
      ...params,
    }));
  }, [dispatch, tableParams.page, tableParams.limit]);

  useEffect(() => {
    // Check if we're returning from an edit/create with a state flag
    if (location.state?.refresh) {
      loadPrincipals({ forceRefresh: true });
      // Clear the state to prevent unnecessary refreshes
      window.history.replaceState({}, document.title);
    } else {
      loadPrincipals();
    }
  }, []);

  const handleDelete = (id, name) => {
    modal.confirm({
      title: 'Delete Principal',
      content: `Are you sure you want to delete ${name}? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await dispatch(deletePrincipal(id)).unwrap();
          message.success('Principal deleted successfully');
          loadPrincipals({ forceRefresh: true });
        } catch (error) {
          message.error(error?.message || 'Failed to delete principal');
          throw error; // Re-throw to prevent modal from closing
        }
      },
    });
  };

  const handleResetPassword = (id, name, email) => {
    modal.confirm({
      title: 'Reset Password',
      content: (
        <div>
          <p>Are you sure you want to reset password for <strong>{name}</strong>?</p>
          <p className="text-gray-500 text-sm">A new password will be generated.</p>
        </div>
      ),
      okText: 'Reset Password',
      okType: 'primary',
      onOk: async () => {
        try {
          const result = await dispatch(resetPrincipalPassword(id)).unwrap();
          message.success('Password reset successfully');
          modal.success({
            title: 'Password Reset Successful',
            content: (
              <div>
                <p>New password has been generated:</p>
                <p className="font-mono bg-gray-100 p-2 rounded my-2 select-all">{result.newPassword}</p>
                <p className="text-sm text-gray-500">Please share this password securely with the principal.</p>
              </div>
            ),
            width: 500,
          });
        } catch (error) {
          console.error('Reset password error:', error);
          message.error(error?.message || 'Failed to reset password');
          throw error; // Re-throw to prevent modal from closing on error
        }
      },
    });
  };

  const principalsList = Array.isArray(principals) ? principals : [];

  // Handle search with debounce
  const handleSearch = (value) => {
    setSearchText(value);
    setTableParams(prev => ({ ...prev, page: 1 }));
    loadPrincipals({ search: value, page: 1 });
  };

  // Handle table change (pagination)
  const handleTableChange = (paginationConfig) => {
    const newParams = {
      page: paginationConfig.current,
      limit: paginationConfig.pageSize,
    };
    setTableParams(newParams);
    loadPrincipals({ ...newParams, search: searchText });
  };

  const columns = [
    {
      title: 'Principal',
      key: 'principal',
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} src={record.profileImage} />
          <div>
            <div className="font-medium">{record.name}</div>
            <div className="text-gray-500 text-xs">{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phoneNo',
      key: 'phoneNo',
      render: (text) => text || 'N/A',
    },
    {
      title: 'Institution',
      key: 'institution',
      render: (_, record) => record.Institution?.name || 'Not Assigned',
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      key: 'designation',
      render: (text) => text || 'Principal',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => date ? new Date(date).toLocaleDateString('en-IN') : 'N/A',
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'status',
      render: (active) => (
        <Tag color={active !== false ? 'green' : 'red'}>
          {active !== false ? 'Active' : 'Inactive'}
        </Tag>
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
      width: 80,
      align: 'center',
      render: (_, record) => {
        const handleMenuClick = ({ key }) => {
          switch (key) {
            case 'edit':
              navigate(`/principals/${record.id}/edit`);
              break;
            case 'reset-password':
              handleResetPassword(record.id, record.name, record.email);
              break;
            case 'delete':
              handleDelete(record.id, record.name);
              break;
            default:
          }
        };

        const menuItems = [
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: 'Edit',
          },
          {
            key: 'reset-password',
            icon: <KeyOutlined />,
            label: 'Reset Password',
          },
          {
            type: 'divider',
          },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: 'Delete',
            danger: true,
          },
        ];

        return (
          <Dropdown
            menu={{ items: menuItems, onClick: handleMenuClick }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="text"
              icon={<MoreOutlined />}
              size="small"
            />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <div className="p-6">
      <Card
        title="Principals"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadPrincipals({ forceRefresh: true })}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/principals/new')}
            >
              Add Principal
            </Button>
          </Space>
        }
        variant="borderless"
      >
        <Input.Search
          placeholder="Search by name or email..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={handleSearch}
          style={{ width: 300, marginBottom: 16 }}
          allowClear
          enterButton
        />

        <Table
          columns={columns}
          dataSource={principalsList}
          loading={loading}
          rowKey="id"
          onChange={handleTableChange}
          pagination={{
            current: pagination?.page || tableParams.page,
            pageSize: pagination?.limit || tableParams.limit,
            total: pagination?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} principals`,
          }}
        />
      </Card>
    </div>
  );
};

export default PrincipalList;