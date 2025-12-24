import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Typography } from 'antd';
import { MenuOutlined, CloseOutlined } from '@ant-design/icons';
import {
  fetchInstitutions,
  selectInstitutions,
  selectSelectedInstitute,
  clearSelectedInstitute,
} from '../store/stateSlice';
import { InstituteSidePanel, InstituteDetailView } from '../dashboard/components';

const { Text } = Typography;

/**
 * InstitutionOverview - A page with sidebar showing institutions list
 * and main content area showing selected institution details
 */
const InstitutionOverview = () => {
  const dispatch = useDispatch();
  const institutions = useSelector(selectInstitutions);
  const selectedInstitute = useSelector(selectSelectedInstitute);

  const [sidePanelOpen, setSidePanelOpen] = useState(true);

  // Fetch institutions on mount
  useEffect(() => {
    dispatch(fetchInstitutions({ limit: 100 }));
  }, [dispatch]);

  // Check if an institute is selected
  const hasSelection = selectedInstitute?.id != null;

  // Handle back/clear selection
  const handleClearSelection = useCallback(() => {
    dispatch(clearSelectedInstitute());
  }, [dispatch]);

  return (
    <div className="institution-overview flex h-[calc(100vh-120px)] bg-background-secondary rounded-xl overflow-hidden shadow-sm border border-border">
      {/* Side Panel */}
      <div
        className={`transition-all duration-300 border-r border-border ${
          sidePanelOpen ? 'w-80' : 'w-0 overflow-hidden'
        } flex-shrink-0 bg-surface`}
      >
        {sidePanelOpen && (
          <div className="h-full">
            <InstituteSidePanel />
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Header with toggle and back button */}
        <div className="flex items-center gap-2 px-4 py-3 bg-surface border-b border-border">
          <Button
            type="text"
            icon={sidePanelOpen ? <CloseOutlined /> : <MenuOutlined />}
            onClick={() => setSidePanelOpen(!sidePanelOpen)}
            className="flex items-center gap-1 text-text-secondary hover:text-text-primary"
          >
            {sidePanelOpen ? 'Hide Panel' : 'Show Panel'}
          </Button>

          {hasSelection && (
            <Button onClick={handleClearSelection} size="small" className="text-text-primary border-border">
              ← Clear Selection
            </Button>
          )}

          <div className="flex-1" />

          <Text className="text-sm text-text-secondary">
            {institutions.length} institutions loaded
          </Text>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <InstituteDetailView />
        </div>
      </div>
    </div>
  );
};

export default InstitutionOverview;
