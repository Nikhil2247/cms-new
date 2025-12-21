import React from 'react';
import { Button, Tooltip, Layout, Divider } from 'antd';
import {
  MenuOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SunOutlined,
  MoonOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import NotificationDropdown from '../Notification';

const { Header } = Layout;

const LayoutHeader = ({
  collapsed,
  onToggleCollapse,
  onMobileOpen,
  isDesktop,
  darkMode,
  toggleTheme,
  themeRef,
  onProfileClick,
  onLogoutClick,
}) => {
  // Standard button style matching the "Report Issue" button
  const iconBtnClass = `
    w-10 h-10 flex items-center justify-center rounded-xl
    bg-white dark:bg-slate-800
    border border-slate-200 dark:border-slate-700
    text-slate-600 dark:text-slate-300
    shadow-sm
    hover:bg-slate-50 dark:hover:bg-slate-700
    hover:scale-105 active:scale-95
    transition-all duration-200
  `;

  return (
    <Header
      className={`
        sticky top-0 z-40 flex items-center justify-between
        h-16 px-4 md:px-6
        border-b transition-all duration-300
        bg-white/80 dark:bg-slate-900/80
        border-slate-200 dark:border-slate-800
        backdrop-blur-md
        shadow-sm
      `}
      style={{
        lineHeight: 'normal',
        background: 'transparent',
      }}
    >
      {/* Left Section */}
      <div className="flex items-center gap-3">
        {/* Menu Toggle Button */}
        <Tooltip title={isDesktop ? (collapsed ? "Expand sidebar" : "Collapse sidebar") : "Open menu"}>
          <Button
            type="text"
            icon={
              isDesktop ? (
                collapsed ? <MenuUnfoldOutlined className="text-lg" /> : <MenuFoldOutlined className="text-lg" />
              ) : (
                <MenuOutlined className="text-lg" />
              )
            }
            onClick={() => (isDesktop ? onToggleCollapse() : onMobileOpen())}
            className={iconBtnClass}
          />
        </Tooltip>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Theme Toggle */}
        <Tooltip title={darkMode ? "Switch to light mode" : "Switch to dark mode"}>
          <Button
            type="text"
            ref={themeRef}
            icon={
              darkMode ? (
                <SunOutlined className="text-lg text-amber-400" />
              ) : (
                <MoonOutlined className="text-lg text-indigo-500" />
              )
            }
            onClick={toggleTheme}
            className={iconBtnClass}
          />
        </Tooltip>

        {/* Notifications */}
        <div className="relative">
          <NotificationDropdown />
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* User Profile Button */}
        <Tooltip title="View profile">
          <Button
            type="text"
            icon={<UserOutlined className="text-lg" />}
            onClick={onProfileClick}
            className={iconBtnClass}
          />
        </Tooltip>

        {/* Logout Button */}
        <Button
          type="primary"
          danger
          onClick={onLogoutClick}
          icon={<LogoutOutlined />}
          className={`
            h-10 px-4 rounded-xl font-medium text-sm
            flex items-center gap-2
            shadow-sm hover:shadow-md
            transition-all duration-200
            hover:scale-105 active:scale-95
          `}
        >
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </Header>
  );
};

export default LayoutHeader;