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
  PanelRight,
  Bot
} from 'lucide-react';
import './index.css';
import GraphExplorer from './GraphExplorer';
import OntologyAssistant from './components/OntologyAssistant';
import AgentChat from './components/AgentChat';
import AgentBuilder from './components/AgentBuilder';

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
  const [viewMode, setViewMode] = useState('memory'); // 'memory' or 'schema'

  // Dynamic config states
  const [agentsList, setAgentsList] = useState(['global']);
  const [schemasList, setSchemasList] = useState(['global']);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  // Input states
  const [newNode, setNewNode] = useState('');
  const [newPredicate, setNewPredicate] = useState('');
  const [newPropertyNode, setNewPropertyNode] = useState('');
  const [newProperty, setNewProperty] = useState('');

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

  if (loading) return <div className="container" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh'}}><Database className="animate-spin" size={32} /></div>;

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
          <GraphExplorer 
            agentId={agentId} 
            refreshTrigger={refreshGraph} 
            viewMode={viewMode}
            schema={schema}
          />
          
          <button 
            className={`sidebar-toggle ${!isAssistantOpen ? 'collapsed-toggle' : ''}`}
            onClick={() => setIsAssistantOpen(!isAssistantOpen)}
            style={{ left: isAssistantOpen ? '320px' : '1.5rem', zIndex: 100 }}
          >
            {isAssistantOpen ? <ChevronRight style={{transform: 'rotate(180deg)'}} size={20} /> : <PanelRight style={{transform: 'rotate(180deg)'}} size={20} />}
          </button>
          
          <button 
            className={`sidebar-toggle ${!isSidebarOpen ? 'collapsed-toggle' : ''}`}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{ right: isSidebarOpen ? '416px' : '1.5rem' }}
          >
            {isSidebarOpen ? <ChevronRight size={20} /> : <PanelRight size={20} />}
          </button>
        </main>
        
        <aside className={`sidebar left-sidebar ${!isAssistantOpen ? 'collapsed' : ''}`} style={{ left: 0, right: 'auto', width: '320px', position: 'absolute', zIndex: 90, height: 'calc(100vh - 64px)', borderRight: '1px solid rgba(255,255,255,0.1)', borderLeft: 'none', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <button 
              style={{ flex: 1, padding: '0.75rem', background: leftTab === 'assistant' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', borderBottom: leftTab === 'assistant' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer' }}
              onClick={() => setLeftTab('assistant')}
            >
              Schema Assistant
            </button>
            <button 
              style={{ flex: 1, padding: '0.75rem', background: leftTab === 'chat' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', borderBottom: leftTab === 'chat' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer' }}
              onClick={() => setLeftTab('chat')}
            >
              Agent Chat
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {leftTab === 'assistant' ? (
              <OntologyAssistant agentId={agentId} currentSchema={schema} onApplySuggestion={handleApplySuggestion} />
            ) : (
              <AgentChat agentId={agentId} onUpdate={() => setRefreshGraph(prev => prev + 1)} />
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
