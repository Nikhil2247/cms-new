import React from 'react';
import { Card } from 'antd';

const StatCard = ({
  icon,
  title,
  value,
  bgClass,
  colorClass,
}) => {
  return (
    <Card size="small" className="rounded-xl border-border hover:shadow-md transition-all h-full">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bgClass} ${colorClass}`}>
          {React.cloneElement(icon, { style: { fontSize: '18px' } })}
        </div>
        <div>
          <div className="text-2xl font-bold text-text-primary">
            {value || 0}
          </div>
          <div className="text-[10px] uppercase font-bold text-text-tertiary">{title}</div>
        </div>
      </div>
    </Card>
  );
};

export default StatCard;