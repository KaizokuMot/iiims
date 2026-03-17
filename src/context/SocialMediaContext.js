import React, { createContext, useState, useContext } from 'react';
import axios from 'axios';

// Create the context
const SocialMediaContext = createContext();

// Create a provider component
export const SocialMediaProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [socialMediaProfiles, setSocialMediaProfiles] = useState({});

  // Function to lookup social media profiles
  const lookupSocialMedia = async (name, options = {}) => {
    if (!name) {
      setError('Name is required for social media lookup');
      return {};
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`Looking up social media profiles for: ${name}`);
      
      // Call the API endpoint
      const response = await axios.post('https://lookmeup-qfwf.onrender.com/api/search', {
        name,
        ...options
      });

      // If the API call is successful, update the state
      if (response.data) {
        console.log('Social media profiles found:', response.data);
        setSocialMediaProfiles(response.data);
        return response.data;
      } else {
        console.log('No social media profiles found');
        setSocialMediaProfiles({});
        return {};
      }
    } catch (error) {
      console.error('Error looking up social media profiles:', error);
      setError('Failed to lookup social media profiles');
      
      // Fallback to mock data for testing
      const mockProfiles = {
        facebook: `https://facebook.com/search/people/?q=${encodeURIComponent(name)}`,
        instagram: `https://instagram.com/${name.toLowerCase().replace(/\s+/g, '')}`,
        twitter: `https://twitter.com/search?q=${encodeURIComponent(name)}&src=typed_query`,
        linkedin: `https://linkedin.com/pub/dir/?firstName=${encodeURIComponent(name.split(' ')[0])}&lastName=${encodeURIComponent(name.split(' ').slice(1).join(' '))}`
      };
      
      setSocialMediaProfiles(mockProfiles);
      return mockProfiles;
    } finally {
      setLoading(false);
    }
  };

  // Create the context value
  const contextValue = {
    loading,
    error,
    socialMediaProfiles,
    lookupSocialMedia
  };

  return (
    <SocialMediaContext.Provider value={contextValue}>
      {children}
    </SocialMediaContext.Provider>
  );
};

// Create a custom hook to use the context
export const useSocialMedia = () => {
  const context = useContext(SocialMediaContext);
  if (!context) {
    throw new Error('useSocialMedia must be used within a SocialMediaProvider');
  }
  return context;
};

export default SocialMediaContext;
