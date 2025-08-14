import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config/api';
import { 
  Users, 
  Shield, 
  TrendingUp, 
  ChevronDown, 
  ChevronUp,
  Search,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Crown,
  Rocket,
  Building2,
  Sparkles
} from 'lucide-react';

interface User {
  id: number;
  email: string;
  name: string;
  subscription_tier: string;
  created_at: string;
  last_login?: string;
  total_tokens_used?: number;
}

export const Admin4921 = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    explorePlans: 0,
    starterPlans: 0,
    enterprisePlans: 0
  });

  // Load users when component mounts
  useEffect(() => {
    console.log('Admin access granted for:', user?.email);
    setIsCheckingAuth(false);
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      console.log('Fetching users with token:', token);
      console.log('API URL:', `${API_URL}/api/admin/users`);
      
      const response = await fetch(`${API_URL}/api/admin/users`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'X-Admin-Key': 'anrak-admin-2025',
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Users data received:', data);
        setUsers(data || []);
        setFilteredUsers(data || []);
        calculateStats(data || []);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch users:', response.status, errorText);
        // If unauthorized, might need to re-login
        if (response.status === 401 || response.status === 403) {
          console.error('Auth issue - token might be expired');
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      // Set empty arrays to prevent crashes
      setUsers([]);
      setFilteredUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (userList: User[]) => {
    const stats = {
      totalUsers: userList.length,
      explorePlans: userList.filter(u => !u.subscription_tier || u.subscription_tier === 'explore').length,
      starterPlans: userList.filter(u => u.subscription_tier === 'starter' || u.subscription_tier === 'professional').length,
      enterprisePlans: userList.filter(u => u.subscription_tier === 'enterprise').length
    };
    setStats(stats);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (term === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(u => 
        u.email.toLowerCase().includes(term.toLowerCase()) ||
        u.name.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  };

  const updateUserPlan = async (userId: number, newPlan: string) => {
    setIsUpdating(true);
    setUpdateMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/admin/update-user-plan`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Admin-Key': 'anrak-admin-2025'
        },
        body: JSON.stringify({
          userId,
          plan: newPlan
        })
      });

      if (response.ok) {
        setUpdateMessage({ type: 'success', text: 'User plan updated successfully!' });
        
        // Update local state
        const updatedUsers = users.map(u => 
          u.id === userId ? { ...u, subscription_tier: newPlan } : u
        );
        setUsers(updatedUsers);
        setFilteredUsers(updatedUsers);
        calculateStats(updatedUsers);
        
        // Clear selected user
        setTimeout(() => {
          setSelectedUser(null);
          setUpdateMessage(null);
        }, 2000);
      } else {
        setUpdateMessage({ type: 'error', text: 'Failed to update user plan' });
      }
    } catch (error) {
      console.error('Error updating user plan:', error);
      setUpdateMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setIsUpdating(false);
    }
  };

  const getPlanIcon = (tier: string) => {
    switch(tier) {
      case 'enterprise': return <Building2 className="w-4 h-4" />;
      case 'starter':
      case 'professional': return <Rocket className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const getPlanColor = (tier: string) => {
    switch(tier) {
      case 'enterprise': return 'text-purple-600 bg-purple-100';
      case 'starter':
      case 'professional': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  if (isCheckingAuth || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">{isCheckingAuth ? 'Verifying admin access...' : 'Loading users...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-orange-500" />
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
              </div>
              <Users className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Explore (Free)</p>
                <p className="text-2xl font-bold text-gray-900">{stats.explorePlans}</p>
              </div>
              <Sparkles className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Starter ($10)</p>
                <p className="text-2xl font-bold text-orange-600">{stats.starterPlans}</p>
              </div>
              <Rocket className="w-8 h-8 text-orange-400" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Enterprise ($500)</p>
                <p className="text-2xl font-bold text-purple-600">{stats.enterprisePlans}</p>
              </div>
              <Building2 className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>

        {/* Search and Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users by email or name..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
            <button
              onClick={fetchUsers}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getPlanColor(user.subscription_tier || 'explore')}`}>
                      {getPlanIcon(user.subscription_tier || 'explore')}
                      <span>{user.subscription_tier || 'explore'}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                    >
                      Manage Plan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Plan Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Update User Plan</h2>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600">User:</p>
              <p className="font-medium">{selectedUser.name}</p>
              <p className="text-sm text-gray-500">{selectedUser.email}</p>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">Current Plan:</p>
              <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${getPlanColor(selectedUser.subscription_tier || 'explore')}`}>
                {getPlanIcon(selectedUser.subscription_tier || 'explore')}
                <span>{selectedUser.subscription_tier || 'explore'}</span>
              </span>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-3">Change to:</p>
              <div className="space-y-2">
                <button
                  onClick={() => updateUserPlan(selectedUser.id, 'explore')}
                  disabled={isUpdating}
                  className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center space-x-3">
                    <Sparkles className="w-5 h-5 text-gray-600" />
                    <span>Explore (Free - 50K tokens)</span>
                  </div>
                  {selectedUser.subscription_tier === 'explore' && <Check className="w-5 h-5 text-green-500" />}
                </button>
                
                <button
                  onClick={() => updateUserPlan(selectedUser.id, 'starter')}
                  disabled={isUpdating}
                  className="w-full flex items-center justify-between px-4 py-3 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center space-x-3">
                    <Rocket className="w-5 h-5 text-orange-600" />
                    <span>Starter ($10/mo - 750K tokens)</span>
                  </div>
                  {selectedUser.subscription_tier === 'starter' && <Check className="w-5 h-5 text-green-500" />}
                </button>
                
                <button
                  onClick={() => updateUserPlan(selectedUser.id, 'enterprise')}
                  disabled={isUpdating}
                  className="w-full flex items-center justify-between px-4 py-3 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center space-x-3">
                    <Building2 className="w-5 h-5 text-purple-600" />
                    <span>Enterprise ($500 - Unlimited)</span>
                  </div>
                  {selectedUser.subscription_tier === 'enterprise' && <Check className="w-5 h-5 text-green-500" />}
                </button>
              </div>
            </div>

            {updateMessage && (
              <div className={`mb-4 p-3 rounded-lg flex items-center space-x-2 ${
                updateMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {updateMessage.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <span>{updateMessage.text}</span>
              </div>
            )}

            <button
              onClick={() => setSelectedUser(null)}
              disabled={isUpdating}
              className="w-full py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};