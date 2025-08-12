import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppState } from '../hooks/useAppState';
import { API_URL, getApiUrl, getWsUrl } from '../config/api';
import { 
  MessageSquare, 
  Send, 
  Users, 
  Radio, 
  ArrowLeft,
  Crown,
  User,
  Bot,
  Clock,
  X,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import type { Message } from '../types';
import { formatTimestamp } from '../utils';

interface MultiplayerParticipant {
  id: string;
  name: string;
  role: 'host' | 'participant' | 'observer';
  isActive: boolean;
  lastActivity: Date;
}

interface MultiplayerMessage extends Message {
  authorId?: string;
  authorName?: string;
  authorRole?: string;
}

export function MultiplayerConversation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state: appState, actions } = useAppState();
  
  const [messages, setMessages] = useState<MultiplayerMessage[]>([]);
  const [participants, setParticipants] = useState<MultiplayerParticipant[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [sessionPin, setSessionPin] = useState('');
  const [interventionText, setInterventionText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [currentTurn, setCurrentTurn] = useState<'model-a' | 'model-b'>('model-a');
  const [isWaitingForIntervention, setIsWaitingForIntervention] = useState(false);
  const [interventionMode, setInterventionMode] = useState<'host-only' | 'all-participants' | 'vote-based'>('host-only');
  
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Get session info from navigation state
    const sessionData = location.state as any;
    if (!sessionData?.sessionPin) {
      navigate('/multiplayer');
      return;
    }
    
    setSessionPin(sessionData.sessionPin);
    setIsHost(sessionData.multiplayerSession?.hostId === user?.id?.toString());
    
    // Connect to WebSocket
    connectWebSocket(sessionData.sessionPin);
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  const connectWebSocket = (pin: string) => {
    const ws = new WebSocket('${getWsUrl()}/ws');
    
    ws.onopen = () => {
      setIsConnected(true);
      console.log('Connected to multiplayer session');
      
      // Re-join the session
      ws.send(JSON.stringify({
        type: 'rejoin_multiplayer_session',
        pin: pin,
        participantId: user?.id || `guest_${Date.now()}`,
        participantName: user?.name || 'Anonymous'
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received:', data);
      
      switch (data.type) {
        case 'multiplayer_message':
          const newMessage: MultiplayerMessage = {
            id: crypto.randomUUID(),
            content: data.message.content,
            sender: data.message.sender,
            timestamp: new Date(data.message.timestamp),
            authorId: data.senderId,
            authorName: data.senderName
          };
          setMessages(prev => [...prev, newMessage]);
          
          // Check if intervention is needed
          if ((messages.length + 1) % 10 === 0) {
            setIsWaitingForIntervention(true);
          }
          break;
          
        case 'participant_update':
          setParticipants(data.participants);
          break;
          
        case 'intervention_submitted':
          setIsWaitingForIntervention(false);
          const interventionMsg: MultiplayerMessage = {
            id: crypto.randomUUID(),
            content: data.content,
            sender: data.targetAgent,
            timestamp: new Date(),
            authorId: data.authorId,
            authorName: data.authorName,
            authorRole: data.authorRole
          };
          setMessages(prev => [...prev, interventionMsg]);
          setCurrentTurn(data.targetAgent === 'model-a' ? 'model-b' : 'model-a');
          break;
          
        case 'session_ended':
          alert('Session ended: ' + data.reason);
          navigate('/multiplayer');
          break;
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
    
    ws.onclose = () => {
      setIsConnected(false);
      console.log('Disconnected from session');
    };
    
    wsRef.current = ws;
  };
  
  const broadcastMessage = (message: Message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'broadcast_multiplayer_message',
        pin: sessionPin,
        message: message,
        senderId: user?.id,
        senderName: user?.name
      }));
    }
  };
  
  const submitIntervention = () => {
    if (!interventionText.trim()) return;
    
    // Check if user has permission
    if (interventionMode === 'host-only' && !isHost) {
      alert('Only the host can submit interventions');
      return;
    }
    
    const interventionMessage: Message = {
      id: crypto.randomUUID(),
      content: interventionText,
      sender: currentTurn,
      timestamp: new Date()
    };
    
    // Broadcast to all participants
    broadcastMessage(interventionMessage);
    
    // Add locally
    setMessages(prev => [...prev, {
      ...interventionMessage,
      authorId: user?.id,
      authorName: user?.name,
      authorRole: isHost ? 'Host' : 'Participant'
    }]);
    
    setInterventionText('');
    setIsWaitingForIntervention(false);
    
    // Switch turn
    setCurrentTurn(currentTurn === 'model-a' ? 'model-b' : 'model-a');
  };
  
  const leaveSession = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    navigate('/multiplayer');
  };
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const getMessageStyles = (sender: string) => {
    switch (sender) {
      case 'model-a':
        return {
          bg: 'bg-blue-50',
          border: 'border-l-4 border-l-blue-500',
          text: 'text-gray-900',
          icon: <Bot className="w-4 h-4 text-blue-600" />
        };
      case 'model-b':
        return {
          bg: 'bg-red-50',
          border: 'border-l-4 border-l-red-500',
          text: 'text-gray-900',
          icon: <Bot className="w-4 h-4 text-red-600" />
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-l-4 border-l-gray-400',
          text: 'text-gray-900',
          icon: <MessageSquare className="w-4 h-4 text-gray-600" />
        };
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={leaveSession}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Leave</span>
              </button>
              
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                <h1 className="text-xl font-bold text-gray-900">Multiplayer Conversation</h1>
                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                  PIN: {sessionPin}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  {participants.length} Participants
                </span>
              </div>
              
              {isHost && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-orange-100 rounded-full">
                  <Crown className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-700">Host</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-4 gap-6">
          {/* Main Conversation Area */}
          <div className="col-span-3">
            <div className="bg-white rounded-lg shadow-sm">
              {/* Messages */}
              <div className="p-6 max-h-[600px] overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Waiting for conversation to start...</p>
                    {isHost && (
                      <p className="text-sm text-gray-500 mt-2">
                        Configure your AI models and start the conversation
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const styles = getMessageStyles(message.sender);
                      
                      return (
                        <div key={message.id} className={`${styles.bg} ${styles.border} p-4 rounded-r-lg`}>
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center flex-shrink-0">
                              {styles.icon}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="font-semibold text-sm">
                                    {message.sender === 'model-a' ? 'Primary Agent' : 
                                     message.sender === 'model-b' ? 'Alternative Agent' : 
                                     'Unknown'}
                                  </span>
                                  {message.authorName && (
                                    <span className="text-xs text-gray-500">
                                      (via {message.authorName} {message.authorRole ? `- ${message.authorRole}` : ''})
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500">
                                  {formatTimestamp(message.timestamp)}
                                </span>
                              </div>
                              <p className={`${styles.text} text-sm leading-relaxed`}>
                                {message.content}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
              
              {/* Intervention Panel */}
              {isWaitingForIntervention && (
                <div className="border-t border-gray-200 p-6 bg-amber-50">
                  <div className="flex items-center space-x-2 mb-4">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <span className="font-medium text-amber-800">Intervention Point Reached</span>
                    <span className="text-sm text-amber-600">({messages.length} messages)</span>
                  </div>
                  
                  {(interventionMode === 'all-participants' || (interventionMode === 'host-only' && isHost)) ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Intervention as {currentTurn === 'model-a' ? 'Primary Agent' : 'Alternative Agent'}:
                        </label>
                        <textarea
                          value={interventionText}
                          onChange={(e) => setInterventionText(e.target.value)}
                          placeholder="Enter your intervention message..."
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-orange-500"
                          rows={3}
                        />
                      </div>
                      
                      <div className="flex justify-end space-x-3">
                        <button
                          onClick={() => setIsWaitingForIntervention(false)}
                          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          Skip
                        </button>
                        <button
                          onClick={submitIntervention}
                          disabled={!interventionText.trim()}
                          className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          <Send className="w-4 h-4" />
                          <span>Submit</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-amber-700">
                      <Clock className="w-5 h-5" />
                      <span>Waiting for host to submit intervention...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Participants Sidebar */}
          <div className="col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Participants</span>
              </h3>
              
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      participant.role === 'host' 
                        ? 'bg-orange-100' 
                        : 'bg-gray-100'
                    }`}>
                      {participant.role === 'host' ? (
                        <Crown className="w-4 h-4 text-orange-600" />
                      ) : (
                        <User className="w-4 h-4 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{participant.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{participant.role}</p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      participant.isActive ? 'bg-green-500' : 'bg-gray-400'
                    }`}></div>
                  </div>
                ))}
              </div>
              
              {/* Session Info */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Session Settings</h4>
                <div className="space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Intervention Mode:</span>
                    <span className="font-medium capitalize">
                      {interventionMode.replace('-', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Messages:</span>
                    <span className="font-medium">{messages.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}