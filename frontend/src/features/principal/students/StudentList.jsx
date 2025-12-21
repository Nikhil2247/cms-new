import React, { useEffect, useState } from 'react';
import { Button, Space, Tag, Avatar, Input, Select, Card, Modal, message } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchStudents, deleteStudent, fetchDepartments } from '../store/principalSlice';
import DataTable from '../../../components/tables/DataTable';
import { EyeOutlined, EditOutlined, UserOutlined, SearchOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { getStatusColor } from '../../../utils/format';

const { Search } = Input;
const { Option } = Select;

const StudentList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, loading, pagination } = useSelector((state) => state.principal.students);
  const departments = useSelector((state) => state.principal.departments.list);
  const [filters, setFilters] = useState({
    search: '',
    department: '',
    year: '',
    status: '',
    page: 1,
    limit: 10,
  });

  useEffect(() => {
    dispatch(fetchStudents(filters));
    dispatch(fetchDepartments());
  }, [dispatch, filters]);

  const handleView = (record) => {
    navigate(`/students/${record.id}`);
  };

  const handleEdit = (record) => {
    navigate(`/students/${record.id}/edit`);
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: 'Delete Student',
      content: `Are you sure you want to delete ${record.name}? This will deactivate their account.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await dispatch(deleteStudent(record.id)).unwrap();
          message.success('Student deleted successfully');
          dispatch(fetchStudents({ ...filters, forceRefresh: true }));
        } catch (error) {
          message.error(error || 'Failed to delete student');
        }
      },
    });
  };

  const columns = [
    {
      title: 'Student',
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
      title: 'Roll Number',
      dataIndex: 'rollNumber',
      key: 'rollNumber',
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: 'Year',
      dataIndex: 'year',
      key: 'year',
      sorter: (a, b) => a.year - b.year,
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
        <h1 className="text-2xl font-bold text-text-primary">Students</h1>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => navigate('/students/new')}
          className="rounded-lg shadow-md shadow-primary/20"
        >
          Add Student
        </Button>
      </div>

      <Card className="rounded-xl border-border shadow-sm">
        <div className="flex gap-4 flex-wrap">
          <Search
            placeholder="Search by name or roll number"
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
            placeholder="Year"
            allowClear
            className="w-full md:w-[150px]"
            onChange={(value) => handleFilterChange('year', value)}
          >
            <Option value="1">1st Year</Option>
            <Option value="2">2nd Year</Option>
            <Option value="3">3rd Year</Option>
            <Option value="4">4th Year</Option>
          </Select>
          <Select
            placeholder="Status"
            allowClear
            className="w-full md:w-[150px]"
            onChange={(value) => handleFilterChange('status', value)}
          >
            <Option value="active">Active</Option>
            <Option value="inactive">Inactive</Option>
            <Option value="graduated">Graduated</Option>
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
            showTotal: (total) => `Total ${total} students`,
          }}
        />
      </div>
    </div>
  );
};

export default StudentList;