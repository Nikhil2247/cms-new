import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Table, Button, Tag, Space, Modal, message, Input, DatePicker, Typography, Segmented, theme, Row, Col, Empty } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SearchOutlined, CalendarOutlined, ReloadOutlined, FileTextOutlined, EnvironmentOutlined, FileImageOutlined, UserOutlined, ProjectOutlined, MessageOutlined } from '@ant-design/icons';
import { fetchVisitLogs, deleteVisitLog, optimisticallyDeleteVisitLog, rollbackVisitLogOperation, fetchAssignedStudents } from '../store/facultySlice';
import UnifiedVisitLogModal from './UnifiedVisitLogModal';
import dayjs from 'dayjs';
import { openFileWithPresignedUrl } from '../../../utils/imageUtils';

const { RangePicker } = DatePicker;
const { Title, Text, Paragraph } = Typography;

const STATUS_FILTERS = [
  { value: 'all', label: 'All Visits' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'SCHEDULED', label: 'Scheduled' },
];

const VisitLogList = React.memo(() => {
  const dispatch = useDispatch();
  const { token } = theme.useToken();
  const { visitLogs, lastFetched, students } = useSelector((state) => state.faculty);
  const { list: visitLogsList = [], loading } = visitLogs || {};
  const assignedStudents = students?.list || [];
  const visitLogsLastFetched = lastFetched?.visitLogs;
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVisitLogId, setEditingVisitLogId] = useState(null);
  const [editingVisitData, setEditingVisitData] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleOpenModal = (visitLogId = null, visitData = null) => {
    setEditingVisitLogId(visitLogId);
    setEditingVisitData(visitData);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingVisitLogId(null);
    setEditingVisitData(null);
  };

  const handleModalSuccess = () => {
    dispatch(fetchVisitLogs({ forceRefresh: true }));
    handleCloseModal();
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await dispatch(fetchVisitLogs({ forceRefresh: true })).unwrap();
      message.success('Data refreshed successfully');
    } catch (error) {
      message.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchVisitLogs());
    dispatch(fetchAssignedStudents());
  }, [dispatch]);

  const handleDelete = useCallback((id) => {
    Modal.confirm({
      title: 'Delete Visit Log',
      content: 'Are you sure you want to delete this visit log? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        const previousList = [...visitLogsList];
        const previousTotal = visitLogs?.total || 0;
        dispatch(optimisticallyDeleteVisitLog(id));
        message.success('Visit log deleted successfully');
        try {
          await dispatch(deleteVisitLog(id)).unwrap();
        } catch (error) {
          dispatch(rollbackVisitLogOperation({ list: previousList, total: previousTotal }));
          message.error(error?.message || 'Failed to delete visit log');
        }
      },
    });
  }, [dispatch, visitLogsList, visitLogs?.total]);

  const filteredLogs = useMemo(() => {
    return visitLogsList?.filter(log => {
      const matchesSearch = !searchText ||
        log.student?.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        log.company?.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        log.visitLocation?.toLowerCase().includes(searchText.toLowerCase()) ||
        log.titleOfProjectWork?.toLowerCase().includes(searchText.toLowerCase());
      const matchesDate = !dateRange || (
        dayjs(log.visitDate).isAfter(dateRange[0]) &&
        dayjs(log.visitDate).isBefore(dateRange[1])
      );
      const matchesStatus = statusFilter === 'all' || log.status?.toUpperCase() === statusFilter;
      return matchesSearch && matchesDate && matchesStatus;
    }) || [];
  }, [visitLogsList, searchText, dateRange, statusFilter]);

  const draftCount = useMemo(() => {
    return visitLogsList?.filter(log => log.status?.toUpperCase() === 'DRAFT').length || 0;
  }, [visitLogsList]);

  const columns = useMemo(() => [
    {
      title: 'Visit Date',
      dataIndex: 'visitDate',
      key: 'visitDate',
      width: 120,
      render: (date) => dayjs(date).format('DD MMM YYYY'),
      sorter: (a, b) => dayjs(a.visitDate).unix() - dayjs(b.visitDate).unix(),
    },
    {
      title: 'Student',
      dataIndex: ['student', 'name'],
      key: 'student',
      width: 180,
      render: (text, record) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-xs text-gray-500">{record.student?.rollNumber}</div>
        </div>
      ),
    },
    {
      title: 'Company',
      key: 'company',
      width: 180,
      ellipsis: true,
      render: (_, record) => record.company?.name || record.application?.internship?.industry?.companyName || '-',
    },
    {
      title: 'Visit Type',
      dataIndex: 'visitType',
      key: 'visitType',
      width: 120,
      render: (type) => {
        const colors = { PHYSICAL: 'green', VIRTUAL: 'blue', TELEPHONIC: 'orange' };
        return <Tag color={colors[type] || 'default'}>{type}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status, record) => {
        const colors = { DRAFT: 'orange', SCHEDULED: 'blue', IN_PROGRESS: 'processing', COMPLETED: 'green', CANCELLED: 'red' };
        return (
          <Space>
            <Tag color={colors[status?.toUpperCase()] || 'default'}>{status}</Tag>
            {record.visitPhotos?.length > 0 && <Tag color="purple">{record.visitPhotos.length} Photos</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 280,
      fixed: 'right',
      render: (_, record) => {
        const isDraft = record.status?.toUpperCase() === 'DRAFT';
        return (
          <Space>
            <Button icon={<EyeOutlined />} onClick={() => { setSelectedLog(record); setDetailModalVisible(true); }}>
              View
            </Button>
            <Button type={isDraft ? 'primary' : 'default'} icon={<EditOutlined />} onClick={() => handleOpenModal(record.id, record)}>
              {isDraft ? 'Complete' : 'Edit'}
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
              Delete
            </Button>
          </Space>
        );
      },
    },
  ], [handleDelete]);

  // Section component for Modal
  const DetailSection = ({ icon, title, children }) => (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: token.colorPrimaryBg }}>
          {React.cloneElement(icon, { style: { color: token.colorPrimary, fontSize: '12px' } })}
        </div>
        <Text strong className="text-xs uppercase tracking-wide" style={{ color: token.colorTextSecondary }}>{title}</Text>
      </div>
      <div className="rounded-lg p-3" style={{ backgroundColor: token.colorBgLayout, border: `1px solid ${token.colorBorderSecondary}` }}>
        {children}
      </div>
    </div>
  );

  // Info row component for Modal
  const InfoRow = ({ label, value, fullWidth }) => (
    <Col span={fullWidth ? 24 : 12} className="mb-2">
      <Text className="text-[10px] block text-gray-400 mb-0.5">{label}</Text>
      <Text className="text-sm">{value || <span className="text-gray-300">-</span>}</Text>
    </Col>
  );

  return (
    <div className="p-6 min-h-screen" style={{ backgroundColor: token.colorBgLayout }}>
      <div className="max-w-7xl mx-auto !space-y-4">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <Title level={3} className="!mb-1">Visit Logs</Title>
            <Text type="secondary">Track and manage industrial visits for assigned students</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined spin={isRefreshing} />} onClick={handleRefresh} loading={isRefreshing}>
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
              Add Visit Log
            </Button>
          </Space>
        </div>

        {/* Status Tabs */}
        <Segmented
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTERS.map(f => ({
            value: f.value,
            label: <span>{f.label} {f.value === 'DRAFT' && draftCount > 0 && <Tag color="orange">{draftCount}</Tag>}</span>,
          }))}
        />

        {/* Filters */}
        <Card className="rounded-xl shadow-sm">
          <Space wrap size="middle">
            <Input
              placeholder="Search by student, company, location..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: 300 }}
            />
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              format="DD/MM/YYYY"
            />
          </Space>
        </Card>

        {/* Table */}
        <Card className="rounded-xl shadow-sm" bodyStyle={{ padding: 0 }}>
          <Table
            columns={columns}
            dataSource={filteredLogs}
            loading={loading}
            rowKey="id"
            scroll={{ x: 1100 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} visit logs`,
            }}
          />
        </Card>
      </div>

      {/* Detail Modal */}
      <Modal
        title={<div className="flex items-center gap-2"><EyeOutlined style={{ color: token.colorPrimary }} /><span>Visit Log Details</span></div>}
        open={detailModalVisible}
        onCancel={() => { setDetailModalVisible(false); setSelectedLog(null); }}
        width={700}
        footer={
          <Space>
            <Button onClick={() => setDetailModalVisible(false)}>Close</Button>
            <Button type="primary" icon={<EditOutlined />} onClick={() => { setDetailModalVisible(false); handleOpenModal(selectedLog?.id, selectedLog); }}>
              {selectedLog?.status?.toUpperCase() === 'DRAFT' ? 'Complete Visit' : 'Edit'}
            </Button>
          </Space>
        }
      >
        {selectedLog ? (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {/* Status Header */}
            <div className="rounded-lg p-3 flex justify-between items-center" style={{ backgroundColor: token.colorBgLayout }}>
              <Space>
                <CalendarOutlined />
                <Text strong>{dayjs(selectedLog.visitDate).format('dddd, DD MMMM YYYY')}</Text>
              </Space>
              <Tag color={selectedLog.status?.toUpperCase() === 'COMPLETED' ? 'success' : 'orange'}>{selectedLog.status}</Tag>
            </div>

            {/* Student Info */}
            <DetailSection icon={<UserOutlined />} title="Student Information">
              <Row gutter={12}>
                <InfoRow label="Name" value={selectedLog.student?.name} />
                <InfoRow label="Roll Number" value={selectedLog.student?.rollNumber} />
                <InfoRow label="Email" value={selectedLog.student?.email} fullWidth />
              </Row>
            </DetailSection>

            {/* Visit Details */}
            <DetailSection icon={<EnvironmentOutlined />} title="Visit Details">
              <Row gutter={12}>
                <InfoRow label="Visit Type" value={<Tag color={selectedLog.visitType === 'PHYSICAL' ? 'green' : 'blue'}>{selectedLog.visitType}</Tag>} />
                <InfoRow label="Location" value={selectedLog.visitLocation} />
                <InfoRow label="Company" value={selectedLog.company?.name || selectedLog.application?.internship?.industry?.companyName} />
                {selectedLog.latitude && <InfoRow label="GPS" value={<Text code>{selectedLog.latitude?.toFixed(4)}, {selectedLog.longitude?.toFixed(4)}</Text>} />}
              </Row>
            </DetailSection>

            {/* Project Information */}
            <DetailSection icon={<ProjectOutlined />} title="Project Information">
              <Row gutter={12}>
                <InfoRow label="Title of Project/Work" value={selectedLog.titleOfProjectWork} fullWidth />
                <InfoRow label="Assistance Required from Institute" value={selectedLog.assistanceRequiredFromInstitute} fullWidth />
                <InfoRow label="Response from Organisation" value={selectedLog.responseFromOrganisation} fullWidth />
                <InfoRow label="Remarks of Organisation Supervisor" value={selectedLog.remarksOfOrganisationSupervisor} fullWidth />
                <InfoRow label="Significant Change in Plan" value={selectedLog.significantChangeInPlan} fullWidth />
              </Row>
            </DetailSection>

            {/* Observations & Feedback */}
            <DetailSection icon={<MessageOutlined />} title="Observations & Feedback">
              <div className="space-y-3">
                <div>
                  <Text className="text-[10px] block text-gray-400 mb-1">Observations about Student</Text>
                  <div className="p-2 rounded bg-white">
                    <Paragraph className="!mb-0 text-sm">{selectedLog.observationsAboutStudent || <span className="text-gray-300">No observations</span>}</Paragraph>
                  </div>
                </div>
                <div>
                  <Text className="text-[10px] block text-gray-400 mb-1">Feedback Shared with Student</Text>
                  <div className="p-2 rounded bg-white">
                    <Paragraph className="!mb-0 text-sm">{selectedLog.feedbackSharedWithStudent || <span className="text-gray-300">No feedback</span>}</Paragraph>
                  </div>
                </div>
                {selectedLog.notes && (
                  <div>
                    <Text className="text-[10px] block text-gray-400 mb-1">Additional Notes</Text>
                    <div className="p-2 rounded bg-white">
                      <Paragraph className="!mb-0 text-sm">{selectedLog.notes}</Paragraph>
                    </div>
                  </div>
                )}
              </div>
            </DetailSection>

            {/* Documents */}
            {(selectedLog.signedDocumentUrl || selectedLog.visitPhotos?.length > 0) && (
              <DetailSection icon={<FileImageOutlined />} title="Documents & Photos">
                <div className="space-y-2">
                  {selectedLog.signedDocumentUrl && (
                    <Button icon={<FileTextOutlined />} onClick={() => openFileWithPresignedUrl(selectedLog.signedDocumentUrl)}>
                      View Signed Document
                    </Button>
                  )}
                  {selectedLog.visitPhotos?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedLog.visitPhotos.map((url, idx) => (
                        <img key={idx} src={url} alt={`Photo ${idx + 1}`} className="w-16 h-16 object-cover rounded cursor-pointer border hover:opacity-80" onClick={() => openFileWithPresignedUrl(url)} />
                      ))}
                    </div>
                  )}
                </div>
              </DetailSection>
            )}
          </div>
        ) : (
          <Empty description="No visit log selected" />
        )}
      </Modal>

      <UnifiedVisitLogModal visible={modalOpen} onClose={handleCloseModal} onSuccess={handleModalSuccess} students={assignedStudents} visitLogId={editingVisitLogId} existingData={editingVisitData} />
    </div>
  );
});

VisitLogList.displayName = 'VisitLogList';

export default VisitLogList;
