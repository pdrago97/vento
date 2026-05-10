import { useState, useEffect } from 'react';
import { X, Plus, Save, Wand2, Loader2 } from 'lucide-react';

export default function NodeDetailsPanel({ node, onClose, onSave }) {
  const [formData, setFormData] = useState({ id: '', label: '', properties: {} });
  const [newPropKey, setNewPropKey] = useState('');
  const [newPropVal, setNewPropVal] = useState('');
  const [suggestedProperties, setSuggestedProperties] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  useEffect(() => {
    if (node) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        id: node.id || `node_${Date.now()}`,
        label: node.label || 'Class',
        properties: { ...node.properties }
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({ id: `node_${Date.now()}`, label: 'Class', properties: {} });
    }
  }, [node]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePropChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      properties: { ...prev.properties, [key]: value }
    }));
  };

  const handleAddProp = () => {
    if (newPropKey.trim()) {
      handlePropChange(newPropKey.trim(), newPropVal);
      setNewPropKey('');
      setNewPropVal('');
    }
  };

  const handleRemoveProp = (key) => {
    setFormData(prev => {
      const updated = { ...prev.properties };
      delete updated[key];
      return { ...prev, properties: updated };
    });
  };

  const handleSave = () => {
    onSave(formData);
  };

  const handleSuggestProperties = async () => {
    setIsSuggesting(true);
    try {
      const response = await fetch('http://localhost:8000/ontology/suggest_properties?agent_id=global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: formData.label || 'Unknown',
          properties: formData.properties
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

  const renderPropertyField = (key, val) => {
    const isLongText = ['description', 'summary', 'context', 'notes', 'objective', 'content'].includes(key.toLowerCase()) || String(val).length > 50;
    
    if (isLongText) {
      return (
        <div key={key} className="flex-col" style={{ marginBottom: '0.75rem', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: 500 }}>{key}</span>
            <button onClick={() => handleRemoveProp(key)} className="btn-icon" style={{ color: '#ef4444', padding: '0.2rem' }}>
              <X size={14} />
            </button>
          </div>
          <textarea
            value={val}
            onChange={e => handlePropChange(key, e.target.value)}
            style={{ width: '100%', minHeight: '80px', resize: 'vertical', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '0.5rem', color: '#f8fafc', fontSize: '0.9rem' }}
          />
        </div>
      );
    }

    return (
      <div key={key} className="flex-row" style={{ marginBottom: '0.5rem', alignItems: 'center' }}>
        <input 
          value={key} 
          readOnly 
          style={{ width: '35%', fontSize: '0.85rem', color: '#9ca3af', background: 'transparent', border: 'none', padding: '0.25rem' }} 
        />
        <input 
          value={val} 
          onChange={e => handlePropChange(key, e.target.value)} 
          style={{ width: '50%', padding: '0.4rem 0.5rem' }} 
        />
        <button onClick={() => handleRemoveProp(key)} className="btn-icon" style={{ color: '#ef4444', padding: '0.5rem', marginLeft: 'auto' }}>
          <X size={16} />
        </button>
      </div>
    );
  };

  return (
    <div className="node-details-panel surface-glass flex-col" style={{
      position: 'absolute', right: '1rem', top: '4rem', width: '340px', 
      zIndex: 'var(--z-modal)', gap: '1rem',
      maxHeight: 'calc(100vh - 100px)', overflowY: 'auto'
    }}>
      <div className="modal-header flex-col">
        <h3 className="text-h3 text-primary" style={{ margin: 0 }}>{node?.id ? 'Edit Knowledge Node' : 'New Knowledge Node'}</h3>
        <button onClick={onClose} className="btn btn-ghost" style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.5rem' }}>
          <X size={20} />
        </button>
      </div>

      <div className="modal-body flex-col" style={{ gap: '1rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Node ID</label>
          <input 
            value={formData.id} 
            onChange={e => handleChange('id', e.target.value)} 
            disabled={!!node?.id} // Don't let them change ID if editing existing
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Label / Type</label>
          <input 
            value={formData.label} 
            onChange={e => handleChange('label', e.target.value)} 
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
            <label className="form-label" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Properties</label>
            <button onClick={handleSuggestProperties} disabled={isSuggesting} className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', display: 'flex', gap: '0.25rem', alignItems: 'center', color: '#60a5fa' }}>
              {isSuggesting ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              Suggest
            </button>
          </div>
          
          {suggestedProperties.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {suggestedProperties.map((sug, idx) => (
                <button key={idx} onClick={() => {
                  handlePropChange(sug.key, sug.value);
                  setSuggestedProperties(prev => prev.filter((_, i) => i !== idx));
                }} style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '12px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', color: '#93c5fd', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Plus size={10} /> {sug.key}
                </button>
              ))}
            </div>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {Object.entries(formData.properties).map(([key, val]) => renderPropertyField(key, val))}
          </div>
          
          <div className="flex-row" style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <input 
              placeholder="New Key"
              value={newPropKey} 
              onChange={e => setNewPropKey(e.target.value)} 
              style={{ width: '40%' }} 
            />
            <input 
              placeholder="Value"
              value={newPropVal} 
              onChange={e => setNewPropVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddProp()}
              style={{ width: '45%' }} 
            />
            <button onClick={handleAddProp} className="btn-icon" style={{ background: 'var(--primary-color)', color: 'white', padding: '0.4rem', borderRadius: '4px', marginLeft: 'auto' }}>
              <Plus size={16} />
            </button>
          </div>
        </div>

        <button onClick={handleSave} className="btn btn-primary" style={{ marginTop: '0.5rem', justifyContent: 'center' }}>
          <Save size={16} style={{ marginRight: '0.5rem' }} /> Save Node
        </button>
      </div>
    </div>
  );
}
