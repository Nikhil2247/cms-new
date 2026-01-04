import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Card,
  List,
  Typography,
  Spin,
  Row,
  Col,
  Tag,
  Input,
  Modal,
  Upload,
  Form,
  Button,
  message,
  Select,
  Tabs,
  Empty,
  Popconfirm,
  Dropdown,
} from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchStudents,
  updateStudent,
  uploadStudentDocument,
  fetchStudentDocuments,
  fetchStudentById,
} from '../store/principalSlice';
import {
  selectStudentsList,
  selectStudentsLoading,
  selectStudentsPagination,
} from '../store/principalSelectors';
import ProfileAvatar from '../../../components/common/ProfileAvatar';
import {
  SearchOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  CalendarOutlined,
  EditOutlined,
  StopOutlined,
  TeamOutlined,
  IdcardOutlined,
  BookOutlined,
  FileTextOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  BulbOutlined,
  LaptopOutlined,
  SettingOutlined,
  LoadingOutlined,
  KeyOutlined,
  MoreOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { credentialsService } from '../../../services/credentials.service';
import principalService from '../../../services/principal.service';
import StudentModal from './StudentModal';
import dayjs from 'dayjs';
import { getPresignedUrl } from '../../../utils/imageUtils';

const { Title, Text } = Typography;
const { Option } = Select;

const AllStudents = () => {
  const dispatch = useDispatch();
  const students = useSelector(selectStudentsList);
  const loading = useSelector(selectStudentsLoading);
  const pagination = useSelector(selectStudentsPagination);

  // Local state
  const [search, setSearch] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState('active');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedStudentFull, setSelectedStudentFull] = useState(null);
  const [loadingStudentDetails, setLoadingStudentDetails] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadForm] = Form.useForm();
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [studentDocuments, setStudentDocuments] = useState([]);
  const [documentUrls, setDocumentUrls] = useState({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [allStudents, setAllStudents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [resettingCredential, setResettingCredential] = useState(false);
  const [deletingInternship, setDeletingInternship] = useState(null);
  const listRef = useRef(null);
  const PAGE_SIZE = 50;

  // Build filter params
  const buildFilterParams = useCallback((page = 1) => {
    const params = {
      page,
      limit: PAGE_SIZE,
    };
    if (search.trim()) params.search = search.trim();
    if (activeStatusFilter === 'active') params.isActive = true;
    if (activeStatusFilter === 'inactive') params.isActive = false;
    return params;
  }, [search, activeStatusFilter]);

  // Initial fetch and filter change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      setAllStudents([]);
      setHasMore(true);
      dispatch(fetchStudents(buildFilterParams(1)));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [dispatch, search, activeStatusFilter]);

  // Update allStudents when students list changes
  useEffect(() => {
    if (currentPage === 1) {
      setAllStudents(students);
    } else {
      setAllStudents(prev => {
        const existingIds = new Set(prev.map(s => s.id));
        const newStudents = students.filter(s => !existingIds.has(s.id));
        return [...prev, ...newStudents];
      });
    }
    if (pagination?.total) {
      setHasMore(allStudents.length + students.length < pagination.total);
    }
    setLoadingMore(false);
  }, [students, pagination?.total]);

  // Select first student when list changes
  useEffect(() => {
    if (allStudents.length > 0 && !selectedStudent) {
      handleStudentSelect(allStudents[0]);
    }
  }, [allStudents]);

  // Load full student details when selected student changes
  const loadFullStudentDetails = async (studentId) => {
    setLoadingStudentDetails(true);
    try {
      const result = await dispatch(fetchStudentById(studentId)).unwrap();
      setSelectedStudentFull(result);
    } catch (error) {
      console.error('Failed to load student details:', error);
      setSelectedStudentFull(null);
    } finally {
      setLoadingStudentDetails(false);
    }
  };

  // Load documents when student changes
  useEffect(() => {
    if (selectedStudent?.id) {
      loadStudentDocuments(selectedStudent.id);
    }
  }, [selectedStudent?.id]);

  // Handle scroll for infinite loading
  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom < 100 && hasMore && !loadingMore && !loading) {
      setLoadingMore(true);
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      dispatch(fetchStudents(buildFilterParams(nextPage)));
    }
  }, [loadingMore, hasMore, loading, currentPage, dispatch, buildFilterParams]);

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setSelectedStudentFull(null);
    loadFullStudentDetails(student.id);
  };

  const handleRefresh = () => {
    setCurrentPage(1);
    setAllStudents([]);
    dispatch(fetchStudents({ ...buildFilterParams(1), forceRefresh: true }));
    if (selectedStudent?.id) {
      loadFullStudentDetails(selectedStudent.id);
    }
  };

  const openEditModal = () => {
    setEditingStudentId(selectedStudent?.id);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingStudentId(null);
  };

  const handleModalSuccess = () => {
    handleRefresh();
  };

  // Handle active state toggle
  const handleActiveStateToggle = async () => {
    if (!selectedStudent) return;
    const newStatus = !selectedStudent?.user?.active;

    try {
      await dispatch(
        updateStudent({
          id: selectedStudent.id,
          data: { isActive: newStatus },
        })
      ).unwrap();
      message.success(`Student ${newStatus ? 'activated' : 'deactivated'} successfully`);
      setSelectedStudent(prev => ({ ...prev, user: { ...prev.user, active: newStatus } }));
      handleRefresh();
    } catch (error) {
      message.error(error || 'Failed to update student status');
    }
  };

  // Handle clearance status change
  const handleClearanceStatusChange = async (newStatus) => {
    if (!selectedStudent) return;

    try {
      await dispatch(
        updateStudent({
          id: selectedStudent.id,
          data: { clearanceStatus: newStatus },
        })
      ).unwrap();
      message.success(`Clearance status updated to ${newStatus}`);
      setSelectedStudent(prev => ({ ...prev, clearanceStatus: newStatus }));
      handleRefresh();
    } catch (error) {
      message.error(error || 'Failed to update clearance status');
    }
  };

  // Handle reset credential
  const handleResetCredential = async () => {
    const userId = selectedStudent?.userId || selectedStudent?.user?.id;
    if (!userId) {
      message.error('Student user ID not found');
      return;
    }

    setResettingCredential(true);
    try {
      const result = await credentialsService.resetUserPassword(userId);
      message.success(
        <span>
          Password reset successfully. New password: <strong>{result.temporaryPassword || result.newPassword || 'Check email'}</strong>
        </span>,
        10
      );
    } catch (error) {
      message.error(error?.response?.data?.message || error?.message || 'Failed to reset credential');
    } finally {
      setResettingCredential(false);
    }
  };

  // Handle delete internship
  const handleDeleteInternship = async (applicationId) => {
    setDeletingInternship(applicationId);
    try {
      await principalService.deleteInternship(applicationId);
      message.success('Internship application deleted successfully');
      // Reload student details to update the internship list
      if (selectedStudent?.id) {
        loadFullStudentDetails(selectedStudent.id);
      }
    } catch (error) {
      message.error(error?.response?.data?.message || error?.message || 'Failed to delete internship');
    } finally {
      setDeletingInternship(null);
    }
  };

  // Document upload
  const openUploadModal = () => {
    uploadForm.resetFields();
    setFileList([]);
    setUploadModal(true);
  };

  const handleUpload = async (values) => {
    if (!fileList.length) {
      message.error('Please select a file.');
      return;
    }

    setUploading(true);
    try {
      await dispatch(
        uploadStudentDocument({
          studentId: selectedStudent.id,
          file: fileList[0],
          type: values.type,
        })
      ).unwrap();
      message.success('Document uploaded successfully');
      setUploadModal(false);
      loadStudentDocuments(selectedStudent.id);
    } catch (error) {
      message.error(error || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const loadStudentDocuments = async (studentId) => {
    try {
      const result = await dispatch(fetchStudentDocuments(studentId)).unwrap();
      setStudentDocuments(result || []);
      // Load presigned URLs for documents
      loadDocumentUrls(result || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
      setStudentDocuments([]);
      setDocumentUrls({});
    }
  };

  // Load presigned URLs for documents
  const loadDocumentUrls = async (docs) => {
    const urls = {};
    for (const doc of docs) {
      if (doc.fileUrl) {
        try {
          const presignedUrl = await getPresignedUrl(doc.fileUrl);
          urls[doc.id] = presignedUrl;
        } catch (error) {
          console.error('Failed to get presigned URL for document:', error);
          urls[doc.id] = doc.fileUrl;
        }
      }
    }
    setDocumentUrls(urls);
  };

  // Helper functions
  const getCategoryColor = (category) => {
    const colors = {
      GENERAL: 'blue',
      SC: 'green',
      ST: 'purple',
      OBC: 'orange',
    };
    return colors[category] || 'default';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return dayjs(dateString).format('DD MMM YYYY');
  };

  // Get display student (use full details if available)
  const displayStudent = selectedStudentFull || selectedStudent;

  // Get internship applications from full student details
  const internshipApplications = selectedStudentFull?.internshipApplications || [];

  // Tab items
  const tabItems = [
    {
      key: '1',
      label: <span><UserOutlined /> Personal Info</span>,
      children: displayStudent && (
        <div className="grid md:grid-cols-2 gap-6 p-4">
          <Card title="Basic Information" className="shadow-sm border-0" size="small">
            <div className="grid grid-cols-2 gap-y-3">
              <div className="text-gray-500">Gender</div>
              <div>{displayStudent.gender || 'N/A'}</div>

              <div className="text-gray-500">Category</div>
              <div>
                {displayStudent.category ? (
                  <Tag color={getCategoryColor(displayStudent.category)}>
                    {displayStudent.category}
                  </Tag>
                ) : 'N/A'}
              </div>

              <div className="text-gray-500">Admission Type</div>
              <div>{displayStudent.admissionType || 'N/A'}</div>

              <div className="text-gray-500">Roll Number</div>
              <div>{displayStudent?.user?.rollNumber || 'N/A'}</div>

              <div className="text-gray-500">Batch</div>
              <div>{displayStudent.batchName || displayStudent.batch?.name || 'N/A'}</div>

              <div className="text-gray-500">Branch</div>
              <div>{displayStudent?.user?.branchName || displayStudent.branchName || displayStudent.branch?.name || 'N/A'}</div>

              <div className="text-gray-500">Year / Semester</div>
              <div>
                {displayStudent.currentYear && displayStudent.currentSemester
                  ? `Year ${displayStudent.currentYear} / Sem ${displayStudent.currentSemester}`
                  : 'N/A'}
              </div>
            </div>
          </Card>

          <Card title="Contact Information" className="shadow-sm border-0" size="small">
            <div className="grid grid-cols-2 gap-y-3">
              <div className="text-gray-500">Email</div>
              <div className="truncate">{displayStudent?.user?.email || 'N/A'}</div>

              <div className="text-gray-500">Contact</div>
              <div>{displayStudent?.user?.phoneNo || 'N/A'}</div>

              <div className="text-gray-500">Address</div>
              <div>{displayStudent.address || 'N/A'}</div>

              <div className="text-gray-500">City</div>
              <div>{displayStudent.city || 'N/A'}</div>

              <div className="text-gray-500">State</div>
              <div>{displayStudent.state || 'N/A'}</div>

              <div className="text-gray-500">Pin Code</div>
              <div>{displayStudent.pinCode || 'N/A'}</div>

              <div className="text-gray-500">Parent Name</div>
              <div>{displayStudent.parentName || 'N/A'}</div>

              <div className="text-gray-500">Parent Contact</div>
              <div>{displayStudent.parentContact || 'N/A'}</div>
            </div>
          </Card>
        </div>
      ),
    },
    {
      key: '2',
      label: <span><FileTextOutlined /> Documents</span>,
      children: (
        <div className="p-4">
          {studentDocuments?.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-4">
              {studentDocuments.map((doc) => (
                <Card
                  key={doc.id}
                  hoverable
                  className="shadow-sm hover:shadow-md transition-shadow border-0"
                  cover={
                    <div className="h-48 bg-gray-50 p-2 flex items-center justify-center">
                      {documentUrls[doc.id] ? (
                        <img
                          src={documentUrls[doc.id]}
                          alt={doc.fileName}
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : (
                        <Spin />
                      )}
                      <div className="hidden flex-col items-center justify-center text-gray-400">
                        <FileTextOutlined style={{ fontSize: '3rem' }} />
                        <span className="mt-2 text-sm">Preview unavailable</span>
                      </div>
                    </div>
                  }
                  onClick={() => {
                    if (documentUrls[doc.id]) {
                      window.open(documentUrls[doc.id], '_blank');
                    }
                  }}
                >
                  <div className="text-center">
                    <div className="font-medium mb-2">
                      {doc.type?.replaceAll('_', ' ')}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {doc.fileName}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
              <FileTextOutlined style={{ fontSize: '2rem' }} className="mb-3 text-gray-400" />
              <div>No documents uploaded</div>
              <Button type="link" onClick={openUploadModal} className="mt-2">
                Upload a document
              </Button>
            </div>
          )}
        </div>
      ),
    },
    {
      key: '3',
      label: <span><BulbOutlined /> Placements</span>,
      children: (
        <div className="p-4">
          {(displayStudent?.placements || []).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(displayStudent.placements || []).map((placement, index) => (
                <Card
                  key={placement.id || index}
                  className={`shadow-sm border-l-4 ${
                    placement.status === 'ACCEPTED' || placement.status === 'JOINED'
                      ? 'border-l-green-500 bg-green-50'
                      : placement.status === 'OFFERED'
                      ? 'border-l-blue-500 bg-blue-50'
                      : 'border-l-red-500 bg-red-50'
                  }`}
                  size="small"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-lg text-gray-800">
                      {placement.companyName}
                    </div>
                    <Tag color={placement.status === 'ACCEPTED' ? 'success' : 'default'}>
                      {placement.status}
                    </Tag>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>Job Role: <span className="font-medium">{placement.jobRole || 'N/A'}</span></div>
                    <div>Salary: <span className="font-medium">{placement.salary ? `₹ ${placement.salary} LPA` : 'N/A'}</span></div>
                    <div>Offer Date: <span className="font-medium">{formatDate(placement.offerDate)}</span></div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
              <BulbOutlined style={{ fontSize: '2rem' }} className="mb-3 text-gray-400" />
              <div>No placement records available</div>
            </div>
          )}
        </div>
      ),
    },
    {
      key: '4',
      label: (
        <span>
          <LaptopOutlined /> Internships
          {loadingStudentDetails && <LoadingOutlined className="ml-2" />}
          {internshipApplications.length > 0 && (
            <Tag color="blue" className="ml-2">{internshipApplications.length}</Tag>
          )}
        </span>
      ),
      children: (
        <div className="p-4">
          {loadingStudentDetails ? (
            <div className="flex justify-center items-center py-12">
              <Spin tip="Loading internship details..." />
            </div>
          ) : internshipApplications.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {internshipApplications.map((app, index) => (
                <Card
                  key={app.id || index}
                  className={`shadow-sm border-l-4 ${
                    app.status === 'JOINED' || app.internshipPhase === 'COMPLETED'
                      ? 'border-l-green-500 bg-green-50'
                      : app.internshipPhase === 'ACTIVE'
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
                        <Tag color="purple">Self Identified</Tag>
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
                      <span className="font-medium">Location:</span> {app.companyAddress}
                    </div>
                  )}

                  {app.facultyMentorName && (
                    <div className="mt-2 pt-2 border-t border-gray-200 text-xs">
                      <span className="text-gray-500">Faculty Mentor:</span>
                      <span className="ml-1 font-medium">{app.facultyMentorName}</span>
                    </div>
                  )}

                  {/* Delete Action */}
                  <div className="mt-3 pt-2 border-t border-gray-200 flex justify-end">
                    <Popconfirm
                      title="Delete Internship Application"
                      description="Are you sure you want to delete this internship application? This action cannot be undone."
                      onConfirm={() => handleDeleteInternship(app.id)}
                      okText="Delete"
                      okButtonProps={{ danger: true, loading: deletingInternship === app.id }}
                      cancelText="Cancel"
                    >
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        loading={deletingInternship === app.id}
                      >
                        Delete
                      </Button>
                    </Popconfirm>
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
  ];

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <Title level={3} className="text-blue-800 !mb-0">
            Student Management
          </Title>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        {/* Students List - Left Column */}
        <Col xs={24} sm={24} md={8} lg={6} xl={6}>
          <Card
            title={
              <div className="flex items-center text-blue-800">
                <TeamOutlined className="mr-2" /> Students Directory
                <Text type="secondary" className="ml-auto text-xs">
                  {allStudents.length} of {pagination?.total || 0} students
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
              onScroll={handleScroll}
              style={{ maxHeight: 'calc(80vh - 80px)', overflowY: 'auto', padding: '0.5rem' }}
              className="hide-scrollbar"
            >
              <Input
                placeholder="Search Student..."
                className="mb-3 rounded-lg"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                prefix={<UserOutlined className="text-gray-400" />}
                allowClear
              />

              <Select
                placeholder="Filter by Status"
                className="mb-3 w-full"
                value={activeStatusFilter}
                onChange={setActiveStatusFilter}
                suffixIcon={<SettingOutlined />}
              >
                <Option value="all">
                  <div className="flex items-center">
                    <TeamOutlined className="mr-2 text-blue-500" />
                    All Students
                  </div>
                </Option>
                <Option value="active">
                  <div className="flex items-center">
                    <CheckCircleOutlined className="mr-2 text-green-500" />
                    Active Only
                  </div>
                </Option>
                <Option value="inactive">
                  <div className="flex items-center">
                    <StopOutlined className="mr-2 text-red-500" />
                    Inactive Only
                  </div>
                </Option>
              </Select>

              {loading && allStudents.length === 0 ? (
                <div className="flex justify-center items-center h-40">
                  <Spin size="small" tip="Loading students..." />
                </div>
              ) : (
                <>
                  <List
                    itemLayout="horizontal"
                    dataSource={allStudents}
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
                              {student?.user?.name}
                            </Text>
                          }
                          description={
                            <div>
                              {student.category && (
                                <Tag color={getCategoryColor(student.category)} className="text-xs">
                                  {student.category}
                                </Tag>
                              )}
                              {(student?.user?.branchName || student.branchName) && (
                                <Tag color="blue" className="text-xs">{student?.user?.branchName || student.branchName}</Tag>
                              )}
                              <Tag color={student?.user?.active ? 'success' : 'error'} className="text-xs">
                                {student?.user?.active ? 'Active' : 'Inactive'}
                              </Tag>
                              <div className="mt-1 text-xs text-gray-500">
                                <IdcardOutlined className="mr-1" />
                                {student?.user?.rollNumber}
                                {student.currentYear && student.currentSemester && (
                                  <span className="ml-2">
                                    | Year {student.currentYear}, Sem {student.currentSemester}
                                  </span>
                                )}
                              </div>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />

                  {loadingMore && (
                    <div className="flex justify-center items-center py-4">
                      <Spin size="small" />
                      <span className="ml-2 text-gray-500 text-sm">Loading more students...</span>
                    </div>
                  )}

                  {!hasMore && allStudents.length > 0 && (
                    <div className="text-center py-4 text-gray-400 text-xs border-t border-gray-100">
                      All {pagination?.total || allStudents.length} students loaded
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </Col>

        {/* Student Details - Right Column */}
        <Col xs={24} sm={24} md={16} lg={18} xl={18} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          {displayStudent ? (
            <div className="space-y-4">
              {/* Profile Header */}
              <Card className="border-0 rounded-lg shadow-sm relative">
                {/* Action Menu - Top Right */}
                <div className="absolute top-4 right-4 z-10">
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'edit',
                          icon: <EditOutlined />,
                          label: 'Edit Profile',
                          onClick: openEditModal,
                        },
                        {
                          key: 'upload',
                          icon: <UploadOutlined />,
                          label: 'Add Document',
                          onClick: openUploadModal,
                        },
                        {
                          key: 'reset',
                          icon: <KeyOutlined />,
                          label: resettingCredential ? 'Resetting...' : 'Reset Credential',
                          disabled: resettingCredential,
                          onClick: () => {
                            Modal.confirm({
                              title: 'Reset Student Credential',
                              content: `Are you sure you want to reset the password for ${selectedStudent?.name}?`,
                              okText: 'Reset',
                              okButtonProps: { danger: true },
                              onOk: handleResetCredential,
                            });
                          },
                        },
                        { type: 'divider' },
                        {
                          key: 'clearance',
                          icon: <ExclamationCircleOutlined />,
                          label: 'Clearance Status',
                          children: [
                            {
                              key: 'PENDING',
                              icon: <ExclamationCircleOutlined className="text-orange-500" />,
                              label: 'Pending',
                              onClick: () => handleClearanceStatusChange('PENDING'),
                            },
                            {
                              key: 'CLEARED',
                              icon: <CheckCircleOutlined className="text-green-500" />,
                              label: 'Cleared',
                              onClick: () => handleClearanceStatusChange('CLEARED'),
                            },
                            {
                              key: 'HOLD',
                              icon: <StopOutlined className="text-red-500" />,
                              label: 'Hold',
                              onClick: () => handleClearanceStatusChange('HOLD'),
                            },
                            {
                              key: 'REJECTED',
                              icon: <ExclamationCircleOutlined className="text-red-600" />,
                              label: 'Rejected',
                              onClick: () => handleClearanceStatusChange('REJECTED'),
                            },
                          ],
                        },
                        { type: 'divider' },
                        {
                          key: 'toggle',
                          icon: selectedStudent?.user?.active ? <StopOutlined /> : <PlayCircleOutlined />,
                          label: selectedStudent?.user?.active ? 'Deactivate Student' : 'Activate Student',
                          danger: selectedStudent?.user?.active,
                          onClick: () => {
                            Modal.confirm({
                              title: `${selectedStudent?.user?.active ? 'Deactivate' : 'Activate'} Student`,
                              content: `Are you sure you want to ${selectedStudent?.user?.active ? 'deactivate' : 'activate'} ${selectedStudent?.user?.name}? ${selectedStudent?.user?.active ? 'This will also deactivate their user account.' : ''}`,
                              okText: selectedStudent?.user?.active ? 'Deactivate' : 'Activate',
                              okButtonProps: { danger: selectedStudent?.user?.active },
                              onOk: handleActiveStateToggle,
                            });
                          },
                        },
                      ],
                    }}
                    trigger={['click']}
                    placement="bottomRight"
                  >
                    <Button
                      type="text"
                      icon={<MoreOutlined style={{ fontSize: '20px' }} />}
                      className="hover:bg-gray-100 rounded-full"
                    />
                  </Dropdown>
                </div>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <ProfileAvatar
                    profileImage={displayStudent.profileImage}
                    size={90}
                    className="border-4 border-white shadow-lg"
                  />
                  <div className="flex-grow text-center md:text-left">
                    <Title level={3} className="mb-0 text-blue-800">
                      {displayStudent?.user?.name}
                    </Title>
                    <div className="flex justify-center md:justify-start items-center text-gray-500 mb-1">
                      <IdcardOutlined className="mr-2" />
                      {displayStudent?.user?.rollNumber}
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                      {(displayStudent?.user?.branchName || displayStudent.branchName || displayStudent.branch?.name) && (
                        <Tag color="blue" className="px-3 py-1 rounded-full">
                          {displayStudent?.user?.branchName || displayStudent.branchName || displayStudent.branch?.name}
                        </Tag>
                      )}
                      {displayStudent.category && (
                        <Tag color={getCategoryColor(displayStudent.category)} className="px-3 py-1 rounded-full">
                          {displayStudent.category}
                        </Tag>
                      )}
                      {displayStudent.admissionType && (
                        <Tag color="purple" className="px-3 py-1 rounded-full">
                          {displayStudent.admissionType}
                        </Tag>
                      )}
                      {(displayStudent.batchName || displayStudent.batch?.name) && (
                        <Tag color="cyan" className="px-3 py-1 rounded-full">
                          {displayStudent.batchName || displayStudent.batch?.name}
                        </Tag>
                      )}
                      {displayStudent.currentYear && (
                        <Tag color="orange" className="px-3 py-1 rounded-full">
                          <CalendarOutlined className="mr-1" />
                          Year {displayStudent.currentYear}
                        </Tag>
                      )}
                      {displayStudent.currentSemester && (
                        <Tag color="geekblue" className="px-3 py-1 rounded-full">
                          <BookOutlined className="mr-1" />
                          Semester {displayStudent.currentSemester}
                        </Tag>
                      )}
                      <Tag
                        color={displayStudent?.user?.active ? 'success' : 'error'}
                        className="px-3 py-1 rounded-full"
                      >
                        {displayStudent?.user?.active ? (
                          <><CheckCircleOutlined className="mr-1" /> Active</>
                        ) : (
                          <><StopOutlined className="mr-1" /> Inactive</>
                        )}
                      </Tag>
                      {displayStudent.clearanceStatus && (
                        <Tag
                          color={
                            displayStudent.clearanceStatus === 'CLEARED' ? 'success'
                            : displayStudent.clearanceStatus === 'PENDING' ? 'processing'
                            : displayStudent.clearanceStatus === 'HOLD' ? 'warning'
                            : 'error'
                          }
                          className="px-3 py-1 rounded-full"
                        >
                          <ExclamationCircleOutlined className="mr-1" />
                          {displayStudent.clearanceStatus}
                        </Tag>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Quick Info */}
                <div className="grid lg:grid-cols-3 gap-4 mt-6 p-3 rounded-lg shadow-sm bg-gray-50">
                  <div className="flex items-center">
                    <MailOutlined className="text-blue-500 text-xl mr-3" />
                    <div>
                      <div className="text-xs text-gray-500">Email</div>
                      <div className="text-sm font-medium">{displayStudent?.user?.email || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <PhoneOutlined className="text-green-500 text-xl mr-3" />
                    <div>
                      <div className="text-xs text-gray-500">Contact</div>
                      <div className="text-sm font-medium">{displayStudent?.user?.phoneNo || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <CalendarOutlined className="text-orange-500 text-xl mr-3" />
                    <div>
                      <div className="text-xs text-gray-500">Date of Birth</div>
                      <div className="text-sm font-medium">{displayStudent?.user?.dob ? formatDate(displayStudent?.user?.dob) : 'N/A'}</div>
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
                  Choose a student from the directory on the left to view detailed information and track progress.
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

      {/* Edit Student Modal */}
      <StudentModal
        open={isModalOpen}
        onClose={handleModalClose}
        studentId={editingStudentId}
        onSuccess={handleModalSuccess}
      />

      {/* Upload Document Modal */}
      <Modal
        title="Upload Document"
        open={uploadModal}
        onCancel={() => setUploadModal(false)}
        onOk={() => uploadForm.submit()}
        confirmLoading={uploading}
      >
        <Form form={uploadForm} layout="vertical" onFinish={handleUpload}>
          <Form.Item name="type" label="Document Type" rules={[{ required: true, message: 'Please select document type' }]}>
            <Select placeholder="Select type">
              <Option value="MARKSHEET_10TH">10th Marksheet</Option>
              <Option value="MARKSHEET_12TH">12th Marksheet</Option>
              <Option value="CASTE_CERTIFICATE">Caste Certificate</Option>
              <Option value="PHOTO">Photo</Option>
              <Option value="OTHER">Other</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Upload File" required>
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
              <Button icon={<UploadOutlined />} className="w-full">
                Select File (Max 500KB)
              </Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AllStudents;
