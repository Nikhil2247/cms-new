import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

const SidebarLogo = ({ collapsed, role }) => {
  const formatRole = (roleStr) => {
    if (!roleStr) return 'Guest';
    return roleStr
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="relative">
      {/* Logo Area */}
      <div
        className={`
          flex items-center h-14 px-4
          border-b border-border
          transition-all duration-300
          ${collapsed ? 'justify-center' : 'justify-start gap-3'}
        `}
      >
        {/* Logo Icon */}
        <div
          className={`
            flex items-center justify-center
            rounded-xl bg-gradient-to-br from-primary to-primary-600
            shadow-lg shadow-primary/25
            transition-all duration-300
            ${collapsed ? 'w-9 h-9' : 'w-10 h-10'}
          `}
        >
          <span className="text-white font-bold text-base tracking-tight">
            P
          </span>
        </div>

        {/* Logo Text - Only show when not collapsed */}
        {!collapsed && (
          <div className="flex flex-col overflow-hidden">
            <span
              className="text-text-primary font-semibold text-[17px] tracking-tight leading-tight whitespace-nowrap"
            >
              PlaceIntern
            </span>
            <span className="text-text-tertiary text-[10px] font-medium tracking-wide">
              Management System
            </span>
          </div>
        )}
      </div>

      {/* Role Badge - Only show when not collapsed */}
      {!collapsed && (
        <div className="px-4 py-3">
          <div
            className="
              inline-flex items-center gap-1.5
              px-2.5 py-1 rounded-lg
              bg-background-tertiary border border-border
            "
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <Text
              className="text-text-secondary text-[11px] font-medium uppercase tracking-wider"
            >
              {formatRole(role)}
            </Text>
          </div>
        </div>
      )}
    </div>
  );
};

export default SidebarLogo;