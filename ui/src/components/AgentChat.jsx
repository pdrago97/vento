import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, Sparkles, MessageSquare } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function AgentChat({ agentId, onUpdate }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: `Hi! I am the ${agentId} Agent. I can chat with you and automatically save relevant memory to my knowledge graph.` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

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
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/agent/${agentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });

      const data = await response.json();
      
      if (!response.ok || data.status === 'error') {
        throw new Error(data.message || 'Failed to get agent response');
      }

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: data.response
      }]);
      
      // Trigger a graph refresh after the agent replies in case it updated the graph
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
              {msg.text}
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
        <div className="input-group">
          <input 
            type="text" 
            className="input-field" 
            placeholder="Talk to the agent..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={loading}
          />
          <button className="add-btn" onClick={handleSend} disabled={loading || !input.trim()}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
