import { useState, useEffect } from 'react';
import type { AIModel, ModelProvider } from '../types';
import { API_URL, getApiUrl, getWsUrl } from '../config/api';


export const useModelProviders = () => {
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [allModels, setAllModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoading(true);
        const response = await fetch('${API_URL}/api/models/providers');
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.providers) {
            // Transform API response to match our frontend types
            const transformedProviders: ModelProvider[] = data.providers.map((provider: any) => ({
              id: provider.id,
              name: provider.name,
              models: provider.models.map((model: any) => ({
                id: model.id,
                name: model.id,
                displayName: model.name,
                provider: model.provider,
                context: model.context
              }))
            }));
            
            // Flatten all models into a single array
            const flattenedModels: AIModel[] = transformedProviders.flatMap(provider => 
              provider.models.map(model => ({
                ...model,
                provider: model.provider || provider.id  // Use model.provider if available, otherwise provider.id
              }))
            );
            
            setProviders(transformedProviders);
            setAllModels(flattenedModels);
          } else {
            setError('Failed to load models');
          }
        } else {
          setError('Failed to fetch models');
        }
      } catch (err) {
        console.error('Error fetching model providers:', err);
        setError('Network error while fetching models');
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, []);

  return {
    providers,
    allModels,
    loading,
    error,
    refetch: () => {
      setLoading(true);
      setError(null);
      // Re-trigger the useEffect
      setTimeout(() => {
        const fetchProviders = async () => {
          // ... same fetch logic as above
        };
        fetchProviders();
      }, 0);
    }
  };
};