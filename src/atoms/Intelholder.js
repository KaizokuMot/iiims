import React, { useState } from 'react';
import './Intelholder.css';
import TestData from '../TestDataPoint/Intel.js';
import { useLocation } from 'react-router-dom';

function Intelholder({title}) {

  const { state } = useLocation();
  console.error("passed data", state)

  const [sortBy, setSortBy] = useState(''); // State to store the current sorting criteria

  const handleSortBy = (criteria) => {
    setSortBy(criteria); // Update the sorting criteria state
  };

  let sortedInvestigations = TestData.allInvestigations.slice(); // Copy the array to avoid mutating the original data

  if (sortBy === 'location') {
    sortedInvestigations.sort((a, b) => a.location.localeCompare(b.location));
  } else if (sortBy === 'status') {
    sortedInvestigations.sort((a, b) => a.status.localeCompare(b.status));
  } else if (sortBy === 'agency') {
    sortedInvestigations.sort((a, b) => a.agency.localeCompare(b.agency));
  } else if(sortBy == "intelType"){
    sortedInvestigations.sort((a, b) => a.intelType.localeCompare(b.intelType));
  }

  return (
    <div className="intel-item-holder">
      <div className="filter-actions">
      {/* <p className="filter-inv">Filter All Investigations.</p> */}
        <p className="filter-inv">Filter All Investigations.</p>
        <div className="data-sort">
          <span className="badge rounded-pill badge-secondary" onClick={() => handleSortBy('intelType')}>
          Sort by IntelType
          </span>
          <span className="badge rounded-pill badge-success" onClick={() => handleSortBy('priority')}>
          Sort by Priority
          </span>
          <span className="badge rounded-pill badge-danger" onClick={() => handleSortBy('location')}>
          Sort by Location
          </span>
          <span className="badge rounded-pill badge-warning" onClick={() => handleSortBy('status')}>
          Sort by Case Status
          </span>

          <span className="badge rounded-pill badge-info" onClick={() => handleSortBy('agency')}>
            Sort by Agency
          </span>
        </div>
      </div>
      <div className="item-holder">
        <table className="table align-middle mb-0 bg-white">
          <thead className="bg-light" style={{ textAlignLast: 'center' }}>
            <tr>
              <th>Case ID</th>
              <th>Case Type</th>
              <th>Status</th>
              <th>Time/Date</th>
              <th>Priority</th>
              <th>Location</th>
              <th>Agency</th>
            </tr>
          </thead>
          <tbody>
            {sortedInvestigations.map((investigation) => (
              <tr key={investigation.id}>
                <td>
                  <div className="d-flex align-items-center">
                    <div className="ms-3">
                      <p className="fw-bold mb-1">{investigation.id}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <p className="fw-normal mb-1">{investigation.intelType}</p>
                </td>
                <td>
                  <span className="badge badge-success rounded-pill d-inline">{investigation.status}</span>
                </td>
                <td>{investigation.dateCreated}</td>
                <td>
                  <button type="button" className="btn btn-link btn-sm btn-rounded">
                    {investigation.priority}
                  </button>
                </td>
                <td>
                  <button type="button" className="btn btn-link btn-sm btn-rounded">
                    {investigation.location}
                  </button>
                </td>
                <td>{investigation.agency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Intelholder;
