// ActiveReportsBadge Component - Show active report generation jobs
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Badge,
  Button,
  Popover,
  List,
  Typography,
  Progress,
  Space,
  Tag,
  Empty,
} from "antd";
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { getReportStatus } from "../../services/reportBuilderApi";
import { formatLabel } from "../../utils/reportBuilderUtils";

const { Text } = Typography;

const STATUS_ICONS = {
  completed: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  processing: <LoadingOutlined spin />,
  pending: <ClockCircleOutlined />,
};

const STATUS_COLORS = {
  completed: "success",
  failed: "error",
  processing: "processing",
  pending: "warning",
};

const ActiveReportsBadge = ({
  activeReports = [],
  onViewReport,
  onReportComplete,
  onReportFailed,
  pausePolling = false, // Pause polling when another monitor is active
}) => {
  const [reportStatuses, setReportStatuses] = useState({});
  const [popoverVisible, setPopoverVisible] = useState(false);
  const pollingIntervals = useRef({});
  const completedReports = useRef(new Set());
  const mountedRef = useRef(true);
  const callbacksRef = useRef({ onReportComplete, onReportFailed });
  const pausePollingRef = useRef(pausePolling);

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Clear all polling intervals on unmount
      Object.keys(pollingIntervals.current).forEach((id) => {
        clearInterval(pollingIntervals.current[id]);
      });
      pollingIntervals.current = {};
    };
  }, []);

  // Keep callbacks ref in sync to avoid stale closures
  useEffect(() => {
    callbacksRef.current = { onReportComplete, onReportFailed };
  }, [onReportComplete, onReportFailed]);

  // Keep pausePolling ref in sync
  useEffect(() => {
    pausePollingRef.current = pausePolling;
  }, [pausePolling]);

  const stopPolling = useCallback((reportId) => {
    if (pollingIntervals.current[reportId]) {
      clearInterval(pollingIntervals.current[reportId]);
      delete pollingIntervals.current[reportId];
    }
  }, []);

  const stopAllPolling = useCallback(() => {
    Object.keys(pollingIntervals.current).forEach((id) => {
      clearInterval(pollingIntervals.current[id]);
    });
    pollingIntervals.current = {};
  }, []);

  // Pause/resume polling based on pausePolling prop
  useEffect(() => {
    if (pausePolling) {
      stopAllPolling();
    }
  }, [pausePolling, stopAllPolling]);

  const fetchStatus = useCallback(async (reportId) => {
    // Skip if paused or unmounted
    if (!mountedRef.current || pausePollingRef.current) return;

    try {
      const response = await getReportStatus(reportId);

      // Check if still mounted before updating state
      if (!mountedRef.current) return;

      if (response?.data) {
        setReportStatuses((prev) => ({
          ...prev,
          [reportId]: response.data,
        }));

        // Check for completion
        if (
          response.data.status === "completed" &&
          !completedReports.current.has(reportId)
        ) {
          completedReports.current.add(reportId);
          stopPolling(reportId);
          callbacksRef.current.onReportComplete?.(reportId, response.data);
        } else if (
          response.data.status === "failed" &&
          !completedReports.current.has(reportId)
        ) {
          completedReports.current.add(reportId);
          stopPolling(reportId);
          callbacksRef.current.onReportFailed?.(reportId, response.data);
        }
      }
    } catch (error) {
      if (!mountedRef.current) return;
      console.error(`Error fetching status for ${reportId}:`, error);
    }
  }, [stopPolling]);

  const startPolling = useCallback((reportId) => {
    // Fetch immediately
    fetchStatus(reportId);

    // Then poll every 3 seconds
    pollingIntervals.current[reportId] = setInterval(() => {
      fetchStatus(reportId);
    }, 3000);
  }, [fetchStatus]);

  // Start polling for each active report (only when not paused)
  useEffect(() => {
    // Don't start new polling if paused
    if (pausePolling) return;

    activeReports.forEach((reportId) => {
      if (!pollingIntervals.current[reportId] && !completedReports.current.has(reportId)) {
        startPolling(reportId);
      }
    });

    // Cleanup removed reports
    Object.keys(pollingIntervals.current).forEach((reportId) => {
      if (!activeReports.includes(reportId)) {
        stopPolling(reportId);
      }
    });
  }, [activeReports, startPolling, stopPolling, pausePolling]);

  // Count active (pending/processing) reports
  const activeCount = activeReports.filter((id) => {
    const status = reportStatuses[id]?.status;
    return status === "pending" || status === "processing";
  }).length;

  const getProgressPercent = (status) => {
    switch (status) {
      case "pending":
        return 10;
      case "processing":
        return 60;
      case "completed":
        return 100;
      case "failed":
        return 100;
      default:
        return 0;
    }
  };

  const renderReportItem = (reportId) => {
    const statusData = reportStatuses[reportId] || {
      status: "pending",
      reportType: "unknown",
    };

    return (
      <List.Item
        key={reportId}
        className="!px-0"
        actions={[
          <Button
            key="view"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setPopoverVisible(false);
              onViewReport?.(reportId);
            }}
          >
            View
          </Button>,
        ]}
      >
        <List.Item.Meta
          avatar={STATUS_ICONS[statusData.status]}
          title={
            <Space>
              <Text className="text-sm">
                {statusData.reportName || formatLabel(statusData.reportType)}
              </Text>
              <Tag color={STATUS_COLORS[statusData.status]} className="text-xs">
                {statusData.status}
              </Tag>
            </Space>
          }
          description={
            <div>
              <Progress
                percent={getProgressPercent(statusData.status)}
                size="small"
                status={
                  statusData.status === "failed"
                    ? "exception"
                    : statusData.status === "completed"
                    ? "success"
                    : "active"
                }
                showInfo={false}
                className="!mb-1"
              />
              <Text type="secondary" className="text-xs">
                {statusData.status === "completed"
                  ? `${statusData.totalRecords?.toLocaleString() || 0} records`
                  : statusData.status === "failed"
                  ? "Generation failed"
                  : "In progress..."}
              </Text>
            </div>
          }
        />
      </List.Item>
    );
  };

  const popoverContent = (
    <div className="w-80">
      {activeReports.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No active reports"
          className="py-4"
        />
      ) : (
        <List
          dataSource={activeReports}
          renderItem={renderReportItem}
          size="small"
          className="max-h-64 overflow-y-auto"
        />
      )}
    </div>
  );

  if (activeReports.length === 0) {
    return null;
  }

  return (
    <Popover
      content={popoverContent}
      title={
        <Space>
          <FileTextOutlined />
          <Text strong>Active Reports ({activeReports.length})</Text>
        </Space>
      }
      trigger="click"
      placement="bottomRight"
      open={popoverVisible}
      onOpenChange={setPopoverVisible}
    >
      <Badge count={activeCount} offset={[-5, 5]}>
        <Button
          icon={
            activeCount > 0 ? (
              <LoadingOutlined spin />
            ) : (
              <FileTextOutlined />
            )
          }
          className="flex items-center"
        >
          {activeCount > 0 && (
            <Text className="ml-1">{activeCount} Generating</Text>
          )}
        </Button>
      </Badge>
    </Popover>
  );
};

export default ActiveReportsBadge;