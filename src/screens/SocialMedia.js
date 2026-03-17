import axios from 'axios';
import React, { useState, useEffect } from 'react';
import './SocialMedia.css';

const SocialMediaSearch = () => {
    const [results, setResults] = useState([]);
    const [keywords, setKeywords] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Add pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [resultsPerPage] = useState(7);

    const fetchData = async (searchTerm) => {
        setLoading(true);
        setError(null);

        try {
            // --- GOOGLE CUSTOM SEARCH API ONLY (ACTIVE) ---
            // You must provide your own API key and cx (Search Engine ID) below:
            const googleApiKey = 'AIzaSyBVOJwKUcjQO1PazflW-b3TWlHf6X-MfKk'; // TODO: Replace with your key
            const googleCx = '3352f280d98334432'; // <-- Your Search Engine ID
            const googlePromise = axios.get('https://www.googleapis.com/customsearch/v1', {
                params: {
                    key: googleApiKey,
                    cx: googleCx,
                    q: searchTerm,
                    num: 10
                }
            });

            // Only Google Custom Search API is active
            const [googleRes] = await Promise.allSettled([
                googlePromise
            ]);

            let googleResults = [];
            if (googleRes.status === 'fulfilled' && googleRes.value.data.items) {
                googleResults = googleRes.value.data.items.map(item => ({
                    id: `google-${encodeURIComponent(item.link)}`,
                    title: item.title,
                    content: item.snippet || '',
                    url: item.link,
                    source: 'Google',
                    timestamp: ''
                }));
            }

            if (googleResults.length === 0) {
                setError('No results found or failed to fetch data.');
            }

            setResults(googleResults);

        } catch (error) {
            setError('Failed to fetch data. Please try again later.');
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (keywords.trim()) {
            fetchData(keywords);
        }
    }, [keywords]);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchData(keywords);
    };

    // Calculate pagination
    const indexOfLastResult = currentPage * resultsPerPage;
    const indexOfFirstResult = indexOfLastResult - resultsPerPage;
    const currentResults = results.slice(indexOfFirstResult, indexOfLastResult);
    const totalPages = Math.ceil(results.length / resultsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    // Update resultCounts to only show Google
    const resultCounts = {
        google: results.filter(r => r.source === 'Google').length,
        total: results.length
    };

    return (
        <div className="social-media-container">
            <div className="search-header">
                <h1 >Open Source Intelligence Network (OSINTN)</h1>
                <form onSubmit={handleSearch} className="search-form">
                    <input
                        type="text"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder="Enter search keywords..."
                        className="search-input"
                    />
                    <button type="submit" className="search-button">
                        Search
                    </button>
                </form>
            </div>

            {/* Results summary: Only Google */}
            {results.length > 0 && (
                <div className="results-summary">
                    <h2 className='gray-heading'>Search Results ({resultCounts.total} total)</h2>
                    <div className="source-counts">
                        <span className="count-badge google">Google: {resultCounts.google}</span>
                    </div>
                </div>
            )}

            {loading && (
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Fetching results...</p>
                </div>
            )}

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <div className="results-container">
                {currentResults.map(result => (
                    <div key={result.id} className="result-card">
                        <div className="result-header">
                            <span className={`source-badge ${result.source.toLowerCase()}`}>
                                {result.source}
                            </span>
                            <span className="timestamp">{result.timestamp}</span>
                        </div>
                        <h3 className="result-title">
                            <a href={result.url} target="_blank" rel="noopener noreferrer">
                                {result.title.length > 100 ? result.title.substring(0, 100) + '...' : result.title}
                            </a>
                        </h3>
                        <p className="result-content">
                            {result.content && result.content.length > 150 
                                ? result.content.substring(0, 150) + '...' 
                                : result.content}
                        </p>
                        <div className="result-footer">
                            <a
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="read-more"
                            >
                                Read More →
                            </a>
                        </div>
                    </div>
                ))}
            </div>

            {results.length > 0 && (
                <div className="pagination">
                    <button 
                        onClick={() => paginate(currentPage - 1)} 
                        disabled={currentPage === 1}
                        className="page-button"
                    >
                        Previous
                    </button>
                    <span className="page-info">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button 
                        onClick={() => paginate(currentPage + 1)} 
                        disabled={currentPage === totalPages}
                        className="page-button"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};

export default SocialMediaSearch;
