import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MultiplayerSetup } from '../components/MultiplayerSetup';
import { 
import { API_URL, getApiUrl, getWsUrl } from '../config/api';

  Users, 
  Play, 
  UserPlus, 
  Copy, 
  Check, 
  ArrowLeft,
  Radio,
  User,
  Crown,
  Clock,
  MessageSquare,
  Settings,
  X,
  Zap
} from 'lucide-react';
import type { AIModel } from '../types';

type SessionMode = 'idle' | 'host-setup' | 'join' | 'lobby' | 'ai-setup' | 'active';
type ParticipantRole = 'host' | 'participant' | 'observer';

interface SessionParticipant {
  id: string;
  name: string;
  role: ParticipantRole;
  isReady: boolean;
  joinedAt: Date;
  connectionStatus: 'connected' | 'disconnected';
}

interface MultiplayerSession {
  pin: string;
  hostId: string;
  hostName: string;
  participants: SessionParticipant[];
  status: 'waiting' | 'active' | 'ended';
  createdAt: Date;
  settings: {
    maxParticipants: number;
    allowObservers: boolean;
    autoStart: boolean;
  };
}

export function Multiplayer() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<SessionMode>('idle');
  const [sessionPin, setSessionPin] = useState('');
  const [joinPin, setJoinPin] = useState('');
  const [currentSession, setCurrentSession] = useState<MultiplayerSession | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [error, setError] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const [participantName, setParticipantName] = useState('');
  const [sessionSettings, setSessionSettings] = useState({
    maxParticipants: 10,
    allowObservers: true,
    autoStart: false
  });

  // Generate a 6-digit PIN like Kahoot
  const generatePin = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // WebSocket connection management - connect once and maintain
  useEffect(() => {
    // Connect when entering multiplayer modes
    if ((mode === 'lobby' || mode === 'ai-setup') && !wsRef.current) {
      connectWebSocket();
    }
    
    // Cleanup when component unmounts
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [mode]);


  const connectWebSocket = () => {
    const ws = new WebSocket('${getWsUrl()}/ws');
    
    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
      
      // Join or create session based on role
      if (mode === 'lobby' && currentSession) {
        if (currentSession.hostId === user?.id?.toString()) {
          ws.send(JSON.stringify({
            type: 'create_multiplayer_session',
            pin: currentSession.pin,
            hostId: user?.id,
            hostName: user?.name,
            settings: sessionSettings
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'join_multiplayer_session',
            pin: currentSession.pin,
            participantId: user?.id || `guest_${Date.now()}`,
            participantName: participantName || user?.name || 'Anonymous',
            role: 'participant'
          }));
        }
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message:', data);
      
      switch (data.type) {
        case 'session_created':
          console.log('Session created successfully');
          break;
          
        case 'participant_joined':
          console.log('Participant joined:', data.participant);
          setCurrentSession(prev => {
            if (!prev) return null;
            // Check if participant already exists
            const exists = prev.participants.some(p => p.id === data.participant.id);
            if (exists) return prev;
            return {
              ...prev,
              participants: [...prev.participants, data.participant]
            };
          });
          break;
          
        case 'session_joined':
          console.log('Successfully joined session:', data);
          // Update session with data from server
          if (currentSession) {
            setCurrentSession(prev => ({
              ...prev!,
              hostName: data.hostName,
              participants: data.participants || [],
              settings: data.settings || prev!.settings
            }));
          }
          break;
          
        case 'participant_left':
          setCurrentSession(prev => {
            if (!prev) return null;
            return {
              ...prev,
              participants: prev.participants.filter(p => p.id !== data.participantId)
            };
          });
          break;
          
        case 'session_started':
          console.log('*** SESSION STARTED RECEIVED ***');
          console.log('Data:', data);
          console.log('Current session:', currentSession);
          console.log('User ID:', user?.id, 'Host ID:', currentSession?.hostId);
          
          // Update current session with setup data
          if (currentSession) {
            setCurrentSession(prev => ({
              ...prev!,
              status: 'active',
              setupData: data.setupData
            }));
            
            // Check if user is host or participant
            const isUserHost = String(currentSession.hostId) === String(user?.id);
            console.log('Is host?', isUserHost);
            
            if (!isUserHost) {
              console.log('*** NAVIGATING PARTICIPANT TO VIEWER ***');
              // Navigate participants to viewer page
              navigate('/multiplayer/viewer', { 
                state: { 
                  sessionData: {
                    ...currentSession,
                    setupData: data.setupData,
                    pin: data.pin || currentSession.pin,
                    hostId: currentSession.hostId
                  }
                } 
              });
            }
          } else {
            console.log('ERROR: No current session when session_started received');
          }
          break;
          
        case 'error':
          setError(data.message);
          break;
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
      setError('Connection failed. Please try again.');
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    };

    wsRef.current = ws;
  };

  const createSession = () => {
    const pin = generatePin();
    setSessionPin(pin);
    
    const newSession: MultiplayerSession = {
      pin,
      hostId: user?.id?.toString() || '',
      hostName: user?.name || 'Host',
      participants: [{
        id: user?.id?.toString() || '',
        name: user?.name || 'Host',
        role: 'host',
        isReady: true,
        joinedAt: new Date(),
        connectionStatus: 'connected'
      }],
      status: 'waiting',
      createdAt: new Date(),
      settings: sessionSettings
    };
    
    setCurrentSession(newSession);
    setMode('lobby');
  };

  const joinSession = async () => {
    if (!joinPin || joinPin.length !== 6) {
      setError('Please enter a valid 6-digit PIN');
      return;
    }
    
    // Create a temporary session object for joining
    const tempSession: MultiplayerSession = {
      pin: joinPin,
      hostId: '',
      hostName: '',
      participants: [],
      status: 'waiting',
      createdAt: new Date(),
      settings: {
        maxParticipants: 10,
        allowObservers: true,
        autoStart: false
      }
    };
    
    setCurrentSession(tempSession);
    setMode('lobby');
  };

  const startSession = () => {
    // Move to AI setup phase for host
    setMode('ai-setup');
  };

  const handleAISetupComplete = (setupData: {
    modelA: AIModel;
    modelB: AIModel;
    systemInstructionsA: string;
    systemInstructionsB: string;
    initialPrompt: string;
  }) => {
    console.log('Host completing AI setup, sending to server...');
    console.log('WebSocket state:', wsRef.current?.readyState, 'OPEN=', WebSocket.OPEN);
    console.log('Current session:', currentSession);
    
    // Send setup data to server and start conversation
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && currentSession) {
      console.log('✅ Sending start_ai_conversation with PIN:', currentSession.pin);
      wsRef.current.send(JSON.stringify({
        type: 'start_ai_conversation',
        pin: currentSession.pin,
        setupData
      }));
      
      // Wait a bit for the message to be sent before navigating
      setTimeout(() => {
        console.log('Host navigating to arena after delay');
        // Navigate to arena with setup data
        navigate('/multiplayer/arena', {
          state: {
            sessionData: {
              ...currentSession,
              setupData,
              hostId: currentSession.hostId
            }
          }
        });
      }, 1000); // Wait 1 second to ensure message is sent and processed
    } else {
      console.error('❌ Cannot send - WebSocket not ready or no session');
      console.error('WebSocket:', wsRef.current);
      console.error('ReadyState:', wsRef.current?.readyState);
      console.error('Session:', currentSession);
    }
  };

  const copyPin = () => {
    if (sessionPin) {
      navigator.clipboard.writeText(sessionPin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  const leaveSession = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setMode('idle');
    setCurrentSession(null);
    setSessionPin('');
    setJoinPin('');
    setError('');
  };

  // Idle state - Choose to host or join
  if (mode === 'idle') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="absolute top-6 left-6 flex items-center space-x-2 text-gray-700 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>

          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold text-black mb-4">Multiplayer Mode</h1>
            <p className="text-xl text-gray-600">Collaborate on AI conversations in real-time</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full">
            {/* Host Option */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 hover:border-orange-300 hover:shadow-xl transition-all duration-200">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center shadow-lg">
                  <Crown className="w-10 h-10 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-black mb-4 text-center">Host a Session</h2>
              <p className="text-gray-600 mb-8 text-center">
                Create a new collaborative AI conversation session and invite others to join
              </p>
              <button
                onClick={() => setMode('host-setup')}
                className="w-full py-4 bg-black text-white font-bold text-lg rounded-lg hover:bg-gray-800 transition-all shadow-lg"
              >
                Create Session
              </button>
            </div>

            {/* Join Option */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 hover:border-orange-300 hover:shadow-xl transition-all duration-200">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center shadow-lg">
                  <UserPlus className="w-10 h-10 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-black mb-4 text-center">Join a Session</h2>
              <p className="text-gray-600 mb-8 text-center">
                Enter a session PIN to join an existing collaborative conversation
              </p>
              <button
                onClick={() => setMode('join')}
                className="w-full py-4 bg-black text-white font-bold text-lg rounded-lg hover:bg-gray-800 transition-all shadow-lg"
              >
                Join Session
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Host setup state
  if (mode === 'host-setup') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <button
            onClick={() => setMode('idle')}
            className="absolute top-6 left-6 flex items-center space-x-2 text-gray-700 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 max-w-2xl w-full">
            <h2 className="text-3xl font-bold text-black mb-6 text-center">Session Settings</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Participants
                </label>
                <input
                  type="number"
                  min="2"
                  max="50"
                  value={sessionSettings.maxParticipants}
                  onChange={(e) => setSessionSettings(prev => ({
                    ...prev,
                    maxParticipants: parseInt(e.target.value)
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>


              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="allowObservers"
                  checked={sessionSettings.allowObservers}
                  onChange={(e) => setSessionSettings(prev => ({
                    ...prev,
                    allowObservers: e.target.checked
                  }))}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <label htmlFor="allowObservers" className="text-sm font-medium text-gray-700">
                  Allow Observers (View-only participants)
                </label>
              </div>

              <button
                onClick={createSession}
                className="w-full py-4 bg-black text-white font-bold text-lg rounded-lg hover:bg-gray-800 transition-all shadow-lg"
              >
                Create Session
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Join state
  if (mode === 'join') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <button
            onClick={() => setMode('idle')}
            className="absolute top-6 left-6 flex items-center space-x-2 text-gray-700 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 max-w-md w-full">
            <h2 className="text-3xl font-bold text-black mb-6 text-center">Join Session</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder={user?.name || "Enter your name"}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Session PIN
                </label>
                <input
                  type="text"
                  value={joinPin}
                  onChange={(e) => setJoinPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit PIN"
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-2xl font-bold text-center tracking-wider focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={joinSession}
                disabled={joinPin.length !== 6}
                className="w-full py-4 bg-black text-white font-bold text-lg rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Lobby state
  if (mode === 'lobby' && currentSession) {
    const isHost = currentSession.hostId === user?.id?.toString();
    
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <button
            onClick={leaveSession}
            className="absolute top-6 left-6 flex items-center space-x-2 text-gray-700 hover:text-black transition-colors"
          >
            <X className="w-5 h-5" />
            <span>Leave Session</span>
          </button>

          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 max-w-4xl w-full">
            {/* Session Header */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-black mb-4">
                {isHost ? 'Your Session is Ready!' : 'Joined Session'}
              </h2>
              
              {/* PIN Display */}
              <div className="inline-flex items-center space-x-4 bg-orange-50 border border-orange-200 rounded-xl px-6 py-4">
                <span className="text-gray-700">PIN:</span>
                <span className="text-4xl font-bold tracking-wider text-orange-600">
                  {currentSession.pin}
                </span>
                {isHost && (
                  <button
                    onClick={copyPin}
                    className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
                  >
                    {copiedPin ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5 text-gray-600" />
                    )}
                  </button>
                )}
              </div>

              {/* Connection Status */}
              <div className="mt-4 flex items-center justify-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : 'Connecting...'}
                </span>
              </div>
            </div>

            {/* Participants List */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Participants ({currentSession.participants.length}/{currentSession.settings.maxParticipants})
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {currentSession.participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center space-x-3 bg-gray-50 rounded-lg px-4 py-3"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      participant.role === 'host' 
                        ? 'bg-orange-500' 
                        : 'bg-gray-500'
                    }`}>
                      {participant.role === 'host' ? (
                        <Crown className="w-5 h-5 text-white" />
                      ) : (
                        <User className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{participant.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{participant.role}</p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      participant.connectionStatus === 'connected' 
                        ? 'bg-green-500' 
                        : 'bg-gray-400'
                    }`}></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Session Settings Display */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Session Settings</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Observers Allowed:</span>
                  <span className="ml-2 font-medium">
                    {currentSession.settings.allowObservers ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {isHost ? (
              <button
                onClick={startSession}
                disabled={currentSession.participants.length < 1}
                className="w-full py-4 bg-black text-white font-bold text-lg rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center space-x-3"
              >
                <Zap className="w-6 h-6" />
                <span>Configure AI Models & Start</span>
              </button>
            ) : (
              <div className="text-center">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Waiting for host to start the session...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // AI Setup state (for host)
  if (mode === 'ai-setup') {
    return (
      <MultiplayerSetup
        onComplete={handleAISetupComplete}
        onBack={() => setMode('lobby')}
      />
    );
  }

  return null;
}