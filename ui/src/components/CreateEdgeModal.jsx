import { useState } from 'react';
import { Link, X } from 'lucide-react';

export default function CreateEdgeModal({ sourceNode, targetNode, onConfirm, onCancel }) {
  const [relation, setRelation] = useState('');

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="glass-panel" style={{ width: '350px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link size={18} /> Connect Nodes
          </h3>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ fontSize: '0.9rem', color: '#ccc', textAlign: 'center', padding: '0.5rem 0' }}>
          <strong>{sourceNode?.id}</strong> ➔ <strong>{targetNode?.id}</strong>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8rem', color: '#aaa' }}>Relationship Label (Predicate)</label>
          <input 
            autoFocus
            placeholder="e.g. possui, gostaria_de_aprender"
            value={relation} 
            onChange={e => setRelation(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && relation.trim() && onConfirm(relation.trim())}
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.5rem', borderRadius: '4px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
            Cancel
          </button>
          <button 
            onClick={() => relation.trim() && onConfirm(relation.trim())} 
            disabled={!relation.trim()}
            style={{ background: '#3b82f6', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', cursor: relation.trim() ? 'pointer' : 'not-allowed', opacity: relation.trim() ? 1 : 0.5 }}
          >
            Create Connection
          </button>
        </div>
      </div>
    </div>
  );
}
