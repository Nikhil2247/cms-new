import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Tag, Space, Modal, message, Input, DatePicker, Descriptions, Drawer } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { fetchVisitLogs, deleteVisitLog } from '../../../store/slices/facultySlice';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const VisitLogList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { visitLogs, loading } = useSelector((state) => state.faculty);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    dispatch(fetchVisitLogs());
  }, [dispatch]);

  const handleDelete = (id) => {
    Modal.confirm({
      title: 'Delete Visit Log',
      content: 'Are you sure you want to delete this visit log? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await dispatch(deleteVisitLog(id)).unwrap();
          message.success('Visit log deleted successfully');
        } catch (error) {
          message.error(error?.message || 'Failed to delete visit log');
        }
      },
    });
  };

  const filteredLogs = visitLogs?.filter(log => {
    const matchesSearch = !searchText ||
      log.student?.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      log.company?.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      log.purpose?.toLowerCase().includes(searchText.toLowerCase());

    const matchesDate = !dateRange || (
      dayjs(log.visitDate).isAfter(dateRange[0]) &&
      dayjs(log.visitDate).isBefore(dateRange[1])
    );

    return matchesSearch && matchesDate;
  }) || [];

  const columns = [
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
          <div className="font-medium">{text}</div>
          <div className="text-gray-500 text-xs">{record.student?.rollNumber}</div>
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
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          scheduled: 'blue',
          completed: 'green',
          cancelled: 'red',
        };
        return <Tag color={colors[status] || 'default'}>{status?.toUpperCase()}</Tag>;
      },
      filters: [
        { text: 'Scheduled', value: 'scheduled' },
        { text: 'Completed', value: 'completed' },
        { text: 'Cancelled', value: 'cancelled' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
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
            icon={<EditOutlined />}
            onClick={() => navigate(`/faculty/visit-logs/${record.id}/edit`)}
            size="small"
          >
            Edit
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
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card
        title="Visit Logs"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/faculty/visit-logs/new')}
          >
            Add Visit Log
          </Button>
        }
        variant="borderless"
      >
        <Space className="mb-4" size="middle" wrap>
          <Input
            placeholder="Search by student, company, or purpose..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            format="DD/MM/YYYY"
            placeholder={['Start Date', 'End Date']}
          />
        </Space>

        <Table
          columns={columns}
          dataSource={filteredLogs}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} visit logs`,
          }}
        />
      </Card>

      {/* Detail Drawer */}
      <Drawer
        title="Visit Log Details"
        placement="right"
        width={600}
        onClose={() => {
          setDetailDrawer(false);
          setSelectedLog(null);
        }}
        open={detailDrawer}
      >
        {selectedLog && (
          <div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Visit Date">
                {dayjs(selectedLog.visitDate).format('DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={
                  selectedLog.status === 'completed' ? 'green' :
                  selectedLog.status === 'scheduled' ? 'blue' : 'red'
                }>
                  {selectedLog.status?.toUpperCase()}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <h3 className="text-lg font-semibold mt-6 mb-3">Student Information</h3>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Name">{selectedLog.student?.name}</Descriptions.Item>
              <Descriptions.Item label="Roll Number">{selectedLog.student?.rollNumber}</Descriptions.Item>
              <Descriptions.Item label="Department">{selectedLog.student?.department?.name}</Descriptions.Item>
              <Descriptions.Item label="Email">{selectedLog.student?.email}</Descriptions.Item>
              <Descriptions.Item label="Phone">{selectedLog.student?.phone}</Descriptions.Item>
            </Descriptions>

            <h3 className="text-lg font-semibold mt-6 mb-3">Company Information</h3>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Company Name">{selectedLog.company?.name || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Location">{selectedLog.company?.location || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Contact Person">{selectedLog.contactPerson || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Contact Number">{selectedLog.contactNumber || 'N/A'}</Descriptions.Item>
            </Descriptions>

            <h3 className="text-lg font-semibold mt-6 mb-3">Visit Details</h3>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Purpose">{selectedLog.purpose}</Descriptions.Item>
              <Descriptions.Item label="Duration">{selectedLog.duration || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Observations">
                {selectedLog.observations || 'No observations recorded'}
              </Descriptions.Item>
              <Descriptions.Item label="Feedback">
                {selectedLog.feedback || 'No feedback provided'}
              </Descriptions.Item>
              <Descriptions.Item label="Action Items">
                {selectedLog.actionItems || 'No action items'}
              </Descriptions.Item>
            </Descriptions>

            {selectedLog.attachments && selectedLog.attachments.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mt-6 mb-3">Attachments</h3>
                <Space direction="vertical">
                  {selectedLog.attachments.map((file, idx) => (
                    <a key={idx} href={file.url} target="_blank" rel="noopener noreferrer">
                      {file.name}
                    </a>
                  ))}
                </Space>
              </>
            )}

            <div className="mt-6">
              <Space>
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setDetailDrawer(false);
                    navigate(`/faculty/visit-logs/${selectedLog.id}/edit`);
                  }}
                >
                  Edit
                </Button>
                <Button onClick={() => setDetailDrawer(false)}>Close</Button>
              </Space>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default VisitLogList;