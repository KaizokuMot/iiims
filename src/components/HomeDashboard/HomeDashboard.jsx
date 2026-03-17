import React, { useState, useMemo } from "react";
import { Badge } from "../../components/ui/badge";
import {
  PieChart, Pie, BarChart, Bar, XAxis, YAxis, 
  Tooltip, Cell, ResponsiveContainer, CartesianGrid ,Legend ,LineChart, Line
} from "recharts";
import Intel from "../../TestDataPoint/Intel";
import "./HomeDashboard.css";
import { useNavigate } from 'react-router-dom';

// Add at the top of your component:


function HomeDashboard() {
  const [selectedCase, setSelectedCase] = useState(null);
  const [timeFilter, setTimeFilter] = useState('all');
  const [activeModal, setActiveModal] = useState(null);
  const navigate = useNavigate();
  // Modal content configurations
  const modalContent = {
    locationStats: {
      title: "Location Analysis",
      content: (analytics) => (
        <div className="modal-content">
          <div className="detailed-stats">
            <h3>High Activity Areas</h3>
            {analytics.locationData.map((loc) => (
              <div key={loc.name} className="stat-row">
                <span>{loc.name}</span>
                <div className="stat-details">
                  <span>{loc.value} cases</span>
                  <span className="trend">
                    {Math.random() > 0.5 ? "↑" : "↓"} {Math.floor(Math.random() * 20)}% from last month
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="risk-assessment">
            <h3>Risk Assessment</h3>
            {analytics.locationData.map((loc) => (
              <div key={loc.name} className="risk-row">
                <span>{loc.name}</span>
                <Badge className={loc.value > 5 ? "high-risk" : "low-risk"}>
                  {loc.value > 5 ? "High Risk" : "Low Risk"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )
    },
    caseTypes: {
      title: "Case Type Analysis",
      content: (analytics) => (
        <div className="modal-content">
          <div className="type-breakdown">
            {analytics.typeData.map((type) => (
              <div key={type.name} className="type-row">
                <h3>{type.name}</h3>
                <div className="type-stats">
                  <div className="stat-item">
                    <span>Total Cases</span>
                    <span>{type.value}</span>
                  </div>
                  <div className="stat-item">
                    <span>Resolution Rate</span>
                    <span>{Math.floor(Math.random() * 40 + 60)}%</span>
                  </div>
                  <div className="stat-item">
                    <span>Avg Resolution Time</span>
                    <span>{Math.floor(Math.random() * 10 + 5)} days</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    agencyWorkload: {
      title: "Agency Performance Metrics",
      content: (analytics) => (
        <div className="modal-content">
          {Object.entries(analytics.agencyWorkload).map(([agency, count]) => (
            <div key={agency} className="agency-metrics">
              <h3>{agency}</h3>
              <div className="metric-grid">
                <div className="metric-item">
                  <span>Active Cases</span>
                  <span>{count}</span>
                </div>
                <div className="metric-item">
                  <span>Success Rate</span>
                  <span>{Math.floor(Math.random() * 20 + 80)}%</span>
                </div>
                <div className="metric-item">
                  <span>Response Time</span>
                  <span>{Math.floor(Math.random() * 4 + 1)}h</span>
                </div>
                <div className="metric-item">
                  <span>Resource Utilization</span>
                  <span>{Math.floor(Math.random() * 30 + 70)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )
    },
    predictions: {
      title: "Predictive Analytics",
      content: (analytics) => (
        <div className="modal-content">
          <div className="prediction-metrics">
            <div className="prediction-section">
              <h3>Case Volume Forecast</h3>
              <div className="forecast-grid">
                <div className="forecast-item">
                  <span>Next Week</span>
                  <span>{Math.floor(analytics.totalCases * 1.1)} cases</span>
                </div>
                <div className="forecast-item">
                  <span>Next Month</span>
                  <span>{Math.floor(analytics.totalCases * 1.25)} cases</span>
                </div>
                <div className="forecast-item">
                  <span>Next Quarter</span>
                  <span>{Math.floor(analytics.totalCases * 1.5)} cases</span>
                </div>
              </div>
            </div>
            <div className="prediction-section">
              <h3>Risk Trends</h3>
              <div className="trend-grid">
                {Object.entries(analytics.priorityBreakdown).map(([priority, count]) => (
                  <div key={priority} className="trend-item">
                    <span>{priority}</span>
                    <span className={count > 5 ? "trend-up" : "trend-down"}>
                      {count > 5 ? "↑" : "↓"} {Math.floor(Math.random() * 20)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )
    },
    recentIntelligence: {
      title: "Recent Intelligence Details",
      content: (analytics) => (
        <div className="modal-content">
          <div className="intel-detailed-view">
            <div className="intel-filters">
              <select className="intel-filter">
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select className="intel-filter">
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div className="intel-list">
              {analytics.recentActivities.map((intel) => (
                <div key={intel.id} className="intel-card-detailed">
                  <div className="intel-header">
                    <div className="intel-badges">
                      <Badge className={`priority-${intel.priority}`}>{intel.priority}</Badge>
                      <Badge className={`status-${intel.status}`}>{intel.status}</Badge>
                    </div>
                    <span className="intel-date">{new Date().toLocaleDateString()}</span>
                  </div>
                  <h3>{intel.intelType}</h3>
                  <p className="intel-description">{intel.desc}</p>
                  <div className="intel-metadata">
                    <div className="metadata-item">
                      <span>Location:</span>
                      <span>{intel.location}</span>
                    </div>
                    <div className="metadata-item">
                      <span>Agency:</span>
                      <span>{intel.agency}</span>
                    </div>
                    <div className="metadata-item">
                      <span>Response Time:</span>
                      <span>{Math.floor(Math.random() * 24)} hours</span>
                    </div>
                  </div>
                  <div className="intel-actions">
                    <button className="action-btn">View Details</button>
                    <button className="action-btn">Assign Task</button>
                    <button className="action-btn">Mark Priority</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    totalCases: {
      title: "Total Cases Overview",
      content: (analytics) => (
        <div className="modal-content">
          <div className="cases-list">
            {Intel.allInvestigations.map((caseItem) => (
              <div key={caseItem.id} className="case-item">
                <div className="case-header">
                  <div className="case-badges">
                    <Badge className={`priority-${caseItem.priority}`}>
                      {caseItem.priority}
                    </Badge>
                    <Badge className={`status-${caseItem.status}`}>
                      {caseItem.status}
                    </Badge>
                  </div>
                  <span className="case-date">
                    {new Date(caseItem.dateCreated).toLocaleDateString()}
                  </span>
                </div>
                <h3>{caseItem.intelType}</h3>
                <p className="case-description">{caseItem.desc}</p>
                <div className="case-details">
                  <div className="detail-item">
                    <span>Location:</span>
                    <span>{caseItem.location}</span>
                  </div>
                  <div className="detail-item">
                    <span>Agency:</span>
                    <span>{caseItem.agency}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    criticalCases: {
      title: "Critical Cases Analysis",
      content: (analytics) => (
        <div className="modal-content">
          <div className="critical-overview">
            <div className="critical-stats">
              <div className="stat-block urgent">
                <h3>Critical Cases</h3>
                <p className="stat-number">{analytics.criticalCases}</p>
                <p className="stat-trend">Requires Immediate Attention</p>
              </div>
              <div className="response-metrics">
                <h3>Response Metrics</h3>
                <div className="metrics-grid">
                  <div className="metric-item">
                    <span>Average Response Time</span>
                    <span>2.5 hours</span>
                  </div>
                  <div className="metric-item">
                    <span>Resolution Rate</span>
                    <span>92%</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="priority-actions">
              <h3>Recommended Actions</h3>
              <ul className="action-list">
                <li>Immediate resource allocation needed in Region A</li>
                <li>Escalate 3 pending cases to high command</li>
                <li>Schedule emergency response team briefing</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    openCases: {
      title: "Open Cases Status",
      content: (analytics) => (
        <div className="modal-content">
          <div className="open-cases-analysis">
            <div className="status-summary">
              <div className="stat-block">
                <h3>Total Open Cases</h3>
                <p className="stat-number">{analytics.openCases}</p>
                <p className="stat-trend">↓ 5% from last week</p>
              </div>
              <div className="workload-distribution">
                <h3>Agency Workload</h3>
                <div className="agency-grid">
                  {Object.entries(analytics.agencyWorkload).map(([agency, count]) => (
                    <div key={agency} className="agency-item">
                      <span>{agency}</span>
                      <span>{count} cases</span>
                      <div className="progress-bar">
                        <div 
                          className="progress" 
                          style={{width: `${(count/analytics.totalCases)*100}%`}}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
  };

  // Modal component
  const Modal = ({ title, children, onClose }) => (
    <div className="modal-overlay " onClick={onClose}>
      <div className="modal-container home-popup" onClick={e => e.stopPropagation()}>
        <div className="modal-header home-popup-header">
          <h2>{title}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );

  const analytics = useMemo(() => {
    const data = Intel.allInvestigations;
    
    // Enhanced analytics 
    const priorityBreakdown = data.reduce((acc, item) => {
      acc[item.priority] = (acc[item.priority] || 0) + 1;
      return acc;
    }, {});

    const agencyWorkload = data.reduce((acc, item) => {
      acc[item.agency] = (acc[item.agency] || 0) + 1;
      return acc;
    }, {});

    // Mock predictions
    const riskScore = Math.round((priorityBreakdown.critical * 3 + priorityBreakdown.high * 2) / data.length * 100);
    const predictedCases = Math.round(data.length * 1.15); // 15% increase prediction
    
    return {
      totalCases: data.length,
      criticalCases: data.filter(item => item.priority === 'critical').length,
      openCases: data.filter(item => item.status === 'open').length,
      recentActivities: data.slice(0, 5),
      locationData: Object.entries(
        data.reduce((acc, item) => {
          acc[item.location] = (acc[item.location] || 0) + 1;
          return acc;
        }, {})
      ).map(([name, value]) => ({ name, value })),
      typeData: Object.entries(
        data.reduce((acc, item) => {
          acc[item.intelType] = (acc[item.intelType] || 0) + 1;
          return acc;
        }, {})
      ).map(([name, value]) => ({ name, value })),
      priorityBreakdown,
      agencyWorkload,
      riskScore,
      predictedCases,
      highRiskLocations: data
        .filter(item => item.priority === 'critical' || item.priority === 'high')
        .reduce((acc, item) => {
          acc[item.location] = (acc[item.location] || 0) + 1;
          return acc;
        }, {}),
      caseResolutionTime: {
        average: "14 days",
        critical: "5 days",
        high: "10 days",
        medium: "15 days",
        low: "20 days"
      }
    };
  }, []);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        {/* <h1>111MS</h1> */}
        <div className="time-filters">
          {['all', 'month', 'week'].map(filter => (
            <button 
              key={filter}
              className={timeFilter === filter ? 'active' : ''} 
              onClick={() => setTimeFilter(filter)}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)} Time
            </button>
          ))}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card total-cases" onClick={() => setActiveModal('totalCases')}>
          <h3>Total Cases</h3>
          <p>{analytics.totalCases}</p>
          <small>↑ 12% from last week</small>
          <span className="sub-stat">8 Active • 2 Resolved</span>
        </div>
        <div className="stat-card critical-cases" onClick={() => setActiveModal('criticalCases')}>
          <h3>Critical Cases</h3>
          <p>{analytics.criticalCases}</p>
          <small>No change from last week</small>
          <span className="sub-stat">0 in last 24h</span>
        </div>
        <div className="stat-card open-cases" onClick={() => setActiveModal('openCases')}>
          <h3>Open Cases</h3>
          <p>{analytics.openCases}</p>
          <small>3 In Progress • 1 Pending</small>
          <span className="sub-stat">Last updated 2h ago</span>
        </div>
        {/* here */}
       <div className="analysis-card predictions" onClick={() => setActiveModal('predictions')}>
          <h2 style={{color:"#7a7a7a"}}>Predictions</h2>
          <div className="prediction-list">
            <div className="prediction-item">
              <span>Expected Cases (Next Month)</span>
              <span>{analytics.predictedCases}</span>
            </div>
            <div className="prediction-item">
              <span>Risk Trend</span>
              <span className={analytics.riskScore > 50 ? 'trend-negative' : 'trend'}>
                {analytics.riskScore > 50 ? '↑ Increasing' : '↓ Decreasing'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="chart-card location-distribution" onClick={() => setActiveModal('locationStats')}>
          <h2 className="card-title">Location Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart margin={{ top: 20, right: 30, left: 30, bottom: 20 }}>
              <Pie
                data={[
                  { name: 'Kampala', value: 35 },
                  { name: 'Entebbe', value: 25 },
                  { name: 'Jinja', value: 20 },
                  { name: 'Mbarara', value: 15 },
                  { name: 'Gulu', value: 12 },
                  { name: 'Mbale', value: 8 }
                ]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={90}
                innerRadius={60} // Added inner radius for donut effect
                fill="#8884d8"
                paddingAngle={2} // Added padding between segments
                label={false} // Removed labels from pie for cleaner look
              >
                <Cell fill="#FF6B6B" />
                <Cell fill="#4ECDC4" />
                <Cell fill="#45B7D1" />
                <Cell fill="#96CEB4" />
                <Cell fill="#FFEEAD" />
                <Cell fill="#D4A5A5" />
              </Pie>
              <Tooltip 
                formatter={(value) => [`${value} cases`, 'Count']}
                contentStyle={{ 
                  backgroundColor: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  padding: '8px'
                }}
              />
              <Legend 
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconType="circle"
                iconSize={10}
                wrapperStyle={{
                  paddingLeft: '20px',
                  fontSize: '12px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card case-types" 
        onClick={() => navigate('/data-entry')}
        >
          <h2 className="card-title">Case Types</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart 
              data={[
                { name: 'Surveillance', value: 45 },
                { name: 'Cyber Threats', value: 32 },
                { name: 'Asset Protection', value: 28 },
                { name: 'Personnel Security', value: 25 },
                { name: 'Counter Intel', value: 20 },
                { name: 'Physical Security', value: 15 }
              ]}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={60}
                tick={{ fill: '#333', fontSize: 12 }}
              />
              <YAxis 
                tick={{ fill: '#333' }}
                label={{ value: 'Number of Cases', angle: -90, position: 'insideLeft', fill: '#333' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  padding: '8px'
                }} 
              />
              <Bar dataKey="value" fill="#3b82f6">
                {/* Add gradient colors to bars */}
                {[
                  '#FF6B6B',
                  '#4ECDC4',
                  '#45B7D1',
                  '#96CEB4',
                  '#FFEEAD',
                  '#D4A5A5'
                ].map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div  className="analysis-card agency-workload" onClick={() => setActiveModal('agencyWorkload')}>
          <h2 className="card-title">Agency Workload</h2>
          <div className="workload-list">
            {[
              { agency: 'Internal Affairs', count: 45, totalCases: 165, status: 'high' },
              { agency: 'Criminal Investigation', count: 38, totalCases: 165, status: 'medium' },
              // { agency: 'Counter Intelligence', count: 32, totalCases: 165, status: 'high' },
              // { agency: 'Cyber Security Unit', count: 28, totalCases: 165, status: 'medium' },
              // { agency: 'Special Operations', count: 22, totalCases: 165, status: 'low' }
            ].map(({ agency, count, totalCases, status }) => (
              <div key={agency} className="workload-item">
                <div className="workload-header">
                  <span className="agency-name">{agency}</span>
                  <span className="case-count">{count} cases</span>
                </div>
                <div className="workload-bar">
                  <div 
                    className={`workload-fill status-${status}`}
                    style={{
                      width: `${(count / totalCases) * 100}%`,
                      backgroundColor: status === 'high' ? '#FF6B6B' : 
                                     status === 'medium' ? '#4ECDC4' : '#45B7D1'
                    }}
                  ></div>
                </div>
                <div className="workload-stats">
                  <span className="stat-item">
                    <small>Completion Rate</small>
                    <span>{Math.floor(Math.random() * 20 + 80)}%</span>
                  </span>
                  <span className="stat-item">
                    <small>Active Agents</small>
                    <span>{Math.floor(count * 1.5)}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="analysis-card resolution-times" onClick={() => setActiveModal('predictions')}>
          <h2 className="card-title">Case Resolution Times</h2>
          <div className="resolution-list">
            {Object.entries(analytics.caseResolutionTime).map(([priority, time]) => (
              <div key={priority} className="resolution-item">
                <span>{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>
                <span>{time}</span>
              </div>
            ))}
          </div>
        </div>

        
      </div>

      {/* Modal rendering */}
      {activeModal && (
        <Modal 
          title={modalContent[activeModal].title}
          onClose={() => setActiveModal(null)}
        >
          {modalContent[activeModal].content(analytics)}
        </Modal>
      )}

      {/* <div className="recent-activities" onClick={() => setActiveModal('recentIntelligence')}>
        <h2>Recent Intelligence</h2>
        <div className="activities-grid">
          {analytics.recentActivities.map((intel) => (
            <div key={intel.id} className="activity-card">
              <div className="activity-header">
                <Badge className={`priority-${intel.priority}`}>{intel.priority}</Badge>
                <Badge className={`status-${intel.status}`}>{intel.status}</Badge>
              </div>
              <h3>{intel.intelType}</h3>
              <p>{intel.desc.substring(0, 100)}...</p>
              <div className="activity-footer">
                <span>{intel.location}</span>
                <span>{intel.agency}</span>
              </div>
            </div>
          ))}
        </div>
      </div> */}
    </div>
  );
}

export default HomeDashboard;









