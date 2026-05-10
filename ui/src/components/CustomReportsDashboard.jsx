import React, { useState, useEffect } from 'react';
import { FileText, Loader2, Plus, Trash2, ChevronRight, MessageSquare, Save } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

function CustomReportsDashboard({ agentId = 'global', isSidebarOpen, isAssistantOpen }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    fetchReports();
  }, [agentId]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/agent/${agentId}/reports`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (e) {
      console.error("Failed to fetch reports:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/agent/${agentId}/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (res.ok) {
        const data = await res.json();
        // After generation, automatically save it with a generic title or prompt snippet
        const title = prompt.length > 30 ? prompt.substring(0, 30) + '...' : prompt;
        await handleSaveReport(title, data.report);
        setShowGenerateModal(false);
        setPrompt('');
      }
    } catch (e) {
      console.error("Failed to generate report:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveReport = async (title, content) => {
    try {
      const res = await fetch(`${API_BASE}/agent/${agentId}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content })
      });
      if (res.ok) {
        fetchReports();
      }
    } catch (e) {
      console.error("Failed to save report:", e);
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm("Are you sure you want to delete this report?")) return;
    try {
      const res = await fetch(`${API_BASE}/agent/${agentId}/reports/${reportId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (selectedReport?.id === reportId) {
          setSelectedReport(null);
        }
        fetchReports();
      }
    } catch (e) {
      console.error("Failed to delete report:", e);
    }
  };

  return (
    <div className="flex-col" style={{ 
      gap: '1.5rem', 
      height: '100%', 
      width: '100%', 
      maxWidth: '1400px', 
      margin: '0 auto' 
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
            <FileText className="text-blue-500" size={24} />
            Custom Reports
          </h2>
          <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.9rem' }}>
            Generate and manage custom operational insights powered by Gemini.
          </p>
        </div>
        <button 
          onClick={() => setShowGenerateModal(true)}
          style={{ 
            padding: '0.5rem 1rem', 
            fontSize: '0.9rem', 
            fontWeight: 600,
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            boxShadow: '0 2px 10px rgba(59, 130, 246, 0.3)',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} /> New Report
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
          <FileText size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
          <p>No custom reports generated yet.</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Click "New Report" to compile insights using Gemini.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '2rem', height: '100%' }}>
          {/* List View */}
          <div style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {reports.map(report => (
              <div 
                key={report.id}
                onClick={() => setSelectedReport(report)}
                style={{
                  padding: '1rem',
                  backgroundColor: selectedReport?.id === report.id ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${selectedReport?.id === report.id ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 500, fontSize: '0.95rem', marginBottom: '0.25rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {report.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    {new Date(report.timestamp).toLocaleString()}
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteReport(report.id); }}
                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Detail View */}
          <div style={{ flex: '1', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', overflowY: 'auto' }}>
            {selectedReport ? (
              <div>
                <h3 style={{ fontSize: '1.5rem', marginTop: 0, marginBottom: '0.5rem' }}>{selectedReport.title}</h3>
                <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  Generated on {new Date(selectedReport.timestamp).toLocaleString()}
                </div>
                <div style={{ lineHeight: '1.6', color: '#e5e7eb' }}>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                    {selectedReport.content}
                  </pre>
                </div>
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', flexDirection: 'column', gap: '1rem' }}>
                <FileText size={48} style={{ opacity: 0.2 }} />
                <span>Select a report to view details</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerateModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: '#1e1e24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '2rem', width: '500px', maxWidth: '90vw', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Wand2 className="text-purple-400" size={20} />
              Generate Custom Report
            </h3>
            
            <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '1rem' }}>
              Describe what kind of report you need based on the current operational inventory data.
            </p>

            <textarea 
              className="input-field"
              placeholder="E.g., Summarize all high priority tickets from this week and identify common bottlenecks..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              style={{ width: '100%', minHeight: '120px', marginBottom: '1.5rem', padding: '0.75rem' }}
              disabled={isGenerating}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                onClick={() => setShowGenerateModal(false)}
                className="glass-button"
                style={{ padding: '0.5rem 1rem' }}
                disabled={isGenerating}
              >
                Cancel
              </button>
              <button 
                onClick={handleGenerateReport}
                style={{ 
                  padding: '0.5rem 1rem', 
                  backgroundColor: '#3b82f6', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '6px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: isGenerating || !prompt.trim() ? 'not-allowed' : 'pointer',
                  opacity: isGenerating || !prompt.trim() ? 0.5 : 1
                }}
                disabled={isGenerating || !prompt.trim()}
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {isGenerating ? 'Generating...' : 'Compile Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomReportsDashboard;
