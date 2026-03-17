import React from "react";
import "./ListItem.css";
import { Link } from "react-router-dom";

function ListItem() {
  return (
    <div className="list-item">
      <div className="cases-holder">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h4 className="cases-text">Intel On Military Offences</h4>
          <Link to={{pathname:"/view-all",
          state: "Intel On Military"}}>
            <p className="view-all">View All</p>
          </Link>
        </div>
      </div>

      <div className="top-list-area">
        <p className="location-text">Location: Nanasana Police Post</p>
        <p className="list-date">JULY 2nd, 2023</p>
      </div>

      <p style={{ color: "green" }} className="cases-desc">
      Suspected deserter sighted with ammunation by locals.
      </p>
      <p className="cases-posted-by">Posted By Kalanzi Dixon</p>
      <div className="top-list-area">
        <p className="location-text">Location: Nanasana Police Post</p>
        <p className="list-date">JULY 2, 2023</p>
      </div>
      <p className="cases-desc">
        Suspected desserter sighted with ammunation by locals.
      </p>
      <p className="cases-posted-by">Posted By Kalanzi Dixon</p>
      <div className="top-list-area">
        <p className="location-text">Location: Nanasana Police Post</p>
        <p className="list-date">JULY 2, 2023</p>
      </div>
      <p style={{ color: "red" }} className="cases-desc">
      Suspected deserter sighted with ammunation by locals.
      </p>
      <p className="cases-posted-by">Posted By Kalanzi Dixon</p>
    </div>
  );
}

export default ListItem;
