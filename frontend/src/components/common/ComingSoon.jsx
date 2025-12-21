import React from 'react';
import { Card, Typography, Button } from 'antd';
import {
  RocketOutlined,
  ArrowLeftOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const ComingSoon = ({
  title = 'Coming Soon',
  description = 'This feature is currently under development and will be available soon.',
  icon: Icon = RocketOutlined,
  showBackButton = true,
  showHomeButton = true,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-lg w-full text-center border-0 shadow-soft rounded-2xl">
        {/* Icon */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-100/50 to-primary-50/30 mb-4">
            <Icon className="text-4xl text-primary" />
          </div>
        </div>

        {/* Title */}
        <Title level={2} className="!mb-3 !text-text-primary">
          {title}
        </Title>

        {/* Description */}
        <Text className="text-text-secondary text-base block mb-8 max-w-sm mx-auto">
          {description}
        </Text>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 text-sm text-text-tertiary">
            <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
            <span>In Development</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          {showBackButton && (
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
              className="rounded-lg"
            >
              Go Back
            </Button>
          )}
          {showHomeButton && (
            <Button
              type="primary"
              icon={<HomeOutlined />}
              onClick={() => navigate('/dashboard')}
              className="rounded-lg"
            >
              Dashboard
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ComingSoon;