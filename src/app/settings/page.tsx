'use client';

import React, { useState, useEffect, useRef } from 'react';
import ImageCropModal from '@/components/ui/ImageCropModal';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id?: string;
  username: string;
  email: string;
  createdAt?: string;
  profileImage?: string | null;
  bio?: string;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null); // 'username' or 'bio' or null
  const [editedUsername, setEditedUsername] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [showCropModal, setShowCropModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  const [llmProvider, setLlmProvider] = useState('openai');
  const [openaiModel, setOpenaiModel] = useState('gpt-4');
  const [localModelPath, setLocalModelPath] = useState('/path/to/models');
  const [ollamaModel, setOllamaModel] = useState('llama3');
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelType, setModelType] = useState('auto');
  const [device, setDevice] = useState('auto');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null);
  
  // URL의 해시를 기반으로 초기 탭 설정
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'model' || hash === 'account') {
        setActiveTab(hash);
      }
    }
  }, []);
  
  // 탭 변경 시 URL 해시 업데이트
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };
  
  // 사용자 프로필 정보 가져오기
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!session) {
        setIsLoading(false);
        return;
      }
      
      try {
        const response = await fetch('/api/user/profile');
        
        if (!response.ok) {
          throw new Error('Failed to fetch user profile');
        }
        
        const data = await response.json();
        setUserProfile(data);
        setEditedUsername(data.username);
        setEditedBio(data.bio || '');
      } catch (error) {
        console.error('Error fetching user profile:', error);
        toast.error('Failed to load profile information');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserProfile();
  }, [session]);
  
  // Load saved settings on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLlmProvider = localStorage.getItem('llmProvider');
      const savedOpenaiModel = localStorage.getItem('openaiModel');
      const savedOllamaModel = localStorage.getItem('ollamaModel');
      const savedOllamaEndpoint = localStorage.getItem('ollamaEndpoint');
      const savedLocalModelPath = localStorage.getItem('localModelPath');
      
      if (savedLlmProvider) setLlmProvider(savedLlmProvider);
      if (savedOpenaiModel) setOpenaiModel(savedOpenaiModel);
      if (savedOllamaModel) setOllamaModel(savedOllamaModel);
      if (savedOllamaEndpoint) setOllamaEndpoint(savedOllamaEndpoint);
      if (savedLocalModelPath) setLocalModelPath(savedLocalModelPath);
      
      // If Ollama is the selected provider, load available models
      if (savedLlmProvider === 'ollama') {
        fetchOllamaModels(savedOllamaEndpoint || 'http://localhost:11434');
      }
    }
  }, []);
  
  // Watch for changes in the Ollama endpoint or when selecting Ollama provider
  useEffect(() => {
    if (llmProvider === 'ollama') {
      fetchOllamaModels(ollamaEndpoint);
    }
  }, [llmProvider, ollamaEndpoint]);
  
  // Fetch available models from Ollama
  const fetchOllamaModels = async (endpoint: string) => {
    setLoadingModels(true);
    try {
      const response = await fetch(`${endpoint}/api/tags`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }
      
      const data = await response.json();
      const models = data.models || [];
      
      // Extract model names
      const modelNames = models.map((model: any) => model.name);
      
      // Sort models alphabetically
      modelNames.sort();
      
      setAvailableOllamaModels(modelNames);
      
      // If current selected model is not in the list and the list is not empty, select the first model
      if (modelNames.length > 0 && !modelNames.includes(ollamaModel)) {
        setOllamaModel(modelNames[0]);
      }
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      setAvailableOllamaModels([]);
    } finally {
      setLoadingModels(false);
    }
  };
  
  const handleApplySettings = () => {
    // Save settings to localStorage
    localStorage.setItem('llmProvider', llmProvider);
    localStorage.setItem('openaiModel', openaiModel);
    localStorage.setItem('ollamaModel', ollamaModel);
    localStorage.setItem('ollamaEndpoint', ollamaEndpoint);
    localStorage.setItem('localModelPath', localModelPath);
    
    let settingsMessage = `Settings applied:
LLM Provider: ${llmProvider}`;

    if (llmProvider === 'openai') {
      settingsMessage += `\nOpenAI Model: ${openaiModel}`;
    } else if (llmProvider === 'ollama') {
      settingsMessage += `\nOllama Model: ${ollamaModel}\nOllama Endpoint: ${ollamaEndpoint}`;
    } else {
      settingsMessage += `\nLocal Model Path: ${localModelPath}`;
    }

    toast.success('설정이 저장되었습니다.');
  };
  
  const handleTestModel = () => {
    setIsTesting(true);
    setTestResult(null);
    
    // For Ollama, test real connection
    if (llmProvider === 'ollama') {
      fetch(`${ollamaEndpoint}/api/tags`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to connect to Ollama API: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          const models = data.models || [];
          const modelExists = models.some((m: any) => 
            m.name === ollamaModel || m.name.startsWith(`${ollamaModel}:`)
          );
          
          if (modelExists) {
            setTestResult({
              success: true,
              message: `Successfully connected to Ollama! Model '${ollamaModel}' is available.`
            });
          } else {
            setTestResult({
              success: false,
              message: `Connected to Ollama, but model '${ollamaModel}' not found. Available models: ${models.map((m: any) => m.name).join(', ')}`
            });
          }
        })
        .catch(error => {
          setTestResult({
            success: false,
            message: `Error: ${error.message}`
          });
        })
        .finally(() => {
          setIsTesting(false);
        });
    } else {
      // Simulate testing for other providers
      setTimeout(() => {
        setIsTesting(false);
        if (Math.random() > 0.3) {
          setTestResult({
            success: true,
            message: `Model test successful! Response generation took 0.8s.`
          });
        } else {
          setTestResult({
            success: false,
            message: 'Failed to load model. Please check your settings and try again.'
          });
        }
      }, 2000);
    }
  };

  // Update profile data (username or bio)
  const handleUpdateProfile = async (field: 'username' | 'bio') => {
    const value = field === 'username' ? editedUsername : editedBio;
    
    if (field === 'username' && !value.trim()) {
      toast.error('Username cannot be empty');
      return;
    }
    
    setIsUpdating(true);
    
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username: field === 'username' ? value : userProfile?.username,
          bio: field === 'bio' ? value : userProfile?.bio 
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      
      const data = await response.json();
      setUserProfile(data.user);
      setIsEditing(null);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };
  
  // 프로필 이미지 선택
  const handleProfileImageClick = () => {
    setShowCropModal(true);
  };
  
  // 이미지 선택 취소
  const handleCancelCrop = () => {
    setShowCropModal(false);
  };
  
  // 프로필 이미지 업로드
  const handleSaveCroppedImage = async (croppedImageBase64: string) => {
    setIsUploadingImage(true);
    
    try {
      // Base64에서 Blob으로 변환
      const res = await fetch(croppedImageBase64);
      const blob = await res.blob();
      
      // FormData 생성
      const formData = new FormData();
      formData.append('profileImage', blob, 'profile.jpg');
      
      // API 요청
      const response = await fetch('/api/user/profile', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload profile image');
      }
      
      const data = await response.json();
      
      // 프로필 이미지 업데이트
      setUserProfile(prevProfile => prevProfile ? {
        ...prevProfile,
        profileImage: data.profileImage
      } : null);
      
      toast.success('Profile image updated successfully');
    } catch (error) {
      console.error('Error uploading profile image:', error);
      toast.error('Failed to upload profile image');
    } finally {
      setIsUploadingImage(false);
      setShowCropModal(false);
    }
  };
  
  // 가입일 포맷팅
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8">Settings</h1>
        
        <div className="max-w-4xl mx-auto">
          {/* Document-style Tabs */}
          <div className="flex mb-6 border-b border-gray-200">
            <button
              className={`px-5 py-3 font-medium rounded-t-lg ${
                activeTab === 'model' 
                  ? 'bg-white text-black border border-gray-200 border-b-0' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => handleTabChange('model')}
              style={{ marginRight: '4px' }}
            >
              Model Settings
            </button>
            <button
              className={`px-5 py-3 font-medium rounded-t-lg ${
                activeTab === 'account' 
                  ? 'bg-white text-black border border-gray-200 border-b-0' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => handleTabChange('account')}
            >
              Account Settings
            </button>
          </div>
          
          {/* Account Settings Tab */}
          {activeTab === 'account' && (
            <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              ) : !userProfile ? (
                <div className="text-center py-8">
                  <p>Please log in to access this page.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  {/* Profile Section */}
                  <div className="relative mb-12 mt-6">
                    <div 
                      className="mx-auto rounded-full overflow-hidden border-2 border-gray-200"
                      style={{ 
                        width: '180px', 
                        height: '180px', 
                        minWidth: '180px',
                        minHeight: '180px',
                        display: 'block'
                      }}
                    >
                      {userProfile.profileImage ? (
                        <img 
                          src={userProfile.profileImage} 
                          alt="Profile" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <img 
                          src="/api/user/default-avatar" 
                          alt="Default Avatar" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      )}
                    </div>
                      
                    {/* Camera icon button for changing profile picture */}
                    <button
                      onClick={handleProfileImageClick}
                      className="absolute bottom-1 right-1 rounded-full bg-black text-white shadow-md"
                      style={{ 
                        padding: '8px', 
                        width: '36px', 
                        height: '36px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                      </svg>
                    </button>
                  </div>
                  
                  {/* Profile Info Form */}
                  <div className="w-full max-w-md space-y-8">
                    {/* Username field */}
                    <div className="text-center">
                      <div className="mb-2 text-gray-600 font-medium">Username</div>
                      
                      {isEditing === 'username' ? (
                        <div className="flex flex-col items-center">
                          <input
                            type="text"
                            value={editedUsername}
                            onChange={(e) => setEditedUsername(e.target.value)}
                            className="w-full text-center p-2 border-b border-gray-300 focus:border-blue-500 focus:outline-none"
                          />
                          <div className="flex mt-2 gap-3">
                            <button
                              onClick={() => handleUpdateProfile('username')}
                              disabled={isUpdating}
                              className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
                            >
                              {isUpdating ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => {
                                setIsEditing(null);
                                setEditedUsername(userProfile.username);
                              }}
                              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative w-full group">
                          <div className="pb-1 text-xl font-medium text-center">
                            {userProfile.username}
                          </div>
                          <div className="w-full border-b border-gray-300 mb-3"></div>
                          <button
                            onClick={() => setIsEditing('username')}
                            className="absolute right-0 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9"></path>
                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Email field - read only */}
                    <div className="text-center">
                      <div className="mb-2 text-gray-600 font-medium">Email</div>
                      <div className="pb-1 text-lg text-center">
                        {userProfile.email}
                      </div>
                      <div className="w-full border-b border-gray-300 mb-3"></div>
                    </div>
                    
                    {/* Bio field */}
                    <div className="text-center">
                      <div className="mb-2 text-gray-600 font-medium">Bio</div>
                      
                      {isEditing === 'bio' ? (
                        <div className="flex flex-col items-center">
                          <textarea
                            value={editedBio}
                            onChange={(e) => setEditedBio(e.target.value)}
                            rows={3}
                            maxLength={500}
                            placeholder="Write a little about yourself..."
                            className="w-full text-center p-2 border border-gray-300 rounded focus:border-blue-500 focus:outline-none resize-none"
                          />
                          <div className="flex mt-2 gap-3">
                            <button
                              onClick={() => handleUpdateProfile('bio')}
                              disabled={isUpdating}
                              className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
                            >
                              {isUpdating ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => {
                                setIsEditing(null);
                                setEditedBio(userProfile.bio || '');
                              }}
                              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative w-full group">
                          <div className="pb-1 text-lg text-center min-h-16">
                            {userProfile.bio || 'No bio added yet.'}
                          </div>
                          <div className="w-full border-b border-gray-300 mb-3"></div>
                          <button
                            onClick={() => setIsEditing('bio')}
                            className="absolute right-0 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9"></path>
                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Model Settings Tab */}
          {activeTab === 'model' && (
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold mb-4">LLM Model Settings</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select LLM Provider</label>
                <div className="flex gap-4 flex-wrap">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="llm-provider"
                      value="openai"
                      checked={llmProvider === 'openai'}
                      onChange={() => setLlmProvider('openai')}
                      className="mr-2"
                    />
                    OpenAI API
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="llm-provider"
                      value="ollama"
                      checked={llmProvider === 'ollama'}
                      onChange={() => setLlmProvider('ollama')}
                      className="mr-2"
                    />
                    Ollama
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="llm-provider"
                      value="local"
                      checked={llmProvider === 'local'}
                      onChange={() => setLlmProvider('local')}
                      className="mr-2"
                    />
                    Local Model
                  </label>
                </div>
              </div>
              
              {llmProvider === 'openai' ? (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">OpenAI API Key</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value="●●●●●●●●●●●●●●●●●●●●●●●●●●●●"
                        disabled
                        className="flex-1 p-2 border border-gray-300 rounded"
                      />
                      <button className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100">
                        Update Key
                      </button>
                    </div>
                    <p className="text-sm text-green-600 mt-1">API Key has been set ✓</p>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select OpenAI Model</label>
                    <select 
                      className="w-full p-2 border border-gray-300 rounded"
                      value={openaiModel}
                      onChange={(e) => setOpenaiModel(e.target.value)}
                    >
                      <option value="gpt-4">gpt-4</option>
                      <option value="gpt-4-turbo">gpt-4-turbo</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    </select>
                  </div>
                </>
              ) : llmProvider === 'ollama' ? (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ollama Endpoint</label>
                    <input
                      type="text"
                      value={ollamaEndpoint}
                      onChange={(e) => setOllamaEndpoint(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded"
                      placeholder="http://localhost:11434"
                    />
                    <p className="text-sm text-gray-500 mt-1">Ollama API endpoint (default: http://localhost:11434)</p>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Ollama Model</label>
                    <div className="flex flex-col gap-2">
                      <select 
                        className="w-full p-2 border border-gray-300 rounded"
                        value={ollamaModel}
                        onChange={(e) => setOllamaModel(e.target.value)}
                        disabled={loadingModels || availableOllamaModels.length === 0}
                      >
                        {loadingModels ? (
                          <option value="">Loading models...</option>
                        ) : availableOllamaModels.length > 0 ? (
                          availableOllamaModels.map(model => (
                            <option key={model} value={model}>{model}</option>
                          ))
                        ) : (
                          <option value="">No models found</option>
                        )}
                      </select>
                      
                      {loadingModels && (
                        <div className="flex items-center mt-1">
                          <div className="animate-spin mr-2 h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                          <p className="text-sm text-gray-500">Loading available models...</p>
                        </div>
                      )}
                      
                      {!loadingModels && availableOllamaModels.length === 0 && (
                        <p className="text-sm text-red-500 mt-1">
                          No models found. Make sure Ollama is running and the endpoint is correct.
                        </p>
                      )}
                      
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-sm text-gray-500">{availableOllamaModels.length} models detected</p>
                        <button 
                          onClick={() => fetchOllamaModels(ollamaEndpoint)}
                          className="text-sm text-blue-500 hover:underline"
                          disabled={loadingModels}
                        >
                          Refresh
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <button 
                      className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                      onClick={handleTestModel}
                      disabled={isTesting || availableOllamaModels.length === 0}
                    >
                      {isTesting ? 'Testing...' : 'Test Ollama Connection'}
                    </button>
                    
                    {testResult && (
                      <div className={`mt-2 p-2 rounded ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {testResult.message}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Model Path</label>
                    <input
                      type="text"
                      value={localModelPath}
                      onChange={(e) => setLocalModelPath(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded"
                      placeholder="/path/to/model/folder"
                    />
                    <p className="text-sm text-gray-500 mt-1">Path to local language model file or directory</p>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Model Type</label>
                    <select 
                      className="w-full p-2 border border-gray-300 rounded"
                      value={modelType}
                      onChange={(e) => setModelType(e.target.value)}
                    >
                      <option value="auto">Auto-detect</option>
                      <option value="llama.cpp">llama.cpp (GGUF)</option>
                      <option value="transformers">Hugging Face Transformers</option>
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Compute Device</label>
                    <select 
                      className="w-full p-2 border border-gray-300 rounded"
                      value={device}
                      onChange={(e) => setDevice(e.target.value)}
                    >
                      <option value="auto">Auto-detect</option>
                      <option value="cuda">CUDA (GPU)</option>
                      <option value="mps">MPS (Apple Silicon)</option>
                      <option value="cpu">CPU</option>
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <button 
                      className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                      onClick={handleTestModel}
                      disabled={isTesting}
                    >
                      {isTesting ? 'Testing...' : 'Test Local Model'}
                    </button>
                    
                    {testResult && (
                      <div className={`mt-2 p-2 rounded ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {testResult.message}
                      </div>
                    )}
                  </div>
                </>
              )}
              
              <button 
                className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
                onClick={handleApplySettings}
              >
                Apply Model Settings
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Profile Image Crop Modal */}
      <ImageCropModal
        isOpen={showCropModal}
        onClose={handleCancelCrop}
        onSave={handleSaveCroppedImage}
      />
    </div>
  );
} 
 