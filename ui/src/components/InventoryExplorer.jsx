import { useState, useEffect, useMemo, useCallback } from 'react';
import { Database, Loader2, PackageOpen, Search, Filter, Calendar, Tag, AlertCircle, X, Edit2, Save, Plus, Wand2, Sparkles, Network } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

function InventoryExplorer({ agentId = 'global', schema, isSidebarOpen, isAssistantOpen, refreshTrigger = 0, onOpenIngest, onJumpToGraph }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const [newPropKey, setNewPropKey] = useState('');
  const [newPropVal, setNewPropVal] = useState('');
  const [suggestedProperties, setSuggestedProperties] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [newConnectionTarget, setNewConnectionTarget] = useState('');
  const [newConnectionPredicate, setNewConnectionPredicate] = useState('');
  const [suggestedConnections, setSuggestedConnections] = useState([]);
  const [isSuggestingConnections, setIsSuggestingConnections] = useState(false);
  
  const [isOperationalizing, setIsOperationalizing] = useState(false);
  const [generatedTemplate, setGeneratedTemplate] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const entityContext = useMemo(() => {
    if (!selectedItem || !graphData) return '';
    const relevantLinks = graphData.links.filter(l => l.source === selectedItem.id || l.target === selectedItem.id);
    if (relevantLinks.length === 0) return 'No direct relations found in the graph.';
    
    return relevantLinks.map(l => {
      const isSource = l.source === selectedItem.id;
      const otherNodeId = isSource ? l.target : l.source;
      const otherNode = graphData.nodes.find(n => n.id === otherNodeId) || { label: 'Unknown', id: otherNodeId };
      const relation = l.relation || l.label || 'CONNECTED_TO';
      const otherTitle = otherNode.properties?.title || otherNode.properties?.name || otherNode.id;
      return isSource 
        ? `[This Entity] --${relation}--> [${otherNode.label}: ${otherTitle}]`
        : `[${otherNode.label}: ${otherTitle}] --${relation}--> [This Entity]`;
    }).join('\n');
  }, [selectedItem, graphData]);

  useEffect(() => {
    setIsEditing(false);
    setNewPropKey('');
    setNewPropVal('');
    setSuggestedProperties([]);
    setIsSuggesting(false);
    setIsImproving(false);
    setShowConnectionForm(false);
    setNewConnectionTarget('');
    setNewConnectionPredicate('');
    setSuggestedConnections([]);
    setIsSuggestingConnections(false);
    setGeneratedTemplate(null);
    setShowTemplateModal(false);
    if (selectedItem) {
      setEditFormData({
        id: selectedItem.id,
        label: selectedItem.label,
        properties: { ...(selectedItem.properties || {}) }
      });
    }
  }, [selectedItem]);

  const fetchGraphData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await fetch(`${API_BASE}/graph?agent_id=${agentId}`);
      if (!response.ok) throw new Error('Failed to fetch graph data');
      const data = await response.json();
      setGraphData(data);
    } catch (err) {
      console.error('Failed to fetch graph data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchGraphData(refreshTrigger > 0);
  }, [fetchGraphData, refreshTrigger]);

  const handleSaveEntity = async () => {
    if (!editFormData) return;
    try {
      setRefreshing(true);
      const res = await fetch(`${API_BASE}/graph/node?agent_id=${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      if (res.ok) {
        setIsEditing(false);
        fetchGraphData();
        setSelectedItem({ ...selectedItem, ...editFormData });
      } else {
        console.error('Failed to save entity');
      }
    } catch (e) {
      console.error('Error saving entity:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!newConnectionTarget || !newConnectionPredicate) return;
    try {
      setRefreshing(true);
      const res = await fetch(`${API_BASE}/graph/edge?agent_id=${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: selectedItem.id,
          target: newConnectionTarget,
          relation: newConnectionPredicate,
          properties: {}
        })
      });
      if (res.ok) {
        setShowConnectionForm(false);
        setNewConnectionTarget('');
        setNewConnectionPredicate('');
        fetchGraphData();
      } else {
        console.error('Failed to save connection');
      }
    } catch (e) {
      console.error('Error saving connection:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleEditPropChange = (key, val) => {
    setEditFormData(prev => ({
      ...prev,
      properties: { ...prev.properties, [key]: val }
    }));
  };

  const handleRemoveProp = (key) => {
    setEditFormData(prev => {
      const updated = { ...prev.properties };
      delete updated[key];
      return { ...prev, properties: updated };
    });
  };

  const handleAddProp = () => {
    if (newPropKey.trim()) {
      handleEditPropChange(newPropKey.trim(), newPropVal);
      setNewPropKey('');
      setNewPropVal('');
    }
  };

  const handleSuggestProperties = async () => {
    setIsSuggesting(true);
    try {
      const response = await fetch(`${API_BASE}/ontology/suggest_properties?agent_id=${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: editFormData?.label || 'Unknown',
          properties: editFormData?.properties || {},
          context: entityContext
        })
      });
      const data = await response.json();
      if (data.status === 'success' && data.suggestions) {
        setSuggestedProperties(data.suggestions);
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleImproveNode = async () => {
    setIsImproving(true);
    try {
      const response = await fetch(`${API_BASE}/ontology/improve_node?agent_id=${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: editFormData?.label || 'Unknown',
          properties: editFormData?.properties || {},
          context: entityContext
        })
      });
      const data = await response.json();
      if (data.status === 'success' && data.properties) {
        setEditFormData(prev => ({
          ...prev,
          properties: data.properties
        }));
      }
    } catch (error) {
      console.error("Failed to improve entity:", error);
    } finally {
      setIsImproving(false);
    }
  };

  const handleSuggestConnections = async () => {
    setIsSuggestingConnections(true);
    try {
      const response = await fetch(`${API_BASE}/ontology/suggest_connections?agent_id=${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: selectedItem?.label || 'Unknown',
          properties: selectedItem?.properties || {},
          context: entityContext
        })
      });
      const data = await response.json();
      if (data.status === 'success' && data.suggestions) {
        setSuggestedConnections(data.suggestions);
        setShowConnectionForm(true); // Open form to show suggestions
      }
    } catch (error) {
      console.error("Failed to fetch connection suggestions:", error);
    } finally {
      setIsSuggestingConnections(false);
    }
  };

  const handleOperationalizeContext = async () => {
    setIsOperationalizing(true);
    try {
      // Create a specific subgraph context for the prompt
      const nodeData = {
        id: selectedItem.id,
        label: selectedItem.label,
        properties: selectedItem.properties
      };
      
      const response = await fetch(`${API_BASE}/agent/${agentId}/action_template/generate_from_context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_data: nodeData,
          context: entityContext,
          intent: "Create a reusable action based on this node and its relations."
        })
      });
      const data = await response.json();
      if (data.status === 'success' && data.action_template) {
        setGeneratedTemplate(data.action_template);
        setShowTemplateModal(true);
      }
    } catch (error) {
      console.error("Failed to generate action template:", error);
    } finally {
      setIsOperationalizing(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!generatedTemplate) return;
    setIsSavingTemplate(true);
    try {
      const response = await fetch(`${API_BASE}/agents/${agentId}/action_templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generatedTemplate)
      });
      const data = await response.json();
      if (data.status === 'success') {
        setShowTemplateModal(false);
        setGeneratedTemplate(null);
      } else {
         console.error("Failed to save template:", data.message);
      }
    } catch (error) {
      console.error("Error saving action template:", error);
    } finally {
      setIsSavingTemplate(false);
    }
  };


  // Operational objects are nodes that:
  // 1. Aren't base system nodes (Class, OntologyClass, OntologyProperty, RelationsHub, OntologyPredicate)
  // 2. Aren't 'Fact' (which are memory structures)
  // 3. Aren't 'User' (usually these are actors, though they could be considered inventory in some CRMs, we'll keep them if requested, but for now we'll include them as they might be part of the schema)
  const inventoryItems = useMemo(() => {
    const ignoreLabels = ['Class', 'OntologyClass', 'OntologyProperty', 'RelationsHub', 'OntologyPredicate', 'Fact'];
    return graphData.nodes.filter(n => !ignoreLabels.includes(n.label));
  }, [graphData.nodes]);

  const availableLabels = useMemo(() => {
    const labels = new Set(inventoryItems.map(item => item.label));
    return ['All', ...Array.from(labels)].filter(Boolean);
  }, [inventoryItems]);

  useEffect(() => {
    if (!availableLabels.includes(selectedLabel) && selectedLabel !== 'All') {
      setSelectedLabel('All');
    }
  }, [availableLabels, selectedLabel]);

  const availableStatuses = useMemo(() => {
    const statuses = new Set(inventoryItems.map(item => item.properties?.status).filter(Boolean));
    return ['All', ...Array.from(statuses)];
  }, [inventoryItems]);

  const availablePriorities = useMemo(() => {
    const priorities = new Set(inventoryItems.map(item => item.properties?.priority).filter(Boolean));
    return ['All', ...Array.from(priorities)];
  }, [inventoryItems]);

  useEffect(() => {
    if (!availableStatuses.includes(statusFilter) && statusFilter !== 'All') {
      setStatusFilter('All');
    }
  }, [availableStatuses, statusFilter]);

  useEffect(() => {
    if (!availablePriorities.includes(priorityFilter) && priorityFilter !== 'All') {
      setPriorityFilter('All');
    }
  }, [availablePriorities, priorityFilter]);

  const filteredItems = useMemo(() => {
    let result = inventoryItems.filter(item => {
      // Label filter
      if (selectedLabel !== 'All' && item.label !== selectedLabel) return false;
      
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const searchString = JSON.stringify(item).toLowerCase();
        if (!searchString.includes(query)) return false;
      }
      
      // Status filter
      if (statusFilter !== 'All') {
         if (!item.properties.status || item.properties.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      }

      // Priority filter
      if (priorityFilter !== 'All') {
         if (!item.properties.priority || item.properties.priority.toLowerCase() !== priorityFilter.toLowerCase()) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      const aTime = a.properties.timestamp || a.properties.created_at || 0;
      const bTime = b.properties.timestamp || b.properties.created_at || 0;
      const aTitle = String(a.properties.title || a.properties.name || a.id || '').toLowerCase();
      const bTitle = String(b.properties.title || b.properties.name || b.id || '').toLowerCase();

      if (sortBy === 'newest') return bTime - aTime;
      if (sortBy === 'oldest') return aTime - bTime;
      if (sortBy === 'a-z') return aTitle.localeCompare(bTitle);
      if (sortBy === 'z-a') return bTitle.localeCompare(aTitle);
      return 0;
    });

    return result;
  }, [inventoryItems, selectedLabel, searchQuery, statusFilter, priorityFilter, sortBy]);

  const renderCardProperty = (key, value) => {
    if (key === 'id') return null; // usually redundant with title or displayed elsewhere
    if (key === 'created_at' || key === 'timestamp') {
      const date = new Date(value * 1000); // Assuming unix timestamp
      return (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.5rem' }}>
          <Calendar size={12} />
          {isNaN(date) ? String(value) : date.toLocaleString()}
        </div>
      );
    }

    let displayValue = String(value);
    let colorClass = 'text-gray-300';
    
    // Status/Priority color coding (very common in operational objects)
    if (key === 'status') {
      if (['open', 'active', 'pending'].includes(displayValue.toLowerCase())) colorClass = 'text-emerald-400 bg-emerald-400/10';
      else if (['closed', 'resolved', 'done'].includes(displayValue.toLowerCase())) colorClass = 'text-gray-400 bg-gray-400/10';
      else if (['investigating', 'in_progress', 'working'].includes(displayValue.toLowerCase())) colorClass = 'text-blue-400 bg-blue-400/10';
      else colorClass = 'text-purple-400 bg-purple-400/10';
    }

    if (key === 'priority') {
      if (displayValue.toLowerCase() === 'high') colorClass = 'text-red-400 bg-red-400/10';
      else if (displayValue.toLowerCase() === 'medium' || displayValue.toLowerCase() === 'normal') colorClass = 'text-orange-400 bg-orange-400/10';
      else colorClass = 'text-emerald-400 bg-emerald-400/10';
    }

    // Is it a badge-like property?
    if (key === 'status' || key === 'priority') {
      return (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem', padding: '0.25rem 0' }}>
          <span style={{ color: '#6b7280', textTransform: 'capitalize' }}>{key}</span>
          <span style={{ padding: '0.1rem 0.5rem', borderRadius: '1rem', fontWeight: 500 }} className={colorClass}>{displayValue}</span>
        </div>
      );
    }

    // Long text property (e.g., description)
    if (displayValue.length > 50) {
      return (
        <div key={key} style={{ fontSize: '0.85rem', marginBottom: '0.5rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ color: '#6b7280', marginBottom: '0.25rem', textTransform: 'capitalize', fontSize: '0.75rem' }}>{key}</div>
          <div style={{ color: '#d1d5db', lineHeight: '1.4' }}>{displayValue}</div>
        </div>
      );
    }

    // Standard property
    return (
      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem', padding: '0.25rem 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
        <span style={{ color: '#6b7280', textTransform: 'capitalize' }}>{key}</span>
        <span style={{ color: '#d1d5db' }}>{displayValue}</span>
      </div>
    );
  };

  return (
    <div className="glass-panel" style={{ 
      height: 'calc(100vh - 120px)', 
      position: 'relative', 
      overflowY: 'auto',
      overflowX: 'hidden',
      paddingTop: '2rem',
      paddingBottom: '2rem',
      paddingLeft: isAssistantOpen ? '340px' : '2rem',
      paddingRight: isSidebarOpen ? '420px' : '2rem',
      transition: 'padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}>
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      )}
      
      {/* Header and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ flex: '1 1 min-content' }}>
          <h2 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
            <PackageOpen className="text-purple-500" size={24} />
            Operational Inventory
          </h2>
          <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.9rem' }}>
            Manage and audit dynamic entities created and used by the {agentId} agent.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Ingest Button */}
          {onOpenIngest && (
            <button 
              onClick={onOpenIngest}
              style={{ 
                padding: '0.4rem 1rem', 
                fontSize: '0.85rem', 
                fontWeight: 600,
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                backgroundColor: '#f97316', // orange-500
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                boxShadow: '0 2px 10px rgba(249, 115, 22, 0.3)',
                cursor: 'pointer'
              }}
            >
              <Database size={14} /> Ingest Knowledge
            </button>
          )}

          {/* Search */}
          <div className="input-group" style={{ margin: 0, width: '250px' }}>
            <Search size={16} className="text-gray-400" style={{ marginLeft: '0.75rem' }} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search inventory..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '0.5rem', border: 'none', backgroundColor: 'transparent' }}
            />
          </div>

          {/* Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(0,0,0,0.3)', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Filter size={16} className="text-gray-400" />
            <select 
              className="input-field" 
              style={{ width: 'auto', padding: '0.25rem', backgroundColor: 'transparent', border: 'none', color: '#fff' }}
              value={selectedLabel}
              onChange={e => setSelectedLabel(e.target.value)}
              title="Filter by Label"
            >
              {availableLabels.map(label => (
                <option key={label} value={label} style={{ color: '#000' }}>{label}</option>
              ))}
            </select>
            
            <select 
              className="input-field" 
              style={{ width: 'auto', padding: '0.25rem', backgroundColor: 'transparent', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              title="Filter by Status"
            >
              <option value="All" style={{ color: '#000' }}>Status: All</option>
              {availableStatuses.filter(s => s !== 'All').map(s => (
                <option key={s} value={s} style={{ color: '#000' }}>{s}</option>
              ))}
            </select>

            <select 
              className="input-field" 
              style={{ width: 'auto', padding: '0.25rem', backgroundColor: 'transparent', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              title="Filter by Priority"
            >
              <option value="All" style={{ color: '#000' }}>Priority: All</option>
              {availablePriorities.filter(p => p !== 'All').map(p => (
                <option key={p} value={p} style={{ color: '#000' }}>{p}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(0,0,0,0.3)', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af', paddingLeft: '0.25rem' }}>Sort by:</span>
            <select 
              className="input-field" 
              style={{ width: 'auto', padding: '0.25rem', backgroundColor: 'transparent', border: 'none', color: '#fff' }}
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="newest" style={{ color: '#000' }}>Newest</option>
              <option value="oldest" style={{ color: '#000' }}>Oldest</option>
              <option value="a-z" style={{ color: '#000' }}>A-Z</option>
              <option value="z-a" style={{ color: '#000' }}>Z-A</option>
            </select>
          </div>

          {refreshing && (
            <Loader2 className="animate-spin text-blue-400" size={20} />
          )}
        </div>
      </div>

      {/* Grid */}
      {filteredItems.length === 0 && !loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', color: '#6b7280', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '1rem' }}>
          <AlertCircle size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#9ca3af' }}>No Inventory Found</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', textAlign: 'center', maxWidth: '400px' }}>
            There are no operational entities matching your current filters for the <strong>{agentId}</strong> agent.
          </p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
          gap: '1.5rem',
          paddingBottom: '2rem',
          width: selectedItem ? 'calc(100% - 380px)' : '100%',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          {filteredItems.map(item => {
            const props = item.properties || {};
            const title = props.title || props.name || item.id;
            
            // Get all property keys except the ones we use for the header
            const propKeys = Object.keys(props).filter(k => k !== 'title' && k !== 'name');

            return (
              <div key={item.id} className={`glass-panel card ${selectedItem?.id === item.id ? 'ring-2 ring-purple-500' : ''}`} onClick={() => setSelectedItem(item)} style={{ 
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                background: 'rgba(30, 41, 59, 0.4)',
                transform: selectedItem?.id === item.id ? 'translateY(-2px)' : 'none',
                transition: 'all 0.2s ease'
              }}>
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ flex: 1, marginRight: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <Tag size={12} className="text-blue-400" />
                      <span className="badge">{item.label}</span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc', lineHeight: 1.3, wordBreak: 'break-word' }}>
                      {title}
                    </h3>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {propKeys.map(key => renderCardProperty(key, props[key]))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Side Peek Detail Drawer */}
      {selectedItem && (
        <div className="glass-panel" style={{
          position: 'fixed',
          top: '100px', // Below top bar
          right: isSidebarOpen ? '420px' : '2rem',
          bottom: '2rem',
          width: '380px',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.5)',
          padding: '1.5rem',
          overflowY: 'auto',
          transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          borderRadius: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
             <div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Tag size={12} className="text-blue-400" />
                  <span className="badge">{selectedItem.label}</span>
               </div>
               <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc', fontWeight: 600 }}>
                 {selectedItem.properties?.title || selectedItem.properties?.name || selectedItem.id}
               </h3>
             </div>
             <div style={{ display: 'flex', gap: '0.5rem' }}>
               <button onClick={handleOperationalizeContext} disabled={isOperationalizing} className="btn-icon" style={{ background: 'rgba(168, 85, 247, 0.2)', padding: '0.5rem', borderRadius: '50%', color: '#d8b4fe' }} title="Operationalize Context">
                 {isOperationalizing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
               </button>
               {onJumpToGraph && (
                 <button onClick={() => onJumpToGraph(selectedItem.id)} className="btn-icon" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '50%', color: '#60a5fa' }} title="Jump to Graph">
                   <Network size={16} />
                 </button>
               )}
               {!isEditing ? (
                 <button onClick={() => setIsEditing(true)} className="btn-icon" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '50%' }} title="Edit Entity">
                   <Edit2 size={16} />
                 </button>
               ) : (
                 <button onClick={() => setIsEditing(false)} className="btn-icon" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '50%', color: '#9ca3af' }} title="Cancel Editing">
                   <X size={16} />
                 </button>
               )}
               <button onClick={() => setSelectedItem(null)} className="btn-icon" style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '50%' }}>
                 <X size={16}/>
               </button>
             </div>
          </div>
          
          {!isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
               {Object.entries(selectedItem.properties || {}).map(([k, v]) => renderCardProperty(k, v))}
               
               <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                 <div style={{ color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.05em' }}>Graph Context</div>
                 <pre style={{ color: '#9ca3af', lineHeight: '1.4', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                   {entityContext}
                 </pre>
               </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <div className="form-group" style={{ marginBottom: 0 }}>
                 <label className="form-label" style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Label / Type</label>
                 <input 
                   className="input-field"
                   style={{ width: '100%', padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}
                   value={editFormData?.label || ''} 
                   onChange={e => setEditFormData(prev => ({ ...prev, label: e.target.value }))} 
                 />
               </div>
               
               <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', margin: '0.5rem 0' }}></div>
               
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                 <label className="form-label" style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: 0 }}>Properties</label>
                 <div style={{ display: 'flex', gap: '0.5rem' }}>
                   <button onClick={handleImproveNode} disabled={isImproving} className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', display: 'flex', gap: '0.25rem', alignItems: 'center', color: '#c084fc' }}>
                     {isImproving ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                     Improve
                   </button>
                   <button onClick={handleSuggestProperties} disabled={isSuggesting} className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', display: 'flex', gap: '0.25rem', alignItems: 'center', color: '#60a5fa' }}>
                     {isSuggesting ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                     Suggest
                   </button>
                 </div>
               </div>
               
               {suggestedProperties.length > 0 && (
                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                   {suggestedProperties.map((sug, idx) => (
                     <button key={idx} onClick={() => {
                       handleEditPropChange(sug.key, sug.value);
                       setSuggestedProperties(prev => prev.filter((_, i) => i !== idx));
                     }} style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '12px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', color: '#93c5fd', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                       <Plus size={10} /> {sug.key}
                     </button>
                   ))}
                 </div>
               )}

               
               {(() => {
                 const schemaProps = schema?.properties?.[editFormData?.label] || [];
                 const uiLayout = schema?.ui_layout?.[editFormData?.label] || {};
                 const allPropKeys = Array.from(new Set([...schemaProps, ...Object.keys(editFormData?.properties || {})]));
                 
                 return allPropKeys.map((key) => {
                   const val = editFormData?.properties?.[key] || '';
                   const layoutHint = uiLayout[key];
                   const isSelect = layoutHint?.startsWith('select:');
                   const selectOptions = isSelect ? layoutHint.replace('select:', '').split(',') : [];
                   
                   const isLongText = layoutHint === 'textarea' || ['description', 'summary', 'context', 'notes', 'objective', 'content'].includes(key.toLowerCase()) || String(val).length > 50;
                   const isSchemaProp = schemaProps.includes(key);

                   return (isLongText || isSelect) ? (
                     <div key={key} className="flex-col" style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                         <span style={{ color: isSchemaProp ? '#e5e7eb' : '#9ca3af', fontSize: '0.8rem', fontWeight: 500 }}>
                           {key} {isSchemaProp && <span style={{ color: '#3b82f6', fontSize: '0.7rem', marginLeft: '0.2rem' }}>(schema)</span>}
                         </span>
                         {!isSchemaProp && <button onClick={() => handleRemoveProp(key)} className="btn-icon" style={{ color: '#ef4444', padding: '0.2rem' }}><X size={14} /></button>}
                       </div>
                       {isSelect ? (
                         <select
                           className="input-field"
                           value={val}
                           onChange={e => handleEditPropChange(key, e.target.value)}
                           style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem', color: '#e5e7eb' }}
                         >
                           <option value="" style={{ color: '#9ca3af' }}>Select {key}...</option>
                           {selectOptions.map(opt => (
                             <option key={opt} value={opt} style={{ color: '#111827' }}>{opt}</option>
                           ))}
                         </select>
                       ) : (
                         <textarea
                           className="input-field"
                           value={val}
                           onChange={e => handleEditPropChange(key, e.target.value)}
                           style={{ width: '100%', minHeight: '80px', resize: 'vertical', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem' }}
                         />
                       )}
                     </div>
                   ) : (
                     <div key={key} className="flex-row" style={{ alignItems: 'center', gap: '0.5rem' }}>
                       <div style={{ width: '35%', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                         <input 
                           readOnly 
                           value={key}
                           style={{ width: '100%', fontSize: '0.8rem', color: isSchemaProp ? '#e5e7eb' : '#9ca3af', background: 'transparent', border: 'none', textOverflow: 'ellipsis' }} 
                           title={key}
                         />
                       </div>
                       <input 
                         className="input-field"
                         value={val} 
                         onChange={e => handleEditPropChange(key, e.target.value)} 
                         style={{ width: '50%', padding: '0.4rem', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)' }} 
                       />
                       {!isSchemaProp && (
                         <button onClick={() => handleRemoveProp(key)} className="btn-icon" style={{ color: '#ef4444', padding: '0.4rem', marginLeft: 'auto' }}>
                           <X size={14} />
                         </button>
                       )}
                     </div>
                   );
                 });
               })()}
               
               <div className="flex-row" style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)', gap: '0.5rem' }}>
                 <input 
                   className="input-field"
                   placeholder="Key"
                   value={newPropKey} 
                   onChange={e => setNewPropKey(e.target.value)} 
                   style={{ width: '40%', padding: '0.4rem', backgroundColor: 'rgba(0,0,0,0.2)' }} 
                 />
                 <input 
                   className="input-field"
                   placeholder="Value"
                   value={newPropVal} 
                   onChange={e => setNewPropVal(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleAddProp()}
                   style={{ width: '45%', padding: '0.4rem', backgroundColor: 'rgba(0,0,0,0.2)' }} 
                 />
                 <button onClick={handleAddProp} className="btn-icon" style={{ background: 'var(--primary-color)', color: 'white', padding: '0.4rem', borderRadius: '4px', marginLeft: 'auto' }}>
                   <Plus size={14} />
                 </button>
               </div>
               
               <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', margin: '1rem 0' }}></div>
               <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <label className="form-label" style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: 0 }}>Connections</label>
                 <div style={{ display: 'flex', gap: '0.5rem' }}>
                   <button onClick={handleSuggestConnections} disabled={isSuggestingConnections} className="btn-icon" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#d8b4fe', padding: '0.3rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                     {isSuggestingConnections ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Suggest
                   </button>
                   <button onClick={() => setShowConnectionForm(!showConnectionForm)} className="btn-icon" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', padding: '0.3rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                     <Network size={12} /> {showConnectionForm ? 'Cancel' : 'Add'}
                   </button>
                 </div>
               </div>
               
               {showConnectionForm && (
                 <div style={{ padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                   <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Create new connection from this entity to another.</div>
                   
                   {suggestedConnections.length > 0 && (
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                       {suggestedConnections.map((sug, idx) => (
                         <button key={idx} onClick={() => {
                           // Find target node id based on label
                           const targetNode = graphData.nodes.find(n => n.label === sug.target_label && n.id !== selectedItem.id);
                           if (targetNode) {
                             setNewConnectionTarget(targetNode.id);
                           }
                           setNewConnectionPredicate(sug.predicate);
                           setSuggestedConnections(prev => prev.filter((_, i) => i !== idx));
                         }} style={{ background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '12px', padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#e9d5ff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', gap: '0.25rem' }}>
                           <div style={{ fontWeight: 600 }}>{sug.predicate} &rarr; {sug.target_label}</div>
                           <div style={{ fontSize: '0.65rem', color: '#d8b4fe', opacity: 0.8 }}>{sug.reason}</div>
                         </button>
                       ))}
                     </div>
                   )}

                   <select
                     className="input-field"
                     value={newConnectionTarget}
                     onChange={e => setNewConnectionTarget(e.target.value)}
                     style={{ padding: '0.4rem', backgroundColor: 'rgba(0,0,0,0.2)' }}
                   >
                     <option value="">Select Target Node...</option>
                     {graphData.nodes.filter(n => n.id !== selectedItem.id).map(n => (
                       <option key={n.id} value={n.id}>{n.label}: {n.properties?.title || n.properties?.name || n.id}</option>
                     ))}
                   </select>

                   <input
                     className="input-field"
                     list="schema-predicates"
                     placeholder="Relation Predicate (e.g., HAS_TICKET)"
                     value={newConnectionPredicate}
                     onChange={e => setNewConnectionPredicate(e.target.value)}
                     style={{ padding: '0.4rem', backgroundColor: 'rgba(0,0,0,0.2)' }}
                   />
                   <datalist id="schema-predicates">
                     {schema?.predicates?.map(p => <option key={p} value={p} />)}
                   </datalist>

                   <button 
                     onClick={handleSaveConnection} 
                     disabled={!newConnectionTarget || !newConnectionPredicate || refreshing}
                     className="btn btn-primary" 
                     style={{ marginTop: '0.5rem', padding: '0.4rem', fontSize: '0.8rem', justifyContent: 'center' }}
                   >
                     {refreshing ? <Loader2 size={14} className="animate-spin" /> : 'Save Connection'}
                   </button>
                 </div>
               )}

               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                 {graphData.links.filter(l => l.source === selectedItem.id || l.target === selectedItem.id).length === 0 ? (
                   <div style={{ color: '#6b7280', fontSize: '0.8rem', fontStyle: 'italic' }}>No connections found.</div>
                 ) : (
                   graphData.links.filter(l => l.source === selectedItem.id || l.target === selectedItem.id).map((l, i) => {
                     const isSource = l.source === selectedItem.id;
                     const otherNodeId = isSource ? l.target : l.source;
                     const otherNode = graphData.nodes.find(n => n.id === otherNodeId) || { label: 'Unknown', id: otherNodeId };
                     const otherTitle = otherNode.properties?.title || otherNode.properties?.name || otherNode.id;
                     return (
                       <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '0.75rem', color: '#d1d5db' }}>
                         {isSource ? (
                           <><span style={{ color: '#9ca3af' }}>[This]</span> <span style={{ color: '#c084fc' }}>--{l.relation || l.label}--&gt;</span> <span>{otherNode.label}: {otherTitle}</span></>
                         ) : (
                           <><span>{otherNode.label}: {otherTitle}</span> <span style={{ color: '#c084fc' }}>--{l.relation || l.label}--&gt;</span> <span style={{ color: '#9ca3af' }}>[This]</span></>
                         )}
                       </div>
                     );
                   })
                 )}
               </div>
               
               <button onClick={handleSaveEntity} className="btn btn-primary" style={{ marginTop: '1rem', justifyContent: 'center' }}>
                 <Save size={16} style={{ marginRight: '0.5rem' }} /> Save Entity
               </button>
            </div>
          )}
        </div>
      )}

      {/* Template Review Modal */}
      {showTemplateModal && generatedTemplate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '600px', maxWidth: '90vw', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles className="text-purple-400" size={20} /> Review Action Template
              </h3>
              <button onClick={() => setShowTemplateModal(false)} className="btn-icon">
                <X size={20} />
              </button>
            </div>
            
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', margin: 0 }}>
              The following custom tool has been generated based on the selected subgraph context. Once saved, the agent will immediately be able to use this tool.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Tool Name</label>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)', color: '#f8fafc', fontFamily: 'monospace' }}>
                  {generatedTemplate.tool_name}
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Description</label>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)', color: '#d1d5db', fontSize: '0.9rem' }}>
                  {generatedTemplate.description}
                </div>
              </div>

              {generatedTemplate.parameters && Object.keys(generatedTemplate.parameters).length > 0 && (
                <div>
                  <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Parameters</label>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {Object.entries(generatedTemplate.parameters).map(([key, details]) => (
                      <div key={key} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                        <span style={{ color: '#60a5fa', fontWeight: 600 }}>{key}</span>
                        <span style={{ color: '#9ca3af' }}>({details.type}):</span>
                        <span style={{ color: '#d1d5db' }}>{details.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Cypher Query</label>
                <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)', color: '#a78bfa', fontSize: '0.85rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {generatedTemplate.cypher_query}
                </pre>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
              <button onClick={() => setShowTemplateModal(false)} className="btn btn-ghost" disabled={isSavingTemplate}>
                Cancel
              </button>
              <button onClick={handleSaveTemplate} className="btn btn-primary" disabled={isSavingTemplate}>
                {isSavingTemplate ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span style={{ marginLeft: '0.5rem' }}>Save to Agent</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryExplorer;
