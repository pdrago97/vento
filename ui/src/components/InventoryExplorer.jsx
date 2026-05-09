import { useState, useEffect, useMemo, useCallback } from 'react';
import { Database, Loader2, PackageOpen, Search, Filter, Calendar, Tag, AlertCircle } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

function InventoryExplorer({ agentId = 'global', schema, isSidebarOpen, refreshTrigger = 0 }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('All');

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

  const filteredItems = useMemo(() => {
    return inventoryItems.filter(item => {
      // Label filter
      if (selectedLabel !== 'All' && item.label !== selectedLabel) return false;
      
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const searchString = JSON.stringify(item).toLowerCase();
        if (!searchString.includes(query)) return false;
      }
      
      return true;
    });
  }, [inventoryItems, selectedLabel, searchQuery]);

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
    <div className="glass-panel" style={{ height: 'calc(100vh - 120px)', padding: '1.5rem', position: 'relative', overflowY: 'auto' }}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}>
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      )}
      
      {/* Header and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
            <PackageOpen className="text-purple-500" size={24} />
            Operational Inventory
          </h2>
          <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.9rem' }}>
            Manage and audit dynamic entities created and used by the {agentId} agent.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
              style={{ width: 'auto', padding: '0.25rem', backgroundColor: 'transparent', border: 'none' }}
              value={selectedLabel}
              onChange={e => setSelectedLabel(e.target.value)}
            >
              {availableLabels.map(label => (
                <option key={label} value={label}>{label}</option>
              ))}
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
          paddingBottom: '2rem'
        }}>
          {filteredItems.map(item => {
            const props = item.properties || {};
            const title = props.title || props.name || item.id;
            
            // Get all property keys except the ones we use for the header
            const propKeys = Object.keys(props).filter(k => k !== 'title' && k !== 'name');

            return (
              <div key={item.id} className="card" style={{ 
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease',
                cursor: 'default'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.05)';
              }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ flex: 1, marginRight: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <Tag size={12} className="text-blue-400" />
                      <span style={{ fontSize: '0.75rem', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{item.label}</span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 500, color: '#f3f4f6', lineHeight: 1.3, wordBreak: 'break-word' }}>
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
    </div>
  );
}

export default InventoryExplorer;
