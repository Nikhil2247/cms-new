import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const WS_NAMESPACE = '/ws';

// Singleton socket instance
let sharedSocket = null;
let connectionCount = 0;

/**
 * Base WebSocket hook for shared socket connection
 * Uses singleton pattern to maintain one connection across components
 */
export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const eventHandlersRef = useRef(new Map());

  // Get auth token from Redux store
  const { token } = useSelector((state) => state.auth);

  // Initialize or reuse socket connection
  useEffect(() => {
    if (!token) {
      // No token, disconnect if connected
      if (sharedSocket && connectionCount === 0) {
        sharedSocket.disconnect();
        sharedSocket = null;
      }
      setIsConnected(false);
      return;
    }

    connectionCount++;

    // Create shared socket if not exists
    if (!sharedSocket) {
      sharedSocket = io(`${SOCKET_URL}${WS_NAMESPACE}`, {
        auth: { token },
        query: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      // Connection events
      sharedSocket.on('connect', () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
      });

      sharedSocket.on('connected', (data) => {
        console.log('WebSocket handshake complete:', data);
      });

      sharedSocket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        setIsConnected(false);
      });

      sharedSocket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error.message);
        setIsConnected(false);
        setConnectionError(error.message);
      });

      sharedSocket.on('error', (error) => {
        console.error('WebSocket error:', error);
        setConnectionError(error.message || 'Unknown error');
      });
    } else {
      // Update auth if token changed
      sharedSocket.auth = { token };
      if (!sharedSocket.connected) {
        sharedSocket.connect();
      } else {
        setIsConnected(true);
      }
    }

    // Cleanup on unmount
    return () => {
      connectionCount--;

      // Clean up event handlers registered by this component
      for (const [event, handler] of eventHandlersRef.current) {
        sharedSocket?.off(event, handler);
      }
      eventHandlersRef.current.clear();

      // Disconnect if no more consumers
      if (connectionCount === 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
      }
    };
  }, [token]);

  // Handle visibility change - reconnect when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && sharedSocket && !sharedSocket.connected) {
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
   */
  const on = useCallback((event, handler) => {
    if (sharedSocket) {
      sharedSocket.on(event, handler);
      eventHandlersRef.current.set(event, handler);
    }
  }, []);

  /**
   * Unsubscribe from a WebSocket event
   */
  const off = useCallback((event, handler) => {
    if (sharedSocket) {
      sharedSocket.off(event, handler);
      eventHandlersRef.current.delete(event);
    }
  }, []);

  /**
   * Emit an event to the server
   */
  const emit = useCallback((event, data) => {
    if (sharedSocket?.connected) {
      sharedSocket.emit(event, data);
    }
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
