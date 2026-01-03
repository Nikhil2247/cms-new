import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  Modal,
  Table,
  Typography,
  Tag,
  Spin,
  Empty,
} from 'antd';
import {
  selectFacultyWorkload,
  selectFacultyWorkloadLoading,
  selectMentorCoverage,
  selectAlertsEnhanced,
} from '../../store/principalSlice';

const { Text } = Typography;

const JoiningLettersModal = ({
  visible,
  onClose,
  alertsData = [],
  complianceData = null,
}) => {
  const faculty = useSelector(selectFacultyWorkload);
  const facultyLoading = useSelector(selectFacultyWorkloadLoading);
  const mentorCoverage = useSelector(selectMentorCoverage);
  const alertsEnhanced = useSelector(selectAlertsEnhanced);

  // Process faculty data with joining letter status
  const facultyLetterData = useMemo(() => {
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
            studentsWithInternship: mentor.assignedStudents || 0,
            pendingLetters: 0, // Will be updated from alertsData
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
              studentsWithInternship: f.assignedCount || 0,
              pendingLetters: 0,
            });
          } else {
            const existing = mentorMap.get(f.id);
            // Use the higher count between the two sources
            existing.studentsWithInternship = Math.max(existing.studentsWithInternship, f.assignedCount || 0);
          }
        }
      });
    }

    // Process alerts data to count pending letters per mentor
    const pendingByMentor = new Map();
    let unassignedPendingCount = 0;

    alertsData.forEach(alert => {
      const mentorId = alert.mentorId;
      const mentorName = alert.mentorName;

      if (!mentorId) {
        // Student has no mentor assigned
        unassignedPendingCount++;
      } else {
        if (!pendingByMentor.has(mentorId)) {
          pendingByMentor.set(mentorId, {
            count: 0,
            name: mentorName || 'Unknown',
          });
        }
        pendingByMentor.get(mentorId).count++;
      }
    });

    // Update mentor data with pending counts from alerts
    pendingByMentor.forEach((data, mentorId) => {
      if (mentorMap.has(mentorId)) {
        const mentor = mentorMap.get(mentorId);
        mentor.pendingLetters = data.count;
      } else {
        // Mentor found in alerts but not in mentor coverage - add them
        mentorMap.set(mentorId, {
          id: mentorId,
          name: data.name,
          studentsWithInternship: data.count,
          pendingLetters: data.count,
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
        studentsWithInternship: unassignedCount,
        pendingLetters: unassignedPendingCount,
        isUnassigned: true,
      });
    }

    // Sort: "Not Assigned" at top if has pending, then by pending count descending, then by students count
    return result.sort((a, b) => {
      // "Not Assigned" with pending items goes to top
      if (a.isUnassigned && a.pendingLetters > 0) return -1;
      if (b.isUnassigned && b.pendingLetters > 0) return 1;

      // Then sort by pending letters descending
      if (b.pendingLetters !== a.pendingLetters) {
        return b.pendingLetters - a.pendingLetters;
      }

      // Then by students with internship descending
      return b.studentsWithInternship - a.studentsWithInternship;
    });
  }, [faculty, mentorCoverage, alertsData, alertsEnhanced]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalStudents = facultyLetterData.reduce((sum, f) => sum + f.studentsWithInternship, 0);
    const totalPending = facultyLetterData.reduce((sum, f) => sum + f.pendingLetters, 0);
    return { totalStudents, totalPending };
  }, [facultyLetterData]);

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
      title: 'Students with internship',
      dataIndex: 'studentsWithInternship',
      key: 'studentsWithInternship',
      align: 'center',
      render: (count, record) => (
        <Tag
          color={record.isUnassigned ? 'orange' : 'blue'}
          style={{ minWidth: '40px', textAlign: 'center' }}
        >
          {count}
        </Tag>
      ),
      sorter: (a, b) => a.studentsWithInternship - b.studentsWithInternship,
    },
    {
      title: 'Pending Total',
      dataIndex: 'pendingLetters',
      key: 'pendingLetters',
      align: 'center',
      render: (count) => (
        <Tag
          className={count > 0 ? 'bg-error-light' : 'bg-success-light'}
          style={{
            minWidth: '40px',
            textAlign: 'center',
          }}
        >
          {count}
        </Tag>
      ),
      sorter: (a, b) => a.pendingLetters - b.pendingLetters,
    },
  ];

  return (
    <Modal
      title="Joining Letters Overview"
      open={visible}
      onCancel={onClose}
      footer={[
        <button
          key="close"
          onClick={onClose}
          className="px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-gray-100 rounded transition-colors"
        >
          Close
        </button>
      ]}
      width={900}
      styles={{ body: { padding: '24px' } }}
    >
      {/* Summary Bar */}
      <div
        className="flex items-center justify-between p-4 mb-6 rounded-lg bg-info-light border border-blue-100 dark:border-blue-800/20"
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
      ) : facultyLetterData.length > 0 ? (
        <Table className="custom-table"
          dataSource={facultyLetterData}
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

export default JoiningLettersModal;

