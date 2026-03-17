import React, { useState, useEffect, useRef } from 'react';
import './IntelNexus.css';
import { Hub } from '../services/CentralHubService';
import IntelData from '../TestDataPoint/Intel';
import ArrestData from '../TestDataPoint/ArrestData';
import { AnalystAgent } from '../agents/AnalystAgent';

const analyst = new AnalystAgent();

// REAL GEOGRAPHIC COORDINATES FOR UGANDA DISTRICTS
const districtCoords = {
  'Kampala': { x: 53.5, y: 70.5, color: '#ef4444' },
  'Entebbe': { x: 52.0, y: 72.5, color: '#f59e0b' },
  'Jinja': { x: 59.0, y: 71.0, color: '#3b82f6' },
  'Mbarara': { x: 26.0, y: 81.0, color: '#10b981' },
  'Masaka': { x: 42.0, y: 76.0, color: '#8b5cf6' },
  'Fort Portal': { x: 19.0, y: 55.0, color: '#ec4899' },
  'Gulu': { x: 44.0, y: 31.0, color: '#06b6d4' },
  'Mbale': { x: 80.0, y: 55.0, color: '#f97316' },
  'Lira': { x: 53.0, y: 36.0, color: '#a855f7' },
  'Kasese': { x: 16.0, y: 64.0, color: '#ef4444' },
  'Arua': { x: 20.0, y: 22.0, color: '#3b82f6' },
  'Moroto': { x: 86.0, y: 32.0, color: '#ef4444' }
};

const IntelNexus = () => {
  const [viewMode, setViewMode] = useState('graph');
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [transform, setTransform] = useState({ x: 50, y: 50, k: 0.7 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef(null);

  useEffect(() => {
    buildGraph();
  }, []);

  const handleZoom = (e) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newK = Math.min(Math.max(transform.k * delta, 0.1), 5);
    setTransform(prev => ({ ...prev, k: newK }));
  };

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }));
  };

  const onMouseUp = () => setIsDragging(false);

  const handleViewProfile = async (node) => {
    setIsAnalyzing(true);
    const query = node.label;
    const profile = Hub.getConnectedProfile(query);
    const assessment = await analyst.getSubjectInsight(query);
    setProfileData({ ...profile, assessment });
    setIsAnalyzing(false);
  };

  const buildGraph = () => {
    const newNodes = [];
    const newLinks = [];
    const nodeMap = new Map();

    const addNode = (id, label, type, data) => {
      if (!nodeMap.has(id)) {
        const node = { id, label, type, data, x: 0, y: 0 };
        nodeMap.set(id, node);
        newNodes.push(node);
      }
      return nodeMap.get(id);
    };

    const addLink = (sourceId, targetId, relation) => {
      newLinks.push({ source: sourceId, target: targetId, relation });
    };

    // 1. Core Hierarchy Processing
    const rootNodes = [];
    
    // Level 1: Investigations
    IntelData.allInvestigations.forEach((inv, idx) => {
      const invId = `inv_${inv.id}`;
      const invNode = addNode(invId, inv.intelType, 'Investigation', inv);
      rootNodes.push(invNode);

      // Level 2: Immediate connections (Suspects & Officers)
      (inv.suspects || []).forEach(suspect => {
        const susId = `person_${suspect.toLowerCase().replace(/\s+/g, '_')}`;
        addNode(susId, suspect, 'Suspect', { name: suspect });
        addLink(invId, susId, 'Involved');

        // Level 3: Arrests for these suspects
        ArrestData.arrest_data.filter(a => a.perp_name === suspect || (a.suspects || []).includes(suspect)).forEach(arr => {
          const arrId = `arr_${arr.caseID}`;
          addNode(arrId, `Arrest ${arr.caseID}`, 'Arrest', arr);
          addLink(susId, arrId, 'Linked Arrest');
        });
      });

      if (inv.officer) {
        const offId = `officer_${inv.officer.toLowerCase().replace(/\s+/g, '_')}`;
        addNode(offId, inv.officer, 'Officer', { name: inv.officer });
        addLink(invId, offId, 'Lead');
      }
    });

    // Handle Document Mentions from Hub as leaf nodes
    const hubIndex = Hub.getIndex();
    Object.keys(hubIndex.people).forEach(personKey => {
      const personId = `person_${personKey.replace(/\s+/g, '_')}`;
      if (nodeMap.has(personId)) {
        hubIndex.people[personKey].mentions.forEach(m => {
          const docId = `doc_${m.source.replace(/\s+/g, '_')}`;
          addNode(docId, m.source, 'Document', m);
          addLink(personId, docId, 'Mentioned In');
        });
      }
    });

    // 2. Compact Tree Positioning Algorithm
    const levelY = 120;
    const siblingX = 80;
    const branchX = 300;

    let currentX = 100;

    rootNodes.forEach(root => {
      // Find all descendants recursively to calculate branch width
      const children = newLinks.filter(l => l.source === root.id).map(l => nodeMap.get(l.target));
      const branchWidth = Math.max(children.length, 1) * siblingX;
      
      root.x = currentX + (branchWidth / 2);
      root.y = 80;

      children.forEach((child, i) => {
        child.x = currentX + (i * siblingX);
        child.y = root.y + levelY;

        // Level 3 connections
        const grandChildren = newLinks.filter(l => l.source === child.id).map(l => nodeMap.get(l.target));
        grandChildren.forEach((gc, j) => {
          gc.x = child.x + (j * 40); // Offset grandchildren slightly
          gc.y = child.y + levelY;

          // Level 4 (Docs)
          const leafNodes = newLinks.filter(l => l.source === gc.id).map(l => nodeMap.get(l.target));
          leafNodes.forEach((leaf, k) => {
            leaf.x = gc.x + (k * 30);
            leaf.y = gc.y + levelY;
          });
        });
      });

      currentX += branchWidth + 50;
    });

    setNodes(newNodes);
    setLinks(newLinks);
  };

  const getNodeColor = (type) => {
    switch (type) {
      case 'Investigation': return '#3b82f6';
      case 'Suspect': return '#ef4444';
      case 'Subject': return '#f59e0b';
      case 'Officer': return '#10b981';
      case 'Arrest': return '#ef4444';
      case 'Document': return '#64748b';
      default: return '#94a3b8';
    }
  };

  const getNodeIcon = (type) => {
    switch (type) {
      case 'Investigation': return 'fa-folder-open';
      case 'Suspect': return 'fa-user-secret';
      case 'Subject': return 'fa-user';
      case 'Officer': return 'fa-user-shield';
      case 'Arrest': return 'fa-handcuffs';
      case 'Document': return 'fa-file-alt';
      default: return 'fa-circle';
    }
  };

  return (
    <div className="intel-nexus-container">
      <div className="nexus-header">
        <div className="header-main">
          <h1><i className="fas fa-project-diagram"></i> Intelligence Nexus</h1>
          <div className="view-selector">
            <button className={`view-tab ${viewMode === 'graph' ? 'active' : ''}`} onClick={() => setViewMode('graph')}>
              <i className="fas fa-network-wired"></i> Tree View
            </button>
            <button className={`view-tab ${viewMode === 'map' ? 'active' : ''}`} onClick={() => { setViewMode('map'); setSelectedNode(null); setProfileData(null); }}>
              <i className="fas fa-map-marked-alt"></i> Geographic Hotspots
            </button>
          </div>
        </div>
        <p>Hierarchical {viewMode === 'graph' ? 'branching' : 'geographic'} mapping of Ugandan intelligence data.</p>
      </div>

      <div className="nexus-layout">
        <div 
          className={`graph-viewport ${viewMode}`} 
          ref={containerRef}
          onWheel={handleZoom}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <div className="transform-container" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`, transformOrigin: '0 0' }}>
            {viewMode === 'graph' ? (
              <svg width="2000" height="1500" style={{ overflow: 'visible' }}>
                <g className="links">
                  {links.map((link, i) => {
                    const source = nodes.find(n => n.id === link.source);
                    const target = nodes.find(n => n.id === link.target);
                    if (!source || !target) return null;
                    const isRelated = hoveredNode && (source.id === hoveredNode.id || target.id === hoveredNode.id);
                    return (
                      <path 
                        key={i}
                        d={`M ${source.x} ${source.y} L ${source.x} ${(source.y + target.y)/2} L ${target.x} ${(source.y + target.y)/2} L ${target.x} ${target.y}`}
                        fill="none"
                        className={`nexus-link ${isRelated ? 'active' : ''}`}
                        strokeWidth="1.5"
                        stroke="rgba(148, 163, 184, 0.2)"
                      />
                    );
                  })}
                </g>
                <g className="nodes">
                  {nodes.map(node => (
                    <g key={node.id} className={`nexus-node ${hoveredNode?.id === node.id ? 'hovered' : ''}`} onMouseEnter={() => setHoveredNode(node)} onMouseLeave={() => setHoveredNode(null)} onClick={(e) => { e.stopPropagation(); setSelectedNode(node); setProfileData(null); }} transform={`translate(${node.x},${node.y})`}>
                      <circle r="18" fill="#0f172a" stroke={getNodeColor(node.type)} strokeWidth="2" />
                      <foreignObject x="-9" y="-9" width="18" height="18">
                        <div className="node-icon-wrapper" style={{ color: getNodeColor(node.type), fontSize: '0.8rem' }}><i className={`fas ${getNodeIcon(node.type)}`}></i></div>
                      </foreignObject>
                      <text y="30" textAnchor="middle" fill="white" className="node-label" style={{ fontSize: '0.65rem' }}>{node.label}</text>
                    </g>
                  ))}
                </g>
              </svg>
            ) : (
              <div className="local-uganda-map">
                <svg width="100%" height="100%" preserveAspectRatio="none">
                  <image href="/uganda_map.svg" width="100%" height="100%" preserveAspectRatio="none" />
                </svg>
                {Object.entries(districtCoords).map(([name, pos]) => {
                  const hubHotspots = Hub.getGeographicIntelligence();
                  const hotspotData = hubHotspots[name] || { count: 0, incidents: [] };
                  if (hotspotData.count === 0) return null;
                  return (
                    <div key={name} className="real-map-marker" style={{ top: `${pos.y}%`, left: `${pos.x}%` }} onClick={() => setSelectedNode({ label: name, type: 'Hotspot', data: { crimes: hotspotData.incidents } })}>
                      <div className="pulse-container">
                        <div className="pulse-core" style={{ backgroundColor: hotspotData.count > 2 ? '#ef4444' : '#3b82f6' }}></div>
                        <div className="pulse-ring" style={{ borderColor: hotspotData.count > 2 ? '#ef4444' : '#3b82f6' }}></div>
                      </div>
                      <div className="marker-tooltip"><strong>{name}</strong><span>{hotspotData.count} Incidents</span></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="viewport-controls">
            <button onClick={() => setTransform(prev => ({ ...prev, k: prev.k * 1.5 }))} title="Zoom In"><i className="fas fa-plus"></i></button>
            <button onClick={() => setTransform(prev => ({ ...prev, k: prev.k * 0.7 }))} title="Zoom Out"><i className="fas fa-minus"></i></button>
            <button onClick={() => setTransform({ x: 50, y: 50, k: 0.7 })} title="Reset View"><i className="fas fa-sync-alt"></i></button>
          </div>
        </div>

        <div className="nexus-sidebar">
          {selectedNode ? (
            <div className="node-details-card">
              <div className="detail-header">
                <span className="type-tag" style={{ background: getNodeColor(selectedNode.type) + '33', color: getNodeColor(selectedNode.type) }}>{selectedNode.type}</span>
                <h2>{selectedNode.label}</h2>
              </div>
              <div className="detail-body">
                {profileData ? (
                  <div className="integrated-profile">
                    <div className={`assessment-badge level-${profileData.assessment.threatLevel.toLowerCase()}`}>{profileData.assessment.threatLevel} Threat</div>
                    <div className="profile-scroll-area">
                      <div className="section">
                        <h4>Findings</h4>
                        <ul className="findings-list">{profileData.assessment.findings.map((f, i) => <li key={i}>{f}</li>)}</ul>
                      </div>
                      {profileData.arrests.length > 0 && (
                        <div className="section">
                          <h4>Arrest History ({profileData.arrests.length})</h4>
                          {profileData.arrests.map((a, i) => <div key={i} className="mini-card">{a.details}</div>)}
                        </div>
                      )}
                      {profileData.hubMentions.length > 0 && (
                        <div className="section">
                          <h4>Document Mentions</h4>
                          {profileData.hubMentions.map((m, i) => <div key={i} className="mini-card">{m.source}</div>)}
                        </div>
                      )}
                    </div>
                    <button className="back-to-brief" onClick={() => setProfileData(null)}>Back to Info</button>
                  </div>
                ) : (
                  <>
                    {selectedNode.type === 'Investigation' && <><p><strong>Status:</strong> {selectedNode.data.status}</p><p><strong>Location:</strong> {selectedNode.data.location}</p><p className="desc">{selectedNode.data.desc}</p></>}
                    {selectedNode.type === 'Hotspot' && (
                      <div className="hotspot-details">
                        <p><strong>Total Incidents:</strong> {selectedNode.data.crimes.length}</p>
                        <div className="profile-scroll-area">
                          {selectedNode.data.crimes.map((c, i) => (
                            <div key={i} className="mini-card">
                              <div className="mini-card-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <strong style={{ color: '#3b82f6' }}>{c.type}</strong>
                                <span className="status-tag" style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#334155', borderRadius: '4px' }}>{c.status}</span>
                              </div>
                              <p className="mini-card-desc" style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: '5px 0 0 0' }}>{c.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(selectedNode.type === 'Suspect' || selectedNode.type === 'Subject' || selectedNode.type === 'Officer') && (
                      <>
                        <p><strong>Connections:</strong> {links.filter(l => l.source === selectedNode.id || l.target === selectedNode.id).length}</p>
                        <button className="view-profile-btn" onClick={() => handleViewProfile(selectedNode)}>{isAnalyzing ? 'Analyzing Hub...' : 'Load Full Intel Profile'}</button>
                      </>
                    )}
                    {selectedNode.type === 'Document' && <><p><strong>Source:</strong> {selectedNode.label}</p><p className="desc">"{selectedNode.data.summary}"</p></>}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="nexus-placeholder"><i className="fas fa-mouse-pointer"></i><p>Select a node or hotspot to view detailed intelligence data.</p></div>
          )}
          <div className="graph-legend">
            <h3>Legend</h3>
            <div className="legend-item"><span className="dot" style={{ background: '#3b82f6' }}></span> Investigation</div>
            <div className="legend-item"><span className="dot" style={{ background: '#ef4444' }}></span> Suspect / Arrest</div>
            <div className="legend-item"><span className="dot" style={{ background: '#10b981' }}></span> Lead Officer</div>
            <div className="legend-item"><span className="dot" style={{ background: '#64748b' }}></span> Document Mention</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntelNexus;
