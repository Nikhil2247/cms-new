import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { Button, Typography, Tooltip, Badge } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BankOutlined,
  ArrowLeftOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import {
  fetchInstitutions,
  selectInstitutions,
  selectSelectedInstitute,
  selectInstitutionsLoading,
  clearSelectedInstitute,
  setSelectedInstitute,
} from '../store/stateSlice';
import { InstituteSidePanel, InstituteDetailView } from '../dashboard/components';

const { Text, Title } = Typography;

/**
 * InstitutionOverview - A page with sidebar showing institutions list
 * and main content area showing selected institution details
 */
const InstitutionOverview = () => {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const institutions = useSelector(selectInstitutions);
  const selectedInstitute = useSelector(selectSelectedInstitute);
  const loading = useSelector(selectInstitutionsLoading);

  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [initialTab, setInitialTab] = useState(null);

  // Get URL params
  const urlInstitutionId = searchParams.get('id');
  const urlTab = searchParams.get('tab');

  // Fetch institutions on mount
  useEffect(() => {
    dispatch(fetchInstitutions({ limit: 100 }));
  }, [dispatch]);

  // Auto-select institution from URL param
  useEffect(() => {
    // Select institution from URL if it's different from current selection
    if (urlInstitutionId && institutions.length > 0 && urlInstitutionId !== selectedInstitute?.id) {
      const institution = institutions.find(inst => inst.id === urlInstitutionId);
      if (institution) {
        dispatch(setSelectedInstitute(institution.id));
        if (urlTab) {
          setInitialTab(urlTab);
        }
        setSearchParams({}, { replace: true });
      }
    }
  }, [urlInstitutionId, urlTab, institutions, selectedInstitute?.id, dispatch, setSearchParams]);

  const hasSelection = selectedInstitute?.id != null;

  const handleClearSelection = useCallback(() => {
    dispatch(clearSelectedInstitute());
  }, [dispatch]);

  // Get selected institution name
  const selectedName = institutions.find(i => i.id === selectedInstitute?.id)?.name;

  return (
    <div className="institution-overview flex flex-col h-[calc(100vh-120px)] bg-background rounded-2xl overflow-hidden shadow-lg border border-border">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-5 py-4 bg-surface border-b border-border">
        <div className="flex items-center gap-4">
          {/* Page Icon & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BankOutlined className="text-primary text-lg" />
            </div>
            <div>
              <Title level={4} className="!mb-0 !text-lg font-bold text-text-primary">
                Institutions
              </Title>
              <Text className="text-xs text-text-tertiary">
                {loading ? 'Loading...' : `${institutions.length} registered institutions`}
              </Text>
            </div>
          </div>

          {/* Breadcrumb when selected */}
          {hasSelection && selectedName && (
            <div className="flex items-center gap-2 pl-4 border-l border-border ml-2">
              <Text className="text-text-tertiary">/</Text>
              <Badge status="processing" />
              <Text className="text-text-primary font-medium truncate max-w-[200px]">
                {selectedName}
              </Text>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Back button when selected */}
          {hasSelection && (
            <Tooltip title="Back to list view">
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={handleClearSelection}
                className="text-text-secondary hover:text-primary hover:bg-primary/5 rounded-lg"
              >
                Back
              </Button>
            </Tooltip>
          )}

          {/* Toggle sidebar */}
          <Tooltip title={sidePanelOpen ? 'Hide sidebar (Ctrl+B)' : 'Show sidebar (Ctrl+B)'}>
            <Button
              type={sidePanelOpen ? 'default' : 'primary'}
              ghost={sidePanelOpen}
              icon={sidePanelOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
              onClick={() => setSidePanelOpen(!sidePanelOpen)}
              className="rounded-lg"
            />
          </Tooltip>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Side Panel */}
        <div
          className={`transition-all duration-300 ease-in-out border-r border-border bg-surface ${
            sidePanelOpen ? 'w-80' : 'w-0'
          } flex-shrink-0 overflow-hidden`}
        >
          <div className="h-full w-80">
            <InstituteSidePanel />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden bg-background-secondary">
          <InstituteDetailView defaultTab={initialTab} />
        </div>
      </div>
    </div>
  );
};

export default InstitutionOverview;
