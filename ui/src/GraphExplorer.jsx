import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Database, Loader2, Layers, PlusCircle, Settings } from 'lucide-react';

import NodeDetailsPanel from './components/NodeDetailsPanel';
import CreateEdgeModal from './components/CreateEdgeModal';

const API_BASE = 'http://localhost:8000';

function GraphExplorer({ agentId = 'global', refreshTrigger = 0, viewMode = 'memory', schema, isSidebarOpen }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fgRef = useRef();

  // Settings states
  const [settings, setSettings] = useState({
    repulsion: -30,
    linkDistance: 30,
    centerGravity: 0.1,
    staticMode: false
  });
  const [showSettings, setShowSettings] = useState(false);

  // Hover states
  const [hoverNode, setHoverNode] = useState(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());

  // Interactive UI states
  const [selectedNode, setSelectedNode] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [edgeModal, setEdgeModal] = useState(null);

  // ResizeObserver states
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // Legend state
  const [isLegendOpen, setIsLegendOpen] = useState(true);

  // ResizeObserver hook
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.contentRect) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const displayGraphData = useMemo(() => {
    if (viewMode === 'schema') {
      if (!schema) return { nodes: [], links: [] };
      const nodes = [];
      const links = [];
      
      // Add class nodes
      (schema.nodes || []).forEach(nodeLabel => {
        nodes.push({
          id: `class_${nodeLabel}`,
          label: 'OntologyClass',
          properties: { name: nodeLabel }
        });
        
        // Add property nodes
        const props = (schema.properties && schema.properties[nodeLabel]) || [];
        props.forEach(prop => {
          const propId = `prop_${nodeLabel}_${prop}`;
          nodes.push({
            id: propId,
            label: 'OntologyProperty',
            properties: { name: prop }
          });
          links.push({
            id: `link_${nodeLabel}_${prop}`,
            source: `class_${nodeLabel}`,
            target: propId,
            label: 'hasProperty',
            properties: {}
          });
        });
      });

      // Add Predicates as a cluster around a central 'Relations' node
      if (schema.predicates && schema.predicates.length > 0) {
        nodes.push({
          id: 'hub_relations',
          label: 'RelationsHub',
          properties: { name: 'Available Relations' }
        });
        schema.predicates.forEach(pred => {
          const predId = `pred_${pred}`;
          nodes.push({
            id: predId,
            label: 'OntologyPredicate',
            properties: { name: pred }
          });
          links.push({
            id: `link_hub_${pred}`,
            source: 'hub_relations',
            target: predId,
            label: 'relation',
            properties: {}
          });
        });
      }

      return { nodes, links };
    } else {
      // Memory mode: filter out Class nodes to show only facts/instances
      const filteredNodes = graphData.nodes.filter(n => n.label !== 'Class');
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      const filteredLinks = graphData.links.filter(l => {
        const srcId = typeof l.source === 'object' ? l.source.id : l.source;
        const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
        return nodeIds.has(srcId) && nodeIds.has(tgtId);
      });
      return { nodes: filteredNodes, links: filteredLinks };
    }
  }, [viewMode, schema, graphData]);

  const fetchGraphData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await fetch(`${API_BASE}/graph?agent_id=${agentId}`);
      if (!response.ok) throw new Error('Failed to fetch graph data');
      const data = await response.json();
      setGraphData(data);
    } catch (err) {
      console.error('Failed to fetch graph data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchGraphData(refreshTrigger > 0);
  }, [fetchGraphData, refreshTrigger]);

  // Apply forces whenever settings change
  useEffect(() => {
    // We add an eslint disable here because we purposefully want to access
    // fgRef.current immediately without putting it in the dependency array
    // to avoid cyclical render loops when initializing the D3 force engine.
    /* eslint-disable react-hooks/exhaustive-deps */
    if (fgRef.current && fgRef.current.d3Force && fgRef.current.d3Force('charge')) {
      fgRef.current.d3Force('charge').strength(settings.repulsion);
      fgRef.current.d3Force('link').distance(settings.linkDistance);
      
      // Custom center gravity force
      fgRef.current.d3Force('centerGravity', (alpha) => {
        if (!displayGraphData || !displayGraphData.nodes) return;
        const strength = settings.centerGravity * alpha;
        displayGraphData.nodes.forEach(node => {
          node.vx -= (node.x || 0) * strength;
          node.vy -= (node.y || 0) * strength;
        });
      });

      if (settings.staticMode) {
        displayGraphData.nodes.forEach(n => {
          n.fx = n.x;
          n.fy = n.y;
        });
      } else {
        displayGraphData.nodes.forEach(n => {
          n.fx = undefined;
          n.fy = undefined;
        });
      }

      fgRef.current.d3ReheatSimulation();
    }
  }, [settings, displayGraphData]);

  const handleCompact = () => {
    // Move all nodes 90% closer to the origin (0,0) to group disconnected clusters together
    displayGraphData.nodes.forEach(node => {
      node.x = (node.x || Math.random()) * 0.1;
      node.y = (node.y || Math.random()) * 0.1;
      
      // Stop their current momentum
      node.vx = 0;
      node.vy = 0;
      
      // Update fixed positions if it was frozen
      if (node.fx !== undefined) node.fx = node.x;
      if (node.fy !== undefined) node.fy = node.y;
    });

    setSettings(s => ({
      ...s,
      repulsion: -10, // less repulsion so they can get closer
      linkDistance: 15,
      centerGravity: 2, // strong gravity to pull everything to center
      staticMode: false // Unfreeze so they can naturally untangle
    }));

    if (fgRef.current && fgRef.current.d3Force('charge')) {
      fgRef.current.d3ReheatSimulation();
      
      // Re-center the camera
      setTimeout(() => {
        if (fgRef.current) {
          fgRef.current.zoomToFit(600);
        }
      }, 800);
    }
  };



  // Auto-fit graph
  useEffect(() => {
    if (!loading && displayGraphData.nodes.length > 0 && fgRef.current) {
      const timer = setTimeout(() => {
        if (fgRef.current) {
          fgRef.current.zoomToFit(600, 50); // added 50px padding
        }
      }, 600); // Wait for simulation to pull nodes apart
      return () => clearTimeout(timer);
    }
  }, [loading, displayGraphData, viewMode, agentId]);

  const handleNodeClick = useCallback(node => {
    // Disable editing for schema nodes
    if (viewMode === 'schema') return;
    setSelectedNode(node);
    setIsPanelOpen(true);
  }, [viewMode]);

  const handleBackgroundClick = useCallback(() => {
    setIsPanelOpen(false);
    setSelectedNode(null);
  }, []);

  const handleNodeDragEnd = useCallback(node => {
    if (viewMode === 'schema') return; // Disable edge creation in schema view
    
    const overlapThreshold = 25; // Detection radius
    let targetNode = null;
    
    for (const otherNode of displayGraphData.nodes) {
      if (otherNode.id === node.id) continue;
      
      const dx = node.x - otherNode.x;
      const dy = node.y - otherNode.y;
      const distance = Math.sqrt(dx*dx + dy*dy);
      
      if (distance < overlapThreshold) {
        targetNode = otherNode;
        break;
      }
    }

    if (targetNode) {
      setEdgeModal({ source: node, target: targetNode });
    }
  }, [displayGraphData.nodes, viewMode]);

  const handleSaveNode = async (formData) => {
    try {
      const res = await fetch(`${API_BASE}/graph/node?agent_id=${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsPanelOpen(false);
        fetchGraphData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateEdge = async (relation) => {
    if (!edgeModal) return;
    try {
      const res = await fetch(`${API_BASE}/graph/edge?agent_id=${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: edgeModal.source.id,
          target: edgeModal.target.id,
          relation: relation,
          properties: {}
        })
      });
      if (res.ok) {
        setEdgeModal(null);
        fetchGraphData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleNodeHover = node => {
    highlightNodes.clear();
    highlightLinks.clear();
    if (node) {
      highlightNodes.add(node);
      displayGraphData.links.forEach(link => {
        if (link.source === node || link.target === node || link.source.id === node.id || link.target.id === node.id) {
          highlightLinks.add(link);
          highlightNodes.add(link.source);
          highlightNodes.add(link.target);
        }
      });
    }

    setHoverNode(node || null);
    setHighlightNodes(new Set(highlightNodes));
    setHighlightLinks(new Set(highlightLinks));
  };

  const handleLinkHover = link => {
    highlightNodes.clear();
    highlightLinks.clear();

    if (link) {
      highlightLinks.add(link);
      highlightNodes.add(link.source);
      highlightNodes.add(link.target);
    }

    setHighlightNodes(new Set(highlightNodes));
    setHighlightLinks(new Set(highlightLinks));
  };

  const getNodeColor = (node) => {
    const isHighlighted = highlightNodes.has(node);
    const isDimmed = hoverNode && !isHighlighted;
    
    let baseColor;
    if (viewMode === 'schema') {
      switch (node.label) {
        case 'OntologyClass': baseColor = 'hsl(212, 100%, 60%)'; break; // primary
        case 'OntologyProperty': baseColor = 'hsl(150, 60%, 45%)'; break; // accent
        case 'RelationsHub': baseColor = 'hsl(330, 81%, 65%)'; break; // tertiary
        case 'OntologyPredicate': baseColor = 'hsl(250, 60%, 65%)'; break; // secondary
        default: baseColor = 'hsl(215, 20%, 65%)'; // text-muted
      }
    } else {
      switch (node.label) {
        case 'Class': baseColor = 'hsl(250, 60%, 65%)'; break; // secondary
        default: baseColor = 'hsl(212, 100%, 60%)'; // primary
      }
    }

    return isDimmed ? 'hsla(215, 20%, 65%, 0.2)' : baseColor;
  };

  const getLinkColor = (link) => {
    return highlightLinks.has(link) ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.2)';
  };

  const getLinkWidth = (link) => {
    return highlightLinks.has(link) ? 3 : 1.5;
  };

  const getNodeLabel = (node) => {
    if (!node) return '';
    const p = node.properties || {};
    
    // For schema nodes
    if (viewMode === 'schema') {
      return p.name || node.id;
    }

    // For facts that have subject/predicate/object
    if (p.subject && p.predicate && p.object) {
      return `${p.subject} ${p.predicate} ${p.object}`;
    }
    
    // Priority order of properties that usually tell the story
    const candidateKeys = ['name', 'title', 'id', 'subject', 'object', 'value', 'description'];
    for (const key of candidateKeys) {
      if (p[key]) {
        // truncate if it's too long
        const val = String(p[key]);
        return val.length > 40 ? val.substring(0, 37) + '...' : val;
      }
    }
    
    // Fallback to label or ID
    return node.label && node.label !== 'Fact' && node.label !== 'Node' && node.label !== 'Class' ? `${node.label} (${node.id})` : String(node.id);
  };

  const getTooltipHTML = (node) => {
    if (!node) return '';
    const p = node.properties || {};
    let html = `<div style="background: rgba(0,0,0,0.8); padding: 8px; border-radius: 4px; color: white;">`;
    html += `<strong>${node.id}</strong><br/>`;
    html += `<small style="color:#aaa;">Label: ${node.label}</small><br/><br/>`;
    if (Object.keys(p).length > 0) {
      html += `<table style="font-size: 0.8rem; text-align: left; border-spacing: 4px;">`;
      for (const [k, v] of Object.entries(p)) {
        html += `<tr><td style="color:#888;">${k}</td><td>${v}</td></tr>`;
      }
      html += `</table>`;
    } else {
      html += `<i style="font-size: 0.8rem; color:#888;">No properties</i>`;
    }
    html += `</div>`;
    return html;
  };

  // 2D Canvas Drawing
  const paintRing = useCallback((node, ctx) => {
    const isHighlighted = highlightNodes.has(node);
    const isDimmed = hoverNode && !isHighlighted;
    const color = getNodeColor(node);

    // Node body
    ctx.beginPath();
    ctx.arc(node.x, node.y, 4, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();

    // Hover ring
    if (node === hoverNode) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Label
    if (!isDimmed) {
      const label = getNodeLabel(node);
      const fontSize = 4;
      ctx.font = `${fontSize}px Sans-Serif`;
      const textWidth = ctx.measureText(label).width;
      const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4); // padding

      const r = 1; // border radius
      const x = node.x - bckgDimensions[0] / 2;
      const y = node.y + 4;
      const w = bckgDimensions[0];
      const h = bckgDimensions[1];

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)'; // slate-900 with opacity
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;

      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(label, node.x, node.y + 4 + bckgDimensions[1] / 2);
    }
  }, [hoverNode, highlightNodes]);



  // Removed full unmount on loading to preserve ForceGraph2D container size during transitions
  return (
    <div ref={containerRef} className="glass-panel" style={{ height: 'calc(100vh - 120px)', padding: 0, position: 'relative', overflow: 'hidden' }}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}>
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      )}
      <div style={{ position: 'absolute', top: '1.5rem', right: isSidebarOpen ? '430px' : '4rem', zIndex: 10, display: 'flex', gap: '0.75rem', alignItems: 'center', transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        {refreshing && (
          <div className="surface-glass flex-row" style={{ color: 'var(--primary-color)', padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)' }}>
            <Loader2 className="animate-spin" size={16} />
            <span className="text-sm font-medium">Refreshing graph...</span>
          </div>
        )}
        {viewMode !== 'schema' && (
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => { setSelectedNode(null); setIsPanelOpen(true); }}
          >
            <PlusCircle size={16} /> New Node
          </button>
        )}
        <button 
          className={`btn btn-sm btn-icon ${showSettings ? 'btn-primary' : 'surface-glass'}`}
          onClick={() => setShowSettings(!showSettings)}
          title="Visualization Preferences"
        >
          <Settings size={18} />
        </button>
      </div>

      {showSettings && (
        <div className="surface-heavy flex-col" style={{
          position: 'absolute',
          top: '4rem',
          right: isSidebarOpen ? '430px' : '4rem',
          zIndex: 10,
          padding: '1rem',
          width: '250px',
          transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <h3 className="text-h3 text-primary flex-row" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
            <Settings size={16} /> Visualization
          </h3>
          
          <div className="form-group" style={{ marginBottom: '0.5rem' }}>
            <label className="form-label flex-between">
              <span>Repulsion Force</span>
              <span className="text-primary">{settings.repulsion}</span>
            </label>
            <input 
              type="range" 
              min="-1000" 
              max="-10" 
              step="10" 
              value={settings.repulsion}
              onChange={e => setSettings(s => ({ ...s, repulsion: parseInt(e.target.value) }))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '0.5rem' }}>
            <label className="form-label flex-between">
              <span>Link Distance</span>
              <span className="text-primary">{settings.linkDistance}</span>
            </label>
            <input 
              type="range" 
              min="10" 
              max="150" 
              step="5" 
              value={settings.linkDistance}
              onChange={e => setSettings(s => ({ ...s, linkDistance: parseInt(e.target.value) }))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '0.5rem' }}>
            <label className="form-label flex-between">
              <span>Center Gravity</span>
              <span className="text-primary">{settings.centerGravity}</span>
            </label>
            <input 
              type="range" 
              min="0" 
              max="10" 
              step="0.1" 
              value={settings.centerGravity}
              onChange={e => setSettings(s => ({ ...s, centerGravity: parseFloat(e.target.value) }))}
            />
          </div>

          <div className="flex-row" style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>
            <input 
              type="checkbox" 
              id="staticMode"
              checked={settings.staticMode}
              onChange={e => setSettings(s => ({ ...s, staticMode: e.target.checked }))}
            />
            <label htmlFor="staticMode" className="form-label" style={{ cursor: 'pointer', margin: 0 }}>
              Freeze Graph (Static Mode)
            </label>
          </div>

          <button 
            className="btn btn-primary btn-sm" 
            onClick={handleCompact}
            style={{ marginTop: '0.5rem', width: '100%' }}
          >
            Compact Graph
          </button>
        </div>
      )}

      {isPanelOpen && (
        <NodeDetailsPanel 
          node={selectedNode} 
          onClose={() => setIsPanelOpen(false)} 
          onSave={handleSaveNode} 
        />
      )}

      {edgeModal && (
        <CreateEdgeModal
          sourceNode={edgeModal.source}
          targetNode={edgeModal.target}
          onConfirm={handleCreateEdge}
          onCancel={() => setEdgeModal(null)}
        />
      )}

      <div className="surface-heavy flex-col" style={{
        position: 'absolute',
        bottom: '1rem',
        right: '1rem',
        zIndex: 10,
        padding: '1rem',
        width: '200px'
      }}>
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setIsLegendOpen(!isLegendOpen)}
        >
          <h3 style={{ margin: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={14} /> RDF Legend
          </h3>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{isLegendOpen ? '▼' : '▲'}</span>
        </div>
        
        {isLegendOpen && (
          <div className="flex-col" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
            {viewMode === 'schema' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'hsl(212, 100%, 60%)' }} />
                  <span>Ontology Class</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'hsl(150, 60%, 45%)' }} />
                  <span>Property</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'hsl(330, 81%, 65%)' }} />
                  <span>Relations Hub</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'hsl(250, 60%, 65%)' }} />
                  <span>Predicate</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'hsl(250, 60%, 65%)' }} />
                  <span>Class Node</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'hsl(212, 100%, 60%)' }} />
                  <span>Entity (Fact)</span>
                </div>
              </>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'hsl(215, 20%, 65%)' }} />
              <span>Unknown / Other</span>
            </div>
          </div>
        )}
      </div>

      <ForceGraph2D
        key={`${agentId}-${viewMode}`}
        width={dimensions.width > 0 ? dimensions.width : undefined}
        height={dimensions.height > 0 ? dimensions.height : undefined}
        ref={fgRef}
        graphData={displayGraphData}
        nodeCanvasObject={paintRing}
        nodeLabel={getTooltipHTML}
        onNodeHover={handleNodeHover}
        onLinkHover={handleLinkHover}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        onNodeDragEnd={handleNodeDragEnd}

        nodeRelSize={6}
        linkColor={getLinkColor}
        linkWidth={getLinkWidth}
        linkLabel={link => link.label}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        backgroundColor="rgba(0,0,0,0)"
      />
    </div>
  );
}

export default GraphExplorer;
