import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Tabs,
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Spin,
  Empty,
  Progress,
  Typography,
  Space,
  Avatar,
  Modal,
  Descriptions,
  Badge,
  Input,
  Select,
} from 'antd';
import {
  TeamOutlined,
  BankOutlined,
  FileTextOutlined,
  CalendarOutlined,
  UserOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import {
  fetchInstituteOverview,
  fetchInstituteStudents,
  fetchInstituteCompanies,
  selectInstituteOverview,
  selectInstituteStudents,
  selectInstituteCompanies,
  selectSelectedInstitute,
} from '../../store/stateSlice';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const InstituteDetailView = () => {
  const dispatch = useDispatch();
  const selectedInstitute = useSelector(selectSelectedInstitute);
  const overview = useSelector(selectInstituteOverview);
  const students = useSelector(selectInstituteStudents);
  const companies = useSelector(selectInstituteCompanies);

  const [activeTab, setActiveTab] = useState('overview');
  const [studentModalVisible, setStudentModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState('all');

  // Fetch overview when institute changes
  useEffect(() => {
    if (selectedInstitute?.id) {
      dispatch(fetchInstituteOverview(selectedInstitute.id));
    }
  }, [dispatch, selectedInstitute?.id]);

  // Fetch tab-specific data when tab changes
  useEffect(() => {
    if (!selectedInstitute?.id) return;

    if (activeTab === 'students' && students.list.length === 0) {
      dispatch(
        fetchInstituteStudents({
          institutionId: selectedInstitute.id,
          limit: 20,
          filter: studentFilter,
        })
      );
    } else if (activeTab === 'companies' && companies.list.length === 0) {
      dispatch(fetchInstituteCompanies({ institutionId: selectedInstitute.id }));
    }
  }, [activeTab, selectedInstitute?.id, dispatch, students.list.length, companies.list.length, studentFilter]);

  // Load more students
  const handleLoadMore = useCallback(() => {
    if (students.hasMore && !students.loadingMore) {
      dispatch(
        fetchInstituteStudents({
          institutionId: selectedInstitute.id,
          cursor: students.cursor,
          limit: 20,
          search: studentSearch,
          filter: studentFilter,
          loadMore: true,
        })
      );
    }
  }, [dispatch, selectedInstitute?.id, students.cursor, students.hasMore, students.loadingMore, studentSearch, studentFilter]);

  // Student search handler
  const handleStudentSearch = useCallback(
    (value) => {
      setStudentSearch(value);
      dispatch(
        fetchInstituteStudents({
          institutionId: selectedInstitute.id,
          limit: 20,
          search: value,
          filter: studentFilter,
        })
      );
    },
    [dispatch, selectedInstitute?.id, studentFilter]
  );

  // View student details
  const handleViewStudent = (student) => {
    setSelectedStudent(student);
    setStudentModalVisible(true);
  };

  // Render overview tab content
  const OverviewTab = () => {
    const data = overview.data;
    if (overview.loading) return <Spin className="flex justify-center py-12" />;
    if (!data) return <Empty description="No data available" />;

    return (
      <div className="space-y-6">
        {/* Student Stats */}
        <Card title={<><TeamOutlined className="mr-2" />Student Overview</>} size="small">
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={8} md={6}>
              <Statistic title="Total Students" value={data.totalStudents || 0} />
            </Col>
            <Col xs={12} sm={8} md={6}>
              <Statistic
                title="Assigned"
                value={data.assignedStudents || 0}
                valueStyle={{ color: '#3f8600' }}
              />
            </Col>
            <Col xs={12} sm={8} md={6}>
              <Statistic
                title="Unassigned"
                value={data.unassignedStudents || 0}
                valueStyle={{ color: '#cf1322' }}
              />
            </Col>
            <Col xs={12} sm={8} md={6}>
              <Progress
                type="circle"
                percent={Math.round(((data.assignedStudents || 0) / (data.totalStudents || 1)) * 100)}
                size={80}
                format={(p) => `${p}%`}
              />
            </Col>
          </Row>
        </Card>

        {/* Internship Stats */}
        <Card title={<><BankOutlined className="mr-2" />Internship Status</>} size="small">
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={8}>
              <Statistic title="Total Internships" value={data.internshipsAdded || 0} />
            </Col>
            <Col xs={12} sm={8}>
              <Statistic
                title="Active"
                value={data.internshipsActive || 0}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
          </Row>
        </Card>

        {/* Report Status */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title={<><FileTextOutlined className="mr-2" />Joining Reports</>} size="small">
              <Row gutter={[8, 8]}>
                <Col span={8}>
                  <Statistic title="Submitted" value={data.joiningReportStatus?.submitted || 0} />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Pending"
                    value={data.joiningReportStatus?.pending || 0}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Approved"
                    value={data.joiningReportStatus?.approved || 0}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title={<><CalendarOutlined className="mr-2" />Monthly Reports</>} size="small">
              <Row gutter={[8, 8]}>
                <Col span={8}>
                  <Statistic title="Submitted" value={data.monthlyReportStatus?.submitted || 0} />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Pending"
                    value={data.monthlyReportStatus?.pending || 0}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Reviewed"
                    value={data.monthlyReportStatus?.reviewed || 0}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        {/* Faculty Visits */}
        <Card title={<><EnvironmentOutlined className="mr-2" />Faculty Visits This Month</>} size="small">
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={8}>
              <Statistic
                title="Pending"
                value={data.facultyVisits?.pendingThisMonth || 0}
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
            <Col xs={12} sm={8}>
              <Statistic
                title="Completed"
                value={data.facultyVisits?.completedThisMonth || 0}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col xs={12} sm={8}>
              <Statistic title="Total" value={data.facultyVisits?.totalThisMonth || 0} />
            </Col>
          </Row>
        </Card>
      </div>
    );
  };

  // Student columns for table
  const studentColumns = [
    {
      title: 'Student',
      key: 'student',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <Avatar icon={<UserOutlined />} />
          <div>
            <Text strong>{record.name}</Text>
            <br />
            <Text type="secondary" className="text-xs">
              {record.rollNumber}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Branch',
      dataIndex: 'branchName',
      key: 'branchName',
    },
    {
      title: 'Mentor',
      key: 'mentor',
      render: (_, record) => {
        const activeMentor = record.mentorAssignments?.find(ma => ma.isActive)?.mentor;
        return activeMentor ? (
          <Tag color="green">{activeMentor.name}</Tag>
        ) : (
          <Tag color="red">Unassigned</Tag>
        );
      },
    },
    {
      title: 'Company',
      key: 'company',
      render: (_, record) => {
        const selectedApplication = record.internshipApplications?.find(app => app.status === 'SELECTED');
        const company = selectedApplication?.internship?.industry;
        return company ? (
          <Tag color="blue">{company.name}</Tag>
        ) : (
          <Text type="secondary">-</Text>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => handleViewStudent(record)}>
          View Details
        </Button>
      ),
    },
  ];

  // Company columns
  const companyColumns = [
    {
      title: 'Company',
      key: 'company',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <Avatar icon={<BankOutlined />} className="bg-blue-500" />
          <div>
            <Text strong>{record.name}</Text>
            <br />
            <Text type="secondary" className="text-xs">
              {record.city}, {record.state}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'companyType',
      key: 'companyType',
      render: (type) => <Tag>{type || 'N/A'}</Tag>,
    },
    {
      title: 'Students',
      dataIndex: 'studentCount',
      key: 'studentCount',
      render: (count) => <Badge count={count || 0} style={{ backgroundColor: '#1890ff' }} showZero />,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => (
        <Space>
          {record.isApproved && <Tag color="green">Approved</Tag>}
          {record.isVerified && <Tag color="blue">Verified</Tag>}
          {!record.isApproved && !record.isVerified && <Tag color="default">Pending</Tag>}
        </Space>
      ),
    },
  ];

  // No institute selected state
  if (!selectedInstitute?.id) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <BankOutlined className="text-6xl text-gray-300 mb-4" />
        <Title level={4} type="secondary">
          Select an Institution
        </Title>
        <Text type="secondary">Choose an institution from the side panel to view details</Text>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4">
        <Title level={4} className="!mb-1">
          {overview.data?.institution?.name || 'Loading...'}
        </Title>
        <Text type="secondary">
          {overview.data?.institution?.code} • {overview.data?.institution?.city}
        </Text>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={
            <>
              <TeamOutlined />
              Overview
            </>
          }
          key="overview"
        >
          <OverviewTab />
        </TabPane>

        <TabPane
          tab={
            <>
              <UserOutlined />
              Students ({students.total})
            </>
          }
          key="students"
        >
          <div className="mb-4">
            <Space>
              <Input.Search
                placeholder="Search students..."
                onSearch={handleStudentSearch}
                style={{ width: 250 }}
                allowClear
              />
              <Select
                value={studentFilter}
                onChange={(v) => {
                  setStudentFilter(v);
                  dispatch(
                    fetchInstituteStudents({
                      institutionId: selectedInstitute.id,
                      limit: 20,
                      search: studentSearch,
                      filter: v,
                    })
                  );
                }}
                style={{ width: 150 }}
              >
                <Select.Option value="all">All Students</Select.Option>
                <Select.Option value="assigned">Assigned</Select.Option>
                <Select.Option value="unassigned">Unassigned</Select.Option>
              </Select>
            </Space>
          </div>

          <Table
            columns={studentColumns}
            dataSource={students.list}
            rowKey="id"
            loading={students.loading}
            pagination={false}
          />

          {students.hasMore && (
            <div className="text-center mt-4">
              <Button onClick={handleLoadMore} loading={students.loadingMore}>
                Load More
              </Button>
            </div>
          )}
        </TabPane>

        <TabPane
          tab={
            <>
              <BankOutlined />
              Companies ({companies.total})
            </>
          }
          key="companies"
        >
          <Table
            columns={companyColumns}
            dataSource={companies.list}
            rowKey="id"
            loading={companies.loading}
            pagination={{ pageSize: 10 }}
          />
        </TabPane>
      </Tabs>

      {/* Student Detail Modal */}
      <Modal
        title="Student Details"
        open={studentModalVisible}
        onCancel={() => setStudentModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedStudent && (() => {
          const activeMentor = selectedStudent.mentorAssignments?.find(ma => ma.isActive)?.mentor;
          const selectedApplication = selectedStudent.internshipApplications?.find(app => app.status === 'SELECTED');
          const internship = selectedApplication?.internship;
          const company = internship?.industry;

          return (
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Name">{selectedStudent.name}</Descriptions.Item>
              <Descriptions.Item label="Roll Number">{selectedStudent.rollNumber}</Descriptions.Item>
              <Descriptions.Item label="Email">{selectedStudent.email}</Descriptions.Item>
              <Descriptions.Item label="Branch">{selectedStudent.branchName}</Descriptions.Item>
              <Descriptions.Item label="Mentor">
                {activeMentor ? (
                  <Tag color="green">{activeMentor.name}</Tag>
                ) : (
                  <Tag color="red">Unassigned</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Reports Submitted">
                {selectedStudent.reportsSubmitted || 0}
              </Descriptions.Item>
              {internship && (
                <>
                  <Descriptions.Item label="Company" span={2}>
                    {company?.name}
                  </Descriptions.Item>
                  <Descriptions.Item label="Internship">
                    {internship.title}
                  </Descriptions.Item>
                  <Descriptions.Item label="Status">
                    <Tag color="blue">{selectedApplication.status}</Tag>
                  </Descriptions.Item>
                </>
              )}
              <Descriptions.Item label="Last Visit">{selectedStudent.lastVisitDate || 'No visits yet'}</Descriptions.Item>
            </Descriptions>
          );
        })()}
      </Modal>
    </div>
  );
};

export default InstituteDetailView;
