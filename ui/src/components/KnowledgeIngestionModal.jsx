import React, { useRef, useState } from 'react';
import { Upload, Database, CheckCircle, Bot, Check, X, FileText } from 'lucide-react';

export default function KnowledgeIngestionModal({
  agentId,
  onClose,
  onIngestSuccess,
  ingestingFile,
  setIngestingFile,
  suggestedUpdates,
  setSuggestedUpdates,
  extractedFacts,
  setExtractedFacts,
  applyIngestionUpdates,
  showNotification
}) {
  const fileInputRef = useRef(null);
  const [uploadNiche, setUploadNiche] = useState('operational');
  const API_BASE = 'http://localhost:8000';

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIngestingFile(true);
    setSuggestedUpdates(null);
    setExtractedFacts([]);

    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch(`${API_BASE}/agent/${agentId}/ingest_document?category=${uploadNiche}`, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        onIngestSuccess(data);
      } else {
        showNotification('error', data.message || 'Failed to process document.');
      }
    } catch (err) {
      showNotification('error', 'Network error occurred during document upload.');
    } finally {
      setIngestingFile(false);
      e.target.value = null;
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content surface-glass flex-col" style={{ width: '500px', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <button 
          onClick={onClose} 
          className="btn btn-ghost"
          style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.5rem' }}
        >
          <X size={20} />
        </button>
        
        <div className="modal-header flex-col">
          <h2 className="text-h2 flex-row text-primary">
            <FileText className="text-orange-400" />
            Knowledge Ingestion
          </h2>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            Categorize and upload your documents (PDF, media) to expand the knowledge of <strong>{agentId}</strong>.
          </div>
        </div>

        <div className="modal-body flex-col" style={{ gap: '1.5rem' }}>

        {!suggestedUpdates && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Select Knowledge Niche</label>
            <div className="flex-col" style={{ gap: '0.5rem' }}>
              <button 
                onClick={() => setUploadNiche('operational')}
                className="surface-glass"
                style={{ textAlign: 'left', padding: '0.75rem', border: uploadNiche === 'operational' ? '1px solid #f97316' : '1px solid var(--border-color)', background: uploadNiche === 'operational' ? 'rgba(249, 115, 22, 0.1)' : 'var(--surface-color)', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem', color: uploadNiche === 'operational' ? '#f97316' : 'var(--text-primary)' }}>Operational Load (Inventory)</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Standard entity extraction for CRM, tickets, and operational management.</div>
              </button>
              
              <button 
                onClick={() => setUploadNiche('ontology')}
                className="surface-glass"
                style={{ textAlign: 'left', padding: '0.75rem', border: uploadNiche === 'ontology' ? '1px solid #a855f7' : '1px solid var(--border-color)', background: uploadNiche === 'ontology' ? 'rgba(168, 85, 247, 0.1)' : 'var(--surface-color)', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem', color: uploadNiche === 'ontology' ? '#a855f7' : 'var(--text-primary)' }}>Agent Behavior (Ontology)</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Teach the agent new structural rules, schema properties, and behavior definitions.</div>
              </button>

              <button 
                onClick={() => setUploadNiche('chat')}
                className="surface-glass"
                style={{ textAlign: 'left', padding: '0.75rem', border: uploadNiche === 'chat' ? '1px solid #3b82f6' : '1px solid var(--border-color)', background: uploadNiche === 'chat' ? 'rgba(59, 130, 246, 0.1)' : 'var(--surface-color)', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem', color: uploadNiche === 'chat' ? '#3b82f6' : 'var(--text-primary)' }}>Agent Chat Context</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Provide reference material for active conversational sessions or specific tasks.</div>
              </button>
            </div>
          </div>
        )}
        
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileUpload}
          accept=".pdf,.docx,.md,.txt,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.mp3,.wav,.mp4,.mov,.webm"
        />
        
        {!suggestedUpdates && (
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', justifyContent: 'center', backgroundColor: '#f97316' }}
            onClick={() => fileInputRef.current?.click()}
            disabled={ingestingFile}
          >
            {ingestingFile ? <Database className="animate-spin" size={18} /> : <Upload size={18} />}
            {ingestingFile ? 'Processing...' : 'Upload Document'}
          </button>
        )}

        {suggestedUpdates && (
          <div className="surface-glass flex-col" style={{ padding: '1.25rem', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
            <h3 className="text-h3 flex-row" style={{ color: '#60a5fa', marginBottom: '0.5rem' }}>
              <Bot size={18} /> Human in the Loop: Approval Required
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              The ingestion process identified new structures. Please review and approve these additions for the <strong>{agentId}</strong> schema.
            </p>
            
            <div className="flex-col" style={{ gap: '0.75rem', margin: '1rem 0' }}>
              {suggestedUpdates.nodes?.length > 0 && (
                <div style={{ fontSize: '0.9rem' }}>
                  <strong className="text-blue-300">New Entities:</strong> {suggestedUpdates.nodes.join(', ')}
                </div>
              )}
              {suggestedUpdates.predicates?.length > 0 && (
                <div style={{ fontSize: '0.9rem' }}>
                  <strong className="text-purple-300">New Relations:</strong> {suggestedUpdates.predicates.join(', ')}
                </div>
              )}
              {Object.keys(suggestedUpdates.properties || {}).length > 0 && (
                <div style={{ fontSize: '0.9rem' }}>
                  <strong className="text-emerald-300">New Properties:</strong>
                  <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0 }}>
                    {Object.entries(suggestedUpdates.properties).map(([node, props]) => (
                      <li key={node} style={{ color: 'var(--text-muted)' }}>{node}: {props.join(', ')}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="flex-row" style={{ marginTop: '0.5rem', gap: '0.75rem' }}>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={applyIngestionUpdates}
              >
                <Check size={16} /> Approve & Merge
              </button>
              <button 
                className="btn btn-ghost" 
                style={{ flex: 1, justifyContent: 'center', color: '#fca5a5' }}
                onClick={() => setSuggestedUpdates(null)}
              >
                <X size={16} /> Reject
              </button>
            </div>
          </div>
        )}
        
        {extractedFacts.length > 0 && (
          <div className="flex-row" style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <CheckCircle className="text-emerald-400" size={16} /> 
            Extracted {extractedFacts.length} facts into Memory Graph.
          </div>
        )}

        </div> {/* End of modal-body */}
      </div>
    </div>
  );
}
