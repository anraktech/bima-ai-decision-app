import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Radio, Users, Eye, MessageSquare, Bot, User, ArrowLeft, AlertCircle } from 'lucide-react';
import type { Message } from '../types';
import { formatTimestamp } from '../utils';

export function LiveViewer() {
  const navigate = useNavigate();
  const { shareCode } = useParams<{ shareCode: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{
    conversationId: string;
    title?: string;
    viewerCount: number;
  } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shareCode) {
      setError('Invalid share code');
      return;
    }

    const ws = new WebSocket('ws://localhost:3001/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected, attempting to join session');
      setIsConnecting(false);
      setIsConnected(true);
      setError(null);
      ws.send(JSON.stringify({
        type: 'join_live_session',
        shareCode: shareCode.toUpperCase()
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('LiveViewer received message:', data);
      
      switch (data.type) {
        case 'session_joined':
          console.log('Successfully joined session:', data.conversationId);
          setIsConnecting(false);
          setIsConnected(true);
          setSessionInfo({
            conversationId: data.conversationId,
            title: data.title || 'Live AI Conversation',
            viewerCount: data.viewerCount || 0
          });
          // Optionally fetch conversation history here
          break;
        
        case 'new_message':
          console.log('New message received:', data.message);
          setMessages(prev => [...prev, data.message]);
          break;
        
        case 'session_ended':
          setError(data.reason || 'The live session has ended');
          setIsConnected(false);
          break;
        
        case 'error':
          console.error('Session error:', data.message);
          setError(data.message);
          setIsConnected(false);
          setIsConnecting(false);
          break;
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection error. Please check your network and try again.');
      setIsConnected(false);
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setIsConnected(false);
      if (!error && event.code !== 1000) {
        setError('Connection lost. Please try refreshing the page.');
      }
    };

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [shareCode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getMessageStyles = (sender: Message['sender']) => {
    switch (sender) {
      case 'model-a':
        return {
          bg: 'bg-blue-50',
          border: 'border-l-4 border-l-blue-500',
          text: 'text-black',
          accent: 'text-blue-600',
          icon: <Bot className="w-4 h-4" />
        };
      case 'model-b':
        return {
          bg: 'bg-red-50',
          border: 'border-l-4 border-l-red-500',
          text: 'text-black',
          accent: 'text-red-600',
          icon: <Bot className="w-4 h-4" />
        };
      case 'user':
        return {
          bg: 'bg-indigo-50',
          border: 'border-l-4 border-l-indigo-500',
          text: 'text-black',
          accent: 'text-indigo-600',
          icon: <User className="w-4 h-4" />
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-l-4 border-l-gray-300',
          text: 'text-black',
          accent: 'text-gray-600',
          icon: <MessageSquare className="w-4 h-4" />
        };
    }
  };

  const getSenderInfo = (sender: Message['sender']) => {
    switch (sender) {
      case 'model-a':
        return {
          name: 'Primary Agent',
          badge: 'Primary',
          badgeColor: 'bg-blue-100 text-blue-800'
        };
      case 'model-b':
        return {
          name: 'Alternative Agent',
          badge: 'Alternative',
          badgeColor: 'bg-red-100 text-red-800'
        };
      case 'user':
        return {
          name: 'Human Intervention',
          badge: 'Moderator',
          badgeColor: 'bg-indigo-100 text-indigo-800'
        };
      default:
        return {
          name: 'Unknown',
          badge: '',
          badgeColor: ''
        };
    }
  };

  if (error && !isConnecting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white border border-red-200 rounded-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Session Unavailable</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex space-x-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2 text-orange-600 border border-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 px-4 py-2 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                  <Radio className="w-6 h-6 text-white animate-pulse" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {sessionInfo?.title || 'Live AI Conversation'}
                  </h1>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Radio className="w-4 h-4 text-orange-600" />
                      <span>Live</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Eye className="w-4 h-4" />
                      <span>View Only</span>
                    </div>
                    {sessionInfo && (
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4" />
                        <span>{sessionInfo.viewerCount} viewers</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
              <span className="text-sm font-medium text-orange-900">Code:</span>
              <code className="text-sm font-mono text-orange-700">{shareCode}</code>
            </div>
          </div>
        </div>
      </div>

      {/* Live Indicator Banner */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-2">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-center space-x-2 text-sm font-medium">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>
              {isConnected 
                ? 'You are watching a live AI conversation' 
                : 'Connecting to live session...'
              }
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Live Conversation</h3>
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <div className="flex items-center space-x-1 text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium">Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1 text-gray-600">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="text-xs font-medium">Disconnected</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="h-[600px] overflow-y-auto">
            <div className="p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-20">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {isConnecting 
                      ? 'Connecting to live session...' 
                      : isConnected 
                      ? 'Waiting for the conversation to begin...' 
                      : 'Connection failed. Please try again.'
                    }
                  </p>
                  {isConnecting && (
                    <div className="mt-4 w-6 h-6 border-2 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  )}
                </div>
              ) : (
                messages.map((message) => {
                  const styles = getMessageStyles(message.sender);
                  const info = getSenderInfo(message.sender);
                  
                  return (
                    <div key={message.id} className="transition-opacity duration-200 animate-in fade-in slide-in-from-bottom-2">
                      <div className={`${styles.bg} ${styles.border} p-4 rounded-r-lg`}>
                        <div className="flex items-start space-x-3">
                          <div className={`w-8 h-8 rounded-full ${styles.accent} bg-white border-2 flex items-center justify-center flex-shrink-0`}>
                            {styles.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <span className="text-sm font-semibold text-black">{info.name}</span>
                                {info.badge && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.badgeColor}`}>
                                    {info.badge}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-500">
                                {formatTimestamp(message.timestamp)}
                              </span>
                            </div>
                            <p className={`${styles.text} text-sm leading-relaxed whitespace-pre-wrap`}>
                              {message.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}