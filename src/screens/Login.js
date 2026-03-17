import React, { useState } from 'react';
import './Login.css'; // Updated CSS file
import Logo from "../media/logo_white.jpg"
import { Link } from 'react-router-dom';

function Login() {
  const [isInputActive, setIsInputActive] = useState(false);

  const handleInputBlur = (event) => {
    const textValue = event.target.value;
    setIsInputActive(textValue !== '');
  };

  return (
    <div className='login-holder'>

    <div className='well'>


<div className='logo-holder-login'>
{/* <img className='login-logo' src={Logo}/> */}
<p className='version'>Beta ~0.011.1 ©2026</p>
</div>
      <form className='material-form'>
        <div className='form-group'>
          <input type='email' className={`form-control ${isInputActive ? 'active' : ''}`} onBlur={handleInputBlur} />
          <label id="#login-btn">UserID</label>
          <span className='input-border'></span>
        </div>
        <div className='form-group'>
          <input type='password' className={`form-control ${isInputActive ? 'active' : ''}`} onBlur={handleInputBlur} />
          <label id="#login-btn">Token</label>
          <span className='input-border'></span>
        </div>
<Link to="/dashboard"> 

        <button id="login-btn" type='submit' className='btn-login btn-primary btn-lg login-btn'>Login</button>
        </Link>
        <p id="#login-btn" className='helper-text'>Don't have an account? <a  href='#'>Contact Support</a> here.</p>
      </form>
    </div>
    </div>
    
  );
}

export default Login;
