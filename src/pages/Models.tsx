import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Bot, FileText, Trash2, Edit, Calendar, Database, Share2, Copy, Check, X } from 'lucide-react';
import { API_URL, getApiUrl, getWsUrl } from '../config/api';


interface CustomModel {
  id: number;
  name: string;
  base_model: string;
  system_instructions: string;
  opening_statement: string;
  document_count: number;
  created_at: string;
  updated_at: string;
  share_token?: string;
  is_public?: boolean;
  share_count?: number;
  is_imported?: boolean;
  original_owner_name?: string;
  original_owner_email?: string;
}

export const Models = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [models, setModels] = useState<CustomModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importToken, setImportToken] = useState('');

  useEffect(() => {
    fetchModels();
    
    // Check if there's an import token in the URL
    const importTokenParam = searchParams.get('import');
    if (importTokenParam) {
      setImportToken(importTokenParam);
      setShowImportDialog(true);
    }
  }, [searchParams]);

  const fetchModels = async () => {
    try {
      const response = await fetch(`${API_URL}/api/models`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setModels(data);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteModel = async (id: number) => {
    if (!confirm('Are you sure you want to delete this model?')) return;

    try {
      const response = await fetch(`${API_URL}/api/models/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setModels(models.filter(m => m.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete model:', error);
    }
  };

  const shareModel = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/api/models/${id}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setModels(models.map(m => 
          m.id === id 
            ? { ...m, share_token: data.shareToken, is_public: true }
            : m
        ));
      }
    } catch (error) {
      console.error('Failed to share model:', error);
    }
  };

  const revokeShare = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/api/models/${id}/share`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setModels(models.map(m => 
          m.id === id 
            ? { ...m, share_token: undefined, is_public: false }
            : m
        ));
      }
    } catch (error) {
      console.error('Failed to revoke share:', error);
    }
  };

  const copyShareToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleImportModel = async () => {
    if (!importToken) {
      alert('Please enter a model token');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/models/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          shareToken: importToken
        })
      });

      if (response.ok) {
        const importedModel = await response.json();
        setModels(prev => [...prev, importedModel]);
        setShowImportDialog(false);
        setImportToken('');
        // Clear URL parameter
        navigate('/models', { replace: true });
        alert('Model imported successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to import model: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error importing model:', error);
      alert('Error importing model');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getBaseModelName = (modelId: string) => {
    const names: Record<string, string> = {
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4': 'GPT-4'
    };
    return names[modelId] || modelId;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-4 text-gray-600 hover:text-black font-medium transition-colors text-sm sm:text-base"
          >
            ← Back to Dashboard
          </button>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Database className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-black">My Custom Models</h1>
                  <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage your AI models and knowledge bases</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
                <button
                  onClick={() => setShowImportDialog(true)}
                  className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 bg-white border-2 border-orange-500 text-orange-600 font-medium rounded-lg hover:bg-orange-50 transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Import</span>
                </button>
                
                <button
                  onClick={() => navigate('/models/create')}
                  className="flex-1 sm:flex-initial px-4 sm:px-6 py-2 sm:py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Model</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Models Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-slate-600 rounded-full animate-spin"></div>
          </div>
        ) : models.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-20 text-center">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded flex items-center justify-center mb-6">
              <Bot className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-black mb-2">No models yet</h3>
            <p className="text-gray-600 mb-6">Create your first custom AI model or import one from the community</p>
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={() => setShowImportDialog(true)}
                className="px-4 py-2 bg-white border-2 border-orange-500 text-orange-600 font-medium rounded hover:bg-orange-50 transition-colors inline-flex items-center space-x-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Import Model</span>
              </button>
              
              <button
                onClick={() => navigate('/models/create')}
                className="px-6 py-3 bg-black text-white font-medium rounded hover:bg-gray-800 transition-colors inline-flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Model</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {models.map((model) => (
              <div key={model.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-orange-300 transition-colors">
                <div className="p-4 sm:p-6">
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        model.is_imported ? 'bg-orange-500' : 'bg-black'
                      }`}>
                        <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <h3 className="text-base sm:text-lg font-semibold text-black truncate">{model.name}</h3>
                          {model.is_imported && (
                            <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium flex-shrink-0">
                              Imported
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-500">{getBaseModelName(model.base_model)}</p>
                        {model.is_imported && model.original_owner_name && (
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            Created by {model.original_owner_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-600 text-xs sm:text-sm line-clamp-2 sm:line-clamp-3 mb-3 sm:mb-4">
                    {model.system_instructions}
                  </p>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4 space-y-1 sm:space-y-0">
                    <div className="flex items-center space-x-1">
                      <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>{model.document_count} documents</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>{formatDate(model.created_at)}</span>
                    </div>
                  </div>

                  {/* Share Token Display */}
                  {model.share_token && (
                    <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-1 sm:space-x-2 min-w-0 flex-1">
                          <Share2 className="w-3 h-3 sm:w-4 sm:h-4 text-orange-600 flex-shrink-0" />
                          <span className="text-xs sm:text-sm font-medium text-orange-900 flex-shrink-0">Share:</span>
                          <code className="text-xs sm:text-sm font-mono text-orange-700 truncate">{model.share_token}</code>
                        </div>
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <button
                            onClick={() => copyShareToken(model.share_token!)}
                            className="p-1 hover:bg-orange-100 rounded transition-colors"
                          >
                            {copiedToken === model.share_token ? (
                              <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3 sm:w-4 sm:h-4 text-orange-600" />
                            )}
                          </button>
                          <button
                            onClick={() => revokeShare(model.id)}
                            className="p-1 hover:bg-orange-100 rounded transition-colors"
                          >
                            <X className="w-3 h-3 sm:w-4 sm:h-4 text-orange-600" />
                          </button>
                        </div>
                      </div>
                      {model.share_count !== undefined && model.share_count > 0 && (
                        <p className="text-xs text-orange-600 mt-1">Imported {model.share_count} times</p>
                      )}
                    </div>
                  )}

                  <div className="flex space-x-2">
                    {model.is_imported ? (
                      // Read-only imported model
                      <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-center">
                        <span className="text-sm text-gray-500 font-medium">Read-Only Import</span>
                      </div>
                    ) : (
                      // Editable user model
                      <button
                        onClick={() => navigate(`/models/${model.id}/edit`)}
                        className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 font-medium rounded hover:bg-gray-200 transition-colors flex items-center justify-center space-x-1 text-sm"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}
                    
                    {!model.is_imported && !model.share_token && (
                      <button
                        onClick={() => shareModel(model.id)}
                        className="px-3 py-2 bg-orange-50 text-orange-600 font-medium rounded hover:bg-orange-100 transition-colors flex items-center space-x-1 text-sm"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share</span>
                      </button>
                    )}
                    
                    <button
                      onClick={() => deleteModel(model.id)}
                      className="px-3 py-2 bg-red-50 text-red-600 font-medium rounded hover:bg-red-100 transition-colors"
                      title={model.is_imported ? "Remove imported model" : "Delete model"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Import Model Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Import Model</h2>
              <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">Enter the model token to import a shared model from the community.</p>
              <input
                type="text"
                value={importToken}
                onChange={(e) => setImportToken(e.target.value.toUpperCase())}
                placeholder="XXXX-YYYY"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 mb-4 text-sm sm:text-base"
                maxLength={9}
              />
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => {
                    setShowImportDialog(false);
                    setImportToken('');
                    navigate('/models', { replace: true });
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm sm:text-base order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportModel}
                  className="w-full sm:w-auto px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm sm:text-base order-1 sm:order-2"
                >
                  Import Model
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};