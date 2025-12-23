import React, { useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Table,
  Typography,
  Tag,
  Spin,
  Empty,
  Tooltip,
  Row,
  Col,
  Avatar,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  EyeOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import {
  fetchFacultyWorkload,
  selectFacultyWorkload,
  selectFacultyWorkloadLoading,
} from '../../store/principalSlice';

const { Text, Title } = Typography;

// Load threshold constants
const LOAD_THRESHOLDS = {
  LIGHT_MAX: 5,
  OPTIMAL_MAX: 15,
  UNDERUTILIZED_MIN: 1,
  UNDERUTILIZED_MAX: 3,
};

const FacultyWorkloadCard = () => {
  const dispatch = useDispatch();
  const faculty = useSelector(selectFacultyWorkload);
  const loading = useSelector(selectFacultyWorkloadLoading);

  useEffect(() => {
    dispatch(fetchFacultyWorkload());
  }, [dispatch]);

  // Memoized summary stats - prevents recalculation on every render
  const { totalFaculty, totalAssigned, totalVisits, overloadedCount } = useMemo(() => ({
    totalFaculty: faculty.length,
    totalAssigned: faculty.reduce((sum, f) => sum + (f.assignedCount || 0), 0),
    totalVisits: faculty.reduce((sum, f) => sum + (f.totalVisits || 0), 0),
    overloadedCount: faculty.filter((f) => (f.assignedCount || 0) > LOAD_THRESHOLDS.OPTIMAL_MAX).length,
  }), [faculty]);

  // Memoized load status function
  const getLoadStatus = useCallback((assignedCount) => {
    if (assignedCount === 0) return { color: 'default', text: 'Unassigned', icon: <WarningOutlined /> };
    if (assignedCount <= LOAD_THRESHOLDS.LIGHT_MAX) return { color: 'green', text: 'Light', icon: <CheckCircleOutlined /> };
    if (assignedCount <= LOAD_THRESHOLDS.OPTIMAL_MAX) return { color: 'blue', text: 'Optimal', icon: <CheckCircleOutlined /> };
    return { color: 'red', text: 'Heavy', icon: <WarningOutlined /> };
  }, []);

  const columns = [
    {
      title: 'Faculty',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="flex items-center gap-2">
          <Avatar size="small" icon={<UserOutlined />} className="bg-blue-500" />
          <div>
            <div className="font-medium text-sm">{text}</div>
            <div className="text-xs text-gray-500">{record.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Students',
      dataIndex: 'assignedCount',
      key: 'assignedCount',
      width: 100,
      align: 'center',
      render: (count) => (
        <Tooltip title={`${count} students assigned`}>
          <div className="flex items-center justify-center gap-1">
            <TeamOutlined className="text-blue-500" />
            <span className="font-semibold">{count || 0}</span>
          </div>
        </Tooltip>
      ),
      sorter: (a, b) => (a.assignedCount || 0) - (b.assignedCount || 0),
    },
    {
      title: 'Visits',
      dataIndex: 'totalVisits',
      key: 'totalVisits',
      width: 100,
      align: 'center',
      render: (count) => (
        <Tooltip title={`${count} total visits`}>
          <div className="flex items-center justify-center gap-1">
            <EyeOutlined className="text-green-500" />
            <span className="font-semibold">{count || 0}</span>
          </div>
        </Tooltip>
      ),
      sorter: (a, b) => (a.totalVisits || 0) - (b.totalVisits || 0),
    },
    {
      title: 'Load',
      key: 'load',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const status = getLoadStatus(record.assignedCount || 0);
        return (
          <Tag color={status.color} icon={status.icon}>
            {status.text}
          </Tag>
        );
      },
    },
  ];

  if (loading && faculty.length === 0) {
    return (
      <Card className="h-full">
        <div className="flex justify-center items-center h-48">
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <TeamOutlined className="text-indigo-500" />
          <span>Faculty Workload</span>
        </div>
      }
      className="border-border shadow-sm rounded-xl"
      styles={{ body: { padding: '16px' } }}
    >
      {/* Summary Stats */}
      <Row gutter={[16, 16]} className="mb-4">
        <Col span={6}>
          <div className="text-center p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
            <div className="text-xl font-bold text-indigo-600">{totalFaculty}</div>
            <div className="text-xs text-gray-500 uppercase font-semibold">Faculty</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-xl font-bold text-blue-600">{totalAssigned}</div>
            <div className="text-xs text-gray-500 uppercase font-semibold">Assigned</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-xl font-bold text-green-600">{totalVisits}</div>
            <div className="text-xs text-gray-500 uppercase font-semibold">Visits</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-xl font-bold text-red-600">{overloadedCount}</div>
            <div className="text-xs text-gray-500 uppercase font-semibold">Overloaded</div>
          </div>
        </Col>
      </Row>

      {/* Faculty Table */}
      {faculty.length > 0 ? (
        <Table
          dataSource={faculty}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 5, showSizeChanger: false }}
          scroll={{ x: 'max-content' }}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No faculty data available"
        />
      )}
    </Card>
  );
};

export default FacultyWorkloadCard;
