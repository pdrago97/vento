import React from 'react';
import { Database, Activity, Network, Plus, Trash2, X } from 'lucide-react';

export default function SchemaConfigPanel({
  schema,
  newNode,
  setNewNode,
  addNode,
  removeNode,
  newPredicate,
  setNewPredicate,
  addPredicate,
  removePredicate,
  newPropertyNode,
  setNewPropertyNode,
  newProperty,
  setNewProperty,
  addProperty,
  removeProperty
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem', overflowY: 'auto' }}>
      {/* Nodes Configuration */}
      <div className="glass-panel card">
        <h2 className="section-title" style={{ fontSize: '1rem' }}>
          <Database className="text-blue-400" size={16} />
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
        <h2 className="section-title" style={{ fontSize: '1rem' }}>
          <Activity className="text-purple-400" size={16} />
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
      <div className="glass-panel card">
        <h2 className="section-title" style={{ fontSize: '1rem' }}>
          <Network className="text-emerald-400" size={16} />
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
  );
}
