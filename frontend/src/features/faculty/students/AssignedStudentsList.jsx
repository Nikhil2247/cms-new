import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Table, Button, Tag, Space, Input, Select, Modal, Descriptions, Avatar, Divider, Progress, Row, Col, theme } from 'antd';
import { SearchOutlined, UserOutlined, EyeOutlined, PhoneOutlined, MailOutlined } from '@ant-design/icons';
import { fetchAssignedStudents } from '../store/facultySlice';
import ProfileAvatar from '../../../components/common/ProfileAvatar';

// Constant styles outside component
const SELECT_STYLE = { width: 200 };
const INPUT_STYLE = { width: 300 };
const PROGRESS_STYLE = { width: 100 };

const AssignedStudentsList = React.memo(() => {
  const { token } = theme.useToken();
  const dispatch = useDispatch();
  const { list: assignedStudentsList, loading } = useSelector((state) => state.faculty.students);
  const [searchText, setSearchText] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    dispatch(fetchAssignedStudents());
  }, [dispatch]);

  // Extract student details from assignments and map branch to department
  const students = useMemo(() => {
    return assignedStudentsList?.map(assignment => {
      const student = assignment.student;
      const activeInternship = student.internshipApplications?.find(app => app.internshipPhase === 'ACTIVE' && !app.completionDate);
      const appliedCount = student.internshipApplications?.length || 0;

      return {
        ...student,
        department: student.branch,
        assignmentId: assignment.id,
        currentInternship: activeInternship,
        appliedInternships: appliedCount,
        phone: student.contact
      };
    }) || [];
  }, [assignedStudentsList]);

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesSearch = !searchText ||
        student.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        student.rollNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchText.toLowerCase());

      const branchName = student.branchName || student.department?.name;
      const matchesDepartment = departmentFilter === 'all' || branchName === departmentFilter;
      const matchesBatch = batchFilter === 'all' || student.batch?.id === batchFilter;

      return matchesSearch && matchesDepartment && matchesBatch;
    });
  }, [students, searchText, departmentFilter, batchFilter]);

  const departments = useMemo(() => {
    return [...new Map(students.map(s => {
      const branchName = s.branchName || s.department?.name;
      return [branchName, { name: branchName }];
    })).values()].filter(d => d.name);
  }, [students]);

  const batches = useMemo(() => {
    return [...new Map(students.map(s => [s.batch?.id, s.batch])).values()].filter(Boolean);
  }, [students]);

  const getInternshipStatus = useCallback((student) => {
    if (student.currentInternship) {
      return <Tag color="green">Active Internship</Tag>;
    } else if (student.appliedInternships > 0) {
      return <Tag color="blue">Applied ({student.appliedInternships})</Tag>;
    } else {
      return <Tag>No Applications</Tag>;
    }
  }, []);

  const columns = useMemo(() => [
    {
      title: 'Student',
      key: 'student',
      render: (_, record) => (
        <Space>
          <ProfileAvatar profileImage={record.profileImage} />
          <div>
            <div className="font-medium">{record.name}</div>
            <div className="text-xs" style={{ color: token.colorTextSecondary }}>{record.rollNumber}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'Branch',
      key: 'branch',
      render: (_, record) => record.branchName || record.department?.name || 'N/A',
    },
    {
      title: 'Batch',
      key: 'batch',
      render: (_, record) => record.batch?.name || 'N/A',
    },
    {
      title: 'CGPA',
      dataIndex: 'cgpa',
      key: 'cgpa',
      render: (cgpa) => cgpa ? cgpa.toFixed(2) : 'N/A',
      sorter: (a, b) => (a.cgpa || 0) - (b.cgpa || 0),
    },
    {
      title: 'Internship Status',
      key: 'internshipStatus',
      render: (_, record) => getInternshipStatus(record),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedStudent(record);
            setDetailModalVisible(true);
          }}
          size="small"
        >
          View Details
        </Button>
      ),
    },
  ], [getInternshipStatus, setSelectedStudent, setDetailModalVisible, token.colorTextSecondary]);

  return (
    <div className="p-6">
      <Card title="Assigned Students" variant="borderless">
        <Space className="mb-4" size="middle" wrap>
          <Input
            placeholder="Search by name, roll number, or email..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={INPUT_STYLE}
            allowClear
          />
          <Select
            value={departmentFilter}
            onChange={setDepartmentFilter}
            style={SELECT_STYLE}
            placeholder="Filter by Branch"
          >
            <Select.Option value="all">All Branches</Select.Option>
            {departments.map(dept => (
              <Select.Option key={dept.name} value={dept.name}>{dept.name}</Select.Option>
            ))}
          </Select>
          <Select
            value={batchFilter}
            onChange={setBatchFilter}
            style={SELECT_STYLE}
            placeholder="Filter by Batch"
          >
            <Select.Option value="all">All Batches</Select.Option>
            {batches.map(batch => (
              <Select.Option key={batch.id} value={batch.id}>{batch.name}</Select.Option>
            ))}
          </Select>
        </Space>

        <Table
          columns={columns}
          dataSource={filteredStudents}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} students`,
          }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Student Details"
        width={1000}
        centered
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedStudent(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Close
          </Button>
        ]}
      >
        {selectedStudent && (
          <div className="py-4">
            <div className="flex items-center gap-6 mb-6">
              <ProfileAvatar size={100} profileImage={selectedStudent.profileImage} />
              <div>
                <h2 className="text-2xl font-bold">{selectedStudent.name}</h2>
                <p className="text-lg" style={{ color: token.colorTextSecondary }}>{selectedStudent.rollNumber}</p>
                <div className="mt-2 flex gap-4">
                  <span className="flex items-center gap-2" style={{ color: token.colorTextSecondary }}>
                    <MailOutlined /> <a href={`mailto:${selectedStudent.email}`}>{selectedStudent.email}</a>
                  </span>
                  <span className="flex items-center gap-2" style={{ color: token.colorTextSecondary }}>
                    <PhoneOutlined /> <a href={`tel:${selectedStudent.phone}`}>{selectedStudent.phone}</a>
                  </span>
                </div>
              </div>
            </div>

            <Row gutter={[24, 24]}>
              {/* Personal Information */}
              <Col xs={24} md={12}>
                <Card title="Personal Information" size="small" bordered={false} className="h-full" style={{ backgroundColor: token.colorFillQuaternary }}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Date of Birth">
                      {selectedStudent.dateOfBirth || 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Gender">
                      {selectedStudent.gender || 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Address">
                      {selectedStudent.address || 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label="City">
                      {selectedStudent.city || 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label="State">
                      {selectedStudent.state || 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Pincode">
                      {selectedStudent.pincode || 'N/A'}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>

              {/* Academic Information */}
              <Col xs={24} md={12}>
                <Card title="Academic Information" size="small" bordered={false} className="h-full" style={{ backgroundColor: token.colorFillQuaternary }}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Branch">
                      {selectedStudent.branchName || selectedStudent.department?.name || 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Batch">
                      {selectedStudent.batch?.name || 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Current Semester">
                      {selectedStudent.currentSemester || 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label="CGPA">
                      <div className="flex items-center gap-2 w-full">
                        <span>{selectedStudent.cgpa ? selectedStudent.cgpa.toFixed(2) : 'N/A'}</span>
                        {selectedStudent.cgpa && (
                          <Progress
                            percent={(selectedStudent.cgpa / 10) * 100}
                            size="small"
                            style={PROGRESS_STYLE}
                            showInfo={false}
                          />
                        )}
                      </div>
                    </Descriptions.Item>
                    <Descriptions.Item label="Backlogs">
                      {selectedStudent.backlogs || 0}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>

              {/* Guardian Information */}
              <Col xs={24} md={12}>
                <Card title="Guardian Information" size="small" bordered={false} className="h-full" style={{ backgroundColor: token.colorFillQuaternary }}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Guardian Name">
                      {selectedStudent.guardianName || 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Guardian Phone">
                      {selectedStudent.guardianPhone || 'N/A'}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>

              {/* Skills */}
              <Col xs={24} md={12}>
                <Card title="Skills" size="small" bordered={false} className="h-full" style={{ backgroundColor: token.colorFillQuaternary }}>
                  {selectedStudent.skills ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedStudent.skills.split(',').map((skill, idx) => (
                        <Tag key={idx} color="blue">{skill.trim()}</Tag>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: token.colorTextSecondary }}>No skills listed</span>
                  )}
                </Card>
              </Col>

              {/* Current Internship */}
              <Col xs={24}>
                {selectedStudent.currentInternship && (
                  <Card title="Current Internship" size="small" bordered={false} style={{ backgroundColor: token.colorInfoBg, borderColor: token.colorInfoBorder }}>
                    <Descriptions column={{ xs: 1, md: 3 }} size="small">
                      <Descriptions.Item label="Company">
                        {selectedStudent.currentInternship.company?.name}
                      </Descriptions.Item>
                      <Descriptions.Item label="Title">
                        {selectedStudent.currentInternship.title}
                      </Descriptions.Item>
                      <Descriptions.Item label="Start Date">
                        {selectedStudent.currentInternship.startDate}
                      </Descriptions.Item>
                      <Descriptions.Item label="Status">
                        <Tag color="green">Active</Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                )}
              </Col>

              {/* Documents */}
              <Col xs={24}>
                {selectedStudent.resumeUrl && (
                  <Card title="Documents" size="small" bordered={false} style={{ backgroundColor: token.colorFillQuaternary }}>
                    <Button type="primary" ghost href={selectedStudent.resumeUrl} target="_blank" rel="noopener noreferrer">
                      View Resume
                    </Button>
                  </Card>
                )}
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
});

AssignedStudentsList.displayName = 'AssignedStudentsList';

export default AssignedStudentsList;