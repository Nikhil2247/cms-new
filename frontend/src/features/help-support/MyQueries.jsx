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
    return (
      <Tag color={statusInfo.color} className="rounded-md font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 border-0">
        {statusInfo.label}
      </Tag>
    );
  };

  // Get priority tag
  const getPriorityTag = (priority) => {
    const priorityInfo = TICKET_PRIORITY[priority] || { label: priority, color: 'default' };
    return (
      <Tag color={priorityInfo.color} className="rounded-md font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 border-0">
        {priorityInfo.label}
      </Tag>
    );
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
      render: (text) => <Text strong className="text-blue-600 font-mono">{text}</Text>,
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
      render: (text) => <Text strong className="text-gray-800">{text}</Text>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 150,
      render: (category) => (
        <Tag color={getCategoryInfo(category).color} className="rounded-md font-medium">
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
          <span className="text-gray-500 text-sm">{dayjs(date).fromNow()}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Responses',
      dataIndex: 'responseCount',
      key: 'responseCount',
      width: 100,
      align: 'center',
      render: (count) => (
        <Badge count={count} showZero color="#3b82f6" className="font-bold">
          <MessageOutlined className="text-gray-400 text-lg" />
        </Badge>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      align: 'right',
      render: (_, record) => (
        <Button 
          type="default" 
          size="small"
          onClick={() => handleViewTicket(record.id)}
          className="rounded-lg border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-200"
        >
          View Details
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-8 bg-background-secondary min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-surface border border-border text-blue-600 shadow-sm">
              <MessageOutlined className="text-2xl" />
            </div>
            <div>
              <Title level={2} className="!mb-1 !text-gray-900 !text-2xl lg:!text-3xl tracking-tight">
                My Support Tickets
              </Title>
              <Paragraph className="!text-gray-500 !text-sm lg:!text-base !mb-0 font-medium">
                Track and manage your support requests and technical queries
              </Paragraph>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchTickets}
              className="rounded-xl h-11 px-4 border-border text-text-secondary hover:text-text-primary hover:border-primary bg-surface"
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setNewTicketVisible(true)}
              className="rounded-xl h-11 px-6 font-bold shadow-lg shadow-blue-200 bg-blue-600 hover:bg-blue-500 border-0"
            >
              New Ticket
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card bordered={false} className="rounded-2xl border border-border shadow-sm bg-surface" styles={{ body: { padding: '16px' } }}>
          <Space wrap className="w-full">
            <Input
              placeholder="Search tickets..."
              prefix={<SearchOutlined className="text-gray-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-64 rounded-xl h-11 bg-background-secondary border-border hover:bg-surface focus:bg-surface"
              allowClear
            />
            <Select
              placeholder="Filter by Status"
              value={statusFilter}
              onChange={setStatusFilter}
              className="w-40 h-11 rounded-xl"
              allowClear
              dropdownStyle={{ borderRadius: '12px', padding: '8px' }}
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
              className="w-48 h-11 rounded-xl"
              allowClear
              dropdownStyle={{ borderRadius: '12px', padding: '8px' }}
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
        <Card bordered={false} className="rounded-2xl border border-border shadow-sm overflow-hidden bg-surface" styles={{ body: { padding: 0 } }}>
          <Table
            columns={columns}
            dataSource={filteredTickets}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) => <span className="text-gray-500">{range[0]}-{range[1]} of {total} tickets</span>,
              className: "px-6 py-6",
            }}
            size="middle"
            locale={{
              emptyText: (
                <div className="py-16 flex flex-col items-center justify-center">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={<span className="text-gray-400 font-medium">No tickets found</span>}
                  />
                  <Button type="primary" onClick={() => setNewTicketVisible(true)} className="mt-6 rounded-xl h-10 font-bold bg-blue-600">
                    Submit Your First Ticket
                  </Button>
                </div>
              ),
            }}
            className="custom-table"
            rowClassName="hover:bg-background-secondary/50 transition-colors"
          />
        </Card>

        {/* Ticket Detail Drawer */}
        <Drawer
          title={
            selectedTicket ? (
              <div className="flex items-center gap-3">
                <Text strong className="text-lg text-gray-900 font-mono">{selectedTicket.ticketNumber}</Text>
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
          styles={{ header: { borderBottom: '1px solid #f3f4f6', padding: '24px' }, body: { padding: '24px' } }}
        >
          {loadingTicket ? (
            <div className="flex justify-center items-center h-full">
              <Spin tip="Loading ticket..." size="large" />
            </div>
          ) : selectedTicket ? (
            <div className="space-y-8">
              {/* Ticket Info */}
              <div className="bg-background-secondary rounded-2xl p-6 border border-border">
                <Title level={4} className="!mb-3 !text-gray-900 font-bold">{selectedTicket.subject}</Title>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Tag color={getCategoryInfo(selectedTicket.category).color} className="rounded-md border-0 m-0 font-bold px-2 py-0.5">
                    {getCategoryInfo(selectedTicket.category).label}
                  </Tag>
                  {getPriorityTag(selectedTicket.priority)}
                  <div className="flex items-center text-gray-400 text-xs ml-auto font-medium">
                    <ClockCircleOutlined className="mr-1.5" />
                    {dayjs(selectedTicket.createdAt).format('MMM D, YYYY • h:mm A')}
                  </div>
                </div>
                <Paragraph className="text-text-secondary leading-relaxed mb-0 bg-surface p-4 rounded-xl border border-border shadow-sm">
                  {selectedTicket.description}
                </Paragraph>
                {selectedTicket.assignedTo && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 border-t border-gray-200 pt-3">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                      <UserOutlined />
                    </div>
                    <span>Assigned to: <strong className="text-gray-700">{selectedTicket.assignedTo.name}</strong></span>
                  </div>
                )}
              </div>

              {/* Resolution (if resolved) */}
              {selectedTicket.resolution && (
                <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
                  <Title level={5} className="!mb-3 flex items-center gap-2 text-green-700 font-bold">
                    <CheckCircleOutlined /> Resolution
                  </Title>
                  <Paragraph className="mb-0 text-green-800 bg-surface/50 p-4 rounded-xl border border-green-100/50">
                    {selectedTicket.resolution}
                  </Paragraph>
                </div>
              )}

              <div>
                <Divider className="border-gray-100 mb-6"><span className="text-gray-400 font-medium text-xs uppercase tracking-widest">Discussion History</span></Divider>

                {/* Responses Timeline */}
                {selectedTicket.responses && selectedTicket.responses.length > 0 ? (
                  <Timeline className="mt-4 px-2">
                    {selectedTicket.responses
                      .filter(r => !r.isInternal)
                      .map((response) => (
                        <Timeline.Item
                          key={response.id}
                          dot={
                            <Avatar size="small" className={response.responder?.id === user?.userId ? 'bg-blue-600' : 'bg-green-600'} icon={<UserOutlined />} />
                          }
                        >
                        <Card size="small" className={`rounded-xl border mb-2 ${response.responder?.id === user?.userId ? 'bg-blue-50/30 border-blue-100' : 'bg-surface border-border'}`}>
                            <div className="flex justify-between items-center mb-2">
                              <Text strong className="text-gray-900">
                                {response.responderName}
                                {response.responder?.id === user?.userId && <Tag className="ml-2 rounded-md border-0 bg-blue-100 text-blue-700 text-[10px] font-bold">YOU</Tag>}
                              </Text>
                              <Text type="secondary" className="text-xs font-medium">
                                {dayjs(response.createdAt).fromNow()}
                              </Text>
                            </div>
                            <Paragraph className="mb-0 text-gray-600 leading-relaxed">{response.message}</Paragraph>
                          </Card>
                        </Timeline.Item>
                      ))}
                  </Timeline>
                ) : (
                  <div className="py-8 text-center bg-background-secondary rounded-xl border border-dashed border-border">
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={<span className="text-gray-400">No responses yet</span>}
                    />
                  </div>
                )}
              </div>

              {/* Reply Form (only for open tickets) */}
              {!['RESOLVED', 'CLOSED'].includes(selectedTicket.status) && (
                <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm sticky bottom-0">
                  <Text strong className="block mb-3 text-gray-900">Post a Reply</Text>
                  <Form form={replyForm} onFinish={handleSubmitReply}>
                    <Form.Item
                      name="message"
                      rules={[{ required: true, message: 'Please enter your reply' }]}
                      className="mb-4"
                    >
                      <TextArea
                        rows={4}
                        placeholder="Type your reply here..."
                        className="rounded-xl border-border bg-background-secondary focus:bg-surface p-4 text-base"
                      />
                    </Form.Item>
                    <div className="flex justify-end">
                      <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SendOutlined />}
                        loading={submittingReply}
                        className="rounded-xl h-11 font-bold px-8 shadow-lg shadow-blue-200 bg-blue-600 hover:bg-blue-500 border-0"
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
            <div className="flex items-center gap-3 text-gray-900 text-xl font-bold py-2">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <PlusOutlined />
              </div>
              Submit New Ticket
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
          styles={{ content: { borderRadius: '24px', padding: '24px' } }}
        >
          <Form
            form={ticketForm}
            layout="vertical"
            onFinish={handleSubmitTicket}
            className="pt-4"
          >
            <Form.Item
              name="subject"
              label={<span className="font-semibold text-gray-700">Subject</span>}
              rules={[
                { required: true, message: 'Please enter a subject' },
                { min: 5, message: 'Subject must be at least 5 characters' },
              ]}
            >
              <Input placeholder="Brief description of your issue" className="rounded-xl h-11 bg-background-secondary border-border focus:bg-surface" />
            </Form.Item>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="category"
                label={<span className="font-semibold text-gray-700">Category</span>}
                rules={[{ required: true, message: 'Please select a category' }]}
              >
                <Select placeholder="Select category" className="rounded-xl h-11">
                  {Object.values(SUPPORT_CATEGORIES).map((cat) => (
                    <Select.Option key={cat.value} value={cat.value}>
                      {cat.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="priority"
                label={<span className="font-semibold text-gray-700">Priority</span>}
                initialValue="MEDIUM"
              >
                <Select className="rounded-xl h-11">
                  {Object.values(TICKET_PRIORITY).map((p) => (
                    <Select.Option key={p.value} value={p.value}>
                      <Tag color={p.color} className="mr-0 rounded-md border-0 font-bold text-[10px] uppercase tracking-wider px-2">{p.label}</Tag>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            <Form.Item
              name="description"
              label={<span className="font-semibold text-gray-700">Description</span>}
              rules={[
                { required: true, message: 'Please describe your issue' },
                { min: 20, message: 'Description must be at least 20 characters' },
              ]}
            >
              <TextArea
                rows={6}
                placeholder="Please describe your issue in detail..."
                className="rounded-xl bg-background-secondary border-border focus:bg-surface p-4"
              />
            </Form.Item>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 mt-6">
              <Button onClick={() => setNewTicketVisible(false)} className="rounded-xl h-11 font-medium px-6 border-gray-200 text-gray-600 hover:text-gray-800 hover:border-gray-300">
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={submittingTicket} className="rounded-xl h-11 font-bold px-8 shadow-lg shadow-blue-200 bg-blue-600 hover:bg-blue-500 border-0">
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
