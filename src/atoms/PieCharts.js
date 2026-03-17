import React, { useState } from 'react';
import "./PieCharts.css";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Link, useNavigate } from 'react-router-dom';


function PieCharts() {
  const [selectedSection, setSelectedSection] = useState(null);
  const navigate = useNavigate();

  const data = [
    { name: ' Terrorism', value: 9.09 },
    { name: ' Sabotage', value: 18.18 },
    { name: ' Insubordination', value: 15.15 },
    { name: ' Espionage', value: 15.15 },
    { name: ' Subversion', value: 18.18 },
    { name: ' National Security', value: 12.12 },
    { name: ' Miltary Offences', value: 12.12 },

  ];
  
  const COLORS = ["#64FF33" ,"#33FFE0" ,"#FF0000",'#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  const RADIAN = Math.PI / 180;

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const endPoint=()=>{
    navigate("/view-all")
  }

  
  const handlePieClick = (entry) => {
    setSelectedSection(entry);
  };

  const Popup = () => {

    console.log("Hello, Am Right hHere",selectedSection)
    
    endPoint()

    return (
      <div className="popup">
        <h2>{selectedSection && selectedSection.name}</h2>
        <p>{selectedSection && selectedSection.value}</p>
        <button onClick={() => setSelectedSection(null)}>Close</button>
      </div>
    );
  };


  return (
    <div className='pie-sect'>
        <div className='cases-holder'>
        <div style={{display:"flex", justifyContent:"space-between"}}>
                <h4 className='cases-text'>Open Investigations</h4>
                <Link to="/view-all">
        <p className='view-all'>View All</p>

                </Link>
        </div>
    </div>
      <div className='pie-section'>
      <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={80}
              onClick={handlePieClick}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend className='leg' margin={"-60px"} iconSize={0} layout="vertical" verticalAlign="middle" align="right" />
          </PieChart>
        </ResponsiveContainer>
        
      </div>
      {selectedSection && <Popup />} {/* Conditionally render the Popup component */}

    </div>
  );
}

export default PieCharts;
