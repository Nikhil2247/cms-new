import React from 'react';
import { Card, Progress, theme } from 'antd';

const StatCard = ({
  icon,
  title,
  value,
  active,
  iconBg,
  description,
}) => {
  const { token } = theme.useToken();

  // Define gradient colors based on iconBg class
  const gradientMap = {
    'bg-purple-400': 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    'bg-green-400': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    'bg-pink-400': 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
    'bg-cyan-400': 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  };

  const gradient = gradientMap[iconBg] || 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';

  return (
    <Card
      className="overflow-hidden h-full"
      styles={{ body: { padding: 0 } }}
    >
      {/* Top Section - Gradient Background */}
      <div className="p-4 text-white relative" style={{ background: gradient }}>
        {/* Decorative circles */}
        <div 
          className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-20 bg-white translate-x-1/4 -translate-y-1/4"
        />
        
        <div className="flex justify-between items-center relative z-10">
          <div>
            <div className="text-3xl font-bold mb-1">{value || 0}</div>
            <div className="text-sm uppercase tracking-wider opacity-90 font-medium">
              {title}
            </div>
          </div>
          <div className="p-3 rounded-xl backdrop-blur-sm bg-white/20">
            {React.cloneElement(icon, {
              style: { fontSize: '24px' },
            })}
          </div>
        </div>
      </div>

      {/* Bottom Section - Progress Info */}
      <div className="p-4 bg-background-tertiary">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-text-primary">
            {description}
          </span>
          <span className="text-sm font-semibold text-text-secondary">
            {active || 0}/{value || 0}
          </span>
        </div>
        <Progress
          percent={Math.round(((active || 0) / (value || 1)) * 100) || 0}
          showInfo={false}
          size="small"
          strokeColor={token.colorPrimary}
          className="mb-1"
        />
      </div>
    </Card>
  );
};

export default StatCard;