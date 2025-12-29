import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Table, Button, Tag, Space, Modal, message, Input, DatePicker, Descriptions, Drawer, Typography, Segmented, theme } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SearchOutlined, CalendarOutlined, ReloadOutlined, FileTextOutlined, EnvironmentOutlined, FileImageOutlined } from '@ant-design/icons';
import { fetchVisitLogs, deleteVisitLog, optimisticallyDeleteVisitLog, rollbackVisitLogOperation, fetchAssignedStudents } from '../store/facultySlice';
import UnifiedVisitLogModal from './UnifiedVisitLogModal';
import dayjs from 'dayjs';

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
  const [detailDrawer, setDetailDrawer] = useState(false);
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
        // Store previous state for rollback
        const previousList = [...visitLogsList];
        const previousTotal = visitLogs?.total || 0;

        // Optimistic update - immediately remove from UI
        dispatch(optimisticallyDeleteVisitLog(id));
        message.success('Visit log deleted successfully');

        try {
          await dispatch(deleteVisitLog(id)).unwrap();
        } catch (error) {
          // Rollback on failure
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
        log.purpose?.toLowerCase().includes(searchText.toLowerCase());

      const matchesDate = !dateRange || (
        dayjs(log.visitDate).isAfter(dateRange[0]) &&
        dayjs(log.visitDate).isBefore(dateRange[1])
      );

      const matchesStatus = statusFilter === 'all' ||
        log.status?.toUpperCase() === statusFilter;

      return matchesSearch && matchesDate && matchesStatus;
    }) || [];
  }, [visitLogsList, searchText, dateRange, statusFilter]);

  // Count drafts for the badge
  const draftCount = useMemo(() => {
    return visitLogsList?.filter(log => log.status?.toUpperCase() === 'DRAFT').length || 0;
  }, [visitLogsList]);

  const columns = useMemo(() => [
    {
      title: 'Visit Date',
      dataIndex: 'visitDate',
      key: 'visitDate',
      render: (date) => dayjs(date).format('DD/MM/YYYY'),
      sorter: (a, b) => dayjs(a.visitDate).unix() - dayjs(b.visitDate).unix(),
    },
    {
      title: 'Student',
      dataIndex: ['student', 'name'],
      key: 'student',
      render: (text, record) => (
        <div>
          <div className="font-medium" style={{ color: token.colorText }}>{text}</div>
          <div className="text-xs" style={{ color: token.colorTextSecondary }}>{record.student?.rollNumber}</div>
        </div>
      ),
    },
    {
      title: 'Company',
      dataIndex: ['company', 'name'],
      key: 'company',
      render: (text) => text || 'N/A',
    },
    {
      title: 'Purpose',
      dataIndex: 'purpose',
      key: 'purpose',
      ellipsis: true,
    },
    {
      title: 'Type',
      dataIndex: 'visitType',
      key: 'visitType',
      render: (type) => {
        const typeConfig = {
          PHYSICAL: { color: 'green', icon: <EnvironmentOutlined /> },
          VIRTUAL: { color: 'blue', icon: null },
          TELEPHONIC: { color: 'orange', icon: null },
        };
        const config = typeConfig[type] || { color: 'default' };
        return (
          <Tag color={config.color}>
            {config.icon} {type}
          </Tag>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        const colors = {
          DRAFT: 'orange',
          SCHEDULED: 'blue',
          IN_PROGRESS: 'processing',
          COMPLETED: 'green',
          CANCELLED: 'red',
        };
        const statusUpper = status?.toUpperCase();
        return (
          <Space>
            <Tag color={colors[statusUpper] || 'default'}>{statusUpper}</Tag>
            {record.signedDocumentUrl && (
              <Tag icon={<FileTextOutlined />} color="cyan">Signed</Tag>
            )}
            {record.visitPhotos?.length > 0 && (
              <Tag icon={<FileImageOutlined />} color="purple">{record.visitPhotos.length}</Tag>
            )}
          </Space>
        );
      },
      filters: [
        { text: 'Draft', value: 'DRAFT' },
        { text: 'Scheduled', value: 'SCHEDULED' },
        { text: 'Completed', value: 'COMPLETED' },
        { text: 'Cancelled', value: 'CANCELLED' },
      ],
      onFilter: (value, record) => record.status?.toUpperCase() === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        const isDraft = record.status?.toUpperCase() === 'DRAFT';
        return (
          <Space>
            <Button
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedLog(record);
                setDetailDrawer(true);
              }}
              size="small"
            >
              View
            </Button>
            <Button
              type={isDraft ? 'primary' : 'default'}
              icon={<EditOutlined />}
              onClick={() => handleOpenModal(record.id, record)}
              size="small"
              style={isDraft ? { backgroundColor: token.colorPrimary } : {}}
            >
              {isDraft ? 'Complete' : 'Edit'}
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
              size="small"
            >
              Delete
            </Button>
          </Space>
        );
      },
    },
  ], [handleDelete, token]);

  return (
    <div className="p-4 md:p-6 min-h-screen" style={{ backgroundColor: token.colorBgLayout }}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center">
            <div 
              className="w-10 h-10 flex items-center justify-center rounded-xl shadow-sm mr-3"
              style={{ backgroundColor: token.colorBgContainer, border: `1px solid ${token.colorBorder}`, color: token.colorPrimary }}
            >
              <CalendarOutlined className="text-lg" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <Title level={2} className="mb-0 text-2xl" style={{ color: token.colorText }}>
                  Visit Logs
                </Title>
                {visitLogsLastFetched && (
                  <span className="text-xs" style={{ color: token.colorTextTertiary }}>
                    Updated {new Date(visitLogsLastFetched).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <Paragraph className="text-sm mb-0" style={{ color: token.colorTextSecondary }}>
                Track and manage industrial visits for assigned students
              </Paragraph>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              icon={<ReloadOutlined spin={isRefreshing} />}
              onClick={handleRefresh}
              loading={isRefreshing}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleOpenModal()}
              className="h-10 rounded-xl font-bold shadow-lg"
              style={{ backgroundColor: token.colorPrimary, boxShadow: `0 4px 6px -1px ${token.colorPrimary}20` }}
            >
              Add Visit Log
            </Button>
          </div>
        </div>

        {/* Status Tabs */}
        <Segmented
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTERS.map(f => ({
            value: f.value,
            label: (
              <Space>
                {f.label}
                {f.value === 'DRAFT' && draftCount > 0 && (
                  <Tag color="orange" className="ml-1">{draftCount}</Tag>
                )}
              </Space>
            ),
          }))}
          style={{ backgroundColor: token.colorBgContainer }}
        />

        {/* Filters */}
        <Card className="rounded-xl shadow-sm" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }} styles={{ body: { padding: '16px' } }}>
          <div className="flex flex-wrap items-center gap-4">
            <Input
              placeholder="Search by student, company, location..."
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="max-w-md rounded-lg h-10"
              style={{ backgroundColor: token.colorBgLayout, borderColor: token.colorBorder }}
              allowClear
            />
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              format="DD/MM/YYYY"
              placeholder={['Start Date', 'End Date']}
              className="rounded-lg h-10"
              style={{ borderColor: token.colorBorder }}
            />
          </div>
        </Card>

        {/* Table Container */}
        <Card className="rounded-2xl shadow-sm overflow-hidden" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }} styles={{ body: { padding: 0 } }}>
          <Table
            columns={columns}
            dataSource={filteredLogs}
            loading={loading}
            rowKey="id"
            scroll={{ x: 'max-content' }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              className: "px-6 py-4",
              showTotal: (total) => `Total ${total} visit logs`,
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
              <EyeOutlined style={{ color: token.colorPrimary }} />
            </div>
            <span className="font-bold" style={{ color: token.colorText }}>Visit Log Details</span>
          </div>
        }
        placement="right"
        size="default"
        onClose={() => {
          setDetailDrawer(false);
          setSelectedLog(null);
        }}
        open={detailDrawer}
        styles={{ mask: { backdropFilter: 'blur(4px)' } }}
        className="rounded-l-2xl overflow-hidden"
      >
        {selectedLog && (
          <div className="space-y-8">
            <div className="rounded-xl border p-4 flex justify-between items-center shadow-sm" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}>
              <div className="flex items-center gap-3">
                <CalendarOutlined style={{ color: token.colorPrimary }} />
                <span className="font-bold" style={{ color: token.colorText }}>{dayjs(selectedLog.visitDate).format('MMMM DD, YYYY')}</span>
              </div>
              <Tag 
                color={selectedLog.status === 'completed' ? 'success' : 'processing'}
                className="rounded-full px-3 font-bold uppercase tracking-widest text-[10px] border-0"
              >
                {selectedLog.status}
              </Tag>
            </div>

            <section>
              <Title level={5} className="!mb-4 text-xs uppercase tracking-widest font-bold" style={{ color: token.colorTextTertiary }}>Student Information</Title>
              <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: token.colorFillQuaternary, borderColor: token.colorBorder }}>
                <Descriptions column={1} size="small" bordered className="custom-descriptions">
                  <Descriptions.Item label={<span className="font-medium" style={{ color: token.colorTextTertiary }}>Name</span>}>
                    <Text strong style={{ color: token.colorText }}>{selectedLog.student?.name}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label={<span className="font-medium" style={{ color: token.colorTextTertiary }}>Roll Number</span>}>
                    {selectedLog.student?.rollNumber}
                  </Descriptions.Item>
                  <Descriptions.Item label={<span className="font-medium" style={{ color: token.colorTextTertiary }}>Email</span>}>
                    {selectedLog.student?.email}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </section>

            <section>
              <Title level={5} className="!mb-4 text-xs uppercase tracking-widest font-bold" style={{ color: token.colorTextTertiary }}>Visit Details</Title>
              <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: token.colorFillQuaternary, borderColor: token.colorBorder }}>
                <Descriptions column={1} size="small" bordered className="custom-descriptions">
                  <Descriptions.Item label={<span className="font-medium" style={{ color: token.colorTextTertiary }}>Type</span>}>
                    <Tag color={selectedLog.visitType === 'PHYSICAL' ? 'green' : 'blue'}>
                      {selectedLog.visitType}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label={<span className="font-medium" style={{ color: token.colorTextTertiary }}>Location</span>}>
                    <Space>
                      <EnvironmentOutlined />
                      {selectedLog.visitLocation || 'N/A'}
                    </Space>
                  </Descriptions.Item>
                  {selectedLog.latitude && selectedLog.longitude && (
                    <Descriptions.Item label={<span className="font-medium" style={{ color: token.colorTextTertiary }}>GPS Coordinates</span>}>
                      <Text code>{selectedLog.latitude.toFixed(6)}, {selectedLog.longitude.toFixed(6)}</Text>
                      {selectedLog.gpsAccuracy && (
                        <Text type="secondary" className="ml-2">(±{selectedLog.gpsAccuracy.toFixed(0)}m)</Text>
                      )}
                    </Descriptions.Item>
                  )}
                  <Descriptions.Item label={<span className="font-medium" style={{ color: token.colorTextTertiary }}>Company</span>}>
                    <Text strong style={{ color: token.colorText }}>{selectedLog.company?.name || selectedLog.application?.internship?.industry?.companyName || 'N/A'}</Text>
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </section>

            <section>
              <Title level={5} className="!mb-4 text-xs uppercase tracking-widest font-bold" style={{ color: token.colorTextTertiary }}>Notes & Observations</Title>
              <div className="space-y-4">
                <div className="p-4 rounded-xl border" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}>
                  <Paragraph className="text-sm mb-0" style={{ color: token.colorText }}>
                    {selectedLog.observationsAboutStudent || selectedLog.notes || selectedLog.observations || 'No notes recorded'}
                  </Paragraph>
                </div>
              </div>
            </section>

            {/* Documents Section */}
            {(selectedLog.signedDocumentUrl || selectedLog.visitPhotos?.length > 0) && (
              <section>
                <Title level={5} className="!mb-4 text-xs uppercase tracking-widest font-bold" style={{ color: token.colorTextTertiary }}>Documents</Title>
                <div className="space-y-3">
                  {selectedLog.signedDocumentUrl && (
                    <Button
                      icon={<FileTextOutlined />}
                      onClick={() => window.open(selectedLog.signedDocumentUrl, '_blank')}
                      className="w-full justify-start"
                    >
                      View Signed Document
                    </Button>
                  )}
                  {selectedLog.visitPhotos?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedLog.visitPhotos.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt={`Visit photo ${idx + 1}`}
                          className="w-16 h-16 object-cover rounded-lg cursor-pointer border"
                          style={{ borderColor: token.colorBorder }}
                          onClick={() => window.open(url, '_blank')}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            <div className="pt-6 flex justify-end gap-3 border-t" style={{ borderColor: token.colorBorder }}>
              <Button
                onClick={() => setDetailDrawer(false)}
                className="rounded-xl px-6 h-10 font-medium"
              >
                Close
              </Button>
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => {
                  setDetailDrawer(false);
                  handleOpenModal(selectedLog.id, selectedLog);
                }}
                className="rounded-xl px-6 h-10 font-bold border-0"
                style={{ backgroundColor: token.colorPrimary }}
              >
                {selectedLog.status?.toUpperCase() === 'DRAFT' ? 'Complete Visit' : 'Edit Log'}
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      <UnifiedVisitLogModal
        visible={modalOpen}
        onClose={handleCloseModal}
        onSuccess={handleModalSuccess}
        students={assignedStudents}
        visitLogId={editingVisitLogId}
        existingData={editingVisitData}
      />
    </div>
  );
});

VisitLogList.displayName = 'VisitLogList';

export default VisitLogList;