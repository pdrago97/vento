import { useState, useEffect, useRef } from 'react';
import { Activity, MessageSquare, Zap, Terminal, RefreshCw, Key, Link2, CheckCircle2, Play, Square, HelpCircle } from 'lucide-react';

const ObservabilityDashboard = ({ agentId }) => {
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      {/* Header */}
      <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-medium)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Activity size={24} className="text-primary" />
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>Agent Observability</h2>
        <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(255,255,255,0.1)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {agentId}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex-row" style={{ borderBottom: '1px solid var(--border-medium)', padding: '0 2rem', gap: '2rem' }}>
        <button 
          className={`tab-button ${activeTab === 'channels' ? 'active' : ''}`}
          onClick={() => setActiveTab('channels')}
          style={{ background: 'none', border: 'none', padding: '1rem 0', cursor: 'pointer', borderBottom: activeTab === 'channels' ? '2px solid var(--primary-color)' : '2px solid transparent', color: activeTab === 'channels' ? 'var(--primary-light)' : 'var(--text-muted)', fontWeight: activeTab === 'channels' ? 600 : 500, display: 'flex', gap: '0.5rem', alignItems: 'center' }}
        ><Link2 size={16} /> Channels</button>
        <button 
          className={`tab-button ${activeTab === 'observability' ? 'active' : ''}`}
          onClick={() => setActiveTab('observability')}
          style={{ background: 'none', border: 'none', padding: '1rem 0', cursor: 'pointer', borderBottom: activeTab === 'observability' ? '2px solid var(--primary-color)' : '2px solid transparent', color: activeTab === 'observability' ? 'var(--primary-light)' : 'var(--text-muted)', fontWeight: activeTab === 'observability' ? 600 : 500, display: 'flex', gap: '0.5rem', alignItems: 'center' }}
        ><Terminal size={16} /> Live Metrics</button>
        <button 
          className={`tab-button ${activeTab === 'interactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('interactions')}
          style={{ background: 'none', border: 'none', padding: '1rem 0', cursor: 'pointer', borderBottom: activeTab === 'interactions' ? '2px solid var(--primary-color)' : '2px solid transparent', color: activeTab === 'interactions' ? 'var(--primary-light)' : 'var(--text-muted)', fontWeight: activeTab === 'interactions' ? 600 : 500, display: 'flex', gap: '0.5rem', alignItems: 'center' }}
        ><MessageSquare size={16} /> Interactions</button>
        <button 
          className={`tab-button ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
          style={{ background: 'none', border: 'none', padding: '1rem 0', cursor: 'pointer', borderBottom: activeTab === 'sessions' ? '2px solid var(--primary-color)' : '2px solid transparent', color: activeTab === 'sessions' ? 'var(--primary-light)' : 'var(--text-muted)', fontWeight: activeTab === 'sessions' ? 600 : 500, display: 'flex', gap: '0.5rem', alignItems: 'center' }}
        ><Activity size={16} /> Active Sessions</button>
        <button 
          className={`tab-button ${activeTab === 'syncs' ? 'active' : ''}`}
          onClick={() => setActiveTab('syncs')}
          style={{ background: 'none', border: 'none', padding: '1rem 0', cursor: 'pointer', borderBottom: activeTab === 'syncs' ? '2px solid var(--primary-color)' : '2px solid transparent', color: activeTab === 'syncs' ? 'var(--primary-light)' : 'var(--text-muted)', fontWeight: activeTab === 'syncs' ? 600 : 500, display: 'flex', gap: '0.5rem', alignItems: 'center' }}
        ><RefreshCw size={16} /> Sync Events</button>
      </div>

      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        {activeTab === 'channels' ? (
          <div className="flex-col" style={{ gap: '1.5rem', maxWidth: '800px' }}>
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
        ) : activeTab === 'observability' ? (
          <div className="flex-col" style={{ gap: '1.5rem', height: '100%', maxWidth: '1000px' }}>

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
        ) : activeTab === 'interactions' ? (
          <div className="flex-col" style={{ gap: '1.5rem', height: '100%' }}>
            <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '1.1rem' }}>Recent Interactions</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Timestamp</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Session ID</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Channel</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Sender</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interactions.length === 0 ? (
                      <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No interactions found</td></tr>
                    ) : interactions.map((i, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(i.timestamp).toLocaleString()}</td>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: 'var(--primary-color)' }}>{i.session_id ? i.session_id.substring(0, 8) + '...' : '-'}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>{i.channel}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ 
                            padding: '0.2rem 0.5rem', 
                            borderRadius: '4px', 
                            background: i.sender === 'user' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(168, 85, 247, 0.1)',
                            color: i.sender === 'user' ? '#38bdf8' : '#a855f7'
                          }}>
                            {i.sender}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'sessions' ? (
          <div className="flex-col" style={{ gap: '1.5rem', height: '100%' }}>
            <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '1.1rem' }}>Active Sessions</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Session ID</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Last Active</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Message Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.length === 0 ? (
                      <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No active sessions</td></tr>
                    ) : sessions.map((s, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: 'var(--primary-color)' }}>{s.session_id}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: s.active ? 'var(--success-color)' : 'var(--text-muted)' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.active ? 'var(--success-color)' : 'var(--text-muted)' }}></span>
                            {s.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{s.last_active}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>{s.message_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'syncs' ? (
          <div className="flex-col" style={{ gap: '1.5rem', height: '100%' }}>
            <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-main)', fontSize: '1.1rem' }}>Recent Graph Syncs</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Source Node</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Relationship</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Target Node</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Graph ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncs.length === 0 ? (
                      <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No sync events found</td></tr>
                    ) : syncs.map((s, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--primary-light)' }}>{s.source}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '0.75rem' }}>
                            {s.predicate}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--primary-light)' }}>{s.target}</td>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{s.graph_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ObservabilityDashboard;
