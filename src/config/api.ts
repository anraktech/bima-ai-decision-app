// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const getApiUrl = (endpoint: string) => {
  return `${API_URL}${endpoint}`;
};

export const getWsUrl = () => {
  const url = new URL(API_URL);
  const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${url.host}/ws`;
};