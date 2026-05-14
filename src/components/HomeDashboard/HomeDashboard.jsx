import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, CartesianGrid
} from "recharts";
import Intel from "../../TestDataPoint/Intel";
import "./HomeDashboard.css";
import { useNavigate } from 'react-router-dom';

function HomeDashboard() {
  const navigate = useNavigate();
  const [activityTime, setActivityTime] = useState('weekly');

  const investigations = Intel.allInvestigations;

  // Dummy data generated for the charts to mimic the design
  const barData = Array.from({ length: 30 }, (_, i) => ({
    name: i + 1,
    value: Math.floor(Math.random() * 50) + 10
  }));

  const lineData = Array.from({ length: 12 }, (_, i) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      name: months[i],
      year2024: Math.floor(Math.random() * 30) + 5,
      year2023: Math.floor(Math.random() * 30) + 10,
    };
  });

  const progressData = [
    { label: "Cases Closed", percentage: Math.round((investigations.filter(i => i.status === 'closed').length / investigations.length) * 100), color: "#3b82f6" },
    { label: "High Priority", percentage: Math.round((investigations.filter(i => i.priority === 'high').length / investigations.length) * 100), color: "#ef4444" },
    { label: "Active Investigations", percentage: Math.round((investigations.filter(i => i.status === 'open').length / investigations.length) * 100), color: "#f59e0b" },
    { label: "Resolution Tracking", percentage: 80, color: "#10b981" }
  ];

  const microChartData1 = Array.from({ length: 10 }, () => ({ value: Math.random() * 100 }));
  const microChartData2 = Array.from({ length: 10 }, () => ({ value: Math.random() * 100 }));

  const bottomBarData = Array.from({ length: 8 }, () => ({
    a: Math.floor(Math.random() * 100),
    b: Math.floor(Math.random() * 100)
  }));

  // Dynamic pie chart data
  const priorityCounts = investigations.reduce((acc, curr) => {
    acc[curr.priority] = (acc[curr.priority] || 0) + 1;
    return acc;
  }, {});
  const priorityData = Object.entries(priorityCounts).map(([name, value]) => ({ name: name.toUpperCase(), value }));
  const pieColors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];

  const typeCounts = investigations.reduce((acc, curr) => {
    acc[curr.intelType] = (acc[curr.intelType] || 0) + 1;
    return acc;
  }, {});
  const caseTypesData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));

  const calendarDays = Array.from({ length: 35 }, (_, i) => {
    let date = i - 3; // Shift to make 1st start on specific day
    if (date < 1 || date > 31) return "";
    return date;
  });

  const recentIntel = investigations.slice(0, 3);
  const event1 = investigations[0];
  const event2 = investigations[1];

  return (
    <div className="new-dashboard-container">
      
      {/* TOP ROW */}
      <div className="dashboard-row">
        
        {/* Activity Bar Chart */}
        <div className="dash-card main-activity">
          <div className="card-header">
            <h3>Investigation Activity</h3>
            <div className="toggle-buttons">
              <button className={activityTime === 'day' ? 'active' : ''} onClick={() => setActivityTime('day')}>Day</button>
              <button className={activityTime === 'weekly' ? 'active' : ''} onClick={() => setActivityTime('weekly')}>Weekly</button>
            </div>
          </div>
          <div className="chart-wrapper bar-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <Tooltip cursor={{fill: '#374151'}} contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6' }} wrapperStyle={{ zIndex: 1000 }} itemStyle={{ color: '#f3f4f6' }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Calendar and Events */}
        <div className="dash-card calendar-events-card">
           <div className="calendar-section">
              <div className="calendar-header">
                <span className="arrow">&lt;</span>
                <h4>February 2024</h4>
                <span className="arrow">&gt;</span>
              </div>
              <div className="calendar-grid">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => <div key={d} className="cal-day-name">{d}</div>)}
                {calendarDays.map((day, i) => (
                  <div key={i} className={`cal-day ${day === 20 ? 'active-day-blue' : ''} ${day === 18 ? 'active-day-dark' : ''}`}>
                    {day}
                  </div>
                ))}
              </div>
           </div>
           <div className="events-section">
              <div className="event-card blue-event">
                 <div className="event-date">
                   <span className="day-name">TUE</span>
                   <span className="day-num">20</span>
                 </div>
                 <div className="event-details">
                   <div className="event-time">Priority: {event1.priority} <span>{event1.intelType} reported</span></div>
                   <div className="event-time">Location: <span>{event1.location}</span></div>
                 </div>
              </div>
              <div className="event-card light-blue-event">
                 <div className="event-date">
                   <span className="day-name">SUN</span>
                   <span className="day-num">18</span>
                 </div>
                 <div className="event-details">
                   <div className="event-time">Priority: {event2.priority} <span>{event2.intelType} reported</span></div>
                   <div className="event-time">Location: <span>{event2.location}</span></div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* MIDDLE ROW */}
      <div className="dashboard-row">
        
        {/* Activity Line Chart */}
        <div className="dash-card trends-activity">
          <div className="card-header">
            <h3>Monthly Trends</h3>
            <div className="toggle-buttons">
              <button>Day</button>
              <button className="active">Weekly</button>
            </div>
          </div>
          <div className="chart-wrapper line-wrapper">
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#374151" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6' }} wrapperStyle={{ zIndex: 1000 }} itemStyle={{ color: '#f3f4f6' }} />
                  <Line type="monotone" dataKey="year2024" stroke="#ef4444" strokeWidth={3} dot={{r: 4, strokeWidth: 2, fill: '#1f2937'}} activeDot={{r: 6}} />
                  <Line type="monotone" dataKey="year2023" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, strokeWidth: 2, fill: '#1f2937'}} activeDot={{r: 6}} />
                </LineChart>
             </ResponsiveContainer>
             <div className="legend-box">
                <div className="legend-item"><span className="dot red-dot"></span> 2024</div>
                <div className="legend-item"><span className="dot blue-dot"></span> 2023</div>
             </div>
          </div>
        </div>

        {/* Circular Progress */}
        <div className="dash-card progress-card">
          <div className="card-header">
            <h3>Intel Overview</h3>
            <span className="more-dots">•••</span>
          </div>
          <div className="progress-grid">
            {progressData.map((prog, index) => (
              <div key={index} className="progress-item">
                <div className="circular-chart" style={{ '--prog-color': prog.color, '--prog-percent': `${prog.percentage}%` }}>
                  <svg viewBox="0 0 36 36">
                    <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="circle" strokeDasharray={`${prog.percentage}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" style={{stroke: prog.color}}/>
                    <text x="18" y="20.35" className="percentage">{prog.percentage}%</text>
                  </svg>
                </div>
                <div className="prog-details">
                  <span className="prog-num">0{index + 1}</span>
                  <p>{prog.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="dashboard-row bottom-row">
        
        {/* Complex Stats Card */}
        <div className="dash-card complex-stats">
           <div className="stats-top">
              <div className="micro-chart-row">
                 <div className="micro-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={microChartData1}>
                        <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="micro-info">
                   <h4>PATTERN ANALYSIS</h4>
                   <p>Surveillance feeds</p>
                 </div>
                 <div className="micro-badge">+12.4%</div>
              </div>
              <div className="micro-chart-row">
                 <div className="micro-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={microChartData2}>
                        <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="micro-info">
                   <h4>THREAT METRICS</h4>
                   <p>Risk assessment</p>
                 </div>
                 <div className="micro-badge" style={{color: '#f59e0b', borderColor: '#f59e0b'}}>+8.2%</div>
                 <div className="micro-badge" style={{color: '#10b981', borderColor: '#10b981'}}>-2.1%</div>
              </div>
           </div>

           <div className="stats-bottom">
              <div className="mini-bar-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bottomBarData}>
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10}} width={30} />
                    <Bar dataKey="a" fill="#ef4444" radius={[2, 2, 0, 0]} barSize={8} />
                    <Bar dataKey="b" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={8} />
                    <Tooltip cursor={{fill: '#374151'}} contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6' }} wrapperStyle={{ zIndex: 1000 }} itemStyle={{ color: '#f3f4f6' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="stats-list">
                 {recentIntel.map((intel, index) => (
                   <div key={intel.id} className={`stat-list-item ${index === 1 ? 'active' : ''}`}>
                      <div className={`radio-btn ${index === 1 ? 'active' : ''}`}></div>
                      <div className="stat-list-info">
                        <span className="num">0{index + 1}</span>
                        <p><strong>{intel.intelType} ({intel.location}):</strong> {intel.desc.length > 60 ? intel.desc.substring(0, 60) + '...' : intel.desc}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Budgets and Cases Distribution */}
        <div className="dash-card distribution-card">
           <div className="dist-section">
              <h3>Priority Distribution</h3>
              <div className="doughnut-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={priorityData} innerRadius="70%" outerRadius="90%" paddingAngle={5} dataKey="value" stroke="none">
                      {priorityData.map((entry, index) => <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6' }} wrapperStyle={{ zIndex: 1000 }} itemStyle={{ color: '#f3f4f6' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="doughnut-center">
                   <span className="val">{investigations.length}</span>
                   <span className="sub-val">Total</span>
                </div>
              </div>
           </div>
           
           <div className="dist-separator"></div>

           <div className="dist-section">
              <h3>Case Types</h3>
              <div className="pie-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={caseTypesData} outerRadius="90%" dataKey="value" stroke="none">
                      {caseTypesData.map((entry, index) => <Cell key={`cell-${index}`} fill={pieColors[(index + 2) % pieColors.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', color: '#f3f4f6' }} wrapperStyle={{ zIndex: 1000 }} itemStyle={{ color: '#f3f4f6' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pie-center">
                   <span className="val">{caseTypesData.length}</span>
                   <span className="sub-val">Types</span>
                </div>
              </div>
           </div>
        </div>

      </div>

    </div>
  );
}

export default HomeDashboard;
