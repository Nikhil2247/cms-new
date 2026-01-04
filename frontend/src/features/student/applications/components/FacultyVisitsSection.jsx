import React, { useState, useMemo } from 'react';
import {
  Card,
  Tag,
  Empty,
  Spin,
  Progress,
  Typography,
  Timeline,
  Modal,
  Alert,
  Tooltip,
  Descriptions,
} from 'antd';
import {
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  CalendarOutlined,
  WarningOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { MONTH_NAMES, getVisitStatus } from '../utils/applicationUtils';

const { Text, Title } = Typography;

const FacultyVisitsSection = ({
  application,
  visits = [],
  progress = {},
  loading,
  hasStarted,
}) => {
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);

  // Calculate progress - use ONLY counter fields from application object (API)
  const calculatedProgress = useMemo(() => {
    // Use ONLY counter fields from application object, default to 0 if not available
    const total = application?.totalExpectedVisits ?? 0;
    const completed = application?.completedVisitsCount ?? 0;
    const pending = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, pending, overdue: 0, percentage };
  }, [application?.totalExpectedVisits, application?.completedVisitsCount]);

  const openViewModal = (visit) => {
    setSelectedVisit(visit);
    setViewModalVisible(true);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircleOutlined className="text-green-500" />;
      case 'PENDING':
        return <ClockCircleOutlined className="text-blue-500" />;
      case 'OVERDUE':
        return <ExclamationCircleOutlined className="text-red-500" />;
      case 'UPCOMING':
        return <CalendarOutlined className="text-gray-400" />;
      default:
        return <TeamOutlined className="text-gray-400" />;
    }
  };

  const getTimelineColor = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'green';
      case 'PENDING':
        return 'blue';
      case 'OVERDUE':
        return 'red';
      default:
        return 'gray';
    }
  };

  if (!hasStarted) {
    return (
      <Card className="rounded-xl">
        <Empty
          image={<CalendarOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />}
          description={
            <div className="text-center">
              <Text className="text-gray-500">
                Faculty visits will be scheduled once your internship starts
              </Text>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Card */}
      <Card className="rounded-xl bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Title level={5} className="!mb-0">Faculty Visits Progress</Title>
            <Text className="text-gray-500 text-sm">
              Monthly visits by your assigned faculty mentor
            </Text>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <TeamOutlined />
            <span className="font-medium">
              {calculatedProgress.completed}/{calculatedProgress.total} Visits
            </span>
          </div>
        </div>

        <Progress
          percent={calculatedProgress.percentage}
          status={calculatedProgress.overdue > 0 ? 'exception' : 'active'}
          strokeColor={calculatedProgress.overdue > 0 ? undefined : { from: '#722ed1', to: '#eb2f96' }}
        />

        <div className="flex justify-between text-sm mt-2">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <CheckCircleOutlined className="text-green-500" />
              {calculatedProgress.completed} completed
            </span>
            <span className="flex items-center gap-1">
              <ClockCircleOutlined className="text-blue-500" />
              {calculatedProgress.pending} pending
            </span>
          </div>
          {calculatedProgress.overdue > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <WarningOutlined />
              {calculatedProgress.overdue} overdue
            </span>
          )}
        </div>

        {/* Info notice */}
        <Alert
          className="mt-4"
          title="Faculty visits are logged by your assigned mentor"
          type="info"
          showIcon
          icon={<TeamOutlined />}
        />
      </Card>

      {/* Visits Timeline */}
      <Card className="rounded-xl" title="Visit Schedule">
        {loading ? (
          <div className="text-center py-8">
            <Spin />
          </div>
        ) : visits.length === 0 ? (
          <Empty description="No visits scheduled yet. Visits will be scheduled when your mentor is assigned." />
        ) : (     
          <Timeline
            mode="left"
            items={visits.map((visit) => {
              const visitStatus = visit.submissionStatus || getVisitStatus(visit).status;
              const statusColor = visit.statusColor || getVisitStatus(visit).color;
              const statusLabel = visit.statusLabel || getVisitStatus(visit).label;

              return {
                key: visit.id,
                color: getTimelineColor(visitStatus),
                dot: getStatusIcon(visitStatus),
                children: (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg -mt-1 ml-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Text strong>
                          {MONTH_NAMES[(visit.visitMonth || 1) - 1]} {visit.visitYear}
                        </Text>
                        {visit.faculty?.name && (
                          <Text className="text-xs text-gray-500">
                            by {visit.faculty?.name}
                          </Text>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {visitStatus === 'COMPLETED' ? (
                          <span className="text-green-600">
                            Visited on {visit.visitDate ? new Date(visit.visitDate).toLocaleDateString() : 'N/A'}
                          </span>
                        ) : (
                          <>
                            <span>
                              Due by {visit.requiredByDate ? new Date(visit.requiredByDate).toLocaleDateString() : 'N/A'}
                            </span>
                            {visit.sublabel && (
                              <span className={`ml-2 ${visitStatus === 'OVERDUE' ? 'text-red-500' : ''}`}>
                                • {visit.sublabel}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Tag color={statusColor}>{statusLabel}</Tag>

                      {/* View button if visit is completed */}
                      {visitStatus === 'COMPLETED' && (
                        <Tooltip title="View visit details">
                          <button
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            onClick={() => openViewModal(visit)}
                          >
                            <EyeOutlined />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                ),
              };
            })}
          />
        )}
      </Card>

      {/* View Visit Modal */}
      <Modal
        title={
          selectedVisit
            ? `${MONTH_NAMES[(selectedVisit.visitMonth || 1) - 1]} ${selectedVisit.visitYear} Visit`
            : 'Visit Details'
        }
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setSelectedVisit(null);
        }}
        footer={null}
      >
        {selectedVisit && (
          <div className="space-y-4">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Status">
                <Tag color={selectedVisit.statusColor || 'green'}>
                  {selectedVisit.statusLabel || 'Completed'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Faculty">
                {selectedVisit.faculty?.name || 'Not assigned'}
              </Descriptions.Item>
              {selectedVisit.visitDate && (
                <Descriptions.Item label="Visit Date">
                  {new Date(selectedVisit.visitDate).toLocaleDateString()}
                </Descriptions.Item>
              )}
              {selectedVisit.visitType && (
                <Descriptions.Item label="Visit Type">
                  {selectedVisit.visitType}
                </Descriptions.Item>
              )}
              {selectedVisit.visitLocation && (
                <Descriptions.Item label="Location">
                  <EnvironmentOutlined className="mr-1" />
                  {selectedVisit.visitLocation}
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedVisit.meetingMinutes && (
              <div>
                <Text strong className="block mb-2">Meeting Minutes</Text>
                <div className="p-3 bg-gray-50 rounded-lg text-sm">
                  {selectedVisit.meetingMinutes}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FacultyVisitsSection;
