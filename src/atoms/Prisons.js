import React from "react";
import "./DashboardListItem.css"
import PrisonData from "../TestDataPoint/PrisonData";
import { Link } from "react-router-dom";

function Prisons() {
  return (
    <div className="dash-list-item">
      <div className="top-level-item">
        <h4 class="holder-text">Desertion Data</h4>
        <div className="holder-action-item">
          <Link>
          <p class="holder-actions">View All</p>
          </Link>
          <i id="white-arrow" class="fa-solid fa-arrow-right"></i>
        </div>
      </div>
      {PrisonData.prisons_data.map((caseItem) => (
        <div className="details-holder" key={caseItem.caseID}>
          <p className="perp-name">
            <span className="span">Prisoner Name: </span>
            {caseItem.name}
          </p>
          <p className="arrest-location">
            <span className="span">Gender: </span>
            {caseItem.gender}
          </p>
          {/* <p>
            <span className="span">Crime: </span>
            {caseItem.crime}
          </p>
          <p>
            <span className="span">Sentence: </span>{caseItem.sentence}
          </p> */}
          {/* <p className="arrest-date">
            <span className="span">Location: </span>
            {caseItem.location}
          </p> */}
          <p className="arrest-date">
            <span className="span">Date Created: </span>
            {caseItem.date_of_entry}
          </p>
        </div>
      ))}
    </div>
  );
}

export default Prisons;
