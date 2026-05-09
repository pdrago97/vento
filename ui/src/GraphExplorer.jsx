import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import { Database, Loader2, Box, Layers, PlusCircle } from 'lucide-react';

import NodeDetailsPanel from './components/NodeDetailsPanel';
import CreateEdgeModal from './components/CreateEdgeModal';

const API_BASE = 'http://localhost:8000';

function GraphExplorer({ agentId = 'global', refreshTrigger = 0, viewMode = 'memory', schema }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState('3D'); // '2D' or '3D'
  const fgRef = useRef();

  // Hover states
  const [hoverNode, setHoverNode] = useState(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());

  // Interactive UI states
  const [selectedNode, setSelectedNode] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [edgeModal, setEdgeModal] = useState(null);

  useEffect(() => {
    fetchGraphData(refreshTrigger > 0);
  }, [agentId, refreshTrigger]);

  const fetchGraphData = async (isRefresh = false) => {
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
  };

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

  // Auto-fit graph
  useEffect(() => {
    if (!loading && displayGraphData.nodes.length > 0 && fgRef.current) {
      if (mode === '2D') {
        fgRef.current.zoomToFit(400);
      }
    }
  }, [loading, displayGraphData, mode]);

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
      const dz = (node.z || 0) - (otherNode.z || 0);
      const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
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
        case 'OntologyClass': baseColor = '#60a5fa'; break; // blue
        case 'OntologyProperty': baseColor = '#34d399'; break; // emerald
        case 'RelationsHub': baseColor = '#f472b6'; break; // pink
        case 'OntologyPredicate': baseColor = '#a78bfa'; break; // purple
        default: baseColor = '#9ca3af'; // gray
      }
    } else {
      switch (node.label) {
        case 'Class': baseColor = '#a78bfa'; break; // purple-400
        default: baseColor = '#60a5fa'; // blue-400
      }
    }

    return isDimmed ? 'rgba(100, 100, 100, 0.2)' : baseColor;
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
      const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // padding

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y + 4, bckgDimensions[0], bckgDimensions[1]);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(label, node.x, node.y + 4 + bckgDimensions[1] / 2);
    }
  }, [hoverNode, highlightNodes]);

  // 3D Object
  const getThreeObject = useCallback(node => {
    const isHighlighted = highlightNodes.has(node);
    const isDimmed = hoverNode && !isHighlighted;

    const sprite = new SpriteText(getNodeLabel(node));
    sprite.color = getNodeColor(node);
    sprite.textHeight = 4;
    sprite.material.depthWrite = false; // keep text above lines
    sprite.material.opacity = isDimmed ? 0.2 : 1;
    sprite.material.transparent = true;
    return sprite;
  }, [hoverNode, highlightNodes]);

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ height: 'calc(100vh - 120px)', padding: 0, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {refreshing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#60a5fa', marginRight: '1rem', backgroundColor: 'rgba(0,0,0,0.5)', padding: '0.25rem 0.75rem', borderRadius: '1rem' }}>
            <Loader2 className="animate-spin" size={16} />
            <span style={{ fontSize: '0.875rem' }}>Refreshing graph...</span>
          </div>
        )}
        <button 
          className={`add-btn ${mode === '2D' ? 'active' : ''}`}
          onClick={() => setMode('2D')}
          style={{ backgroundColor: mode === '2D' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255,255,255,0.05)' }}
        >
          <Layers size={16} /> 2D
        </button>
        <button 
          className={`add-btn ${mode === '3D' ? 'active' : ''}`}
          onClick={() => setMode('3D')}
          style={{ backgroundColor: mode === '3D' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255,255,255,0.05)' }}
        >
          <Box size={16} /> 3D
        </button>
        {viewMode !== 'schema' && (
          <button 
            className="add-btn"
            onClick={() => { setSelectedNode(null); setIsPanelOpen(true); }}
            style={{ backgroundColor: 'rgba(74, 222, 128, 0.5)', marginLeft: '1rem' }}
          >
            <PlusCircle size={16} /> New Node
          </button>
        )}
      </div>

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

      {mode === '2D' ? (
        <ForceGraph2D
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
      ) : (
        <ForceGraph3D
          ref={fgRef}
          graphData={displayGraphData}
          nodeThreeObject={getThreeObject}
          nodeThreeObjectExtend={true}
          nodeLabel={getTooltipHTML}
          onNodeHover={handleNodeHover}
          onLinkHover={handleLinkHover}
          onNodeClick={handleNodeClick}
          onBackgroundClick={handleBackgroundClick}
          onNodeDragEnd={handleNodeDragEnd}
          nodeColor={getNodeColor}
          nodeRelSize={6}
          linkColor={getLinkColor}
          linkWidth={getLinkWidth}
          linkLabel={link => link.label}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          backgroundColor="rgba(0,0,0,0)"
        />
      )}
    </div>
  );
}

export default GraphExplorer;
