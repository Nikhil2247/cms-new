import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Table, Button, Tag, Space, Input, Select, Drawer, Descriptions, Avatar, Divider, Progress } from 'antd';
import { SearchOutlined, UserOutlined, EyeOutlined, PhoneOutlined, MailOutlined } from '@ant-design/icons';
import { fetchAssignedStudents } from '../../../store/slices/facultySlice';

const AssignedStudentsList = () => {
  const dispatch = useDispatch();
  const { list: assignedStudentsList, loading } = useSelector((state) => state.faculty.students);
  const [searchText, setSearchText] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    dispatch(fetchAssignedStudents());
  }, [dispatch]);

  // Extract student details from assignments and map branch to department
  const students = assignedStudentsList?.map(assignment => {
    const student = assignment.student;
    const activeInternship = student.internshipApplications?.find(app => app.hasJoined && !app.completionDate);
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

  const filteredStudents = students.filter(student => {
    const matchesSearch = !searchText ||
      student.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      student.rollNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchText.toLowerCase());

    const matchesDepartment = departmentFilter === 'all' || student.department?.id === departmentFilter;
    const matchesBatch = batchFilter === 'all' || student.batch?.id === batchFilter;

    return matchesSearch && matchesDepartment && matchesBatch;
  });

  const departments = [...new Map(students.map(s => [s.department?.id, s.department])).values()].filter(Boolean);
  const batches = [...new Map(students.map(s => [s.batch?.id, s.batch])).values()].filter(Boolean);

  const getInternshipStatus = (student) => {
    if (student.currentInternship) {
      return <Tag color="green">Active Internship</Tag>;
    } else if (student.appliedInternships > 0) {
      return <Tag color="blue">Applied ({student.appliedInternships})</Tag>;
    } else {
      return <Tag>No Applications</Tag>;
    }
  };

  const columns = [
    {
      title: 'Student',
      key: 'student',
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} src={record.profileImage} />
          <div>
            <div className="font-medium">{record.name}</div>
            <div className="text-gray-500 text-xs">{record.rollNumber}</div>
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
      title: 'Department',
      dataIndex: ['department', 'name'],
      key: 'department',
    },
    {
      title: 'Batch',
      dataIndex: ['batch', 'name'],
      key: 'batch',
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
            setDetailDrawer(true);
          }}
          size="small"
        >
          View Details
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card title="Assigned Students" variant="borderless">
        <Space className="mb-4" size="middle" wrap>
          <Input
            placeholder="Search by name, roll number, or email..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Select
            value={departmentFilter}
            onChange={setDepartmentFilter}
            style={{ width: 200 }}
            placeholder="Filter by Department"
          >
            <Select.Option value="all">All Departments</Select.Option>
            {departments.map(dept => (
              <Select.Option key={dept.id} value={dept.id}>{dept.name}</Select.Option>
            ))}
          </Select>
          <Select
            value={batchFilter}
            onChange={setBatchFilter}
            style={{ width: 200 }}
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

      {/* Detail Drawer */}
      <Drawer
        title="Student Details"
        placement="right"
        width={600}
        onClose={() => {
          setDetailDrawer(false);
          setSelectedStudent(null);
        }}
        open={detailDrawer}
      >
        {selectedStudent && (
          <div>
            <div className="text-center mb-6">
              <Avatar size={100} icon={<UserOutlined />} src={selectedStudent.profileImage} />
              <h2 className="text-xl font-semibold mt-3">{selectedStudent.name}</h2>
              <p className="text-gray-500">{selectedStudent.rollNumber}</p>
            </div>

            <Divider orientation="left">Personal Information</Divider>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Email">
                <a href={`mailto:${selectedStudent.email}`}>
                  <MailOutlined /> {selectedStudent.email}
                </a>
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                <a href={`tel:${selectedStudent.phone}`}>
                  <PhoneOutlined /> {selectedStudent.phone}
                </a>
              </Descriptions.Item>
              <Descriptions.Item label="Date of Birth">
                {selectedStudent.dateOfBirth || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Gender">
                {selectedStudent.gender || 'N/A'}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Academic Information</Divider>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Department">
                {selectedStudent.department?.name}
              </Descriptions.Item>
              <Descriptions.Item label="Batch">
                {selectedStudent.batch?.name}
              </Descriptions.Item>
              <Descriptions.Item label="Current Semester">
                {selectedStudent.currentSemester || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="CGPA">
                <div className="flex items-center gap-2">
                  <span>{selectedStudent.cgpa ? selectedStudent.cgpa.toFixed(2) : 'N/A'}</span>
                  {selectedStudent.cgpa && (
                    <Progress
                      percent={(selectedStudent.cgpa / 10) * 100}
                      size="small"
                      style={{ width: 100 }}
                      showInfo={false}
                    />
                  )}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Backlogs">
                {selectedStudent.backlogs || 0}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Contact Information</Divider>
            <Descriptions column={1} bordered size="small">
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

            <Divider orientation="left">Guardian Information</Divider>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Guardian Name">
                {selectedStudent.guardianName || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Guardian Phone">
                {selectedStudent.guardianPhone || 'N/A'}
              </Descriptions.Item>
            </Descriptions>

            {selectedStudent.currentInternship && (
              <>
                <Divider orientation="left">Current Internship</Divider>
                <Descriptions column={1} bordered size="small">
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
              </>
            )}

            {selectedStudent.skills && (
              <>
                <Divider orientation="left">Skills</Divider>
                <div className="flex flex-wrap gap-2">
                  {selectedStudent.skills.split(',').map((skill, idx) => (
                    <Tag key={idx} color="blue">{skill.trim()}</Tag>
                  ))}
                </div>
              </>
            )}

            {selectedStudent.resumeUrl && (
              <>
                <Divider orientation="left">Documents</Divider>
                <Button type="link" href={selectedStudent.resumeUrl} target="_blank" rel="noopener noreferrer">
                  View Resume
                </Button>
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AssignedStudentsList;