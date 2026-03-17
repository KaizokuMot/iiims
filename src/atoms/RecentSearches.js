import React from 'react'
import "./RecentSearch.css"


function RecentSearches() {
  return (
    <div className='recents'>
        <div className='severe'>
        <h3 className='sev-title'>Police Reports</h3> 
        <div className='view-all-div'><p className='view-all-3'>View All</p></div>
        </div>
        <div>
        <div className='list-holder' >
        <div className='chip-top-list-area'>
            <p className='location-text'>Intel Provided By: Gen Msali Tendo</p>
            <p className='list-date badge rounded-pill badge-info'>Low Priority</p>
            </div>
            <p style={{color:"green"}} className='cases-desc'>The Formula For A Top-Secret Chemical Compound Leaked On The Darkweb</p>
            <p className='cases-posted-by'>Posted By Gen Maxium</p>
       
        </div>

        <div className='list-holder' >
        <div className='chip-top-list-area'>
            <p className='location-text'>Intel Provided By: Gen Msali Tendo</p>
            <p className='list-date badge rounded-pill badge-info'>Low Priority</p>
            </div>
            <p style={{color:"green"}} className='cases-desc'>The Formula For A Top-Secret Chemical Compound Leaked On The Darkweb</p>
            <p className='cases-posted-by'>Posted By Gen Maxium</p>
       
        </div>

</div>


    </div>
  )
}

export default RecentSearches