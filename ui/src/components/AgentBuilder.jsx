import React, { useState, useEffect } from 'react';
import { Sparkles, Save, X, Bot, Plus } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const AgentBuilder = ({ onClose, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [availableTools, setAvailableTools] = useState([]);
  
  // Form State
  const [agentId, setAgentId] = useState('');
  const [name, setName] = useState('');
  const [instruction, setInstruction] = useState('');
  const [selectedTools, setSelectedTools] = useState([]);
  
  // Conversational State
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      const response = await fetch(`${API_BASE}/tools`);
      if (response.ok) {
        const data = await response.json();
        setAvailableTools(data.tools || []);
      }
    } catch (err) {
      console.error("Failed to fetch tools", err);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setGenerating(true);
    setError('');
    
    try {
      const response = await fetch(`${API_BASE}/agents/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: prompt })
      });
      
      const data = await response.json();
      
      if (data.status === 'success' && data.config) {
        setAgentId(data.config.agent_id || '');
        setName(data.config.name || '');
        setInstruction(data.config.instruction || '');
        setSelectedTools(data.config.tools || []);
      } else {
        setError(data.message || 'Failed to generate agent configuration.');
      }
    } catch (err) {
      setError('Network error occurred during generation.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!agentId || !name || !instruction) {
      setError('Agent ID, Name, and Instruction are required.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_BASE}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
          name: name,
          instruction: instruction,
          tools: selectedTools
        })
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        onSave(data.agent_id);
      } else {
        setError(data.message || 'Failed to save agent.');
      }
    } catch (err) {
      setError('Network error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  const toggleTool = (tool) => {
    setSelectedTools(prev => 
      prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1f2e] border border-white/10 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-lg">
            <Bot size={24} />
            Agent Builder
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
          
          {/* Left Column: Conversational AI */}
          <div className="w-full md:w-1/3 flex flex-col gap-4">
            <div className="bg-white/5 border border-blue-500/30 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-300 mb-2 flex items-center gap-2">
                <Sparkles size={16} /> Auto-Generate
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Describe what you want this agent to do. Our AI will automatically configure the required tools and system prompt.
              </p>
              <textarea
                className="w-full bg-black/40 border border-white/10 rounded-md p-3 text-sm text-gray-200 min-h-[120px] focus:outline-none focus:border-blue-500/50 resize-none"
                placeholder="e.g., I need a Legal Assistant agent that analyzes contracts and saves key clauses to the knowledge graph..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <button 
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="mt-3 w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded-md py-2 text-sm font-medium transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div> : <Sparkles size={16} />}
                {generating ? 'Generating...' : 'Generate Config'}
              </button>
            </div>
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded p-3">
                {error}
              </div>
            )}
          </div>
          
          {/* Right Column: Form */}
          <div className="w-full md:w-2/3 flex flex-col gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Agent ID (no spaces)</label>
                <input 
                  type="text" 
                  value={agentId} 
                  onChange={(e) => setAgentId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full bg-black/40 border border-white/10 rounded-md p-2 text-sm focus:outline-none focus:border-blue-500/50"
                  placeholder="e.g., legal_assistant"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Display Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-md p-2 text-sm focus:outline-none focus:border-blue-500/50"
                  placeholder="e.g., Legal Assistant"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">System Instructions</label>
              <textarea 
                value={instruction} 
                onChange={(e) => setInstruction(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-md p-3 text-sm min-h-[200px] focus:outline-none focus:border-blue-500/50 font-mono"
                placeholder="You are an intelligent agent..."
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Available Tools</label>
              <div className="flex flex-wrap gap-2">
                {availableTools.map(tool => (
                  <button
                    key={tool}
                    onClick={() => toggleTool(tool)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                      selectedTools.includes(tool) 
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                    }`}
                  >
                    {selectedTools.includes(tool) ? <Plus size={12} className="rotate-45" /> : <Plus size={12} />}
                    {tool}
                  </button>
                ))}
                {availableTools.length === 0 && <span className="text-xs text-gray-500">No tools available or loading...</span>}
              </div>
            </div>
            
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white/50"></div> : <Save size={16} />}
            {loading ? 'Saving...' : 'Save Agent'}
          </button>
        </div>
        
      </div>
    </div>
  );
};

export default AgentBuilder;
