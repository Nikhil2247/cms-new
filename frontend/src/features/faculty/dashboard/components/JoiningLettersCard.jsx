import React, { useState } from 'react';
import { Card, List, Tag, Button, Space, Modal, Input, message, Empty, Badge, Tooltip, Avatar } from 'antd';
import {
  FileProtectOutlined,
  RightOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  DeleteOutlined,
  UserOutlined,
  BankOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import facultyService from '../../../../services/faculty.service';

const { TextArea } = Input;

const getStatusConfig = (status) => {
  const configs = {
    PENDING: { color: 'orange', label: 'Pending', icon: <ClockCircleOutlined /> },
    VERIFIED: { color: 'green', label: 'Verified', icon: <CheckCircleOutlined /> },
    REJECTED: { color: 'red', label: 'Rejected', icon: <CloseCircleOutlined /> },
    UPLOADED: { color: 'blue', label: 'Uploaded', icon: <FileProtectOutlined /> },
  };
  return configs[status] || configs.PENDING;
};

const JoiningLettersCard = ({ letters = [], loading, onRefresh, onViewAll }) => {
  const navigate = useNavigate();
  const [actionModal, setActionModal] = useState({ visible: false, letter: null, action: null });
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const handleVerify = async () => {
    if (!actionModal.letter) return;
    setActionLoading(true);
    try {
      await facultyService.verifyJoiningLetter(actionModal.letter.id, { remarks });
      message.success('Joining letter verified successfully');
      setActionModal({ visible: false, letter: null, action: null });
      setRemarks('');
      onRefresh?.();
    } catch (error) {
      message.error(error.message || 'Failed to verify joining letter');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!actionModal.letter || !remarks.trim()) {
      message.warning('Please provide a reason for rejection');
      return;
    }
    setActionLoading(true);
    try {
      await facultyService.rejectJoiningLetter(actionModal.letter.id, remarks);
      message.success('Joining letter rejected');
      setActionModal({ visible: false, letter: null, action: null });
      setRemarks('');
      onRefresh?.();
    } catch (error) {
      message.error(error.message || 'Failed to reject joining letter');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (letter) => {
    Modal.confirm({
      title: 'Delete Joining Letter',
      content: 'Are you sure you want to delete this joining letter? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await facultyService.deleteJoiningLetter(letter.id);
          message.success('Joining letter deleted');
          onRefresh?.();
        } catch (error) {
          message.error(error.message || 'Failed to delete joining letter');
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

  const pendingCount = letters.filter(l => l.status === 'PENDING' || l.status === 'UPLOADED').length;

  return (
    <>
      <Card
        title={
          <div className="flex items-center gap-2">
            <FileProtectOutlined className="text-primary" />
            <span>Joining Letters</span>
            {pendingCount > 0 && (
              <Badge count={pendingCount} className="ml-2" />
            )}
          </div>
        }
        extra={
          <Button type="link" onClick={onViewAll || (() => navigate('/joining-letters'))}>
            View All <RightOutlined />
          </Button>
        }
        className="h-full border border-border rounded-xl"
        styles={{ body: { padding: letters.length > 0 ? 0 : 24 } }}
      >
        {letters.length > 0 ? (
          <List
            loading={loading}
            dataSource={letters.slice(0, 5)}
            renderItem={(letter) => {
              const statusConfig = getStatusConfig(letter.status);
              const student = letter.student || letter.application?.student;
              const company = letter.company || letter.application?.internship?.industry;

              return (
                <List.Item
                  className="px-4 hover:bg-surface-hover"
                  actions={[
                    <Space key="actions" size="small">
                      {letter.joiningLetterUrl && (
                        <Tooltip title="View Document">
                          <Button
                            type="text"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => handleView(letter)}
                          />
                        </Tooltip>
                      )}
                      {(letter.status === 'PENDING' || letter.status === 'UPLOADED') && (
                        <>
                          <Tooltip title="Verify">
                            <Button
                              type="text"
                              size="small"
                              icon={<CheckCircleOutlined className="text-green-500" />}
                              onClick={() => setActionModal({ visible: true, letter, action: 'verify' })}
                            />
                          </Tooltip>
                          <Tooltip title="Reject">
                            <Button
                              type="text"
                              size="small"
                              icon={<CloseCircleOutlined className="text-red-500" />}
                              onClick={() => setActionModal({ visible: true, letter, action: 'reject' })}
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
                          onClick={() => handleDelete(letter)}
                        />
                      </Tooltip>
                    </Space>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar icon={<UserOutlined />} className="bg-primary" />
                    }
                    title={
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{student?.name || 'Unknown Student'}</span>
                        <Tag color={statusConfig.color} icon={statusConfig.icon}>
                          {statusConfig.label}
                        </Tag>
                      </div>
                    }
                    description={
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-text-secondary">
                          <BankOutlined />
                          <span>{company?.companyName || 'N/A'}</span>
                        </div>
                        {letter.uploadedAt && (
                          <div className="text-xs text-text-tertiary">
                            Uploaded: {dayjs(letter.uploadedAt).format('DD/MM/YYYY')}
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No joining letters to review"
          />
        )}
      </Card>

      {/* Action Modal */}
      <Modal
        title={actionModal.action === 'verify' ? 'Verify Joining Letter' : 'Reject Joining Letter'}
        open={actionModal.visible}
        onCancel={() => {
          setActionModal({ visible: false, letter: null, action: null });
          setRemarks('');
        }}
        footer={[
          <Button key="cancel" onClick={() => setActionModal({ visible: false, letter: null, action: null })}>
            Cancel
          </Button>,
          actionModal.action === 'verify' ? (
            <Button key="verify" type="primary" loading={actionLoading} onClick={handleVerify}>
              Verify
            </Button>
          ) : (
            <Button key="reject" type="primary" danger loading={actionLoading} onClick={handleReject}>
              Reject
            </Button>
          ),
        ]}
      >
        {actionModal.letter && (
          <div className="mb-4">
            <p><strong>Student:</strong> {actionModal.letter.student?.name || actionModal.letter.application?.student?.name}</p>
            <p><strong>Company:</strong> {actionModal.letter.company?.companyName || actionModal.letter.application?.internship?.industry?.companyName}</p>
          </div>
        )}
        <TextArea
          rows={4}
          placeholder={actionModal.action === 'verify' ? 'Add remarks (optional)' : 'Reason for rejection (required)'}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </Modal>
    </>
  );
};

export default JoiningLettersCard;
