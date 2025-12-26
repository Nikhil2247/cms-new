import React, { useState, useMemo } from 'react';
import { Card, Table, Input, Button, Typography, Badge, Tooltip, Space, Modal, Form, DatePicker, Select, message } from 'antd';
import {
  TeamOutlined,
  SearchOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getExpectedReportsAsOfToday,
  getExpectedVisitsAsOfToday,
} from '../../../../utils/fourWeekCycle';

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const AssignedStudentsList = ({
  students = [],
  loading,
  onViewAll,
  onViewStudent,
  onScheduleVisit
}) => {
  const [searchText, setSearchText] = useState('');
  const [visitModalVisible, setVisitModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [visitForm] = Form.useForm();

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

  // Handle Log Visit button click
  const handleLogVisit = (student, e) => {
    e.stopPropagation();
    setSelectedStudent(student);
    visitForm.resetFields();
    visitForm.setFieldsValue({
      studentId: student.id,
      applicationId: student.applicationId || student.id,
      visitDate: dayjs(),
    });
    setVisitModalVisible(true);
  };

  // Handle visit form submission
  const handleVisitSubmit = async () => {
    try {
      const values = await visitForm.validateFields();
      const visitData = {
        ...values,
        visitDate: values.visitDate.toISOString(),
      };

      if (onScheduleVisit) {
        await onScheduleVisit(visitData);
        message.success('Visit log created successfully');
      }

      setVisitModalVisible(false);
      visitForm.resetFields();
    } catch (err) {
      if (err.errorFields) {
        return; // Form validation error
      }
      message.error('Failed to create visit log');
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
   * Calculate expected reports using 4-week cycles.
   * Reports are due every 4 weeks from internship startDate + 5 days grace period.
   */
  const calculateExpectedReports = (internshipApp) => {
    if (internshipApp?.totalExpectedReports) {
      return internshipApp.totalExpectedReports;
    }

    if (!internshipApp?.startDate || !internshipApp?.endDate) return 0;

    const startDate = new Date(internshipApp.startDate);
    const endDate = new Date(internshipApp.endDate);
    const now = new Date();

    if (startDate > now) return 0;

    return getExpectedReportsAsOfToday(startDate, endDate);
  };

  /**
   * Calculate expected visits using 4-week cycles.
   * Visits are aligned with report cycles - 1 visit per 4-week cycle.
   */
  const calculateExpectedVisits = (internshipApp) => {
    if (internshipApp?.totalExpectedVisits) {
      return internshipApp.totalExpectedVisits;
    }

    if (!internshipApp?.startDate || !internshipApp?.endDate) return 0;

    const startDate = new Date(internshipApp.startDate);
    const endDate = new Date(internshipApp.endDate);
    const now = new Date();

    if (startDate > now) return 0;

    return getExpectedVisitsAsOfToday(startDate, endDate);
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
    let color = '#d9d9d9'; // grey - no progress
    let bgColor = '#f5f5f5';
    if (expected > 0) {
      const ratio = done / expected;
      if (ratio >= 1) {
        color = '#52c41a'; // green - complete
        bgColor = '#f6ffed';
      } else if (ratio >= 0.5) {
        color = '#faad14'; // orange - partial
        bgColor = '#fffbe6';
      } else if (done > 0) {
        color = '#ff7a45'; // light red - started
        bgColor = '#fff2e8';
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

    // Check for pending reports
    const pendingCount = reports.filter(r =>
      r.status === 'SUBMITTED' || r.status === 'PENDING'
    ).length;

    // Determine color based on completion
    let color = '#d9d9d9'; // grey - no progress
    let bgColor = '#f5f5f5';
    let icon = <MinusCircleOutlined style={{ color, fontSize: 12 }} />;

    if (expected > 0) {
      const ratio = done / expected;
      if (ratio >= 1) {
        color = '#52c41a'; // green - complete
        bgColor = '#f6ffed';
        icon = <CheckCircleOutlined style={{ color, fontSize: 12 }} />;
      } else if (pendingCount > 0) {
        color = '#faad14'; // orange - has pending
        bgColor = '#fffbe6';
        icon = <ClockCircleOutlined style={{ color, fontSize: 12 }} />;
      } else if (done > 0) {
        color = '#1890ff'; // blue - in progress
        bgColor = '#e6f7ff';
        icon = <CheckCircleOutlined style={{ color, fontSize: 12 }} />;
      }
    }

    const tooltipText = pendingCount > 0
      ? `${done}/${expected} reports (${pendingCount} pending review)`
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
          <MinusCircleOutlined style={{ color: '#d9d9d9', fontSize: 16 }} />
        </Tooltip>
      );
    }

    // If we have a joining letter URL but no letter object, show as pending
    if (!letter && hasJoiningLetterUrl) {
      return (
        <Tooltip title="Joining letter uploaded">
          <ClockCircleOutlined style={{ color: '#faad14', fontSize: 16 }} />
        </Tooltip>
      );
    }

    const isVerified = letter.isVerified || letter.verifiedAt || letter.status === 'VERIFIED';
    const isPending = letter.status === 'PENDING' || letter.status === 'SUBMITTED' || (!letter.reviewedAt && !isVerified);

    if (isVerified) {
      return (
        <Tooltip title="Joining letter verified">
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
        </Tooltip>
      );
    } else if (isPending) {
      return (
        <Tooltip title="Joining letter pending verification">
          <ClockCircleOutlined style={{ color: '#faad14', fontSize: 16 }} />
        </Tooltip>
      );
    } else {
      return (
        <Tooltip title="No joining letter">
          <MinusCircleOutlined style={{ color: '#d9d9d9', fontSize: 16 }} />
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

        return (
          <div style={{ maxWidth: 140 }}>
            <Text strong style={{ display: 'block', fontSize: 13 }} ellipsis={{ tooltip: name }}>
              {name}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{rollNumber}</Text>
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
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                {startDate && dayjs(startDate).format('DD MMM')}
                {startDate && endDate && ' - '}
                {endDate && dayjs(endDate).format('DD MMM YY')}
                {duration && <span style={{ color: '#1890ff', marginLeft: 4 }}>({duration})</span>}
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
            <TeamOutlined className="text-primary" />
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
        className="h-full border border-border rounded-xl"
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

      {/* Quick Visit Log Modal */}
      <Modal
        title={`Log Visit - ${selectedStudent?.name || selectedStudent?.student?.name || ''}`}
        open={visitModalVisible}
        onOk={handleVisitSubmit}
        onCancel={() => {
          setVisitModalVisible(false);
          visitForm.resetFields();
        }}
        okText="Create Visit Log"
        width={600}
      >
        <Form form={visitForm} layout="vertical" className="mt-4">
          <Form.Item name="studentId" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="applicationId" hidden>
            <Input />
          </Form.Item>

          <Form.Item
            name="visitDate"
            label="Visit Date"
            rules={[{ required: true, message: 'Please select a date' }]}
          >
            <DatePicker className="w-full" showTime />
          </Form.Item>

          <Form.Item
            name="visitType"
            label="Visit Type"
            rules={[{ required: true, message: 'Please select visit type' }]}
          >
            <Select placeholder="Select visit type">
              <Option value="PHYSICAL">Physical Visit</Option>
              <Option value="VIRTUAL">Virtual Visit</Option>
              <Option value="PHONE">Phone Call</Option>
            </Select>
          </Form.Item>

          <Form.Item name="visitLocation" label="Visit Location">
            <Input placeholder="Enter visit location" />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Add any notes about this visit" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default AssignedStudentsList;