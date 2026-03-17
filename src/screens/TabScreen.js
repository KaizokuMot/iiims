import React from 'react'
import "./TabScreen.css"
import { Tab, initMDB } from "mdb-ui-kit";
import IntelAtom from '../atoms/IntelAtom';

initMDB({ Tab });
function TabScreen() {
  return (
    <div>
        {/* tabs */}
        <div id='tab-holder'>
      <ul class="nav nav-tabs nav-justified mb-3" id="ex1" role="tablist">
<li class="nav-item" role="presentation">
    <a
      data-mdb-tab-init
      class="nav-link active"
      id="ex3-tab-1"
      href="#ex3-tabs-1"
      role="tab"
      aria-controls="ex3-tabs-1"
      aria-selected="true"
      >Add Intel</a>
  </li>

  <li class="nav-item" role="presentation">
    <a
      data-mdb-tab-init
      class="nav-link"
      id="ex3-tab-2"
      href="#ex3-tabs-2"
      role="tab"
      aria-controls="ex3-tabs-2"
      aria-selected="false"
      >Process Suspect</a>
  </li>
</ul>
<div class="tab-content" id="ex3-content">
<div
    class="tab-pane fade show active"
    id="ex3-tabs-2"
    role="tabpanel"
    aria-labelledby="ex3-tab-2" >
<div className='match-parent'>
<h1>Hello World</h1>
</div>
  </div>


  <div
    class="tab-pane fade"
    id="ex3-tabs-1"
    role="tabpanel"
    aria-labelledby="ex3-tab-1"
  >
        <IntelAtom/>

  </div>
</div>      
        </div>
        {/* content */}


    </div>
  
)}

export default TabScreen