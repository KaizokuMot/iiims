import React from 'react';
import "./IIBarChart.css";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function IIBarChart({ data }) {
  // If no data is provided, use an empty array to prevent errors
  const chartData = data || [];

  return (
    <div className='bar-sect'>
      <div className='bar-chart-holder'>
        <div className='activity-text'>
          <h3 className='activity-title'>Case Distribution By District</h3>
        </div>
        <div className='bar-holder'>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="resolved" name="Resolved Cases" fill="#8884d8" />
              <Bar dataKey="new" name="New Cases" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default IIBarChart;
