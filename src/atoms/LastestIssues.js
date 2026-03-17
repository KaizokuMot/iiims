import React from 'react'
import "./LastestIssues.css"
import { Link } from 'react-router-dom'

function LastestIssues() {
  return (
    <div className='severe-holder'>
        <div className='cases-holder'>
        <div style={{display:"flex", justifyContent:"space-between"}}>
                <h4 className='cases-text'>Intel On Espionage</h4>
<Link>
        <p className='view-all'>View All</p>
</Link>
        
        </div>
    </div>

        <div className='cmi-list'>

            <h4 className='cmi-title'>Intel on Suspicious Activity</h4>
            <span className='cmi-level badge rounded-pill badge-info'>Critical</span>
        </div>

<div className='cmi-list'>
<h4 className='cmi-title'>Intel on Suspicious Activity</h4>
<span className='badge  rounded-pill badge-info'>Critical</span>
{/* <h4 className='cmi-title-2'>SEEN FOR 7 MONTHS</h4> */}
</div>
<div className='cmi-list'>
<h4 className='cmi-title'>Intel on Suspicious Activity</h4>
<span className='cmi-level badge  rounded-pill badge-info'>Critical</span>
{/* <h4 className='cmi-title-2'>SEEN FOR 9 MONTHS</h4> */}
</div>

<div className='cmi-list'>
<h4 className='cmi-title'>Intel on Suspicious Activity</h4>
<span className='cmi-level badge  rounded-pill badge-info'>Critical</span>
{/* <h4 className='cmi-title-2'>SEEN FOR 10 MONTHS</h4> */}
</div>


<div className='cmi-list'>
<h4 className='cmi-title'>Suspicious Activity</h4>
<span className='cmi-level badge rounded-pill badge-info'>Critical</span>
{/* <h4 className='cmi-title-2'>SEEN FOR 16 MONTHS</h4> */}
</div>
<div className='cmi-list'>

<h4 className='cmi-title'>Suspicious Activity</h4>
<span className='cmi-level rounded-pill badge badge-info'>Critical</span>
{/* <h4 className='cmi-title-2'>SEEN FOR 26 MONTHS</h4> */}
</div>
{/* lower  */}
    </div>
  )
}

export default LastestIssues