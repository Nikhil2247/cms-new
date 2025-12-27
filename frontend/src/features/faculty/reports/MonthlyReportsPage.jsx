import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  // Removed: Auto-approval implemented - Modal no longer needed
  Input,
  message,
  Badge,
  Tabs,
  Typography,
  Avatar,
  Tooltip,
  Drawer,
  Descriptions,
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  BankOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  fetchMonthlyReports,
  // Removed: Auto-approval implemented - approveMonthlyReport,
  // Removed: Auto-approval implemented - rejectMonthlyReport,
  selectMonthlyReports,
} from '../store/facultySlice';
import facultyService from '../../../services/faculty.service';

const { Title, Text, Paragraph } = Typography;
// Removed: Auto-approval implemented - TextArea no longer needed for review remarks

const getStatusConfig = (status) => {
  const configs = {
    DRAFT: { color: 'default', label: 'Draft', icon: <FileTextOutlined /> },
    APPROVED: { color: 'green', label: 'Approved', icon: <CheckCircleOutlined /> },
  };
  return configs[status] || configs.DRAFT;
};

const MonthlyReportsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list: reports, loading, total, page, totalPages } = useSelector(selectMonthlyReports);
  const lastFetched = useSelector((state) => state.faculty.lastFetched?.monthlyReports);

  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Removed: Auto-approval implemented - review modal state no longer needed
  // const [reviewModal, setReviewModal] = useState({ visible: false, report: null, action: null });
  // const [remarks, setRemarks] = useState('');
  // const [actionLoading, setActionLoading] = useState(false);
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    dispatch(fetchMonthlyReports());
  }, [dispatch]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await dispatch(fetchMonthlyReports({ forceRefresh: true })).unwrap();
      message.success('Data refreshed successfully');
    } catch (error) {
      message.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch]);

  // Removed: Auto-approval implemented - handleApprove and handleReject no longer needed
  // Reports are now automatically approved upon submission

  const handleDownload = async (report) => {
    try {
      const blob = await facultyService.downloadMonthlyReport(report.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `monthly_report_${report.application?.student?.name || 'report'}_${report.reportMonth}_${report.reportYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      message.error('Failed to download report');
    }
  };

  const handleViewDetails = (report) => {
    setSelectedReport(report);
    setDetailDrawer(true);
  };

  // Filter reports based on tab and search
  const getFilteredReports = () => {
    let filtered = reports;

    if (activeTab === 'draft') {
      filtered = reports.filter(r => r.status === 'DRAFT');
    } else if (activeTab === 'approved') {
      filtered = reports.filter(r => r.status === 'APPROVED');
    }

    if (searchText) {
      filtered = filtered.filter(r =>
        r.application?.student?.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        r.application?.student?.rollNumber?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    return filtered;
  };

  const draftCount = reports.filter(r => r.status === 'DRAFT').length;
  const approvedCount = reports.filter(r => r.status === 'APPROVED').length;

  const columns = [
    {
      title: 'Student',
      key: 'student',
      width: '22%',
      render: (_, record) => {
        const student = record.application?.student;
        return (
          <div className="flex items-center gap-3">
            <Avatar icon={<UserOutlined />} className="bg-primary" />
            <div>
              <div className="font-semibold text-text-primary">{student?.name || 'Unknown'}</div>
              <div className="text-xs text-text-tertiary">{student?.rollNumber}</div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Report Period',
      key: 'period',
      width: '15%',
      render: (_, record) => {
        const monthName = dayjs().month(record.reportMonth - 1).format('MMMM');
        return (
          <div>
            <div className="font-medium text-text-primary">{monthName}</div>
            <div className="text-xs text-text-tertiary">{record.reportYear}</div>
          </div>
        );
      },
      sorter: (a, b) => {
        const dateA = new Date(a.reportYear, a.reportMonth - 1);
        const dateB = new Date(b.reportYear, b.reportMonth - 1);
        return dateA - dateB;
      },
    },
    {
      title: 'Company',
      key: 'company',
      width: '18%',
      render: (_, record) => {
        const company = record.application?.internship?.industry;
        const companyName = company?.companyName || record.application?.companyName;
        return (
          <div className="flex items-center gap-2">
            <BankOutlined className="text-success" />
            <span className="text-text-primary">{companyName || 'Self-Identified'}</span>
          </div>
        );
      },
    },
    {
      title: 'Submitted',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: '12%',
      render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : '-',
      sorter: (a, b) => new Date(a.submittedAt) - new Date(b.submittedAt),
    },
    {
      title: 'Status',
      key: 'status',
      width: '13%',
      render: (_, record) => {
        const statusConfig = getStatusConfig(record.status);
        return (
          <Tag color={statusConfig.color} icon={statusConfig.icon}>
            {statusConfig.label}
          </Tag>
        );
      },
      filters: [
        { text: 'Draft', value: 'DRAFT' },
        { text: 'Approved', value: 'APPROVED' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '20%',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>
          {record.reportFileUrl && (
            <Tooltip title="Download">
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleDownload(record)}
              />
            </Tooltip>
          )}
          {/* Removed: Auto-approval implemented - Approve/Reject buttons removed */}
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'all',
      label: (
        <span className="flex items-center gap-2">
          <FileTextOutlined />
          All Reports
          <Badge count={reports.length} showZero className="ml-1" />
        </span>
      ),
    },
    {
      key: 'draft',
      label: (
        <span className="flex items-center gap-2">
          <FileTextOutlined />
          Draft
          <Badge count={draftCount} className="ml-1" />
        </span>
      ),
    },
    {
      key: 'approved',
      label: (
        <span className="flex items-center gap-2">
          <CheckCircleOutlined />
          Approved
          <Badge count={approvedCount} showZero className="ml-1" style={{ backgroundColor: 'rgb(var(--color-success))' }} />
        </span>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/dashboard')}
              className="rounded-lg"
            />
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-primary shadow-sm">
              <FileTextOutlined className="text-lg" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <Title level={2} className="mb-0 text-text-primary text-2xl">
                  Monthly Reports
                </Title>
                {lastFetched && (
                  <span className="text-xs text-text-tertiary">
                    Updated {new Date(lastFetched).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <Text className="text-text-secondary text-sm">
                View student monthly internship reports
              </Text>
            </div>
          </div>

          <Button
            icon={<ReloadOutlined spin={isRefreshing} />}
            onClick={handleRefresh}
            loading={isRefreshing}
            disabled={loading}
            className="rounded-lg"
          >
            Refresh
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card size="small" className="rounded-xl border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                <FileTextOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">{reports.length}</div>
                <div className="text-[10px] uppercase font-bold text-text-tertiary">Total Reports</div>
              </div>
            </div>
          </Card>

          <Card size="small" className="rounded-xl border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-default/10 text-default">
                <FileTextOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">{draftCount}</div>
                <div className="text-[10px] uppercase font-bold text-text-tertiary">Draft</div>
              </div>
            </div>
          </Card>

          <Card size="small" className="rounded-xl border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-success/10 text-success">
                <CheckCircleOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">{approvedCount}</div>
                <div className="text-[10px] uppercase font-bold text-text-tertiary">Approved</div>
              </div>
            </div>
          </Card>

        </div>

        {/* Search and Table */}
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
          <div className="p-4 border-b border-border">
            <Input
              placeholder="Search by student name or roll number..."
              prefix={<SearchOutlined className="text-text-tertiary" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="max-w-md rounded-lg h-10"
              allowClear
            />
          </div>

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            className="px-4"
          />

          <Table
            columns={columns}
            dataSource={getFilteredReports()}
            loading={loading}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} reports`,
              className: 'px-4 py-3',
            }}
            size="middle"
            className="custom-table"
          />
        </Card>
      </div>

      {/* Removed: Auto-approval implemented - Review Modal removed */}

      {/* Detail Drawer */}
      <Drawer
        title={
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <FileTextOutlined className="text-primary" />
            </div>
            <span className="font-bold text-text-primary">Report Details</span>
          </div>
        }
        placement="right"
        size="default"
        onClose={() => {
          setDetailDrawer(false);
          setSelectedReport(null);
        }}
        open={detailDrawer}
        styles={{ mask: { backdropFilter: 'blur(4px)' } }}
      >
        {selectedReport && (
          <div className="space-y-6">
            {/* Status Banner */}
            <div className={`p-4 rounded-xl border ${
              selectedReport.status === 'APPROVED' ? 'bg-success/5 border-success/20' :
              selectedReport.status === 'REJECTED' ? 'bg-error/5 border-error/20' :
              'bg-warning/5 border-warning/20'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CalendarOutlined className="text-primary" />
                  <span className="font-bold text-text-primary">
                    {dayjs().month(selectedReport.reportMonth - 1).format('MMMM')} {selectedReport.reportYear}
                  </span>
                </div>
                <Tag color={getStatusConfig(selectedReport.status).color} icon={getStatusConfig(selectedReport.status).icon}>
                  {getStatusConfig(selectedReport.status).label}
                </Tag>
              </div>
            </div>

            {/* Student Information */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-background-tertiary/30">
                <Text className="text-xs uppercase font-bold text-text-tertiary flex items-center gap-2">
                  <UserOutlined className="text-primary" /> Student Information
                </Text>
              </div>
              <div className="p-4">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Name">
                    <Text strong>{selectedReport.application?.student?.name}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Roll Number">
                    {selectedReport.application?.student?.rollNumber}
                  </Descriptions.Item>
                  <Descriptions.Item label="Company">
                    {selectedReport.application?.internship?.industry?.companyName || selectedReport.application?.companyName || 'Self-Identified'}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </div>

            {/* Report Details */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-background-tertiary/30">
                <Text className="text-xs uppercase font-bold text-text-tertiary flex items-center gap-2">
                  <FileTextOutlined className="text-success" /> Report Details
                </Text>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <div>
                    <Text className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Submitted On</Text>
                    <Text className="text-text-primary">{selectedReport.submittedAt ? dayjs(selectedReport.submittedAt).format('DD MMM YYYY, HH:mm') : '-'}</Text>
                  </div>
                  <div className="text-right">
                    <Text className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Reviewed On</Text>
                    <Text className="text-text-primary">{selectedReport.reviewedAt ? dayjs(selectedReport.reviewedAt).format('DD MMM YYYY, HH:mm') : '-'}</Text>
                  </div>
                </div>
                {selectedReport.reviewComments && (
                  <div>
                    <Text className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Review Comments</Text>
                    <Paragraph className="text-text-primary mb-0 p-3 bg-background-tertiary/30 rounded-lg">
                      {selectedReport.reviewComments}
                    </Paragraph>
                  </div>
                )}
              </div>
            </div>

            {/* Actions - View only mode */}
            <div className="pt-4 flex justify-end gap-3 border-t border-border">
              {selectedReport.reportFileUrl && (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownload(selectedReport)}
                  className="rounded-lg"
                >
                  Download Report
                </Button>
              )}
              {/* Removed: Auto-approval implemented - Approve/Reject buttons removed */}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default MonthlyReportsPage;
