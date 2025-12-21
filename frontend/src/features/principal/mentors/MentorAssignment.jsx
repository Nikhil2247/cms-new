import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Table,
  Button,
  Select,
  message,
  Space,
  Modal,
  Form,
  Tag,
  Input,
  Row,
  Col,
  Statistic,
  Popconfirm,
  Dropdown,
  Segmented,
  Tooltip,
  Flex,
  Typography,
} from 'antd';
import {
  UserAddOutlined,
  SearchOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  DownOutlined,
  TeamOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import {
  fetchStaff,
  fetchStudents,
  fetchBatches,
  assignMentor,
  fetchMentorAssignments,
  fetchMentorStats,
  removeMentorAssignment,
  bulkUnassignMentors,
  autoAssignMentors,
} from '../store/principalSlice';
import { debounce } from 'lodash';

const { Text } = Typography;

const MentorAssignment = () => {
  const dispatch = useDispatch();
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [newMentorId, setNewMentorId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: '',
    hasMentor: '',
    batchId: '',
    branchId: '',
  });

  const { staff, students, mentorAssignments, mentorStats, batches } = useSelector(
    (state) => state.principal
  );
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  useEffect(() => {
    dispatch(fetchStaff({ limit: 100 }));
    dispatch(fetchMentorAssignments());
    dispatch(fetchMentorStats());
    dispatch(fetchBatches());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchStudents(filters));
  }, [dispatch, filters]);

  const mentors = useMemo(() => {
    return (
      staff?.list?.filter(
        (s) =>
          s.role === 'TEACHER' ||
          s.role === 'FACULTY_SUPERVISOR' ||
          s.role === 'mentor' ||
          s.role === 'faculty'
      ) || []
    );
  }, [staff?.list]);

  // Create a map of student IDs to their mentor assignments
  const studentMentorMap = useMemo(() => {
    const map = new Map();
    mentorAssignments?.forEach((a) => {
      map.set(a.studentId, a);
    });
    return map;
  }, [mentorAssignments]);

  // Create a set of student IDs that have mentors assigned
  const studentsWithMentors = useMemo(() => {
    return new Set(mentorAssignments?.map((a) => a.studentId) || []);
  }, [mentorAssignments]);

  // Get unique batches for filter
  const batchFilters = useMemo(() => {
    const batchList = batches?.list || [];
    return batchList.map((b) => ({ text: b.name, value: b.id }));
  }, [batches?.list]);

  // Get unique departments/branches for filter
  const departmentFilters = useMemo(() => {
    const deptSet = new Map();
    students?.list?.forEach((s) => {
      const dept = s.branch || s.department;
      if (dept?.id && dept?.name) {
        deptSet.set(dept.id, dept.name);
      }
    });
    return Array.from(deptSet).map(([id, name]) => ({ text: name, value: id }));
  }, [students?.list]);

  // Get unique mentors for filter
  const mentorFilters = useMemo(() => {
    const mentorSet = new Map();
    mentorAssignments?.forEach((a) => {
      if (a.mentor?.id && a.mentor?.name) {
        mentorSet.set(a.mentor.id, a.mentor.name);
      }
    });
    return [
      { text: 'Not Assigned', value: 'none' },
      ...Array.from(mentorSet).map(([id, name]) => ({ text: name, value: id })),
    ];
  }, [mentorAssignments]);

  // Handle filter change - server-side filtering
  const handleFilterChange = useCallback((value) => {
    setAssignmentFilter(value);
    let hasMentor = '';
    if (value === 'assigned') hasMentor = 'true';
    else if (value === 'unassigned') hasMentor = 'false';
    setFilters((prev) => ({ ...prev, page: 1, hasMentor }));
  }, []);

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((value) => {
      setFilters((prev) => ({ ...prev, page: 1, search: value }));
    }, 300),
    []
  );

  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
    debouncedSearch(e.target.value);
  };

  const handleTableChange = (pagination, tableFilters, sorter) => {
    const newFilters = {
      ...filters,
      page: pagination.current,
      limit: pagination.pageSize,
    };

    // Handle batch filter
    if (tableFilters.batch?.length) {
      newFilters.batchId = tableFilters.batch[0];
    } else {
      newFilters.batchId = '';
    }

    // Handle department filter
    if (tableFilters.department?.length) {
      newFilters.branchId = tableFilters.department[0];
    } else {
      newFilters.branchId = '';
    }

    setFilters(newFilters);
  };

  const handleAssign = async () => {
    if (!selectedMentor || selectedStudents.length === 0) {
      message.warning('Please select mentor and at least one student');
      return;
    }

    const currentYear = new Date().getFullYear();
    const month = new Date().getMonth();
    const academicYear =
      month >= 6
        ? `${currentYear}-${(currentYear + 1).toString().slice(-2)}`
        : `${currentYear - 1}-${currentYear.toString().slice(-2)}`;

    setLoading(true);
    try {
      await dispatch(
        assignMentor({
          mentorId: selectedMentor,
          studentIds: selectedStudents,
          academicYear,
        })
      ).unwrap();

      message.success(`Successfully assigned ${selectedStudents.length} student(s) to mentor`);
      setAssignModalVisible(false);
      setSelectedStudents([]);
      setSelectedMentor(null);
      form.resetFields();
      dispatch(fetchMentorAssignments({ forceRefresh: true }));
      dispatch(fetchMentorStats({ forceRefresh: true }));
      dispatch(fetchStudents({ ...filters, forceRefresh: true }));
    } catch (error) {
      message.error(error?.message || 'Failed to assign mentor');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignment = async (studentId) => {
    try {
      await dispatch(removeMentorAssignment({ studentId })).unwrap();
      message.success('Mentor assignment removed');
      dispatch(fetchMentorStats({ forceRefresh: true }));
      dispatch(fetchStudents({ ...filters, forceRefresh: true }));
    } catch (error) {
      message.error(error?.message || 'Failed to remove assignment');
    }
  };

  const handleEditClick = (record) => {
    const assignment = studentMentorMap.get(record.id);
    setEditingStudent({
      ...record,
      currentMentorId: assignment?.mentor?.id,
      currentMentorName: assignment?.mentor?.name,
    });
    setNewMentorId(assignment?.mentor?.id || null);
    editForm.setFieldsValue({
      mentorId: assignment?.mentor?.id,
    });
    setEditModalVisible(true);
  };

  const handleChangeMentor = async () => {
    if (!editingStudent || !newMentorId) {
      message.warning('Please select a mentor');
      return;
    }

    if (newMentorId === editingStudent.currentMentorId) {
      message.info('No changes made - same mentor selected');
      setEditModalVisible(false);
      return;
    }

    const currentYear = new Date().getFullYear();
    const month = new Date().getMonth();
    const academicYear =
      month >= 6
        ? `${currentYear}-${(currentYear + 1).toString().slice(-2)}`
        : `${currentYear - 1}-${currentYear.toString().slice(-2)}`;

    setLoading(true);
    try {
      await dispatch(
        assignMentor({
          mentorId: newMentorId,
          studentIds: [editingStudent.id],
          academicYear,
          reason: 'Mentor reassignment',
        })
      ).unwrap();

      message.success('Mentor changed successfully');
      setEditModalVisible(false);
      setEditingStudent(null);
      setNewMentorId(null);
      editForm.resetFields();
      dispatch(fetchMentorAssignments({ forceRefresh: true }));
      dispatch(fetchMentorStats({ forceRefresh: true }));
      dispatch(fetchStudents({ ...filters, forceRefresh: true }));
    } catch (error) {
      message.error(error?.message || 'Failed to change mentor');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUnassign = async () => {
    if (selectedStudents.length === 0) {
      message.warning('Please select students to unassign');
      return;
    }

    const studentsToUnassign = selectedStudents.filter((id) => studentsWithMentors.has(id));
    if (studentsToUnassign.length === 0) {
      message.warning('No selected students have mentors assigned');
      return;
    }

    setLoading(true);
    try {
      await dispatch(bulkUnassignMentors({ studentIds: studentsToUnassign })).unwrap();
      message.success(`Removed mentor assignments from ${studentsToUnassign.length} student(s)`);
      setSelectedStudents([]);
      dispatch(fetchMentorAssignments({ forceRefresh: true }));
      dispatch(fetchMentorStats({ forceRefresh: true }));
      dispatch(fetchStudents({ ...filters, forceRefresh: true }));
    } catch (error) {
      message.error(error?.message || 'Failed to bulk unassign');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoAssign = async () => {
    setLoading(true);
    try {
      const result = await dispatch(autoAssignMentors()).unwrap();
      message.success(result.message || 'Auto-assignment completed');
      dispatch(fetchMentorAssignments({ forceRefresh: true }));
      dispatch(fetchMentorStats({ forceRefresh: true }));
      dispatch(fetchStudents({ ...filters, forceRefresh: true }));
    } catch (error) {
      message.error(error?.message || 'Failed to auto-assign');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    dispatch(fetchMentorAssignments({ forceRefresh: true }));
    dispatch(fetchMentorStats({ forceRefresh: true }));
    dispatch(fetchStudents({ ...filters, forceRefresh: true }));
  };

  const rowSelection = {
    selectedRowKeys: selectedStudents,
    onChange: (selectedRowKeys) => {
      setSelectedStudents(selectedRowKeys);
    },
    getCheckboxProps: (record) => ({
      disabled: false,
    }),
  };

  const studentColumns = [
    {
      title: 'Roll Number',
      dataIndex: 'rollNumber',
      key: 'rollNumber',
      width: 130,
      sorter: (a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || ''),
      sortDirections: ['ascend', 'descend'],
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => {
        const nameA = a.user?.name || a.name || '';
        const nameB = b.user?.name || b.name || '';
        return nameA.localeCompare(nameB);
      },
      sortDirections: ['ascend', 'descend'],
      render: (text, record) => record.user?.name || text || 'N/A',
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      filters: departmentFilters,
      filterMode: 'menu',
      filterSearch: true,
      render: (_, record) => record.branch?.name || record.department?.name || 'N/A',
    },
    {
      title: 'Batch',
      dataIndex: 'batch',
      key: 'batch',
      filters: batchFilters,
      filterMode: 'menu',
      filterSearch: true,
      render: (_, record) => record.batch?.name || record.batchId || 'N/A',
    },
    {
      title: 'Current Mentor',
      key: 'mentor',
      filters: mentorFilters,
      filterMode: 'menu',
      filterSearch: true,
      onFilter: (value, record) => {
        const assignment = studentMentorMap.get(record.id);
        if (value === 'none') {
          return !assignment;
        }
        return assignment?.mentor?.id === value;
      },
      render: (_, record) => {
        const assignment = studentMentorMap.get(record.id);
        return assignment ? (
          <Tag color="blue">{assignment.mentor?.name || assignment.mentor?.user?.name}</Tag>
        ) : (
          <Tag color="default">Not Assigned</Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => {
        const hasAssignment = studentsWithMentors.has(record.id);
        return (
          <Space size="small">
            {hasAssignment ? (
              <>
                <Tooltip title="Change Mentor">
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    size="small"
                    onClick={() => handleEditClick(record)}
                  />
                </Tooltip>
                <Popconfirm
                  title="Remove mentor assignment?"
                  description="This will unassign the mentor from this student."
                  onConfirm={() => handleRemoveAssignment(record.id)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Tooltip title="Remove Mentor">
                    <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                  </Tooltip>
                </Popconfirm>
              </>
            ) : (
              <Tooltip title="Assign Mentor">
                <Button
                  type="text"
                  icon={<UserAddOutlined />}
                  size="small"
                  onClick={() => {
                    setSelectedStudents([record.id]);
                    setAssignModalVisible(true);
                  }}
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  const assignmentColumns = [
    {
      title: 'Mentor Name',
      dataIndex: ['mentor', 'name'],
      key: 'mentorName',
      sorter: (a, b) => (a.mentor?.name || '').localeCompare(b.mentor?.name || ''),
    },
    {
      title: 'Email',
      dataIndex: ['mentor', 'email'],
      key: 'email',
    },
    {
      title: 'Total Students',
      key: 'studentCount',
      sorter: (a, b) => {
        const countA = mentorAssignments?.filter((ma) => ma.mentorId === a.mentor?.id).length || 0;
        const countB = mentorAssignments?.filter((ma) => ma.mentorId === b.mentor?.id).length || 0;
        return countA - countB;
      },
      defaultSortOrder: 'descend',
      render: (_, record) => {
        const count = mentorAssignments?.filter((a) => a.mentorId === record.mentor?.id).length || 0;
        return <Tag color={count > 15 ? 'red' : count > 10 ? 'orange' : 'green'}>{count}</Tag>;
      },
    },
    {
      title: 'Students',
      key: 'students',
      render: (_, record) => {
        const assignedStudents =
          mentorAssignments?.filter((a) => a.mentorId === record.mentor?.id) || [];
        return (
          <Flex wrap="wrap" gap={4}>
            {assignedStudents.slice(0, 3).map((a) => (
              <Tag key={a.id}>{a.student?.name || a.student?.rollNumber}</Tag>
            ))}
            {assignedStudents.length > 3 && <Tag>+{assignedStudents.length - 3} more</Tag>}
          </Flex>
        );
      },
    },
  ];

  const uniqueMentorAssignments = useMemo(() => {
    return (
      mentorAssignments?.reduce((acc, curr) => {
        if (curr.mentor && !acc.find((item) => item.mentor?.id === curr.mentor?.id)) {
          acc.push(curr);
        }
        return acc;
      }, []) || []
    );
  }, [mentorAssignments]);

  const stats = mentorStats?.data;

  // Bulk action menu items for Ant Design 5+
  const bulkMenuItems = [
    {
      key: 'assign',
      label: 'Assign Mentor',
      icon: <UserAddOutlined />,
      disabled: selectedStudents.length === 0,
    },
    {
      key: 'unassign',
      label: 'Unassign Selected',
      icon: <DeleteOutlined />,
      danger: true,
      disabled:
        selectedStudents.length === 0 ||
        !selectedStudents.some((id) => studentsWithMentors.has(id)),
    },
  ];

  const handleBulkMenuClick = ({ key }) => {
    if (key === 'assign') {
      setAssignModalVisible(true);
    } else if (key === 'unassign') {
      handleBulkUnassign();
    }
  };

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen space-y-6">
      {/* Statistics Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" className="rounded-xl border border-border shadow-sm">
            <Statistic
              title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Total Mentors</Text>}
              value={stats?.mentors?.total || 0}
              prefix={<TeamOutlined className="text-primary" />}
              valueStyle={{ color: 'var(--ant-primary-color)', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" className="rounded-xl border border-border shadow-sm">
            <Statistic
              title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Active Mentors</Text>}
              value={stats?.mentors?.assigned || 0}
              suffix={<span className="text-xs text-text-tertiary font-normal">/ {stats?.mentors?.total || 0}</span>}
              prefix={<CheckCircleOutlined className="text-success" />}
              valueStyle={{ color: 'var(--ant-success-color)', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" className="rounded-xl border border-border shadow-sm">
            <Statistic
              title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Students with Mentor</Text>}
              value={stats?.students?.withMentor || 0}
              suffix={<span className="text-xs text-text-tertiary font-normal">/ {stats?.students?.total || 0}</span>}
              prefix={<UserOutlined className="text-success" />}
              valueStyle={{ color: 'var(--ant-success-color)', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" className="rounded-xl border border-border shadow-sm">
            <Statistic
              title={<Text className="text-[10px] uppercase font-bold text-text-tertiary">Unassigned Students</Text>}
              value={stats?.students?.withoutMentor || 0}
              prefix={<CloseCircleOutlined className="text-error" />}
              valueStyle={{ color: stats?.students?.withoutMentor > 0 ? 'var(--ant-error-color)' : 'var(--ant-success-color)', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={<span className="text-text-primary font-semibold">Mentor Assignment</span>}
        extra={
          <Space>
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={handleRefresh} className="rounded-lg" />
            </Tooltip>
            {stats?.students?.withoutMentor > 0 && (
              <Popconfirm
                title="Auto-assign mentors?"
                description={`This will distribute ${stats.students.withoutMentor} unassigned student(s) evenly among available mentors.`}
                onConfirm={handleAutoAssign}
                okText="Yes, Auto-assign"
                cancelText="Cancel"
              >
                <Button icon={<ThunderboltOutlined />} loading={loading} className="rounded-lg">
                  Auto-Assign ({stats.students.withoutMentor})
                </Button>
              </Popconfirm>
            )}
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => setAssignModalVisible(true)}
              className="rounded-lg shadow-md shadow-primary/20"
            >
              Assign Mentor
            </Button>
          </Space>
        }
        className="rounded-2xl border-border shadow-sm overflow-hidden"
      >
        <div className="mb-8">
          <h3 className="text-xs uppercase tracking-widest text-text-tertiary font-bold mb-4 flex items-center gap-2">
            <TeamOutlined />
            Current Mentor Assignments
          </h3>
          <div className="bg-background rounded-xl border border-border overflow-hidden">
            <Table
              columns={assignmentColumns}
              dataSource={uniqueMentorAssignments}
              rowKey={(record) => record.mentor?.id || record.id}
              pagination={{ pageSize: 5 }}
              size="small"
              className="custom-table-small"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-6 pb-2 border-b border-border/50">
            <h3 className="text-xs uppercase tracking-widest text-text-tertiary font-bold m-0 flex items-center gap-2">
              <UserOutlined />
              All Students
            </h3>
            <Segmented
              options={[
                { label: 'All', value: 'all' },
                { label: 'Assigned', value: 'assigned' },
                { label: 'Unassigned', value: 'unassigned' },
              ]}
              value={assignmentFilter}
              onChange={handleFilterChange}
              className="rounded-lg p-1 bg-background-tertiary"
            />
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <Input
              placeholder="Search students by name or roll number..."
              prefix={<SearchOutlined className="text-text-tertiary" />}
              value={searchText}
              onChange={handleSearchChange}
              className="w-full md:w-[320px] rounded-lg h-10"
              allowClear
            />
            <div className="flex items-center gap-3">
              {selectedStudents.length > 0 && (
                <Tag color="blue" className="px-3 py-0.5 rounded-full font-medium m-0">
                  {selectedStudents.length} selected
                </Tag>
              )}
              <Dropdown
                menu={{
                  items: bulkMenuItems,
                  onClick: handleBulkMenuClick,
                }}
                disabled={selectedStudents.length === 0}
                placement="bottomRight"
              >
                <Button disabled={selectedStudents.length === 0} className="rounded-lg h-10 px-6">
                  <Space>
                    Bulk Actions
                    <DownOutlined className="text-xs" />
                  </Space>
                </Button>
              </Dropdown>
            </div>
          </div>

          <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
            <Table
              rowSelection={rowSelection}
              columns={studentColumns}
              dataSource={students?.list || []}
              rowKey="id"
              loading={students?.loading}
              onChange={handleTableChange}
              pagination={{
                current: filters.page,
                pageSize: filters.limit,
                total: students?.pagination?.total || 0,
                showSizeChanger: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} students`,
                pageSizeOptions: ['10', '20', '50', '100'],
              }}
              scroll={{ x: 900 }}
              size="middle"
              className="custom-table"
            />
          </div>
        </div>
      </Card>

      {/* Assign Modal */}
      <Modal
        title={
          <Space className="text-primary">
            <UserAddOutlined className="text-xl" />
            <span className="font-semibold text-lg">Assign Mentor to Students</span>
          </Space>
        }
        open={assignModalVisible}
        onOk={handleAssign}
        onCancel={() => {
          setAssignModalVisible(false);
          setSelectedStudents([]);
          setSelectedMentor(null);
          form.resetFields();
        }}
        width={800}
        confirmLoading={loading}
        okText="Assign"
        className="rounded-2xl overflow-hidden"
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            label="Select Mentor"
            name="mentorId"
            rules={[{ required: true, message: 'Please select a mentor' }]}
          >
            <Select
              placeholder="Search and select a mentor"
              onChange={(value) => setSelectedMentor(value)}
              showSearch
              size="large"
              className="rounded-lg"
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
              options={mentors.map((mentor) => {
                const assignedCount =
                  mentorAssignments?.filter((a) => a.mentorId === mentor.id).length || 0;
                return {
                  value: mentor.id,
                  label: `${mentor.name} (${mentor.employeeId || mentor.email}) - ${assignedCount} students`,
                };
              })}
            />
          </Form.Item>

          <Form.Item label="Selected Students" className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <TeamOutlined className="text-text-tertiary" />
              <Text className="text-text-secondary font-medium">
                {selectedStudents.length} student(s) selected for assignment
              </Text>
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <Table
                rowSelection={rowSelection}
                columns={[
                  {
                    title: 'Roll Number',
                    dataIndex: 'rollNumber',
                    key: 'rollNumber',
                    render: (text) => <Text className="font-medium text-text-primary">{text}</Text>,
                  },
                  {
                    title: 'Name',
                    dataIndex: 'name',
                    key: 'name',
                    render: (text, record) => <Text className="text-text-primary">{record.user?.name || text || 'N/A'}</Text>,
                  },
                  {
                    title: 'Status',
                    key: 'status',
                    render: (_, record) =>
                      studentsWithMentors.has(record.id) ? (
                        <Tag color="blue" className="rounded-md m-0">Has Mentor</Tag>
                      ) : (
                        <Tag className="rounded-md m-0 bg-background-tertiary text-text-tertiary border-0">No Mentor</Tag>
                      ),
                  },
                ]}
                dataSource={students?.list || []}
                rowKey="id"
                pagination={{ pageSize: 5 }}
                size="small"
                className="custom-table-small"
              />
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Mentor Modal */}
      <Modal
        title={
          <Space className="text-primary">
            <SwapOutlined className="text-xl" />
            <span className="font-semibold text-lg">Change Mentor</span>
          </Space>
        }
        open={editModalVisible}
        onOk={handleChangeMentor}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingStudent(null);
          setNewMentorId(null);
          editForm.resetFields();
        }}
        confirmLoading={loading}
        okText="Change Mentor"
        width={500}
        className="rounded-2xl overflow-hidden"
      >
        {editingStudent && (
          <Form form={editForm} layout="vertical" className="mt-4">
            <div className="mb-6 p-5 bg-background-tertiary/50 rounded-2xl border border-border/50">
              <Row gutter={16}>
                <Col span={12}>
                  <Text className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Student</Text>
                  <Text strong className="text-text-primary block text-base leading-tight">
                    {editingStudent.user?.name || editingStudent.name}
                  </Text>
                  <Text className="text-text-tertiary text-xs">{editingStudent.rollNumber}</Text>
                </Col>
                <Col span={12}>
                  <Text className="text-[10px] uppercase font-bold text-text-tertiary block mb-1">Current Mentor</Text>
                  <Text strong className="text-primary block text-base leading-tight">
                    {editingStudent.currentMentorName || 'Not Assigned'}
                  </Text>
                </Col>
              </Row>
            </div>

            <Form.Item
              label="Select New Mentor"
              name="mentorId"
              rules={[{ required: true, message: 'Please select a mentor' }]}
            >
              <Select
                placeholder="Search and select a mentor"
                onChange={(value) => setNewMentorId(value)}
                showSearch
                size="large"
                className="rounded-lg"
                filterOption={(input, option) =>
                  option.label.toLowerCase().includes(input.toLowerCase())
                }
                options={mentors.map((mentor) => {
                  const assignedCount =
                    mentorAssignments?.filter((a) => a.mentorId === mentor.id).length || 0;
                  const isCurrent = mentor.id === editingStudent.currentMentorId;
                  return {
                    value: mentor.id,
                    label: `${mentor.name} (${assignedCount} students)${isCurrent ? ' - Current' : ''}`,
                    disabled: isCurrent,
                  };
                })}
              />
            </Form.Item>

            {newMentorId && newMentorId !== editingStudent.currentMentorId && (
              <Alert
                message="Mentor Reassignment"
                description={`This will reassign the student from ${editingStudent.currentMentorName} to the selected mentor.`}
                type="info"
                showIcon
                className="mt-4 rounded-xl border-primary/20 bg-primary-50/50"
              />
            )}
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default MentorAssignment;
