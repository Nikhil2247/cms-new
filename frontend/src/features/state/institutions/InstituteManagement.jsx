import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Table,
  Button,
  Input,
  Typography,
  Tag,
  Space,
  Modal,
  message,
  Tooltip,
  Alert
} from 'antd';
import {
  BankOutlined,
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  GlobalOutlined,
  TeamOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { useDebounce } from 'use-debounce';
import dayjs from 'dayjs';

import InstitutionModal from './InstitutionModal';
import {
  fetchInstitutions,
  deleteInstitution,
  selectInstitutions,
  selectInstitutionsLoading,
  selectInstitutionsPagination,
  fetchDashboardStats,
  selectDashboardStats
} from '../store/stateSlice';

const { Title, Paragraph, Text } = Typography;

const InstituteManagement = () => {
  const dispatch = useDispatch();
  
  // Redux State
  const institutions = useSelector(selectInstitutions);
  const loading = useSelector(selectInstitutionsLoading);
  const pagination = useSelector(selectInstitutionsPagination);
  const dashboardStats = useSelector(selectDashboardStats);

  // Local State
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch] = useDebounce(searchText, 500);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingInstituteId, setEditingInstituteId] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [instituteToDelete, setInstituteToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Initial Fetch
  useEffect(() => {
    fetchData();
    dispatch(fetchDashboardStats());
  }, [dispatch, currentPage, pageSize, debouncedSearch]);

  const fetchData = (force = false) => {
    dispatch(fetchInstitutions({
      page: currentPage,
      limit: pageSize,
      search: debouncedSearch,
      forceRefresh: force
    }));
  };

  const handleRefresh = () => {
    fetchData(true);
    dispatch(fetchDashboardStats({ forceRefresh: true }));
  };

  // Modal Handlers
  const openCreateModal = () => {
    setEditingInstituteId(null);
    setModalVisible(true);
  };

  const openEditModal = (id) => {
    setEditingInstituteId(id);
    setModalVisible(true);
  };

  const handleDeleteClick = (record) => {
    setInstituteToDelete(record);
    setDeleteConfirmText('');
    setDeleteModalVisible(true);
  };

  const handleDeleteConfirm = async () => {
    if (!instituteToDelete) return;
    
    setDeleting(true);
    try {
      await dispatch(deleteInstitution(instituteToDelete.id)).unwrap();
      message.success('Institution deleted successfully');
      setDeleteModalVisible(false);
      setInstituteToDelete(null);
      // Refresh list if needed (handled by redux optimistic update usually, but safe to fetch)
      if (institutions.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    } catch (error) {
      message.error(error.message || 'Failed to delete institution');
    } finally {
      setDeleting(false);
    }
  };

  // Table Columns
  const columns = [
    {
      title: 'Institution Details',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="flex items-start gap-3">
          <div className="mt-1 p-2 rounded-lg bg-surface border border-border text-primary">
            <BankOutlined />
          </div>
          <div>
            <Text strong className="text-text-primary block">{text}</Text>
            <Space size={4} className="text-xs text-text-tertiary">
              <Tag bordered={false} className="m-0 bg-surface text-text-secondary text-[10px]">{record.code}</Tag>
              <span>•</span>
              <span>{record.city}, {record.state}</span>
            </Space>
          </div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => (
        <Tag color="blue" className="rounded-md font-medium">
          {type?.replace('_', ' ') || 'N/A'}
        </Tag>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      width: 250,
      render: (_, record) => (
        <div className="space-y-1 text-sm">
          {record.contactEmail && (
            <div className="flex items-center gap-2 text-text-secondary">
              <div className="w-4 h-4 flex items-center justify-center rounded-full bg-surface text-primary">@</div>
              <span className="truncate max-w-[180px]">{record.contactEmail}</span>
            </div>
          )}
          {record.contactPhone && (
            <div className="flex items-center gap-2 text-text-secondary">
              <div className="w-4 h-4 flex items-center justify-center rounded-full bg-surface text-success">#</div>
              <span>{record.contactPhone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Stats',
      key: 'stats',
      width: 150,
      render: (_, record) => (
        <Space size={16}>
          <Tooltip title="Students">
            <div className="flex items-center gap-1.5 text-text-secondary">
              <TeamOutlined />
              <span>{record._count?.Student ?? record.studentCount ?? 0}</span>
            </div>
          </Tooltip>
          <Tooltip title="Staff">
            <div className="flex items-center gap-1.5 text-text-secondary">
              <SafetyCertificateOutlined />
              <span>{record._count?.users ?? record.facultyCount ?? 0}</span>
            </div>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive) => (
        <Tag 
          color={isActive ? 'success' : 'error'} 
          icon={isActive ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          className="rounded-full px-2"
        >
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record.id)}
            className="text-primary hover:text-primary-600 hover:bg-primary-50"
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteClick(record)}
            className="hover:bg-error-50"
          />
        </Space>
      ),
    },
  ];

  // Calculated stats (fallback if dashboardStats is missing or needs augmentation)
  const stats = useMemo(() => {
    // If we have dashboard stats, use those (mapping fields as best guess based on typical API)
    if (dashboardStats) {
      return {
        total: dashboardStats.totalInstitutions || dashboardStats.institutions?.total || 0,
        active: dashboardStats.activeInstitutions || dashboardStats.institutions?.active || 0,
        inactive: (dashboardStats.institutions?.total || 0) - (dashboardStats.institutions?.active || 0),
        autonomous: dashboardStats.autonomousInstitutions || 0
      };
    }
    // Fallback to current list stats (incomplete but better than nothing)
    return {
      total: pagination?.total || institutions.length,
      active: institutions.filter(i => i.isActive).length,
      inactive: institutions.filter(i => !i.isActive).length,
      autonomous: institutions.filter(i => i.autonomousStatus).length
    };
  }, [dashboardStats, institutions, pagination]);

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="flex items-center">
            <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-surface border border-border text-primary shadow-soft mr-4">
              <BankOutlined className="text-xl" />
            </div>
            <div>
              <Title level={2} className="!mb-0 !text-2xl font-bold text-text-primary">
                Institution Management
              </Title>
              <Paragraph className="!mb-0 text-text-secondary text-sm">
                Manage educational institutions, track performance, and oversee administrative details.
              </Paragraph>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card size="small" className="rounded-2xl border-border shadow-soft hover:shadow-soft-lg transition-all duration-300">
            <div className="flex items-center gap-4 p-2">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                <BankOutlined className="text-xl" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">{stats.total}</div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-text-tertiary">Total Institutes</div>
              </div>
            </div>
          </Card>

          <Card size="small" className="rounded-2xl border-border shadow-soft hover:shadow-soft-lg transition-all duration-300">
            <div className="flex items-center gap-4 p-2">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-success/10 text-success">
                <CheckCircleOutlined className="text-xl" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">{stats.active}</div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-text-tertiary">Active</div>
              </div>
            </div>
          </Card>

          <Card size="small" className="rounded-2xl border-border shadow-soft hover:shadow-soft-lg transition-all duration-300">
            <div className="flex items-center gap-4 p-2">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-error/10 text-error">
                <CloseCircleOutlined className="text-xl" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">{stats.inactive}</div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-text-tertiary">Inactive</div>
              </div>
            </div>
          </Card>

          <Card size="small" className="rounded-2xl border-border shadow-soft hover:shadow-soft-lg transition-all duration-300">
            <div className="flex items-center gap-4 p-2">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-secondary/10 text-secondary-600">
                <GlobalOutlined className="text-xl" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">{stats.autonomous}</div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-text-tertiary">Autonomous</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content Card */}
        <Card 
          className="rounded-3xl border-border shadow-soft overflow-hidden" 
          styles={{ body: { padding: '24px' } }}
        >
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <Input
              placeholder="Search by name, code, or city..."
              prefix={<SearchOutlined className="text-text-tertiary" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="max-w-md h-10 rounded-xl bg-background border-border hover:border-primary focus:border-primary"
              allowClear
            />
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading}
                className="h-10 rounded-xl border-border hover:text-primary hover:border-primary"
              >
                Refresh
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateModal}
                className="h-10 rounded-xl font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40"
              >
                Add Institute
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden bg-surface">
            <Table
              columns={columns}
              dataSource={institutions}
              rowKey="id"
              loading={loading}
              scroll={{ x: 1000 }}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: pagination?.total || 0,
                onChange: (page, size) => {
                  setCurrentPage(page);
                  setPageSize(size);
                },
                showSizeChanger: true,
                showTotal: (total, range) => (
                  <span className="text-text-tertiary">
                    Showing {range[0]}-{range[1]} of {total} institutes
                  </span>
                ),
                className: "px-4 py-4"
              }}
            />
          </div>
        </Card>

        {/* Create/Edit Modal */}
        <InstitutionModal
          open={modalVisible}
          onClose={() => setModalVisible(false)}
          institutionId={editingInstituteId}
          onSuccess={() => handleRefresh()}
        />

        {/* Delete Confirmation Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2 text-error">
              <DeleteOutlined />
              <span className="font-bold">Delete Institute</span>
            </div>
          }
          open={deleteModalVisible}
          onCancel={() => {
            setDeleteModalVisible(false);
            setInstituteToDelete(null);
          }}
          footer={[
            <Button
              key="cancel"
              onClick={() => setDeleteModalVisible(false)}
              className="rounded-lg font-medium"
            >
              Cancel
            </Button>,
            <Button
              key="delete"
              type="primary"
              danger
              loading={deleting}
              disabled={deleteConfirmText !== instituteToDelete?.name}
              onClick={handleDeleteConfirm}
              className="rounded-lg font-bold"
            >
              Delete
            </Button>,
          ]}
          centered
          className="rounded-2xl overflow-hidden"
        >
          {instituteToDelete && (
            <div className="space-y-4">
              <Alert
                message="Warning: Irreversible Action"
                description="This will permanently delete the institution and all associated data including students, faculty, and academic records."
                type="error"
                showIcon
                className="rounded-lg border-error/20 bg-error/5"
              />

              <div>
                <Text className="block mb-2 text-text-primary font-medium">
                  Type <Text code>{instituteToDelete.name}</Text> to confirm:
                </Text>
                <Input
                  placeholder="Type institute name..."
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  status={deleteConfirmText && deleteConfirmText !== instituteToDelete?.name ? "error" : ""}
                  className="rounded-lg h-10"
                />
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default InstituteManagement;