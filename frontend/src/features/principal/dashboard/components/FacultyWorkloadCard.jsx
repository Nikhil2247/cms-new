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
import ProfileAvatar from '../../../../components/common/ProfileAvatar';

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
          <ProfileAvatar size="small" profileImage={record.profileImage} className="bg-info-light" />
          <div>
            <div className="font-medium text-sm">{text}</div>
            <div className="text-xs text-text-tertiary">{record.email}</div>
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
            <TeamOutlined className="text-info" />
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
            <EyeOutlined className="text-success" />
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
      className="border-border shadow-soft hover:shadow-soft-lg transition-all duration-300 rounded-xl bg-surface"
      styles={{ body: { padding: '16px' } }}
    >
      {/* Summary Stats */}
      {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center p-2 bg-warning-light rounded-lg">
          <div className="text-xl font-bold text-warning">{totalFaculty}</div>
          <div className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Faculty</div>
        </div>
        <div className="text-center p-2 bg-info-light rounded-lg">
          <div className="text-xl font-bold text-info">{totalAssigned}</div>
          <div className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Assigned</div>
        </div>
        <div className="text-center p-2 bg-success-light rounded-lg">
          <div className="text-xl font-bold text-success">{totalVisits}</div>
          <div className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Visits</div>
        </div>
        <div className="text-center p-2 bg-error-light rounded-lg">
          <div className="text-xl font-bold text-error">{overloadedCount}</div>
          <div className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Overloaded</div>
        </div>
      </div> */}

      {/* Faculty Table */}
      {faculty.length > 0 ? (
        <Table className="custom-table"
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

