import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Modal, Table, Spin, Typography } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  TeamOutlined,
  EyeOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import stateService from '../../../../services/state.service';

const { Text } = Typography;

// Stat Card Component matching the reference design
const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  iconBg,
  iconColor,
  onViewDetails,
  percentage,
  fraction,
}) => {
  return (
    <Card
      className="rounded-2xl border-border shadow-sm hover:shadow-md transition-all bg-surface h-full"
      styles={{ body: { padding: '20px 24px' } }}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}
        >
          {React.cloneElement(icon, { className: `text-xl ${iconColor}` })}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Text className="text-text-tertiary text-[11px] font-bold uppercase tracking-wider block mb-1">
            {title}
          </Text>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-text-primary leading-none">
              {percentage !== undefined ? `${percentage}%` : (typeof value === 'number' ? value.toLocaleString() : value)}
            </span>
            {fraction && (
              <span className="text-sm text-text-tertiary font-medium">({fraction})</span>
            )}
          </div>
          {subtitle && (
            <Text className="text-text-secondary text-xs mt-1.5 block">{subtitle}</Text>
          )}
        </div>

        {/* View Details Button */}
        <button
          onClick={onViewDetails}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
        >
          <EyeOutlined className="text-text-tertiary text-sm" />
        </button>
      </div>
    </Card>
  );
};

// College-wise breakdown modal
const CollegeBreakdownModal = ({
  visible,
  onClose,
  title,
  loading,
  data,
  columns,
}) => {
  return (
    <Modal
      title={<span className="font-semibold text-base">{title}</span>}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
      className="[&_.ant-modal-content]:rounded-2xl"
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <Spin />
        </div>
      ) : (
        <Table
          dataSource={data}
          columns={columns}
          rowKey={(record) => record.id || record.institutionId || record.name}
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: false, size: 'small' }}
          className="mt-4 [&_.ant-table-thead_th]:bg-gray-50 [&_.ant-table-thead_th]:text-[10px] [&_.ant-table-thead_th]:font-bold [&_.ant-table-thead_th]:uppercase [&_.ant-table-thead_th]:text-text-tertiary"
        />
      )}
    </Modal>
  );
};

const StatisticsCards = ({ stats, selectedMonth }) => {
  const [modalType, setModalType] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [collegeData, setCollegeData] = useState([]);

  // Get month/year from selectedMonth for filtering
  // Note: Ant Design DatePicker returns dayjs objects - use .month() (0-indexed) and .year()
  const filterMonth = selectedMonth ? selectedMonth.month() + 1 : null;
  const filterYear = selectedMonth ? selectedMonth.year() : null;

  // Extract stats
  const totalStudents = stats?.students?.total ?? 0;
  const activeInternships = stats?.internships?.active ?? 0;
  const totalMentors = stats?.faculty?.total ?? stats?.totalFaculty ?? 0;

  const monthlyReports = stats?.monthlyReports || {};
  const reportsSubmitted = monthlyReports?.thisMonth ?? 0;
  const reportsExpected = monthlyReports?.expectedThisMonth ?? 0;
  const reportsPercentage = reportsExpected > 0 ? Math.round((reportsSubmitted / reportsExpected) * 100) : 0;

  const facultyVisits = stats?.facultyVisits || {};
  const visitsCompleted = facultyVisits?.thisMonth ?? 0;
  const visitsExpected = facultyVisits?.expectedThisMonth ?? 0;
  const visitsPercentage = visitsExpected > 0 ? Math.round((visitsCompleted / visitsExpected) * 100) : 0;

  // Get display month name (selected or current)
  // Note: selectedMonth is a dayjs object from Ant Design DatePicker
  const displayMonth = selectedMonth
    ? selectedMonth.format('MMM YYYY')
    : new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  // Fetch college-wise breakdown with optional month/year filter
  const fetchCollegeBreakdown = async (type) => {
    setModalType(type);
    setModalLoading(true);
    try {
      const response = await stateService.getCollegeWiseBreakdown(type, {
        month: filterMonth,
        year: filterYear,
      });
      setCollegeData(response?.data || response || []);
    } catch (error) {
      console.error('Error fetching college breakdown:', error);
      setCollegeData([]);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setModalType(null);
    setCollegeData([]);
  };

  // Column configurations for different modal types
  const getColumns = (type) => {
    const baseColumns = [
      {
        title: 'Institution',
        dataIndex: 'institutionName',
        key: 'institutionName',
        render: (text, record) => (
          <Text className="text-sm font-medium">{text || record.name || 'Unknown'}</Text>
        ),
      },
    ];

    switch (type) {
      case 'students':
        return [
          ...baseColumns,
          {
            title: 'Total Students',
            dataIndex: 'totalStudents',
            key: 'totalStudents',
            align: 'center',
            render: (val) => <Text className="text-sm font-semibold">{val?.toLocaleString() || 0}</Text>,
          },
          {
            title: 'Active Internships',
            dataIndex: 'activeInternships',
            key: 'activeInternships',
            align: 'center',
            render: (val) => <Text className="text-sm font-semibold text-pink-500">{val?.toLocaleString() || 0}</Text>,
          },
        ];
      case 'reports':
        return [
          ...baseColumns,
          {
            title: 'Submitted',
            dataIndex: 'reportsSubmitted',
            key: 'reportsSubmitted',
            align: 'center',
            render: (val) => <Text className="text-sm font-semibold text-green-600">{val || 0}</Text>,
          },
          {
            title: 'Expected',
            dataIndex: 'reportsExpected',
            key: 'reportsExpected',
            align: 'center',
            render: (val) => <Text className="text-sm">{val || 0}</Text>,
          },
          {
            title: 'Rate',
            key: 'rate',
            align: 'center',
            render: (_, record) => {
              const rate = record.reportsExpected > 0
                ? Math.round((record.reportsSubmitted / record.reportsExpected) * 100)
                : 0;
              return <Text className={`text-sm font-semibold ${rate >= 80 ? 'text-green-600' : rate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{rate}%</Text>;
            },
          },
        ];
      case 'mentors':
        return [
          ...baseColumns,
          {
            title: 'Total Mentors',
            dataIndex: 'totalMentors',
            key: 'totalMentors',
            align: 'center',
            render: (val) => <Text className="text-sm font-semibold">{val?.toLocaleString() || 0}</Text>,
          },
          {
            title: 'Assigned Students',
            dataIndex: 'assignedStudents',
            key: 'assignedStudents',
            align: 'center',
            render: (val) => <Text className="text-sm font-semibold text-purple-500">{val?.toLocaleString() || 0}</Text>,
          },
        ];
      case 'visits':
        return [
          ...baseColumns,
          {
            title: 'Completed',
            dataIndex: 'visitsCompleted',
            key: 'visitsCompleted',
            align: 'center',
            render: (val) => <Text className="text-sm font-semibold text-green-600">{val || 0}</Text>,
          },
          {
            title: 'Expected',
            dataIndex: 'visitsExpected',
            key: 'visitsExpected',
            align: 'center',
            render: (val) => <Text className="text-sm">{val || 0}</Text>,
          },
          {
            title: 'Rate',
            key: 'rate',
            align: 'center',
            render: (_, record) => {
              const rate = record.visitsExpected > 0
                ? Math.round((record.visitsCompleted / record.visitsExpected) * 100)
                : 0;
              return <Text className={`text-sm font-semibold ${rate >= 80 ? 'text-green-600' : rate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{rate}%</Text>;
            },
          },
        ];
      default:
        return baseColumns;
    }
  };

  const getModalTitle = (type) => {
    switch (type) {
      case 'students': return 'College-wise Student Count';
      case 'reports': return 'College-wise Monthly Reports';
      case 'mentors': return 'College-wise Mentor Count';
      case 'visits': return 'College-wise Faculty Visits';
      default: return 'Details';
    }
  };

  return (
    <>
      <Row gutter={[16, 16]}>
        {/* Total Students */}
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Total Students"
            value={totalStudents}
            subtitle={`Active Internships: ${activeInternships.toLocaleString()}`}
            icon={<UserOutlined />}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
            onViewDetails={() => fetchCollegeBreakdown('students')}
          />
        </Col>

        {/* Monthly Reports */}
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Monthly Reports"
            percentage={reportsPercentage}
            fraction={`${reportsSubmitted}/${reportsExpected}`}
            subtitle={displayMonth}
            icon={<FileTextOutlined />}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-500"
            onViewDetails={() => fetchCollegeBreakdown('reports')}
          />
        </Col>

        {/* Total Mentors */}
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Total Mentors"
            value={totalMentors}
            icon={<TeamOutlined />}
            iconBg="bg-cyan-50"
            iconColor="text-cyan-500"
            onViewDetails={() => fetchCollegeBreakdown('mentors')}
          />
        </Col>

        {/* Faculty Visits */}
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Faculty Visits"
            percentage={visitsPercentage}
            fraction={`${visitsCompleted}/${visitsExpected}`}
            subtitle={displayMonth}
            icon={<CalendarOutlined />}
            iconBg="bg-purple-50"
            iconColor="text-purple-500"
            onViewDetails={() => fetchCollegeBreakdown('visits')}
          />
        </Col>
      </Row>

      {/* College Breakdown Modal */}
      <CollegeBreakdownModal
        visible={modalType !== null}
        onClose={closeModal}
        title={getModalTitle(modalType)}
        loading={modalLoading}
        data={collegeData}
        columns={getColumns(modalType)}
      />
    </>
  );
};

export default StatisticsCards;
