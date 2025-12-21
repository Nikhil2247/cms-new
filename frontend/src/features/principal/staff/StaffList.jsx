import React, { useEffect, useState } from 'react';
import { Button, Space, Tag, Avatar, Input, Select, Card, Modal, message } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchStaff, deleteStaff, fetchDepartments } from '../store/principalSlice';
import DataTable from '../../../components/tables/DataTable';
import { EyeOutlined, EditOutlined, UserOutlined, SearchOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { getStatusColor } from '../../../utils/format';

const { Search } = Input;
const { Option } = Select;

const StaffList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, loading, pagination } = useSelector((state) => state.principal.staff);
  const departments = useSelector((state) => state.principal.departments.list);
  const [filters, setFilters] = useState({
    search: '',
    department: '',
    designation: '',
    status: '',
    page: 1,
    limit: 10,
  });

  useEffect(() => {
    dispatch(fetchStaff(filters));
    dispatch(fetchDepartments());
  }, [dispatch, filters]);

  const handleView = (record) => {
    navigate(`/staff/${record.id}`);
  };

  const handleEdit = (record) => {
    navigate(`/staff/${record.id}/edit`);
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: 'Delete Staff Member',
      content: `Are you sure you want to delete ${record.name}? This will deactivate their account.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await dispatch(deleteStaff(record.id)).unwrap();
          message.success('Staff member deleted successfully');
          dispatch(fetchStaff({ ...filters, forceRefresh: true }));
        } catch (error) {
          message.error(error || 'Failed to delete staff member');
        }
      },
    });
  };

  const columns = [
    {
      title: 'Staff Member',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div className="flex items-center gap-2">
          <Avatar icon={<UserOutlined />} src={record.avatar} />
          <span>{name}</span>
        </div>
      ),
    },
    {
      title: 'Employee ID',
      dataIndex: 'employeeId',
      key: 'employeeId',
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      key: 'designation',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {status?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            View
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  const handleSearch = (value) => {
    setFilters({ ...filters, search: value, page: 1 });
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value, page: 1 });
  };

  const handlePageChange = (page, pageSize) => {
    setFilters({ ...filters, page, limit: pageSize });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-text-primary">Staff Members</h1>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => navigate('/staff/new')}
          className="rounded-lg shadow-md shadow-primary/20"
        >
          Add Staff
        </Button>
      </div>

      <Card className="rounded-xl border-border shadow-sm">
        <div className="flex gap-4 flex-wrap">
          <Search
            placeholder="Search by name or employee ID"
            allowClear
            onSearch={handleSearch}
            className="w-full md:w-[300px]"
            prefix={<SearchOutlined className="text-text-tertiary" />}
          />
          <Select
            placeholder="Department"
            allowClear
            className="w-full md:w-[200px]"
            onChange={(value) => handleFilterChange('department', value)}
          >
            {departments?.map(dept => (
              <Option key={dept.id} value={dept.id}>{dept.name}</Option>
            ))}
          </Select>
          <Select
            placeholder="Designation"
            allowClear
            className="w-full md:w-[200px]"
            onChange={(value) => handleFilterChange('designation', value)}
          >
            <Option value="Professor">Professor</Option>
            <Option value="Associate Professor">Associate Professor</Option>
            <Option value="Assistant Professor">Assistant Professor</Option>
            <Option value="Lecturer">Lecturer</Option>
          </Select>
          <Select
            placeholder="Status"
            allowClear
            className="w-full md:w-[150px]"
            onChange={(value) => handleFilterChange('status', value)}
          >
            <Option value="active">Active</Option>
            <Option value="inactive">Inactive</Option>
            <Option value="on_leave">On Leave</Option>
          </Select>
        </div>
      </Card>

      <div className="bg-background rounded-xl border border-border shadow-sm overflow-hidden">
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
    </div>
  );
};

export default StaffList;