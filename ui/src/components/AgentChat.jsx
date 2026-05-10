import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, MessageSquare, Paperclip, X, Check } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function AgentChat({ agentId, onUpdate }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: `Hi! I am the ${agentId} Agent. I can chat with you and automatically save relevant memory to my knowledge graph.` }
  ]);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset chat when agent changes
  useEffect(() => {
    setMessages([
      { role: 'assistant', text: `Hi! I am the ${agentId} Agent. I can chat with you and automatically save relevant memory to my knowledge graph.` }
    ]);
  }, [agentId]);

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || loading) return;

    const userMessage = input.trim();
    const fileToSend = selectedFile;
    
    setInput('');
    setSelectedFile(null);
    setMessages(prev => [...prev, { role: 'user', text: userMessage, file: fileToSend?.name }]);
    setLoading(true);

    try {
      const formData = new FormData();
      if (userMessage) formData.append('message', userMessage);
      if (fileToSend) formData.append('file', fileToSend);

      const response = await fetch(`${API_BASE}/agent/${agentId}/chat`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (!response.ok || data.status === 'error') {
        throw new Error(data.message || 'Failed to get agent response');
      }

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: data.response,
        suggestion: data.suggested_memory_updates?.length > 0 ? data.suggested_memory_updates : null
      }]);
      
      if (onUpdate) onUpdate();
      
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: `Error: ${err.message}` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (suggestion, index) => {
    try {
      const response = await fetch(`${API_BASE}/agent/${agentId}/memory/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: suggestion })
      });
      
      const data = await response.json();
      if (!response.ok || data.status === 'error') throw new Error(data.message);
      
      setMessages(prev => prev.map((msg, i) => 
        i === index ? { ...msg, applied: true } : msg
      ));
      if (onUpdate) onUpdate();
    } catch (err) {
      alert(`Error applying updates: ${err.message}`);
    }
  };

  return (
    <div className="glass-panel card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0' }}>
      <div className="sidebar-header" style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageSquare className="text-blue-400" size={18} /> Agent Chat
        </h2>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '90%'
          }}>
            <div style={{
              backgroundColor: msg.role === 'user' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              padding: '0.75rem 1rem',
              borderRadius: '0.75rem',
              border: msg.role === 'user' ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '0.9rem',
              lineHeight: 1.5
            }}>
              {msg.file && (
                <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Paperclip size={12} /> {msg.file}
                </div>
              )}
              {msg.text}
              
              {msg.suggestion && (
                <div style={{ marginTop: '0.75rem', backgroundColor: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong className="text-blue-300">Suggested Facts to Learn:</strong>
                    <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                      {msg.suggestion.map((fact, fidx) => (
                        <li key={fidx}>{fact.subject} - {fact.predicate} - {fact.object}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      className="add-btn save-btn"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', backgroundColor: msg.applied ? 'rgba(74, 222, 128, 0.2)' : '' }}
                      onClick={() => handleApply(msg.suggestion, idx)}
                      disabled={msg.applied}
                    >
                      {msg.applied ? <Check size={14} /> : <Check size={14} />}
                      {msg.applied ? 'Applied' : 'Apply Updates'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.6)' }}>
            <Loader2 className="animate-spin" size={16} />
            <span style={{ fontSize: '0.85rem' }}>Agent is thinking...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        {selectedFile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.8rem', backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', width: 'fit-content' }}>
            <Paperclip size={14} />
            <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedFile.name}
            </span>
            <button onClick={() => setSelectedFile(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 0 }}>
              <X size={14} />
            </button>
          </div>
        )}
        <div className="input-group">
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={e => setSelectedFile(e.target.files[0])}
            accept=".pdf,.docx,.md,.txt,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.mp3,.wav,.mp4,.mov,.webm"
          />
          <button 
            className="add-btn" 
            style={{ padding: '0.5rem', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            <Paperclip size={18} />
          </button>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Talk to the agent..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={loading}
          />
          <button className="add-btn" onClick={handleSend} disabled={loading || (!input.trim() && !selectedFile)}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
