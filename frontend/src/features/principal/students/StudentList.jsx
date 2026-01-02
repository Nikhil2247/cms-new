import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Button, Tag, Avatar, Input, Select, Card, Dropdown, Modal, message } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchStudents,
  updateStudent,
  deleteStudent,
  resetUserPassword,
  optimisticallyUpdateStudent,
  optimisticallyDeleteStudent,
  rollbackStudentOperation,
} from '../store/principalSlice';
import {
  selectStudentsList,
  selectStudentsLoading,
  selectStudentsPagination,
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
import { getStatusColor } from '../../../utils/format';
import ProfileAvatar from '../../../components/common/ProfileAvatar';
import StudentModal from './StudentModal';
import { useLookup } from '../../shared/hooks/useLookup';

const { Search } = Input;
const { Option } = Select;

const StudentList = () => {
  const dispatch = useDispatch();
  // Use memoized selectors from principalSelectors for better performance
  const list = useSelector(selectStudentsList);
  const loading = useSelector(selectStudentsLoading);
  const pagination = useSelector(selectStudentsPagination);
  const lastFetchedData = useSelector(selectLastFetched);
  const lastFetched = lastFetchedData?.students;

  // Use global lookup data
  const { activeBranches, activeBatches, loadBranches, loadBatches } = useLookup({
    include: ['branches', 'batches']
  });

  // Deduplicate branches by id to avoid duplicate filter options
  const uniqueBranches = useMemo(() => {
    if (!activeBranches) return [];
    const seen = new Set();
    return activeBranches.filter(branch => {
      if (seen.has(branch.id)) return false;
      seen.add(branch.id);
      return true;
    });
  }, [activeBranches]);

  // Deduplicate batches by id
  const uniqueBatches = useMemo(() => {
    if (!activeBatches) return [];
    const seen = new Set();
    return activeBatches.filter(batch => {
      if (seen.has(batch.id)) return false;
      seen.add(batch.id);
      return true;
    });
  }, [activeBatches]);

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    branchId: '',
    batchId: '',
    isActive: '',
    page: 1,
    limit: 10,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleOpenModal = (studentId = null) => {
    setEditingStudentId(studentId);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingStudentId(null);
  };

  const handleModalSuccess = () => {
    dispatch(fetchStudents({ ...filters, forceRefresh: true }));
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await dispatch(fetchStudents({ ...filters, forceRefresh: true })).unwrap();
      // Refresh lookup data
      loadBranches();
      loadBatches();
      message.success('Data refreshed successfully');
    } catch (error) {
      message.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch, filters, loadBranches, loadBatches]);

  // Debounced search effect - 300ms delay
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput, page: 1 }));
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    dispatch(fetchStudents(filters));
  }, [dispatch, filters]);

  const handleView = (record) => {
    handleOpenModal(record.id);
  };

  const handleEdit = (record) => {
    handleOpenModal(record.id);
  };

  const handleToggleStatus = async (record) => {
    const newStatus = !record.isActive;
    const actionText = newStatus ? 'activate' : 'deactivate';
    const previousList = [...list];

    Modal.confirm({
      title: `${newStatus ? 'Activate' : 'Deactivate'} Student`,
      content: `Are you sure you want to ${actionText} ${record.name}?`,
      okText: newStatus ? 'Activate' : 'Deactivate',
      okType: newStatus ? 'primary' : 'danger',
      onOk: async () => {
        // Optimistic update - update UI immediately
        dispatch(optimisticallyUpdateStudent({ id: record.id, data: { isActive: newStatus } }));
        message.success(`Student ${newStatus ? 'activated' : 'deactivated'} successfully`);

        try {
          await dispatch(updateStudent({
            id: record.id,
            data: { isActive: newStatus }
          })).unwrap();
        } catch (error) {
          // Rollback on failure
          dispatch(rollbackStudentOperation({ list: previousList }));
          message.error(error || `Failed to ${actionText} student`);
        }
      },
    });
  };

  const handleResetPassword = (record) => {
    const userId = record.user?.id;
    if (!userId) {
      message.error('User account not found for this student');
      return;
    }

    Modal.confirm({
      title: 'Reset Password',
      content: `Are you sure you want to reset the password for ${record.name}? A new password will be generated.`,
      okText: 'Reset Password',
      okType: 'primary',
      onOk: async () => {
        try {
          const result = await dispatch(resetUserPassword(userId)).unwrap();
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
                      Please share this password securely with the student. They will be required to change it on first login.
                    </p>
                  </>
                ) : (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      A new password has been generated and sent to the student's email address.
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
      title: 'Deactivate Student',
      content: `Are you sure you want to deactivate ${record.name}? The student will no longer be able to access the system but their data will be preserved.`,
      okText: 'Deactivate',
      okType: 'danger',
      onOk: async () => {
        // Optimistic update - remove from active list
        dispatch(optimisticallyDeleteStudent(record.id));
        message.success('Student deactivated successfully');

        try {
          await dispatch(deleteStudent(record.id)).unwrap();
        } catch (error) {
          // Rollback on failure
          dispatch(rollbackStudentOperation({ list: previousList }));
          message.error(error || 'Failed to deactivate student');
        }
      },
    });
  };

  const getActionMenuItems = (record) => [
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
      label: record.isActive ? 'Deactivate' : 'Activate',
      icon: record.isActive ? <StopOutlined /> : <CheckCircleOutlined />,
      onClick: () => handleToggleStatus(record),
      danger: record.isActive,
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

  // Memoized columns definition
  const columns = useMemo(() => [
    {
      title: 'Student',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div className="flex items-center gap-2">
          <ProfileAvatar profileImage={record.profileImage} />
          <div>
            <div className="font-medium">{name}</div>
            <div className="text-xs text-text-tertiary">{record.rollNumber}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'branchName',
      key: 'branchName',
      render: (branchName, record) => branchName || record.branch?.name || '-',
    },
    {
      title: 'Batch',
      dataIndex: 'batchName',
      key: 'batchName',
      render: (batchName, record) => batchName || record.batch?.name || '-',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? 'Active' : 'Inactive'}
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
    setSearchInput(value);
  }, []);

  const handleFilterChange = useCallback((key, value) => {
    // Convert undefined to empty string (Select allowClear passes undefined)
    setFilters(prev => ({ ...prev, [key]: value ?? '', page: 1 }));
  }, []);

  const handlePageChange = useCallback((page, pageSize) => {
    setFilters(prev => ({ ...prev, page, limit: pageSize }));
  }, []);

  return (
    <div className="p-6 !space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-text-primary">Students</h1>
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
            className="rounded-lg shadow-md shadow-primary/20"
          >
            Add Student
          </Button>
        </div>
      </div>

      <Card className="rounded-xl border-border shadow-sm">
        <div className="flex gap-4 flex-wrap">
          <Search
            placeholder="Search by name or roll number"
            allowClear
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleSearch}
            className="w-full md:w-[300px]"
            prefix={<SearchOutlined className="text-text-tertiary" />}
          />
          <Select
            placeholder="Branch"
            allowClear
            className="w-full md:w-[200px]"
            onChange={(value) => handleFilterChange('branchId', value)}
          >
            {uniqueBranches.map(branch => (
              <Option key={branch.id} value={branch.id}>{branch.name}</Option>
            ))}
          </Select>
          <Select
            placeholder="Batch/Year"
            allowClear
            className="w-full md:w-[150px]"
            onChange={(value) => handleFilterChange('batchId', value)}
          >
            {uniqueBatches.map(batch => (
              <Option key={batch.id} value={batch.id}>{batch.name}</Option>
            ))}
          </Select>
          <Select
            placeholder="Status"
            allowClear
            className="w-full md:w-[150px]"
            onChange={(value) => handleFilterChange('isActive', value)}
          >
            <Option value="true">Active</Option>
            <Option value="false">Inactive</Option>
          </Select>
        </div>
      </Card>

      <div className="bg-background rounded-xl  border-border shadow-sm overflow-hidden">
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
            showTotal: (total) => `Total ${total} students`,
          }}
        />
      </div>

      <StudentModal
        open={modalOpen}
        onClose={handleCloseModal}
        studentId={editingStudentId}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};

export default StudentList;
