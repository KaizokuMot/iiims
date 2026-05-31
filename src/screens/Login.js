import React, { useState } from 'react';
import './Login.css';
import Logo from "../media/logo_white.png";
import { Link } from 'react-router-dom';

function Login() {
  const [userId, setUserId] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  return (
    <div className='login-split-container'>

      {/* LEFT PANEL — grid + glow + triangle */}
      <div className='login-left'>
        {/* Grid lines background */}
        <div className='login-grid-bg' />

        {/* Colorful radial glow blobs */}
        <div className='login-glow login-glow-green' />
        <div className='login-glow login-glow-red' />
        <div className='login-glow login-glow-blue' />
        <div className='login-glow login-glow-yellow' />

        {/* Striped triangle */}
        <div className='login-triangle-wrap'>
          <svg className='login-triangle-svg' viewBox='0 0 200 220' xmlns='http://www.w3.org/2000/svg'>
            <defs>
              <clipPath id='tri-clip'>
                <polygon points='100,10 10,210 190,210' />
              </clipPath>
            </defs>
            {Array.from({ length: 60 }, (_, i) => (
              <line
                key={i}
                x1='0'
                y1={10 + i * 3.4}
                x2='200'
                y2={10 + i * 3.4}
                stroke='rgba(255,255,255,0.55)'
                strokeWidth='0.8'
                clipPath='url(#tri-clip)'
              />
            ))}
          </svg>
        </div>

        {/* Text content */}
        <div className='login-left-content'>
          <span className='left-eyebrow'>INTEGRATED INTELLIGENCE MANAGEMENT</span>
          <h1 className='left-headline'>
            Clarity,<br />Precision,<br />Action.
          </h1>
        </div>
      </div>

      {/* RIGHT PANEL — login form */}
      <div className='login-right'>
        <div className='login-right-top'>
          <span className='login-right-top-text'>Need access? <a href='#'>Contact Admin →</a></span>
        </div>

        <div className='login-form-container'>
  

          <div className='login-title-block'>
            <h2 className='login-app-name'>IIIMS<sup>®</sup></h2>
            {/* <h1 className='login-heading'>Log In</h1> */}
          </div>

          <form className='login-form' onSubmit={e => e.preventDefault()}>
            <div className='login-field'>
              <label className='login-label'>USER ID</label>
              <div className='login-input-wrap'>
                <input
                  type='text'
                  className='login-input'
                  placeholder='e.g. yourID'
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                />
                <span className='login-input-icon'>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </span>
              </div>
            </div>

            <div className='login-field'>
              <label className='login-label'>ACCESS TOKEN</label>
              <div className='login-input-wrap'>
                <input
                  type={showToken ? 'text' : 'password'}
                  className='login-input'
                  placeholder='Min 8 characters'
                  value={token}
                  onChange={e => setToken(e.target.value)}
                />
                <span className='login-input-icon clickable' onClick={() => setShowToken(!showToken)}>
                  {showToken ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </span>
              </div>
            </div>

            <div className='login-actions'>
              <a href='#' className='forgot-link'>Forgot Credentials?</a>
              <Link to="/dashboard">
                <button type='submit' className='login-submit-btn'>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </button>
              </Link>
            </div>
          </form>
        </div>

        <div className='login-right-footer'>
          <span>© 2026 <strong>IIIMS</strong> 12.4.0</span>
        </div>
      </div>

    </div>
  );
}

export default Login;
