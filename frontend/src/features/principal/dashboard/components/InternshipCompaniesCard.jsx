import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  List,
  Avatar,
  Typography,
  Tag,
  Spin,
  Empty,
  Tooltip,
  Row,
  Col,
  Progress,
  Button,
  Divider,
} from 'antd';
import {
  ShopOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RightOutlined,
  UserOutlined,
  CalendarOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import {
  fetchInternshipStats,
  selectInternshipStats,
  selectInternshipStatsLoading,
} from '../../store/principalSlice';

const { Text, Title } = Typography;

const CompanyItem = ({ company, rank }) => {
  const getRankColor = (rank) => {
    if (rank === 0) return '#faad14';
    if (rank === 1) return '#a0a0a0';
    if (rank === 2) return '#d48806';
    return '#1890ff';
  };

  const getRankBg = (rank) => {
    if (rank === 0) return 'bg-amber-50';
    if (rank === 1) return 'bg-gray-50';
    if (rank === 2) return 'bg-orange-50';
    return 'bg-blue-50';
  };

  return (
    <List.Item className="!px-0 !py-2">
      <div className={`flex items-center w-full gap-3 p-2 rounded-lg ${getRankBg(rank)} transition-all hover:shadow-sm`}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
             style={{ backgroundColor: getRankColor(rank) }}>
          {rank + 1}
        </div>
        <div className="flex-1 min-w-0">
          <Tooltip title={company.name}>
            <Text strong className="block truncate text-sm text-text-primary">{company.name}</Text>
          </Tooltip>
          <div className="flex items-center gap-2 text-xs text-text-tertiary mt-0.5">
            <span className="flex items-center gap-1">
              <UserOutlined className="text-[10px]" />
              {company.count} intern{company.count !== 1 ? 's' : ''}
            </span>
            {company.location && (
              <>
                <span className="text-border">•</span>
                <span className="flex items-center gap-1 truncate">
                  <EnvironmentOutlined className="text-[10px]" />
                  {company.location}
                </span>
              </>
            )}
          </div>
        </div>
        {company.industryType && (
          <Tag color="purple" className="text-[10px] rounded-full px-2 m-0">
            {company.industryType}
          </Tag>
        )}
      </div>
    </List.Item>
  );
};

const InternshipCompaniesCard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const stats = useSelector(selectInternshipStats);
  const loading = useSelector(selectInternshipStatsLoading);

  useEffect(() => {
    dispatch(fetchInternshipStats());
  }, [dispatch]);

  // Memoized company data extraction
  const {
    companies,
    industryDistribution,
    totalCompanies,
    totalInterns,
    statusBreakdown,
    ongoingCount,
    completedCount,
    approvalRate
  } = useMemo(() => {
    const companiesData = stats?.byCompany || [];
    const industryData = stats?.byIndustry || [];
    const statusData = stats?.byStatus || [];

    const ongoing = statusData.find(s => s.status === 'APPROVED' || s.status === 'JOINED')?.count || 0;
    const completed = statusData.find(s => s.status === 'COMPLETED')?.count || 0;

    return {
      companies: companiesData,
      industryDistribution: industryData,
      totalCompanies: companiesData.length,
      totalInterns: companiesData.reduce((sum, c) => sum + (c.count || 0), 0),
      statusBreakdown: statusData,
      ongoingCount: stats?.ongoingInternships || ongoing,
      completedCount: completed,
      approvalRate: stats?.approvalRate || 100,
    };
  }, [stats]);

  if (loading && !stats) {
    return (
      <Card className="h-full rounded-xl border-border">
        <div className="flex justify-center items-center h-48">
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <ShopOutlined className="text-purple-500" />
            <span className="text-text-primary font-semibold">Self-Identified Internships</span>
          </div>
          <Tag color="purple" className="rounded-full text-[10px] uppercase font-bold">
            Student Sourced
          </Tag>
        </div>
      }
      className="border-border shadow-sm rounded-xl h-full"
      styles={{ body: { padding: '16px' } }}
    >
      {/* Summary Stats */}
      <Row gutter={[8, 8]} className="mb-4">
        <Col span={8}>
          <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl">
            <div className="text-2xl font-bold text-purple-600">{totalCompanies}</div>
            <div className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Companies</div>
          </div>
        </Col>
        <Col span={8}>
          <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl">
            <div className="text-2xl font-bold text-blue-600">{totalInterns}</div>
            <div className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Total</div>
          </div>
        </Col>
        <Col span={8}>
          <div className="text-center p-3 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl">
            <div className="text-2xl font-bold text-green-600">{ongoingCount}</div>
            <div className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">Ongoing</div>
          </div>
        </Col>
      </Row>

      {/* Status Progress */}
      <div className="mb-4 p-3 bg-surface rounded-xl border border-border/50">
        <div className="flex items-center justify-between mb-2">
          <Text className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Internship Status</Text>
          <div className="flex items-center gap-2">
            <Tag icon={<CheckCircleOutlined />} color="success" className="rounded-full text-[10px] m-0">
              {completedCount} Completed
            </Tag>
          </div>
        </div>
        <Progress
          percent={totalInterns > 0 ? Math.round((ongoingCount / totalInterns) * 100) : 0}
          strokeColor={{
            '0%': '#9333ea',
            '100%': '#22c55e',
          }}
          trailColor="rgba(0,0,0,0.06)"
          showInfo={false}
          size="small"
        />
        <div className="flex justify-between text-[10px] text-text-tertiary mt-1">
          <span>{ongoingCount} Ongoing</span>
          <span>{totalInterns} Total</span>
        </div>
      </div>

      {/* Industry Distribution */}
      {industryDistribution.length > 0 && (
        <div className="mb-4">
          <Text className="text-xs font-semibold text-text-secondary mb-2 block uppercase tracking-wider">
            Industry Sectors
          </Text>
          <div className="flex flex-wrap gap-1.5">
            {industryDistribution.slice(0, 6).map((ind, idx) => (
              <Tag
                key={idx}
                className="text-[10px] rounded-full px-2 py-0.5 m-0 border-0"
                style={{
                  backgroundColor: `hsl(${(idx * 60) % 360}, 70%, 95%)`,
                  color: `hsl(${(idx * 60) % 360}, 70%, 35%)`
                }}
              >
                {ind.type}: {ind.count}
              </Tag>
            ))}
          </div>
        </div>
      )}

      <Divider className="!my-3" />

      {/* Top Companies List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Text className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            <TrophyOutlined className="mr-1 text-amber-500" />
            Top Hosting Companies
          </Text>
        </div>
        {companies.length > 0 ? (
          <List
            dataSource={companies.slice(0, 5)}
            renderItem={(company, index) => (
              <CompanyItem company={company} rank={index} />
            )}
            split={false}
            size="small"
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div className="text-center">
                <Text className="text-text-tertiary text-sm block mb-1">No internship data yet</Text>
                <Text className="text-text-tertiary text-xs">Students will appear here once they submit self-identified internships</Text>
              </div>
            }
          />
        )}
      </div>

      {/* View All Button */}
      {companies.length > 0 && (
        <Button
          type="text"
          block
          className="mt-3 text-primary hover:bg-primary/5 rounded-lg font-medium"
          onClick={() => navigate('/analytics')}
          icon={<RightOutlined />}
          iconPosition="end"
        >
          View Detailed Analytics
        </Button>
      )}
    </Card>
  );
};

export default InternshipCompaniesCard;
