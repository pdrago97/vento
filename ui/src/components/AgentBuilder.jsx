import { useState, useEffect } from 'react';
import { Sparkles, Save, X, Bot, Plus, UploadCloud, Play, Square, Activity } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const AgentBuilder = ({ onClose, onSave }) => {
  const [step, setStep] = useState('onboarding'); // 'onboarding' | 'builder'
  const [wizardGoal, setWizardGoal] = useState('');
  const [wizardQuestions, setWizardQuestions] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [availableTools, setAvailableTools] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  // Form State
  const [agentId, setAgentId] = useState('');
  const [name, setName] = useState('');
  const [instruction, setInstruction] = useState('');
  const [selectedTools, setSelectedTools] = useState([]);
  const [actionTemplates, setActionTemplates] = useState([]);
  const [ontology, setOntology] = useState('');
  
  // Channels & UI State
  const [channels, setChannels] = useState({
    discord: { enabled: false, bot_token: '' },
    slack: { enabled: false, bot_token: '' },
    whatsapp: { enabled: false, api_token: '' }
  });
  const [builderTab, setBuilderTab] = useState('config'); // 'config' | 'ontology' | 'channels'
  
  // Conversational State
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTools();
  }, []);

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
        action_templates: actionTemplates,
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
        setActionTemplates(data.config.action_templates || []);
        if (data.config.ontology) {
          setOntology(JSON.stringify(data.config.ontology, null, 2));
        } else {
          setOntology('');
        }
        if (data.config.channels) {
          setChannels({
            discord: { enabled: !!data.config.channels.discord, bot_token: data.config.channels.discord?.bot_token || '' },
            slack: { enabled: !!data.config.channels.slack, bot_token: data.config.channels.slack?.bot_token || '' },
            whatsapp: { enabled: !!data.config.channels.whatsapp, api_token: data.config.channels.whatsapp?.api_token || '' }
          });
        }
      } else {
        setError(data.message || 'Failed to generate agent configuration.');
      }
    } catch (err) {
      console.error(err);
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
        setActionTemplates(data.config.action_templates || []);
        if (data.config.ontology) {
          setOntology(JSON.stringify(data.config.ontology, null, 2));
        } else {
          setOntology('');
        }
        if (data.config.channels) {
          setChannels({
            discord: { enabled: !!data.config.channels.discord, bot_token: data.config.channels.discord?.bot_token || '' },
            slack: { enabled: !!data.config.channels.slack, bot_token: data.config.channels.slack?.bot_token || '' },
            whatsapp: { enabled: !!data.config.channels.whatsapp, api_token: data.config.channels.whatsapp?.api_token || '' }
          });
        }
        setStep('builder');
      } else {
        setError(data.message || 'Failed to generate skeleton.');
      }
    } catch (err) {
      console.error(err);
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
          console.error(e);
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
          action_templates: actionTemplates,
          ontology: parsedOntology,
          channels: Object.fromEntries(
            Object.entries(channels)
              .filter(([_, v]) => v.enabled)
              .map(([k, v]) => {
                const { enabled, ...rest } = v;
                return [k, rest];
              })
          )
        })
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        onSave(data.agent_id);
      } else {
        setError(data.message || 'Failed to save agent.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !agentId) {
      if (!agentId) setError('Please set an Agent ID first before uploading documents.');
      return;
    }
    
    setUploading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch(`${API_BASE}/agent/${agentId}/ingest_document`, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `Document ${data.filename} processed successfully! Extracted ${data.extracted_facts?.length || 0} facts.`
        }]);
        
        // Merge suggested ontology
        if (data.suggested_updates && (data.suggested_updates.nodes?.length > 0 || data.suggested_updates.predicates?.length > 0)) {
          try {
            const currOnt = ontology ? JSON.parse(ontology) : { nodes: [], predicates: [], properties: {} };
            const newNodes = [...new Set([...(currOnt.nodes || []), ...(data.suggested_updates.nodes || [])])];
            const newPredicates = [...new Set([...(currOnt.predicates || []), ...(data.suggested_updates.predicates || [])])];
            
            const newProps = { ...currOnt.properties };
            for (const [node, props] of Object.entries(data.suggested_updates.properties || {})) {
              newProps[node] = [...new Set([...(newProps[node] || []), ...props])];
            }
            
            setOntology(JSON.stringify({ nodes: newNodes, predicates: newPredicates, properties: newProps }, null, 2));
          } catch (e) {
            console.error(e);
            console.error("Failed to parse ontology to merge suggestions.");
          }
        }
      } else {
        setError(data.message || 'Failed to process document.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error occurred during document upload.');
    } finally {
      setUploading(false);
      e.target.value = null; // reset input
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
          <div className="flex-row text-primary text-h3">
            <Bot size={24} />
            {step === 'onboarding' ? 'New Agent Wizard' : 'Agent Builder'}
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon">
            <X size={20} />
          </button>
        </div>
        
        {step === 'onboarding' ? (
          <div className="modal-body flex-col flex-center" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ maxWidth: '600px', width: '100%', margin: '0 auto' }}>
              <div style={{ marginBottom: '2.5rem' }}>
                <Sparkles size={48} className="text-primary" style={{ margin: '0 auto 1.5rem', opacity: 0.9 }} />
                <h2 className="text-h2 text-main" style={{ marginBottom: '0.75rem' }}>Let's sketch your new Agent!</h2>
                <p className="text-muted text-body">Tell me a bit about what this agent should do, and I'll generate a complete skeleton (including instructions and a knowledge graph ontology) for you to refine.</p>
              </div>

              {error && (
                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--danger-surface)', border: '1px solid hsla(348, 83%, 47%, 0.3)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', textAlign: 'left' }}>
                  {error}
                </div>
              )}

              <div className="flex-col" style={{ gap: '1.5rem', textAlign: 'left' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label text-main">
                    1. What is the primary goal of this agent?
                  </label>
                  <textarea
                    className="input-field"
                    style={{ minHeight: '100px', resize: 'vertical' }}
                    placeholder="e.g., A legal assistant that analyzes contracts and finds loopholes..."
                    value={wizardGoal}
                    onChange={(e) => setWizardGoal(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label text-main">
                    2. What are some key questions this agent should be able to answer? (Optional)
                  </label>
                  <textarea
                    className="input-field"
                    style={{ minHeight: '100px', resize: 'vertical' }}
                    placeholder="e.g., What are the penalties for breach of contract? Who are the signing parties?"
                    value={wizardQuestions}
                    onChange={(e) => setWizardQuestions(e.target.value)}
                  />
                </div>

                <div className="flex-row" style={{ paddingTop: '1.5rem', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => setStep('builder')}
                    className="btn btn-ghost"
                  >
                    Skip to Manual Builder
                  </button>
                  <button 
                    onClick={handleGenerateSkeleton}
                    disabled={generating || !wizardGoal.trim()}
                    className="btn btn-primary"
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
          <div className="flex-col" style={{ width: '100%', flex: '1', borderRight: '1px solid var(--border-medium)', paddingRight: '1.5rem' }}>
            <div className="surface-glass flex-col" style={{ height: '100%', maxHeight: '60vh', padding: '1.5rem' }}>
              <h3 className="text-primary flex-row" style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                <Sparkles size={18} /> Agent Architect
              </h3>
              <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
                Chat with the AI to generate and interactively refine your agent and its ontology schema.
              </p>
              
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {chatHistory.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginTop: '2.5rem' }}>
                    No conversation yet. Describe the agent you want below.
                  </div>
                ) : (
                  chatHistory.map((msg, i) => (
                    <div key={i} style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.9rem',
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      backgroundColor: msg.role === 'user' ? 'hsla(222, 100%, 60%, 0.15)' : 'var(--bg-glass)',
                      color: msg.role === 'user' ? 'var(--primary-light)' : 'var(--text-main)',
                      border: msg.role === 'user' ? '1px solid hsla(222, 100%, 60%, 0.3)' : '1px solid var(--border-color)',
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
                  style={{ width: '100%', minHeight: '80px', resize: 'none', marginBottom: '1rem' }}
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
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  {generating ? <div style={{ border: '2px solid transparent', borderTopColor: 'var(--text-main)', borderRadius: '50%', width: '16px', height: '16px', animation: 'spin 1s linear infinite' }}></div> : <Sparkles size={16} />}
                  {generating ? 'Processing...' : 'Send Request'}
                </button>
              </div>
            </div>
            
            {error && (
              <div style={{ padding: '1rem', background: 'var(--danger-surface)', border: '1px solid hsla(348, 83%, 47%, 0.3)', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}
          </div>
          
          <div className="flex-col" style={{ flex: '2', gap: '1.25rem' }}>
            {/* Tabs */}
            <div className="flex-row" style={{ borderBottom: '1px solid var(--border-medium)', marginBottom: '0.5rem', gap: '1.5rem' }}>
              <button 
                className={`tab-button ${builderTab === 'config' ? 'active' : ''}`}
                onClick={() => setBuilderTab('config')}
                style={{
                  background: 'none', border: 'none', padding: '0.75rem 0', cursor: 'pointer',
                  borderBottom: builderTab === 'config' ? '2px solid var(--primary-color)' : '2px solid transparent',
                  color: builderTab === 'config' ? 'var(--primary-light)' : 'var(--text-muted)',
                  fontWeight: builderTab === 'config' ? 600 : 500
                }}
              >
                Configuration
              </button>
              <button 
                className={`tab-button ${builderTab === 'channels' ? 'active' : ''}`}
                onClick={() => setBuilderTab('channels')}
                style={{
                  background: 'none', border: 'none', padding: '0.75rem 0', cursor: 'pointer',
                  borderBottom: builderTab === 'channels' ? '2px solid var(--primary-color)' : '2px solid transparent',
                  color: builderTab === 'channels' ? 'var(--primary-light)' : 'var(--text-muted)',
                  fontWeight: builderTab === 'channels' ? 600 : 500
                }}
              >
                Channels
              </button>
              <button 
                className={`tab-button ${builderTab === 'ontology' ? 'active' : ''}`}
                onClick={() => setBuilderTab('ontology')}
                style={{
                  background: 'none', border: 'none', padding: '0.75rem 0', cursor: 'pointer',
                  borderBottom: builderTab === 'ontology' ? '2px solid var(--primary-color)' : '2px solid transparent',
                  color: builderTab === 'ontology' ? 'var(--primary-light)' : 'var(--text-muted)',
                  fontWeight: builderTab === 'ontology' ? 600 : 500
                }}
              >
                Knowledge & Ontology
              </button>
            </div>

            {builderTab === 'config' && (
              <div className="flex-col" style={{ gap: '1.25rem' }}>
                <div className="flex-row">
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="form-label">Agent ID (no spaces)</label>
                    <input 
                      type="text" 
                      value={agentId} 
                      onChange={(e) => setAgentId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="input-field"
                      placeholder="e.g., legal_assistant"
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="form-label">Display Name</label>
                    <input 
                      type="text" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)}
                      className="input-field"
                      placeholder="e.g., Legal Assistant"
                    />
                  </div>
                </div>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">System Instructions</label>
                  <textarea 
                    value={instruction} 
                    onChange={(e) => setInstruction(e.target.value)}
                    className="input-field"
                    style={{ minHeight: '120px', fontFamily: 'monospace', resize: 'vertical' }}
                    placeholder="You are an intelligent agent..."
                  />
                </div>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Available Tools</label>
                  <div className="flex-row" style={{ flexWrap: 'wrap' }}>
                    {availableTools.map(tool => (
                      <button
                        key={tool}
                        onClick={() => toggleTool(tool)}
                        style={{
                          padding: '0.4rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          border: selectedTools.includes(tool) ? '1px solid hsla(150, 100%, 40%, 0.5)' : '1px solid var(--border-color)',
                          backgroundColor: selectedTools.includes(tool) ? 'hsla(150, 100%, 40%, 0.1)' : 'var(--bg-glass)',
                          color: selectedTools.includes(tool) ? 'var(--success-color)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        {selectedTools.includes(tool) ? <Plus size={14} style={{ transform: 'rotate(45deg)' }} /> : <Plus size={14} />}
                        {tool}
                      </button>
                    ))}
                    {availableTools.length === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No tools available or loading...</span>}
                  </div>
                </div>

                {actionTemplates && actionTemplates.length > 0 && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Dynamic Operational Tools (Action Templates)</label>
                    <div className="flex-col">
                      {actionTemplates.map((template, idx) => (
                        <div key={idx} className="glass-panel" style={{ padding: '1rem', border: '1px solid hsla(222, 100%, 60%, 0.3)' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary-color)', marginBottom: '0.25rem' }}>{template.tool_name}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>{template.description}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', backgroundColor: 'var(--bg-dark)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                            {template.query}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {builderTab === 'channels' && (
              <div className="flex-col" style={{ gap: '1.25rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Configure external messaging channels powered by OpenClaw. The generated OpenClaw manifest will automatically expose these connections.
                </p>
                
                {/* Discord Channel */}
                <div className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--border-medium)' }}>
                  <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--primary-light)' }}>Discord</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={channels.discord.enabled} 
                        onChange={(e) => setChannels(prev => ({...prev, discord: {...prev.discord, enabled: e.target.checked}}))} 
                      />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>Enable</span>
                    </label>
                  </div>
                  {channels.discord.enabled && (
                    <div className="form-group" style={{ marginBottom: 0, marginTop: '0.5rem' }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Bot Token</label>
                      <input 
                        type="password" 
                        value={channels.discord.bot_token} 
                        onChange={(e) => setChannels(prev => ({...prev, discord: {...prev.discord, bot_token: e.target.value}}))}
                        className="input-field"
                        placeholder="MTEx..."
                      />
                    </div>
                  )}
                </div>

                {/* Slack Channel */}
                <div className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--border-medium)' }}>
                  <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--primary-light)' }}>Slack</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={channels.slack.enabled} 
                        onChange={(e) => setChannels(prev => ({...prev, slack: {...prev.slack, enabled: e.target.checked}}))} 
                      />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>Enable</span>
                    </label>
                  </div>
                  {channels.slack.enabled && (
                    <div className="form-group" style={{ marginBottom: 0, marginTop: '0.5rem' }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Bot Token</label>
                      <input 
                        type="password" 
                        value={channels.slack.bot_token} 
                        onChange={(e) => setChannels(prev => ({...prev, slack: {...prev.slack, bot_token: e.target.value}}))}
                        className="input-field"
                        placeholder="xoxb-..."
                      />
                    </div>
                  )}
                </div>

                {/* WhatsApp Channel */}
                <div className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--border-medium)' }}>
                  <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--primary-light)' }}>WhatsApp</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={channels.whatsapp.enabled} 
                        onChange={(e) => setChannels(prev => ({...prev, whatsapp: {...prev.whatsapp, enabled: e.target.checked}}))} 
                      />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>Enable</span>
                    </label>
                  </div>
                  {channels.whatsapp.enabled && (
                    <div className="form-group" style={{ marginBottom: 0, marginTop: '0.5rem' }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>API Token</label>
                      <input 
                        type="password" 
                        value={channels.whatsapp.api_token} 
                        onChange={(e) => setChannels(prev => ({...prev, whatsapp: {...prev.whatsapp, api_token: e.target.value}}))}
                        className="input-field"
                        placeholder="EAAB..."
                      />
                    </div>
                  )}
                </div>

              </div>
            )}

            {builderTab === 'ontology' && (
              <div className="flex-col" style={{ gap: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Ontology Schema (JSON)</label>
                  <textarea 
                    value={ontology} 
                    onChange={(e) => setOntology(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', minHeight: '150px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
                    placeholder='{"nodes": [], "predicates": [], "properties": {}}'
                  />
                </div>

                {/* Document Ingestion Area */}
                <div className="surface-glass flex-col" style={{ padding: '1.25rem', border: '1px dashed hsla(222, 100%, 60%, 0.4)' }}>
                  <h4 className="flex-row text-primary text-h3" style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                    <UploadCloud size={18} /> Knowledge Ingestion
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Upload documents (PDF, MD, DOCX, Spreadsheets) to automatically update this agent's knowledge graph and ontology. Ensure Agent ID is set first.
                  </p>
                  
                  <input 
                    type="file" 
                    id="docUpload"
                    style={{ display: 'none' }}
                    accept=".pdf,.md,.txt,.docx,.doc,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.mp3,.wav,.mp4,.mov,.webm"
                    onChange={handleFileUpload}
                    disabled={uploading || !agentId}
                  />
                  <label 
                    htmlFor="docUpload"
                    className="btn btn-ghost"
                    style={{ 
                      cursor: (uploading || !agentId) ? 'not-allowed' : 'pointer',
                      opacity: (uploading || !agentId) ? 0.5 : 1,
                      border: '1px solid var(--primary-color)',
                      color: 'var(--primary-color)'
                    }}
                  >
                    {uploading ? <div style={{ border: '2px solid transparent', borderTopColor: 'var(--primary-color)', borderRadius: '50%', width: '16px', height: '16px', animation: 'spin 1s linear infinite' }}></div> : <UploadCloud size={16} />}
                    {uploading ? 'Processing Document...' : 'Upload Document'}
                  </label>
                </div>
              </div>
            )}
            
          </div>
        </div>
        )}
        
        {/* Footer */}
        {step === 'builder' && (
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="btn btn-ghost"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="btn btn-primary"
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
