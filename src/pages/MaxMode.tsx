import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Zap, 
  ArrowLeft, 
  Sparkles, 
  Bot,
  Play,
  Settings,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Flame,
  AlertTriangle,
  Info,
  Shield,
  Cpu,
  MessageSquare
} from 'lucide-react';
import { BaseModelDropdown } from '../components/BaseModelDropdown';
import { ProfessionalPersonaDropdown } from '../components/ProfessionalPersonaDropdown';
import type { AIModel } from '../types';
import type { ProfessionalPersona } from '../data/professionalPersonas';

interface ModelConfig {
  id: number;
  model: AIModel | null;
  systemInstructions: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  name: string;
}

export function MaxMode() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [models, setModels] = useState<ModelConfig[]>([
    { 
      id: 1, 
      model: null, 
      systemInstructions: '', 
      color: 'text-blue-600', 
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      icon: '🔷', 
      name: 'Alpha'
    },
    { 
      id: 2, 
      model: null, 
      systemInstructions: '', 
      color: 'text-purple-600', 
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      icon: '🟣', 
      name: 'Beta'
    },
    { 
      id: 3, 
      model: null, 
      systemInstructions: '', 
      color: 'text-emerald-600', 
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      icon: '🟢', 
      name: 'Gamma'
    },
    { 
      id: 4, 
      model: null, 
      systemInstructions: '', 
      color: 'text-amber-600', 
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      icon: '🟠', 
      name: 'Delta'
    },
    { 
      id: 5, 
      model: null, 
      systemInstructions: '', 
      color: 'text-rose-600', 
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
      icon: '🔴', 
      name: 'Epsilon'
    }
  ]);
  
  const [startingModel, setStartingModel] = useState<number>(1);
  const [openingLine, setOpeningLine] = useState('');
  const [expandedModel, setExpandedModel] = useState<number | null>(1);
  const [selectedPersonas, setSelectedPersonas] = useState<{ [key: number]: ProfessionalPersona | null }>({});
  
  const updateModel = (id: number, model: AIModel | null) => {
    setModels(prev => prev.map(m => 
      m.id === id ? { ...m, model } : m
    ));
  };
  
  const updateInstructions = (id: number, instructions: string) => {
    setModels(prev => prev.map(m => 
      m.id === id ? { ...m, systemInstructions: instructions } : m
    ));
  };

  const handlePersonaSelect = (modelId: number, persona: ProfessionalPersona | null) => {
    setSelectedPersonas(prev => ({ ...prev, [modelId]: persona }));
    if (persona) {
      updateInstructions(modelId, persona.systemInstructions);
    }
  };
  
  const isReadyToStart = () => {
    const hasModels = models.filter(m => m.model !== null).length >= 2;
    const hasInstructions = models.filter(m => m.model !== null).every(m => m.systemInstructions.trim() !== '');
    const hasOpeningLine = openingLine.trim() !== '';
    return hasModels && hasInstructions && hasOpeningLine;
  };
  
  const startConversation = () => {
    if (!isReadyToStart()) return;
    
    const activeModels = models.filter(m => m.model !== null);
    navigate('/max-conversation', {
      state: {
        models: activeModels,
        startingModel,
        openingLine
      }
    });
  };

  const resetAll = () => {
    setModels(models.map(m => ({ ...m, model: null, systemInstructions: '' })));
    setSelectedPersonas({});
    setOpeningLine('');
    setStartingModel(1);
    setExpandedModel(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Professional Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors group"
              >
                <ArrowLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
                <span className="font-medium hidden sm:inline">Dashboard</span>
              </button>
              
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg">
                  <Flame className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                    MAX Mode Configuration
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500">Multi-Agent eXperience</p>
                </div>
              </div>
            </div>
            
            <button
              onClick={startConversation}
              disabled={!isReadyToStart()}
              className={`flex items-center space-x-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-medium transition-all shadow-md ${
                isReadyToStart() 
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Play className="w-4 h-4" />
              <span className="hidden sm:inline">Launch Arena</span>
              <span className="sm:hidden">Start</span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Token Consumption Warning */}
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900">High Token Consumption Mode</h3>
              <p className="text-sm text-amber-700 mt-1">
                MAX mode runs multiple AI models simultaneously, which will consume tokens at a higher rate than standard conversations.
              </p>
            </div>
          </div>
        </div>

        {/* Main Configuration Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
          {/* Model Configuration - Scrollable */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Cpu className="w-5 h-5 text-gray-600" />
                    <h2 className="text-lg font-semibold text-gray-900">AI Model Configuration</h2>
                  </div>
                  <div className="text-sm text-gray-500">
                    {models.filter(m => m.model).length} of 5 configured
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
                {models.map((model) => (
                  <div 
                    key={model.id}
                    className={`border rounded-lg transition-all ${
                      expandedModel === model.id 
                        ? `${model.borderColor} border-2 shadow-md` 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <button
                      onClick={() => setExpandedModel(expandedModel === model.id ? null : model.id)}
                      className={`w-full p-4 ${model.bgColor} rounded-t-lg flex items-center justify-between hover:opacity-90 transition-opacity`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{model.icon}</span>
                        <div className="text-left">
                          <h3 className={`font-semibold ${model.color}`}>
                            Model {model.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {model.model ? model.model.name : 'Not configured'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {model.model && (
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        )}
                        {expandedModel === model.id ? (
                          <ChevronUp className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                    </button>
                    
                    {expandedModel === model.id && (
                      <div className="p-6 bg-white border-t border-gray-100 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select AI Model
                          </label>
                          <BaseModelDropdown
                            selectedModel={model.model}
                            onModelSelect={(m) => updateModel(model.id, m)}
                          />
                        </div>
                        
                        {model.model && (
                          <>
                            <div>
                              <ProfessionalPersonaDropdown
                                selectedPersona={selectedPersonas[model.id] || null}
                                onSelectPersona={(persona) => handlePersonaSelect(model.id, persona)}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                System Instructions
                              </label>
                              <textarea
                                value={model.systemInstructions}
                                onChange={(e) => updateInstructions(model.id, e.target.value)}
                                placeholder={`Define ${model.name}'s personality, expertise, and conversation style...`}
                                className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none text-sm"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Customize how this model should behave and respond in the conversation
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Right Sidebar - Configuration Options */}
          <div className="space-y-6">
            {/* Starting Model Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Zap className="w-5 h-5 text-orange-500" />
                <h3 className="font-semibold text-gray-900">Starting Model</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Select which model initiates the conversation
              </p>
              <div className="space-y-2">
                {models.filter(m => m.model).map((model) => (
                  <label
                    key={model.id}
                    className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      startingModel === model.id 
                        ? 'border-orange-400 bg-orange-50' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      checked={startingModel === model.id}
                      onChange={() => setStartingModel(model.id)}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-lg">{model.icon}</span>
                    <div className="flex-1">
                      <p className={`font-medium ${model.color}`}>{model.name}</p>
                      <p className="text-xs text-gray-500">{model.model?.name}</p>
                    </div>
                  </label>
                ))}
                {models.filter(m => m.model).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">
                    Configure models first
                  </p>
                )}
              </div>
            </div>
            
            {/* Opening Prompt */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <MessageSquare className="w-5 h-5 text-orange-500" />
                <h3 className="font-semibold text-gray-900">Opening Prompt</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Set the initial message to begin the multi-agent discussion
              </p>
              <textarea
                value={openingLine}
                onChange={(e) => setOpeningLine(e.target.value)}
                placeholder="Enter a thought-provoking question or topic to spark an engaging multi-model discussion..."
                className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none text-sm"
              />
            </div>
            
            {/* Arena Rules */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Shield className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Arena Rules</h3>
              </div>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2 mt-0.5">•</span>
                  <span>Models respond sequentially in configured order</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2 mt-0.5">•</span>
                  <span>Host intervention available every 20 messages</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2 mt-0.5">•</span>
                  <span>Each model maintains unique perspective</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2 mt-0.5">•</span>
                  <span>Minimum 2 models required to start</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={resetAll}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset All</span>
              </button>
              <button
                onClick={startConversation}
                disabled={!isReadyToStart()}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg font-medium transition-all shadow-md ${
                  isReadyToStart() 
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Play className="w-4 h-4" />
                <span>Start Arena</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}