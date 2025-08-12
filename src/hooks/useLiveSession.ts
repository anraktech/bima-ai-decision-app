import { useState, useEffect, useRef, useCallback } from 'react';
import type { Message } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface UseLiveSessionProps {
  conversationId?: string;
  isHost?: boolean;
  predefinedToken?: string;
}

export const useLiveSession = ({ conversationId, isHost = false, predefinedToken }: UseLiveSessionProps) => {
  const [shareCode, setShareCode] = useState<string | null>(predefinedToken || null);
  const [isConnected, setIsConnected] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { user } = useAuth();

  // Update shareCode if predefined token changes
  useEffect(() => {
    if (predefinedToken && !shareCode) {
      setShareCode(predefinedToken);
    }
  }, [predefinedToken, shareCode]);

  // Start a live session (host only)
  const startLiveSession = useCallback(() => {
    if (!conversationId || !user || !isHost) return;

    const ws = new WebSocket('ws://localhost:3001/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({
        type: 'start_live_session',
        conversationId,
        userId: user.id,
        predefinedToken
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'session_started':
          setShareCode(data.shareCode);
          console.log('Live session started with code:', data.shareCode);
          break;
        case 'viewer_joined':
          setViewerCount(data.viewerCount);
          break;
        case 'viewer_left':
          setViewerCount(data.viewerCount);
          break;
        case 'error':
          setError(data.message);
          break;
      }
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setShareCode(null);
      setViewerCount(0);
    };
  }, [conversationId, user, isHost, predefinedToken]);

  // Join a live session (viewer only)
  const joinLiveSession = useCallback((code: string) => {
    const ws = new WebSocket('ws://localhost:3001/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({
        type: 'join_live_session',
        shareCode: code
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'session_joined':
          setShareCode(code);
          break;
        case 'new_message':
          // Handle incoming messages - this would trigger a callback
          break;
        case 'session_ended':
          setError(data.reason || 'Session ended');
          ws.close();
          break;
        case 'error':
          setError(data.message);
          break;
      }
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setShareCode(null);
    };
  }, []);

  // Broadcast a message to viewers (host only)
  const broadcastMessage = useCallback((message: Message) => {
    if (!wsRef.current || !isHost || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      type: 'broadcast_message',
      message
    }));
  }, [isHost]);

  // End the live session (host only)
  const endLiveSession = useCallback(() => {
    if (!wsRef.current || !isHost) return;

    wsRef.current.send(JSON.stringify({
      type: 'end_live_session'
    }));
    
    wsRef.current.close();
    wsRef.current = null;
    setShareCode(null);
    setIsConnected(false);
    setViewerCount(0);
  }, [isHost]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    shareCode,
    isConnected,
    viewerCount,
    error,
    startLiveSession,
    joinLiveSession,
    broadcastMessage,
    endLiveSession
  };
};