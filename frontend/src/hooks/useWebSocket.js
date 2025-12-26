import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';

// Get socket URL - strip /api suffix if present
const getSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000';
  return apiUrl.replace(/\/api\/?$/, '');
};
const SOCKET_URL = getSocketUrl();

// Singleton socket instance and state
let sharedSocket = null;
let connectionCount = 0;
let currentToken = null;

/**
 * Base WebSocket hook for shared socket connection
 * Uses singleton pattern to maintain one connection across components
 * Each hook instance registers its own connection state handlers
 */
export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(() => sharedSocket?.connected ?? false);
  const [connectionError, setConnectionError] = useState(null);

  // Track handlers registered by this hook instance - use array to support multiple handlers per event
  const eventHandlersRef = useRef([]);
  const mountedRef = useRef(true);

  // Get auth token from Redux store
  const { token } = useSelector((state) => state.auth);

  // Initialize or reuse socket connection
  useEffect(() => {
    mountedRef.current = true;

    if (!token) {
      // No token, disconnect if connected and no other consumers
      if (sharedSocket && connectionCount === 0) {
        sharedSocket.disconnect();
        sharedSocket = null;
        currentToken = null;
      }
      setIsConnected(false);
      return;
    }

    connectionCount++;

    // Check if token changed - need to reconnect with new token
    const tokenChanged = currentToken && currentToken !== token;

    // Create shared socket if not exists or token changed
    if (!sharedSocket || tokenChanged) {
      // Disconnect old socket if token changed
      if (sharedSocket && tokenChanged) {
        sharedSocket.disconnect();
        sharedSocket = null;
      }

      currentToken = token;

      sharedSocket = io(SOCKET_URL, {
        auth: { token },
        query: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        forceNew: false,
      });

      // Global error handler (only once per socket)
      sharedSocket.on('error', (error) => {
        console.error('[WebSocket] Error:', error);
      });
    } else {
      // Socket exists with same token
      sharedSocket.auth = { token };
      if (!sharedSocket.connected) {
        sharedSocket.connect();
      }
    }

    // Each hook instance registers its own connection state handlers
    const handleConnect = () => {
      if (mountedRef.current) {
        setIsConnected(true);
        setConnectionError(null);
      }
    };

    const handleDisconnect = () => {
      if (mountedRef.current) {
        setIsConnected(false);
      }
    };

    const handleConnectError = (error) => {
      if (mountedRef.current) {
        setIsConnected(false);
        setConnectionError(error.message);
      }
    };

    const handleReconnect = () => {
      if (mountedRef.current) {
        setIsConnected(true);
        setConnectionError(null);
      }
    };

    // Register this instance's handlers
    sharedSocket.on('connect', handleConnect);
    sharedSocket.on('disconnect', handleDisconnect);
    sharedSocket.on('connect_error', handleConnectError);
    sharedSocket.io.on('reconnect', handleReconnect);

    // Sync initial state
    if (sharedSocket.connected) {
      setIsConnected(true);
    }

    // Cleanup on unmount or token change
    return () => {
      mountedRef.current = false;
      connectionCount = Math.max(0, connectionCount - 1); // Prevent negative count

      // Remove this instance's connection state handlers
      if (sharedSocket) {
        sharedSocket.off('connect', handleConnect);
        sharedSocket.off('disconnect', handleDisconnect);
        sharedSocket.off('connect_error', handleConnectError);
        sharedSocket.io?.off('reconnect', handleReconnect);
      }

      // Clean up event handlers registered by this component
      for (const { event, handler } of eventHandlersRef.current) {
        sharedSocket?.off(event, handler);
      }
      eventHandlersRef.current = [];

      // Disconnect if no more consumers
      if (connectionCount === 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        currentToken = null;
      }
    };
  }, [token]);

  // Handle visibility change - reconnect when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && sharedSocket && !sharedSocket.connected && currentToken) {
        sharedSocket.connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  /**
   * Subscribe to a WebSocket event
   * Supports multiple handlers for the same event
   */
  const on = useCallback((event, handler) => {
    if (sharedSocket) {
      sharedSocket.on(event, handler);
      eventHandlersRef.current.push({ event, handler });
    }
  }, []);

  /**
   * Unsubscribe from a WebSocket event
   */
  const off = useCallback((event, handler) => {
    if (sharedSocket) {
      sharedSocket.off(event, handler);
      eventHandlersRef.current = eventHandlersRef.current.filter(
        (h) => !(h.event === event && h.handler === handler)
      );
    }
  }, []);

  /**
   * Emit an event to the server
   */
  const emit = useCallback((event, data) => {
    if (sharedSocket?.connected) {
      sharedSocket.emit(event, data);
      return true;
    }
    return false;
  }, []);

  /**
   * Get the socket instance (for advanced usage)
   */
  const getSocket = useCallback(() => sharedSocket, []);

  return {
    isConnected,
    connectionError,
    on,
    off,
    emit,
    getSocket,
  };
};

export default useWebSocket;
