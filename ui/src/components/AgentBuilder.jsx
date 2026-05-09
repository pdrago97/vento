import React, { useState, useEffect } from 'react';
import { Sparkles, Save, X, Bot, Plus } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const AgentBuilder = ({ onClose, onSave }) => {
  const [step, setStep] = useState('onboarding'); // 'onboarding' | 'builder'
  const [wizardGoal, setWizardGoal] = useState('');
  const [wizardQuestions, setWizardQuestions] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [availableTools, setAvailableTools] = useState([]);
  
  // Form State
  const [agentId, setAgentId] = useState('');
  const [name, setName] = useState('');
  const [instruction, setInstruction] = useState('');
  const [selectedTools, setSelectedTools] = useState([]);
  const [ontology, setOntology] = useState('');
  
  // Conversational State
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [chatHistory, setChatHistory] = useState([]);

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
      const currentConfig = {
        agent_id: agentId,
        name,
        instruction,
        tools: selectedTools,
        ontology: ontology ? JSON.parse(ontology) : null
      };

      const response = await fetch(`${API_BASE}/agents/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          description: prompt,
          current_config: (agentId || name) ? currentConfig : null
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'success' && data.config) {
        setChatHistory(prev => [...prev, 
          { role: 'user', content: prompt },
          { role: 'assistant', content: 'Configuration updated successfully.' }
        ]);
        setPrompt('');

        setAgentId(data.config.agent_id || '');
        setName(data.config.name || '');
        setInstruction(data.config.instruction || '');
        setSelectedTools(data.config.tools || []);
        if (data.config.ontology) {
          setOntology(JSON.stringify(data.config.ontology, null, 2));
        } else {
          setOntology('');
        }
      } else {
        setError(data.message || 'Failed to generate agent configuration.');
      }
    } catch (err) {
      setError('Network error occurred during generation.');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateSkeleton = async () => {
    if (!wizardGoal.trim()) {
      setError('Please provide a main goal for the agent.');
      return;
    }
    setGenerating(true);
    setError('');
    
    const skeletonPrompt = `Create an agent with the following primary goal: ${wizardGoal}. 
It should be able to answer these key questions: ${wizardQuestions}.
Provide a comprehensive instruction and a rich ontology schema tailored for this specific use case.`;

    try {
      const response = await fetch(`${API_BASE}/agents/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          description: skeletonPrompt,
          current_config: null
        })
      });
      
      const data = await response.json();
      if (data.status === 'success' && data.config) {
        setChatHistory([
          { role: 'user', content: `Goal: ${wizardGoal}\nQuestions: ${wizardQuestions}` },
          { role: 'assistant', content: 'Initial skeleton generated successfully! You can refine it here.' }
        ]);
        setAgentId(data.config.agent_id || '');
        setName(data.config.name || '');
        setInstruction(data.config.instruction || '');
        setSelectedTools(data.config.tools || []);
        if (data.config.ontology) {
          setOntology(JSON.stringify(data.config.ontology, null, 2));
        } else {
          setOntology('');
        }
        setStep('builder');
      } else {
        setError(data.message || 'Failed to generate skeleton.');
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
    
      let parsedOntology = null;
      if (ontology.trim()) {
        try {
          parsedOntology = JSON.parse(ontology);
        } catch (e) {
          setError('Invalid JSON in Ontology Schema.');
          setLoading(false);
          return;
        }
      }

    try {
      const response = await fetch(`${API_BASE}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
          name: name,
          instruction: instruction,
          tools: selectedTools,
          ontology: parsedOntology
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
    <div className="modal-overlay">
      <div className="modal-content">
        
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#60a5fa', fontWeight: 600, fontSize: '1.125rem' }}>
            <Bot size={24} />
            {step === 'onboarding' ? 'New Agent Wizard' : 'Agent Builder'}
          </div>
          <button onClick={onClose} style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} />
          </button>
        </div>
        
        {step === 'onboarding' ? (
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ maxWidth: '600px', width: '100%', margin: '0 auto' }}>
              <div style={{ marginBottom: '2rem' }}>
                <Sparkles size={48} style={{ color: '#60a5fa', margin: '0 auto 1rem', opacity: 0.8 }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>Let's sketch your new Agent!</h2>
                <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Tell me a bit about what this agent should do, and I'll generate a complete skeleton (including instructions and a knowledge graph ontology) for you to refine.</p>
              </div>

              {error && (
                <div style={{ marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '0.25rem', fontSize: '0.875rem', textAlign: 'left' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#d1d5db', marginBottom: '0.5rem' }}>
                    1. What is the primary goal of this agent?
                  </label>
                  <textarea
                    className="input-field"
                    style={{ width: '100%', minHeight: '80px', resize: 'vertical', boxSizing: 'border-box' }}
                    placeholder="e.g., A legal assistant that analyzes contracts and finds loopholes..."
                    value={wizardGoal}
                    onChange={(e) => setWizardGoal(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#d1d5db', marginBottom: '0.5rem' }}>
                    2. What are some key questions this agent should be able to answer? (Optional)
                  </label>
                  <textarea
                    className="input-field"
                    style={{ width: '100%', minHeight: '80px', resize: 'vertical', boxSizing: 'border-box' }}
                    placeholder="e.g., What are the penalties for breach of contract? Who are the signing parties?"
                    value={wizardQuestions}
                    onChange={(e) => setWizardQuestions(e.target.value)}
                  />
                </div>

                <div style={{ paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button 
                    onClick={() => setStep('builder')}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Skip to Manual Builder
                  </button>
                  <button 
                    onClick={handleGenerateSkeleton}
                    disabled={generating || !wizardGoal.trim()}
                    className="add-btn"
                    style={{ padding: '0.5rem 1.5rem', fontSize: '0.875rem', fontWeight: 500, opacity: (generating || !wizardGoal.trim()) ? 0.5 : 1 }}
                  >
                    {generating ? 'Generating Skeleton...' : 'Generate Skeleton'}
                    <Sparkles size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="modal-body" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            
            {/* Left Column: Conversational AI */}
          <div style={{ width: '100%', flex: '1', display: 'flex', flexDirection: 'column', gap: '1rem', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '1.5rem' }}>
            <div className="glass-panel card" style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '60vh', padding: '1rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 500, color: '#93c5fd', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={16} /> Agent Architect
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '1rem' }}>
                Chat with the AI to generate and interactively refine your agent and its ontology schema.
              </p>
              
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {chatHistory.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic', textAlign: 'center', marginTop: '2.5rem' }}>
                    No conversation yet. Describe the agent you want below.
                  </div>
                ) : (
                  chatHistory.map((msg, i) => (
                    <div key={i} style={{
                      padding: '0.625rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      backgroundColor: msg.role === 'user' ? 'rgba(37, 99, 235, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: msg.role === 'user' ? '#dbeafe' : '#d1d5db',
                      border: msg.role === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                      maxWidth: '90%'
                    }}>
                      {msg.content}
                    </div>
                  ))
                )}
              </div>

              <div style={{ marginTop: 'auto' }}>
                <textarea
                  className="input-field"
                  style={{ width: '100%', minHeight: '80px', resize: 'none', marginBottom: '0.75rem' }}
                  placeholder="e.g., I need a Legal Assistant... or 'Add a company CNPJ field'"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                />
                <button 
                  onClick={handleGenerate}
                  disabled={generating || !prompt.trim()}
                  className="add-btn"
                  style={{ width: '100%', padding: '0.5rem', opacity: (generating || !prompt.trim()) ? 0.5 : 1 }}
                >
                  {generating ? <div style={{ border: '2px solid transparent', borderTopColor: '#93c5fd', borderRadius: '50%', width: '16px', height: '16px', animation: 'spin 1s linear infinite' }}></div> : <Sparkles size={16} />}
                  {generating ? 'Processing...' : 'Send Request'}
                </button>
              </div>
            </div>
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded p-3">
                {error}
              </div>
            )}
          </div>
          
          <div style={{ flex: '2', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#9ca3af', marginBottom: '0.25rem' }}>Agent ID (no spaces)</label>
                <input 
                  type="text" 
                  value={agentId} 
                  onChange={(e) => setAgentId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="input-field"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="e.g., legal_assistant"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#9ca3af', marginBottom: '0.25rem' }}>Display Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="e.g., Legal Assistant"
                />
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#9ca3af', marginBottom: '0.25rem' }}>System Instructions</label>
              <textarea 
                value={instruction} 
                onChange={(e) => setInstruction(e.target.value)}
                className="input-field"
                style={{ width: '100%', minHeight: '120px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
                placeholder="You are an intelligent agent..."
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#9ca3af', marginBottom: '0.5rem' }}>Available Tools</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {availableTools.map(tool => (
                  <button
                    key={tool}
                    onClick={() => toggleTool(tool)}
                    style={{
                      padding: '0.375rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      border: selectedTools.includes(tool) ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: selectedTools.includes(tool) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: selectedTools.includes(tool) ? '#34d399' : '#9ca3af',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    {selectedTools.includes(tool) ? <Plus size={12} style={{ transform: 'rotate(45deg)' }} /> : <Plus size={12} />}
                    {tool}
                  </button>
                ))}
                {availableTools.length === 0 && <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>No tools available or loading...</span>}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#9ca3af', marginBottom: '0.25rem' }}>Ontology Schema (JSON)</label>
              <textarea 
                value={ontology} 
                onChange={(e) => setOntology(e.target.value)}
                className="input-field"
                style={{ width: '100%', minHeight: '150px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
                placeholder='{"nodes": [], "predicates": [], "properties": {}}'
              />
            </div>
            
          </div>
        </div>
        )}
        
        {/* Footer */}
        {step === 'builder' && (
        <div className="modal-footer">
          <button 
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 500, color: '#d1d5db', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="add-btn"
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, background: '#2563eb', color: 'white', border: 'none', opacity: loading ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {loading ? <div style={{ border: '2px solid transparent', borderTopColor: 'white', borderRadius: '50%', width: '16px', height: '16px', animation: 'spin 1s linear infinite' }}></div> : <Save size={16} />}
            {loading ? 'Saving...' : 'Save Agent'}
          </button>
        </div>
        )}
        
      </div>
    </div>
  );
};

export default AgentBuilder;
