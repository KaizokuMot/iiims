import React from 'react'
import "./DashboardListItem.css"
import ArrestData from '../TestDataPoint/ArrestData'
import { Link } from 'react-router-dom'

function DashboardListItem() {

// console.log("arrest data", ArrestData.arrest_data);
  
return (
    <div className='dash-list-item'>
<div className='top-level-item'>
<h4 class="holder-text">Suspect Watch List </h4>
<div className='holder-action-item'>
<Link>
<p class="holder-actions">View All</p>
</Link>
<i id='white-arrow' class="fa-solid fa-arrow-right"></i>
</div>
</div>
{
        ArrestData.arrest_data.slice(0, 7).map((caseItem) => (
          <div className='details-holder' key={caseItem.caseID}>
            <p className='perp-name'><span className='span'>Suspect: </span>{caseItem.perp_name}</p>
            <p className='arrest-location'><span className='span'>Location: </span>{caseItem.location}</p>
            <p><span className='span'>Crime Details: </span>{caseItem.details}</p>
            <p><span className='span'>Posted By: </span>{caseItem.postedBy}</p>
            <p className='arrest-date'><span className='span'>Date Created: </span>{caseItem.dateCreated}</p>
          </div>
        ))
      }


</div>
  )
}

export default DashboardListItem