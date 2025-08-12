import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Save, Upload, X, FileText, Sparkles, Bot, Database } from 'lucide-react';
import { BaseModelDropdown } from '../components/BaseModelDropdown';
import type { AIModel } from '../types';
import { API_URL, getApiUrl, getWsUrl } from '../config/api';


interface UploadedDocument {
  id?: number;
  name: string;
  file?: File;
  size: number;
}

export const CreateModel = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modelName, setModelName] = useState('');
  const [selectedBaseModel, setSelectedBaseModel] = useState<AIModel | null>(null);
  const [systemInstructions, setSystemInstructions] = useState('');
  const [openingStatement, setOpeningStatement] = useState('');
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleModelSelect = (model: AIModel) => {
    setSelectedBaseModel(model);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Check if adding these files would exceed the limit
    if (documents.length + files.length > 3) {
      setError(`Maximum 3 documents allowed. You currently have ${documents.length} documents.`);
      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    // Validate file types
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/rtf', 'text/rtf'];
    const allowedExtensions = ['pdf', 'docx', 'rtf'];
    
    const invalidFiles = files.filter(file => {
      const extension = file.name.toLowerCase().split('.').pop();
      return !allowedTypes.includes(file.type) && !allowedExtensions.includes(extension || '');
    });
    
    if (invalidFiles.length > 0) {
      setError(`Invalid file types detected: ${invalidFiles.map(f => f.name).join(', ')}. Only PDF, DOCX, and RTF files are allowed.`);
      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    const newDocs = files.map(file => ({
      name: file.name,
      file,
      size: file.size
    }));
    setDocuments([...documents, ...newDocs]);
    setError(''); // Clear any previous errors
    
    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Create the model first
      const modelResponse = await fetch(`${API_URL}/api/models`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: modelName,
          baseModel: selectedBaseModel?.id,
          systemInstructions,
          openingStatement
        })
      });

      if (!modelResponse.ok) {
        throw new Error('Failed to create model');
      }

      const model = await modelResponse.json();

      // Upload documents if any
      if (documents.length > 0) {
        const formData = new FormData();
        documents.forEach(doc => {
          if (doc.file) {
            formData.append('documents', doc.file);
          }
        });

        await fetch(`${API_URL}/api/models/${model.id}/documents`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
      }

      navigate('/models');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create model');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-4 text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            ← Back to Dashboard
          </button>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-600 rounded flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Create Custom AI Model</h1>
                <p className="text-gray-600 mt-1">Configure your own AI agent with custom knowledge</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700">
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Model Configuration */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-gray-600" />
                <span>Model Configuration</span>
              </h2>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Model Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  required
                  className="w-full px-3 py-3 bg-white border border-gray-300 rounded text-gray-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-gray-500 transition-colors"
                  placeholder="e.g., Customer Support Agent, Code Reviewer"
                />
              </div>

              <BaseModelDropdown
                selectedModel={selectedBaseModel}
                onModelSelect={handleModelSelect}
                label="Base Model"
                placeholder="Select a base model"
                accentColor="blue"
                showSearch={true}
                size="md"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  System Instructions <span className="text-red-400">*</span>
                  <span className="block text-xs text-orange-600 font-normal mt-1">
                    💡 The better the system instructions, the better the performance
                  </span>
                </label>
                <textarea
                  value={systemInstructions}
                  onChange={(e) => setSystemInstructions(e.target.value)}
                  required
                  rows={6}
                  className="w-full px-3 py-3 bg-white border border-gray-300 rounded text-gray-900 placeholder-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-gray-500 transition-colors"
                  placeholder="Define your model's role, expertise, communication style, and any specific guidelines..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Opening Statement <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={openingStatement}
                  onChange={(e) => setOpeningStatement(e.target.value)}
                  required
                  rows={4}
                  className="w-full px-3 py-3 bg-white border border-gray-300 rounded text-gray-900 placeholder-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-gray-500 transition-colors"
                  placeholder="How should this model introduce itself or start conversations?"
                />
              </div>
            </div>
          </div>

          {/* Knowledge Base */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Database className="w-5 h-5 text-gray-600" />
                <span>Knowledge Base</span>
              </h2>
              <p className="text-sm text-gray-600 mt-1">Upload documents to enhance your model's knowledge</p>
            </div>
            
            <div className="p-6">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.rtf"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-6 border-2 border-dashed border-gray-300 rounded hover:border-gray-400 hover:bg-gray-50/50 transition-colors group"
              >
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                    <Upload className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-gray-900 font-medium">Click to upload documents</p>
                    <p className="text-sm text-gray-500 mt-1">PDF, DOCX, RTF only • Max 3 files • 10MB each</p>
                  </div>
                </div>
              </button>

              {documents.length > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700">Uploaded Documents</h3>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      documents.length === 3 ? 'bg-red-100 text-red-800' : 
                      documents.length === 2 ? 'bg-orange-100 text-orange-800' : 
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {documents.length}/3
                    </span>
                  </div>
                  {documents.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded border border-gray-200">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-gray-600" />
                        <div>
                          <p className="font-medium text-gray-900">{doc.name}</p>
                          <p className="text-sm text-gray-500">{formatFileSize(doc.size)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDocument(index)}
                        className="p-2 hover:bg-gray-200 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/models')}
              className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !modelName || !selectedBaseModel || !systemInstructions || !openingStatement}
              className="px-8 py-3 bg-gray-600 text-white font-medium rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Create Model</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};