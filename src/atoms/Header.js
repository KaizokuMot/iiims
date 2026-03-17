import React from 'react'
import "./Header.css"
import Logo from "../media/logo_svg.svg"
import SearchBar from './SearchBar'
import UserAuthActions from './UserAuthActions'

function Header() {
    return (
        <div className='header-element'>
            <div className='logo-holder'>
                <img className='logo' src={Logo} />
            </div>
            {/* search bar */}
            <div className='search-atom'>
                <SearchBar />
            </div>
            {/* user-auth-actions */}
            <div className='user-auth-actions'>
            <UserAuthActions/>
            </div>

        </div>
    )
}

export default Header