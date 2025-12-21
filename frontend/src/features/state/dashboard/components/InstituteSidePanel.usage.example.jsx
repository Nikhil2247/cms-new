/**
 * USAGE EXAMPLE: InstituteSidePanel Component
 *
 * This file demonstrates how to use the InstituteSidePanel component
 * in your state dashboard pages.
 */

import React from 'react';
import { Layout } from 'antd';
import InstituteSidePanel from './InstituteSidePanel';

const { Sider, Content } = Layout;

// Example 1: Basic usage with sidebar
const DashboardWithSidebar = () => {
  const handleSelectInstitution = (institution) => {
    console.log('Selected institution:', institution);
    // Handle institution selection - update charts, tables, etc.
  };

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider width={320} theme="light" className="overflow-hidden">
        <InstituteSidePanel onSelectInstitute={handleSelectInstitution} />
      </Sider>
      <Content className="p-6">
        {/* Your main dashboard content here */}
        <h1>State Dashboard</h1>
        <p>Select an institution from the sidebar to view details</p>
      </Content>
    </Layout>
  );
};

// Example 2: With collapsible sidebar
const DashboardWithCollapsibleSidebar = () => {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={320}
        theme="light"
        className="overflow-hidden"
      >
        {!collapsed && <InstituteSidePanel />}
      </Sider>
      <Content className="p-6">
        {/* Your main dashboard content here */}
      </Content>
    </Layout>
  );
};

// Example 3: Using with Redux state
const DashboardWithRedux = () => {
  const handleSelectInstitution = (institution) => {
    // The component already dispatches setSelectedInstitute action
    // You can access the selected institution using selectSelectedInstitute selector
    // in any connected component
  };

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider width={320} theme="light">
        <InstituteSidePanel onSelectInstitute={handleSelectInstitution} />
      </Sider>
      <Content className="p-6">
        {/* Use selectSelectedInstitute selector to get selected institution */}
      </Content>
    </Layout>
  );
};

// Example 4: Responsive layout
const ResponsiveDashboard = () => {
  const [visible, setVisible] = React.useState(false);

  return (
    <Layout style={{ height: '100vh' }}>
      {/* Desktop view - always visible */}
      <Sider
        width={320}
        theme="light"
        className="hidden lg:block overflow-hidden"
      >
        <InstituteSidePanel />
      </Sider>

      {/* Mobile view - drawer or modal */}
      <Content className="p-6">
        <button
          className="lg:hidden mb-4 px-4 py-2 bg-blue-500 text-white rounded"
          onClick={() => setVisible(true)}
        >
          Show Institutions
        </button>
        {/* Your main dashboard content here */}
      </Content>
    </Layout>
  );
};

export {
  DashboardWithSidebar,
  DashboardWithCollapsibleSidebar,
  DashboardWithRedux,
  ResponsiveDashboard,
};
