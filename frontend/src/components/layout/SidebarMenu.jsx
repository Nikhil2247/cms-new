import React from 'react';
import { Menu, Button, Tooltip } from 'antd';
import { BugOutlined } from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';

const SidebarMenu = ({ sections, collapsed, onMobileClose, isMobile }) => {
  const location = useLocation();
  const [openKeys, setOpenKeys] = React.useState([]);

  // Find active keys based on current path
  const findActiveKeys = () => {
    const pathname = location.pathname;
    let activeKeys = [];
    sections.forEach((section) => {
      section.items.forEach((item) => {
        if (pathname === item.path || pathname.startsWith(item.path + '/')) {
          activeKeys = [section.key, item.key];
        }
      });
    });
    return activeKeys;
  };

  const activeKeys = findActiveKeys();

  // Set initial open menu based on route
  React.useEffect(() => {
    if (activeKeys[0] && !collapsed) {
      setOpenKeys([activeKeys[0]]);
    }
  }, [location.pathname, collapsed]);

  const handleOpenChange = (keys) => {
    // Only keep the last opened key for accordion behavior
    const latestOpenKey = keys.find((key) => openKeys.indexOf(key) === -1);
    setOpenKeys(latestOpenKey ? [latestOpenKey] : []);
  };

  const handleLinkClick = () => {
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 relative">
      {/* Menu Container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin py-2">
        <Menu
          mode="inline"
          theme="light"
          selectedKeys={[activeKeys[1]]}
          openKeys={openKeys}
          onOpenChange={handleOpenChange}
          style={{
            borderRight: 0,
            background: 'transparent',
          }}
          className="custom-sidebar-menu px-2"
          items={sections.map((section) => ({
            key: section.key,
            icon: React.cloneElement(section.icon, {
              className: 'text-lg',
            }),
            label: (
              <span className="font-semibold text-sm tracking-wide text-text-primary">
                {section.title}
              </span>
            ),
            children: section.items.map((item) => ({
              key: item.key,
              icon: React.cloneElement(item.icon, {
                className: 'text-base',
              }),
              label: (
                <Link
                  to={item.path}
                  className="text-sm font-medium transition-colors duration-200 text-text-primary"
                  onClick={handleLinkClick}
                >
                  {item.label}
                </Link>
              ),
            })),
          }))}
        />
      </div>

      {/* Footer Action - Report Issue */}
      <div
        className={`
          px-3 py-4
          border-t border-border
          bg-background-tertiary
        `}
      >
        {!collapsed ? (
          <Link to="/support/technical-query" onClick={handleLinkClick}>
            <Button
              type="default"
              block
              icon={<BugOutlined className="text-sm" />}
              className="
                h-10 rounded-xl
                bg-surface hover:bg-background-secondary
                border border-border
                text-text-primary
                font-medium text-[13px]
                transition-all duration-200
                flex items-center justify-center gap-2
                shadow-sm
              "
            >
              Report Issue
            </Button>
          </Link>
        ) : (
          <div className="flex justify-center">
            <Tooltip title="Report Technical Issue" placement="right">
              <Link to="/support/technical-query" onClick={handleLinkClick}>
                <Button
                  type="default"
                  shape="circle"
                  icon={<BugOutlined className="text-sm" />}
                  className="
                    w-10 h-10
                    bg-surface hover:bg-background-secondary
                    border border-border
                    text-text-primary
                    transition-all duration-200
                    flex items-center justify-center
                  "
                />
              </Link>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
};

export default SidebarMenu;