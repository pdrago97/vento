import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Activity, MessageSquare, Zap, Terminal, RefreshCw, Key, Link2, CheckCircle2, Play, Square, HelpCircle, FileText, X } from 'lucide-react';
import CustomReportsDashboard from './CustomReportsDashboard';

const ObservabilityDashboard = ({ agentId, onClose }) => {
  const [activeTab, setActiveTab] = useState('channels');
  const [showDiscordHelp, setShowDiscordHelp] = useState(false);
  
  const [channels, setChannels] = useState({
    discord: { enabled: false, token: '' },
    slack: { enabled: false, token: '' },
    whatsapp: { enabled: false, token: '' }
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`http://localhost:8000/agents/${agentId}/channels`)
      .then(res => res.json())
      .then(data => {
        if (data.channels && Object.keys(data.channels).length > 0) {
          setChannels(prev => ({
            discord: { ...prev.discord, ...data.channels.discord },
            slack: { ...prev.slack, ...data.channels.slack },
            whatsapp: { ...prev.whatsapp, ...data.channels.whatsapp }
          }));
        }
      })
      .catch(console.error);
  }, [agentId]);

  // Observability State
  const [logs, setLogs] = useState([]);
  const [runnerActive, setRunnerActive] = useState(false);
  const [togglingRunner, setTogglingRunner] = useState(false);
  const logsEndRef = useRef(null);

  const [metrics, setMetrics] = useState({
    active_sessions: 0,
    total_messages: 0,
    sync_events: 0,
    avg_latency_ms: 0
  });

  // Data endpoints state
  const [interactions, setInteractions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [syncs, setSyncs] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleRow = (idx) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedRows(newExpanded);
  };


  // Fetch tabular data based on active tab
  useEffect(() => {
    if (activeTab === 'interactions') {
      fetch(`http://localhost:8000/agents/${agentId}/observability/interactions`)
        .then(res => res.json())
        .then(data => setInteractions(data.interactions || []))
        .catch(console.error);
    } else if (activeTab === 'sessions') {
      fetch(`http://localhost:8000/agents/${agentId}/observability/sessions`)
        .then(res => res.json())
        .then(data => setSessions(data.sessions || []))
        .catch(console.error);
    } else if (activeTab === 'syncs') {
      fetch(`http://localhost:8000/agents/${agentId}/observability/syncs`)
        .then(res => res.json())
        .then(data => setSyncs(data.syncs || []))
        .catch(console.error);
    }
  }, [activeTab, agentId]);

  // Live logs fetching
  useEffect(() => {
    if (activeTab === 'observability') {
      const fetchLogs = () => {
        fetch(`http://localhost:8000/agents/${agentId}/runner/status`)
          .then(res => res.json())
          .then(data => {
            if (data.status === 'success') {
              setRunnerActive(data.active);
            }
          })
          .catch(console.error);

        fetch(`http://localhost:8000/agents/${agentId}/logs`)
          .then(res => res.json())
          .then(data => {
            if (data.logs) {
              const formattedLogs = data.logs.map((log) => ({
                time: '',
                type: 'info',
                msg: log
              }));
              setLogs(formattedLogs);
            }
          })
          .catch(console.error);

        fetch(`http://localhost:8000/agents/${agentId}/metrics`)
          .then(res => res.json())
          .then(data => {
            if (data) {
              setMetrics({
                active_sessions: data.active_sessions || 0,
                total_messages: data.total_messages || 0,
                sync_events: data.sync_events || 0,
                avg_latency_ms: data.avg_latency_ms || 0
              });
            }
          })
          .catch(console.error);
      };

      fetchLogs();
      const interval = setInterval(fetchLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [activeTab, agentId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const toggleRunner = async () => {
    if (!agentId) return;
    setTogglingRunner(true);
    const endpoint = runnerActive ? 'stop' : 'start';
    try {
      const response = await fetch(`http://localhost:8000/agents/${agentId}/runner/${endpoint}`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.status === 'success') {
        setRunnerActive(!runnerActive);
      }
    } catch (err) {
      console.error(`Network error occurred while toggling runner.`, err);
    } finally {
      setTogglingRunner(false);
    }
  };

  const toggleChannel = (channel) => {
    setChannels(prev => ({
      ...prev,
      [channel]: { ...prev[channel], enabled: !prev[channel].enabled }
    }));
  };

  const handleSaveChannels = () => {
    setSaving(true);
    fetch(`http://localhost:8000/agents/${agentId}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels })
    })
      .then(res => res.json())
      .then(() => setSaving(false))
      .catch(err => {
        console.error(err);
        setSaving(false);
      });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div style={{ backgroundColor: 'var(--bg-dark)', border: '1px solid var(--border-medium)', borderRadius: '12px', width: '90vw', height: '90vh', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header & Tabs */}
        <div style={{ padding: '1.5rem 2rem 0', borderBottom: '1px solid var(--border-medium)', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--bg-glass)' }}>
          <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="flex-row" style={{ alignItems: 'center' }}>
              <Activity size={24} className="text-primary" />
              <h2 className="text-h3" style={{ margin: 0, color: 'var(--text-main)' }}>Operations & Observability</h2>
              <span className="badge badge-muted" style={{ marginLeft: '0.5rem' }}>
                {agentId}
              </span>
            </div>
            <button onClick={onClose} className="btn-ghost btn-icon">
              <X size={20} />
            </button>
          </div>

        <div className="flex-row" style={{ gap: '2rem' }}>
          <button 
            className={`tab-button ${activeTab === 'channels' ? 'active' : ''}`}
            onClick={() => setActiveTab('channels')}
            style={{ background: 'none', border: 'none', padding: '0 0 1rem 0', cursor: 'pointer', borderBottom: activeTab === 'channels' ? '2px solid var(--primary-color)' : '2px solid transparent', color: activeTab === 'channels' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 500, display: 'flex', gap: '0.5rem', alignItems: 'center', transition: 'var(--transition-fast)' }}
          ><Link2 size={16} /> Channels</button>
          <button 
            className={`tab-button ${activeTab === 'observability' ? 'active' : ''}`}
            onClick={() => setActiveTab('observability')}
            style={{ background: 'none', border: 'none', padding: '0 0 1rem 0', cursor: 'pointer', borderBottom: activeTab === 'observability' ? '2px solid var(--primary-color)' : '2px solid transparent', color: activeTab === 'observability' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 500, display: 'flex', gap: '0.5rem', alignItems: 'center', transition: 'var(--transition-fast)' }}
          ><Terminal size={16} /> Live Metrics</button>
          <button 
            className={`tab-button ${activeTab === 'interactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('interactions')}
            style={{ background: 'none', border: 'none', padding: '0 0 1rem 0', cursor: 'pointer', borderBottom: activeTab === 'interactions' ? '2px solid var(--primary-color)' : '2px solid transparent', color: activeTab === 'interactions' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 500, display: 'flex', gap: '0.5rem', alignItems: 'center', transition: 'var(--transition-fast)' }}
          ><MessageSquare size={16} /> Interactions</button>
          <button 
            className={`tab-button ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
            style={{ background: 'none', border: 'none', padding: '0 0 1rem 0', cursor: 'pointer', borderBottom: activeTab === 'sessions' ? '2px solid var(--primary-color)' : '2px solid transparent', color: activeTab === 'sessions' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 500, display: 'flex', gap: '0.5rem', alignItems: 'center', transition: 'var(--transition-fast)' }}
          ><Activity size={16} /> Active Sessions</button>
          <button 
            className={`tab-button ${activeTab === 'syncs' ? 'active' : ''}`}
            onClick={() => setActiveTab('syncs')}
            style={{ background: 'none', border: 'none', padding: '0 0 1rem 0', cursor: 'pointer', borderBottom: activeTab === 'syncs' ? '2px solid var(--primary-color)' : '2px solid transparent', color: activeTab === 'syncs' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 500, display: 'flex', gap: '0.5rem', alignItems: 'center', transition: 'var(--transition-fast)' }}
          ><RefreshCw size={16} /> Sync Events</button>
          <button 
            className={`tab-button ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
            style={{ background: 'none', border: 'none', padding: '0 0 1rem 0', cursor: 'pointer', borderBottom: activeTab === 'reports' ? '2px solid var(--primary-color)' : '2px solid transparent', color: activeTab === 'reports' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 500, display: 'flex', gap: '0.5rem', alignItems: 'center', transition: 'var(--transition-fast)' }}
          ><FileText size={16} /> Custom Reports</button>
        </div>
      </div>

      <div style={{ flex: 1, padding: '1.5rem 2rem', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'channels' ? (
          <div className="flex-col" style={{ gap: '1.5rem', width: '100%', maxWidth: '1400px', margin: '0 auto', height: '100%', overflowY: 'auto', paddingRight: '0.5rem' }}>
            <p className="text-muted text-sm">
              Manage your agent's integrations with external platforms. OpenClaw will automatically route messages and synchronize memory context across these enabled channels.
            </p>

            {/* Channel Cards */}
            <div className="flex-col" style={{ gap: '1rem' }}>
              
              {/* Discord */}
              <div className="surface-panel" style={{ padding: '1.5rem' }}>
                <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: showDiscordHelp || channels.discord.enabled ? '1.5rem' : '0' }}>
                  <div className="flex-row" style={{ gap: '1rem', alignItems: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                      <MessageSquare size={24} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Discord Bot
                        <button onClick={() => setShowDiscordHelp(!showDiscordHelp)} className="btn-ghost btn-icon" style={{ padding: '4px' }} title="Como configurar">
                          <HelpCircle size={16} />
                        </button>
                      </div>
                      <div className="text-muted text-sm">Sync memory across Discord servers and DMs.</div>
                    </div>
                  </div>
                  <label className="flex-row" style={{ cursor: 'pointer' }}>
                    <span style={{ color: channels.discord.enabled ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 500, fontSize: '0.875rem' }}>
                      {channels.discord.enabled ? 'Active' : 'Disabled'}
                    </span>
                    <input 
                      type="checkbox" 
                      checked={channels.discord.enabled} 
                      onChange={() => toggleChannel('discord')}
                    />
                  </label>
                </div>
                
                {showDiscordHelp && (
                  <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--bg-dark)' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--primary-color)' }}>Como configurar o Discord Bot</h4>
                    <ol style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      <li>Acesse o <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>Discord Developer Portal</a>.</li>
                      <li>Clique em <strong>New Application</strong> e crie seu bot.</li>
                      <li>No menu lateral <strong>Bot</strong>, clique em <strong>Reset Token</strong> e copie o token gerado.</li>
                      <li>Um pouco mais abaixo, ative a opção <strong>Message Content Intent</strong> na seção Privileged Gateway Intents e salve.</li>
                      <li>No menu lateral <strong>OAuth2 {'>'} URL Generator</strong>, marque o scope <strong>bot</strong> e a permissão <strong>Administrator</strong>.</li>
                      <li>Copie a URL gerada no final da página, cole no seu navegador e adicione o bot ao seu servidor.</li>
                      <li>Cole o Token copiado no campo abaixo, ative a conexão e clique em Apply Configuration.</li>
                    </ol>
                  </div>
                )}
                
                {channels.discord.enabled && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Key size={14} /> Discord Bot Token</label>
                    <input 
                      type="password" 
                      value={channels.discord.token} 
                      onChange={(e) => setChannels(prev => ({...prev, discord: {...prev.discord, token: e.target.value}}))}
                      className="input-field"
                      placeholder="Paste your Discord Bot Token here..."
                    />
                  </div>
                )}
              </div>

              {/* Slack */}
              <div className="surface-panel" style={{ padding: '1.5rem' }}>
                <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: channels.slack.enabled ? '1.5rem' : '0' }}>
                  <div className="flex-row" style={{ gap: '1rem', alignItems: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#E01E5A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                      <MessageSquare size={24} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-main)' }}>Slack Integration</div>
                      <div className="text-muted text-sm">Enterprise-grade context synchronization.</div>
                    </div>
                  </div>
                  <label className="flex-row" style={{ cursor: 'pointer' }}>
                    <span style={{ color: channels.slack.enabled ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 500, fontSize: '0.875rem' }}>
                      {channels.slack.enabled ? 'Active' : 'Disabled'}
                    </span>
                    <input 
                      type="checkbox" 
                      checked={channels.slack.enabled} 
                      onChange={() => toggleChannel('slack')}
                    />
                  </label>
                </div>
                
                {channels.slack.enabled && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Key size={14} /> Slack Bot Token (xoxb-)</label>
                    <input 
                      type="password" 
                      value={channels.slack.token} 
                      onChange={(e) => setChannels(prev => ({...prev, slack: {...prev.slack, token: e.target.value}}))}
                      className="input-field"
                      placeholder="xoxb-..."
                    />
                  </div>
                )}
              </div>

              {/* WhatsApp */}
              <div className="surface-panel" style={{ padding: '1.5rem' }}>
                <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: channels.whatsapp.enabled ? '1.5rem' : '0' }}>
                  <div className="flex-row" style={{ gap: '1rem', alignItems: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                      <MessageSquare size={24} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-main)' }}>WhatsApp Business</div>
                      <div className="text-muted text-sm">B2C conversational AI integration.</div>
                    </div>
                  </div>
                  <label className="flex-row" style={{ cursor: 'pointer' }}>
                    <span style={{ color: channels.whatsapp.enabled ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 500, fontSize: '0.875rem' }}>
                      {channels.whatsapp.enabled ? 'Active' : 'Disabled'}
                    </span>
                    <input 
                      type="checkbox" 
                      checked={channels.whatsapp.enabled} 
                      onChange={() => toggleChannel('whatsapp')}
                    />
                  </label>
                </div>
                
                {channels.whatsapp.enabled && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Key size={14} /> WhatsApp API Token</label>
                    <input 
                      type="password" 
                      value={channels.whatsapp.token} 
                      onChange={(e) => setChannels(prev => ({...prev, whatsapp: {...prev.whatsapp, token: e.target.value}}))}
                      className="input-field"
                      placeholder="EAAB..."
                    />
                  </div>
                )}
              </div>

            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn btn-primary" onClick={handleSaveChannels} disabled={saving}>
                {saving ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {saving ? 'Applying...' : 'Apply Configuration'}
              </button>
            </div>

          </div>
        ) : activeTab === 'observability' ? (
          <div className="flex-col" style={{ gap: '1.5rem', height: '100%', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 3fr', gap: '1.5rem' }}>
              {/* Runner Controls */}
              <div className="surface-panel flex-col" style={{ padding: '1.5rem', justifyContent: 'space-between', height: '100%' }}>
                <div className="flex-row" style={{ gap: '1rem', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: runnerActive ? 'var(--accent-color)' : 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
                    <Terminal size={24} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Autonomous Runner 
                      <span style={{ 
                        width: '8px', height: '8px', borderRadius: '50%', 
                        background: runnerActive ? 'var(--accent-color)' : 'var(--text-muted)',
                        boxShadow: runnerActive ? '0 0 8px var(--accent-glow)' : 'none',
                        display: 'inline-block'
                      }}></span>
                    </div>
                    <div className="text-muted text-sm">
                      {runnerActive ? 'Actively listening.' : 'Process is offline.'}
                    </div>
                  </div>
                </div>
                <button 
                  className={`btn ${runnerActive ? 'btn-danger' : 'btn-success'}`}
                  onClick={toggleRunner}
                  disabled={togglingRunner || !agentId}
                  style={{ width: '100%', justifyContent: 'center', marginTop: '1rem', padding: '0.75rem' }}
                >
                  {togglingRunner ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : runnerActive ? (
                    <Square size={16} />
                  ) : (
                    <Play size={16} />
                  )}
                  {togglingRunner ? (runnerActive ? 'Stopping...' : 'Starting...') : (runnerActive ? 'Stop Runner' : 'Start Runner')}
                </button>
              </div>
              
              {/* Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="text-muted" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}><Activity size={16} /> Active Sessions</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>{metrics.active_sessions.toLocaleString()}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-color)' }}>Last 24h</div>
              </div>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="text-muted" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}><MessageSquare size={16} /> Total Messages</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>{metrics.total_messages.toLocaleString()}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Historical total</div>
              </div>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="text-muted" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}><RefreshCw size={16} /> Sync Events</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>{metrics.sync_events.toLocaleString()}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Memory graph updates</div>
              </div>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="text-muted" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}><Zap size={16} /> Avg Latency</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>{Math.round(metrics.avg_latency_ms)}ms</div>
                <div style={{ fontSize: '0.75rem', color: metrics.avg_latency_ms > 2000 ? 'var(--danger-color)' : 'var(--accent-color)' }}>
                  {metrics.avg_latency_ms === 0 ? 'No data' : metrics.avg_latency_ms < 1000 ? 'Optimal' : metrics.avg_latency_ms < 3000 ? 'Acceptable' : 'Degraded'}
                </div>
              </div>
            </div>
            </div>

            {/* Terminal Logs */}
            <div className="surface-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1.5rem', background: 'var(--bg-dark)', borderBottom: '1px solid var(--border-medium)', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 500 }}>
                <span>OpenClaw Core - Agent Execution Log</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: runnerActive ? 'var(--accent-color)' : 'var(--text-muted)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: runnerActive ? 'var(--accent-color)' : 'var(--text-muted)' }}></span> 
                  {runnerActive ? 'Connected' : 'Offline'}
                </span>
              </div>
              <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#0a0a0c' }}>
                {logs.length === 0 && <div className="text-muted" style={{ fontStyle: 'italic' }}>Waiting for execution logs...</div>}
                {logs.map((log, i) => (
                  <div key={i} style={{ color: log.type === 'error' ? 'var(--danger-color)' : log.type === 'success' ? 'var(--accent-color)' : 'var(--primary-color)', display: 'flex', gap: '1rem', lineHeight: '1.5' }}>
                    {log.time && <span style={{ color: 'var(--text-dim)', minWidth: '80px' }}>[{log.time}]</span>}
                    <span>{log.msg}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

          </div>
        ) : activeTab === 'interactions' ? (
          <div className="flex-col" style={{ gap: '1.5rem', height: '100%', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
            <div className="surface-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)' }}>
                <h3 className="text-h3" style={{ margin: 0 }}>Recent Interactions</h3>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                    <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '1rem 1.5rem', fontWeight: 500, width: '40px' }}></th>
                      <th style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>Timestamp</th>
                      <th style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>Session ID</th>
                      <th style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>Channel</th>
                      <th style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>Sender</th>
                      <th style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interactions.length === 0 ? (
                      <tr><td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No interactions found</td></tr>
                    ) : interactions.map((i, idx) => {
                      const isExpanded = expandedRows.has(idx);
                      const channel = i.metadata?.channel || '-';
                      const tokens = i.metadata?.tokens || null;
                      const reasoning = i.metadata?.reasoning || null;
                      const toolCalls = i.metadata?.tool_calls || [];
                      
                      return (
                        <React.Fragment key={idx}>
                          <tr 
                            onClick={() => toggleRow(idx)}
                            style={{ 
                              borderBottom: isExpanded ? 'none' : '1px solid var(--border-light)', 
                              transition: 'var(--transition-fast)',
                              cursor: 'pointer'
                            }} 
                            className="hover:bg-surface-hover"
                          >
                            <td style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)' }}>
                              <span style={{ 
                                display: 'inline-block', 
                                transition: 'transform 0.2s', 
                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' 
                              }}>
                                ▶
                              </span>
                            </td>
                            <td style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(i.timestamp).toLocaleString()}</td>
                            <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', color: 'var(--primary-color)' }}>{i.session_id ? i.session_id.substring(0, 8) + '...' : '-'}</td>
                            <td style={{ padding: '1rem 1.5rem' }}>
                              <span className={`badge badge-outline`}>{channel}</span>
                            </td>
                            <td style={{ padding: '1rem 1.5rem' }}>
                              <span className={i.role === 'user' ? 'badge badge-primary' : 'badge badge-secondary'}>
                                {i.role || i.sender}
                              </span>
                            </td>
                            <td style={{ padding: '1rem 1.5rem', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>{i.content || i.message}</td>
                          </tr>
                          {isExpanded && (
                            <tr style={{ borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card-raised)' }}>
                              <td colSpan="6" style={{ padding: '0 1.5rem 1.5rem 4.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                  
                                  {tokens && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                      <Zap size={14} />
                                      <span>Token Usage: <strong>{tokens}</strong></span>
                                    </div>
                                  )}

                                  {reasoning && (
                                    <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', position: 'relative' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Agent Reasoning</h4>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(reasoning);
                                          }}
                                          className="btn btn-secondary btn-sm"
                                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                        >
                                          Copy
                                        </button>
                                      </div>
                                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                        {reasoning}
                                      </pre>
                                    </div>
                                  )}

                                  {toolCalls.length > 0 && (
                                    <div>
                                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tool Calls</h4>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {toolCalls.map((tc, tIdx) => (
                                          <div key={tIdx} style={{ background: 'var(--bg-main)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--primary-color)', marginBottom: '0.25rem' }}>{tc.name}</div>
                                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                              {tc.args}
                                            </pre>
                                            
                                            {i.metadata?.tool_outputs?.[tIdx] && (
                                              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Output</div>
                                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                                  {i.metadata.tool_outputs[tIdx]}
                                                </pre>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'sessions' ? (
          <div className="flex-col" style={{ gap: '1.5rem', height: '100%', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
            <div className="surface-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)' }}>
                <h3 className="text-h3" style={{ margin: 0 }}>Active Sessions</h3>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                    <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>Session ID</th>
                      <th style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>Status</th>
                      <th style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>Last Active</th>
                      <th style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>Message Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.length === 0 ? (
                      <tr><td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No active sessions</td></tr>
                    ) : sessions.map((s, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', color: 'var(--primary-color)' }}>{s.session_id}</td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <span className={s.active ? 'badge badge-accent' : 'badge badge-muted'}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }}></span>
                            {s.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)' }}>{s.last_active}</td>
                        <td style={{ padding: '1rem 1.5rem', color: 'var(--text-main)' }}>{s.message_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'syncs' ? (
          <div className="flex-col" style={{ gap: '1.5rem', height: '100%', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
            <div className="surface-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)' }}>
                <h3 className="text-h3" style={{ margin: 0 }}>Recent Graph Syncs</h3>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                    <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>Source Node</th>
                      <th style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>Relationship</th>
                      <th style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>Target Node</th>
                      <th style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>Graph ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncs.length === 0 ? (
                      <tr><td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No sync events found</td></tr>
                    ) : syncs.map((s, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '1rem 1.5rem', color: 'var(--primary-color)', fontWeight: 500 }}>{s.source}</td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <span className="badge badge-muted">
                            {s.predicate}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: 'var(--primary-color)', fontWeight: 500 }}>{s.target}</td>
                        <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{s.graph_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'reports' ? (
          <div className="flex-col" style={{ gap: '1.5rem', height: '100%', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
            <CustomReportsDashboard agentId={agentId} />
          </div>
        ) : null}
      </div>
      </div>
    </div>
  );
};

export default ObservabilityDashboard;
