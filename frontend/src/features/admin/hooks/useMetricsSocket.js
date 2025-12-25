import { useState, useEffect, useCallback, useRef } from 'react';
import { metricsSocket } from '../../../services/metricsSocket.service';
import { message } from 'antd';

/**
 * Custom hook for real-time system metrics via WebSocket
 * Provides health and metrics data with automatic updates
 */
export const useMetricsSocket = (options = {}) => {
  const { autoConnect = true, fallbackToPolling = true } = options;

  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [sessionStats, setSessionStats] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const pollingInterval = useRef(null);
  const mounted = useRef(true);

  // Fallback polling function
  const fetchMetricsHttp = useCallback(async () => {
    try {
      const { adminService } = await import('../../../services/admin.service');
      const [healthData, metricsData] = await Promise.all([
        adminService.getDetailedHealth(),
        adminService.getRealtimeMetrics(),
      ]);

      if (mounted.current) {
        setHealth(healthData);
        setMetrics(metricsData);
        setLastUpdate(new Date());
        setLoading(false);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, []);

  // Start HTTP polling fallback
  const startPolling = useCallback(() => {
    if (pollingInterval.current) return;

    console.log('[useMetricsSocket] Starting HTTP polling fallback');
    fetchMetricsHttp(); // Initial fetch
    pollingInterval.current = setInterval(fetchMetricsHttp, 15000);
  }, [fetchMetricsHttp]);

  // Stop HTTP polling
  const stopPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    try {
      setLoading(true);
      await metricsSocket.connect();
    } catch (err) {
      console.error('[useMetricsSocket] Failed to connect:', err.message);
      setError(err.message);

      if (fallbackToPolling) {
        message.info('Using HTTP polling for metrics updates');
        startPolling();
      }
    }
  }, [fallbackToPolling, startPolling]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    metricsSocket.disconnect();
    stopPolling();
  }, [stopPolling]);

  // Manual refresh
  const refresh = useCallback(() => {
    if (connected) {
      metricsSocket.refreshMetrics();
    } else {
      fetchMetricsHttp();
    }
  }, [connected, fetchMetricsHttp]);

  // Setup effect
  useEffect(() => {
    mounted.current = true;

    // Handle metrics updates
    const unsubMetrics = metricsSocket.on('metricsUpdate', (data) => {
      if (mounted.current) {
        setHealth(data.health);
        setMetrics(data.metrics);
        setLastUpdate(new Date(data.timestamp));
        setLoading(false);
        setError(null);
      }
    });

    // Handle quick metrics (CPU/Memory only)
    const unsubQuick = metricsSocket.on('quickMetrics', (data) => {
      if (mounted.current) {
        setMetrics((prev) => ({
          ...prev,
          cpu: { ...prev?.cpu, usage: data.cpu },
          memory: { ...prev?.memory, usagePercent: data.memory },
          application: { ...prev?.application, uptime: data.uptime },
        }));
        setLastUpdate(new Date(data.timestamp));
      }
    });

    // Handle connection changes
    const unsubConnection = metricsSocket.on('connectionChange', ({ connected: isConnected, error: connError }) => {
      if (mounted.current) {
        setConnected(isConnected);

        if (!isConnected && fallbackToPolling) {
          startPolling();
        } else if (isConnected) {
          stopPolling();
        }

        if (connError) {
          setError(connError);
        }
      }
    });

    // Handle service alerts
    const unsubAlert = metricsSocket.on('serviceAlert', (data) => {
      if (mounted.current) {
        const alertType = data.status === 'down' ? 'error' : 'success';
        message[alertType](`${data.service} is ${data.status.toUpperCase()}`);

        // Update health with new service status
        setHealth((prev) => {
          if (!prev) return prev;
          const serviceKey = data.service.toLowerCase();
          if (prev.services && prev.services[serviceKey]) {
            return {
              ...prev,
              services: {
                ...prev.services,
                [serviceKey]: {
                  ...prev.services[serviceKey],
                  status: data.status,
                },
              },
            };
          }
          return prev;
        });
      }
    });

    // Handle session updates
    const unsubSession = metricsSocket.on('sessionUpdate', (data) => {
      if (mounted.current) {
        setSessionStats(data.stats);
        // Show notification for session terminations
        if (data.action === 'terminated') {
          message.info('Session activity updated');
        }
      }
    });

    // Handle errors
    const unsubError = metricsSocket.on('error', (err) => {
      if (mounted.current) {
        setError(err.message || 'WebSocket error');
      }
    });

    // Auto-connect if enabled
    if (autoConnect) {
      connect();
    }

    // Cleanup
    return () => {
      mounted.current = false;
      unsubMetrics();
      unsubQuick();
      unsubConnection();
      unsubAlert();
      unsubSession();
      unsubError();
      disconnect();
    };
  }, [autoConnect, connect, disconnect, fallbackToPolling, startPolling, stopPolling]);

  // Refresh sessions via WebSocket
  const refreshSessions = useCallback(() => {
    if (connected) {
      metricsSocket.refreshSessions();
    }
  }, [connected]);

  return {
    health,
    metrics,
    sessionStats,
    connected,
    loading,
    error,
    lastUpdate,
    refresh,
    refreshSessions,
    connect,
    disconnect,
  };
};

export default useMetricsSocket;
