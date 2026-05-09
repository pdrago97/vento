import { useState, useEffect } from 'react';
import { 
  Network, 
  Activity, 
  Database, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle, 
  AlertCircle,
  X,
  Settings2,
  ChevronRight,
  ChevronLeft,
  PanelRight,
  PanelLeft,
  Bot,
  Upload,
  FileText,
  File,
  Paperclip,
  Check
} from 'lucide-react';
import { useRef } from 'react';
import './index.css';
import GraphExplorer from './GraphExplorer';
import OntologyAssistant from './components/OntologyAssistant';
import AgentChat from './components/AgentChat';
import AgentBuilder from './components/AgentBuilder';
import AdminChat from './components/AdminChat';
import InventoryExplorer from './components/InventoryExplorer';

const API_BASE = 'http://localhost:8000';

function App() {
  const [schema, setSchema] = useState({ nodes: [], predicates: [], properties: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAssistantOpen, setIsAssistantOpen] = useState(true);
  const [agentId, setAgentId] = useState('global');
  const [leftTab, setLeftTab] = useState('assistant'); // 'assistant' or 'chat'
  const [refreshGraph, setRefreshGraph] = useState(0);
  const [viewMode, setViewMode] = useState('memory'); // 'memory', 'schema', or 'inventory'

  // Dynamic config states
  const [agentsList, setAgentsList] = useState(['global']);
  const [schemasList, setSchemasList] = useState(['global']);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  // Input states
  const [newNode, setNewNode] = useState('');
  const [newPredicate, setNewPredicate] = useState('');
  const [newPropertyNode, setNewPropertyNode] = useState('');
  const [newProperty, setNewProperty] = useState('');

  // Knowledge Ingestion states
  const [ingestingFile, setIngestingFile] = useState(false);
  const [suggestedUpdates, setSuggestedUpdates] = useState(null);
  const [extractedFacts, setExtractedFacts] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchAgentsAndSchemas();
  }, []);

  useEffect(() => {
    fetchOntology();
  }, [agentId]);

  const fetchAgentsAndSchemas = async () => {
    try {
      const [agentsRes, schemasRes] = await Promise.all([
        fetch(`${API_BASE}/agents`),
        fetch(`${API_BASE}/schemas`)
      ]);
      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgentsList(agentsData.agents || []);
      }
      if (schemasRes.ok) {
        const schemasData = await schemasRes.json();
        setSchemasList(schemasData.schemas || []);
      }
    } catch (err) {
      console.error("Failed to fetch config", err);
    }
  };

  const handleAgentSaved = (newAgentId) => {
    setIsBuilderOpen(false);
    fetchAgentsAndSchemas();
    setAgentId(newAgentId);
  };

  const fetchOntology = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/ontology?agent_id=${agentId}`);
      if (!response.ok) throw new Error('Failed to fetch ontology');
      const data = await response.json();
      setSchema(data);
    } catch (err) {
      showNotification('error', 'Failed to connect to Memory Service');
    } finally {
      setLoading(false);
    }
  };

  const saveOntology = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/ontology?agent_id=${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schema)
      });
      if (!response.ok) throw new Error('Failed to save ontology');
      const data = await response.json();
      setSchema(data.schema);
      showNotification('success', 'Ontology saved successfully!');
      fetchAgentsAndSchemas(); // Refresh schemas list in case a new one was created
    } catch (err) {
      showNotification('error', 'Failed to save ontology');
    } finally {
      setSaving(false);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Node Actions
  const addNode = () => {
    if (!newNode.trim() || schema.nodes.includes(newNode.trim())) return;
    setSchema(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode.trim()]
    }));
    setNewNode('');
  };

  const removeNode = (nodeToRemove) => {
    setSchema(prev => {
      const newProperties = { ...prev.properties };
      delete newProperties[nodeToRemove];
      return {
        ...prev,
        nodes: prev.nodes.filter(n => n !== nodeToRemove),
        properties: newProperties
      };
    });
  };

  // Predicate Actions
  const addPredicate = () => {
    const val = newPredicate.trim().toUpperCase().replace(/\s+/g, '_');
    if (!val || schema.predicates.includes(val)) return;
    setSchema(prev => ({
      ...prev,
      predicates: [...prev.predicates, val]
    }));
    setNewPredicate('');
  };

  const removePredicate = (predicateToRemove) => {
    setSchema(prev => ({
      ...prev,
      predicates: prev.predicates.filter(p => p !== predicateToRemove)
    }));
  };

  // Property Actions
  const addProperty = (node) => {
    if (!newProperty.trim()) return;
    setSchema(prev => {
      const nodeProps = prev.properties[node] || [];
      if (nodeProps.includes(newProperty.trim())) return prev;
      return {
        ...prev,
        properties: {
          ...prev.properties,
          [node]: [...nodeProps, newProperty.trim()]
        }
      };
    });
    setNewProperty('');
    setNewPropertyNode('');
  };

  const removeProperty = (node, propToRemove) => {
    setSchema(prev => ({
      ...prev,
      properties: {
        ...prev.properties,
        [node]: prev.properties[node].filter(p => p !== propToRemove)
      }
    }));
  };

  const handleApplySuggestion = async (suggestion) => {
    setSchema(prev => {
      const newSchema = { ...prev };
      
      // Merge nodes
      if (suggestion.nodes) {
        suggestion.nodes.forEach(n => {
          if (!newSchema.nodes.includes(n)) newSchema.nodes.push(n);
        });
      }
      
      // Merge predicates
      if (suggestion.predicates) {
        suggestion.predicates.forEach(p => {
          if (!newSchema.predicates.includes(p)) newSchema.predicates.push(p);
        });
      }
      
      // Merge properties
      if (suggestion.properties) {
        if (!newSchema.properties) newSchema.properties = {};
        Object.entries(suggestion.properties).forEach(([node, props]) => {
          if (!newSchema.properties[node]) newSchema.properties[node] = [];
          props.forEach(prop => {
            if (!newSchema.properties[node].includes(prop)) {
              newSchema.properties[node].push(prop);
            }
          });
        });
      }
      
      return newSchema;
    });
    
    // Auto-save after applying suggestion
    showNotification('success', 'Suggestion applied! Click Save to confirm.');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIngestingFile(true);
    setSuggestedUpdates(null);
    setExtractedFacts([]);

    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch(`${API_BASE}/agent/${agentId}/ingest_document`, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        showNotification('success', `File processed! Extracted ${data.extracted_facts?.length || 0} facts.`);
        if (data.suggested_updates && (data.suggested_updates.nodes?.length > 0 || data.suggested_updates.predicates?.length > 0)) {
          setSuggestedUpdates(data.suggested_updates);
        }
        setExtractedFacts(data.extracted_facts || []);
        // Trigger graph refresh to show facts
        setRefreshGraph(prev => prev + 1);
      } else {
        showNotification('error', data.message || 'Failed to process document.');
      }
    } catch (err) {
      showNotification('error', 'Network error occurred during document upload.');
    } finally {
      setIngestingFile(false);
      e.target.value = null;
    }
  };

  const applyIngestionUpdates = () => {
    if (!suggestedUpdates) return;
    handleApplySuggestion(suggestedUpdates);
    setSuggestedUpdates(null);
  };

  // We removed the full-screen loading to prevent unmounting the layout,
  // which causes ForceGraph2D to mount with 0x0 dimensions.
  return (
    <>
      <header className="glass-header">
        <div className="brand" style={{display: 'flex', alignItems: 'center', gap: '2rem'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <Network className="text-blue-500" />
            Ontology Editor
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
            {/* View Mode Toggle */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button 
                onClick={() => setViewMode('memory')}
                style={{ padding: '4px 12px', fontSize: '0.85rem', borderRadius: '4px', background: viewMode === 'memory' ? 'rgba(59, 130, 246, 0.5)' : 'transparent', color: viewMode === 'memory' ? 'white' : '#9ca3af', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                Memory Graph
              </button>
              <button 
                onClick={() => setViewMode('schema')}
                style={{ padding: '4px 12px', fontSize: '0.85rem', borderRadius: '4px', background: viewMode === 'schema' ? 'rgba(167, 139, 250, 0.5)' : 'transparent', color: viewMode === 'schema' ? 'white' : '#9ca3af', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                Ontology Schema
              </button>
              <button 
                onClick={() => setViewMode('inventory')}
                style={{ padding: '4px 12px', fontSize: '0.85rem', borderRadius: '4px', background: viewMode === 'inventory' ? 'rgba(236, 72, 153, 0.5)' : 'transparent', color: viewMode === 'inventory' ? 'white' : '#9ca3af', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                Operational Inventory
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="text-sm text-gray-400">Agent Schema:</span>
            <select 
              className="input-field" 
              style={{ width: 'auto', padding: '0.25rem 0.5rem', backgroundColor: 'rgba(0,0,0,0.3)' }}
              value={agentId}
              onChange={e => setAgentId(e.target.value)}
            >
              {/* Combine agents and schemas, remove duplicates */}
              {[...new Set([...agentsList, ...schemasList])].map(id => (
                <option key={id} value={id}>
                  {id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            {loading && <Database className="animate-spin text-blue-400" size={16} />}
            <button 
              onClick={() => setIsBuilderOpen(true)}
              className="add-btn bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/40"
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
            >
              <Plus size={14} /> New Ontology & Agent
            </button>
          </div>
        </div>
      </div>
      </header>

      <div className="workspace">
        <main className="main-canvas">
          {viewMode === 'inventory' ? (
            <InventoryExplorer 
              agentId={agentId} 
              schema={schema} 
              isSidebarOpen={isSidebarOpen} 
              refreshTrigger={refreshGraph} 
            />
          ) : (
            <GraphExplorer 
              agentId={agentId} 
              refreshTrigger={refreshGraph} 
              viewMode={viewMode}
              schema={schema}
              isSidebarOpen={isSidebarOpen}
            />
          )}
          
          <button 
            className={`sidebar-toggle ${!isAssistantOpen ? 'collapsed-toggle' : ''}`}
            onClick={() => setIsAssistantOpen(!isAssistantOpen)}
            style={{ left: isAssistantOpen ? '336px' : '1.5rem', zIndex: 100 }}
          >
            {isAssistantOpen ? <ChevronLeft size={20} /> : <PanelLeft size={20} />}
          </button>
          
          <button 
            className={`sidebar-toggle ${!isSidebarOpen ? 'collapsed-toggle' : ''}`}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{ right: isSidebarOpen ? '416px' : '1.5rem', zIndex: 100 }}
          >
            {isSidebarOpen ? <ChevronRight size={20} /> : <PanelRight size={20} />}
          </button>
        </main>
        
        <aside className={`sidebar left-sidebar ${!isAssistantOpen ? 'collapsed' : ''}`} style={{ width: '320px', zIndex: 90, height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <button 
              style={{ flex: 1, padding: '0.75rem', background: leftTab === 'assistant' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', borderBottom: leftTab === 'assistant' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', fontSize: '0.9rem' }}
              onClick={() => setLeftTab('assistant')}
            >
              Schema
            </button>
            <button 
              style={{ flex: 1, padding: '0.75rem', background: leftTab === 'chat' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', borderBottom: leftTab === 'chat' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', fontSize: '0.9rem' }}
              onClick={() => setLeftTab('chat')}
            >
              Agent
            </button>
            <button 
              style={{ flex: 1, padding: '0.75rem', background: leftTab === 'admin' ? 'rgba(16, 185, 129, 0.2)' : 'transparent', borderBottom: leftTab === 'admin' ? '2px solid #10b981' : '2px solid transparent', cursor: 'pointer', fontSize: '0.9rem' }}
              onClick={() => setLeftTab('admin')}
            >
              Admin
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {leftTab === 'assistant' ? (
              <OntologyAssistant agentId={agentId} currentSchema={schema} onApplySuggestion={handleApplySuggestion} />
            ) : leftTab === 'chat' ? (
              <AgentChat agentId={agentId} onUpdate={() => setRefreshGraph(prev => prev + 1)} />
            ) : (
              <AdminChat agentId={agentId} />
            )}
          </div>
        </aside>

        <aside className={`sidebar ${!isSidebarOpen ? 'collapsed' : ''}`}>
           <div className="sidebar-header">
             <h2 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings2 size={18} /> Schema Manager
             </h2>
             <button 
               className={`add-btn save-btn ${saving ? 'opacity-50' : ''}`}
               onClick={saveOntology}
               disabled={saving}
               style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
             >
               <Save size={16} />
               {saving ? 'Saving...' : 'Save'}
             </button>
           </div>
           
           <div className="sidebar-content">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Knowledge Ingestion */}
            <div className="glass-panel card">
              <h2 className="section-title">
                <FileText className="text-orange-400" />
                Knowledge Ingestion
              </h2>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '1rem', lineHeight: '1.4' }}>
                Upload files (PDF, audio, video, images) to extract facts and suggest ontology branches for the current agent.
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileUpload}
                accept=".pdf,.docx,.md,.txt,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.mp3,.wav,.mp4,.mov,.webm"
              />
              
              <button 
                className="add-btn" 
                style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)' }}
                onClick={() => fileInputRef.current?.click()}
                disabled={ingestingFile}
              >
                {ingestingFile ? <Database className="animate-spin" size={18} /> : <Upload size={18} />}
                {ingestingFile ? 'Processing...' : 'Upload Media / Document'}
              </button>

              {suggestedUpdates && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '0.5rem' }}>
                  <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#60a5fa' }}>
                    <Bot size={16} /> Ontology Suggestions
                  </h3>
                  
                  {suggestedUpdates.nodes?.length > 0 && (
                    <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      <strong className="text-blue-300">New Entities:</strong> {suggestedUpdates.nodes.join(', ')}
                    </div>
                  )}
                  {suggestedUpdates.predicates?.length > 0 && (
                    <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      <strong className="text-purple-300">New Relations:</strong> {suggestedUpdates.predicates.join(', ')}
                    </div>
                  )}
                  {Object.keys(suggestedUpdates.properties || {}).length > 0 && (
                    <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      <strong className="text-emerald-300">New Properties:</strong>
                      <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                        {Object.entries(suggestedUpdates.properties).map(([node, props]) => (
                          <li key={node}>{node}: {props.join(', ')}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="save-btn" 
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
                      onClick={applyIngestionUpdates}
                    >
                      <Check size={14} /> Merge Branches
                    </button>
                    <button 
                      className="action-btn" 
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }}
                      onClick={() => setSuggestedUpdates(null)}
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                </div>
              )}
              
              {extractedFacts.length > 0 && (
                <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#9ca3af' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <CheckCircle className="text-emerald-400" size={14} /> 
                    Extracted {extractedFacts.length} facts into Memory Graph.
                  </div>
                </div>
              )}
            </div>
            
            {/* RDF Legend */}
            <div className="glass-panel card" style={{ padding: '1rem 1.5rem' }}>
              <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                <Network className="text-gray-400" size={18} />
                RDF Legend
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#4ade80' }}></div>
                  <span className="text-sm">User Node</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#a78bfa' }}></div>
                  <span className="text-sm">Fact Node</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#60a5fa' }}></div>
                  <span className="text-sm">Default Node</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '20px', height: '2px', backgroundColor: 'white' }}></div>
                  <span className="text-sm">Predicate (Relation)</span>
                </div>
              </div>
            </div>

            {/* Nodes Configuration */}
          <div className="glass-panel card">
            <h2 className="section-title">
              <Database className="text-blue-400" />
              Entities (Nodes)
            </h2>
            
            <div className="item-list">
              {schema.nodes.map(node => (
                <div key={node} className="list-item">
                  <div className="list-item-content">
                    <span className="font-medium">{node}</span>
                    <span className="badge">{schema.properties[node]?.length || 0} props</span>
                  </div>
                  <button onClick={() => removeNode(node)} className="action-btn">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="input-group">
              <input 
                type="text" 
                className="input-field" 
                placeholder="New Entity (e.g., Project)"
                value={newNode}
                onChange={e => setNewNode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNode()}
              />
              <button className="add-btn" onClick={addNode}>
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Predicates Configuration */}
          <div className="glass-panel card">
            <h2 className="section-title">
              <Activity className="text-purple-400" />
              Relations (Predicates)
            </h2>
            
            <div className="item-list">
              {schema.predicates.map(pred => (
                <div key={pred} className="list-item">
                  <div className="list-item-content">
                    <span className="font-mono text-sm">{pred}</span>
                    <span className="badge predicate">Relation</span>
                  </div>
                  <button onClick={() => removePredicate(pred)} className="action-btn">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="input-group">
              <input 
                type="text" 
                className="input-field" 
                placeholder="New Relation (e.g., DEPENDS_ON)"
                value={newPredicate}
                onChange={e => setNewPredicate(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPredicate()}
              />
              <button className="add-btn" onClick={addPredicate}>
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Properties Configuration */}
          <div className="glass-panel card" style={{ gridColumn: '1 / -1' }}>
            <h2 className="section-title">
              <Network className="text-emerald-400" />
              Entity Properties
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '1rem', gap: '1rem' }}>
              {schema.nodes.map(node => (
                <div key={node} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong className="text-blue-300">{node}</strong>
                  </div>
                  
                  <div className="property-list">
                    {(schema.properties[node] || []).map(prop => (
                      <div key={prop} className="property-tag">
                        {prop}
                        <button className="property-remove" onClick={() => removeProperty(node, prop)}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="input-group" style={{ marginTop: 'auto' }}>
                    <input 
                      type="text" 
                      className="input-field" 
                      style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
                      placeholder="Add property..."
                      value={newPropertyNode === node ? newProperty : ''}
                      onChange={e => {
                        setNewPropertyNode(node);
                        setNewProperty(e.target.value);
                      }}
                      onKeyDown={e => e.key === 'Enter' && addProperty(node)}
                    />
                    <button className="add-btn" style={{ padding: '0.5rem 1rem' }} onClick={() => addProperty(node)}>
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

            </div>
          </div>
        </aside>
      </div>

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.type === 'success' ? <CheckCircle size={20} className="text-emerald-500" /> : <AlertCircle size={20} className="text-red-500" />}
          {notification.message}
        </div>
      )}

      {isBuilderOpen && (
        <AgentBuilder 
          onClose={() => setIsBuilderOpen(false)}
          onSave={handleAgentSaved}
        />
      )}
    </>
  );
}

export default App;
