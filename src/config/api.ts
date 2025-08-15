// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'https://bima-ai-decision-app-production.up.railway.app';

export const getApiUrl = (endpoint: string) => {
  return `${API_URL}${endpoint}`;
};

export const getWsUrl = () => {
  const url = new URL(API_URL);
  const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${url.host}/ws`;
};