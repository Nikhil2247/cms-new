import React, { useState } from 'react';
import { Card, Row, Col, Modal, Table, Spin, Typography, Progress, Tag } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  TeamOutlined,
  EyeOutlined,
  CalendarOutlined,
  BankOutlined,
  SolutionOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import stateService from '../../../../services/state.service';

const { Text } = Typography;

// College-wise breakdown modal
const CollegeBreakdownModal = ({ visible, onClose, title, loading, data, columns }) => (
  <Modal
    title={<span className="font-semibold text-base">{title}</span>}
    open={visible}
    onCancel={onClose}
    footer={null}
    width={700}
    className="[&_.ant-modal-content]:rounded-2xl"
  >
    {loading ? (
      <div className="flex justify-center py-12"><Spin /></div>
    ) : (
      <Table
        dataSource={data}
        columns={columns}
        rowKey={(record) => record.id || record.institutionId || record.name}
        size="small"
        pagination={{ pageSize: 10, showSizeChanger: false, size: 'small' }}
        className="mt-4 [&_.ant-table-thead_th]:bg-gray-50 [&_.ant-table-thead_th]:text-[10px] [&_.ant-table-thead_th]:font-bold [&_.ant-table-thead_th]:uppercase [&_.ant-table-thead_th]:text-text-tertiary"
      />
    )}
  </Modal>
);

// Simple stat row with optional percentage
const StatRow = ({ label, value, percentage, color, isChild = false, warning = false }) => (
  <div className={`flex items-center justify-between py-2 ${isChild ? 'pl-4 border-l-2 border-gray-200 ml-2' : ''}`}>
    <div className="flex items-center gap-2">
      {isChild && <span className="text-gray-400 text-xs">↳</span>}
      <Text className={`text-sm ${isChild ? 'text-gray-600' : 'font-semibold text-gray-800'}`}>
        {label}
      </Text>
      {warning && <WarningOutlined className="text-amber-500 text-xs" />}
    </div>
    <div className="flex items-center gap-2">
      <Text className={`font-bold ${color || 'text-gray-800'}`}>
        {value?.toLocaleString()}
      </Text>
      {percentage !== undefined && (
        <Tag className={`m-0 text-[10px] px-1.5 py-0 rounded border ${
          percentage >= 80 ? 'bg-green-50 text-green-600 border-green-200' :
          percentage >= 50 ? 'bg-amber-50 text-amber-600 border-amber-200' :
          'bg-red-50 text-red-600 border-red-200'
        }`}>
          {percentage}%
        </Tag>
      )}
    </div>
  </div>
);

// Section header
const SectionHeader = ({ children }) => (
  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-4 mb-2 pt-3 border-t border-gray-100">
    {children}
  </div>
);

const StatisticsCards = ({ stats, selectedMonth }) => {
  const [modalType, setModalType] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [collegeData, setCollegeData] = useState([]);

  const filterMonth = selectedMonth ? selectedMonth.month() + 1 : null;
  const filterYear = selectedMonth ? selectedMonth.year() : null;

  // Extract stats
  const institutions = stats?.institutions || {};
  const students = stats?.students || {};
  const faculty = stats?.faculty || {};
  const internships = stats?.internships || {};
  const applications = stats?.applications || {};
  const industries = stats?.industries || {};
  const assignments = stats?.assignments || {};
  const facultyVisits = stats?.facultyVisits || {};
  const monthlyReports = stats?.monthlyReports || {};

  // Students
  const totalStudents = students?.total ?? 0;
  const activeStudents = students?.active ?? assignments?.activeStudents ?? 0;
  const inactiveStudents = totalStudents - activeStudents;

  // Active students breakdown - use new field names with fallback to old names
  const activeStudentsWithMentors = assignments?.activeStudentsWithMentors ?? assignments?.assigned ?? 0;
  const activeStudentsWithoutMentors = assignments?.activeStudentsWithoutMentors ?? (activeStudents - activeStudentsWithMentors);
  const activeStudentsWithInternships = assignments?.activeStudentsWithInternships ?? assignments?.studentsWithInternships ?? internships?.active ?? 0;
  const activeStudentsWithoutInternships = assignments?.activeStudentsWithoutInternships ?? (activeStudents - activeStudentsWithInternships);

  // Internships with/without mentors
  const internshipsWithMentors = assignments?.internshipsWithMentors ?? 0;
  const internshipsWithoutMentors = assignments?.internshipsWithoutMentors ?? (activeStudentsWithInternships - internshipsWithMentors);

  // Faculty
  const totalMentors = faculty?.total ?? stats?.totalFaculty ?? 0;
  const activeMentors = faculty?.active ?? stats?.activeFaculty ?? totalMentors;

  // Compliance
  const reportsSubmitted = monthlyReports?.thisMonth ?? 0;
  const reportsExpected = monthlyReports?.expectedThisMonth ?? 0;
  const totalReportsAllTime = monthlyReports?.total ?? 0;
  const visitsCompleted = facultyVisits?.thisMonth ?? 0;
  const visitsExpected = facultyVisits?.expectedThisMonth ?? 0;
  const totalVisitsAllTime = facultyVisits?.total ?? 0;

  const displayMonth = selectedMonth
    ? selectedMonth.format('MMM YYYY')
    : new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  // Fetch college-wise breakdown
  const fetchCollegeBreakdown = async (type) => {
    setModalType(type);
    setModalLoading(true);
    try {
      const response = await stateService.getCollegeWiseBreakdown(type, { month: filterMonth, year: filterYear });
      setCollegeData(response?.data || response || []);
    } catch (error) {
      console.error('Error fetching college breakdown:', error);
      setCollegeData([]);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setModalType(null);
    setCollegeData([]);
  };

  const getColumns = (type) => {
    const baseColumns = [{
      title: 'Institution',
      dataIndex: 'institutionName',
      key: 'institutionName',
      render: (text, record) => <Text className="text-sm font-medium">{text || record.name || 'Unknown'}</Text>,
    }];
    switch (type) {
      case 'students':
        return [...baseColumns,
          { title: 'Total', dataIndex: 'totalStudents', align: 'center', render: (val) => <Text className="font-semibold">{val?.toLocaleString() || 0}</Text> },
          { title: 'Active', dataIndex: 'activeStudents', align: 'center', render: (val) => <Text className="font-semibold text-green-600">{val?.toLocaleString() || 0}</Text> },
        ];
      case 'mentors':
        return [...baseColumns,
          { title: 'Mentors', dataIndex: 'totalMentors', align: 'center', render: (val) => <Text className="font-semibold">{val?.toLocaleString() || 0}</Text> },
          { title: 'Students Assigned', dataIndex: 'assignedStudents', align: 'center', render: (val) => <Text className="font-semibold text-blue-600">{val?.toLocaleString() || 0}</Text> },
        ];
      default:
        return baseColumns;
    }
  };

  // Calculate percentages
  const pctActive = totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0;
  const pctWithMentors = activeStudents > 0 ? Math.round((activeStudentsWithMentors / activeStudents) * 100) : 0;
  const pctWithInternships = activeStudents > 0 ? Math.round((activeStudentsWithInternships / activeStudents) * 100) : 0;
  const pctInternshipsWithMentors = activeStudentsWithInternships > 0 ? Math.round((internshipsWithMentors / activeStudentsWithInternships) * 100) : 0;

  return (
    <>
      <Row gutter={[16, 16]}>
        {/* Card 1: Students */}
        <Col xs={24} md={12} xl={6}>
          <Card
            className="rounded-2xl border border-gray-200 shadow-sm bg-white h-full"
            styles={{ body: { padding: '20px' } }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <UserOutlined className="text-lg text-blue-500" />
              </div>
              <Text className="font-bold text-gray-800 text-base">Students</Text>
              <button
                onClick={() => fetchCollegeBreakdown('students')}
                className="ml-auto w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
              >
                <EyeOutlined className="text-gray-400 text-sm" />
              </button>
            </div>

            <StatRow label="Total Students" value={totalStudents} />
            <StatRow label="Active" value={activeStudents} percentage={pctActive} color="text-green-600" isChild />
            <StatRow label="Inactive" value={inactiveStudents} color="text-gray-400" isChild />
          </Card>
        </Col>

        {/* Card 2: Active Students Breakdown */}
        <Col xs={24} md={12} xl={6}>
          <Card
            className="rounded-2xl border border-gray-200 shadow-sm bg-white h-full"
            styles={{ body: { padding: '20px' } }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
                <SolutionOutlined className="text-lg text-pink-500" />
              </div>
              <Text className="font-bold text-gray-800 text-base">Active Students</Text>
            </div>

            <StatRow label="Total Active" value={activeStudents} />

            <SectionHeader>Internship Status</SectionHeader>
            <StatRow label="With Internship" value={activeStudentsWithInternships} percentage={pctWithInternships} color="text-pink-500" />
            <StatRow
              label="Without Internship"
              value={activeStudentsWithoutInternships}
              color="text-amber-500"
              warning={activeStudentsWithoutInternships > 100}
            />

            <SectionHeader>Mentor Status</SectionHeader>
            <StatRow label="With Mentor" value={activeStudentsWithMentors} percentage={pctWithMentors} color="text-cyan-500" />
            <StatRow
              label="Without Mentor"
              value={activeStudentsWithoutMentors}
              color="text-red-500"
              warning={activeStudentsWithoutMentors > 50}
            />
          </Card>
        </Col>

        {/* Card 3: Internships & Mentors */}
        <Col xs={24} md={12} xl={6}>
          <Card
            className="rounded-2xl border border-gray-200 shadow-sm bg-white h-full"
            styles={{ body: { padding: '20px' } }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center">
                <TeamOutlined className="text-lg text-cyan-500" />
              </div>
              <Text className="font-bold text-gray-800 text-base">Internships</Text>
              <button
                onClick={() => fetchCollegeBreakdown('mentors')}
                className="ml-auto w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100"
              >
                <EyeOutlined className="text-gray-400 text-sm" />
              </button>
            </div>

            <StatRow label="Active Internships" value={activeStudentsWithInternships} />

            <SectionHeader>Mentor Assignment</SectionHeader>
            <StatRow label="With Mentor" value={internshipsWithMentors} percentage={pctInternshipsWithMentors} color="text-green-600" />
            <StatRow
              label="Without Mentor"
              value={internshipsWithoutMentors}
              color="text-red-500"
              warning={internshipsWithoutMentors > 0}
            />

            <SectionHeader>Faculty</SectionHeader>
            <StatRow label="Total Mentors" value={totalMentors} />
            <StatRow label="Active" value={activeMentors} color="text-green-600" isChild />
          </Card>
        </Col>

        {/* Card 4: Compliance */}
        <Col xs={24} md={12} xl={6}>
          <Card
            className="rounded-2xl border border-gray-200 shadow-sm bg-white h-full"
            styles={{ body: { padding: '20px' } }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <FileTextOutlined className="text-lg text-emerald-500" />
              </div>
              <Text className="font-bold text-gray-800 text-base">Compliance</Text>
            </div>

            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">
              Reports ({displayMonth})
            </Text>
            <StatRow label="Submitted" value={reportsSubmitted} color={reportsSubmitted > 0 ? 'text-green-600' : 'text-red-500'} />
            <StatRow label="Expected" value={reportsExpected} color="text-gray-500" />
            <StatRow label="All Time" value={totalReportsAllTime} color="text-gray-400" isChild />

            <SectionHeader>Visits ({displayMonth})</SectionHeader>
            <StatRow label="Completed" value={visitsCompleted} color={visitsCompleted > 0 ? 'text-green-600' : 'text-red-500'} />
            <StatRow label="Expected" value={visitsExpected} color="text-gray-500" />
            <StatRow label="All Time" value={totalVisitsAllTime} color="text-gray-400" isChild />
          </Card>
        </Col>
      </Row>

      {/* Summary Row */}
      <Row className="mt-4">
        <Col span={24}>
          <Card className="rounded-2xl border border-gray-200 shadow-sm bg-white" styles={{ body: { padding: '16px 24px' } }}>
            <div className="flex flex-wrap items-center gap-8">
              <div className="flex items-center gap-3">
                <BankOutlined className="text-xl text-indigo-500" />
                <div>
                  <Text className="text-[10px] font-bold text-gray-400 uppercase block">Institutions</Text>
                  <Text className="text-xl font-black">{institutions?.total ?? 0}</Text>
                </div>
              </div>

              <div className="h-8 w-px bg-gray-200" />

              <div className="flex items-center gap-3">
                <CheckCircleOutlined className="text-xl text-green-500" />
                <div>
                  <Text className="text-[10px] font-bold text-gray-400 uppercase block">Applications</Text>
                  <Text className="text-xl font-black">{applications?.total ?? 0}</Text>
                  <Text className="text-xs text-green-600 ml-1">({applications?.accepted ?? 0} accepted)</Text>
                </div>
              </div>

              <div className="h-8 w-px bg-gray-200" />

              <div className="flex items-center gap-3">
                <TeamOutlined className={`text-xl ${(industries?.total ?? 0) === 0 ? 'text-amber-500' : 'text-orange-500'}`} />
                <div>
                  <Text className="text-[10px] font-bold text-gray-400 uppercase block">Industries</Text>
                  <div className="flex items-center gap-1">
                    <Text className={`text-xl font-black ${(industries?.total ?? 0) === 0 ? 'text-amber-500' : ''}`}>
                      {industries?.total ?? 0}
                    </Text>
                    {(industries?.total ?? 0) === 0 && activeStudentsWithInternships > 0 && (
                      <WarningOutlined className="text-amber-500" />
                    )}
                  </div>
                </div>
              </div>

              <div className="h-8 w-px bg-gray-200" />

              <div className="flex items-center gap-3">
                <CalendarOutlined className="text-xl text-blue-500" />
                <div>
                  <Text className="text-[10px] font-bold text-gray-400 uppercase block">Approval Rate</Text>
                  <Text className="text-xl font-black text-green-600">{applications?.approvalRate ?? 0}%</Text>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Data Issue Warning */}
      {(industries?.total ?? 0) === 0 && activeStudentsWithInternships > 0 && (
        <Row className="mt-4">
          <Col span={24}>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <WarningOutlined className="text-amber-500 text-lg mt-0.5" />
              <div>
                <Text className="font-semibold text-amber-700 block">Data Issue: Industries = 0</Text>
                <Text className="text-sm text-amber-600">
                  There are {activeStudentsWithInternships.toLocaleString()} active internships but 0 industries registered.
                  Please check if industry/company data is missing.
                </Text>
              </div>
            </div>
          </Col>
        </Row>
      )}

      <CollegeBreakdownModal
        visible={modalType !== null}
        onClose={closeModal}
        title={modalType === 'students' ? 'College-wise Students' : 'College-wise Mentors'}
        loading={modalLoading}
        data={collegeData}
        columns={getColumns(modalType)}
      />
    </>
  );
};

export default StatisticsCards;
