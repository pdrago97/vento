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
import './App.css';
import GraphExplorer from './GraphExplorer';
import OntologyAssistant from './components/OntologyAssistant';
import AgentChat from './components/AgentChat';
import AgentBuilder from './components/AgentBuilder';
import AdminChat from './components/AdminChat';
import InventoryExplorer from './components/InventoryExplorer';
import CustomReportsDashboard from './components/CustomReportsDashboard';
import KnowledgeIngestionModal from './components/KnowledgeIngestionModal';
import SchemaConfigPanel from './components/SchemaConfigPanel';
import CustomerChatWidget from './components/CustomerChatWidget';
import ObservabilityDashboard from './components/ObservabilityDashboard';

const API_BASE = 'http://localhost:8000';

function App() {
  const [schema, setSchema] = useState({ nodes: [], predicates: [], properties: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(true);
  const [agentId, setAgentId] = useState('global');
  const [activeTab, setActiveTab] = useState('schema'); // 'schema', 'memory', 'inventory'
  const viewMode = activeTab;
  const [refreshGraph, setRefreshGraph] = useState(0);

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
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);

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

  const handleIngestSuccess = (data) => {
    showNotification('success', `File processed! Extracted ${data.extracted_facts?.length || 0} facts.`);
    if (data.suggested_updates && (data.suggested_updates.nodes?.length > 0 || data.suggested_updates.predicates?.length > 0)) {
      setSuggestedUpdates(data.suggested_updates);
    }
    setExtractedFacts(data.extracted_facts || []);
    setRefreshGraph(prev => prev + 1);
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
        <div className="brand">
          <Network className="text-primary" size={24} />
          Vento
        </div>
          
        <div className="flex-row" style={{ gap: '1.5rem' }}>
          <div className="flex-row" style={{ gap: '0.75rem' }}>
            <span className="text-sm font-medium text-muted">Agent Schema:</span>
            <select 
              className="input-field" 
              style={{ width: 'auto', padding: '0.4rem 2rem 0.4rem 0.75rem', borderRadius: 'var(--radius-sm)' }}
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
            {loading && <Database className="animate-spin text-primary" size={16} />}
            <button 
              onClick={() => setIsBuilderOpen(true)}
              className="btn btn-secondary btn-sm"
            >
              <Plus size={14} /> New
            </button>

            <button 
              onClick={saveOntology}
              disabled={saving}
              className="btn btn-primary btn-sm"
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      <div className="workspace">
        <main className="main-canvas">
          {viewMode === 'inventory' ? (
            <InventoryExplorer 
              agentId={agentId} 
              schema={schema} 
              isSidebarOpen={false} 
              isAssistantOpen={isAssistantOpen}
              refreshTrigger={refreshGraph} 
              onOpenIngest={() => setIsIngestModalOpen(true)}
            />
          ) : viewMode === 'reports' ? (
            <CustomReportsDashboard 
              agentId={agentId} 
              isSidebarOpen={false} 
              isAssistantOpen={isAssistantOpen}
            />
          ) : viewMode === 'observability' ? (
            <ObservabilityDashboard 
              agentId={agentId} 
            />
          ) : (
            <GraphExplorer 
              agentId={agentId} 
              refreshTrigger={refreshGraph} 
              viewMode={viewMode}
              schema={schema}
              isSidebarOpen={false}
            />
          )}
          
          <button 
            className={`sidebar-toggle ${!isAssistantOpen ? 'collapsed-toggle' : ''}`}
            onClick={() => setIsAssistantOpen(!isAssistantOpen)}
            style={{ left: isAssistantOpen ? '336px' : '1.5rem', zIndex: 100 }}
          >
            {isAssistantOpen ? <ChevronLeft size={20} /> : <PanelLeft size={20} />}
          </button>
        </main>
        
        <aside className={`sidebar left-sidebar ${!isAssistantOpen ? 'collapsed' : ''}`} style={{ width: '320px', zIndex: 90, height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
          <div className="sidebar-tabs">
            <button 
              className={`sidebar-tab ${activeTab === 'schema' ? 'active' : ''}`}
              onClick={() => setActiveTab('schema')}
            >
              Ontology Schema
            </button>
            <button 
              className={`sidebar-tab ${activeTab === 'memory' ? 'active' : ''}`}
              onClick={() => setActiveTab('memory')}
            >
              Memory Graph
            </button>
            <button 
              className={`sidebar-tab ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveTab('inventory')}
            >
              Operational Inventory
            </button>
            <button 
              className={`sidebar-tab ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              Custom Reports
            </button>
            <button 
              className={`sidebar-tab ${activeTab === 'observability' ? 'active' : ''}`}
              onClick={() => setActiveTab('observability')}
            >
              Observability
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'schema' ? (
              <>
                <OntologyAssistant agentId={agentId} currentSchema={schema} onApplySuggestion={handleApplySuggestion} />
                <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <SchemaConfigPanel 
                    schema={schema}
                    newNode={newNode} setNewNode={setNewNode} addNode={addNode} removeNode={removeNode}
                    newPredicate={newPredicate} setNewPredicate={setNewPredicate} addPredicate={addPredicate} removePredicate={removePredicate}
                    newPropertyNode={newPropertyNode} setNewPropertyNode={setNewPropertyNode} newProperty={newProperty} setNewProperty={setNewProperty} addProperty={addProperty} removeProperty={removeProperty}
                  />
                </div>
              </>
            ) : activeTab === 'inventory' ? (
              <InventoryExplorer agentId={agentId} />
            ) : activeTab === 'reports' ? (
              <CustomReportsDashboard agentId={agentId} />
            ) : activeTab === 'observability' ? (
              <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                Select an agent from the top bar to view its observability metrics, interactions, sessions, and sync events.
              </div>
            ) : activeTab === 'memory' ? (
              <AgentChat agentId={agentId} onUpdate={() => setRefreshGraph(prev => prev + 1)} />
            ) : (
              <AdminChat agentId={agentId} />
            )}
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

      {isIngestModalOpen && (
        <KnowledgeIngestionModal
          agentId={agentId}
          onClose={() => setIsIngestModalOpen(false)}
          onIngestSuccess={handleIngestSuccess}
          ingestingFile={ingestingFile}
          setIngestingFile={setIngestingFile}
          suggestedUpdates={suggestedUpdates}
          setSuggestedUpdates={setSuggestedUpdates}
          extractedFacts={extractedFacts}
          setExtractedFacts={setExtractedFacts}
          applyIngestionUpdates={applyIngestionUpdates}
          showNotification={showNotification}
        />
      )}

      {/* Floating Customer Chat Widget */}
      <CustomerChatWidget agentId={agentId} />
    </>
  );
}

export default App;
