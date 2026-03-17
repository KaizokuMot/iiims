import React, { useState, useEffect } from 'react';
import './AgentCenter.css';
import { AnalystAgent } from '../agents/AnalystAgent';

const AgentCenter = () => {
  const [agents, setAgents] = useState([
    { 
      id: 'analyst-01', 
      name: 'Senior Analyst (Intel)', 
      type: 'Analyst', 
      status: 'Idle', 
      lastActive: 'Never',
      description: 'Aggregates intelligence from all sources and generates briefing reports for the Central Hub.',
      instance: new AnalystAgent() 
    },
    { 
      id: 'watcher-01', 
      name: 'Sentinel (Facial Rec)', 
      type: 'Watcher', 
      status: 'Standby', 
      lastActive: 'Now',
      description: 'Monitors video feeds for known subjects. (Managed via Facial Recognition Screen)',
      instance: null 
    },
    { 
      id: 'spider-01', 
      name: 'Widow (Web Crawler)', 
      type: 'Crawler', 
      status: 'Standby', 
      lastActive: 'Never',
      description: 'Scans open source intelligence sources for keywords. (Managed via Web Crawler Screen)',
      instance: null 
    }
  ]);

  const [logs, setLogs] = useState([]);

  const addLog = (agentName, message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${agentName}: ${message}`, ...prev].slice(0, 50));
  };

  const handleRunAgent = async (agentId) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    if (agent.type === 'Analyst' && agent.instance) {
      // Update status to running
      updateAgentStatus(agentId, 'Running Analysis...');
      addLog(agent.name, 'Starting intelligence aggregation cycle...');

      try {
        // Simulate processing time for realism
        setTimeout(async () => {
          const result = await agent.instance.runAnalysis();
          updateAgentStatus(agentId, 'Idle - Briefing Filed');
          updateAgentLastActive(agentId);
          addLog(agent.name, result.summary);
          addLog('System', 'New document added to Central Hub: Intelligence Briefing');
        }, 2000);
      } catch (e) {
        updateAgentStatus(agentId, 'Error');
        addLog(agent.name, `Failed: ${e.message}`);
      }
    } else {
      addLog('System', `${agent.name} is a managed service. Please use its dedicated dashboard.`);
    }
  };

  const updateAgentStatus = (id, status) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  const updateAgentLastActive = (id) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, lastActive: new Date().toLocaleTimeString() } : a));
  };

  return (
    <div className="agent-center-container">
      <div className="agent-header">
        <h1><i className="fas fa-robot"></i> Bureau of Agents</h1>
        <p>Deploy and monitor autonomous intelligence agents to learn and update the Central Hub.</p>
      </div>

      <div className="agent-grid">
        {agents.map(agent => (
          <div key={agent.id} className={`agent-card ${agent.status.includes('Running') ? 'running' : ''}`}>
            <div className="agent-card-header">
              <div className="agent-icon">
                <i className={`fas ${agent.type === 'Analyst' ? 'fa-brain' : agent.type === 'Watcher' ? 'fa-eye' : 'fa-spider'}`}></i>
              </div>
              <div className="agent-title">
                <h3>{agent.name}</h3>
                <span className="agent-type">{agent.type}</span>
              </div>
              <div className={`status-indicator ${agent.status.toLowerCase().split(' ')[0]}`}>
                {agent.status}
              </div>
            </div>
            
            <p className="agent-desc">{agent.description}</p>
            
            <div className="agent-stats">
              <span><i className="fas fa-clock"></i> Last Active: {agent.lastActive}</span>
            </div>

            <div className="agent-actions">
              <button 
                className="deploy-btn" 
                onClick={() => handleRunAgent(agent.id)}
                disabled={agent.status.includes('Running')}
              >
                {agent.status.includes('Running') ? 'Processing...' : 'Deploy Agent'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="console-output">
        <div className="console-header">
          <h3><i className="fas fa-terminal"></i> Agent Operations Log</h3>
          <button className="clear-log" onClick={() => setLogs([])}>Clear</button>
        </div>
        <div className="console-window">
          {logs.length > 0 ? (
            logs.map((log, i) => <div key={i} className="log-line">{log}</div>)
          ) : (
            <div className="log-line system-msg">System ready. Waiting for agent deployment...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentCenter;
