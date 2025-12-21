import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Card, Input, Select, message, Row, Col, Statistic } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchInternships, applyForInternship } from '../../../store/slices/studentSlice';
import { EyeOutlined, SearchOutlined, SendOutlined } from '@ant-design/icons';

const InternshipList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  const { internships, applications, loading } = useSelector(state => state.student);

  useEffect(() => {
    loadInternships();
  }, [dispatch, pagination.current, pagination.pageSize, filters]);

  const loadInternships = () => {
    dispatch(fetchInternships({
      page: pagination.current,
      limit: pagination.pageSize,
      ...filters
    }));
  };

  const handleApply = async (internshipId) => {
    try {
      await dispatch(applyForInternship(internshipId)).unwrap();
      message.success('Application submitted successfully');
      loadInternships();
    } catch (error) {
      message.error(error?.message || 'Failed to submit application');
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  const handleSearch = (value) => {
    setFilters({ ...filters, search: value });
    setPagination({ ...pagination, current: 1 });
  };

  const isApplied = (internshipId) => {
    return applications?.list?.some(app => app.internshipId === internshipId);
  };

  const getApplicationStatus = (internshipId) => {
    const application = applications?.list?.find(app => app.internshipId === internshipId);
    return application?.status;
  };

  const columns = [
    {
      title: 'Position',
      dataIndex: 'position',
      key: 'position',
      render: (text, record) => (
        <div>
          <div className="font-medium text-text-primary">{text}</div>
          <div className="text-xs text-text-secondary">{record.company?.name}</div>
        </div>
      ),
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration) => `${duration} months`,
    },
    {
      title: 'Stipend',
      dataIndex: 'stipend',
      key: 'stipend',
      render: (stipend) => stipend ? `₹${stipend.toLocaleString()}` : 'Unpaid',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={type === 'REMOTE' ? 'blue' : type === 'HYBRID' ? 'purple' : 'green'}>
          {type}
        </Tag>
      ),
    },
    {
      title: 'Deadline',
      dataIndex: 'applicationDeadline',
      key: 'applicationDeadline',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        if (isApplied(record.id)) {
          const status = getApplicationStatus(record.id);
          const colors = {
            APPLIED: 'processing',
            SHORTLISTED: 'warning',
            SELECTED: 'success',
            REJECTED: 'error'
          };
          return <Tag color={colors[status] || 'default'}>{status}</Tag>;
        }
        return <Tag>Not Applied</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/student/internships/${record.id}`)}
          >
            View Details
          </Button>
          {!isApplied(record.id) && (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => handleApply(record.id)}
              size="small"
            >
              Apply
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const stats = {
    total: internships?.total || 0,
    applied: applications?.list?.length || 0,
    selected: applications?.list?.filter(app => app.status === 'SELECTED')?.length || 0,
  };

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Available Internships" value={stats.total} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Applications Submitted" value={stats.applied} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Selected" value={stats.selected} />
          </Card>
        </Col>
      </Row>

      <Card title="Available Internships">
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Search by position or company"
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            onChange={(e) => handleSearch(e.target.value)}
            allowClear
          />
          <Select
            placeholder="Location"
            style={{ width: 150 }}
            onChange={(value) => {
              setFilters({ ...filters, location: value });
              setPagination({ ...pagination, current: 1 });
            }}
            allowClear
          >
            <Select.Option value="Remote">Remote</Select.Option>
            <Select.Option value="Bangalore">Bangalore</Select.Option>
            <Select.Option value="Mumbai">Mumbai</Select.Option>
            <Select.Option value="Delhi">Delhi</Select.Option>
            <Select.Option value="Hyderabad">Hyderabad</Select.Option>
          </Select>
          <Select
            placeholder="Type"
            style={{ width: 120 }}
            onChange={(value) => {
              setFilters({ ...filters, type: value });
              setPagination({ ...pagination, current: 1 });
            }}
            allowClear
          >
            <Select.Option value="REMOTE">Remote</Select.Option>
            <Select.Option value="ONSITE">On-site</Select.Option>
            <Select.Option value="HYBRID">Hybrid</Select.Option>
          </Select>
          <Select
            placeholder="Duration"
            style={{ width: 120 }}
            onChange={(value) => {
              setFilters({ ...filters, duration: value });
              setPagination({ ...pagination, current: 1 });
            }}
            allowClear
          >
            <Select.Option value="3">3 months</Select.Option>
            <Select.Option value="6">6 months</Select.Option>
            <Select.Option value="12">12 months</Select.Option>
          </Select>
        </Space>
        <Table
          columns={columns}
          dataSource={internships.list}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            total: internships.total,
            showTotal: (total) => `Total ${total} internships`,
            showSizeChanger: true,
          }}
          onChange={handleTableChange}
        />
      </Card>
    </div>
  );
};

export default InternshipList;