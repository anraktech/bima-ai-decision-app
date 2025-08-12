import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { API_URL, getApiUrl, getWsUrl } from '../config/api';
import { 
  Users, 
  MessageSquare, 
  Database, 
  DollarSign, 
  TrendingUp, 
  Settings,
  User,
  Edit,
  Trash2,
  Crown,
  Star,
  TrendingDown,
  Ban,
  Eye,
  Calendar,
  BarChart3,
  Shield,
  LogOut,
  RefreshCw
} from 'lucide-react';

interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
  subscription_tier: string;
  subscription_status: string;
  conversation_count: number;
  custom_model_count: number;
  total_tokens: number;
  total_cost: number;
}

interface Post {
  id: number;
  title: string;
  content: string;
  author_name: string;
  author_email: string;
  created_at: string;
  is_trending: boolean;
  is_popular: boolean;
  boost_score: number;
  like_count: number;
  comment_count: number;
}

interface Stats {
  totalUsers: number;
  totalConversations: number;
  totalModels: number;
  totalPosts: number;
  revenue: {
    starter_revenue: number;
    professional_revenue: number;
    enterprise_revenue: number;
    paid_users: number;
  };
  tokenUsage: {
    total_tokens: number;
    total_cost: number;
    avg_tokens_per_user: number;
  };
  dailyStats: {
    date: string;
    active_users: number;
    conversations: number;
    tokens: number;
  }[];
}

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'posts' | 'stats'>('overview');
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const adminToken = localStorage.getItem('admin_token');

  useEffect(() => {
    if (adminToken) {
      setIsAuthenticated(true);
      setIsLoading(false);
      fetchAllData();
    } else {
      setIsLoading(false);
    }
  }, [adminToken]);

  const handleLogin = async () => {
    setLoginError('');
    try {
      const response = await fetch('${API_URL}/api/admin4921/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('admin_token', data.token);
        setIsAuthenticated(true);
        fetchAllData();
      } else {
        const errorData = await response.json();
        setLoginError(errorData.error || 'Login failed');
      }
    } catch (error) {
      setLoginError('Network error occurred');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
    navigate('/');
  };

  const fetchAllData = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      const [usersRes, postsRes, statsRes] = await Promise.all([
        fetch('${API_URL}/api/admin4921/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('${API_URL}/api/admin4921/community/posts', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('${API_URL}/api/admin4921/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }
      if (postsRes.ok) {
        const postsData = await postsRes.json();
        setPosts(postsData);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    }
  };

  const updateUserSubscription = async (userId: number, tier: string, status: string) => {
    const token = localStorage.getItem('admin_token');
    try {
      const response = await fetch(`${API_URL}/api/admin4921/users/${userId}/subscription`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subscription_tier: tier, subscription_status: status })
      });

      if (response.ok) {
        fetchAllData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to update subscription:', error);
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    const token = localStorage.getItem('admin_token');
    try {
      const response = await fetch(`${API_URL}/api/admin4921/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchAllData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const updatePostStatus = async (postId: number, updates: { is_trending?: boolean, is_popular?: boolean, boost_score?: number }) => {
    const token = localStorage.getItem('admin_token');
    try {
      const response = await fetch(`${API_URL}/api/admin4921/community/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        fetchAllData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to update post:', error);
    }
  };

  const deletePost = async (postId: number) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    
    const token = localStorage.getItem('admin_token');
    try {
      const response = await fetch(`${API_URL}/api/admin4921/community/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchAllData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="flex items-center justify-center mb-6">
            <Shield className="w-8 h-8 text-orange-500 mr-2" />
            <h1 className="text-2xl font-bold text-gray-900">Admin Access</h1>
          </div>
          
          {loginError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {loginError}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <button
              onClick={handleLogin}
              className="w-full bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 transition-colors font-medium"
            >
              Access Admin Panel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-orange-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-600">ANRAK Platform Administration</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={fetchAllData}
                className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'users', label: 'Users', icon: Users },
                { id: 'posts', label: 'Community Posts', icon: MessageSquare },
                { id: 'stats', label: 'Statistics', icon: TrendingUp }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && stats && (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-lg border border-blue-200">
                    <div className="flex items-center">
                      <Users className="w-8 h-8 text-blue-600" />
                      <div className="ml-4">
                        <p className="text-sm text-gray-600">Total Users</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-50 to-white p-6 rounded-lg border border-green-200">
                    <div className="flex items-center">
                      <MessageSquare className="w-8 h-8 text-green-600" />
                      <div className="ml-4">
                        <p className="text-sm text-gray-600">Conversations</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.totalConversations}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-lg border border-purple-200">
                    <div className="flex items-center">
                      <Database className="w-8 h-8 text-purple-600" />
                      <div className="ml-4">
                        <p className="text-sm text-gray-600">Custom Models</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.totalModels}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-orange-50 to-white p-6 rounded-lg border border-orange-200">
                    <div className="flex items-center">
                      <DollarSign className="w-8 h-8 text-orange-600" />
                      <div className="ml-4">
                        <p className="text-sm text-gray-600">Monthly Revenue</p>
                        <p className="text-2xl font-bold text-gray-900">
                          ${((stats.revenue.starter_revenue || 0) + (stats.revenue.professional_revenue || 0) + (stats.revenue.enterprise_revenue || 0)).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Revenue Breakdown */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Breakdown</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">${stats.revenue.starter_revenue || 0}</p>
                      <p className="text-sm text-gray-600">Starter Plan</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">${stats.revenue.professional_revenue || 0}</p>
                      <p className="text-sm text-gray-600">Professional Plan</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">${stats.revenue.enterprise_revenue || 0}</p>
                      <p className="text-sm text-gray-600">Enterprise Plan</p>
                    </div>
                  </div>
                  <p className="text-center text-lg font-medium text-gray-700 mt-4">
                    {stats.revenue.paid_users} Paid Users
                  </p>
                </div>

                {/* Token Usage */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Token Usage</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{(stats.tokenUsage.total_tokens || 0).toLocaleString()}</p>
                      <p className="text-sm text-gray-600">Total Tokens</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">${(stats.tokenUsage.total_cost || 0).toFixed(2)}</p>
                      <p className="text-sm text-gray-600">Total Cost</p>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">{Math.round(stats.tokenUsage.avg_tokens_per_user || 0)}</p>
                      <p className="text-sm text-gray-600">Avg per User</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
                  <p className="text-sm text-gray-600">{users.length} total users</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscription</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-white" />
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <select
                                value={user.subscription_tier}
                                onChange={(e) => updateUserSubscription(user.id, e.target.value, user.subscription_status)}
                                className="text-sm border border-gray-300 rounded px-2 py-1 mb-1"
                              >
                                <option value="explore">Explore</option>
                                <option value="starter">Starter</option>
                                <option value="professional">Professional</option>
                                <option value="enterprise">Enterprise</option>
                              </select>
                              <select
                                value={user.subscription_status}
                                onChange={(e) => updateUserSubscription(user.id, user.subscription_tier, e.target.value)}
                                className="text-sm border border-gray-300 rounded px-2 py-1"
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>
                              <p>{user.conversation_count || 0} conversations</p>
                              <p>{user.custom_model_count || 0} models</p>
                              <p>{(user.total_tokens || 0).toLocaleString()} tokens</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${(user.total_cost || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button
                              onClick={() => setSelectedUser(user)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteUser(user.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Posts Tab */}
            {activeTab === 'posts' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Community Posts Management</h2>
                  <p className="text-sm text-gray-600">{posts.length} total posts</p>
                </div>

                <div className="space-y-4">
                  {posts.map((post) => (
                    <div key={post.id} className="bg-white border border-gray-200 rounded-lg p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{post.title}</h3>
                            {post.is_trending && (
                              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                                Trending
                              </span>
                            )}
                            {post.is_popular && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                Popular
                              </span>
                            )}
                            {post.boost_score > 0 && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                Boost: {post.boost_score}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{post.content}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>By {post.author_name}</span>
                            <span>{post.like_count} likes</span>
                            <span>{post.comment_count} comments</span>
                            <span>{new Date(post.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex flex-col space-y-2 ml-4">
                          <button
                            onClick={() => updatePostStatus(post.id, { is_trending: !post.is_trending })}
                            className={`flex items-center space-x-1 px-3 py-1 rounded text-sm ${
                              post.is_trending 
                                ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            <TrendingUp className="w-3 h-3" />
                            <span>{post.is_trending ? 'Remove Trending' : 'Make Trending'}</span>
                          </button>
                          
                          <button
                            onClick={() => updatePostStatus(post.id, { is_popular: !post.is_popular })}
                            className={`flex items-center space-x-1 px-3 py-1 rounded text-sm ${
                              post.is_popular 
                                ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            <Star className="w-3 h-3" />
                            <span>{post.is_popular ? 'Remove Popular' : 'Make Popular'}</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              const newScore = prompt('Enter boost score (0-100):', post.boost_score.toString());
                              if (newScore !== null) {
                                updatePostStatus(post.id, { boost_score: parseInt(newScore) || 0 });
                              }
                            }}
                            className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-800 hover:bg-green-200 rounded text-sm"
                          >
                            <TrendingUp className="w-3 h-3" />
                            <span>Boost</span>
                          </button>
                          
                          <button
                            onClick={() => deletePost(post.id)}
                            className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-800 hover:bg-red-200 rounded text-sm"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Statistics Tab */}
            {activeTab === 'stats' && stats && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900">Platform Statistics</h2>

                {/* Daily Activity Chart */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Activity (Last 30 Days)</h3>
                  <div className="space-y-4">
                    {stats.dailyStats.slice(0, 10).map((day, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{day.date}</span>
                        </div>
                        <div className="flex items-center space-x-6 text-sm">
                          <div className="text-center">
                            <p className="font-medium text-gray-900">{day.active_users}</p>
                            <p className="text-gray-500">Users</p>
                          </div>
                          <div className="text-center">
                            <p className="font-medium text-gray-900">{day.conversations}</p>
                            <p className="text-gray-500">Conversations</p>
                          </div>
                          <div className="text-center">
                            <p className="font-medium text-gray-900">{day.tokens?.toLocaleString() || '0'}</p>
                            <p className="text-gray-500">Tokens</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* System Health */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Database Status</span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          Healthy
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">API Response Time</span>
                        <span className="text-sm font-medium text-gray-900">~150ms</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Uptime</span>
                        <span className="text-sm font-medium text-gray-900">99.9%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                    <div className="space-y-3">
                      <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors">
                        <RefreshCw className="w-4 h-4" />
                        <span>Refresh All Data</span>
                      </button>
                      <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors">
                        <Settings className="w-4 h-4" />
                        <span>System Settings</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">User Details</h2>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <p className="text-sm text-gray-900">{selectedUser.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <p className="text-sm text-gray-900">{selectedUser.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Created</label>
                  <p className="text-sm text-gray-900">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Subscription</label>
                  <p className="text-sm text-gray-900">{selectedUser.subscription_tier} ({selectedUser.subscription_status})</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Conversations</label>
                  <p className="text-sm text-gray-900">{selectedUser.conversation_count}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Custom Models</label>
                  <p className="text-sm text-gray-900">{selectedUser.custom_model_count}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Tokens</label>
                  <p className="text-sm text-gray-900">{selectedUser.total_tokens.toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Cost</label>
                  <p className="text-sm text-gray-900">${selectedUser.total_cost.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};