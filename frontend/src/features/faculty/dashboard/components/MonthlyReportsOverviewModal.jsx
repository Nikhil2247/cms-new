import React, { useMemo } from 'react';
import { Modal, Table, Tag, Alert, Typography } from 'antd';
import {
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

const MonthlyReportsOverviewModal = ({ visible, onClose, students = [], monthlyReports = [] }) => {
  // Generate months for the table (from Nov 2025 to next 6 months)
  const generateMonthColumns = () => {
    const months = [];
    const now = new Date();
    const startMonth = now.getMonth() - 1; // Start from previous month
    const startYear = now.getFullYear();

    for (let i = 0; i < 8; i++) {
      const date = new Date(startYear, startMonth + i, 1);
      const monthName = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear();
      months.push({
        month: date.getMonth() + 1,
        year,
        label: `${monthName} ${year}`,
        key: `${date.getMonth() + 1}-${year}`,
      });
    }
    return months;
  };

  const monthColumns = generateMonthColumns();

  // Calculate pending reports summary
  const pendingReportsSummary = useMemo(() => {
    const summary = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    monthlyReports.forEach(report => {
      if (report.status === 'DRAFT' || report.status === 'PENDING') {
        const key = `${report.reportMonth}-${report.reportYear}`;
        if (!summary[key]) {
          summary[key] = {
            month: report.reportMonth,
            year: report.reportYear,
            label: `${monthNames[report.reportMonth - 1]} ${report.reportYear}`,
            count: 0,
          };
        }
        summary[key].count++;
      }
    });

    return Object.values(summary);
  }, [monthlyReports]);

  // Build table data with students and their report status per month
  const tableData = useMemo(() => {
    return students.map((studentItem, index) => {
      const student = studentItem.student || studentItem;
      // Get internship from the correct nested path
      const activeApplication = student.internshipApplications?.[0] || studentItem.application;
      const internship = activeApplication?.internship ||
                         student.activeInternship ||
                         studentItem.internship;

      const internshipName = internship?.title || internship?.role || activeApplication?.jobProfile || 'N/A';
      const companyName = internship?.industry?.companyName ||
                          internship?.company?.name ||
                          internship?.companyName ||
                          activeApplication?.companyName ||
                          '';

      const internshipDisplay = companyName
        ? `${internshipName} - ${companyName}`
        : internshipName;

      const internshipType = activeApplication?.applicationType ||
                             (activeApplication?.isSelfIdentified ? 'Self-Identified' : 'Placement') ||
                             internship?.type ||
                             'Self-Identified';

      // Get internship dates from application or internship
      const internshipStartDate = activeApplication?.startDate || internship?.startDate;
      const internshipEndDate = activeApplication?.endDate || internship?.endDate;

      // Get report status for each month
      const monthStatuses = {};
      monthColumns.forEach(col => {
        // Match reports by student ID - check multiple paths for compatibility
        const report = monthlyReports.find(r =>
          (r.studentId === student.id ||
           r.student?.id === student.id ||
           r.application?.studentId === student.id ||
           r.application?.student?.id === student.id) &&
          r.reportMonth === col.month &&
          r.reportYear === col.year
        );

        const monthDate = new Date(col.year, col.month - 1, 1);
        let status = 'future'; // Default: future month

        if (internshipStartDate) {
          const startDate = new Date(internshipStartDate);
          const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

          if (monthDate < startMonth) {
            status = 'na'; // Before internship start
          } else if (internshipEndDate) {
            const endDate = new Date(internshipEndDate);
            if (monthDate > endDate) {
              status = 'na'; // After internship end
            }
          }
        } else {
          // No start date - mark as N/A (internship not properly set up)
          status = 'na';
        }

        if (report) {
          status = report.status; // APPROVED, SUBMITTED, DRAFT, REJECTED
        } else if (status !== 'na' && status !== 'future') {
          // Check if this month is in the past (should have a report)
          const now = new Date();
          const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          if (monthDate < currentMonth) {
            status = 'missing';
          }
        }

        monthStatuses[col.key] = status;
      });

      return {
        key: student.id || index,
        studentName: student?.user?.name || student.name || 'Unknown',
        rollNumber: student?.user?.rollNumber || student.rollNumber || student.collegeId || '',
        internship: internshipDisplay,
        internshipType,
        ...monthStatuses,
      };
    });
  }, [students, monthlyReports, monthColumns]);

  // Render status cell
  const renderStatusCell = (status) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircleOutlined style={{ color: '#10b981', fontSize: '18px' }} />;
      case 'SUBMITTED':
        return <CheckCircleOutlined style={{ color: '#3b82f6', fontSize: '18px' }} />;
      case 'DRAFT':
        return <CloseCircleOutlined style={{ color: '#f59e0b', fontSize: '18px' }} />;
      case 'REJECTED':
        return <CloseCircleOutlined style={{ color: '#ef4444', fontSize: '18px' }} />;
      case 'missing':
        return <CloseCircleOutlined style={{ color: '#ef4444', fontSize: '18px' }} />;
      case 'na':
        return <Text type="secondary">N/A</Text>;
      case 'future':
        return <MinusOutlined style={{ color: '#d1d5db', fontSize: '14px' }} />;
      default:
        return <MinusOutlined style={{ color: '#d1d5db', fontSize: '14px' }} />;
    }
  };

  // Table columns
  const columns = [
    {
      title: 'Student',
      dataIndex: 'studentName',
      key: 'studentName',
      fixed: 'left',
      width: 180,
      sorter: (a, b) => a.studentName.localeCompare(b.studentName),
      render: (name, record) => (
        <div>
          <div className="font-semibold">{name}</div>
          <div className="text-xs text-gray-500">{record.rollNumber}</div>
        </div>
      ),
    },
    {
      title: 'Internship',
      dataIndex: 'internship',
      key: 'internship',
      width: 250,
      render: (text, record) => (
        <div>
          <div className="text-sm">{text}</div>
          <div className="text-xs text-gray-400">({record.internshipType})</div>
        </div>
      ),
    },
    ...monthColumns.map(col => ({
      title: col.label,
      dataIndex: col.key,
      key: col.key,
      width: 100,
      align: 'center',
      render: (status) => renderStatusCell(status),
    })),
  ];

  return (
    <Modal
      title={<Title level={4} style={{ margin: 0 }}>Monthly Reports Overview</Title>}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1200}
      centered
      styles={{
        body: { padding: '24px', maxHeight: '70vh', overflowY: 'auto' },
      }}
    >
      {/* Pending Reports Summary */}
      {pendingReportsSummary.length > 0 && (
        <Alert
          type="warning"
          icon={<ExclamationCircleOutlined />}
          message={
            <div>
              <Text strong>Pending Reports Summary</Text>
              <div className="mt-2 flex flex-wrap !gap-2">
                {pendingReportsSummary.map((item, idx) => (
                  <Tag
                    key={idx}
                    style={{
                      borderRadius: '12px',
                      padding: '2px 12px',
                      backgroundColor: '#fef3c7',
                      color: '#f59e0b',
                      border: '1px solid #f59e0b',
                    }}
                  >
                    {item.label}: {item.count} student{item.count > 1 ? 's' : ''}
                  </Tag>
                ))}
              </div>
            </div>
          }
          className="mb-4 rounded-lg"
          style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7' }}
        />
      )}

      {/* Table */}
      <Table
        columns={columns}
        dataSource={tableData}
        pagination={false}
        scroll={{ x: 1200 }}
        size="middle"
        bordered
        className="monthly-reports-table"
      />

      {/* Legend */}
      <div className="mt-4 flex flex-wrap !gap-4 text-sm">
        <div className="flex items-center !gap-2">
          <CheckCircleOutlined style={{ color: '#10b981' }} />
          <span>Approved</span>
        </div>
        <div className="flex items-center !gap-2">
          <CheckCircleOutlined style={{ color: '#3b82f6' }} />
          <span>Submitted</span>
        </div>
        {/* <div className="flex items-center !gap-2">
          <CloseCircleOutlined style={{ color: '#f59e0b' }} />
          <span>Draft/Pending</span>
        </div> */}
        <div className="flex items-center !gap-2">
          <CloseCircleOutlined style={{ color: '#ef4444' }} />
          <span>Missing/Rejected</span>
        </div>
        <div className="flex items-center !gap-2">
          <Text type="secondary">N/A</Text>
          <span>Not Applicable</span>
        </div>
      </div>
    </Modal>
  );
};

export default MonthlyReportsOverviewModal;
