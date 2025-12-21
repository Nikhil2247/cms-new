import React, { useState, useEffect } from 'react';
import { Layout, Drawer } from 'antd';
import { Outlet } from 'react-router-dom';
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';

// Layout Components
import SidebarLogo from './SidebarLogo';
import SidebarMenu from './SidebarMenu';
import LayoutHeader from './LayoutHeader';
import LogoutModal from './LogoutModal';
import SessionExpiryModal from './SessionExpiryModal';
import UserProfile from '../UserProfile';

// Config
import { getMenuSectionsForRole } from './config/menuConfig.jsx';

// Hooks & Utils
import { useTheme } from '../../contexts/ThemeContext';
import { useTokenMonitor } from '../../hooks/useTokenMonitor';
import { LogoutReason } from '../../utils/authUtils';
import { getTokenPayload } from '../../utils/tokenManager';

const { Sider, Content } = Layout;

const Layouts = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const screens = useBreakpoint();
  const { darkMode, toggleTheme, ref } = useTheme();
  const { logout, sessionInfo, isExpiring, extendSession } = useTokenMonitor({
    enabled: true,
    warningMinutes: 5,
    showWarning: true,
    trackActivity: true,
  });

  // Get user from token
  const getUserFromToken = () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return { role: null, name: 'User' };
      const payload = getTokenPayload(token);
      return {
        role: payload?.role || (Array.isArray(payload?.roles) ? payload.roles[0] : null),
        name: payload?.name || payload?.email || 'User',
      };
    } catch {
      return { role: null, name: 'User' };
    }
  };

  const { role, name } = getUserFromToken();
  const sections = getMenuSectionsForRole(role);

  // Logout handlers
  const showLogoutConfirm = () => setLogoutModalVisible(true);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout(LogoutReason.MANUAL);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleLogoutCancel = () => setLogoutModalVisible(false);

  return (
    <Layout className="h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      {screens.lg ? (
        <Sider
          width={260}
          collapsedWidth={72}
          collapsible
          theme="light"
          className="hide-scrollbar sidebar-enhanced h-full z-50 overflow-hidden bg-white dark:bg-slate-900 dark:border-r dark:border-slate-800 shadow-sm"
          collapsed={collapsed}
          trigger={null}
        >
          <div className="flex flex-col h-full">
            <SidebarLogo collapsed={collapsed} role={role} />
            <SidebarMenu sections={sections} collapsed={collapsed} isMobile={false} />
          </div>
        </Sider>
      ) : (
        /* Mobile Drawer */
        <Drawer
          placement="left"
          closable
          onClose={() => setMobileOpen(false)}
          open={mobileOpen}
          width={280}
          classNames={{
            body: 'p-0 bg-white dark:bg-slate-900 flex flex-col',
            header: 'bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3',
            wrapper: 'shadow-2xl',
          }}
          title={
            <span className="font-bold text-base text-black dark:text-white">Navigation</span>
          }
        >
          <div className="flex flex-col h-full">
            <SidebarLogo collapsed={false} role={role} />
            <SidebarMenu
              sections={sections}
              collapsed={false}
              isMobile={true}
              onMobileClose={() => setMobileOpen(false)}
            />
          </div>
        </Drawer>
      )}

      <Layout
        className={`
          transition-all duration-300 ease-in-out
          bg-slate-100 dark:bg-slate-950
          min-h-screen
        `}
      >
        {/* Header */
          }
        <LayoutHeader
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          onMobileOpen={() => setMobileOpen(true)}
          isDesktop={screens.lg}
          darkMode={darkMode}
          toggleTheme={toggleTheme}
          themeRef={ref}
          onProfileClick={() => setProfileModalVisible(true)}
          onLogoutClick={showLogoutConfirm}
        />

        {/* Main Content */}
        <Content
          className={`
            px-4 py-4 md:px-6 md:py-6
            overflow-auto
            hide-scrollbar
          `}
          style={{ minHeight: 'calc(100vh - 64px)' }}
        >
          <div className="max-w-[1600px] mx-auto animate-fade-in">
            <Outlet />
          </div>
        </Content>
      </Layout>

      {/* User Profile Modal */}
      <UserProfile visible={profileModalVisible} onClose={() => setProfileModalVisible(false)} />

      {/* Logout Confirmation Modal */}
      <LogoutModal
        visible={logoutModalVisible}
        onCancel={handleLogoutCancel}
        onConfirm={handleLogout}
        loading={loggingOut}
        userName={name}
        role={role}
        sessionInfo={sessionInfo}
        darkMode={darkMode}
      />

      {/* Session Expiry Warning Modal */}
      <SessionExpiryModal
        visible={isExpiring}
        sessionInfo={sessionInfo}
        onExtend={extendSession}
        onLogout={() => logout(LogoutReason.MANUAL)}
      />
    </Layout>
  );
};

export default Layouts;