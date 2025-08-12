import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_URL, getApiUrl, getWsUrl } from '../config/api';
import { 
  MessageSquare, 
  Send, 
  Users, 
  ArrowLeft,
  User,
  Bot,
  Clock,
  MessageCircle,
  Wifi,
  WifiOff
} from 'lucide-react';
import { formatTimestamp } from '../utils';

interface ViewerMessage {
  id: string;
  type: 'ai' | 'intervention' | 'system';
  content: string;
  sender: 'model-a' | 'model-b' | 'host' | 'system';
  timestamp: Date;
  authorName?: string;
}

interface ChatMessage {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  timestamp: Date;
}

export function MultiplayerViewer() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<ViewerMessage[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'waiting' | 'active' | 'ended'>('waiting');
  const [exchangeCount, setExchangeCount] = useState(0);
  const [participantCount, setParticipantCount] = useState(0);
  const [newChatMessage, setNewChatMessage] = useState('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  
  const sessionData = location.state?.sessionData;
  
  useEffect(() => {
    if (!sessionData) {
      navigate('/multiplayer');
      return;
    }
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  const connectWebSocket = () => {
    const ws = new WebSocket('${getWsUrl()}/ws');
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('Viewer connected to WebSocket');
      setIsConnected(true);
      
      // Join as viewer
      ws.send(JSON.stringify({
        type: 'join_viewer_session',
        pin: sessionData.pin,
        participantId: user?.id,
        participantName: user?.name
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Viewer received:', data.type);
      
      switch (data.type) {
        case 'viewer_joined':
          console.log('Viewer joined, received data:', data);
          // Receive current state and existing messages
          if (data.messages && data.messages.length > 0) {
            const formattedMessages = data.messages.map((msg: any) => ({
              id: `msg-${Date.now()}-${Math.random()}`,
              type: msg.type || 'ai',
              content: msg.content,
              sender: msg.sender,
              timestamp: new Date(msg.timestamp),
              authorName: msg.authorName
            }));
            setMessages(formattedMessages);
          }
          if (data.status) {
            setSessionStatus(data.status);
          }
          if (data.exchangeCount !== undefined) {
            setExchangeCount(data.exchangeCount);
          }
          if (data.participantCount) {
            setParticipantCount(data.participantCount);
          }
          break;
          
        case 'arena_message_update':
          if (data.message) {
            setMessages(prev => [...prev, {
              id: `msg-${Date.now()}`,
              type: 'ai',
              content: data.message.content,
              sender: data.message.sender,
              timestamp: new Date()
            }]);
          }
          if (data.exchangeCount !== undefined) {
            setExchangeCount(data.exchangeCount);
          }
          setSessionStatus('active');
          break;
          
        case 'arena_intervention':
          setMessages(prev => [...prev, {
            id: `intervention-${Date.now()}`,
            type: 'intervention',
            content: data.content,
            sender: 'host',
            timestamp: new Date(),
            authorName: data.authorName
          }]);
          break;
          
        case 'arena_chat_message':
          setChatMessages(prev => [...prev, {
            id: `chat-${Date.now()}`,
            content: data.content,
            authorId: data.authorId,
            authorName: data.authorName,
            timestamp: new Date()
          }]);
          break;
          
        case 'arena_status_change':
          setSessionStatus(data.status);
          break;
          
        case 'participant_count_update':
          setParticipantCount(data.count);
          break;
      }
    };
    
    ws.onclose = () => {
      console.log('Viewer WebSocket disconnected');
      setIsConnected(false);
      // Try to reconnect after 3 seconds
      setTimeout(() => {
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          connectWebSocket();
        }
      }, 3000);
    };
    
    ws.onerror = (error) => {
      console.error('Viewer WebSocket error:', error);
    };
  };
  
  const sendChatMessage = () => {
    if (!newChatMessage.trim() || !wsRef.current) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'arena_chat_message',
      pin: sessionData.pin,
      content: newChatMessage,
      authorId: user?.id,
      authorName: user?.name
    }));
    
    setNewChatMessage('');
  };
  
  // Auto-scroll effects
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);
  
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMessages]);
  
  const getStatusText = () => {
    if (!isConnected) return 'Connecting...';
    if (sessionStatus === 'waiting') return 'Waiting for host to start';
    if (sessionStatus === 'active') return 'Live';
    return 'Session Ended';
  };
  
  const getStatusColor = () => {
    if (!isConnected) return 'text-yellow-600';
    if (sessionStatus === 'active') return 'text-green-600';
    if (sessionStatus === 'ended') return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/multiplayer')}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors group"
            >
              <ArrowLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium">Leave Session</span>
            </button>
            
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-gray-900">
                Viewing AI Battle
              </h1>
              <div className="flex items-center space-x-2">
                <span className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-full text-sm font-mono font-semibold text-blue-700">
                  PIN: {sessionData.pin}
                </span>
                <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                  User: {user?.name} (ID: {user?.id})
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
            
            {/* Participants Count */}
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 rounded-lg">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                {participantCount} watching
              </span>
            </div>
            
            {/* Exchange Counter */}
            {sessionStatus === 'active' && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-50 rounded-lg">
                <MessageSquare className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-gray-700">
                  Exchanges: <span className="font-bold">{exchangeCount}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Models Info Bar */}
          {sessionData.setupData && (
            <div className="bg-white/95 backdrop-blur border-b border-gray-200 px-6 py-3">
              <div className="flex items-center justify-center space-x-8">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-semibold text-gray-800">
                    {sessionData.setupData.modelA?.name || 'Model A'}
                  </span>
                </div>
                
                <span className="text-gray-400 font-bold text-lg">VS</span>
                
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-semibold text-gray-800">
                    {sessionData.setupData.modelB?.name || 'Model B'}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {/* Messages Area */}
          <div 
            ref={messagesRef}
            className="flex-1 overflow-y-auto p-6 space-y-4"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Clock className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">Waiting for conversation to start...</p>
                <p className="text-sm mt-2">The host will begin the AI battle soon</p>
              </div>
            ) : (
              messages.map((message) => (
                <div 
                  key={message.id}
                  className={`flex ${message.type === 'system' ? 'justify-center' : 'justify-start'}`}
                >
                  {message.type === 'system' ? (
                    <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-sm">
                      {message.content}
                    </div>
                  ) : (
                    <div className="flex space-x-3 max-w-4xl">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        message.sender === 'model-a' ? 'bg-blue-500' :
                        message.sender === 'model-b' ? 'bg-orange-500' :
                        'bg-purple-500'
                      }`}>
                        <span className="text-white text-sm">
                          {message.sender === 'model-a' ? '🤖' :
                           message.sender === 'model-b' ? '🦾' : '👑'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-gray-900">
                            {message.sender === 'model-a' ? sessionData.setupData?.modelA?.name :
                             message.sender === 'model-b' ? sessionData.setupData?.modelB?.name :
                             message.authorName || 'Host'}
                          </span>
                          {message.type === 'intervention' && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                              Intervention
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(message.timestamp)}
                          </span>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                          <p className="text-gray-800 whitespace-pre-wrap">{message.content}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Chat Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Viewer Chat</h3>
          </div>
          
          <div 
            ref={chatRef}
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No messages yet</p>
              </div>
            ) : (
              chatMessages.map((message) => (
                <div key={message.id} className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-sm text-gray-700">
                      {message.authorName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-sm text-gray-800">{message.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newChatMessage}
                onChange={(e) => setNewChatMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
              />
              <button
                onClick={sendChatMessage}
                disabled={!newChatMessage.trim()}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}