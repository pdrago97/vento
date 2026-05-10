import { useState, useEffect, useRef } from 'react';
import { X, Activity, MessageSquare, Zap, Terminal, Shield, RefreshCw, Key, Link2, CheckCircle2, Play, Square, HelpCircle } from 'lucide-react';

const ObservabilityDashboard = ({ onClose, agentId }) => {
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
              const formattedLogs = data.logs.map((log, index) => ({
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
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '900px' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ paddingBottom: '0' }}>
          <div className="flex-row text-primary text-h3" style={{ paddingBottom: '1rem' }}>
            <Activity size={24} />
            Channels & Observability
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon" style={{ alignSelf: 'flex-start' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-row" style={{ borderBottom: '1px solid var(--border-medium)', padding: '0 1.5rem', marginBottom: '1.5rem', gap: '2rem' }}>
          <button 
            className={`tab-button ${activeTab === 'channels' ? 'active' : ''}`}
            onClick={() => setActiveTab('channels')}
            style={{
              background: 'none', border: 'none', padding: '1rem 0', cursor: 'pointer',
              borderBottom: activeTab === 'channels' ? '2px solid var(--primary-color)' : '2px solid transparent',
              color: activeTab === 'channels' ? 'var(--primary-light)' : 'var(--text-muted)',
              fontWeight: activeTab === 'channels' ? 600 : 500,
              display: 'flex', gap: '0.5rem', alignItems: 'center'
            }}
          >
            <Link2 size={16} /> Channel Connections
          </button>
          <button 
            className={`tab-button ${activeTab === 'observability' ? 'active' : ''}`}
            onClick={() => setActiveTab('observability')}
            style={{
              background: 'none', border: 'none', padding: '1rem 0', cursor: 'pointer',
              borderBottom: activeTab === 'observability' ? '2px solid var(--primary-color)' : '2px solid transparent',
              color: activeTab === 'observability' ? 'var(--primary-light)' : 'var(--text-muted)',
              fontWeight: activeTab === 'observability' ? 600 : 500,
              display: 'flex', gap: '0.5rem', alignItems: 'center'
            }}
          >
            <Terminal size={16} /> Live Observability
          </button>
        </div>

        <div className="modal-body" style={{ minHeight: '500px' }}>
          {activeTab === 'channels' ? (
            <div className="flex-col" style={{ gap: '1.5rem' }}>
              <p className="text-muted text-sm">
                Manage your agent's integrations with external platforms. OpenClaw will automatically route messages and synchronize memory context across these enabled channels.
              </p>

              {/* Channel Cards */}
              <div className="flex-col" style={{ gap: '1rem' }}>
                
                {/* Discord */}
                <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)' }}>
                  <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div className="flex-row" style={{ gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        <MessageSquare size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Discord Bot
                          <button onClick={() => setShowDiscordHelp(!showDiscordHelp)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Como configurar">
                            <HelpCircle size={16} />
                          </button>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sync memory across Discord servers and DMs.</div>
                      </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <span style={{ fontSize: '0.85rem', color: channels.discord.enabled ? 'var(--success-color)' : 'var(--text-muted)', fontWeight: 500 }}>
                        {channels.discord.enabled ? 'Active' : 'Disabled'}
                      </span>
                      <input 
                        type="checkbox" 
                        checked={channels.discord.enabled} 
                        onChange={() => toggleChannel('discord')}
                        style={{ accentColor: 'var(--primary-color)', width: '16px', height: '16px' }}
                      />
                    </label>
                  </div>
                  
                  {showDiscordHelp && (
                    <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--text-main)', border: '1px solid var(--border-medium)' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary-color)' }}>Como configurar o Discord Bot</h4>
                      <ol style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', color: 'var(--text-muted)' }}>
                        <li>Acesse o <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-light)', textDecoration: 'none' }}>Discord Developer Portal</a>.</li>
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
                    <div className="form-group" style={{ marginBottom: 0, padding: '1rem', background: 'var(--bg-dark)', borderRadius: 'var(--radius-sm)' }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}><Key size={14} /> Discord Bot Token</label>
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
                <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)' }}>
                  <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div className="flex-row" style={{ gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#E01E5A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        <MessageSquare size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-main)' }}>Slack Integration</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Enterprise-grade context synchronization.</div>
                      </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <span style={{ fontSize: '0.85rem', color: channels.slack.enabled ? 'var(--success-color)' : 'var(--text-muted)', fontWeight: 500 }}>
                        {channels.slack.enabled ? 'Active' : 'Disabled'}
                      </span>
                      <input 
                        type="checkbox" 
                        checked={channels.slack.enabled} 
                        onChange={() => toggleChannel('slack')}
                        style={{ accentColor: 'var(--primary-color)', width: '16px', height: '16px' }}
                      />
                    </label>
                  </div>
                  
                  {channels.slack.enabled && (
                    <div className="form-group" style={{ marginBottom: 0, padding: '1rem', background: 'var(--bg-dark)', borderRadius: 'var(--radius-sm)' }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}><Key size={14} /> Slack Bot Token (xoxb-)</label>
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
                <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)' }}>
                  <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div className="flex-row" style={{ gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        <MessageSquare size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-main)' }}>WhatsApp Business</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>B2C conversational AI integration.</div>
                      </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <span style={{ fontSize: '0.85rem', color: channels.whatsapp.enabled ? 'var(--success-color)' : 'var(--text-muted)', fontWeight: 500 }}>
                        {channels.whatsapp.enabled ? 'Active' : 'Disabled'}
                      </span>
                      <input 
                        type="checkbox" 
                        checked={channels.whatsapp.enabled} 
                        onChange={() => toggleChannel('whatsapp')}
                        style={{ accentColor: 'var(--primary-color)', width: '16px', height: '16px' }}
                      />
                    </label>
                  </div>
                  
                  {channels.whatsapp.enabled && (
                    <div className="form-group" style={{ marginBottom: 0, padding: '1rem', background: 'var(--bg-dark)', borderRadius: 'var(--radius-sm)' }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}><Key size={14} /> WhatsApp API Token</label>
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
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="btn btn-primary" onClick={handleSaveChannels} disabled={saving}>
                  {saving ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {saving ? 'Applying...' : 'Apply Configuration'}
                </button>
              </div>

            </div>
          ) : (
            <div className="flex-col" style={{ gap: '1.5rem', height: '100%' }}>

              {/* Runner Controls */}
              <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)' }}>
                <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="flex-row" style={{ gap: '1rem', alignItems: 'center' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: runnerActive ? 'var(--success-color)' : 'var(--text-muted)' }}>
                      <Terminal size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Autonomous Runner 
                        <span style={{ 
                          width: '8px', height: '8px', borderRadius: '50%', 
                          background: runnerActive ? 'var(--success-color)' : 'var(--text-muted)',
                          boxShadow: runnerActive ? '0 0 8px var(--success-color)' : 'none',
                          display: 'inline-block'
                        }}></span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {runnerActive ? 'Process is actively listening for events.' : 'Process is currently offline.'}
                      </div>
                    </div>
                  </div>
                  <button 
                    className={`btn ${runnerActive ? 'btn-danger' : 'btn-primary'}`}
                    onClick={toggleRunner}
                    disabled={togglingRunner || !agentId}
                    style={{ minWidth: '140px', justifyContent: 'center' }}
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
              </div>
              
              {/* Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="text-muted" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Activity size={14} /> Active Sessions</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{metrics.active_sessions.toLocaleString()}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--success-color)' }}>Last 24h</div>
                </div>
                <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="text-muted" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><MessageSquare size={14} /> Total Messages</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{metrics.total_messages.toLocaleString()}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Historical total</div>
                </div>
                <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="text-muted" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><RefreshCw size={14} /> Sync Events</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{metrics.sync_events.toLocaleString()}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Memory graph updates</div>
                </div>
                <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="text-muted" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Zap size={14} /> Avg Latency</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>{Math.round(metrics.avg_latency_ms)}ms</div>
                  <div style={{ fontSize: '0.75rem', color: metrics.avg_latency_ms > 2000 ? 'var(--danger-color)' : 'var(--success-color)' }}>
                    {metrics.avg_latency_ms === 0 ? 'No data' : metrics.avg_latency_ms < 1000 ? 'Optimal' : metrics.avg_latency_ms < 3000 ? 'Acceptable' : 'Degraded'}
                  </div>
                </div>
              </div>

              {/* Terminal Logs */}
              <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)', border: '1px solid #333', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid #333', fontSize: '0.8rem', color: '#888', display: 'flex', justifyContent: 'space-between' }}>
                  <span>OpenClaw Core - Agent Execution Log</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--success-color)' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success-color)' }}></span> Connected</span>
                </div>
                <div style={{ padding: '1rem', flex: 1, overflowY: 'auto', maxHeight: '300px', fontFamily: 'monospace', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {logs.map((log, i) => (
                    <div key={i} style={{ color: log.type === 'error' ? '#ff6b6b' : log.type === 'success' ? '#20c997' : '#a5b4fc', display: 'flex', gap: '1rem' }}>
                      {log.time && <span style={{ color: '#666', minWidth: '80px' }}>[{log.time}]</span>}
                      <span>{log.msg}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ObservabilityDashboard;
