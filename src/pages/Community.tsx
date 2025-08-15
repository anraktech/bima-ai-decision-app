import { useState, useEffect } from 'react';
import { MessageSquare, Star, Trophy, Eye, Copy, Check, Plus, Hash, ArrowLeft, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_URL, getApiUrl, getWsUrl } from '../config/api';


interface CommunityPost {
  id: string;
  username: string;
  title: string;
  description: string;
  modelToken: string;
  model_token?: string; // Database uses snake_case
  achievements?: string[]; // Optional - calculated based on likes/views
  likes: number;
  views: number;
  import_count: number;
  timestamp: string;
  tags: string[];
}

const samplePosts: CommunityPost[] = [];

export function Community() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'most_liked' | 'most_imported'>('newest');
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [newPost, setNewPost] = useState({
    title: '',
    description: '',
    modelToken: '',
    tags: ''
  });

  // Load posts on component mount and when sorting changes
  useEffect(() => {
    const loadPosts = async () => {
      try {
        // No authentication needed for viewing posts (public forum)
        const response = await fetch(`${API_URL}/api/community/posts?sort=${sortBy}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Loaded posts:', data);
          setPosts(data);
        } else {
          const error = await response.json();
          console.error('Failed to load posts:', error);
        }
      } catch (error) {
        console.error('Failed to load posts:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadPosts();
  }, [sortBy]);

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleLike = async (postId: string) => {
    if (!token) {
      alert('Please login to like posts');
      return;
    }

    try {
      const isLiked = likedPosts.has(postId);
      const response = await fetch(`${API_URL}/api/community/posts/${postId}/like`, {
        method: isLiked ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const updatedPost = await response.json();
        setPosts(prev => prev.map(p => 
          p.id === postId ? { ...p, likes: updatedPost.likes } : p
        ));
        
        if (isLiked) {
          setLikedPosts(prev => {
            const newSet = new Set(prev);
            newSet.delete(postId);
            return newSet;
          });
        } else {
          setLikedPosts(prev => new Set(prev).add(postId));
        }
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleTryModel = (modelToken: string) => {
    if (!token) {
      alert('Please login to try models');
      return;
    }
    
    // Navigate to models page with the token as a query parameter
    navigate(`/models?import=${modelToken}`);
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCreatePost = async () => {
    if (!newPost.title || !newPost.description || !newPost.modelToken) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/community/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newPost.title,
          description: newPost.description,
          modelToken: newPost.modelToken.toUpperCase(),
          tags: newPost.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        })
      });

      if (response.ok) {
        const createdPost = await response.json();
        setPosts(prev => [createdPost, ...prev]);
        setShowCreatePost(false);
        setNewPost({ title: '', description: '', modelToken: '', tags: '' });
      } else {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        alert(`Failed to create post: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Error creating post');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Community Hub</h1>
                <p className="mt-2 text-gray-600">Share your AI models, discover new ones, and connect with the community</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreatePost(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Share Your Model</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Sort by:</span>
          {[
            { value: 'newest', label: 'Newest' },
            { value: 'most_liked', label: 'Most Liked' },
            { value: 'most_imported', label: 'Most Imported' }
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setSortBy(option.value as any)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                sortBy === option.value
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Posts Feed */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading community posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No models shared yet</h3>
              <p className="text-gray-600 mb-6">Be the first to share your AI model with the community!</p>
              <button
                onClick={() => setShowCreatePost(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Share Your Model</span>
              </button>
            </div>
          ) : (
            posts.map((post) => (
            <div key={post.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="p-6">
                {/* Post Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                      {post.username.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{post.title}</h3>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <span>by {post.username}</span>
                        <span>•</span>
                        <span>{formatDate(post.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Download className="h-4 w-4" />
                      <span>{post.import_count || 0} imports</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4" />
                      <span>{post.likes} likes</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Eye className="h-4 w-4" />
                      <span>{post.views.toLocaleString()} views</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-700 mb-4 leading-relaxed">{post.description}</p>

                {/* Model Token */}
                <div className="flex items-center justify-between mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Hash className="h-5 w-5 text-gray-600" />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Model Token:</span>
                      <code className="ml-2 text-lg font-mono font-bold text-black">{post.model_token || post.modelToken}</code>
                    </div>
                  </div>
                  <button
                    onClick={() => copyToken(post.model_token || post.modelToken || '')}
                    className="flex items-center space-x-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {copiedToken === (post.model_token || post.modelToken) ? (
                      <>
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-green-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 text-gray-600" />
                        <span>Copy Token</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Achievements - only show if they exist */}
                {post.achievements && post.achievements.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.achievements.map((achievement, index) => (
                      <span
                        key={index}
                        className="flex items-center space-x-1 px-3 py-1 bg-orange-100 text-orange-800 text-sm font-medium rounded-full"
                      >
                        <Trophy className="h-3 w-3" />
                        <span>{achievement}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Tags and Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(post.tags) ? post.tags : []).map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center space-x-3">
                    <button 
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center space-x-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                        likedPosts.has(post.id) 
                          ? 'text-orange-600 bg-orange-50 hover:bg-orange-100' 
                          : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'
                      }`}
                    >
                      <Star className={`h-4 w-4 ${likedPosts.has(post.id) ? 'fill-current' : ''}`} />
                      <span>{likedPosts.has(post.id) ? 'Liked' : 'Like'}</span>
                      <span className="text-xs">({post.likes})</span>
                    </button>
                    <button 
                      onClick={() => handleTryModel(post.model_token || post.modelToken || '')}
                      className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Import Model</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
          )}
        </div>

        {/* Load More */}
        <div className="text-center mt-8">
          <button className="px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Load More Posts
          </button>
        </div>
      </div>

      {/* Create Post Modal would go here */}
      {showCreatePost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">Share Your Model</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Model Title *</label>
                  <input 
                    type="text" 
                    value={newPost.title}
                    onChange={(e) => setNewPost(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Advanced Financial Decision Maker"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                  <textarea 
                    value={newPost.description}
                    onChange={(e) => setNewPost(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={4}
                    placeholder="Describe what makes your model special..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Model Token *</label>
                  <input 
                    type="text" 
                    value={newPost.modelToken}
                    onChange={(e) => setNewPost(prev => ({ ...prev, modelToken: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="XXXX-YYYY"
                    maxLength={9}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
                  <input 
                    type="text" 
                    value={newPost.tags}
                    onChange={(e) => setNewPost(prev => ({ ...prev, tags: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="business, finance, technical"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowCreatePost(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreatePost}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Share Model
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}