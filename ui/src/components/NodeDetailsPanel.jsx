import { useState, useEffect } from 'react';
import { X, Plus, Save } from 'lucide-react';

export default function NodeDetailsPanel({ node, onClose, onSave }) {
  const [formData, setFormData] = useState({ id: '', label: '', properties: {} });
  const [newPropKey, setNewPropKey] = useState('');
  const [newPropVal, setNewPropVal] = useState('');

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

  return (
    <div className="node-details-panel surface-glass flex-col" style={{
      position: 'absolute', right: '1rem', top: '4rem', width: '300px', 
      zIndex: 'var(--z-modal)', gap: '1rem',
      maxHeight: 'calc(100vh - 100px)', overflowY: 'auto'
    }}>
      <div className="modal-header flex-col">
        <h3 className="text-h3 text-primary" style={{ margin: 0 }}>{node?.id ? 'Edit Node' : 'New Node'}</h3>
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
          <label className="form-label" style={{ marginBottom: '0.5rem' }}>Properties</label>
          {Object.entries(formData.properties).map(([key, val]) => (
            <div key={key} className="flex-row" style={{ marginBottom: '0.5rem' }}>
              <input 
                value={key} 
                readOnly 
                style={{ width: '40%' }} 
              />
              <input 
                value={val} 
                onChange={e => handlePropChange(key, e.target.value)} 
                style={{ width: '50%' }} 
              />
              <button onClick={() => handleRemoveProp(key)} className="btn btn-ghost" style={{ color: '#ef4444', padding: '0.5rem' }}>
                <X size={16} />
              </button>
            </div>
          ))}
          
          <div className="flex-row" style={{ marginTop: '0.5rem' }}>
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
              style={{ width: '50%' }} 
            />
            <button onClick={handleAddProp} className="btn btn-primary" style={{ padding: '0.5rem' }}>
              <Plus size={16} />
            </button>
          </div>
        </div>

        <button onClick={handleSave} className="btn btn-primary" style={{ marginTop: '0.5rem', justifyContent: 'center' }}>
          <Save size={16} /> Save Node
        </button>
      </div>
    </div>
  );
}
