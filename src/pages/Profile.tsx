import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  User, 
  Lock, 
  HelpCircle, 
  Mail, 
  Phone, 
  MapPin,
  Shield,
  LogOut,
  Key,
  MessageSquare,
  Globe,
  FileText,
  ChevronRight
} from 'lucide-react';

export const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'account' | 'support'>('account');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [passwordError, setPasswordError] = useState('');


  const handlePasswordChange = async () => {
    if (passwords.new !== passwords.confirm) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    if (passwords.new.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    try {
      // TODO: Implement password change API call
      console.log('Changing password...');
      setShowPasswordModal(false);
      setPasswords({ current: '', new: '', confirm: '' });
      setPasswordError('');
    } catch {
      setPasswordError('Failed to change password');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const tabs = [
    { id: 'account', label: 'Account Settings', icon: Lock },
    { id: 'support', label: 'Support', icon: HelpCircle }
  ];

  const faqs = [
    {
      question: 'How are tokens calculated?',
      answer: 'Tokens are calculated based on the length of input and output text. Approximately 1 token equals 4 characters or 0.75 words.'
    },
    {
      question: 'Which AI models are available?',
      answer: 'We support models from multiple providers: OpenAI (GPT-4o, GPT-4 Turbo), Anthropic (Claude 3.5 Sonnet), Google (Gemini), Groq (Llama models), xAI (Grok), and Deepseek. Custom models can also be created.'
    },
    {
      question: 'How do I reset my password?',
      answer: 'Go to Account Settings and click "Change Password". You\'ll need to enter your current password and choose a new one.'
    },
    {
      question: 'Can I export my conversation history?',
      answer: 'Yes, you can export your conversations from the Dashboard. Click on any conversation and use the export option.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards, debit cards, and PayPal. Enterprise customers can request invoice billing.'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-600 hover:text-gray-900 text-sm sm:text-base"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-black">My Profile</h1>
            </div>
            <div className="flex items-center space-x-3 self-end sm:self-auto">
              <div className="text-right">
                <p className="text-sm font-medium text-black truncate max-w-[120px] sm:max-w-none">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate max-w-[120px] sm:max-w-none">{user?.email}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            {/* Mobile Tab Selector */}
            <div className="sm:hidden px-4 py-3">
              <select 
                value={activeTab} 
                onChange={(e) => setActiveTab(e.target.value as 'account' | 'support')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
              >
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>{tab.label}</option>
                ))}
              </select>
            </div>
            
            {/* Desktop Tabs */}
            <nav className="hidden sm:flex space-x-4 lg:space-x-8 px-4 sm:px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as 'account' | 'support')}
                    className={`py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center space-x-1 sm:space-x-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden lg:inline">{tab.label}</span>
                    <span className="lg:hidden">{tab.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-4 sm:p-6">
            {/* Removed Usage & Billing tabs - available on dedicated Billing page */}

            {/* Account Settings Tab */}
            {activeTab === 'account' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold text-black mb-3 sm:mb-4">Account Information</h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={user?.name || ''}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm sm:text-base"
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={user?.email || ''}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm sm:text-base"
                        readOnly
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold text-black mb-3 sm:mb-4">Security</h3>
                  <div className="space-y-3 sm:space-y-4">
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="flex items-center justify-between w-full p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <Key className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0" />
                        <div className="text-left min-w-0 flex-1">
                          <p className="font-medium text-black text-sm sm:text-base">Change Password</p>
                          <p className="text-xs sm:text-sm text-gray-500">Update your account password</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                    </button>

                    <button className="flex items-center justify-between w-full p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 flex-shrink-0" />
                        <div className="text-left min-w-0 flex-1">
                          <p className="font-medium text-black text-sm sm:text-base">Two-Factor Authentication</p>
                          <p className="text-xs sm:text-sm text-gray-500">Add an extra layer of security</p>
                        </div>
                      </div>
                      <span className="text-xs sm:text-sm text-gray-400 flex-shrink-0">Coming Soon</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold text-black mb-3 sm:mb-4">Account Actions</h3>
                  <div className="space-y-3">
                    <button className="flex items-center justify-center sm:justify-start space-x-2 w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base">
                      <FileText className="w-4 h-4" />
                      <span>Download Account Data</span>
                    </button>
                    
                    <button
                      onClick={handleLogout}
                      className="flex items-center justify-center sm:justify-start space-x-2 w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm sm:text-base"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Support Tab */}
            {activeTab === 'support' && (
              <div className="space-y-4 sm:space-y-6">
                {/* Contact Information */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold text-black mb-4 sm:mb-6">Contact Information</h3>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-black text-sm sm:text-base">Email Us</p>
                        <a href="mailto:kapil@anrak.io" className="text-sm text-gray-600 hover:text-black break-all">
                          kapil@anrak.io
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-black text-sm sm:text-base">Call Us</p>
                        <div className="space-y-1">
                          <p className="text-xs sm:text-sm text-gray-600">+44 7931 802822 (UK)</p>
                          <p className="text-xs sm:text-sm text-gray-600">+234 808 750 7942 (Nigeria)</p>
                          <p className="text-xs sm:text-sm text-gray-600">+91 7330 675777 (India)</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-black text-sm sm:text-base">Headquarters</p>
                        <div className="space-y-1">
                          <p className="text-xs sm:text-sm text-gray-600">London, UK</p>
                          <p className="text-xs sm:text-sm text-gray-600">Hyderabad, India</p>
                          <p className="text-xs sm:text-sm text-gray-600">Lagos, Nigeria</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FAQs */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold text-black mb-4 sm:mb-6">Frequently Asked Questions</h3>
                  <div className="space-y-4">
                    {faqs.map((faq, index) => (
                      <div key={index} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                        <h4 className="font-medium text-black mb-2 text-sm sm:text-base">{faq.question}</h4>
                        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Links */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold text-black mb-3 sm:mb-4">Quick Links</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => navigate('/')}
                      className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Globe className="w-4 h-4 text-gray-600" />
                      <span className="text-sm">Visit Homepage</span>
                    </button>
                    <button
                      onClick={() => navigate('/models')}
                      className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-gray-600" />
                      <span className="text-sm">My Models</span>
                    </button>
                    <button
                      onClick={() => navigate('/community')}
                      className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4 text-gray-600" />
                      <span className="text-sm">Community</span>
                    </button>
                    <button
                      onClick={() => window.open('mailto:kapil@anrak.io', '_blank')}
                      className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <HelpCircle className="w-4 h-4 text-gray-600" />
                      <span className="text-sm">Contact Support</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[95vh] overflow-y-auto">
            <h3 className="text-base sm:text-lg font-semibold text-black mb-3 sm:mb-4">Change Password</h3>
            
            {passwordError && (
              <div className="mb-3 sm:mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs sm:text-sm">
                {passwordError}
              </div>
            )}
            
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm sm:text-base"
                />
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm sm:text-base"
                />
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm sm:text-base"
                />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-4 sm:mt-6">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswords({ current: '', new: '', confirm: '' });
                  setPasswordError('');
                }}
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordChange}
                className="w-full sm:w-auto px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm sm:text-base order-1 sm:order-2"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};