import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { generateOpenAIResponse, OPENAI_MODELS } from '../services/openai';
import { generateAnthropicResponse, ANTHROPIC_MODELS } from '../services/anthropic';
import { generateGoogleResponse, GOOGLE_MODELS } from '../services/google';
import { generateGroqResponse, GROQ_MODELS } from '../services/groq';
import { generateXAIResponse, XAI_MODELS } from '../services/xai';
import { API_URL, getApiUrl, getWsUrl } from '../config/api';

// Perplexity removed - models not working properly
import { generateDeepseekResponse } from '../services/deepseek';
import { 
  MessageSquare, 
  Send, 
  Users, 
  ArrowLeft,
  Crown,
  User,
  Bot,
  Clock,
  X,
  ChevronRight,
  ChevronLeft,
  Zap,
  AlertCircle,
  CheckCircle,
  MessageCircle,
  MoreVertical
} from 'lucide-react';
import { formatTimestamp } from '../utils';

interface Participant {
  id: string;
  name: string;
  role: 'host' | 'participant' | 'observer';
  isActive: boolean;
  lastActivity: Date;
}

interface ArenaMessage {
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

interface ArenaState {
  pin: string;
  status: 'waiting' | 'active' | 'paused' | 'ended';
  currentTurn: 'model-a' | 'model-b';
  exchangeCount: number;
  isWaitingForIntervention: boolean;
  modelA?: { id: string; name: string };
  modelB?: { id: string; name: string };
  setupData?: any;
}

export function MultiplayerArena() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Core state
  const [arenaState, setArenaState] = useState<ArenaState>({
    pin: '',
    status: 'waiting',
    currentTurn: 'model-a',
    exchangeCount: 0,
    isWaitingForIntervention: false
  });
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [arenaMessages, setArenaMessages] = useState<ArenaMessage[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // UI state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [interventionText, setInterventionText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Conversation state
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [nextResponder, setNextResponder] = useState<'model-a' | 'model-b'>('model-b');
  
  // WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const arenaMessagesRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  
  // Get session data from location state
  const sessionData = location.state?.sessionData;
  
  useEffect(() => {
    console.log('MultiplayerArena mounted with sessionData:', sessionData);
    console.log('Current user:', user);
    
    if (!sessionData) {
      console.error('No sessionData, navigating back to multiplayer');
      navigate('/multiplayer');
      return;
    }
    
    initializeArena();
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  const initializeArena = () => {
    console.log('Initializing arena with sessionData:', sessionData);
    console.log('User info:', { userId: user?.id, userIdType: typeof user?.id });
    console.log('Host info:', { hostId: sessionData.hostId, hostIdType: typeof sessionData.hostId });
    
    setArenaState(prev => ({
      ...prev,
      pin: sessionData.pin,
      modelA: sessionData.setupData?.modelA,
      modelB: sessionData.setupData?.modelB,
      setupData: sessionData.setupData
    }));
    
    // Compare both as strings to handle type mismatches
    const isUserHost = String(sessionData.hostId) === String(user?.id);
    console.log('Host check:', { 
      hostId: sessionData.hostId, 
      userId: user?.id, 
      isHost: isUserHost,
      stringComparison: `"${String(sessionData.hostId)}" === "${String(user?.id)}"`
    });
    
    setIsHost(isUserHost);
    
    // Initialize participants with at least the host
    if (sessionData.participants && sessionData.participants.length > 0) {
      setParticipants(sessionData.participants.map((p: any) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        isActive: p.connectionStatus === 'connected',
        lastActivity: new Date(p.joinedAt || p.lastActivity)
      })));
    }
    
    // Initialize with system message
    setArenaMessages([{
      id: `system-${Date.now()}`,
      type: 'system',
      content: `AI Battle Arena initialized. ${sessionData.setupData?.modelA?.name} vs ${sessionData.setupData?.modelB?.name}`,
      sender: 'system',
      timestamp: new Date()
    }]);
  };
  
  const connectWebSocket = () => {
    try {
      // Close existing connection if any
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      
      const ws = new WebSocket('${getWsUrl()}/ws');
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('Connected to Arena WebSocket');
        setIsConnected(true);
        
        // Join the session - try both arena and regular session join
        ws.send(JSON.stringify({
          type: 'join_arena_session',
          pin: sessionData.pin,
          participantId: user?.id,
          participantName: user?.name
        }));
        
        // Also try regular multiplayer join for backward compatibility
        ws.send(JSON.stringify({
          type: 'rejoin_multiplayer_session',
          pin: sessionData.pin,
          participantId: user?.id,
          participantName: user?.name,
          isHost: String(sessionData.hostId) === String(user?.id)
        }));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };
      
      ws.onclose = (event) => {
        console.log('Arena WebSocket disconnected', event.code, event.reason);
        setIsConnected(false);
        
        // Only auto-reconnect if it wasn't a clean close (code 1000) and component is still mounted
        if (event.code !== 1000 && event.code !== 1001) {
          console.log('Attempting to reconnect in 3 seconds...');
          setTimeout(() => {
            if (wsRef.current?.readyState === WebSocket.CLOSED) {
              connectWebSocket();
            }
          }, 3000);
        }
      };
      
      ws.onerror = (error) => {
        console.error('Arena WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
    }
  };
  
  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'arena_participant_joined':
      case 'participant_joined': // Also handle messages from the old lobby system
        setParticipants(prev => {
          const participantData = data.participant || data;
          const existing = prev.find(p => p.id === participantData.id);
          if (existing) return prev;
          return [...prev, {
            id: participantData.id,
            name: participantData.name,
            role: participantData.role || (participantData.id === sessionData.hostId ? 'host' : 'participant'),
            isActive: true,
            lastActivity: new Date()
          }];
        });
        break;
        
      case 'arena_participant_left':
      case 'participant_left': // Also handle messages from the old lobby system
        setParticipants(prev => prev.filter(p => p.id !== data.participantId));
        break;
        
      case 'arena_participants_list':
        // Set the complete participants list when joining arena
        setParticipants(data.participants.map((p: any) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          isActive: p.isActive,
          lastActivity: new Date(p.lastActivity)
        })));
        break;
        
      case 'arena_message_update':
        // Add the received message to the arena
        if (data.message) {
          setArenaMessages(prev => [...prev, {
            id: `ai-${Date.now()}-${Math.random()}`,
            type: 'ai',
            content: data.message.content,
            sender: data.message.sender,
            timestamp: new Date(data.message.timestamp || Date.now())
          }]);
        }
        
        // Update arena state
        setArenaState(prev => ({
          ...prev,
          status: 'active',
          currentTurn: data.nextTurn,
          exchangeCount: data.exchangeCount,
          isWaitingForIntervention: data.waitingForIntervention || false
        }));
        
        // For non-host participants, mark conversation as active so they can see updates
        if (!isHost) {
          setIsConversationActive(true);
        }
        break;
        
      case 'arena_intervention':
        setArenaMessages(prev => [...prev, {
          id: `intervention-${Date.now()}`,
          type: 'intervention',
          content: data.content,
          sender: 'host',
          timestamp: new Date(),
          authorName: data.authorName
        }]);
        
        setArenaState(prev => ({
          ...prev,
          isWaitingForIntervention: false,
          exchangeCount: 0
        }));
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
        
      case 'arena_conversation_started':
        // Received when host starts the conversation
        console.log('Received arena_conversation_started:', data);
        // Update status to active for all participants
        setArenaState(prev => ({
          ...prev,
          status: 'active'
        }));
        // For non-host participants, mark conversation as active
        if (!isHost) {
          setIsConversationActive(true);
        }
        break;
        
      case 'arena_status_change':
        setArenaState(prev => ({
          ...prev,
          status: data.status
        }));
        // If status changed to active and we're not the host, activate conversation
        if (data.status === 'active' && !isHost) {
          setIsConversationActive(true);
        }
        break;
        
      case 'session_rejoined':
        console.log('Session rejoined with data:', data);
        // Update arena state with rejoined session info
        if (data.setupData) {
          setArenaState(prev => ({
            ...prev,
            status: data.status || 'waiting',
            setupData: data.setupData,
            modelA: data.setupData.modelA,
            modelB: data.setupData.modelB
          }));
        }
        
        // Update participants list
        if (data.participants) {
          setParticipants(data.participants.map((p: any) => ({
            id: p.id,
            name: p.name,
            role: p.role,
            isActive: p.connectionStatus === 'connected',
            lastActivity: new Date(p.joinedAt)
          })));
        }
        
        // Mark as connected
        setIsConnected(true);
        break;
        
      case 'error':
        console.error('Arena error:', data.message);
        break;
    }
  }, []);
  
  const sendIntervention = () => {
    if (!interventionText.trim() || !isHost || !wsRef.current) return;
    
    setIsLoading(true);
    
    // Create intervention message
    const interventionMessage: ArenaMessage = {
      id: `intervention-${Date.now()}`,
      type: 'intervention',
      content: interventionText,
      sender: 'host',
      timestamp: new Date(),
      authorName: user?.name
    };
    
    // Add to local messages
    setArenaMessages(prev => [...prev, interventionMessage]);
    
    // Reset intervention state
    setArenaState(prev => ({
      ...prev,
      isWaitingForIntervention: false,
      exchangeCount: 0
    }));
    
    // Broadcast intervention
    wsRef.current.send(JSON.stringify({
      type: 'arena_intervention',
      pin: arenaState.pin,
      content: interventionText,
      authorName: user?.name
    }));
    
    setInterventionText('');
    setIsLoading(false);
  };
  
  const sendChatMessage = () => {
    if (!newChatMessage.trim() || !wsRef.current) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'arena_chat_message',
      pin: arenaState.pin,
      content: newChatMessage,
      authorId: user?.id,
      authorName: user?.name
    }));
    
    setNewChatMessage('');
  };
  
  
  const endArena = () => {
    if (!isHost || !wsRef.current) return;
    if (!confirm('Are you sure you want to end this arena session?')) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'arena_control',
      pin: arenaState.pin,
      action: 'end'
    }));
    
    navigate('/multiplayer');
  };

  const startAIConversation = () => {
    console.log('Starting AI conversation...', { isHost, setupData: arenaState.setupData });
    
    if (!arenaState.setupData || !isHost) {
      console.error('Cannot start conversation:', { hasSetupData: !!arenaState.setupData, isHost });
      return;
    }
    
    const { initialPrompt, systemInstructionsA, systemInstructionsB, modelA, modelB } = arenaState.setupData;
    
    console.log('Setup data:', { modelA, modelB, initialPrompt });
    
    // Enhanced system instructions for AI-to-AI conversation
    const defaultSystemInstruction = "You are talking to another AI bot, you have to follow system instructions and give your best, listen carefully and answer confidently. Make your point come across forward and never feel shy to step up the conversation, your job is to make the conversation entertaining and flow, whatever topic and role you are assigned go deep, have no fear you have to act extremely professional, it should not come across that you are just an AI model. ";
    
    // Start conversation with model A
    const firstMessage: ArenaMessage = {
      id: `ai-${Date.now()}`,
      type: 'ai',
      content: initialPrompt,
      sender: 'model-a',
      timestamp: new Date()
    };
    
    console.log('Adding first message and starting conversation...');
    setArenaMessages(prev => [...prev, firstMessage]);
    setIsConversationActive(true);
    setNextResponder('model-b');
    setArenaState(prev => ({
      ...prev,
      status: 'active',
      exchangeCount: 1
    }));
    
    // Broadcast to all participants
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('Broadcasting conversation start to participants');
      // First broadcast the conversation start
      wsRef.current.send(JSON.stringify({
        type: 'arena_conversation_started',
        pin: arenaState.pin,
        message: firstMessage
      }));
      
      // Also send a status change to ensure all participants know the conversation is active
      wsRef.current.send(JSON.stringify({
        type: 'arena_status_change',
        pin: arenaState.pin,
        status: 'active'
      }));
    }
  };

  const generateAIResponse = async (responder: 'model-a' | 'model-b') => {
    console.log('generateAIResponse called for:', responder, { 
      hasSetupData: !!arenaState.setupData, 
      isActive: isConversationActive 
    });
    
    if (!arenaState.setupData || !isConversationActive) {
      console.error('Cannot generate response:', { 
        hasSetupData: !!arenaState.setupData, 
        isActive: isConversationActive 
      });
      return;
    }
    
    const { systemInstructionsA, systemInstructionsB, modelA, modelB } = arenaState.setupData;
    const activeModel = responder === 'model-a' ? modelA : modelB;
    const systemInstructions = responder === 'model-a' ? systemInstructionsA : systemInstructionsB;
    
    if (!activeModel) {
      console.error('No active model for responder:', responder);
      return;
    }
    
    console.log('Generating response with model:', activeModel);
    console.log('Model ID type:', typeof activeModel.id, 'Value:', activeModel.id);
    
    try {
      setIsLoading(true);
      
      // Prepare message history for AI context
      const messageHistory = arenaMessages
        .filter(msg => msg.type === 'ai' || msg.type === 'intervention')
        .map(msg => ({ 
          content: msg.content, 
          sender: msg.sender 
        }));
      
      const defaultSystemInstruction = "You are talking to another AI bot, you have to follow system instructions and give your best, listen carefully and answer confidently. Make your point come across forward and never feel shy to step up the conversation, your job is to make the conversation entertaining and flow, whatever topic and role you are assigned go deep, have no fear you have to act extremely professional, it should not come across that you are just an AI model. ";
      
      const fullSystemInstructions = systemInstructions + `\n\n${defaultSystemInstruction}`;
      
      let responseContent: string;
      const provider = activeModel?.provider || '';
      const modelId = typeof activeModel.id === 'string' ? activeModel.id : String(activeModel.id);
      
      console.log('Using model ID:', modelId, 'Provider:', provider);
      
      // Generate response based on provider
      if (provider === 'openai') {
        const response = await generateOpenAIResponse(
          modelId,
          fullSystemInstructions,
          messageHistory
        );
        responseContent = response.content;
      } else if (provider === 'anthropic') {
        const response = await generateAnthropicResponse(
          modelId,
          fullSystemInstructions,
          messageHistory
        );
        responseContent = response.content;
      } else if (provider === 'google') {
        const response = await generateGoogleResponse(
          modelId,
          fullSystemInstructions,
          messageHistory
        );
        responseContent = response.content;
      } else if (provider === 'groq') {
        const response = await generateGroqResponse(
          modelId,
          fullSystemInstructions,
          messageHistory
        );
        responseContent = response.content;
      } else if (provider === 'xai') {
        const response = await generateXAIResponse(
          modelId,
          fullSystemInstructions,
          messageHistory
        );
        responseContent = response.content;
      // Perplexity case removed - models not working properly
      } else if (provider === 'deepseek') {
        const response = await generateDeepseekResponse(
          modelId,
          fullSystemInstructions,
          messageHistory
        );
        responseContent = response.content;
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }
      
      // Create AI response message
      const aiMessage: ArenaMessage = {
        id: `ai-${Date.now()}`,
        type: 'ai',
        content: responseContent,
        sender: responder,
        timestamp: new Date()
      };
      
      // Add to local messages
      setArenaMessages(prev => [...prev, aiMessage]);
      
      // Update arena state
      setArenaState(prev => {
        const newExchangeCount = prev.exchangeCount + 1;
        return {
          ...prev,
          currentTurn: responder === 'model-a' ? 'model-b' : 'model-a',
          exchangeCount: newExchangeCount,
          isWaitingForIntervention: newExchangeCount % 10 === 0
        };
      });
      
      // Set next responder
      setNextResponder(responder === 'model-a' ? 'model-b' : 'model-a');
      
      // Broadcast to all participants
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'arena_message_update',
          pin: arenaState.pin,
          message: aiMessage,
          nextTurn: responder === 'model-a' ? 'model-b' : 'model-a',
          exchangeCount: arenaState.exchangeCount + 1,
          waitingForIntervention: (arenaState.exchangeCount + 1) % 10 === 0
        }));
      }
      
    } catch (error) {
      console.error('Error generating AI response:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Auto-scroll effects
  useEffect(() => {
    if (arenaMessagesRef.current) {
      arenaMessagesRef.current.scrollTop = arenaMessagesRef.current.scrollHeight;
    }
  }, [arenaMessages]);
  
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Auto-generate AI responses (only for host)
  useEffect(() => {
    console.log('Auto-response effect triggered', {
      isHost,
      isConversationActive,
      isWaitingForIntervention: arenaState.isWaitingForIntervention,
      isLoading,
      messageCount: arenaMessages.length,
      hasSetupData: !!arenaState.setupData
    });
    
    // Only host should generate AI responses
    if (!isHost) {
      console.log('Not host, skipping auto-response generation');
      return;
    }
    
    if (!isConversationActive || 
        arenaState.isWaitingForIntervention || 
        isLoading ||
        arenaMessages.length === 0) {
      console.log('Conditions not met for auto-response', {
        isConversationActive,
        isWaitingForIntervention: arenaState.isWaitingForIntervention,
        isLoading,
        messageCount: arenaMessages.length
      });
      return;
    }

    const lastMessage = arenaMessages[arenaMessages.length - 1];
    console.log('Last message:', lastMessage);
    
    // Skip if last message was from system
    if (lastMessage.type === 'system') {
      return;
    }
    
    // Determine next responder
    let shouldRespond = false;
    let responder: 'model-a' | 'model-b' = 'model-b';
    
    if (lastMessage.sender === 'model-a') {
      shouldRespond = true;
      responder = 'model-b';
    } else if (lastMessage.sender === 'model-b') {
      shouldRespond = true;
      responder = 'model-a';
    } else if (lastMessage.sender === 'host') {
      // After intervention, continue with the next responder
      shouldRespond = true;
      responder = nextResponder;
    }
    
    if (shouldRespond && !isLoading) {
      // Add delay for natural conversation flow
      const timeout = setTimeout(() => {
        generateAIResponse(responder);
      }, 2000);
      
      return () => clearTimeout(timeout);
    }
  }, [arenaMessages, isConversationActive, arenaState.isWaitingForIntervention, isLoading, nextResponder, isHost, arenaState.setupData]);
  
  const getModelIcon = (sender: string) => {
    if (sender === 'model-a') return '🤖';
    if (sender === 'model-b') return '🦾';
    if (sender === 'host') return '👑';
    return '⚡';
  };
  
  const getModelColor = (sender: string) => {
    if (sender === 'model-a') return 'bg-blue-500 text-white';
    if (sender === 'model-b') return 'bg-orange-500 text-white';
    if (sender === 'host') return 'bg-purple-500 text-white';
    return 'bg-gray-500 text-white';
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
              <span className="font-medium">Exit Arena</span>
            </button>
            
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-orange-500 animate-ping" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
                AI Battle Arena
              </h1>
              <span className="px-3 py-1.5 bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-full text-sm font-mono font-semibold text-orange-700">
                PIN: {arenaState.pin}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            {/* Participants Count */}
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>{participants.length} participants</span>
            </div>
            
            {/* Chat Toggle */}
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg transform hover:scale-105"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="font-medium">Chat</span>
              {chatMessages.length > 0 && (
                <span className="bg-white text-blue-600 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {chatMessages.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Main Arena */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${isChatOpen ? 'mr-80' : ''}`}>
          {/* Arena Status Bar */}
          <div className="bg-white/95 backdrop-blur border-b border-gray-200 px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                {/* Models */}
                <div className="flex items-center space-x-4">
                  <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-all ${arenaState.currentTurn === 'model-a' ? 'bg-blue-50 scale-105' : ''}`}>
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-semibold">{arenaState.modelA?.name || 'Model A'}</span>
                    {arenaState.currentTurn === 'model-a' && (
                      <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />
                    )}
                  </div>
                  
                  <span className="text-gray-400 font-bold text-lg">VS</span>
                  
                  <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-all ${arenaState.currentTurn === 'model-b' ? 'bg-orange-50 scale-105' : ''}`}>
                    <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-md">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-semibold">{arenaState.modelB?.name || 'Model B'}</span>
                    {arenaState.currentTurn === 'model-b' && (
                      <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />
                    )}
                  </div>
                </div>
                
                {/* Exchange Counter */}
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 rounded-lg">
                  <MessageSquare className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Exchanges: <span className="font-bold text-gray-900">{arenaState.exchangeCount}</span></span>
                </div>
                
                {/* Status */}
                <div className="flex items-center space-x-2">
                  {arenaState.status === 'active' && (
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-50 rounded-lg">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-sm text-green-600 font-semibold">Live</span>
                    </div>
                  )}
                  {arenaState.status === 'waiting' && (
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 rounded-lg">
                      <Clock className="w-4 h-4 text-gray-400 animate-pulse" />
                      <span className="text-sm text-gray-600 font-medium">{isConnected && arenaState.setupData ? 'Ready to Start' : 'Connecting...'}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Host Controls */}
              {isHost && (
                <div className="flex items-center space-x-2">
                  {arenaState.status === 'waiting' && arenaState.setupData && (
                    <button
                      onClick={startAIConversation}
                      disabled={isLoading}
                      className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:scale-105 font-medium"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Start Battle</span>
                    </button>
                  )}
                  
                  
                  <button
                    onClick={endArena}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
                  >
                    <X className="w-4 h-4" />
                    <span>End Session</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Arena Messages */}
          <div 
            ref={arenaMessagesRef}
            className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-transparent to-gray-50/50"
          >
            {arenaMessages.map((message) => (
              <div 
                key={message.id}
                className={`flex ${message.sender === 'system' ? 'justify-center' : 'justify-start'}`}
              >
                {message.type === 'system' ? (
                  <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-sm">
                    {message.content}
                  </div>
                ) : (
                  <div className="flex space-x-3 max-w-4xl">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getModelColor(message.sender)}`}>
                      <span className="text-sm">{getModelIcon(message.sender)}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {message.sender === 'model-a' ? arenaState.modelA?.name : 
                           message.sender === 'model-b' ? arenaState.modelB?.name :
                           message.authorName || 'Host'}
                        </span>
                        {message.type === 'intervention' && (
                          <Crown className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(message.timestamp)}
                        </span>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {arenaState.isWaitingForIntervention && isHost && (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-5 shadow-lg">
                <div className="flex items-center space-x-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 animate-pulse" />
                  <span className="font-semibold text-yellow-800">Host Intervention Required</span>
                </div>
                <div className="space-y-3">
                  <textarea
                    value={interventionText}
                    onChange={(e) => setInterventionText(e.target.value)}
                    placeholder="Provide guidance to steer the conversation..."
                    className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 resize-none"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={sendIntervention}
                      disabled={!interventionText.trim() || isLoading}
                      className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:scale-105 font-medium"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send Intervention</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Participants Bar */}
          <div className="bg-white/95 backdrop-blur border-t border-gray-200 px-6 py-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">Participants:</span>
                <div className="flex items-center space-x-3">
                  {participants.map((participant) => (
                    <div key={participant.id} className="flex items-center space-x-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        participant.role === 'host' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {participant.role === 'host' ? <Crown className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      </div>
                      <span className="text-sm text-gray-700">{participant.name}</span>
                      <div className={`w-2 h-2 rounded-full ${
                        participant.isActive ? 'bg-green-500' : 'bg-gray-300'
                      }`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Chat Sidebar */}
        {isChatOpen && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Participant Chat</h3>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            {/* Chat Messages */}
            <div 
              ref={chatMessagesRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
            >
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No messages yet.</p>
                  <p className="text-sm">Start chatting with participants!</p>
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
            
            {/* Chat Input */}
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
        )}
      </div>
    </div>
  );
}