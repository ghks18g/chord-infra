'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface WsEvent<T = any> {
  type: 'new_transaction' | 'new_block' | 'network_stats' | 'connected' | 'pong';
  data?: T;
  timestamp: string;
}

export function useChordWebSocket(onMessage?: (event: WsEvent) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    let wsUrl: string;
    if (process.env.NEXT_PUBLIC_WS_URL) {
      wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    } else {
      const isHttps = window.location.protocol === 'https:';
      const wsProto = isHttps ? 'wss:' : 'ws:';
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        wsUrl = `${wsProto}//${window.location.hostname}:3002/ws`;
      } else {
        wsUrl = `${wsProto}//${window.location.host}/ws`;
      }
    }

    try {
      if (wsRef.current) {
        wsRef.current.close();
      }

      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const parsed: WsEvent = JSON.parse(event.data);
          setLastMessage(parsed);
          if (onMessageRef.current) {
            onMessageRef.current(parsed);
          }
        } catch {
          // ignore invalid json
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected, lastMessage };
}
