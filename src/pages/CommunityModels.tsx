import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Globe, Bot, FileText, Calendar, Users, Download, Search, Star, TrendingUp } from 'lucide-react';

interface CommunityModel {
  id: number;
  name: string;
  base_model: string;
  system_instructions: string;
  opening_statement: string;
  document_count: number;
  share_token: string;
  share_count: number;
  created_at: string;
  owner_name: string;
  owner_email: string;
}

export const CommunityModels = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [models, setModels] = useState<CommunityModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [importingModel, setImportingModel] = useState<string | null>(null);

  useEffect(() => {
    fetchCommunityModels();
  }, []);

  const fetchCommunityModels = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/models/community', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setModels(data);
      }
    } catch (error) {
      console.error('Failed to fetch community models:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const importModel = async (shareToken: string) => {
    setImportingModel(shareToken);
    try {
      const response = await fetch('http://localhost:3001/api/models/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shareToken })
      });

      if (response.ok) {
        // Update share count locally
        setModels(models.map(model => 
          model.share_token === shareToken 
            ? { ...model, share_count: model.share_count + 1 }
            : model
        ));
        // Show success message
        alert('Model imported successfully! You can now find it in your My Models tab.');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to import model');
      }
    } catch (error) {
      console.error('Failed to import model:', error);
      alert('Failed to import model');
    } finally {
      setImportingModel(null);
    }
  };

  const filteredModels = models.filter(model =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.system_instructions.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.owner_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getBaseModelName = (modelId: string) => {
    const names: Record<string, string> = {
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4': 'GPT-4'
    };
    return names[modelId] || modelId;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getPopularityLevel = (shareCount: number) => {
    if (shareCount >= 100) return { label: 'Viral', color: 'bg-red-100 text-red-800', icon: TrendingUp };
    if (shareCount >= 50) return { label: 'Popular', color: 'bg-orange-100 text-orange-800', icon: Star };
    if (shareCount >= 10) return { label: 'Rising', color: 'bg-blue-100 text-blue-800', icon: TrendingUp };
    return { label: 'New', color: 'bg-green-100 text-green-800', icon: Star };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-4 text-gray-600 hover:text-black font-medium transition-colors"
          >
            ← Back to Dashboard
          </button>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-black">Community AI Models</h1>
                  <p className="text-gray-600 mt-1">Discover and import models shared by the community</p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-2xl font-bold text-orange-600">{models.length}</p>
                <p className="text-sm text-gray-600">Public Models</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search models, creators, or descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        {/* Models Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-orange-600 rounded-full animate-spin"></div>
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-20 text-center">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-6">
              <Globe className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-black mb-2">
              {searchQuery ? 'No models found' : 'No community models yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery 
                ? `No models match "${searchQuery}". Try different keywords.`
                : 'Be the first to share a model with the community!'
              }
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-6 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredModels.map((model) => {
              const popularity = getPopularityLevel(model.share_count);
              const PopularityIcon = popularity.icon;
              
              return (
                <div key={model.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-orange-200 hover:shadow-lg transition-all duration-200">
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                          <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-black">{model.name}</h3>
                          <p className="text-sm text-gray-500">{getBaseModelName(model.base_model)}</p>
                        </div>
                      </div>
                      
                      <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${popularity.color}`}>
                        <PopularityIcon className="w-3 h-3" />
                        <span>{popularity.label}</span>
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                      {model.system_instructions}
                    </p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                      <div>
                        <div className="flex items-center justify-center space-x-1 text-gray-500">
                          <FileText className="w-4 h-4" />
                          <span className="text-sm font-medium">{model.document_count}</span>
                        </div>
                        <p className="text-xs text-gray-400">Docs</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-center space-x-1 text-orange-600">
                          <Users className="w-4 h-4" />
                          <span className="text-sm font-medium">{model.share_count}</span>
                        </div>
                        <p className="text-xs text-gray-400">Imports</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-center space-x-1 text-gray-500">
                          <Calendar className="w-4 h-4" />
                          <span className="text-sm font-medium">{formatDate(model.created_at)}</span>
                        </div>
                        <p className="text-xs text-gray-400">Created</p>
                      </div>
                    </div>

                    {/* Creator */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Created by</p>
                      <p className="text-sm font-medium text-gray-900">{model.owner_name}</p>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => importModel(model.share_token)}
                      disabled={importingModel === model.share_token}
                      className="w-full px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      {importingModel === model.share_token ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Importing...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Import Model</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};