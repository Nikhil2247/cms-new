import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Table, Button, Tag, Space, message, Input, Avatar, Dropdown, App, Select, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UserOutlined, ReloadOutlined, MoreOutlined, KeyOutlined, FilterOutlined, ClearOutlined } from '@ant-design/icons';
import { fetchStaff, deleteStaff, resetStaffPassword } from '../store/stateSlice';
import StaffModal from './StaffModal';
import { getImageUrl } from '../../../utils/imageUtils';
import { useInstitutions } from '../../shared/hooks/useLookup';

const StaffList = () => {
  const { modal } = App.useApp();
  const dispatch = useDispatch();
  const { list: staff, loading, pagination } = useSelector((state) => state.state.staff);

  // Use global lookup data for institutions
  const { activeInstitutions } = useInstitutions();

  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({
    institutionId: '',
    role: '',
    branchName: '',
    active: '',
  });
  const [tableParams, setTableParams] = useState({
    page: 1,
    limit: 10,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);

  const loadStaff = useCallback((params = {}) => {
    dispatch(fetchStaff({
      page: tableParams.page,
      limit: tableParams.limit,
      search: searchText,
      ...filters,
      ...params,
    }));
  }, [dispatch, tableParams.page, tableParams.limit, searchText, filters]);

  // Institutions are automatically loaded by useInstitutions hook

  useEffect(() => {
    loadStaff();
  }, []);

  const handleOpenModal = (staffId = null) => {
    setEditingStaffId(staffId);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingStaffId(null);
  };

  const handleModalSuccess = () => {
    loadStaff({ forceRefresh: true });
  };

  const handleDelete = (id, name) => {
    modal.confirm({
      title: 'Delete Staff Member',
      content: `Are you sure you want to delete ${name}? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await dispatch(deleteStaff(id)).unwrap();
          message.success('Staff member deleted successfully');
          loadStaff({ forceRefresh: true });
        } catch (error) {
          message.error(error?.message || 'Failed to delete staff member');
          throw error;
        }
      },
    });
  };

  const handleResetPassword = (id, name) => {
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
          const result = await dispatch(resetStaffPassword(id)).unwrap();
          message.success('Password reset successfully');
          modal.success({
            title: 'Password Reset Successful',
            content: (
              <div>
                <p>New password has been generated:</p>
                <p className="font-mono bg-gray-100 p-2 rounded my-2 select-all">{result.newPassword}</p>
                <p className="text-sm text-gray-500">Please share this password securely with the staff member.</p>
              </div>
            ),
            width: 500,
          });
        } catch (error) {
          message.error(error?.message || 'Failed to reset password');
          throw error;
        }
      },
    });
  };

  const staffList = Array.isArray(staff) ? staff : [];

  // Handle search
  const handleSearch = (value) => {
    setSearchText(value);
    setTableParams(prev => ({ ...prev, page: 1 }));
    loadStaff({ search: value, page: 1 });
  };

  // Handle filter change
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Apply filters
  const applyFilters = () => {
    setTableParams(prev => ({ ...prev, page: 1 }));
    loadStaff({ ...filters, page: 1 });
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      institutionId: '',
      role: '',
      branchName: '',
      active: '',
    });
    setSearchText('');
    setTableParams(prev => ({ ...prev, page: 1 }));
    loadStaff({ forceRefresh: true, page: 1 });
  };

  // Handle table change (pagination)
  const handleTableChange = (paginationConfig) => {
    const newParams = {
      page: paginationConfig.current,
      limit: paginationConfig.pageSize,
    };
    setTableParams(newParams);
    loadStaff({ ...newParams, search: searchText, ...filters });
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'TEACHER': return 'blue';
      case 'FACULTY_SUPERVISOR': return 'green';
      case 'PLACEMENT_OFFICER': return 'purple';
      case 'ACCOUNTANT': return 'orange';
      case 'ADMISSION_OFFICER': return 'cyan';
      case 'EXAMINATION_OFFICER': return 'magenta';
      case 'PMS_OFFICER': return 'geekblue';
      case 'EXTRACURRICULAR_HEAD': return 'volcano';
      default: return 'default';
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      TEACHER: 'Teacher',
      FACULTY_SUPERVISOR: 'Faculty Supervisor',
      PLACEMENT_OFFICER: 'Placement Officer',
      ACCOUNTANT: 'Accountant',
      ADMISSION_OFFICER: 'Admission Officer',
      EXAMINATION_OFFICER: 'Examination Officer',
      PMS_OFFICER: 'PMS Officer',
      EXTRACURRICULAR_HEAD: 'Extracurricular Head',
    };
    return labels[role] || role;
  };

  const columns = [
    {
      title: 'Staff Member',
      key: 'staff',
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} src={getImageUrl(record.profileImage)} />
          <div>
            <div className="font-medium">{record.name}</div>
            <div className="text-gray-500 text-xs">{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={getRoleColor(role)}>
          {getRoleLabel(role)}
        </Tag>
      ),
    },
    {
      title: 'Institution',
      key: 'institution',
      render: (_, record) => record.Institution?.name || 'Not Assigned',
    },
    {
      title: 'Branch',
      dataIndex: 'branchName',
      key: 'branchName',
      render: (text) => text || '-',
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      key: 'designation',
      render: (text) => text || '-',
    },
    {
      title: 'Phone',
      dataIndex: 'phoneNo',
      key: 'phoneNo',
      render: (text) => text || 'N/A',
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
              handleOpenModal(record.id);
              break;
            case 'reset-password':
              handleResetPassword(record.id, record.name);
              break;
            case 'delete':
              handleDelete(record.id, record.name);
              break;
            default:
              break;
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
        title="Staff Management"
        extra={
          <Space>
            <Button
              icon={<FilterOutlined />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadStaff({ forceRefresh: true })}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleOpenModal()}
            >
              Add Staff
            </Button>
          </Space>
        }
        variant="borderless"
      >
        {/* Search and Filters */}
        <div className="mb-4">
          <Input.Search
            placeholder="Search by name, email, or designation..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 300 }}
            allowClear
            enterButton
          />
        </div>

        {showFilters && (
          <div className="mb-4 p-4 bg-gray-50 rounded">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="Institution"
                  style={{ width: '100%' }}
                  allowClear
                  value={filters.institutionId || undefined}
                  onChange={(value) => handleFilterChange('institutionId', value || '')}
                  showSearch
                  optionFilterProp="children"
                >
                  {activeInstitutions?.map(inst => (
                    <Select.Option key={inst.id} value={inst.id}>
                      {inst.name}
                    </Select.Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="Role"
                  style={{ width: '100%' }}
                  allowClear
                  value={filters.role || undefined}
                  onChange={(value) => handleFilterChange('role', value || '')}
                >
                  <Select.Option value="TEACHER">Teacher</Select.Option>
                  <Select.Option value="FACULTY_SUPERVISOR">Faculty Supervisor</Select.Option>
                  <Select.Option value="PLACEMENT_OFFICER">Placement Officer</Select.Option>
                  <Select.Option value="ACCOUNTANT">Accountant</Select.Option>
                  <Select.Option value="ADMISSION_OFFICER">Admission Officer</Select.Option>
                  <Select.Option value="EXAMINATION_OFFICER">Examination Officer</Select.Option>
                  <Select.Option value="PMS_OFFICER">PMS Officer</Select.Option>
                  <Select.Option value="EXTRACURRICULAR_HEAD">Extracurricular Head</Select.Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Input
                  placeholder="Branch"
                  value={filters.branchName}
                  onChange={(e) => handleFilterChange('branchName', e.target.value)}
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="Status"
                  style={{ width: '100%' }}
                  allowClear
                  value={filters.active || undefined}
                  onChange={(value) => handleFilterChange('active', value || '')}
                >
                  <Select.Option value="true">Active</Select.Option>
                  <Select.Option value="false">Inactive</Select.Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Space>
                  <Button type="primary" onClick={applyFilters}>
                    Apply Filters
                  </Button>
                  <Button icon={<ClearOutlined />} onClick={clearFilters}>
                    Clear
                  </Button>
                </Space>
              </Col>
            </Row>
          </div>
        )}

        <Table
          columns={columns}
          dataSource={staffList}
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
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} staff members`,
          }}
        />
      </Card>

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
