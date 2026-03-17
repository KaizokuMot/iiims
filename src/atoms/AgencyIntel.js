import React from 'react'
import "./RecentSearch.css"
import { Link } from 'react-router-dom'


function AgencyIntel() {
  return (
    <div className='recents'>
        <div className='severe'>
        <h3 className='sev-title'>Reports On Terrorism</h3> 
        <Link to="/view-all">
        <div className='view-all-div'><p className='view-all-3'>View All</p></div>
        </Link>
        </div>
        <div>
        <div className='cmi-list'>

<h4 className='cmi-title'>Intel on Suspicious Activity</h4>
<span className='cmi-level badge  rounded-pill badge-info'>Critical</span>
<h4 className='cmi-title-2'>SEEN FOR 6 MONTHS</h4>
</div>

<div className='cmi-list'>
<h4 className='cmi-title'>Intel on Suspicious Activity</h4>
<span className='cmi-level badge  rounded-pill badge-info'>Critical</span>
<h4 className='cmi-title-2'>SEEN FOR 6 MONTHS</h4>
</div>
<div className='cmi-list'>
<h4 className='cmi-title'>Intel on Suspicious Activity</h4>
<span className='cmi-level badge  rounded-pill badge-info'>Critical</span>
<h4 className='cmi-title-2'>SEEN FOR 6 MONTHS</h4>
</div>
<div className='cmi-list'>
<h4 className='cmi-title'>Intel on Suspicious Activity</h4>
<span className='cmi-level badge  rounded-pill badge-info'>Critical</span>
<h4 className='cmi-title-2'>SEEN FOR 6 MONTHS</h4>
</div>

</div>


    </div>
  )
}

export default AgencyIntel