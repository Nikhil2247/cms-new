import React from 'react';
import { Card, Space, Typography, theme } from 'antd';

const { Title, Text } = Typography;

const PageHeader = ({
  icon: Icon,
  title,
  description,
  actions = [],
  children,
}) => {
  const { token } = theme.useToken();

  return (
    <Card className="shadow-sm mb-6" styles={{ body: { padding: token.sizePaddingLG } }}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {Icon ? (
              <div
                className="flex items-center justify-center rounded-lg w-10 h-10 bg-surface border border-border text-primary"
              >
                <Icon />
              </div>
            ) : null}
            <div>
              <Title level={4} className="!m-0">
                {title}
              </Title>
              {description ? (
                <Text type="secondary">{description}</Text>
              ) : null}
            </div>
          </div>

          {actions?.length ? (
            <Space wrap>{actions.filter(Boolean)}</Space>
          ) : null}
        </div>

        {children}
      </div>
    </Card>
  );
};

export default PageHeader;