import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { AIModel } from '../types';
import { API_URL, getApiUrl, getWsUrl } from '../config/api';


export const useCustomModels = () => {
  const { token } = useAuth();
  const [customModels, setCustomModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchCustomModels();
    }
  }, [token]);

  const fetchCustomModels = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/models`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const models: AIModel[] = data.map((model: any) => ({
          id: `custom-${model.id}`,
          name: model.name,
          displayName: model.is_imported 
            ? `${model.name} (by ${model.original_owner_name})`
            : `${model.name} (Custom)`,
          isCustom: true,
          isShared: model.is_imported,
          baseModel: model.base_model,
          systemInstructions: model.system_instructions,
          openingStatement: model.opening_statement
        }));
        setCustomModels(models);
      }
    } catch (error) {
      console.error('Failed to fetch custom models:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { customModels, isLoading, refetch: fetchCustomModels };
};