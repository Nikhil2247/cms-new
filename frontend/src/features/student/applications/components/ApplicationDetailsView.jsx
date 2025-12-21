import React from 'react';
import {
  Card,
  Button,
  Typography,
  Tabs,
  Tag,
  Avatar,
  Timeline,
  Row,
  Col,
  Divider,
  Badge,
  Empty,
  Spin,
} from 'antd';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  BankOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  UserOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StarOutlined,
  TrophyOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import {
  formatDisplayDate,
  formatCurrency,
  getStatusColor,
  hasInternshipStarted,
} from '../utils/applicationUtils';
import { getImageUrl } from '../../../../utils/imageUtils';
import MonthlyReportsSection from './MonthlyReportsSection';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const getStatusIcon = (status) => {
  const icons = {
    APPLIED: <ClockCircleOutlined />,
    UNDER_REVIEW: <ClockCircleOutlined />,
    ACCEPTED: <CheckCircleOutlined />,
    REJECTED: <CloseCircleOutlined />,
    JOINED: <CheckCircleOutlined />,
    COMPLETED: <StarOutlined />,
  };
  return icons[status] || <ClockCircleOutlined />;
};

const ApplicationDetailsView = ({
  application,
  onBack,
  onOpenFeedbackModal,
  onOpenMonthlyFeedbackModal,
  completionFeedback,
  monthlyReports,
  monthlyReportsLoading,
  monthlyReportsUploading,
  missingReports,
  onUploadReport,
  onSubmitReport,
  onDeleteReport,
  onRefreshReports,
  monthlyFeedbacks,
  monthlyFeedbacksLoading,
}) => {
  if (!application) return null;

  const isSelfIdentified = application.isSelfIdentified || !application.internship;
  const internship = application.internship;
  const industry = internship?.industry || {};
  const internshipStarted = hasInternshipStarted(application);

  const getTimelineItems = () => {
    const items = [
      {
        color: 'blue',
        children: (
          <div>
            <Text strong>Application Submitted</Text>
            <br />
            <Text type="secondary" className="text-xs">
              {formatDisplayDate(application.applicationDate || application.createdAt, true)}
            </Text>
          </div>
        ),
      },
    ];

    if (application.reviewedAt) {
      items.push({
        color: application.status === 'REJECTED' ? 'red' : 'green',
        children: (
          <div>
            <Text strong>
              {application.status === 'REJECTED' ? 'Application Rejected' : 'Application Reviewed'}
            </Text>
            <br />
            <Text type="secondary" className="text-xs">
              {formatDisplayDate(application.reviewedAt, true)}
            </Text>
          </div>
        ),
      });
    }

    if (application.hasJoined) {
      items.push({
        color: 'cyan',
        children: (
          <div>
            <Text strong>Joined Internship</Text>
            <br />
            <Text type="secondary" className="text-xs">
              {formatDisplayDate(application.joiningDate, true)}
            </Text>
          </div>
        ),
      });
    }

    if (application.status === 'COMPLETED') {
      items.push({
        color: 'purple',
        dot: <TrophyOutlined />,
        children: (
          <div>
            <Text strong>Internship Completed</Text>
            <br />
            <Text type="secondary" className="text-xs">
              {formatDisplayDate(application.completedAt, true)}
            </Text>
          </div>
        ),
      });
    }

    return items;
  };

  const renderDetailsTab = () => (
    <div className="space-y-6">
      {/* Company/Internship Info */}
      <Card className="rounded-xl">
        <div className="flex items-start gap-4">
          <Avatar
            src={industry?.logo ? getImageUrl(industry.logo) : null}
            icon={<BankOutlined />}
            size={64}
            className="bg-blue-100 text-blue-600"
          />
          <div className="flex-1">
            <Title level={4} className="mb-1">
              {isSelfIdentified
                ? application.companyName
                : industry?.companyName || 'N/A'}
            </Title>
            <Text type="secondary">
              {isSelfIdentified
                ? application.jobProfile
                : internship?.title || 'Internship'}
            </Text>
            <div className="mt-2">
              <Tag
                color={getStatusColor(application.status)}
                icon={getStatusIcon(application.status)}
                className="rounded-full"
              >
                {application.status?.replace(/_/g, ' ')}
              </Tag>
              {isSelfIdentified && (
                <Tag color="purple" className="ml-2">Self-Identified</Tag>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Details Grid */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card className="rounded-xl h-full" title="Duration & Schedule">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CalendarOutlined className="text-blue-500" />
                <div>
                  <Text type="secondary" className="block text-xs">Start Date</Text>
                  <Text>
                    {formatDisplayDate(
                      isSelfIdentified
                        ? application.startDate
                        : internship?.startDate
                    )}
                  </Text>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CalendarOutlined className="text-green-500" />
                <div>
                  <Text type="secondary" className="block text-xs">End Date</Text>
                  <Text>
                    {formatDisplayDate(
                      isSelfIdentified
                        ? application.endDate
                        : internship?.endDate
                    )}
                  </Text>
                </div>
              </div>
              {!isSelfIdentified && internship?.stipend && (
                <div className="flex items-center gap-2">
                  <StarOutlined className="text-yellow-500" />
                  <div>
                    <Text type="secondary" className="block text-xs">Stipend</Text>
                    <Text>{formatCurrency(internship.stipend)}</Text>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card className="rounded-xl h-full" title="Contact Information">
            <div className="space-y-3">
              {(industry?.address || application.companyAddress) && (
                <div className="flex items-center gap-2">
                  <EnvironmentOutlined className="text-red-500" />
                  <div>
                    <Text type="secondary" className="block text-xs">Location</Text>
                    <Text>{industry?.address || application.companyAddress}</Text>
                  </div>
                </div>
              )}
              {industry?.phone && (
                <div className="flex items-center gap-2">
                  <PhoneOutlined className="text-green-500" />
                  <div>
                    <Text type="secondary" className="block text-xs">Phone</Text>
                    <Text>{industry.phone}</Text>
                  </div>
                </div>
              )}
              {industry?.email && (
                <div className="flex items-center gap-2">
                  <MailOutlined className="text-blue-500" />
                  <div>
                    <Text type="secondary" className="block text-xs">Email</Text>
                    <Text>{industry.email}</Text>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Mentor Info */}
      {application.mentor && (
        <Card className="rounded-xl" title="Assigned Mentor">
          <div className="flex items-center gap-4">
            <Avatar
              src={application.mentor.profileImage ? getImageUrl(application.mentor.profileImage) : null}
              icon={<UserOutlined />}
              size={48}
              className="bg-purple-100 text-purple-600"
            />
            <div>
              <Text strong>{application.mentor.name}</Text>
              <br />
              <Text type="secondary" className="text-sm">
                {application.mentor.designation || 'Faculty Mentor'}
              </Text>
              {application.mentor.email && (
                <div className="text-xs text-gray-500">{application.mentor.email}</div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );

  const renderTimelineTab = () => (
    <Card className="rounded-xl">
      <Timeline items={getTimelineItems()} />
    </Card>
  );

  const renderFeedbackTab = () => (
    <div className="space-y-4">
      {/* Completion Feedback */}
      <Card
        className="rounded-xl"
        title={
          <div className="flex items-center gap-2">
            <TrophyOutlined className="text-yellow-500" />
            Internship Feedback
          </div>
        }
        extra={
          application.status === 'COMPLETED' && !completionFeedback?.studentFeedback && (
            <Button
              type="primary"
              icon={<MessageOutlined />}
              onClick={() => onOpenFeedbackModal(application)}
              className="bg-green-600"
            >
              Submit Feedback
            </Button>
          )
        }
      >
        {completionFeedback?.studentFeedback ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Text strong>Your Rating:</Text>
              <div className="flex">
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    key={i}
                    className={`text-lg ${
                      i < (completionFeedback.studentRating || 0)
                        ? 'text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
            <div>
              <Text strong>Your Feedback:</Text>
              <Paragraph className="mt-1 text-gray-600">
                {completionFeedback.studentFeedback}
              </Paragraph>
            </div>
            {completionFeedback.skillsLearned && (
              <div>
                <Text strong>Skills Learned:</Text>
                <Paragraph className="mt-1 text-gray-600">
                  {completionFeedback.skillsLearned}
                </Paragraph>
              </div>
            )}
          </div>
        ) : (
          <Empty
            description={
              application.status === 'COMPLETED'
                ? 'Submit your feedback about this internship'
                : 'Feedback can be submitted after internship completion'
            }
          />
        )}
      </Card>

      {/* Industry Feedback */}
      {completionFeedback?.industryFeedback && (
        <Card
          className="rounded-xl"
          title={
            <div className="flex items-center gap-2">
              <BankOutlined className="text-blue-500" />
              Industry Feedback
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Text strong>Rating:</Text>
              <div className="flex">
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    key={i}
                    className={`text-lg ${
                      i < (completionFeedback.industryRating || 0)
                        ? 'text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
            <div>
              <Text strong>Feedback:</Text>
              <Paragraph className="mt-1 text-gray-600">
                {completionFeedback.industryFeedback}
              </Paragraph>
            </div>
          </div>
        </Card>
      )}
    </div>
  );

  const renderMonthlyProgressTab = () => (
    <div className="space-y-4">
      {/* Monthly Feedbacks (Images) */}
      <Card
        className="rounded-xl"
        title="Monthly Progress Images"
        extra={
          internshipStarted && (
            <Button
              type="primary"
              icon={<CalendarOutlined />}
              onClick={() => onOpenMonthlyFeedbackModal(application)}
              className="bg-green-600"
            >
              Upload Progress
            </Button>
          )
        }
      >
        {monthlyFeedbacksLoading ? (
          <div className="text-center py-8"><Spin /></div>
        ) : monthlyFeedbacks.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {monthlyFeedbacks.map((feedback) => (
              <div key={feedback.id} className="relative">
                <img
                  src={getImageUrl(feedback.progressImage)}
                  alt="Progress"
                  className="w-full h-32 object-cover rounded-lg"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2 rounded-b-lg">
                  {new Date(feedback.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty description="No progress images uploaded yet" />
        )}
      </Card>

      {/* Monthly Reports Section */}
      <MonthlyReportsSection
        application={application}
        reports={monthlyReports}
        loading={monthlyReportsLoading}
        uploading={monthlyReportsUploading}
        missingReports={missingReports}
        onUpload={onUploadReport}
        onSubmit={onSubmitReport}
        onDelete={onDeleteReport}
        onRefresh={onRefreshReports}
        hasStarted={internshipStarted}
      />
    </div>
  );

  return (
    <div className="mb-8">
      {/* Back Button */}
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={onBack}
        className="mb-4"
        size="large"
      >
        Back to My Applications
      </Button>

      {/* Application Details Content */}
      <Card className="rounded-2xl">
        <div className="mb-6">
          <Title level={3}>
            <FileTextOutlined className="mr-2 text-blue-600" />
            Application Details
          </Title>
        </div>

        <Tabs defaultActiveKey="details">
          <TabPane tab="Application Details" key="details">
            {renderDetailsTab()}
          </TabPane>
          <TabPane tab="Timeline" key="timeline">
            {renderTimelineTab()}
          </TabPane>
          <TabPane tab="Monthly Progress" key="progress">
            {renderMonthlyProgressTab()}
          </TabPane>
          <TabPane tab="Feedback" key="feedback">
            {renderFeedbackTab()}
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default ApplicationDetailsView;
