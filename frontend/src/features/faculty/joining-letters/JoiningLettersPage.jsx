import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Input,
  message,
  Badge,
  Tabs,
  Typography,
  Avatar,
  Tooltip,
  Drawer,
  Descriptions,
  Empty,
  Image,
  Upload,
  Select,
} from 'antd';
import {
  FileProtectOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  BankOutlined,
  DownloadOutlined,
  DeleteOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  fetchJoiningLetters,
  verifyJoiningLetter,
  rejectJoiningLetter,
  deleteJoiningLetter,
  uploadJoiningLetter,
  fetchAssignedStudents,
  selectJoiningLetters,
  selectLastFetched,
  optimisticallyUpdateJoiningLetter,
  rollbackJoiningLetterOperation,
} from '../store/facultySlice';
import { generateTxnId, snapshotManager, optimisticToast } from '../../../store/optimisticMiddleware';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const getStatusConfig = (isVerified) => {
  if (isVerified === 'VERIFIED') {
    return { color: 'green', label: 'Verified', icon: <CheckCircleOutlined /> };
  }
  if (isVerified === 'REJECTED') {
    return { color: 'red', label: 'Rejected', icon: <CloseCircleOutlined /> };
  }
  return { color: 'orange', label: 'Pending Review', icon: <ClockCircleOutlined /> };
};

const JoiningLettersPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list: letters, loading, total } = useSelector(selectJoiningLetters);
  const lastFetched = useSelector(selectLastFetched);
  const joiningLettersLastFetched = lastFetched?.joiningLetters;

  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [reviewModal, setReviewModal] = useState({ visible: false, letter: null, action: null });
  const [remarks, setRemarks] = useState('');
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [uploadModal, setUploadModal] = useState({ visible: false, student: null });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    dispatch(fetchJoiningLetters({ forceRefresh: true }));
    // Fetch students for the upload dropdown
    dispatch(fetchAssignedStudents({ limit: 1000 })).then((result) => {
      if (result.payload && result.payload.students) {
        setStudents(result.payload.students);
      }
    });
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(fetchJoiningLetters({ forceRefresh: true }));
  };

  const handleVerify = async () => {
    if (!reviewModal.letter) return;

    const txnId = generateTxnId();
    const currentLetterId = reviewModal.letter.id;

    // Save snapshot of current state
    const currentLettersList = letters || [];
    snapshotManager.save(txnId, 'faculty', { joiningLetters: { list: currentLettersList } });

    // Show loading toast
    optimisticToast.loading(txnId, 'Verifying joining letter...');

    // Close modal and clear form
    setReviewModal({ visible: false, letter: null, action: null });
    setRemarks('');

    // Optimistically update the letter status
    dispatch(optimisticallyUpdateJoiningLetter({
      id: currentLetterId,
      updates: {
        reviewedAt: new Date().toISOString(),
        reviewRemarks: remarks || 'Verified',
      }
    }));

    try {
      await dispatch(verifyJoiningLetter({ letterId: currentLetterId, remarks })).unwrap();
      optimisticToast.success(txnId, 'Joining letter verified successfully');
      snapshotManager.delete(txnId);
      handleRefresh();
    } catch (error) {
      optimisticToast.error(txnId, error || 'Failed to verify joining letter');

      // Rollback on error
      const snapshot = snapshotManager.get(txnId);
      if (snapshot) {
        dispatch(rollbackJoiningLetterOperation(snapshot.state.joiningLetters));
        snapshotManager.delete(txnId);
      }
    }
  };

  const handleReject = async () => {
    if (!reviewModal.letter || !remarks.trim()) {
      message.warning('Please provide a reason for rejection');
      return;
    }

    const txnId = generateTxnId();
    const currentLetterId = reviewModal.letter.id;
    const rejectionReason = remarks;

    // Save snapshot of current state
    const currentLettersList = letters || [];
    snapshotManager.save(txnId, 'faculty', { joiningLetters: { list: currentLettersList } });

    // Show loading toast
    optimisticToast.loading(txnId, 'Rejecting joining letter...');

    // Close modal and clear form
    setReviewModal({ visible: false, letter: null, action: null });
    setRemarks('');

    // Optimistically update the letter status
    dispatch(optimisticallyUpdateJoiningLetter({
      id: currentLetterId,
      updates: {
        reviewedAt: new Date().toISOString(),
        reviewRemarks: `rejected: ${rejectionReason}`,
      }
    }));

    try {
      await dispatch(rejectJoiningLetter({ letterId: currentLetterId, reason: rejectionReason })).unwrap();
      optimisticToast.success(txnId, 'Joining letter rejected successfully');
      snapshotManager.delete(txnId);
      handleRefresh();
    } catch (error) {
      optimisticToast.error(txnId, error || 'Failed to reject joining letter');

      // Rollback on error
      const snapshot = snapshotManager.get(txnId);
      if (snapshot) {
        dispatch(rollbackJoiningLetterOperation(snapshot.state.joiningLetters));
        snapshotManager.delete(txnId);
      }
    }
  };

  const handleDelete = (letter) => {
    Modal.confirm({
      title: 'Delete Joining Letter',
      content: 'Are you sure you want to delete this joining letter? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      centered: true,
      onOk: async () => {
        try {
          await dispatch(deleteJoiningLetter(letter.id)).unwrap();
          message.success('Joining letter deleted successfully');
          handleRefresh();
        } catch (error) {
          message.error(error || 'Failed to delete joining letter');
        }
      },
    });
  };

  const handleView = (letter) => {
    if (letter.joiningLetterUrl) {
      window.open(letter.joiningLetterUrl, '_blank');
    } else {
      message.info('No document available');
    }
  };

  const handleViewDetails = (letter) => {
    setSelectedLetter(letter);
    setDetailDrawer(true);
  };

  const handleUploadClick = () => {
    setUploadModal({ visible: true, student: null });
    setSelectedFile(null);
  };

  const handleFileChange = (info) => {
    if (info.fileList.length > 0) {
      setSelectedFile(info.fileList[0].originFileObj);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!uploadModal.student || !selectedFile) {
      message.warning('Please select a student and file');
      return;
    }

    setUploadLoading(true);
    try {
      // Find the application for the selected student
      const studentData = students.find(s => s.student.id === uploadModal.student);
      if (!studentData || !studentData.student.internshipApplications || studentData.student.internshipApplications.length === 0) {
        message.error('No active internship application found for this student');
        setUploadLoading(false);
        return;
      }

      // Get the most recent application
      const application = studentData.student.internshipApplications[0];

      await dispatch(uploadJoiningLetter({ applicationId: application.id, file: selectedFile })).unwrap();
      message.success('Joining letter uploaded successfully');
      setUploadModal({ visible: false, student: null });
      setSelectedFile(null);
      handleRefresh();
    } catch (error) {
      message.error(error || 'Failed to upload joining letter');
    } finally {
      setUploadLoading(false);
    }
  };

  // Determine verification status based on reviewedAt
  const getLetterStatus = (letter) => {
    if (letter.reviewedAt && letter.reviewRemarks?.includes('reject')) {
      return 'REJECTED';
    }
    if (letter.reviewedAt) {
      return 'VERIFIED';
    }
    return 'PENDING';
  };

  // Filter letters based on tab and search
  const getFilteredLetters = () => {
    let filtered = letters;

    if (activeTab === 'pending') {
      filtered = letters.filter(l => !l.reviewedAt);
    } else if (activeTab === 'verified') {
      filtered = letters.filter(l => l.reviewedAt && !l.reviewRemarks?.toLowerCase().includes('reject'));
    } else if (activeTab === 'rejected') {
      filtered = letters.filter(l => l.reviewedAt && l.reviewRemarks?.toLowerCase().includes('reject'));
    }

    if (searchText) {
      filtered = filtered.filter(l =>
        l.student?.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        l.student?.rollNumber?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    return filtered;
  };

  const pendingCount = letters.filter(l => !l.reviewedAt).length;
  const verifiedCount = letters.filter(l => l.reviewedAt && !l.reviewRemarks?.toLowerCase().includes('reject')).length;
  const rejectedCount = letters.filter(l => l.reviewedAt && l.reviewRemarks?.toLowerCase().includes('reject')).length;

  const columns = [
    {
      title: 'Student',
      key: 'student',
      width: '22%',
      render: (_, record) => {
        const student = record.student;
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
      title: 'Company',
      key: 'company',
      width: '20%',
      render: (_, record) => {
        const company = record.internship?.industry;
        const companyName = company?.companyName || record.companyName;
        return (
          <div className="flex items-center gap-2">
            <BankOutlined className="text-success" />
            <span className="text-text-primary">{companyName || 'Self-Identified'}</span>
          </div>
        );
      },
    },
    {
      title: 'Uploaded',
      dataIndex: 'joiningLetterUploadedAt',
      key: 'uploaded',
      width: '12%',
      render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : '-',
      sorter: (a, b) => new Date(a.joiningLetterUploadedAt) - new Date(b.joiningLetterUploadedAt),
    },
    {
      title: 'Reviewed',
      dataIndex: 'reviewedAt',
      key: 'reviewed',
      width: '12%',
      render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Status',
      key: 'status',
      width: '14%',
      render: (_, record) => {
        const status = getLetterStatus(record);
        const statusConfig = getStatusConfig(status);
        return (
          <Tag color={statusConfig.color} icon={statusConfig.icon}>
            {statusConfig.label}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '20%',
      render: (_, record) => {
        const isPending = !record.reviewedAt;
        return (
          <Space size="small">
            <Tooltip title="View Details">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleViewDetails(record)}
              />
            </Tooltip>
            {record.joiningLetterUrl && (
              <Tooltip title="View Document">
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => handleView(record)}
                />
              </Tooltip>
            )}
            {isPending && (
              <>
                <Tooltip title="Verify">
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckCircleOutlined className="text-green-500" />}
                    onClick={() => setReviewModal({ visible: true, letter: record, action: 'verify' })}
                  />
                </Tooltip>
                <Tooltip title="Reject">
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseCircleOutlined className="text-red-500" />}
                    onClick={() => setReviewModal({ visible: true, letter: record, action: 'reject' })}
                  />
                </Tooltip>
              </>
            )}
            <Tooltip title="Delete">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  const tabItems = [
    {
      key: 'all',
      label: (
        <span className="flex items-center gap-2">
          <FileProtectOutlined />
          All Letters
          <Badge count={letters.length} showZero className="ml-1" />
        </span>
      ),
    },
    {
      key: 'pending',
      label: (
        <span className="flex items-center gap-2">
          <ClockCircleOutlined />
          Pending Review
          <Badge count={pendingCount} className="ml-1" />
        </span>
      ),
    },
    {
      key: 'verified',
      label: (
        <span className="flex items-center gap-2">
          <CheckCircleOutlined />
          Verified
          <Badge count={verifiedCount} showZero className="ml-1" style={{ backgroundColor: 'rgb(var(--color-success))' }} />
        </span>
      ),
    },
    {
      key: 'rejected',
      label: (
        <span className="flex items-center gap-2">
          <CloseCircleOutlined />
          Rejected
          <Badge count={rejectedCount} showZero className="ml-1" style={{ backgroundColor: 'rgb(var(--color-error))' }} />
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
            <div>
              <div className="flex items-center gap-3">
                <Title level={2} className="mb-0 text-text-primary text-2xl">
                  Joining Letters
                </Title>
                {joiningLettersLastFetched && (
                  <span className="text-xs text-text-tertiary">
                    Updated {new Date(joiningLettersLastFetched).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <Text className="text-text-secondary text-sm">
                Verify and review student joining letter documents
              </Text>
            </div>
          </div>

          <Space>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={handleUploadClick}
              className="rounded-lg"
            >
              Upload Letter
            </Button>
            <Button
              icon={<ReloadOutlined spin={loading} />}
              onClick={handleRefresh}
              loading={loading}
              className="rounded-lg"
            >
              Refresh
            </Button>
          </Space>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card size="small" className="rounded-xl border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                <FileProtectOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">{letters.length}</div>
                <div className="text-[10px] uppercase font-bold text-text-tertiary">Total Letters</div>
              </div>
            </div>
          </Card>

          <Card size="small" className="rounded-xl border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-warning/10 text-warning">
                <ClockCircleOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">{pendingCount}</div>
                <div className="text-[10px] uppercase font-bold text-text-tertiary">Pending Review</div>
              </div>
            </div>
          </Card>

          <Card size="small" className="rounded-xl border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-success/10 text-success">
                <CheckCircleOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">{verifiedCount}</div>
                <div className="text-[10px] uppercase font-bold text-text-tertiary">Verified</div>
              </div>
            </div>
          </Card>

          <Card size="small" className="rounded-xl border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-error/10 text-error">
                <CloseCircleOutlined className="text-lg" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">{rejectedCount}</div>
                <div className="text-[10px] uppercase font-bold text-text-tertiary">Rejected</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Search and Table */}
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
          <div className="p-4 border-b border-gray-200">
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
            className="!px-4"
          />

          <Table
            columns={columns}
            dataSource={getFilteredLetters()}
            loading={loading}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} letters`,
              className: 'px-4 py-3',
            }}
            size="middle"
            className="custom-table"
          />
        </Card>
      </div>

      {/* Review Modal */}
      <Modal
        title={
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              reviewModal.action === 'verify' ? 'bg-success/10' : 'bg-error/10'
            }`}>
              {reviewModal.action === 'verify' ? (
                <CheckCircleOutlined className="text-success" />
              ) : (
                <CloseCircleOutlined className="text-error" />
              )}
            </div>
            <span className="font-bold text-text-primary">
              {reviewModal.action === 'verify' ? 'Verify Joining Letter' : 'Reject Joining Letter'}
            </span>
          </div>
        }
        open={reviewModal.visible}
        onCancel={() => {
          setReviewModal({ visible: false, letter: null, action: null });
          setRemarks('');
        }}
        footer={[
          <Button key="cancel" onClick={() => setReviewModal({ visible: false, letter: null, action: null })} className="rounded-lg">
            Cancel
          </Button>,
          reviewModal.action === 'verify' ? (
            <Button key="verify" type="primary" onClick={handleVerify} className="rounded-lg bg-success border-success">
              Verify
            </Button>
          ) : (
            <Button key="reject" type="primary" danger onClick={handleReject} className="rounded-lg">
              Reject
            </Button>
          ),
        ]}
        className="rounded-2xl"
      >
        {reviewModal.letter && (
          <div className="mb-4 p-4 bg-surface rounded-xl border border-border">
            <p><strong>Student:</strong> {reviewModal.letter.student?.name}</p>
            <p><strong>Company:</strong> {reviewModal.letter.internship?.industry?.companyName || reviewModal.letter.companyName || 'Self-Identified'}</p>
          </div>
        )}
        <TextArea
          rows={4}
          placeholder={reviewModal.action === 'verify' ? 'Add remarks (optional)' : 'Reason for rejection (required)'}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="rounded-lg"
        />
      </Modal>

      {/* Upload Modal */}
      <Modal
        title={
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
              <UploadOutlined className="text-primary" />
            </div>
            <span className="font-bold text-text-primary">Upload Joining Letter</span>
          </div>
        }
        open={uploadModal.visible}
        onCancel={() => {
          setUploadModal({ visible: false, student: null });
          setSelectedFile(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setUploadModal({ visible: false, student: null });
              setSelectedFile(null);
            }}
            className="rounded-lg"
          >
            Cancel
          </Button>,
          <Button
            key="upload"
            type="primary"
            loading={uploadLoading}
            onClick={handleUpload}
            className="rounded-lg"
            disabled={!uploadModal.student || !selectedFile}
          >
            Upload
          </Button>,
        ]}
        className="rounded-2xl"
      >
        <div className="space-y-4">
          <div>
            <Text className="block mb-2 font-medium">
              Select Student <span className="text-red-500">*</span>
            </Text>
            <Select
              showSearch
              placeholder="Search by name or roll number..."
              style={{ width: '100%' }}
              value={uploadModal.student}
              onChange={(value) => setUploadModal({ ...uploadModal, student: value })}
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
              options={students.map((s) => ({
                label: `${s.student.name} (${s.student.rollNumber})`,
                value: s.student.id,
              }))}
              size="large"
              className="rounded-lg"
            />
          </div>

          <div>
            <Text className="block mb-2 font-medium">
              Upload File <span className="text-red-500">*</span>
            </Text>
            <Upload.Dragger
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              maxCount={1}
              beforeUpload={() => false}
              onChange={handleFileChange}
              className="rounded-lg"
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined className="text-primary text-4xl" />
              </p>
              <p className="ant-upload-text">Click or drag file to upload</p>
              <p className="ant-upload-hint">
                Support for PDF, DOC, DOCX, JPG, PNG files
              </p>
            </Upload.Dragger>
          </div>

          {uploadModal.student && students.find(s => s.student.id === uploadModal.student) && (
            <div className="p-4 bg-surface rounded-xl border border-border">
              <Text className="text-xs uppercase font-bold text-text-tertiary block mb-2">
                Student Information
              </Text>
              {(() => {
                const studentData = students.find(s => s.student.id === uploadModal.student);
                const application = studentData?.student?.internshipApplications?.[0];
                return (
                  <div className="space-y-1">
                    <div>
                      <Text strong>{studentData?.student?.name}</Text>
                    </div>
                    <div className="text-sm text-text-secondary">
                      {studentData?.student?.rollNumber}
                    </div>
                    {application && (
                      <div className="text-sm text-text-secondary mt-2">
                        Company: {application.internship?.industry?.companyName || 'Self-Identified'}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <FileProtectOutlined className="text-primary" />
            </div>
            <span className="font-bold text-text-primary">Joining Letter Details</span>
          </div>
        }
        placement="right"
        size="default"
        onClose={() => {
          setDetailDrawer(false);
          setSelectedLetter(null);
        }}
        open={detailDrawer}
        styles={{ mask: { backdropFilter: 'blur(4px)' } }}
      >
        {selectedLetter && (
          <div className="space-y-6">
            {/* Status Banner */}
            <div className={`p-4 rounded-xl border ${
              selectedLetter.reviewedAt && !selectedLetter.reviewRemarks?.toLowerCase().includes('reject')
                ? 'bg-success/5 border-success/20'
                : selectedLetter.reviewedAt
                  ? 'bg-error/5 border-error/20'
                  : 'bg-warning/5 border-warning/20'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileProtectOutlined className="text-primary" />
                  <span className="font-bold text-text-primary">Joining Letter</span>
                </div>
                <Tag
                  color={getStatusConfig(getLetterStatus(selectedLetter)).color}
                  icon={getStatusConfig(getLetterStatus(selectedLetter)).icon}
                >
                  {getStatusConfig(getLetterStatus(selectedLetter)).label}
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
                    <Text strong>{selectedLetter.student?.name}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Roll Number">
                    {selectedLetter.student?.rollNumber}
                  </Descriptions.Item>
                  <Descriptions.Item label="Email">
                    {selectedLetter.student?.email || '-'}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </div>

            {/* Internship Information */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-background-tertiary/30">
                <Text className="text-xs uppercase font-bold text-text-tertiary flex items-center gap-2">
                  <BankOutlined className="text-success" /> Internship Details
                </Text>
              </div>
              <div className="p-4">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Company">
                    {selectedLetter.internship?.industry?.companyName || selectedLetter.companyName || 'Self-Identified'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Internship Type">
                    <Tag color="purple">Self-Identified</Tag>
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </div>

            {/* Document Details */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-background-tertiary/30">
                <Text className="text-xs uppercase font-bold text-text-tertiary flex items-center gap-2">
                  <CalendarOutlined className="text-info" /> Document Details
                </Text>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <div>
                    <Text className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Uploaded On</Text>
                    <Text className="text-text-primary">
                      {selectedLetter.joiningLetterUploadedAt
                        ? dayjs(selectedLetter.joiningLetterUploadedAt).format('DD MMM YYYY, HH:mm')
                        : '-'}
                    </Text>
                  </div>
                  <div className="text-right">
                    <Text className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Reviewed On</Text>
                    <Text className="text-text-primary">
                      {selectedLetter.reviewedAt
                        ? dayjs(selectedLetter.reviewedAt).format('DD MMM YYYY, HH:mm')
                        : '-'}
                    </Text>
                  </div>
                </div>
                {selectedLetter.reviewRemarks && (
                  <div>
                    <Text className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Review Remarks</Text>
                    <Paragraph className="text-text-primary mb-0 p-3 bg-background-tertiary/30 rounded-lg">
                      {selectedLetter.reviewRemarks}
                    </Paragraph>
                  </div>
                )}
              </div>
            </div>

            {/* Document Preview */}
            {selectedLetter.joiningLetterUrl && (
              <div className="bg-surface rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-background-tertiary/30">
                  <Text className="text-xs uppercase font-bold text-text-tertiary flex items-center gap-2">
                    <FileProtectOutlined className="text-primary" /> Document
                  </Text>
                </div>
                <div className="p-4 flex justify-center">
                  <Button
                    type="primary"
                    icon={<EyeOutlined />}
                    onClick={() => handleView(selectedLetter)}
                    className="rounded-lg"
                  >
                    View Document
                  </Button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 flex justify-end gap-3 border-t border-border">
              {!selectedLetter.reviewedAt && (
                <>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => {
                      setDetailDrawer(false);
                      setReviewModal({ visible: true, letter: selectedLetter, action: 'verify' });
                    }}
                    className="rounded-lg bg-success border-success"
                  >
                    Verify
                  </Button>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => {
                      setDetailDrawer(false);
                      setReviewModal({ visible: true, letter: selectedLetter, action: 'reject' });
                    }}
                    className="rounded-lg"
                  >
                    Reject
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default JoiningLettersPage;
