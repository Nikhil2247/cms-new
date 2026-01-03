import React, { useState, useMemo } from 'react';
import { Card, Table, Input, Button, Typography, Badge, Tooltip, Space, Tag, theme } from 'antd';
import {
  TeamOutlined,
  SearchOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  MinusCircleOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getTotalExpectedCount } from '../../../../utils/monthlyCycle';
import UnifiedVisitLogModal from '../../visits/UnifiedVisitLogModal';

const { Text } = Typography;

const AssignedStudentsList = ({
  students = [],
  loading,
  onViewAll,
  onViewStudent,
  onScheduleVisit
}) => {
  const { token } = theme.useToken();
  const [searchText, setSearchText] = useState('');
  const [visitModalVisible, setVisitModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Helper to extract company name from student record
  const getCompanyName = (student) => {
    return student.companyName ||
           student.company?.companyName ||
           student.internship?.industry?.companyName ||
           student.student?.internshipApplications?.[0]?.companyName ||
           'Not Assigned';
  };

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    if (!searchText) return students;

    const search = searchText.toLowerCase();
    return students.filter(student => {
      const name = (student.name || student.student?.name || '').toLowerCase();
      const rollNumber = (student.rollNumber || student.student?.rollNumber || '').toLowerCase();
      const company = getCompanyName(student).toLowerCase();

      return name.includes(search) || rollNumber.includes(search) || company.includes(search);
    });
  }, [students, searchText]);

  // Handle Log Visit button click - open UnifiedVisitLogModal
  const handleLogVisit = (student, e) => {
    e.stopPropagation();
    setSelectedStudent(student);
    setVisitModalVisible(true);
  };

  // Handle visit modal success
  const handleVisitSuccess = () => {
    setVisitModalVisible(false);
    setSelectedStudent(null);
    // Trigger refresh if callback is provided
    if (onScheduleVisit) {
      onScheduleVisit();
    }
  };

  // Helper to get internship application from student record
  const getInternshipApp = (student) => {
    return student.student?.internshipApplications?.[0] ||
           student.internshipApplications?.[0] ||
           student.activeInternship ||
           null;
  };

  /**
   * Calculate total expected reports using monthly cycles.
   * Returns total for entire internship period (not just as of today).
   * Always calculates dynamically based on dates to reflect date changes.
   */
  const calculateExpectedReports = (internshipApp) => {
    if (!internshipApp?.startDate || !internshipApp?.endDate) return 0;

    const startDate = new Date(internshipApp.startDate);
    const endDate = new Date(internshipApp.endDate);

    return getTotalExpectedCount(startDate, endDate);
  };

  /**
   * Calculate total expected visits using monthly cycles.
   * Returns total for entire internship period (not just as of today).
   * Always calculates dynamically based on dates to reflect date changes.
   */
  const calculateExpectedVisits = (internshipApp) => {
    if (!internshipApp?.startDate || !internshipApp?.endDate) return 0;

    const startDate = new Date(internshipApp.startDate);
    const endDate = new Date(internshipApp.endDate);

    return getTotalExpectedCount(startDate, endDate);
  };

  // Get visit status with done/expected
  const getVisitStatus = (student) => {
    const internshipApp = getInternshipApp(student);
    const visits = student.visits ||
                  student.visitLogs ||
                  internshipApp?.facultyVisitLogs ||
                  student.student?.facultyVisitLogs ||
                  [];
    const done = visits.length;
    const expected = calculateExpectedVisits(internshipApp);

    // Determine color based on completion
    let color = token.colorTextQuaternary; // grey - no progress
    let bgColor = token.colorFillQuaternary;
    if (expected > 0) {
      const ratio = done / expected;
      if (ratio >= 1) {
        color = token.colorSuccess; // green - complete
        bgColor = token.colorSuccessBg;
      } else if (ratio >= 0.5) {
        color = token.colorWarning; // orange - partial
        bgColor = token.colorWarningBg;
      } else if (done > 0) {
        color = token.colorError; // light red - started (using error color for low progress)
        bgColor = token.colorErrorBg;
      }
    }

    return (
      <Tooltip title={`${done} of ${expected} visits completed`}>
        <div
          style={{
            background: bgColor,
            padding: '2px 8px',
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <EnvironmentOutlined style={{ color, fontSize: 12 }} />
          <Text style={{ color, fontSize: 12, fontWeight: 600 }}>
            {done}/{expected}
          </Text>
        </div>
      </Tooltip>
    );
  };

  // Get report status with done/expected
  const getReportStatus = (student) => {
    const internshipApp = getInternshipApp(student);
    const reports = student.monthlyReports ||
                   student.reports ||
                   internshipApp?.monthlyReports ||
                   student.student?.monthlyReports ||
                   [];
    const done = reports.length;
    const expected = calculateExpectedReports(internshipApp);

    // Check for draft reports (with auto-approval, only DRAFT is pending)
    const pendingCount = reports.filter(r => r.status === 'DRAFT').length;

    // Determine color based on completion
    let color = token.colorTextQuaternary; // grey - no progress
    let bgColor = token.colorFillQuaternary;
    let icon = <MinusCircleOutlined style={{ color, fontSize: 12 }} />;

    if (expected > 0) {
      const ratio = done / expected;
      if (ratio >= 1) {
        color = token.colorSuccess; // green - complete
        bgColor = token.colorSuccessBg;
        icon = <CheckCircleOutlined style={{ color, fontSize: 12 }} />;
      } else if (pendingCount > 0) {
        color = token.colorWarning; // orange - has pending
        bgColor = token.colorWarningBg;
        icon = <ClockCircleOutlined style={{ color, fontSize: 12 }} />;
      } else if (done > 0) {
        color = token.colorPrimary; // blue - in progress
        bgColor = token.colorPrimaryBg;
        icon = <CheckCircleOutlined style={{ color, fontSize: 12 }} />;
      }
    }

    const tooltipText = pendingCount > 0
      ? `${done}/${expected} reports (${pendingCount} draft)`
      : `${done} of ${expected} reports submitted`;

    return (
      <Tooltip title={tooltipText}>
        <div
          style={{
            background: bgColor,
            padding: '2px 8px',
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {icon}
          <Text style={{ color, fontSize: 12, fontWeight: 600 }}>
            {done}/{expected}
          </Text>
        </div>
      </Tooltip>
    );
  };

  // Get joining letter status icon
  const getJoiningLetterStatusIcon = (student) => {
    const letter = student.joiningLetter || student.joiningLetters?.[0];
    // Check if there's a joining letter URL in the internship application
    const internshipApp = getInternshipApp(student);
    const hasJoiningLetterUrl = internshipApp?.joiningLetterUrl;

    if (!letter && !hasJoiningLetterUrl) {
      return (
        <Tooltip title="No joining letter submitted">
          <MinusCircleOutlined style={{ color: token.colorTextQuaternary, fontSize: 16 }} />
        </Tooltip>
      );
    }

    // If we have a joining letter URL but no letter object, show as pending
    if (!letter && hasJoiningLetterUrl) {
      return (
        <Tooltip title="Joining letter uploaded">
          <ClockCircleOutlined style={{ color: token.colorWarning, fontSize: 16 }} />
        </Tooltip>
      );
    }

    const isVerified = letter.isVerified || letter.verifiedAt || letter.status === 'VERIFIED';
    const isPending = letter.status === 'PENDING' || letter.status === 'SUBMITTED' || (!letter.reviewedAt && !isVerified);

    if (isVerified) {
      return (
        <Tooltip title="Joining letter verified">
          <CheckCircleOutlined style={{ color: token.colorSuccess, fontSize: 16 }} />
        </Tooltip>
      );
    } else if (isPending) {
      return (
        <Tooltip title="Joining letter pending verification">
          <ClockCircleOutlined style={{ color: token.colorWarning, fontSize: 16 }} />
        </Tooltip>
      );
    } else {
      return (
        <Tooltip title="No joining letter">
          <MinusCircleOutlined style={{ color: token.colorTextQuaternary, fontSize: 16 }} />
        </Tooltip>
      );
    }
  };

  const columns = [
    {
      title: 'Student',
      key: 'student',
      width: 150,
      ellipsis: true,
      sorter: (a, b) => {
        const nameA = (a.name || a.student?.name || '').toLowerCase();
        const nameB = (b.name || b.student?.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      },
      render: (_, student) => {
        const name = student.name || student.student?.name || 'N/A';
        const rollNumber = student.rollNumber || student.student?.rollNumber || 'N/A';
        const isExternal = student.isExternalStudent || false;
        const institution = student.student?.Institution || student.Institution;

        return (
          <div style={{ maxWidth: 140 }}>
            <div className="flex items-center gap-1">
              <Text strong style={{ display: 'block', fontSize: 13 }} ellipsis={{ tooltip: name }}>
                {name}
              </Text>
              {isExternal && (
                <Tooltip title={`External student from ${institution?.name || 'Other Institution'}`}>
                  <Tag color="purple" className="m-0 px-1 py-0 text-[9px] leading-[14px] border-0">
                    <GlobalOutlined style={{ fontSize: '8px' }} />
                  </Tag>
                </Tooltip>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>{rollNumber}</Text>
            {isExternal && institution && (
              <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 2 }} ellipsis={{ tooltip: institution.name }}>
                <GlobalOutlined style={{ fontSize: 8, marginRight: 2 }} />
                {institution.code || institution.name}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Company & Duration',
      key: 'company',
      width: 200,
      ellipsis: true,
      sorter: (a, b) => {
        const companyA = getCompanyName(a).toLowerCase();
        const companyB = getCompanyName(b).toLowerCase();
        return companyA.localeCompare(companyB);
      },
      render: (_, student) => {
        const internshipApp = getInternshipApp(student);
        const startDate = internshipApp?.startDate;
        const endDate = internshipApp?.endDate;

        // Calculate duration in months
        let duration = '';
        if (startDate && endDate) {
          const start = dayjs(startDate);
          const end = dayjs(endDate);
          const months = end.diff(start, 'month');
          const days = end.diff(start, 'day') % 30;
          duration = months > 0 ? `${months}m` : `${days}d`;
        }

        return (
          <div style={{ maxWidth: 190 }}>
            <Text strong style={{ fontSize: 12, display: 'block' }} ellipsis={{ tooltip: getCompanyName(student) }}>
              {getCompanyName(student)}
            </Text>
            {(startDate || endDate) && (
              <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
                {startDate && dayjs(startDate).format('DD MMM')}
                {startDate && endDate && ' - '}
                {endDate && dayjs(endDate).format('DD MMM YY')}
                {duration && <span style={{ color: token.colorPrimary, marginLeft: 4 }}>({duration})</span>}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Visits',
      key: 'visits',
      width: 70,
      align: 'center',
      sorter: (a, b) => {
        const internshipAppA = getInternshipApp(a);
        const internshipAppB = getInternshipApp(b);
        const visitsA = (a.visits || a.visitLogs || internshipAppA?.facultyVisitLogs || []).length;
        const visitsB = (b.visits || b.visitLogs || internshipAppB?.facultyVisitLogs || []).length;
        return visitsA - visitsB;
      },
      render: (_, student) => getVisitStatus(student),
    },
    {
      title: 'Reports',
      key: 'reports',
      width: 70,
      align: 'center',
      sorter: (a, b) => {
        const internshipAppA = getInternshipApp(a);
        const internshipAppB = getInternshipApp(b);
        const reportsA = (a.monthlyReports || internshipAppA?.monthlyReports || []).length;
        const reportsB = (b.monthlyReports || internshipAppB?.monthlyReports || []).length;
        return reportsA - reportsB;
      },
      render: (_, student) => getReportStatus(student),
    },
    {
      title: 'Letter',
      key: 'joiningLetter',
      width: 60,
      align: 'center',
      render: (_, student) => getJoiningLetterStatusIcon(student),
    },
    {
      title: '',
      key: 'actions',
      width: 70,
      align: 'center',
      fixed: 'right',
      render: (_, student) => (
        <Space size={2}>
          <Tooltip title="View">
            <Button
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              style={{ padding: '0 6px' }}
              onClick={(e) => {
                e.stopPropagation();
                const studentId = student.id || student.studentId || student.student?.id;
                if (onViewStudent) {
                  onViewStudent(studentId);
                }
              }}
            />
          </Tooltip>
          <Tooltip title="Log Visit">
            <Button
              size="small"
              icon={<EnvironmentOutlined />}
              style={{ padding: '0 6px' }}
              onClick={(e) => handleLogVisit(student, e)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        title={
          <div className="flex items-center gap-2">
            <TeamOutlined style={{ color: token.colorPrimary }} />
            <span>Assigned Students</span>
            <Badge count={students.length} className="ml-2" />
          </div>
        }
        extra={
          <Input
            placeholder="Search students..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
        }
        className="h-full !rounded-xl"
        style={{ borderColor: token.colorBorder }}
      >
        <Table
          loading={loading}
          dataSource={filteredStudents}
          columns={columns}
          rowKey={(record) => record.id || record.studentId}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} students`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          scroll={{ x: 800 }}
          size="middle"
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onClick: () => {
              const studentId = record.id || record.studentId || record.student?.id;
              if (onViewStudent) {
                onViewStudent(studentId);
              }
            },
          })}
        />
      </Card>

      {/* Unified Visit Log Modal */}
      <UnifiedVisitLogModal
        visible={visitModalVisible}
        onClose={() => {
          setVisitModalVisible(false);
          setSelectedStudent(null);
        }}
        onSuccess={handleVisitSuccess}
        selectedStudent={selectedStudent}
        students={students}
      />
    </>
  );
};

export default AssignedStudentsList;