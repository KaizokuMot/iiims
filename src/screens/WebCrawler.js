import React, { useState, useEffect } from 'react';
import axios from 'axios';
import "./WebCrawler.css";

function WebCrawler() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // List of Ugandan news sources to scrape
    const newsSources = [
        'https://www.monitor.co.ug/',
        'https://www.newvision.co.ug/',
        'https://www.independent.co.ug/',
        'https://www.upf.go.ug/', // Uganda Police Force website
        // Add more sources as needed
    ];

    const fetchCrimeData = async () => {
        setLoading(true);
        setError(null);
        const crimeData = [];

        try {
            const response = await axios.post('http://localhost:3001/api/scrape', {
                sources: newsSources,
                keywords: [
                    'crime',
                    'criminal',
                    'theft',
                    'robbery',
                    'murder',
                    'assault',
                    'police',
                    'arrest',
                    'Uganda',
                    searchTerm
                ].filter(Boolean)
            });

            setResults(response.data);
        } catch (error) {
            setError('Failed to fetch crime data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchCrimeData();
    };

    return (
        <div className='web-crawler'>
            <h2>Uganda Crime Data Aggregator</h2>
            
            <div className="search-section">
                <form onSubmit={handleSearch}>
                    <input 
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Enter specific crime type or location..."
                        className="search-input"
                    />
                    <button type="submit" className="search-button">
                        Search Crime Data
                    </button>
                </form>
            </div>

            {loading && (
                <div className="loading">
                    Scanning news sources for crime data...
                </div>
            )}

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <div className="results-container">
                {results.map((result, index) => (
                    <div key={index} className="crime-card">
                        <h3>{result.title}</h3>
                        <div className="crime-details">
                            <p><strong>Source:</strong> {result.source}</p>
                            <p><strong>Date:</strong> {result.date}</p>
                            <p><strong>Location:</strong> {result.location}</p>
                            <p>{result.summary}</p>
                        </div>
                        <div className="crime-metadata">
                            <span className="crime-type">{result.crimeType}</span>
                            <a href={result.url} target="_blank" rel="noopener noreferrer">
                                Read More
                            </a>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default WebCrawler
