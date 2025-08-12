const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');

// Admin credentials (hardcoded for security)
const ADMIN_EMAIL = 'kapil@anrak.io';
const ADMIN_PASSWORD = 'KCRONALDO7';
const ADMIN_SECRET = process.env.JWT_SECRET + '_ADMIN_4921';

// Admin login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
  
  const token = jwt.sign(
    { email: ADMIN_EMAIL, isAdmin: true },
    ADMIN_SECRET,
    { expiresIn: '4h' }
  );
  
  res.json({ token, email: ADMIN_EMAIL });
});

// Middleware to verify admin token
const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No admin token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, ADMIN_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: 'Not authorized as admin' });
    }
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }
};

// Get all users with their usage and billing
router.get('/users', verifyAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.created_at,
        u.subscription_tier,
        u.subscription_status,
        COUNT(DISTINCT c.id) as conversation_count,
        COUNT(DISTINCT cm.id) as custom_model_count,
        COALESCE(SUM(tu.tokens), 0) as total_tokens,
        COALESCE(SUM(tu.cost), 0) as total_cost
      FROM users u
      LEFT JOIN conversations c ON u.id = c.user_id
      LEFT JOIN custom_models cm ON u.id = cm.user_id
      LEFT JOIN token_usage tu ON u.id = tu.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all();
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get detailed user statistics
router.get('/users/:id/details', verifyAdmin, (req, res) => {
  try {
    const userId = req.params.id;
    
    // Get user info
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    
    // Get conversations
    const conversations = db.prepare(`
      SELECT * FROM conversations 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 20
    `).all(userId);
    
    // Get token usage
    const tokenUsage = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        SUM(tokens) as tokens,
        SUM(cost) as cost
      FROM token_usage 
      WHERE user_id = ?
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `).all(userId);
    
    // Get custom models
    const models = db.prepare(`
      SELECT * FROM custom_models 
      WHERE user_id = ?
    `).all(userId);
    
    res.json({
      user,
      conversations,
      tokenUsage,
      models
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Update user subscription
router.put('/users/:id/subscription', verifyAdmin, (req, res) => {
  try {
    const { subscription_tier, subscription_status } = req.body;
    
    db.prepare(`
      UPDATE users 
      SET subscription_tier = ?, subscription_status = ?
      WHERE id = ?
    `).run(subscription_tier, subscription_status, req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// Get all community posts
router.get('/community/posts', verifyAdmin, (req, res) => {
  try {
    const posts = db.prepare(`
      SELECT 
        cp.*,
        u.name as author_name,
        u.email as author_email,
        COUNT(DISTINCT cpl.id) as like_count,
        COUNT(DISTINCT cpc.id) as comment_count
      FROM community_posts cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN community_post_likes cpl ON cp.id = cpl.post_id
      LEFT JOIN community_post_comments cpc ON cp.id = cpc.post_id
      GROUP BY cp.id
      ORDER BY cp.created_at DESC
    `).all();
    
    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Update post status (trending, popular, etc.)
router.put('/community/posts/:id', verifyAdmin, (req, res) => {
  try {
    const { is_trending, is_popular, boost_score } = req.body;
    
    db.prepare(`
      UPDATE community_posts 
      SET 
        is_trending = COALESCE(?, is_trending),
        is_popular = COALESCE(?, is_popular),
        boost_score = COALESCE(?, boost_score),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(is_trending, is_popular, boost_score, req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post
router.delete('/community/posts/:id', verifyAdmin, (req, res) => {
  try {
    // Delete likes
    db.prepare('DELETE FROM community_post_likes WHERE post_id = ?').run(req.params.id);
    // Delete comments
    db.prepare('DELETE FROM community_post_comments WHERE post_id = ?').run(req.params.id);
    // Delete post
    db.prepare('DELETE FROM community_posts WHERE id = ?').run(req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Get system statistics
router.get('/stats', verifyAdmin, (req, res) => {
  try {
    const stats = {
      totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
      totalConversations: db.prepare('SELECT COUNT(*) as count FROM conversations').get().count,
      totalModels: db.prepare('SELECT COUNT(*) as count FROM custom_models').get().count,
      totalPosts: db.prepare('SELECT COUNT(*) as count FROM community_posts').get().count,
      
      // Revenue stats
      revenue: db.prepare(`
        SELECT 
          SUM(CASE WHEN subscription_tier = 'starter' THEN 19 ELSE 0 END) as starter_revenue,
          SUM(CASE WHEN subscription_tier = 'professional' THEN 49 ELSE 0 END) as professional_revenue,
          SUM(CASE WHEN subscription_tier = 'enterprise' THEN 199 ELSE 0 END) as enterprise_revenue,
          COUNT(CASE WHEN subscription_tier != 'explore' THEN 1 END) as paid_users
        FROM users
        WHERE subscription_status = 'active'
      `).get(),
      
      // Token usage
      tokenUsage: db.prepare(`
        SELECT 
          SUM(tokens) as total_tokens,
          SUM(cost) as total_cost,
          AVG(tokens) as avg_tokens_per_user
        FROM token_usage
      `).get(),
      
      // Daily stats for last 30 days
      dailyStats: db.prepare(`
        SELECT 
          DATE(created_at) as date,
          COUNT(DISTINCT user_id) as active_users,
          COUNT(*) as conversations,
          SUM(tokens) as tokens
        FROM (
          SELECT c.created_at, c.user_id, tu.tokens
          FROM conversations c
          LEFT JOIN token_usage tu ON c.user_id = tu.user_id 
            AND DATE(c.created_at) = DATE(tu.created_at)
        )
        WHERE created_at >= datetime('now', '-30 days')
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `).all()
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Delete user
router.delete('/users/:id', verifyAdmin, (req, res) => {
  try {
    const userId = req.params.id;
    
    // Delete related data
    db.prepare('DELETE FROM token_usage WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM conversations WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM custom_models WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM model_documents WHERE model_id IN (SELECT id FROM custom_models WHERE user_id = ?)').run(userId);
    db.prepare('DELETE FROM community_post_likes WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM community_post_comments WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM community_posts WHERE user_id = ?').run(userId);
    
    // Delete user
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;