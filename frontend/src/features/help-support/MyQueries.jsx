import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  Typography,
  Drawer,
  Timeline,
  Divider,
  Empty,
  message,
  Spin,
  Avatar,
  Tooltip,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  SendOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  UserOutlined,
  MessageOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { helpSupportService, SUPPORT_CATEGORIES, TICKET_STATUS, TICKET_PRIORITY } from '../../services/helpSupport.service';
import { useAuth } from '../../hooks/useAuth';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const MyQueries = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);

  // Ticket detail drawer
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [loadingTicket, setLoadingTicket] = useState(false);

  // Reply form
  const [replyForm] = Form.useForm();
  const [submittingReply, setSubmittingReply] = useState(false);

  // New ticket modal
  const [newTicketVisible, setNewTicketVisible] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketForm] = Form.useForm();

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await helpSupportService.getMyTickets();
      setTickets(data);
      setFilteredTickets(data);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      message.error('Failed to load your tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Filter tickets
  useEffect(() => {
    let filtered = [...tickets];

    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (ticket) =>
          ticket.subject.toLowerCase().includes(search) ||
          ticket.ticketNumber.toLowerCase().includes(search) ||
          ticket.description.toLowerCase().includes(search)
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((ticket) => ticket.status === statusFilter);
    }

    if (categoryFilter) {
      filtered = filtered.filter((ticket) => ticket.category === categoryFilter);
    }

    setFilteredTickets(filtered);
  }, [tickets, searchText, statusFilter, categoryFilter]);

  // View ticket details
  const handleViewTicket = async (ticketId) => {
    setLoadingTicket(true);
    setDrawerVisible(true);
    try {
      const ticket = await helpSupportService.getTicketById(ticketId);
      setSelectedTicket(ticket);
    } catch (error) {
      console.error('Failed to fetch ticket:', error);
      message.error('Failed to load ticket details');
    } finally {
      setLoadingTicket(false);
    }
  };

  // Submit reply
  const handleSubmitReply = async (values) => {
    if (!selectedTicket) return;

    setSubmittingReply(true);
    try {
      await helpSupportService.respondToTicket(selectedTicket.id, values.message);
      message.success('Reply sent successfully');
      replyForm.resetFields();
      // Refresh ticket details
      const updatedTicket = await helpSupportService.getTicketById(selectedTicket.id);
      setSelectedTicket(updatedTicket);
      // Refresh ticket list
      fetchTickets();
    } catch (error) {
      console.error('Failed to send reply:', error);
      message.error('Failed to send reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Submit new ticket
  const handleSubmitTicket = async (values) => {
    setSubmittingTicket(true);
    try {
      await helpSupportService.createTicket({
        subject: values.subject,
        description: values.description,
        category: values.category,
        priority: values.priority || 'MEDIUM',
        attachments: [],
      });
      message.success('Ticket submitted successfully');
      setNewTicketVisible(false);
      ticketForm.resetFields();
      fetchTickets();
    } catch (error) {
      console.error('Failed to submit ticket:', error);
      message.error('Failed to submit ticket');
    } finally {
      setSubmittingTicket(false);
    }
  };

  // Get status tag
  const getStatusTag = (status) => {
    const statusInfo = TICKET_STATUS[status] || { label: status, color: 'default' };
    return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>;
  };

  // Get priority tag
  const getPriorityTag = (priority) => {
    const priorityInfo = TICKET_PRIORITY[priority] || { label: priority, color: 'default' };
    return <Tag color={priorityInfo.color}>{priorityInfo.label}</Tag>;
  };

  // Get category info
  const getCategoryInfo = (category) => {
    return SUPPORT_CATEGORIES[category] || { label: category, color: 'default' };
  };

  // Table columns
  const columns = [
    {
      title: 'Ticket #',
      dataIndex: 'ticketNumber',
      key: 'ticketNumber',
      width: 150,
      render: (text) => <Text strong style={{ color: '#1890ff' }}>{text}</Text>,
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 150,
      render: (category) => (
        <Tag color={getCategoryInfo(category).color}>
          {getCategoryInfo(category).label}
        </Tag>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority) => getPriorityTag(priority),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => getStatusTag(status),
    },
    {
      title: 'Last Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 150,
      render: (date) => (
        <Tooltip title={dayjs(date).format('DD MMM YYYY, HH:mm')}>
          {dayjs(date).fromNow()}
        </Tooltip>
      ),
    },
    {
      title: 'Responses',
      dataIndex: 'responseCount',
      key: 'responseCount',
      width: 100,
      render: (count) => (
        <Badge count={count} showZero color="#1890ff">
          <MessageOutlined style={{ fontSize: 18 }} />
        </Badge>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" onClick={() => handleViewTicket(record.id)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-primary shadow-sm mr-3">
              <MessageOutlined className="text-lg" />
            </div>
            <div>
              <Title level={2} className="mb-0 text-text-primary text-2xl">
                My Support Tickets
              </Title>
              <Paragraph className="text-text-secondary text-sm mb-0">
                Track and manage your support requests
              </Paragraph>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchTickets}
              className="rounded-xl h-10 border-border text-text-secondary hover:text-text-primary hover:border-primary"
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setNewTicketVisible(true)}
              className="rounded-xl h-10 font-bold shadow-lg shadow-primary/20"
            >
              New Ticket
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="rounded-2xl border-border shadow-sm" styles={{ body: { padding: '16px' } }}>
          <Space wrap className="w-full">
            <Input
              placeholder="Search tickets..."
              prefix={<SearchOutlined className="text-text-tertiary" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-64 rounded-xl h-10 bg-background border-border"
              allowClear
            />
            <Select
              placeholder="Filter by Status"
              value={statusFilter}
              onChange={setStatusFilter}
              className="w-40 rounded-xl h-10"
              allowClear
            >
              {Object.values(TICKET_STATUS).map((status) => (
                <Select.Option key={status.value} value={status.value}>
                  {status.label}
                </Select.Option>
              ))}
            </Select>
            <Select
              placeholder="Filter by Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              className="w-48 rounded-xl h-10"
              allowClear
            >
              {Object.values(SUPPORT_CATEGORIES).map((cat) => (
                <Select.Option key={cat.value} value={cat.value}>
                  {cat.label}
                </Select.Option>
              ))}
            </Select>
          </Space>
        </Card>

        {/* Tickets Table */}
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
          <Table
            columns={columns}
            dataSource={filteredTickets}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} tickets`,
              className: "px-6 py-4",
            }}
            size="middle"
            locale={{
              emptyText: (
                <div className="py-12 flex flex-col items-center justify-center">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={<span className="text-text-secondary">No tickets found</span>}
                  />
                  <Button type="primary" onClick={() => setNewTicketVisible(true)} className="mt-4 rounded-xl h-10 font-bold">
                    Submit Your First Ticket
                  </Button>
                </div>
              ),
            }}
            className="custom-table"
          />
        </Card>

        {/* Ticket Detail Drawer */}
        <Drawer
          title={
            selectedTicket ? (
              <div className="flex items-center gap-3">
                <Text strong className="text-lg text-text-primary">{selectedTicket.ticketNumber}</Text>
                {getStatusTag(selectedTicket.status)}
              </div>
            ) : 'Ticket Details'
          }
          width={600}
          open={drawerVisible}
          onClose={() => {
            setDrawerVisible(false);
            setSelectedTicket(null);
            replyForm.resetFields();
          }}
          className="rounded-l-2xl"
          styles={{ header: { borderBottom: '1px solid var(--color-border)' } }}
        >
          {loadingTicket ? (
            <div className="flex justify-center items-center h-full">
              <Spin tip="Loading ticket..." />
            </div>
          ) : selectedTicket ? (
            <div className="space-y-6">
              {/* Ticket Info */}
              <Card size="small" className="rounded-xl border-border bg-surface shadow-sm">
                <Title level={5} className="!mb-3 text-text-primary">{selectedTicket.subject}</Title>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Tag color={getCategoryInfo(selectedTicket.category).color} className="rounded-md border-0 m-0 font-medium">
                    {getCategoryInfo(selectedTicket.category).label}
                  </Tag>
                  {getPriorityTag(selectedTicket.priority)}
                  <div className="flex items-center text-text-tertiary text-xs ml-auto">
                    <ClockCircleOutlined className="mr-1" />
                    {dayjs(selectedTicket.createdAt).format('DD MMM YYYY, HH:mm')}
                  </div>
                </div>
                <Paragraph className="text-text-secondary leading-relaxed mb-0 bg-background-tertiary/30 p-3 rounded-lg border border-border/50">
                  {selectedTicket.description}
                </Paragraph>
                {selectedTicket.assignedTo && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-text-tertiary border-t border-border pt-2">
                    <UserOutlined /> Assigned to: <strong className="text-text-secondary">{selectedTicket.assignedTo.name}</strong>
                  </div>
                )}
              </Card>

              {/* Resolution (if resolved) */}
              {selectedTicket.resolution && (
                <Card size="small" className="rounded-xl border-success-border bg-success-50">
                  <Title level={5} className="!mb-2 flex items-center gap-2 text-success-700">
                    <CheckCircleOutlined /> Resolution
                  </Title>
                  <Paragraph className="mb-0 text-text-primary">{selectedTicket.resolution}</Paragraph>
                </Card>
              )}

              <Divider className="border-border">Conversation</Divider>

              {/* Responses Timeline */}
              {selectedTicket.responses && selectedTicket.responses.length > 0 ? (
                <Timeline className="mt-4 px-2">
                  {selectedTicket.responses
                    .filter(r => !r.isInternal)
                    .map((response) => (
                      <Timeline.Item
                        key={response.id}
                        dot={
                          <Avatar size="small" className={response.responder?.id === user?.userId ? 'bg-primary' : 'bg-success'}>
                            <UserOutlined />
                          </Avatar>
                        }
                      >
                        <Card size="small" className={`rounded-xl border-border mb-2 ${response.responder?.id === user?.userId ? 'bg-primary-50/30' : 'bg-surface'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <Text strong className="text-text-primary">
                              {response.responderName}
                              {response.responder?.id === user?.userId && <Tag className="ml-2 rounded-md border-0 bg-primary/10 text-primary text-[10px] font-bold">YOU</Tag>}
                            </Text>
                            <Text type="secondary" className="text-xs">
                              {dayjs(response.createdAt).fromNow()}
                            </Text>
                          </div>
                          <Paragraph className="mb-0 text-text-secondary">{response.message}</Paragraph>
                        </Card>
                      </Timeline.Item>
                    ))}
                </Timeline>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span className="text-text-tertiary">No responses yet</span>}
                />
              )}

              {/* Reply Form (only for open tickets) */}
              {!['RESOLVED', 'CLOSED'].includes(selectedTicket.status) && (
                <div className="pt-4 border-t border-border mt-4">
                  <Text strong className="block mb-3 text-text-primary">Reply</Text>
                  <Form form={replyForm} onFinish={handleSubmitReply}>
                    <Form.Item
                      name="message"
                      rules={[{ required: true, message: 'Please enter your reply' }]}
                    >
                      <TextArea
                        rows={4}
                        placeholder="Type your reply here..."
                        className="rounded-xl border-border bg-background p-3"
                      />
                    </Form.Item>
                    <div className="flex justify-end">
                      <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SendOutlined />}
                        loading={submittingReply}
                        className="rounded-xl h-10 font-bold px-6 shadow-md"
                      >
                        Send Reply
                      </Button>
                    </div>
                  </Form>
                </div>
              )}
            </div>
          ) : null}
        </Drawer>

        {/* New Ticket Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2 text-primary">
              <PlusOutlined />
              <span className="font-bold">Submit New Ticket</span>
            </div>
          }
          open={newTicketVisible}
          onCancel={() => {
            setNewTicketVisible(false);
            ticketForm.resetFields();
          }}
          footer={null}
          width={600}
          className="rounded-2xl overflow-hidden"
        >
          <Form
            form={ticketForm}
            layout="vertical"
            onFinish={handleSubmitTicket}
            className="pt-4"
          >
            <Form.Item
              name="subject"
              label={<span className="font-medium text-text-primary">Subject</span>}
              rules={[
                { required: true, message: 'Please enter a subject' },
                { min: 5, message: 'Subject must be at least 5 characters' },
              ]}
            >
              <Input placeholder="Brief description of your issue" className="rounded-lg h-11 bg-background border-border" />
            </Form.Item>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="category"
                label={<span className="font-medium text-text-primary">Category</span>}
                rules={[{ required: true, message: 'Please select a category' }]}
              >
                <Select placeholder="Select category" className="rounded-lg h-11">
                  {Object.values(SUPPORT_CATEGORIES).map((cat) => (
                    <Select.Option key={cat.value} value={cat.value}>
                      {cat.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="priority"
                label={<span className="font-medium text-text-primary">Priority</span>}
                initialValue="MEDIUM"
              >
                <Select className="rounded-lg h-11">
                  {Object.values(TICKET_PRIORITY).map((p) => (
                    <Select.Option key={p.value} value={p.value}>
                      <Tag color={p.color} className="mr-0 rounded-md border-0 font-bold text-[10px] uppercase tracking-wider">{p.label}</Tag>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            <Form.Item
              name="description"
              label={<span className="font-medium text-text-primary">Description</span>}
              rules={[
                { required: true, message: 'Please describe your issue' },
                { min: 20, message: 'Description must be at least 20 characters' },
              ]}
            >
              <TextArea
                rows={6}
                placeholder="Please describe your issue in detail..."
                className="rounded-lg bg-background border-border p-3"
              />
            </Form.Item>

            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
              <Button onClick={() => setNewTicketVisible(false)} className="rounded-xl h-10 font-medium">
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={submittingTicket} className="rounded-xl h-10 font-bold px-6 shadow-lg shadow-primary/20">
                Submit Ticket
              </Button>
            </div>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default MyQueries;
