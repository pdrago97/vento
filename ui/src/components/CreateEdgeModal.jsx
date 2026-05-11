import { useState } from 'react';
import { Link, X } from 'lucide-react';

export default function CreateEdgeModal({ sourceNode, targetNode, onConfirm, onCancel, schema }) {
  const [relation, setRelation] = useState('');

  return (
    <div className="modal-overlay">
      <div className="modal-content surface-glass flex-col" style={{ width: '350px' }}>
        <div className="modal-header flex-col">
          <h3 className="text-h3 flex-row text-primary" style={{ margin: 0 }}>
            <Link size={18} /> Connect Nodes
          </h3>
          <button onClick={onCancel} className="btn btn-ghost" style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.5rem' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body flex-col" style={{ gap: '1rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>
            <strong className="text-primary">{sourceNode?.id}</strong> ➔ <strong className="text-primary">{targetNode?.id}</strong>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Relationship Label (Predicate)</label>
            <input 
              autoFocus
              placeholder="e.g. possui, gostaria_de_aprender"
              value={relation} 
              onChange={e => setRelation(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && relation.trim() && onConfirm(relation.trim())}
              list="schema-predicates"
            />
            {schema?.predicates && (
              <datalist id="schema-predicates">
                {schema.predicates.map(p => <option key={p} value={p} />)}
              </datalist>
            )}
          </div>

          <div className="modal-footer">
            <button onClick={onCancel} className="btn btn-ghost">
              Cancel
            </button>
            <button 
              onClick={() => relation.trim() && onConfirm(relation.trim())} 
              disabled={!relation.trim()}
              className="btn btn-primary"
            >
              Create Connection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
