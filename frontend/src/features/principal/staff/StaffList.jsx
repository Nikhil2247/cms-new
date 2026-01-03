import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Button, Tag, Avatar, Input, Select, Card, Modal, message, Dropdown } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchStaff,
  updateStaff,
  deleteStaff,
  resetUserPassword,
  optimisticallyUpdateStaff,
  optimisticallyDeleteStaff,
  rollbackStaffOperation,
} from '../store/principalSlice';
import {
  selectStaffList,
  selectStaffLoading,
  selectStaffPagination,
  selectLastFetched,
} from '../store/principalSelectors';
import DataTable from '../../../components/tables/DataTable';
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  SearchOutlined,
  PlusOutlined,
  MoreOutlined,
  CheckCircleOutlined,
  StopOutlined,
  KeyOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import ProfileAvatar from '../../../components/common/ProfileAvatar';
import StaffModal from './StaffModal';

const { Search } = Input;
const { Option } = Select;

const StaffList = () => {
  const dispatch = useDispatch();
  // Use memoized selectors from principalSelectors for better performance
  const list = useSelector(selectStaffList);
  const loading = useSelector(selectStaffLoading);
  const pagination = useSelector(selectStaffPagination);
  const lastFetchedData = useSelector(selectLastFetched);
  const lastFetched = lastFetchedData?.staff;
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    active: '',
    page: 1,
    limit: 10,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleOpenModal = (staffId = null) => {
    setEditingStaffId(staffId);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingStaffId(null);
  };

  const handleModalSuccess = () => {
    dispatch(fetchStaff({ ...filters, forceRefresh: true }));
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await dispatch(fetchStaff({ ...filters, forceRefresh: true })).unwrap();
      message.success('Data refreshed successfully');
    } catch (error) {
      message.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch, filters]);

  useEffect(() => {
    dispatch(fetchStaff(filters));
  }, [dispatch, filters]);

  const handleView = (record) => {
    handleOpenModal(record.id);
  };

  const handleEdit = (record) => {
    handleOpenModal(record.id);
  };

  const handleToggleStatus = async (record) => {
    // Staff records use 'active' boolean field
    const isCurrentlyActive = record.active === true;
    const actionText = isCurrentlyActive ? 'deactivate' : 'activate';
    const previousList = [...list];

    Modal.confirm({
      title: `${isCurrentlyActive ? 'Deactivate' : 'Activate'} Staff Member`,
      content: `Are you sure you want to ${actionText} ${record.name}?`,
      okText: isCurrentlyActive ? 'Deactivate' : 'Activate',
      okType: isCurrentlyActive ? 'danger' : 'primary',
      onOk: async () => {
        // Optimistic update - update UI immediately
        dispatch(optimisticallyUpdateStaff({ id: record.id, data: { active: !isCurrentlyActive } }));
        message.success(`Staff member ${isCurrentlyActive ? 'deactivated' : 'activated'} successfully`);

        try {
          await dispatch(updateStaff({
            id: record.id,
            data: { active: !isCurrentlyActive }
          })).unwrap();
        } catch (error) {
          // Rollback on failure
          dispatch(rollbackStaffOperation({ list: previousList }));
          message.error(error || `Failed to ${actionText} staff member`);
        }
      },
    });
  };

  const handleResetPassword = (record) => {
    Modal.confirm({
      title: 'Reset Password',
      content: `Are you sure you want to reset the password for ${record.name}? A new password will be generated.`,
      okText: 'Reset Password',
      okType: 'primary',
      onOk: async () => {
        try {
          // Staff records are User records, so record.id is the userId
          const result = await dispatch(resetUserPassword(record.id)).unwrap();
          // Show success modal with new password (if available) or email notification message
          Modal.success({
            title: 'Password Reset Successful',
            content: (
              <div className="space-y-3 mt-4">
                <p><strong>Name:</strong> {result.name || record.name}</p>
                <p><strong>Email:</strong> {result.email || record.email}</p>
                {result.newPassword ? (
                  <>
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">New Password:</p>
                      <p className="text-lg font-mono font-bold text-green-700 select-all">{result.newPassword}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Please share this password securely with the staff member. They will be required to change it on first login.
                    </p>
                  </>
                ) : (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      A new password has been generated and sent to the staff member's email address.
                      They will be required to change it on first login.
                    </p>
                  </div>
                )}
              </div>
            ),
            width: 450,
            okText: 'Close',
          });
        } catch (error) {
          message.error(error || 'Failed to reset password');
        }
      },
    });
  };

  const handleDelete = (record) => {
    const previousList = [...list];

    Modal.confirm({
      title: 'Deactivate Staff Member',
      content: `Are you sure you want to deactivate ${record.name}? They will no longer be able to access the system but their data will be preserved.`,
      okText: 'Deactivate',
      okType: 'danger',
      onOk: async () => {
        // Optimistic update - remove from active list
        dispatch(optimisticallyDeleteStaff(record.id));
        message.success('Staff member deactivated successfully');

        try {
          await dispatch(deleteStaff(record.id)).unwrap();
        } catch (error) {
          // Rollback on failure
          dispatch(rollbackStaffOperation({ list: previousList }));
          message.error(error || 'Failed to deactivate staff member');
        }
      },
    });
  };

  const getActionMenuItems = (record) => {
    const isActive = record.active === true;
    return [
      {
        key: 'view',
        label: 'View Details',
        icon: <EyeOutlined />,
        onClick: () => handleView(record),
      },
      {
        key: 'edit',
        label: 'Edit',
        icon: <EditOutlined />,
        onClick: () => handleEdit(record),
      },
      {
        type: 'divider',
      },
      {
        key: 'resetPassword',
        label: 'Reset Password',
        icon: <KeyOutlined />,
        onClick: () => handleResetPassword(record),
      },
      {
        key: 'toggle',
        label: isActive ? 'Deactivate' : 'Activate',
        icon: isActive ? <StopOutlined /> : <CheckCircleOutlined />,
        onClick: () => handleToggleStatus(record),
        danger: isActive,
      },
      {
        type: 'divider',
      },
      {
        key: 'delete',
        label: 'Deactivate',
        icon: <StopOutlined />,
        onClick: () => handleDelete(record),
        danger: true,
      },
    ];
  };

  const columns = useMemo(() => [
    {
      title: 'Staff Member',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div className="flex items-center gap-2">
          <ProfileAvatar profileImage={record.profileImage} />
          <span>{name || 'N/A'}</span>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color="blue">
          {role?.replace(/_/g, ' ') || 'N/A'}
        </Tag>
      ),
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      key: 'designation',
      render: (designation) => designation || '-',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email) => email || '-',
    },
    {
      title: 'Phone',
      dataIndex: 'phoneNo',
      key: 'phoneNo',
      render: (phone) => phone || '-',
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (active) => (
        <Tag color={active ? 'success' : 'default'}>
          {active ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_, record) => (
        <Dropdown
          menu={{ items: getActionMenuItems(record) }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button
            type="text"
            icon={<MoreOutlined style={{ fontSize: '18px' }} />}
            className="flex items-center justify-center"
          />
        </Dropdown>
      ),
    },
  ], [filters, list]);

  const handleSearch = useCallback((value) => {
    setFilters(prev => ({ ...prev, search: value, page: 1 }));
  }, []);

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value ?? '', page: 1 }));
  }, []);

  const handlePageChange = useCallback((page, pageSize) => {
    setFilters(prev => ({ ...prev, page, limit: pageSize }));
  }, []);

  return (
    <div className="p-4 md:p-6 !space-y-4 md:space-y-6 bg-background-secondary min-h-screen">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Staff Members</h1>
          {lastFetched && (
            <span className="text-xs text-text-tertiary">
              Updated {new Date(lastFetched).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            icon={<ReloadOutlined spin={isRefreshing} />}
            onClick={handleRefresh}
            loading={isRefreshing}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
            className="rounded-lg shadow-md shadow-primary/20 hover:shadow-lg transition-all"
          >
            Add Staff
          </Button>
        </div>
      </div>

      <Card className="rounded-xl border-border shadow-soft bg-surface p-4">
        <div className="flex gap-4 flex-wrap">
          <Search
            placeholder="Search by name or employee ID"
            allowClear
            onSearch={handleSearch}
            className="w-full md:w-[300px]"
            prefix={<SearchOutlined className="text-text-tertiary" />}
          />
          <Select
            placeholder="Role"
            allowClear
            className="w-full md:w-[200px]"
            onChange={(value) => handleFilterChange('role', value)}
          >
            <Option value="FACULTY_SUPERVISOR">Faculty Supervisor</Option>
            <Option value="TEACHER">Teacher</Option>
            <Option value="HOD">HOD</Option>
            <Option value="COORDINATOR">Coordinator</Option>
          </Select>
          <Select
            placeholder="Status"
            allowClear
            className="w-full md:w-[150px]"
            onChange={(value) => handleFilterChange('active', value)}
          >
            <Option value="true">Active</Option>
            <Option value="false">Inactive</Option>
          </Select>
        </div>
      </Card>

      <div className="bg-surface rounded-xl border-border shadow-soft overflow-hidden">
        <DataTable
          columns={columns}
          dataSource={list}
          loading={loading}
          rowKey="id"
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: pagination?.total || 0,
            onChange: handlePageChange,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} staff members`,
          }}
        />
      </div>

      <StaffModal
        open={modalOpen}
        onClose={handleCloseModal}
        staffId={editingStaffId}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};

export default StaffList;
