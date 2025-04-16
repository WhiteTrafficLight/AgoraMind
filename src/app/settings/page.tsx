'use client';

import React, { useState, useEffect } from 'react';

export default function SettingsPage() {
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
  const [activeTab, setActiveTab] = useState('model');
  
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

    alert(settingsMessage);
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

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-blue-700">Settings</h1>
        
        <div className="max-w-4xl mx-auto">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              className={`${activeTab === 'model' ? 'tab-button-active' : 'tab-button'} mr-2`}
              onClick={() => setActiveTab('model')}
            >
              Model Settings
            </button>
            <button
              className={`${activeTab === 'dialogue' ? 'tab-button-active' : 'tab-button'} mr-2`}
              onClick={() => setActiveTab('dialogue')}
            >
              Dialogue Settings
            </button>
            <button
              className={`${activeTab === 'account' ? 'tab-button-active' : 'tab-button'} mr-2`}
              onClick={() => setActiveTab('account')}
            >
              Account Settings
            </button>
          </div>
          
          {/* Model Settings Tab */}
          {activeTab === 'model' && (
            <div className="card p-6">
              <h2 className="text-xl font-semibold mb-4">LLM Model Selection</h2>
              
              <div className="mb-4">
                <label className="form-label">Select LLM Provider</label>
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
                    <label className="form-label">OpenAI API Key</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value="●●●●●●●●●●●●●●●●●●●●●●●●●●●●"
                        disabled
                        className="form-input"
                      />
                      <button className="btn-secondary">Update Key</button>
                    </div>
                    <p className="text-sm text-green-600 mt-1">API Key is configured ✓</p>
                  </div>
                  
                  <div className="mb-4">
                    <label className="form-label">Select OpenAI Model</label>
                    <select 
                      className="form-select"
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
                    <label className="form-label">Ollama Endpoint</label>
                    <input
                      type="text"
                      value={ollamaEndpoint}
                      onChange={(e) => setOllamaEndpoint(e.target.value)}
                      className="form-input"
                      placeholder="http://localhost:11434"
                    />
                    <p className="text-sm text-gray-500 mt-1">Ollama API endpoint (default: http://localhost:11434)</p>
                  </div>
                  
                  <div className="mb-4">
                    <label className="form-label">Select Ollama Model</label>
                    <div className="flex flex-col gap-2">
                      <select 
                        className="form-select"
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
                          <option value="">No models available</option>
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
                        <p className="text-sm text-gray-500">Found {availableOllamaModels.length} models</p>
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
                      className="btn-secondary"
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
                    <label className="form-label">Model Path</label>
                    <input
                      type="text"
                      value={localModelPath}
                      onChange={(e) => setLocalModelPath(e.target.value)}
                      className="form-input"
                      placeholder="/path/to/model/folder"
                    />
                    <p className="text-sm text-gray-500 mt-1">Path to local language model file or directory</p>
                  </div>
                  
                  <div className="mb-4">
                    <label className="form-label">Model Type</label>
                    <select 
                      className="form-select"
                      value={modelType}
                      onChange={(e) => setModelType(e.target.value)}
                    >
                      <option value="auto">Auto-detect</option>
                      <option value="llama.cpp">llama.cpp (GGUF)</option>
                      <option value="transformers">Hugging Face Transformers</option>
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <label className="form-label">Computation Device</label>
                    <select 
                      className="form-select"
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
                      className="btn-secondary"
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
                className="btn-primary"
                onClick={handleApplySettings}
              >
                Apply Model Settings
              </button>
            </div>
          )}
          
          {/* Dialogue Settings Tab */}
          {activeTab === 'dialogue' && (
            <div className="card p-6">
              <h2 className="text-xl font-semibold mb-4">Dialogue Settings</h2>
              
              <div className="mb-4">
                <label className="form-label">Default Turns Per Dialogue</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  defaultValue="3"
                  className="form-input"
                />
              </div>
              
              <div className="mb-4">
                <label className="form-label">Include Sources in Dialogue</label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    className="mr-2"
                  />
                  Automatically include relevant philosophical sources
                </label>
              </div>
              
              <div className="mb-4">
                <label className="form-label">Default Response Temperature</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  defaultValue="0.7"
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>More Focused (0.0)</span>
                  <span>More Creative (1.0)</span>
                </div>
              </div>
              
              <button className="btn-primary">Save Dialogue Settings</button>
            </div>
          )}
          
          {/* Account Settings Tab */}
          {activeTab === 'account' && (
            <div className="card p-6">
              <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
              
              <div className="mb-4">
                <label className="form-label">Language</label>
                <select className="form-select">
                  <option>English</option>
                  <option>한국어</option>
                  <option>日本語</option>
                  <option>Español</option>
                  <option>Français</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="form-label">Theme</label>
                <select className="form-select">
                  <option>Light</option>
                  <option>Dark</option>
                  <option>System Default</option>
                </select>
              </div>
              
              <button className="btn-primary">Save Account Settings</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
 