import React from 'react';
import { Card, Table, Tag, Button, Space, Avatar, Typography, Tooltip, Badge } from 'antd';
import {
  BankOutlined,
  EyeOutlined,
  RightOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

const InstitutionsTable = ({ institutions, loading, onViewAll, onViewDetails }) => {
  const navigate = useNavigate();

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'red';
      case 'pending':
        return 'orange';
      default:
        return 'blue';
    }
  };

  const columns = [
    {
      title: 'Institution',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div className="flex items-center gap-3">
          <Avatar
            icon={<BankOutlined />}
            className="bg-primary"
            src={record.logo}
          />
          <div>
            <Text strong className="block text-slate-900">{name}</Text>
            <Text className="text-xs text-slate-500">
              {record.shortName || record.code || record.city}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Students',
      dataIndex: 'studentsCount',
      key: 'studentsCount',
      width: 100,
      render: (count, record) => {
        const value = record?._count?.Student ?? count ?? 0;
        return (
        <Tooltip title="Total Students">
          <Space>
            <TeamOutlined className="text-primary" />
            <span>{value || 0}</span>
          </Space>
        </Tooltip>
        );
      },
    },
    {
      title: 'Faculty',
      dataIndex: 'facultyCount',
      key: 'facultyCount',
      width: 100,
      render: (count, record) => {
        const value = record?.facultyCount ?? record?._count?.users ?? count ?? 0;
        return (
        <Tooltip title="Total Faculty">
          <Space>
            <UserOutlined className="text-success" />
            <span>{value || 0}</span>
          </Space>
        </Tooltip>
        );
      },
    },
    {
      title: 'Placement',
      dataIndex: 'placementRate',
      key: 'placementRate',
      width: 100,
      render: (rate) => {
        const value = Number.isFinite(Number(rate)) ? Number(rate) : 0;
        return (
          <Badge
            status={value >= 70 ? 'success' : value >= 40 ? 'warning' : 'error'}
            text={`${value}%`}
          />
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status, record) => {
        const derivedStatus = status || (record?.isActive ? 'ACTIVE' : 'INACTIVE');
        return (
          <Tag color={getStatusColor(derivedStatus)}>
            {String(derivedStatus).toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_, record) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          onClick={() => onViewDetails?.(record) || navigate(`/institutions/${record.id}/edit`)}
        />
      ),
    },
  ];

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <BankOutlined className="text-primary" />
          <span>Recent Institutions</span>
        </div>
      }
      extra={
        <Button
          type="link"
          onClick={onViewAll || (() => navigate('/institutions'))}
        >
          View All <RightOutlined />
        </Button>
      }
      className="shadow-sm h-full"
      styles={{ body: { padding: 0 } }}
    >
      <Table
        columns={columns}
        dataSource={institutions}
        loading={loading}
        pagination={false}
        size="middle"
        rowKey="id"
        scroll={{ x: 500 }}
      />
    </Card>
  );
};

export default InstitutionsTable;