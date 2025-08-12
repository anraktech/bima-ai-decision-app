import { useState } from 'react';
import { X, Download, Key, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ImportModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (model: any) => void;
}

export function ImportModelModal({ isOpen, onClose, onImport }: ImportModelModalProps) {
  const [shareToken, setShareToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { token } = useAuth();

  const handleImport = async () => {
    if (!shareToken.trim()) {
      setError('Please enter a share token');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3001/api/models/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shareToken: shareToken.trim().toUpperCase() })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to import model');
      }

      const data = await response.json();
      onImport(data.model);
      setShareToken('');
      onClose();
      // Trigger a page refresh to show the newly imported model
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import model');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Import Shared Model</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-4">
            Enter the share token provided by the model creator to import their model with all settings and knowledge base.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Share Token
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={shareToken}
                  onChange={(e) => setShareToken(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  maxLength={9}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isLoading || !shareToken.trim()}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isLoading ? (
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
    </div>
  );
}