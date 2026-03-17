import React from 'react'
import "./UserAuthActions.css"
import IC from "../media/chat.png"
import UserIC from "../media/user_ic.png"
import Help from "../media/help.png"

function UserAuthActions() {
  return (
    <div className='UserAuthActions' >
            <img className='chat-ic' src={IC}/>
            <img className='chat-ic' src={Help}/>
            <img className='chat-ic' src={UserIC}/>

        </div>
  )
}

export default UserAuthActions