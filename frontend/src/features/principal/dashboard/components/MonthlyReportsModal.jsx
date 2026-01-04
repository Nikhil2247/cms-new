import React, { useState, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Modal,
  Table,
  Typography,
  Tag,
  Select,
  Empty,
  Button,
  theme
} from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import {
  selectFacultyWorkload,
  selectFacultyWorkloadLoading,
  selectMentorCoverage,
} from '../../store/principalSlice';

const { Text } = Typography;

// Generate month options for the last 12 months
const generateMonthOptions = () => {
  const options = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const isCurrent = i === 0;

    options.push({
      label: isCurrent ? `${monthName} (Current)` : monthName,
      value,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    });
  }

  return options;
};

const MonthlyReportsModal = ({
  visible,
  onClose,
  alertsData = [],
  complianceData = null,
}) => {
  const faculty = useSelector(selectFacultyWorkload);
  const facultyLoading = useSelector(selectFacultyWorkloadLoading);
  const mentorCoverage = useSelector(selectMentorCoverage);
  const { token } = theme.useToken();

  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value);

  // Reset to current month when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedMonth(monthOptions[0]?.value);
    }
  }, [visible, monthOptions]);

  // Process faculty data with report status
  const facultyReportData = useMemo(() => {
    // Build a map of mentor data
    const mentorMap = new Map();

    // First, add all mentors from mentorCoverage.mentorLoadDistribution (this has assigned students count)
    if (mentorCoverage?.mentorLoadDistribution) {
      mentorCoverage.mentorLoadDistribution.forEach(mentor => {
        const id = mentor.mentorId || mentor.id;
        if (id) {
          mentorMap.set(id, {
            id,
            name: mentor.mentorName || mentor.name || 'Unknown',
            assignedStudents: mentor.assignedStudents || 0,
            pendingReports: 0, // Will be updated from alertsData
          });
        }
      });
    }

    // Add/update from faculty workload data
    if (faculty && faculty.length > 0) {
      faculty.forEach(f => {
        if (f.id) {
          if (!mentorMap.has(f.id)) {
            mentorMap.set(f.id, {
              id: f.id,
              name: f.name || 'Unknown',
              assignedStudents: f.assignedCount || 0,
              pendingReports: 0,
            });
          } else {
            const existing = mentorMap.get(f.id);
            // Use the higher count between the two sources
            existing.assignedStudents = Math.max(existing.assignedStudents, f.assignedCount || 0);
          }
        }
      });
    }

    // Process alerts data to count pending reports per mentor
    const pendingByMentor = new Map();
    let unassignedPendingCount = 0;
    let unassignedStudentsList = [];

    alertsData.forEach(alert => {
      const mentorId = alert.mentorId;
      const mentorName = alert.mentorName;

      if (!mentorId) {
        // Student has no mentor assigned
        unassignedPendingCount++;
        unassignedStudentsList.push(alert);
      } else {
        if (!pendingByMentor.has(mentorId)) {
          pendingByMentor.set(mentorId, {
            count: 0,
            name: mentorName || 'Unknown',
            students: []
          });
        }
        pendingByMentor.get(mentorId).count++;
        pendingByMentor.get(mentorId).students.push(alert);
      }
    });

    // Update mentor data with pending counts from alerts
    pendingByMentor.forEach((data, mentorId) => {
      if (mentorMap.has(mentorId)) {
        const mentor = mentorMap.get(mentorId);
        mentor.pendingReports = data.count;
      } else {
        // Mentor found in alerts but not in mentor coverage - add them
        mentorMap.set(mentorId, {
          id: mentorId,
          name: data.name,
          assignedStudents: data.count, // At minimum, they have these students
          pendingReports: data.count,
        });
      }
    });

    // Convert to array
    const result = Array.from(mentorMap.values());

    // Add "Not Assigned" row if there are unassigned students
    if (unassignedPendingCount > 0) {
      result.push({
        id: 'unassigned',
        name: 'Not Assigned',
        assignedStudents: unassignedPendingCount,
        pendingReports: unassignedPendingCount,
        isUnassigned: true,
      });
    }

    // Sort: "Not Assigned" at top if has pending, then by pending count descending, then by assigned count
    return result.sort((a, b) => {
      // "Not Assigned" with pending items goes to top
      if (a.isUnassigned && a.pendingReports > 0) return -1;
      if (b.isUnassigned && b.pendingReports > 0) return 1;

      // Then sort by pending reports descending
      if (b.pendingReports !== a.pendingReports) {
        return b.pendingReports - a.pendingReports;
      }

      // Then by assigned students descending
      return b.assignedStudents - a.assignedStudents;
    });
  }, [faculty, mentorCoverage, alertsData]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalStudents = facultyReportData.reduce((sum, f) => sum + f.assignedStudents, 0);
    const totalPending = facultyReportData.reduce((sum, f) => sum + f.pendingReports, 0);
    return { totalStudents, totalPending };
  }, [facultyReportData]);

  // Get current month display name
  const currentMonthDisplay = useMemo(() => {
    const option = monthOptions.find(opt => opt.value === selectedMonth);
    return option ? option.label.replace(' (Current)', '') : '';
  }, [selectedMonth, monthOptions]);

  const columns = [
    {
      title: 'Faculty Mentor',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Tag
          bordered={false}
          style={{
            color: record.isUnassigned ? token.colorError : token.colorText,
            backgroundColor: record.isUnassigned ? token.colorErrorBg : 'transparent',
            borderColor: record.isUnassigned ? token.colorErrorBorder : 'transparent',
            fontWeight: record.isUnassigned ? 600 : 400,
            border: record.isUnassigned ? `1px solid ${token.colorErrorBorder}` : 'none',
          }}
        >
          {text}
        </Tag>
      ),
    },
    {
      title: 'Assigned Students with internship',
      dataIndex: 'assignedStudents',
      key: 'assignedStudents',
      align: 'center',
      render: (count, record) => (
        <Tag
          bordered={false}
          style={{ 
            minWidth: '40px', 
            textAlign: 'center',
            color: record.isUnassigned ? token.colorWarningText : token.colorPrimaryText,
            backgroundColor: record.isUnassigned ? token.colorWarningBg : token.colorPrimaryBg,
          }}
        >
          {count}
        </Tag>
      ),
      sorter: (a, b) => a.assignedStudents - b.assignedStudents,
    },
    {
      title: `Pending (${currentMonthDisplay.split(' ')[0]} ${currentMonthDisplay.split(' ')[1]})`,
      dataIndex: 'pendingReports',
      key: 'pendingReports',
      align: 'center',
      render: (count) => (
        <Tag
          bordered={false}
          style={{
            minWidth: '40px',
            textAlign: 'center',
            backgroundColor: count > 0 ? token.colorErrorBg : token.colorSuccessBg,
            color: count > 0 ? token.colorErrorText : token.colorSuccessText,
          }}
        >
          {count}
        </Tag>
      ),
      sorter: (a, b) => a.pendingReports - b.pendingReports,
    },
  ];

  return (
    <Modal
      title="Monthly Reports Overview"
      open={visible}
      onCancel={onClose}
      centered
      destroyOnClose
      transitionName=""
      maskTransitionName=""
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>
      ]}
      width={900}
      styles={{ body: { padding: '24px' } }}
    >
      {/* Month Filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: token.colorTextSecondary }}>
          <CalendarOutlined />
          <Text strong>Filter by Month:</Text>
        </div>
        <Select
          value={selectedMonth}
          onChange={setSelectedMonth}
          options={monthOptions}
          style={{ width: 200 }}
          placeholder="Select Month"
        />
      </div>

      {/* Summary Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          marginBottom: 24,
          borderRadius: token.borderRadiusLG,
          backgroundColor: token.colorInfoBg,
          border: `1px solid ${token.colorInfoBorder}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text strong>Total Students:</Text>
          <Tag bordered={false} style={{ fontSize: '14px', padding: '2px 12px', color: token.colorPrimaryText, backgroundColor: token.colorPrimaryBg }}>
            {totals.totalStudents}
          </Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text strong>Pending:</Text>
          <Tag
            bordered={false}
            style={{
              fontSize: '14px',
              padding: '2px 12px',
              backgroundColor: totals.totalPending > 0 ? token.colorErrorBg : token.colorSuccessBg,
              color: totals.totalPending > 0 ? token.colorErrorText : token.colorSuccessText,
              border: `1px solid ${totals.totalPending > 0 ? token.colorErrorBorder : token.colorSuccessBorder}`,
            }}
          >
            {totals.totalPending}
          </Tag>
        </div>
      </div>

      {/* Faculty Table */}
      <Table
        dataSource={facultyReportData}
        columns={columns}
        rowKey="id"
        loading={facultyLoading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ['5', '10', '20'],
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} mentors`,
        }}
        size="small"
        locale={{
          emptyText: <Empty description="No faculty data available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        }}
      />
    </Modal>
  );
};

export default MonthlyReportsModal;

