import React, { useState, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Modal,
  Table,
  Typography,
  Tag,
  Select,
  Spin,
  Empty,
} from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import {
  selectFacultyWorkload,
  selectFacultyWorkloadLoading,
  selectMentorCoverage,
  selectAlertsEnhanced,
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

const FacultyVisitsModal = ({
  visible,
  onClose,
  alertsData = [],
  complianceData = null,
}) => {
  const faculty = useSelector(selectFacultyWorkload);
  const facultyLoading = useSelector(selectFacultyWorkloadLoading);
  const mentorCoverage = useSelector(selectMentorCoverage);
  const alertsEnhanced = useSelector(selectAlertsEnhanced);

  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value);

  // Reset to current month when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedMonth(monthOptions[0]?.value);
    }
  }, [visible, monthOptions]);

  // Process faculty data with visit status
  const facultyVisitData = useMemo(() => {
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
            pendingVisits: 0, // Will be updated from alertsData
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
              pendingVisits: 0,
            });
          } else {
            const existing = mentorMap.get(f.id);
            // Use the higher count between the two sources
            existing.assignedStudents = Math.max(existing.assignedStudents, f.assignedCount || 0);
          }
        }
      });
    }

    // Process alerts data to count pending visits per mentor
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
        mentor.pendingVisits = data.count;
      } else {
        // Mentor found in alerts but not in mentor coverage - add them
        mentorMap.set(mentorId, {
          id: mentorId,
          name: data.name,
          assignedStudents: data.count, // At minimum, they have these students
          pendingVisits: data.count,
        });
      }
    });

    // Convert to array
    const result = Array.from(mentorMap.values());

    // Get unassigned students count from alertsEnhanced if available
    const totalUnassignedFromAlerts = alertsEnhanced?.summary?.unassignedStudentsCount || 0;
    const unassignedCount = Math.max(unassignedPendingCount, totalUnassignedFromAlerts);

    // Add "Not Assigned" row if there are unassigned students
    if (unassignedCount > 0) {
      result.push({
        id: 'unassigned',
        name: 'Not Assigned',
        assignedStudents: unassignedCount,
        pendingVisits: unassignedPendingCount,
        isUnassigned: true,
      });
    }

    // Sort: "Not Assigned" at top if has pending, then by pending count descending, then by assigned count
    return result.sort((a, b) => {
      // "Not Assigned" with pending items goes to top
      if (a.isUnassigned && a.pendingVisits > 0) return -1;
      if (b.isUnassigned && b.pendingVisits > 0) return 1;

      // Then sort by pending visits descending
      if (b.pendingVisits !== a.pendingVisits) {
        return b.pendingVisits - a.pendingVisits;
      }

      // Then by assigned students descending
      return b.assignedStudents - a.assignedStudents;
    });
  }, [faculty, mentorCoverage, alertsData, alertsEnhanced]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalStudents = facultyVisitData.reduce((sum, f) => sum + f.assignedStudents, 0);
    const totalPending = facultyVisitData.reduce((sum, f) => sum + f.pendingVisits, 0);
    return { totalStudents, totalPending };
  }, [facultyVisitData]);

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
          color={record.isUnassigned ? 'error' : 'default'}
          style={{
            borderColor: record.isUnassigned ? '#fecaca' : '#e5e7eb',
            color: record.isUnassigned ? '#dc2626' : '#374151',
            fontWeight: record.isUnassigned ? 600 : 400,
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
          color={record.isUnassigned ? 'orange' : 'blue'}
          style={{ minWidth: '40px', textAlign: 'center' }}
        >
          {count}
        </Tag>
      ),
      sorter: (a, b) => a.assignedStudents - b.assignedStudents,
    },
    {
      title: `Pending (${currentMonthDisplay.split(' ')[0]} ${currentMonthDisplay.split(' ')[1]})`,
      dataIndex: 'pendingVisits',
      key: 'pendingVisits',
      align: 'center',
      render: (count) => (
        <Tag
          style={{
            minWidth: '40px',
            textAlign: 'center',
            backgroundColor: count > 0 ? '#fee2e2' : '#dcfce7',
            color: count > 0 ? '#dc2626' : '#16a34a',
            borderColor: count > 0 ? '#fecaca' : '#bbf7d0',
          }}
        >
          {count}
        </Tag>
      ),
      sorter: (a, b) => a.pendingVisits - b.pendingVisits,
    },
  ];

  return (
    <Modal
      title="Faculty Visits Overview"
      open={visible}
      onCancel={onClose}
      footer={[
        <button
          key="close"
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
        >
          Close
        </button>
      ]}
      width={900}
      styles={{ body: { padding: '24px' } }}
    >
      {/* Month Filter */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-gray-600">
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
        className="flex items-center justify-between p-4 mb-6 rounded-lg"
        style={{ backgroundColor: '#eff6ff' }}
      >
        <div className="flex items-center gap-2">
          <Text strong>Total Students:</Text>
          <Tag color="blue" style={{ fontSize: '14px', padding: '2px 12px' }}>
            {totals.totalStudents}
          </Tag>
        </div>
        <div className="flex items-center gap-2">
          <Text strong>Pending:</Text>
          <Tag
            style={{
              fontSize: '14px',
              padding: '2px 12px',
              backgroundColor: totals.totalPending > 0 ? '#fee2e2' : '#dcfce7',
              color: totals.totalPending > 0 ? '#dc2626' : '#16a34a',
              borderColor: totals.totalPending > 0 ? '#fecaca' : '#bbf7d0',
            }}
          >
            {totals.totalPending}
          </Tag>
        </div>
      </div>

      {/* Faculty Table */}
      {facultyLoading ? (
        <div className="flex justify-center items-center py-12">
          <Spin size="large" />
        </div>
      ) : facultyVisitData.length > 0 ? (
        <Table
          dataSource={facultyVisitData}
          columns={columns}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '20'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} mentors`,
          }}
          size="middle"
        />
      ) : (
        <Empty
          description="No faculty data available"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </Modal>
  );
};

export default FacultyVisitsModal;
