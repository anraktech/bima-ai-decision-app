import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, AlertCircle } from 'lucide-react';
import { API_URL } from '../config/api';

export const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Direct admin check - no regular auth
    if (email !== 'kapil@anrak.io' || password !== 'KCRONALDO7') {
      setError('Invalid admin credentials');
      setIsLoading(false);
      return;
    }

    try {
      // Login as admin
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Store admin token separately
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUser', JSON.stringify(data.user));
        
        // Go directly to admin dashboard
        navigate('/admin4921/dashboard');
      } else {
        setError('Admin authentication failed');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-full max-w-md p-8">
        <div className="bg-gray-900 rounded-xl p-8 border border-gray-800">
          <div className="flex items-center justify-center mb-8">
            <Shield className="w-12 h-12 text-orange-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-white text-center mb-8">
            Admin Access Only
          </h1>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <input
                type="email"
                placeholder="Admin Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                required
              />
            </div>

            <div>
              <input
                type="password"
                placeholder="Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                required
              />
            </div>

            {error && (
              <div className="flex items-center space-x-2 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Authenticating...' : 'Access Admin Panel'}
            </button>
          </form>

          <div className="mt-8 text-center text-gray-500 text-xs">
            Unauthorized access is prohibited and monitored
          </div>
        </div>
      </div>
    </div>
  );
};