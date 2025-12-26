import React from 'react';
import { Card, Table, Tag, Button, Space, Avatar, Typography, Tooltip, Badge, Progress } from 'antd';
import {
  BankOutlined,
  EyeOutlined,
  RightOutlined,
  TeamOutlined,
  UserSwitchOutlined,
  CalendarOutlined,
  FileTextOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

const InstitutionsTable = ({ institutions, loading, onViewAll, onViewDetails, month, year }) => {
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

  // Use the pre-calculated compliance score from backend (consistent with Institution Overview)
  const getComplianceScore = (stats) => {
    if (!stats) return 0;
    // Use backend-calculated complianceScore for consistency
    return stats.complianceScore ?? 0;
  };

  const columns = [
    {
      title: 'Institution',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 240,
      render: (name, record) => (
        <div className="flex items-center gap-3">
          <Avatar
            icon={<BankOutlined />}
            className="bg-primary/10 text-primary rounded-lg"
            size="small"
          />
          <div className="min-w-0">
            <Text strong className="block text-text-primary text-sm truncate" title={name}>{name}</Text>
            <Text className="text-xs text-text-tertiary block truncate">
              {record.code || record.city}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: (
        <Tooltip title="Total active students">
          <Space size={4}>
            <TeamOutlined />
            <span>Students</span>
          </Space>
        </Tooltip>
      ),
      dataIndex: ['stats', 'totalStudents'],
      key: 'totalStudents',
      width: 100,
      align: 'center',
      render: (value) => (
        <Text strong className="text-text-primary">{value || 0}</Text>
      ),
    },
    {
      title: (
        <Tooltip title="Students with active self-identified internships">
          <Space size={4}>
            <BookOutlined />
            <span>Internships</span>
          </Space>
        </Tooltip>
      ),
      dataIndex: ['stats', 'studentsWithInternships'],
      key: 'studentsWithInternships',
      width: 120,
      align: 'center',
      render: (value, record) => {
        const total = record.stats?.totalStudents || 0;
        const percent = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
          <Tooltip title={`${percent}% of students have internships`}>
            <div className="text-center w-full px-2">
              <Text strong className="text-blue-500">{value || 0}</Text>
              <Progress
                percent={percent}
                showInfo={false}
                size="small"
                strokeColor="rgb(var(--color-primary))"
                railColor="rgba(var(--color-border), 0.5)"
                className="!m-0"
              />
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: (
        <Tooltip title="Mentor Assignments - Assigned / Unassigned">
          <Space size={4}>
            <UserSwitchOutlined />
            <span>Mentors</span>
          </Space>
        </Tooltip>
      ),
      key: 'assignments',
      width: 120,
      align: 'center',
      render: (_, record) => {
        const assigned = record.stats?.assigned || 0;
        const unassigned = record.stats?.unassigned || 0;
        const hasUnassigned = unassigned > 0;

        return (
          <Space size={4}>
            <Tag color="success" className="m-0 rounded-md border-0">
              <CheckCircleOutlined /> {assigned}
            </Tag>
            {hasUnassigned && (
              <Tooltip title={`${unassigned} students without mentors`}>
                <Tag color="warning" className="m-0 rounded-md border-0">
                  <WarningOutlined /> {unassigned}
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: (
        <Tooltip title="Faculty visits this month">
          <Space size={4}>
            <CalendarOutlined />
            <span>Visits</span>
          </Space>
        </Tooltip>
      ),
      dataIndex: ['stats', 'facultyVisits'],
      key: 'facultyVisits',
      width: 100,
      align: 'center',
      render: (value, record) => {
        const expected = record.stats?.studentsWithInternships || 0;
        const isLow = expected > 0 && value < expected;
        return (
          <Tooltip title={`${value} visits / ${expected} expected`}>
            <Badge
              count={value || 0}
              showZero
              color={isLow ? 'var(--ant-warning-color)' : 'var(--ant-success-color)'}
              overflowCount={999}
              className="font-bold"
            />
          </Tooltip>
        );
      },
    },
    {
      title: (
        <Tooltip title="Monthly Reports - Submitted / Missing">
          <Space size={4}>
            <FileTextOutlined />
            <span>Reports</span>
          </Space>
        </Tooltip>
      ),
      key: 'reports',
      width: 120,
      align: 'center',
      render: (_, record) => {
        const submitted = record.stats?.reportsSubmitted || 0;
        const missing = record.stats?.reportsMissing || 0;
        const hasMissing = missing > 0;

        return (
          <Space size={4}>
            <Tag color="success" className="m-0 rounded-md border-0">
              <CheckCircleOutlined /> {submitted}
            </Tag>
            {hasMissing && (
              <Tooltip title={`${missing} reports missing this month`}>
                <Tag color="error" className="m-0 rounded-md border-0">
                  <WarningOutlined /> {missing}
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Score',
      key: 'score',
      width: 90,
      align: 'center',
      render: (_, record) => {
        const score = getComplianceScore(record.stats);
        let color = 'rgb(var(--color-success))';
        if (score < 50) color = 'rgb(var(--color-error))';
        else if (score < 75) color = 'rgb(var(--color-warning))';

        return (
          <Tooltip title="Overall compliance score based on assignments, visits, and reports">
            <Progress
              type="circle"
              percent={score}
              size={36}
              strokeColor={color}
              format={(percent) => <span className="text-[10px] font-bold text-text-primary">{percent}%</span>}
            />
          </Tooltip>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      width: 90,
      align: 'center',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'} className="m-0 rounded-md border-0 font-bold text-[10px] uppercase tracking-wider">
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 50,
      fixed: 'right',
      render: (_, record) => (
        <Tooltip title="View Details">
          <Button
            type="text"
            icon={<EyeOutlined className="text-text-tertiary hover:text-primary" />}
            size="small"
            onClick={() => onViewDetails?.(record) || navigate(`/institutions-overview?id=${record.id}`)}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-background-tertiary"
          />
        </Tooltip>
      ),
    },
  ];

  const monthName = month ? new Date(2024, month - 1, 1).toLocaleString('default', { month: 'long' }) : '';

  return (
    <Card
      title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <BankOutlined className="text-primary text-lg" />
          </div>
          <span className="font-bold text-text-primary text-lg">Institution Performance</span>
          {month && year && (
            <Tag color="blue" className="ml-2 rounded-md border-0 font-medium">
              {monthName} {year}
            </Tag>
          )}
        </div>
      }
      extra={
        <Button
          type="link"
          onClick={onViewAll || (() => navigate('/institutions'))}
          className="flex items-center gap-1 font-bold text-sm px-0"
        >
          View All <RightOutlined className="text-xs" />
        </Button>
      }
      className="shadow-sm h-full border-border rounded-2xl bg-surface"
      styles={{ 
        header: { borderBottom: '1px solid var(--color-border)', padding: '20px 24px' }, 
        body: { padding: 0 } 
      }}
    >
      <Table
        columns={columns}
        dataSource={institutions}
        loading={loading}
        pagination={false}
        size="middle"
        rowKey="id"
        scroll={{ x: 1100 }}
        className="custom-table"
      />
    </Card>
  );
};

export default InstitutionsTable;
