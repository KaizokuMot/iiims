import React from "react";
import "./ChipList.css";
import { Link } from "react-router-dom";

function ChipList() {
  return (
    <div className="list-item">
      <div className="cases-holder">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h4 className="cases-text">Matters Of National Security</h4>
          <Link to="/view-all">
            <p className="view-all">View All</p>
          </Link>
        </div>
      </div>
      <div className="list-holder">
        <div className="chip-top-list-area">
          <p className="location-text">Intel Provided By: Gen Msali Tendo</p>
          <span className="list-date badge rounded-pill badge-info">
            High Priority
          </span>
        </div>
        <p style={{ color: "green" }} className="cases-desc">
          Suspected Economic Hitman Sighted At Serena Hotel
        </p>
        <p className="cases-posted-by">Posted By Gen Maxium</p>
      </div>
      <div className="list-holder">
        <div className="chip-top-list-area">
          <p className="location-text">Intel Provided By: Gen Msali Tendo</p>
          <p className="list-date badge rounded-pill badge-info">
            Low Priority
          </p>
        </div>
        <p style={{ color: "green" }} className="cases-desc">
          The Formula For A Top-Secret Chemical Compound Leaked On The Darkweb
        </p>
        <p className="cases-posted-by">Posted By Gen Maxium</p>
      </div>
      <div className="list-holder">
        <div className="chip-top-list-area">
          <p className="location-text">Intel Provided By: Gen Msali Tendo</p>
          <span className="list-date badge rounded-pill badge-info">
            No Priority Assigned
          </span>
        </div>
        <p style={{ color: "green" }} className="cases-desc">
          The Formula For A Top-Secret Chemical Compound Leaked On The Darkweb
        </p>
        <p className="cases-posted-by">Posted By Gen Maxium</p>
      </div>
    </div>
  );
}

export default ChipList;
