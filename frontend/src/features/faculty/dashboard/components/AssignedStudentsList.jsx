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
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

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
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [visitModalVisible, setVisitModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [visitForm] = Form.useForm();

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    if (!searchText) return students;

    const search = searchText.toLowerCase();
    return students.filter(student => {
      const name = (student.name || student.student?.name || '').toLowerCase();
      const rollNumber = (student.rollNumber || student.student?.rollNumber || '').toLowerCase();
      const company = (student.companyName || student.company?.companyName || '').toLowerCase();

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

  // Get visit status icon
  const getVisitStatusIcon = (student) => {
    const visits = student.visits || student.visitLogs || [];
    const visitCount = visits.length;

    if (visitCount === 0) {
      return (
        <Tooltip title="No visits recorded">
          <Space size={4}>
            <MinusCircleOutlined style={{ color: '#d9d9d9', fontSize: 16 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>0</Text>
          </Space>
        </Tooltip>
      );
    }

    // FIXED: Check if there's a recent visit (within last 30 days) AND after internship start
    const hasRecentVisit = visits.some(visit => {
      const visitDate = new Date(visit.visitDate || visit.createdAt);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Visit must be within last 30 days
      if (visitDate < thirtyDaysAgo) return false;

      // FIXED: Check if visit is after internship start date
      const internshipStartDate = visit.application?.internship?.startDate ||
                                   student.activeInternship?.startDate ||
                                   student.application?.internship?.startDate;

      if (internshipStartDate) {
        const startDate = new Date(internshipStartDate);
        return visitDate >= startDate;
      }

      // If no start date available, don't show green (be conservative)
      return false;
    });

    return (
      <Tooltip title={hasRecentVisit ? `${visitCount} visits (recent visit within 30 days)` : `${visitCount} visits (no recent visits)`}>
        <Space size={4}>
          <EnvironmentOutlined style={{ color: hasRecentVisit ? '#52c41a' : '#d9d9d9', fontSize: 16 }} />
          <Text style={{ color: hasRecentVisit ? '#52c41a' : '#8c8c8c', fontSize: 12, fontWeight: 500 }}>
            {visitCount}
          </Text>
        </Space>
      </Tooltip>
    );
  };

  // Get report status icon
  const getReportStatusIcon = (student) => {
    const reports = student.monthlyReports || student.reports || [];
    const latestReport = reports[0];

    if (!latestReport) {
      return (
        <Tooltip title="No reports submitted">
          <MinusCircleOutlined style={{ color: '#d9d9d9', fontSize: 16 }} />
        </Tooltip>
      );
    }

    const status = latestReport.status || latestReport.reviewStatus;

    if (status === 'APPROVED') {
      return (
        <Tooltip title="Report approved">
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
        </Tooltip>
      );
    } else if (status === 'REJECTED') {
      return (
        <Tooltip title="Report rejected">
          <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
        </Tooltip>
      );
    } else {
      return (
        <Tooltip title="Report pending review">
          <ClockCircleOutlined style={{ color: '#faad14', fontSize: 16 }} />
        </Tooltip>
      );
    }
  };

  // Get joining letter status icon
  const getJoiningLetterStatusIcon = (student) => {
    const letter = student.joiningLetter || student.joiningLetters?.[0];

    if (!letter) {
      return (
        <Tooltip title="No joining letter submitted">
          <MinusCircleOutlined style={{ color: '#d9d9d9', fontSize: 16 }} />
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
      sorter: (a, b) => {
        const nameA = (a.name || a.student?.name || '').toLowerCase();
        const nameB = (b.name || b.student?.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      },
      render: (_, student) => {
        const name = student.name || student.student?.name || 'N/A';
        const rollNumber = student.rollNumber || student.student?.rollNumber || 'N/A';

        return (
          <div>
            <Text strong style={{ display: 'block' }}>{name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{rollNumber}</Text>
          </div>
        );
      },
    },
    {
      title: 'Company',
      key: 'company',
      sorter: (a, b) => {
        const companyA = (a.companyName || a.company?.companyName || a.internship?.industry?.companyName || '').toLowerCase();
        const companyB = (b.companyName || b.company?.companyName || b.internship?.industry?.companyName || '').toLowerCase();
        return companyA.localeCompare(companyB);
      },
      render: (_, student) => {
        const company = student.companyName ||
                       student.company?.companyName ||
                       student.internship?.industry?.companyName ||
                       'Not Assigned';

        return (
          <Text style={{ fontSize: 13 }}>
            {company}
          </Text>
        );
      },
    },
    {
      title: 'Visits',
      key: 'visits',
      width: 80,
      align: 'center',
      sorter: (a, b) => {
        const visitsA = (a.visits || a.visitLogs || []).length;
        const visitsB = (b.visits || b.visitLogs || []).length;
        return visitsA - visitsB;
      },
      render: (_, student) => getVisitStatusIcon(student),
    },
    {
      title: 'Reports',
      key: 'reports',
      width: 80,
      align: 'center',
      render: (_, student) => getReportStatusIcon(student),
    },
    {
      title: 'Joining Letter',
      key: 'joiningLetter',
      width: 110,
      align: 'center',
      render: (_, student) => getJoiningLetterStatusIcon(student),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      align: 'center',
      render: (_, student) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              if (onViewStudent) {
                onViewStudent(student.id);
              } else {
                navigate(`/students/${student.id}`);
              }
            }}
          >
            View
          </Button>
          <Button
            size="small"
            onClick={(e) => handleLogVisit(student, e)}
          >
            Log Visit
          </Button>
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
              if (onViewStudent) {
                onViewStudent(record.id);
              } else {
                navigate(`/students/${record.id}`);
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