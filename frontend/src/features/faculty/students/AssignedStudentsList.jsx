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
  Upload,
  message,
  Tooltip,
  Dropdown,
  Modal,
  Form,
  Select,
  Popconfirm,
} from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAssignedStudents,
  selectStudents,
  uploadJoiningLetter,
  uploadMonthlyReport,
  updateStudent,
  uploadStudentDocument,
  toggleStudentStatus,
  deleteInternship,
  optimisticallyUpdateStudent,
  optimisticallyToggleStudentStatus,
  rollbackStudentOperation,
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
  UploadOutlined,
  EyeOutlined,
  CalendarOutlined,
  MoreOutlined,
  EditOutlined,
  StopOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import StudentDetailsModal from '../dashboard/components/StudentDetailsModal';
import UnifiedVisitLogModal from '../visits/UnifiedVisitLogModal';
import FacultyStudentModal from './FacultyStudentModal';

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
  const [visitModalVisible, setVisitModalVisible] = useState(false);
  const [uploadingJoiningLetter, setUploadingJoiningLetter] = useState(false);
  const [uploadingReport, setUploadingReport] = useState(false);

  // Document upload modal state
  const [uploadDocumentModal, setUploadDocumentModal] = useState(false);
  const [uploadForm] = Form.useForm();
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Edit student modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState(null);

  // Delete internship state
  const [deletingInternshipId, setDeletingInternshipId] = useState(null);

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
        branchName: student.user?.branchName || student.branchName || student.branch?.name || 'N/A',
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
        student?.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
        student?.user?.rollNumber?.toLowerCase().includes(search.toLowerCase()) ||
        student?.user?.email?.toLowerCase().includes(search.toLowerCase());

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

  // Get active internship application for the selected student
  const getActiveApplication = useCallback(() => {
    if (!selectedStudent) return null;
    return selectedStudent.activeInternship || selectedStudent.internshipApplications?.[0] || null;
  }, [selectedStudent]);

  // Handle visit log success
  const handleVisitSuccess = useCallback(() => {
    setVisitModalVisible(false);
    handleRefresh();
  }, [handleRefresh]);

  // Handle joining letter upload
  const handleJoiningLetterUpload = async (file) => {
    const app = getActiveApplication();
    if (!app?.id) {
      message.error('No active internship application found');
      return false;
    }

    setUploadingJoiningLetter(true);
    try {
      await dispatch(uploadJoiningLetter({ applicationId: app.id, file })).unwrap();
      message.success('Joining letter uploaded successfully');
      handleRefresh();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to upload joining letter';
      message.error(errorMessage);
    } finally {
      setUploadingJoiningLetter(false);
    }
    return false;
  };

  // Handle monthly report upload
  const handleReportUpload = async (file) => {
    const app = getActiveApplication();
    if (!app?.id) {
      message.error('No active internship application found');
      return false;
    }

    setUploadingReport(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('applicationId', app.id);
      formData.append('reportMonth', dayjs().month() + 1);
      formData.append('reportYear', dayjs().year());

      await dispatch(uploadMonthlyReport(formData)).unwrap();
      message.success('Monthly report uploaded successfully');
      handleRefresh();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to upload report';
      message.error(errorMessage);
    } finally {
      setUploadingReport(false);
    }
    return false;
  };

  // Handle document upload
  const handleDocumentUpload = async () => {
    try {
      const values = await uploadForm.validateFields();
      if (fileList.length === 0) {
        message.error('Please select a file to upload');
        return;
      }

      setUploading(true);
      const file = fileList[0].originFileObj || fileList[0];

      await dispatch(uploadStudentDocument({
        studentId: selectedStudent.id,
        file: file,
        type: values.documentType
      })).unwrap();
      message.success('Document uploaded successfully');
      setUploadDocumentModal(false);
      uploadForm.resetFields();
      setFileList([]);
      handleRefresh();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to upload document';
      message.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // Handle activate/deactivate student with optimistic update
  const handleToggleStatus = async () => {
    if (!selectedStudent) return;

    const studentId = selectedStudent.id;
    const newStatus = selectedStudent?.user?.active === false ? true : false;
    const previousList = [...students];

    setTogglingStatus(true);

    // Optimistic update - update UI immediately
    dispatch(optimisticallyToggleStudentStatus({ studentId, isActive: newStatus }));

    // Update selected student locally
    setSelectedStudent(prev => prev ? { ...prev, user: { ...prev.user, active: newStatus } } : null);

    try {
      await dispatch(toggleStudentStatus({
        studentId,
        isActive: newStatus
      })).unwrap();
      message.success(`Student ${newStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      // Rollback on error
      dispatch(rollbackStudentOperation({ list: previousList }));
      setSelectedStudent(prev => prev ? { ...prev, user: { ...prev.user, active: !newStatus } } : null);
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to update student status';
      message.error(errorMessage);
    } finally {
      setTogglingStatus(false);
    }
  };

  // Document type options
  const documentTypeOptions = [
    { value: 'MARKSHEET_10TH', label: '10th Marksheet' },
    { value: 'MARKSHEET_12TH', label: '12th Marksheet' },
    { value: 'CASTE_CERTIFICATE', label: 'Caste Certificate' },
    { value: 'PHOTO', label: 'Photo' },
    { value: 'OTHER', label: 'Other' },
  ];

  // Edit modal handlers
  const openEditModal = () => {
    // Get the student ID from the selected student
    const studentId = selectedStudent?.id || selectedStudent?.student?.id;
    console.log('Opening edit modal for student:', selectedStudent);
    console.log('Student ID:', studentId);
    setEditingStudentId(studentId);
    setIsEditModalOpen(true);
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setEditingStudentId(null);
  };

  const handleEditModalSuccess = (updatedData) => {
    // Update the selected student with new data
    if (updatedData && selectedStudent) {
      setSelectedStudent(prev => prev ? { ...prev, ...updatedData } : null);
    }
    // Refresh list to ensure consistency
    handleRefresh();
  };


  // Three-dot menu items
  const getActionMenuItems = () => [
    {
      key: 'upload',
      icon: <UploadOutlined />,
      label: 'Upload Document',
      onClick: () => setUploadDocumentModal(true),
    },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: 'Edit Profile',
      onClick: openEditModal,
    },
    {
      type: 'divider',
    },
    {
      key: 'toggle',
      icon: selectedStudent?.user?.active === false ? <PlayCircleOutlined /> : <StopOutlined />,
      label: selectedStudent?.user?.active === false ? 'Activate Student' : 'Deactivate Student',
      danger: selectedStudent?.user?.active !== false,
      onClick: handleToggleStatus,
    },
  ];

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
              <div>{selectedStudent?.user?.rollNumber || 'N/A'}</div>

              <div className="text-gray-500">Batch</div>
              <div>{selectedStudent.batchName || selectedStudent.batch?.name || 'N/A'}</div>

              <div className="text-gray-500">Branch</div>
              <div>{selectedStudent?.user?.branchName || selectedStudent.branchName || 'N/A'}</div>

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
              <div className="truncate">{selectedStudent?.user?.email || 'N/A'}</div>

              <div className="text-gray-500">Contact</div>
              <div>{selectedStudent?.user?.phoneNo || selectedStudent.phone || selectedStudent.mobileNumber || 'N/A'}</div>

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
                    <div className="flex items-start gap-2">
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
          <div className="flex gap-1.5 flex-wrap">
            <Tooltip title="View full application details">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => setDetailModalVisible(true)}
                className="bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                View Details
              </Button>
            </Tooltip>
            <Tooltip title="Log a new visit for this student">
              <Button
                size="small"
                type="primary"
                icon={<CalendarOutlined />}
                onClick={() => setVisitModalVisible(true)}
                className="bg-gradient-to-r from-green-500 to-green-700"
                disabled={!getActiveApplication()}
              >
                Log Visit
              </Button>
            </Tooltip>
            <Tooltip title="Upload joining letter document">
              <Upload
                showUploadList={false}
                beforeUpload={handleJoiningLetterUpload}
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={!getActiveApplication()}
              >
                <Button
                  size="small"
                  icon={<UploadOutlined />}
                  loading={uploadingJoiningLetter}
                  className="bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100"
                  disabled={!getActiveApplication()}
                >
                  {getActiveApplication()?.joiningLetterUrl ? 'Replace Letter' : 'Joining Letter'}
                </Button>
              </Upload>
            </Tooltip>
            <Tooltip title="Upload monthly report for this student">
              <Upload
                showUploadList={false}
                beforeUpload={handleReportUpload}
                accept=".pdf,.doc,.docx"
                disabled={!getActiveApplication()}
              >
                <Button
                  size="small"
                  icon={<FileTextOutlined />}
                  loading={uploadingReport}
                  className="bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100"
                  disabled={!getActiveApplication()}
                >
                  Report
                </Button>
              </Upload>
            </Tooltip>
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
              body: { padding: 0, overflowY: 'hidden' },
              header: { borderBottom: '2px solid #e6f7ff', backgroundColor: '#f0f7ff' },
            }}
          >
            <div
              style={{ overflowY: 'auto', padding: '0.5rem' }}
              className="hide-scrollbar max-h-[35vh] sm:max-h-[35vh] md:max-h-[calc(80vh-80px)]"
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
                            {student?.user?.name || student?.name}
                          </Text>
                        }
                        description={
                          <div>
                            {(student?.user?.branchName || student.branchName) && (
                              <Tag color="blue" className="text-xs">{student?.user?.branchName || student.branchName}</Tag>
                            )}
                            {getInternshipStatusTag(student)}
                            <div className="mt-1 text-xs text-gray-500">
                              <IdcardOutlined className="mr-1" />
                              {student?.user?.rollNumber || student?.rollNumber}
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
                    <div className="flex items-center justify-between">
                      <Title level={3} className="mb-0 text-blue-800">
                        {selectedStudent?.user?.name || selectedStudent?.name}
                      </Title>
                      {/* Three-dot action menu */}
                      <Dropdown
                        menu={{ items: getActionMenuItems() }}
                        trigger={['click']}
                        placement="bottomRight"
                      >
                        <Button
                          type="text"
                          icon={<MoreOutlined style={{ fontSize: '20px' }} />}
                          className="hover:bg-gray-100 rounded-full"
                          loading={togglingStatus}
                        />
                      </Dropdown>
                    </div>
                    <div className="flex justify-center md:justify-start items-center text-gray-500 mb-1">
                      <IdcardOutlined className="mr-2" />
                      {selectedStudent?.user?.rollNumber || selectedStudent?.rollNumber}
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                      {(selectedStudent?.user?.branchName || selectedStudent.branchName) && (
                        <Tag color="blue" className="px-3 py-1 rounded-full">
                          {selectedStudent?.user?.branchName || selectedStudent.branchName}
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
                      <div className="text-sm font-medium truncate">{selectedStudent?.user?.email || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <PhoneOutlined className="text-green-500 text-xl mr-3" />
                    <div>
                      <div className="text-xs text-gray-500">Contact</div>
                      <div className="text-sm font-medium">{selectedStudent?.user?.phoneNo || selectedStudent.phone || selectedStudent.mobileNumber || 'N/A'}</div>
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

      {/* Unified Visit Log Modal */}
      <UnifiedVisitLogModal
        visible={visitModalVisible}
        onClose={() => setVisitModalVisible(false)}
        onSuccess={handleVisitSuccess}
        selectedStudent={selectedStudent}
        students={[{ student: selectedStudent, ...selectedStudent?._original }]}
      />

      {/* Upload Document Modal */}
      <Modal
        title="Upload Document"
        open={uploadDocumentModal}
        onCancel={() => {
          setUploadDocumentModal(false);
          uploadForm.resetFields();
          setFileList([]);
        }}
        onOk={handleDocumentUpload}
        confirmLoading={uploading}
        okText="Upload"
      >
        <Form form={uploadForm} layout="vertical">
          <Form.Item
            name="documentType"
            label="Document Type"
            rules={[{ required: true, message: 'Please select document type' }]}
          >
            <Select placeholder="Select document type" options={documentTypeOptions} />
          </Form.Item>
          <Form.Item
            label="Select File"
            required
          >
            <Upload
              beforeUpload={(file) => {
                const isUnderLimit = file.size / 1024 <= 500;
                if (!isUnderLimit) {
                  message.error('File must be less than 500KB.');
                  return Upload.LIST_IGNORE;
                }
                setFileList([file]);
                return false;
              }}
              fileList={fileList}
              onRemove={() => setFileList([])}
              maxCount={1}
              listType="picture"
            >
              <Button icon={<UploadOutlined />}>Select File (Max 500KB)</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Student Modal */}
      <FacultyStudentModal
        open={isEditModalOpen}
        onClose={handleEditModalClose}
        studentId={editingStudentId}
        studentData={selectedStudent}
        onSuccess={handleEditModalSuccess}
      />
    </div>
  );
};

export default AssignedStudentsList;
