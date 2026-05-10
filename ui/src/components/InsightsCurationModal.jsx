import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, Check, ArrowRight } from 'lucide-react';

const InsightsCurationModal = ({ isOpen, onClose, agentId, selectedInteractions }) => {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState(null);
  
  const [selectedNodes, setSelectedNodes] = useState(new Set());
  const [selectedEdges, setSelectedEdges] = useState(new Set());
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!isOpen || !selectedInteractions || selectedInteractions.length === 0) return;
    
    setLoading(true);
    setError(null);
    setInsights(null);
    setSelectedNodes(new Set());
    setSelectedEdges(new Set());

    fetch(`http://localhost:8000/agent/${agentId}/curate_insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interactions: selectedInteractions })
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setInsights(data.suggestions);
          // Default to all selected
          if (data.suggestions.nodes) {
            setSelectedNodes(new Set(data.suggestions.nodes.map((_, i) => i)));
          }
          if (data.suggestions.relationships) {
            setSelectedEdges(new Set(data.suggestions.relationships.map((_, i) => i)));
          }
        } else {
          setError(data.message || 'Failed to generate insights.');
        }
      })
      .catch(err => {
        setError(err.message || 'Network error.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, agentId, selectedInteractions]);

  if (!isOpen) return null;

  const toggleNode = (idx) => {
    const next = new Set(selectedNodes);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedNodes(next);
  };

  const toggleEdge = (idx) => {
    const next = new Set(selectedEdges);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedEdges(next);
  };

  const applyInsights = async () => {
    if (!insights) return;
    setApplying(true);
    
    const payload = {
      nodes: insights.nodes ? insights.nodes.filter((_, i) => selectedNodes.has(i)) : [],
      relationships: insights.relationships ? insights.relationships.filter((_, i) => selectedEdges.has(i)) : []
    };

    try {
      const res = await fetch(`http://localhost:8000/agent/${agentId}/memory/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        onClose(true); // Signal success
      } else {
        setError(data.message || 'Failed to apply insights.');
      }
    } catch (err) {
      setError(err.message || 'Network error.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Sparkles size={20} className="text-primary" />
            <h3 className="text-h3" style={{ margin: 0 }}>Curate Insights</h3>
          </div>
          <button className="icon-btn" onClick={() => onClose(false)} disabled={applying}>
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
              <Loader2 className="animate-spin" size={32} />
              <p>Analyzing {selectedInteractions?.length} interactions...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '2rem', color: 'var(--danger-color)', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-md)' }}>
              {error}
            </div>
          ) : insights ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {(!insights.nodes?.length && !insights.relationships?.length) && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  No structural insights found in these interactions.
                </div>
              )}

              {insights.nodes && insights.nodes.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>Suggested Entities</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {insights.nodes.map((node, idx) => (
                      <div 
                        key={`node-${idx}`} 
                        className={`surface-panel ${selectedNodes.has(idx) ? 'selected' : ''}`}
                        style={{ 
                          padding: '1rem', 
                          display: 'flex', 
                          gap: '1rem', 
                          cursor: 'pointer',
                          border: selectedNodes.has(idx) ? '1px solid var(--primary-color)' : '1px solid var(--border-medium)'
                        }}
                        onClick={() => toggleNode(idx)}
                      >
                        <div style={{ color: selectedNodes.has(idx) ? 'var(--primary-color)' : 'var(--text-muted)' }}>
                          <Check size={20} style={{ opacity: selectedNodes.has(idx) ? 1 : 0.2 }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{node.label}</div>
                          {node.properties && Object.keys(node.properties).length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                              {Object.entries(node.properties).map(([k, v]) => (
                                <span key={k} className="badge badge-outline" style={{ fontSize: '0.75rem' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : v}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {insights.relationships && insights.relationships.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>Suggested Relationships</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {insights.relationships.map((rel, idx) => (
                      <div 
                        key={`rel-${idx}`} 
                        className={`surface-panel ${selectedEdges.has(idx) ? 'selected' : ''}`}
                        style={{ 
                          padding: '1rem', 
                          display: 'flex', 
                          gap: '1rem', 
                          alignItems: 'center',
                          cursor: 'pointer',
                          border: selectedEdges.has(idx) ? '1px solid var(--primary-color)' : '1px solid var(--border-medium)'
                        }}
                        onClick={() => toggleEdge(idx)}
                      >
                        <div style={{ color: selectedEdges.has(idx) ? 'var(--primary-color)' : 'var(--text-muted)' }}>
                          <Check size={20} style={{ opacity: selectedEdges.has(idx) ? 1 : 0.2 }} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span className="badge" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>{rel.source_label}</span>
                          <ArrowRight size={14} className="text-muted" />
                          <span className="badge badge-primary">{rel.type}</span>
                          <ArrowRight size={14} className="text-muted" />
                          <span className="badge" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>{rel.target_label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => onClose(false)} disabled={applying}>Cancel</button>
          <button 
            className="btn btn-primary" 
            onClick={applyInsights} 
            disabled={loading || applying || !insights || (selectedNodes.size === 0 && selectedEdges.size === 0)}
          >
            {applying ? <><Loader2 size={16} className="animate-spin" /> Applying...</> : 'Apply Selected Insights'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsightsCurationModal;
