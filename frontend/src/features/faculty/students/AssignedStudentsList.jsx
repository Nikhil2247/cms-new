import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Card,
  List,
  Typography,
  Spin,
  Row,
  Col,
  Tag,
  Input,
  Button,
  Tabs,
  Empty,
  Timeline,
} from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAssignedStudents,
  selectStudents,
} from '../store/facultySlice';
import ProfileAvatar from '../../../components/common/ProfileAvatar';
import {
  SearchOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  TeamOutlined,
  IdcardOutlined,
  BookOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  BulbOutlined,
  LaptopOutlined,
  EnvironmentOutlined,
  BankOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import StudentDetailsModal from '../dashboard/components/StudentDetailsModal';

const { Title, Text } = Typography;

const AssignedStudentsList = () => {
  const dispatch = useDispatch();
  const studentsState = useSelector(selectStudents);
  const students = studentsState?.list || [];
  const loading = studentsState?.loading || false;

  // Local state
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchAssignedStudents());
  }, [dispatch]);

  // Process students data
  const processedStudents = useMemo(() => {
    if (!Array.isArray(students)) return [];
    return students.map(item => {
      const student = item.student || item;
      return {
        ...student,
        assignmentId: item.id !== student.id ? item.id : null,
        branchName: student.branchName || student.branch?.name || 'N/A',
        activeInternship: student.internshipApplications?.find(
          app => app.internshipPhase === 'ACTIVE' && !app.completionDate
        ),
        hasPendingApps: student.internshipApplications?.some(
          app => app.status === 'APPLIED' || app.status === 'UNDER_REVIEW'
        ),
        internshipApplications: student.internshipApplications || [],
        _original: item,
      };
    });
  }, [students]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return processedStudents.filter(student => {
      const matchSearch =
        !search ||
        student.name?.toLowerCase().includes(search.toLowerCase()) ||
        student.rollNumber?.toLowerCase().includes(search.toLowerCase()) ||
        student.email?.toLowerCase().includes(search.toLowerCase());

      return matchSearch;
    });
  }, [processedStudents, search]);

  // Select first student when list changes
  useEffect(() => {
    if (filteredStudents.length > 0 && !selectedStudent) {
      setSelectedStudent(filteredStudents[0]);
    }
  }, [filteredStudents]);

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
  };

  const handleRefresh = useCallback(() => {
    dispatch(fetchAssignedStudents({ forceRefresh: true }));
  }, [dispatch]);

  // Helper functions
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return dayjs(dateString).format('DD MMM YYYY');
  };

  const getInternshipStatusTag = (student) => {
    if (student.activeInternship) {
      return <Tag icon={<CheckCircleOutlined />} color="success">Active Internship</Tag>;
    }
    if (student.hasPendingApps) {
      return <Tag icon={<ClockCircleOutlined />} color="warning">Pending Approval</Tag>;
    }
    const appCount = student.internshipApplications?.length || 0;
    if (appCount > 0) {
      return <Tag color="blue">{appCount} Applications</Tag>;
    }
    return <Tag color="default">No Applications</Tag>;
  };

  // Get visits from selected student
  const getStudentVisits = () => {
    if (!selectedStudent) return [];
    const app = selectedStudent.activeInternship || selectedStudent.internshipApplications?.[0];
    return app?.facultyVisitLogs || [];
  };

  // Get monthly reports from selected student
  const getStudentReports = () => {
    if (!selectedStudent) return [];
    const app = selectedStudent.activeInternship || selectedStudent.internshipApplications?.[0];
    return app?.monthlyReports || [];
  };

  // Tab items
  const tabItems = [
    {
      key: '1',
      label: <span><UserOutlined /> Personal Info</span>,
      children: selectedStudent && (
        <div className="grid md:grid-cols-2 gap-6 p-4">
          <Card title="Basic Information" className="shadow-sm border-0" size="small">
            <div className="grid grid-cols-2 gap-y-3">
              <div className="text-gray-500">Gender</div>
              <div>{selectedStudent.gender || 'N/A'}</div>

              <div className="text-gray-500">Category</div>
              <div>
                {selectedStudent.category ? (
                  <Tag color="blue">{selectedStudent.category}</Tag>
                ) : 'N/A'}
              </div>

              <div className="text-gray-500">Roll Number</div>
              <div>{selectedStudent.rollNumber || 'N/A'}</div>

              <div className="text-gray-500">Batch</div>
              <div>{selectedStudent.batchName || selectedStudent.batch?.name || 'N/A'}</div>

              <div className="text-gray-500">Branch</div>
              <div>{selectedStudent.branchName || 'N/A'}</div>

              <div className="text-gray-500">Year / Semester</div>
              <div>
                {selectedStudent.currentYear && selectedStudent.currentSemester
                  ? `Year ${selectedStudent.currentYear} / Sem ${selectedStudent.currentSemester}`
                  : selectedStudent.semester ? `Sem ${selectedStudent.semester}` : 'N/A'}
              </div>

              <div className="text-gray-500">CGPA</div>
              <div>{selectedStudent.cgpa ? selectedStudent.cgpa.toFixed(2) : 'N/A'}</div>
            </div>
          </Card>

          <Card title="Contact Information" className="shadow-sm border-0" size="small">
            <div className="grid grid-cols-2 gap-y-3">
              <div className="text-gray-500">Email</div>
              <div className="truncate">{selectedStudent.email || 'N/A'}</div>

              <div className="text-gray-500">Contact</div>
              <div>{selectedStudent.contact || selectedStudent.phone || selectedStudent.mobileNumber || 'N/A'}</div>

              <div className="text-gray-500">Address</div>
              <div>{selectedStudent.address || 'N/A'}</div>

              <div className="text-gray-500">City</div>
              <div>{selectedStudent.city || 'N/A'}</div>

              <div className="text-gray-500">State</div>
              <div>{selectedStudent.state || 'N/A'}</div>

              <div className="text-gray-500">Pin Code</div>
              <div>{selectedStudent.pinCode || selectedStudent.pincode || 'N/A'}</div>

              <div className="text-gray-500">Guardian Name</div>
              <div>{selectedStudent.guardianName || selectedStudent.parentName || 'N/A'}</div>

              <div className="text-gray-500">Guardian Contact</div>
              <div>{selectedStudent.guardianPhone || selectedStudent.parentContact || 'N/A'}</div>
            </div>
          </Card>
        </div>
      ),
    },
    {
      key: '2',
      label: <span><LaptopOutlined /> Internships ({selectedStudent?.internshipApplications?.length || 0})</span>,
      children: (
        <div className="p-4">
          {(selectedStudent?.internshipApplications || []).length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {(selectedStudent.internshipApplications || []).map((app, index) => (
                <Card
                  key={app.id || index}
                  className={`shadow-sm border-l-4 ${
                    app.internshipPhase === 'ACTIVE'
                      ? 'border-l-green-500 bg-green-50'
                      : app.internshipPhase === 'COMPLETED'
                      ? 'border-l-blue-500 bg-blue-50'
                      : 'border-l-orange-500 bg-orange-50'
                  }`}
                  size="small"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-semibold text-lg text-gray-800">
                        {app.companyName || app.internship?.industry?.companyName || 'Company'}
                      </div>
                      {app.jobProfile && (
                        <div className="text-sm text-gray-600">{app.jobProfile}</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Tag color={
                        app.internshipPhase === 'COMPLETED' ? 'success'
                        : app.internshipPhase === 'ACTIVE' ? 'processing'
                        : app.status === 'JOINED' ? 'blue'
                        : 'warning'
                      }>
                        {app.internshipPhase || app.status}
                      </Tag>
                      {app.isSelfIdentified && (
                        <Tag color="purple" icon={<BankOutlined />}>Self Identified</Tag>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {app.stipend && (
                      <div>
                        <span className="text-gray-500">Stipend:</span>
                        <span className="ml-1 font-medium">₹{app.stipend}/month</span>
                      </div>
                    )}
                    {app.internshipDuration && (
                      <div>
                        <span className="text-gray-500">Duration:</span>
                        <span className="ml-1 font-medium">{app.internshipDuration} months</span>
                      </div>
                    )}
                    {app.startDate && (
                      <div>
                        <span className="text-gray-500">Start:</span>
                        <span className="ml-1 font-medium">{formatDate(app.startDate)}</span>
                      </div>
                    )}
                    {app.endDate && (
                      <div>
                        <span className="text-gray-500">End:</span>
                        <span className="ml-1 font-medium">{formatDate(app.endDate)}</span>
                      </div>
                    )}
                  </div>

                  {app.companyAddress && (
                    <div className="mt-2 text-xs text-gray-500">
                      <EnvironmentOutlined className="mr-1" />
                      {app.companyAddress}
                    </div>
                  )}

                  {/* Visit and Report counts */}
                  <div className="mt-3 pt-2 border-t border-gray-200 flex gap-4 text-xs">
                    <span>
                      <CheckCircleOutlined className="mr-1 text-green-500" />
                      Visits: {app.facultyVisitLogs?.length || 0}
                    </span>
                    <span>
                      <FileTextOutlined className="mr-1 text-blue-500" />
                      Reports: {app.monthlyReports?.length || 0}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Empty description="No internship applications yet" className="py-8" />
          )}
        </div>
      ),
    },
    {
      key: '3',
      label: <span><EnvironmentOutlined /> Visits ({getStudentVisits().length})</span>,
      children: (
        <div className="p-4">
          {getStudentVisits().length > 0 ? (
            <Timeline
              className="mt-2"
              items={getStudentVisits().map((visit, idx) => ({
                key: idx,
                color: visit.status === 'COMPLETED' ? 'green' : 'blue',
                children: (
                  <Card size="small" className="shadow-sm mb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <Text strong>
                          {dayjs(visit.visitDate).format('DD MMM YYYY, hh:mm A')}
                        </Text>
                        <Tag
                          color={visit.visitType === 'PHYSICAL' ? 'green' : visit.visitType === 'VIRTUAL' ? 'blue' : 'orange'}
                          className="ml-2"
                        >
                          {visit.visitType || 'PHYSICAL'}
                        </Tag>
                      </div>
                      <Tag color={visit.status === 'COMPLETED' ? 'success' : 'processing'}>
                        {visit.status || 'Logged'}
                      </Tag>
                    </div>
                    {visit.visitLocation && (
                      <div className="text-sm mt-1 text-gray-500">
                        <EnvironmentOutlined className="mr-1" />
                        {visit.visitLocation}
                      </div>
                    )}
                    {visit.remarks && (
                      <div className="text-sm mt-2 text-gray-600">
                        {visit.remarks}
                      </div>
                    )}
                  </Card>
                ),
              }))}
            />
          ) : (
            <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
              <EnvironmentOutlined style={{ fontSize: '2rem' }} className="mb-3 text-gray-400" />
              <div>No visits logged yet</div>
            </div>
          )}
        </div>
      ),
    },
    {
      key: '4',
      label: <span><FileTextOutlined /> Reports ({getStudentReports().length})</span>,
      children: (
        <div className="p-4">
          {getStudentReports().length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getStudentReports().map((report, idx) => (
                <Card
                  key={report.id || idx}
                  size="small"
                  className={`shadow-sm border-l-4 ${
                    report.status === 'APPROVED' ? 'border-l-green-500'
                    : report.status === 'DRAFT' ? 'border-l-orange-500'
                    : 'border-l-blue-500'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <Text strong>
                        {dayjs().month(report.reportMonth - 1).format('MMMM')} {report.reportYear}
                      </Text>
                    </div>
                    <Tag color={
                      report.status === 'APPROVED' ? 'success'
                      : report.status === 'DRAFT' ? 'warning'
                      : 'processing'
                    }>
                      {report.status}
                    </Tag>
                  </div>
                  {report.submittedAt && (
                    <Text className="text-xs block mt-2 text-gray-500">
                      Submitted: {formatDate(report.submittedAt)}
                    </Text>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
              <FileTextOutlined style={{ fontSize: '2rem' }} className="mb-3 text-gray-400" />
              <div>No monthly reports submitted yet</div>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <Title level={3} className="text-blue-800 !mb-0">
            Assigned Students
          </Title>
        </div>
        {selectedStudent && (
          <div className="flex gap-2 flex-wrap">
            <Button
              type="primary"
              icon={<UserOutlined />}
              onClick={() => setDetailModalVisible(true)}
              className="bg-gradient-to-r from-blue-500 to-blue-700"
            >
              View Application Details
            </Button>
          </div>
        )}
      </div>

      <Row gutter={[16, 16]}>
        {/* Students List - Left Column */}
        <Col xs={24} sm={24} md={8} lg={6} xl={6}>
          <Card
            title={
              <div className="flex items-center text-blue-800">
                <TeamOutlined className="mr-2" /> Students Directory
                <Text type="secondary" className="ml-auto text-xs">
                  {filteredStudents.length} of {processedStudents.length} students
                </Text>
              </div>
            }
            className="rounded-lg border-0"
            styles={{
              body: { padding: 0, maxHeight: 'calc(80vh - 80px)', overflowY: 'hidden' },
              header: { borderBottom: '2px solid #e6f7ff', backgroundColor: '#f0f7ff' },
            }}
          >
            <div
              style={{ maxHeight: 'calc(80vh - 80px)', overflowY: 'auto', padding: '0.5rem' }}
              className="hide-scrollbar"
            >
              <Input
                placeholder="Search Student..."
                className="mb-3 rounded-lg"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                prefix={<SearchOutlined className="text-gray-400" />}
                allowClear
              />

              {loading && processedStudents.length === 0 ? (
                <div className="flex justify-center items-center h-40">
                  <Spin size="small" tip="Loading students..." />
                </div>
              ) : (
                <List
                  itemLayout="horizontal"
                  dataSource={filteredStudents}
                  locale={{ emptyText: 'No students found' }}
                  renderItem={(student) => (
                    <List.Item
                      onClick={() => handleStudentSelect(student)}
                      className={`cursor-pointer my-2 rounded-xl transition-all duration-300 ease-in-out ${
                        selectedStudent?.id === student.id
                          ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-indigo-100 border-l-4 border-l-blue-500 shadow-sm'
                          : 'hover:bg-gray-100 hover:shadow-md hover:translate-x-1'
                      }`}
                    >
                      <List.Item.Meta
                        className="px-3 py-1"
                        avatar={
                          <ProfileAvatar
                            profileImage={student.profileImage}
                            size={50}
                            className={selectedStudent?.id === student.id
                              ? 'border-2 border-blue-400'
                              : 'border border-gray-200 hover:border-gray-300'
                            }
                          />
                        }
                        title={
                          <Text className="font-semibold !text-sm !text-gray-600">
                            {student.name}
                          </Text>
                        }
                        description={
                          <div>
                            {student.branchName && (
                              <Tag color="blue" className="text-xs">{student.branchName}</Tag>
                            )}
                            {getInternshipStatusTag(student)}
                            <div className="mt-1 text-xs text-gray-500">
                              <IdcardOutlined className="mr-1" />
                              {student.rollNumber}
                              {student.semester && (
                                <span className="ml-2">| Sem {student.semester}</span>
                              )}
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </div>
          </Card>
        </Col>

        {/* Student Details - Right Column */}
        <Col xs={24} sm={24} md={16} lg={18} xl={18} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          {selectedStudent ? (
            <div className="space-y-4">
              {/* Profile Header */}
              <Card className="border-0 rounded-lg shadow-sm">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <ProfileAvatar
                    profileImage={selectedStudent.profileImage}
                    size={90}
                    className="border-4 border-white shadow-lg"
                  />
                  <div className="flex-grow text-center md:text-left">
                    <Title level={3} className="mb-0 text-blue-800">
                      {selectedStudent.name}
                    </Title>
                    <div className="flex justify-center md:justify-start items-center text-gray-500 mb-1">
                      <IdcardOutlined className="mr-2" />
                      {selectedStudent.rollNumber}
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                      {selectedStudent.branchName && (
                        <Tag color="blue" className="px-3 py-1 rounded-full">
                          {selectedStudent.branchName}
                        </Tag>
                      )}
                      {selectedStudent.category && (
                        <Tag color="purple" className="px-3 py-1 rounded-full">
                          {selectedStudent.category}
                        </Tag>
                      )}
                      {(selectedStudent.batchName || selectedStudent.batch?.name) && (
                        <Tag color="cyan" className="px-3 py-1 rounded-full">
                          {selectedStudent.batchName || selectedStudent.batch?.name}
                        </Tag>
                      )}
                      {selectedStudent.semester && (
                        <Tag color="geekblue" className="px-3 py-1 rounded-full">
                          <BookOutlined className="mr-1" />
                          Semester {selectedStudent.semester}
                        </Tag>
                      )}
                      {getInternshipStatusTag(selectedStudent)}
                    </div>
                  </div>
                </div>

                {/* Contact Quick Info */}
                <div className="grid lg:grid-cols-3 gap-4 mt-6 p-3 rounded-lg shadow-sm bg-gray-50">
                  <div className="flex items-center">
                    <MailOutlined className="text-blue-500 text-xl mr-3" />
                    <div>
                      <div className="text-xs text-gray-500">Email</div>
                      <div className="text-sm font-medium truncate">{selectedStudent.email || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <PhoneOutlined className="text-green-500 text-xl mr-3" />
                    <div>
                      <div className="text-xs text-gray-500">Contact</div>
                      <div className="text-sm font-medium">{selectedStudent.contact || selectedStudent.phone || selectedStudent.mobileNumber || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <BulbOutlined className="text-orange-500 text-xl mr-3" />
                    <div>
                      <div className="text-xs text-gray-500">CGPA</div>
                      <div className="text-sm font-medium">{selectedStudent.cgpa ? selectedStudent.cgpa.toFixed(2) : 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Detailed Information in Tabs */}
              <Card className="rounded-lg !mt-3 shadow-sm" styles={{ body: { padding: 0 } }}>
                <Tabs
                  defaultActiveKey="1"
                  items={tabItems}
                  tabBarStyle={{ padding: '10px 16px 0', marginBottom: 0 }}
                  className="student-tabs"
                />
              </Card>
            </div>
          ) : (
            <Card className="min-h-[75vh] shadow-xl rounded-3xl bg-white/90 backdrop-blur-lg border-0 flex items-center justify-center">
              <div className="text-center max-w-md mx-auto py-16">
                <div className="relative mb-8">
                  <div className="w-24 h-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded-3xl flex items-center justify-center mb-4 mx-auto">
                    <UserOutlined className="text-gray-600 text-4xl" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                    <SearchOutlined className="text-indigo-500 text-sm" />
                  </div>
                </div>
                <Title level={4} className="text-gray-600 mb-4">
                  Select a Student
                </Title>
                <Text className="text-gray-500 text-base block mb-6">
                  Choose a student from the directory on the left to view detailed information and track their internship progress.
                </Text>
                <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-4 border-0">
                  <Text className="text-indigo-700 text-sm">
                    Tip: Use the search and filters to quickly find specific students
                  </Text>
                </Card>
              </div>
            </Card>
          )}
        </Col>
      </Row>

      {/* Student Detail Modal */}
      <StudentDetailsModal
        visible={detailModalVisible}
        student={selectedStudent?._original || selectedStudent}
        onClose={() => setDetailModalVisible(false)}
        onRefresh={handleRefresh}
        loading={loading}
      />
    </div>
  );
};

export default AssignedStudentsList;
