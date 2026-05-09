import { useState, useEffect } from 'react';
import { X, Plus, Save } from 'lucide-react';

export default function NodeDetailsPanel({ node, onClose, onSave }) {
  const [formData, setFormData] = useState({ id: '', label: '', properties: {} });
  const [newPropKey, setNewPropKey] = useState('');
  const [newPropVal, setNewPropVal] = useState('');

  useEffect(() => {
    if (node) {
      setFormData({
        id: node.id || `node_${Date.now()}`,
        label: node.label || 'Class',
        properties: { ...node.properties }
      });
    } else {
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

  return (
    <div className="node-details-panel glass-panel" style={{
      position: 'absolute', right: '1rem', top: '4rem', width: '300px', 
      display: 'flex', flexDirection: 'column', gap: '1rem', zIndex: 100,
      maxHeight: 'calc(100vh - 100px)', overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>{node?.id ? 'Edit Node' : 'New Node'}</h3>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.8rem', color: '#aaa' }}>Node ID</label>
        <input 
          value={formData.id} 
          onChange={e => handleChange('id', e.target.value)} 
          disabled={!!node?.id} // Don't let them change ID if editing existing
          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.5rem', borderRadius: '4px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.8rem', color: '#aaa' }}>Label / Type</label>
        <input 
          value={formData.label} 
          onChange={e => handleChange('label', e.target.value)} 
          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.5rem', borderRadius: '4px' }}
        />
      </div>

      <div>
        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Properties</h4>
        {Object.entries(formData.properties).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input 
              value={key} 
              readOnly 
              style={{ width: '40%', background: 'rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', padding: '0.25rem', borderRadius: '4px' }} 
            />
            <input 
              value={val} 
              onChange={e => handlePropChange(key, e.target.value)} 
              style={{ width: '50%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.25rem', borderRadius: '4px' }} 
            />
            <button onClick={() => handleRemoveProp(key)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 0.25rem' }}>
              <X size={16} />
            </button>
          </div>
        ))}
        
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <input 
            placeholder="New Key"
            value={newPropKey} 
            onChange={e => setNewPropKey(e.target.value)} 
            style={{ width: '40%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.25rem', borderRadius: '4px' }} 
          />
          <input 
            placeholder="Value"
            value={newPropVal} 
            onChange={e => setNewPropVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddProp()}
            style={{ width: '50%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.25rem', borderRadius: '4px' }} 
          />
          <button onClick={handleAddProp} style={{ background: 'rgba(59, 130, 246, 0.5)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '4px', padding: '0 0.25rem' }}>
            <Plus size={16} />
          </button>
        </div>
      </div>

      <button onClick={handleSave} style={{ 
        marginTop: '1rem', background: '#3b82f6', color: 'white', 
        border: 'none', padding: '0.75rem', borderRadius: '4px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
      }}>
        <Save size={16} /> Save Node
      </button>
    </div>
  );
}
