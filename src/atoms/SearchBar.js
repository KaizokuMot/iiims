import React from 'react'
import "./SearchBar.css"

function SearchBar() {
    return (
     <div class="search-local">
	<div class="icon">
		<ion-icon name="search-outline"></ion-icon>
	</div>

	<input className='search-area' type="text" placeholder="Look up a case..."/>
	<button className='btn-serach'>
		Search
	</button>
</div>

    )
}

export default SearchBar