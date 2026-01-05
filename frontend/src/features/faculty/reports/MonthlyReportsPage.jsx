import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Input,
  message,
  Badge,
  Tabs,
  Typography,
  Avatar,
  Tooltip,
  Drawer,
  Descriptions,
  theme,
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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  fetchMonthlyReports,
  selectMonthlyReports,
  downloadMonthlyReport,
} from '../store/facultySlice';
import ProfileAvatar from '../../../components/common/ProfileAvatar';

const { Title, Text, Paragraph } = Typography;

const getStatusConfig = (status) => {
  const configs = {
    DRAFT: { color: 'default', label: 'Draft', icon: <FileTextOutlined /> },
    SUBMITTED: { color: 'blue', label: 'Submitted', icon: <ClockCircleOutlined /> },
    UNDER_REVIEW: { color: 'orange', label: 'Under Review', icon: <ClockCircleOutlined /> },
    APPROVED: { color: 'green', label: 'Approved', icon: <CheckCircleOutlined /> },
    REJECTED: { color: 'red', label: 'Rejected', icon: <CloseCircleOutlined /> },
    REVISION_REQUIRED: { color: 'warning', label: 'Revision Required', icon: <FileTextOutlined /> },
  };
  return configs[status] || configs.DRAFT;
};

const MonthlyReportsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { list: reports, loading, total, page, totalPages } = useSelector(selectMonthlyReports);
  const lastFetched = useSelector((state) => state.faculty.lastFetched?.monthlyReports);

  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const handleDownload = async (report) => {
    try {
      const blob = await dispatch(downloadMonthlyReport(report.id)).unwrap();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `monthly_report_${report.application?.student?.user?.name || report.application?.student?.name || 'report'}_${report.reportMonth}_${report.reportYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to download report';
      message.error(errorMessage);
    }
  };

  const handleViewDetails = (report) => {
    setSelectedReport(report);
    setDetailDrawer(true);
  };

  // Filter reports based on tab and search
  const getFilteredReports = () => {
    let filtered = reports || [];

    if (activeTab === 'submitted') {
      filtered = filtered.filter(r => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW');
    } else if (activeTab === 'approved') {
      filtered = filtered.filter(r => r.status === 'APPROVED');
    } else if (activeTab === 'draft') {
      filtered = filtered.filter(r => r.status === 'DRAFT');
    }

    if (searchText) {
      filtered = filtered.filter(r =>
        (r.application?.student?.user?.name || r.application?.student?.name)?.toLowerCase().includes(searchText.toLowerCase()) ||
        (r.application?.student?.user?.rollNumber || r.application?.student?.rollNumber)?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    return filtered;
  };

  const submittedCount = (reports || []).filter(r => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW').length;
  const approvedCount = (reports || []).filter(r => r.status === 'APPROVED').length;
  const draftCount = (reports || []).filter(r => r.status === 'DRAFT').length;

  const columns = [
    {
      title: 'Student',
      key: 'student',
      width: '22%',
      render: (_, record) => {
        const student = record.application?.student;
        return (
          <div className="flex items-center gap-3">
            <ProfileAvatar profileImage={student?.profileImage} style={{ backgroundColor: token.colorPrimary }} />
            <div>
              <div className="font-semibold" style={{ color: token.colorText }}>{student?.user?.name || student?.name || 'Unknown'}</div>
              <div className="text-xs" style={{ color: token.colorTextTertiary }}>{student?.user?.rollNumber || student?.rollNumber}</div>
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
            <div className="font-medium" style={{ color: token.colorText }}>{monthName}</div>
            <div className="text-xs" style={{ color: token.colorTextTertiary }}>{record.reportYear}</div>
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
            <BankOutlined style={{ color: token.colorSuccess }} />
            <span style={{ color: token.colorText }}>{companyName || 'Self-Identified'}</span>
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
        { text: 'Submitted', value: 'SUBMITTED' },
        { text: 'Under Review', value: 'UNDER_REVIEW' },
        { text: 'Approved', value: 'APPROVED' },
        { text: 'Rejected', value: 'REJECTED' },
        { text: 'Revision Required', value: 'REVISION_REQUIRED' },
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
        </Space>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 min-h-screen" style={{ backgroundColor: token.colorBgLayout }}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-3">
                <Title level={2} className="mb-0 text-2xl" style={{ color: token.colorText }}>
                  Monthly Reports
                </Title>
                {lastFetched && (
                  <span className="text-xs" style={{ color: token.colorTextTertiary }}>
                    Updated {new Date(lastFetched).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <Text className="text-sm" style={{ color: token.colorTextSecondary }}>
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
          <Card size="small" className="rounded-xl shadow-sm" style={{ borderColor: token.colorBorder }}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: token.colorPrimaryBg, color: token.colorPrimary }}
              >
                <FileTextOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color: token.colorText }}>{(reports || []).length}</div>
                <div className="text-[10px] uppercase font-bold" style={{ color: token.colorTextTertiary }}>Total Reports</div>
              </div>
            </div>
          </Card>

          <Card size="small" className="rounded-xl shadow-sm" style={{ borderColor: token.colorBorder }}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: token.colorInfoBg, color: token.colorInfo }}
              >
                <ClockCircleOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color: token.colorText }}>{submittedCount}</div>
                <div className="text-[10px] uppercase font-bold" style={{ color: token.colorTextTertiary }}>Submitted</div>
              </div>
            </div>
          </Card>

          <Card size="small" className="rounded-xl shadow-sm" style={{ borderColor: token.colorBorder }}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: token.colorSuccessBg, color: token.colorSuccess }}
              >
                <CheckCircleOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color: token.colorText }}>{approvedCount}</div>
                <div className="text-[10px] uppercase font-bold" style={{ color: token.colorTextTertiary }}>Approved</div>
              </div>
            </div>
          </Card>

        </div>

        {/* Search and Table */}
        <Card className="rounded-2xl shadow-sm overflow-hidden" style={{ borderColor: token.colorBorder }} styles={{ body: { padding: 0 } }}>
          <div className="p-4 border-b" style={{ borderColor: token.colorBorder }}>
            <Input
              placeholder="Search by student name or roll number..."
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="max-w-md rounded-lg h-10"
              allowClear
            />
          </div>

          {/* <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            className="!px-4"
          /> */}

          <Table
            columns={columns}
            dataSource={getFilteredReports()}
            loading={loading}
            rowKey="id"
            scroll={{ x: 'max-content' }}
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

      {/* Detail Drawer */}
      <Drawer
        title={
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center border"
              style={{ backgroundColor: token.colorPrimaryBg, borderColor: token.colorPrimaryBorder }}
            >
              <FileTextOutlined style={{ color: token.colorPrimary }} />
            </div>
            <span className="font-bold" style={{ color: token.colorText }}>Report Details</span>
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
            <div
              className="p-4 rounded-xl border"
              style={{
                backgroundColor: selectedReport.status === 'APPROVED' ? token.colorSuccessBg :
                                selectedReport.status === 'REJECTED' ? token.colorErrorBg :
                                selectedReport.status === 'SUBMITTED' || selectedReport.status === 'UNDER_REVIEW' ? token.colorInfoBg :
                                token.colorFillQuaternary,
                borderColor: selectedReport.status === 'APPROVED' ? token.colorSuccessBorder :
                             selectedReport.status === 'REJECTED' ? token.colorErrorBorder :
                             selectedReport.status === 'SUBMITTED' || selectedReport.status === 'UNDER_REVIEW' ? token.colorInfoBorder :
                             token.colorBorder
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CalendarOutlined style={{ color: token.colorPrimary }} />
                  <span className="font-bold" style={{ color: token.colorText }}>
                    {dayjs().month(selectedReport.reportMonth - 1).format('MMMM')} {selectedReport.reportYear}
                  </span>
                </div>
                <Tag color={getStatusConfig(selectedReport.status).color} icon={getStatusConfig(selectedReport.status).icon}>
                  {getStatusConfig(selectedReport.status).label}
                </Tag>
              </div>
            </div>

            {/* Student Information */}
            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}>
              <div className="px-4 py-3 border-b" style={{ backgroundColor: token.colorFillQuaternary, borderColor: token.colorBorder }}>
                <Text className="text-xs uppercase font-bold flex items-center gap-2" style={{ color: token.colorTextTertiary }}>
                  <UserOutlined style={{ color: token.colorPrimary }} /> Student Information
                </Text>
              </div>
              <div className="p-4">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Name">
                    <Text strong>{selectedReport.application?.student?.user?.name || selectedReport.application?.student?.name}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Roll Number">
                    {selectedReport.application?.student?.user?.rollNumber || selectedReport.application?.student?.rollNumber}
                  </Descriptions.Item>
                  <Descriptions.Item label="Company">
                    {selectedReport.application?.internship?.industry?.companyName || selectedReport.application?.companyName || 'Self-Identified'}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </div>

            {/* Report Details */}
            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}>
              <div className="px-4 py-3 border-b" style={{ backgroundColor: token.colorFillQuaternary, borderColor: token.colorBorder }}>
                <Text className="text-xs uppercase font-bold flex items-center gap-2" style={{ color: token.colorTextTertiary }}>
                  <FileTextOutlined style={{ color: token.colorSuccess }} /> Report Details
                </Text>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <div>
                    <Text className="text-[10px] uppercase font-bold block mb-1" style={{ color: token.colorTextTertiary }}>Submitted On</Text>
                    <Text style={{ color: token.colorText }}>{selectedReport.submittedAt ? dayjs(selectedReport.submittedAt).format('DD MMM YYYY, HH:mm') : '-'}</Text>
                  </div>
                  <div className="text-right">
                    <Text className="text-[10px] uppercase font-bold block mb-1" style={{ color: token.colorTextTertiary }}>Reviewed On</Text>
                    <Text style={{ color: token.colorText }}>{selectedReport.reviewedAt ? dayjs(selectedReport.reviewedAt).format('DD MMM YYYY, HH:mm') : '-'}</Text>
                  </div>
                </div>
                {selectedReport.reviewComments && (
                  <div>
                    <Text className="text-[10px] uppercase font-bold block mb-1" style={{ color: token.colorTextTertiary }}>Review Comments</Text>
                    <Paragraph className="mb-0 p-3 rounded-lg" style={{ backgroundColor: token.colorFillQuaternary, color: token.colorText }}>
                      {selectedReport.reviewComments}
                    </Paragraph>
                  </div>
                )}
              </div>
            </div>

            {/* Actions - View only mode */}
            <div className="pt-4 flex justify-end gap-3 border-t" style={{ borderColor: token.colorBorder }}>
              {selectedReport.reportFileUrl && (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownload(selectedReport)}
                  className="rounded-lg"
                >
                  Download Report
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default MonthlyReportsPage;

