import React, { useState, useEffect } from 'react';
import './BackgroundCheck.css';
import { searchPeople } from '../services/peopleSearchService';
import { AnalystAgent } from '../agents/AnalystAgent';

const analyst = new AnalystAgent();

const BackgroundCheck = () => {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('name'); // 'name', 'phone', 'plate'
  const [location, setLocation] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [subjectInsight, setSubjectInsight] = useState(null);

  // Mock data for vehicle plates since it's not in the main DB yet
  const mockPlateData = [
    { plate: 'UAX 123A', type: 'Car', owner: 'Dixon', make: 'Toyota', model: 'Camry', color: 'Silver', status: 'Active', location: 'Kampala' },
    { plate: 'UBB 456G', type: 'Bike', owner: 'Eugene', make: 'Bajaj', model: 'Boxer', color: 'Red', status: 'Stolen', location: 'Entebbe' },
    { plate: 'UCC 789M', type: 'Boat', owner: 'Eric', make: 'Yamaha', model: 'Speedboat', color: 'White', status: 'Active', location: 'Lake Victoria' },
    { plate: 'UDD 012K', type: 'Car', owner: 'Paul', make: 'Mercedes', model: 'C200', color: 'Black', status: 'Expired', location: 'Jinji' },
    { plate: 'UEE 345L', type: 'Car', owner: 'Devon', make: 'Honda', model: 'Civic', color: 'Blue', status: 'Active', location: 'Mbarara' },
  ];
useEffect(() => {
  // Initialize the Master Brain index from existing documents
  import('../services/CentralHubService').then(({ Hub }) => {
    Hub.initialize();
  });

  const history = localStorage.getItem('background_check_history');

    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  }, []);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setSubjectInsight(null);
    let finalResults = [];

    // Trigger Agent Analysis in parallel
    const insightPromise = analyst.getSubjectInsight(query, type);

    if (type === 'name' || type === 'phone') {
      const peopleResults = await searchPeople(query);
      finalResults = peopleResults.map(person => ({
        type: 'Person',
        name: person.name,
        imageUrl: person.imageUrl,
        details: person.info,
        sources: person.sources,
        documentRefs: person.documentRefs,
        location: person.info?.location || person.info?.intel?.[0]?.location || 'Unknown'
      }));
    } else if (type === 'plate') {
      const q = query.toUpperCase().replace(/\s+/g, '');
      finalResults = mockPlateData.filter(item => 
        item.plate.replace(/\s+/g, '').includes(q)
      ).map(item => ({
        type: item.type,
        name: `${item.make} ${item.model} (${item.plate})`,
        imageUrl: null,
        details: item,
        sources: ['Plate Database'],
        location: item.location
      }));
    }

    // Filter by location if provided
    if (location.trim()) {
      const locQ = location.toLowerCase();
      finalResults = finalResults.filter(r => 
        (r.location && r.location.toLowerCase().includes(locQ)) ||
        (r.details?.location && r.details.location.toLowerCase().includes(locQ))
      );
    }

    const insight = await insightPromise;
    setSubjectInsight(insight);
    setResults(finalResults);
    setIsSearching(false);

    // Save to history
    const newEntry = { query, type, date: new Date().toISOString() };
    const updatedHistory = [newEntry, ...searchHistory.slice(0, 9)];
    setSearchHistory(updatedHistory);
    localStorage.setItem('background_check_history', JSON.stringify(updatedHistory));
  };

  const renderAgentInsight = () => {
    if (!subjectInsight || results.length === 0) return null;

    return (
      <div className={`agent-insight-box threat-${subjectInsight.threatLevel.toLowerCase()}`}>
        <div className="insight-header">
          <div className="agent-tag">
            <i className="fas fa-robot"></i>
            <span>{subjectInsight.agentName} Assessment</span>
          </div>
          <div className={`threat-badge level-${subjectInsight.threatLevel.toLowerCase()}`}>
            Threat Level: {subjectInsight.threatLevel}
          </div>
        </div>
        <div className="insight-content">
          <ul className="insight-findings">
            {subjectInsight.findings.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
          <div className="agent-recommendation">
            <strong>Command Recommendation:</strong> {subjectInsight.recommendation}
          </div>
        </div>
      </div>
    );
  };

  const renderResultModal = () => {
    if (!selectedResult) return null;

    const r = selectedResult;
    const isPerson = r.type === 'Person';

    return (
      <div className="modal-overlay-bg" onClick={() => setSelectedResult(null)}>
        <div className="modal-content-bg" onClick={e => e.stopPropagation()}>
          <div className="modal-header-bg">
            <div className="header-main-bg">
              <span className="badge-bg">{r.type}</span>
              <h2>{r.name}</h2>
            </div>
            <button className="close-modal-bg" onClick={() => setSelectedResult(null)}>&times;</button>
          </div>

          <div className="modal-body-bg">
            <div className="profile-top-bg">
              <div className="profile-image-container">
                {r.imageUrl ? (
                  <img src={r.imageUrl} alt={r.name} className="profile-img-bg" />
                ) : (
                  <div className="profile-img-placeholder-bg"><i className={`fas ${isPerson ? 'fa-user' : 'fa-car'}`}></i></div>
                )}
              </div>
              <div className="profile-info-bg">
                <p><i className="fas fa-map-marker-alt"></i> {r.location}</p>
                <div className="sources-list-bg">
                  {r.sources.map(s => <span key={s} className="source-tag-bg">{s}</span>)}
                </div>
              </div>
            </div>

            <div className="profile-details-scroll-bg">
              {isPerson ? (
                <div className="profile-details-bg">
                  <div className="details-grid-bg">
                    {r.details.phone && <div className="detail-item-bg"><strong>Phone:</strong> {r.details.phone}</div>}
                    {r.details.email && <div className="detail-item-bg"><strong>Email:</strong> {r.details.email}</div>}
                    {r.details.role && <div className="detail-item-bg"><strong>Occupation:</strong> {r.details.role}</div>}
                    {r.details.department && <div className="detail-item-bg"><strong>Department:</strong> {r.details.department}</div>}
                    {r.details.status && <div className="detail-item-bg"><strong>Status:</strong> {r.details.status}</div>}
                  </div>
                  
                  {r.details.intel && r.details.intel.length > 0 && (
                    <div className="intel-section-bg">
                      <h3><i className="fas fa-search-location"></i> Investigations & Intelligence</h3>
                      <div className="intel-list-bg">
                        {r.details.intel.map((inv, i) => (
                          <div key={i} className="intel-card-bg">
                            <div className="intel-card-header-bg">
                              <span className="type-bg">{inv.type}</span>
                              <span className={`status-bg status-${(inv.status || 'unknown').toLowerCase().replace(/\s+/g, '-')}`}>{inv.status || 'Active'}</span>
                            </div>
                            <p className="loc-bg"><i className="fas fa-map-marker-alt"></i> {inv.location}</p>
                            <p className="desc-bg">{inv.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.details.arrests && r.details.arrests.length > 0 && (
                    <div className="intel-section-bg">
                      <h3><i className="fas fa-handcuffs"></i> Arrest Records</h3>
                      <div className="intel-list-bg">
                        {r.details.arrests.map((arr, i) => (
                          <div key={i} className="intel-card-bg arrest-bg">
                            <div className="intel-card-header-bg">
                              <strong>Case: {arr.caseID}</strong>
                              <span className="status-bg">{arr.status}</span>
                            </div>
                            <p className="desc-bg">{arr.details}</p>
                            <p className="agency-bg">Agency: {arr.agency}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.details.prison && (
                    <div className="intel-section-bg">
                      <h3><i className="fas fa-dungeon"></i> Prison History</h3>
                      <div className="intel-card-bg prison-bg">
                        <p><strong>Crime:</strong> {r.details.prison.crime}</p>
                        <p><strong>Sentence:</strong> {r.details.prison.sentence}</p>
                        <p><strong>Facility:</strong> {r.details.prison.location}</p>
                        <p><strong>Entry Date:</strong> {r.details.prison.date_of_entry}</p>
                      </div>
                    </div>
                  )}

                  {r.documentRefs && r.documentRefs.length > 0 && (
                    <div className="intel-section-bg">
                      <h3><i className="fas fa-file-alt"></i> Mentioned in Documents</h3>
                      <div className="intel-list-bg">
                        {r.documentRefs.map((doc, i) => (
                          <div key={i} className="intel-card-bg doc-bg">
                            <p><strong>File:</strong> {doc.docName}</p>
                            <p className="excerpt-bg">"{doc.excerpt}..."</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="profile-details-bg">
                  <div className="details-grid-bg">
                    <div className="detail-item-bg"><strong>Owner:</strong> {r.details.owner}</div>
                    <div className="detail-item-bg"><strong>Make:</strong> {r.details.make}</div>
                    <div className="detail-item-bg"><strong>Model:</strong> {r.details.model}</div>
                    <div className="detail-item-bg"><strong>Color:</strong> {r.details.color}</div>
                    <div className="detail-item-bg"><strong>Status:</strong> {r.details.status}</div>
                    <div className="detail-item-bg"><strong>Last Known Location:</strong> {r.details.location}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="modal-footer-bg">
            <button className="action-btn-bg print-btn" onClick={() => window.print()}>
              <i className="fas fa-print"></i> Generate Intelligence Report
            </button>
            <button className="action-btn-bg close-btn" onClick={() => setSelectedResult(null)}>Close Profile</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="background-check-container">
      <div className="bg-header">
        <h1>Run Background Checks</h1>
        <p>Comprehensive search across investigations, arrests, prison records, and vehicle databases.</p>
      </div>

      <div className="search-section">
        <form onSubmit={handleSearch} className="search-form">
          <div className="input-group-bg">
            <select value={type} onChange={(e) => setType(e.target.value)} className="type-select">
              <option value="name">Name</option>
              <option value="phone">Phone Number</option>
              <option value="plate">Plate Number (Car/Bike/Boat)</option>
            </select>
            <input 
              type="text" 
              placeholder={`Enter ${type === 'plate' ? 'plate number' : type}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="query-input"
            />
            <input 
              type="text" 
              placeholder="Location (Optional)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="location-input"
            />
            <button type="submit" className="search-btn-bg">
              {isSearching ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-search"></i>}
              Search
            </button>
          </div>
        </form>

        <div className="quick-filters">
          <span>Quick Filters:</span>
          <button onClick={() => {setType('plate'); setQuery('UAX'); handleSearch();}}>Car Plates</button>
          <button onClick={() => {setType('plate'); setQuery('UBB'); handleSearch();}}>Bikes</button>
          <button onClick={() => {setType('plate'); setQuery('UCC'); handleSearch();}}>Boats</button>
        </div>
      </div>

      <div className="results-section">
        {isSearching ? (
          <div className="searching-placeholder">
            <div className="loader"></div>
            <p>Scanning intelligence databases...</p>
          </div>
        ) : (
          <>
            {renderAgentInsight()}
            {results.length > 0 ? (
              <div className="results-grid-bg">
                {results.map((result, idx) => (
                  <div key={idx} className="result-card-bg" onClick={() => setSelectedResult(result)}>
                    <div className="result-type-badge">{result.type}</div>
                    <div className="result-main">
                      {result.imageUrl ? (
                        <img src={result.imageUrl} alt={result.name} className="result-thumb" />
                      ) : (
                        <div className="result-thumb-placeholder">
                          <i className={`fas ${result.type === 'Person' ? 'fa-user' : 'fa-car'}`}></i>
                        </div>
                      )}
                      <div className="result-info">
                        <h3>{result.name}</h3>
                        <p className="result-loc"><i className="fas fa-map-marker-alt"></i> {result.location}</p>
                        <div className="result-sources">
                          {result.sources.map(s => <span key={s} className="source-tag">{s}</span>)}
                        </div>
                      </div>
                    </div>
                    <div className="result-details">
                      {result.type === 'Person' ? (
                        <div className="person-details-bg">
                          {result.details.phone && <p><strong>Phone:</strong> {result.details.phone}</p>}
                          <div className="stats-row-bg">
                            {result.details.intel && <span><i className="fas fa-folder"></i> {result.details.intel.length} Cases</span>}
                            {result.details.arrests && <span><i className="fas fa-handcuffs"></i> {result.details.arrests.length} Arrests</span>}
                            {result.details.prison && <span><i className="fas fa-dungeon"></i> Prison Rec</span>}
                          </div>
                        </div>
                      ) : (
                        <div className="plate-details-bg">
                          <p><strong>Owner:</strong> {result.details.owner}</p>
                          <p><strong>Vehicle:</strong> {result.details.make} {result.details.model}</p>
                        </div>
                      )}
                      <button className="view-profile-btn-bg">View Full Intelligence Profile</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : query && !isSearching ? (
              <div className="no-results-bg">
                <i className="fas fa-folder-open"></i>
                <p>No records found matching your criteria.</p>
              </div>
            ) : (
              <div className="history-section-bg">
                <h3>Recent Searches</h3>
                <div className="history-list">
                  {searchHistory.length > 0 ? searchHistory.map((h, i) => (
                    <div key={i} className="history-item" onClick={() => {setQuery(h.query); setType(h.type);}}>
                      <i className="fas fa-history"></i>
                      <span>{h.query} ({h.type})</span>
                      <small>{new Date(h.date).toLocaleDateString()}</small>
                    </div>
                  )) : <p>Your search history is empty.</p>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {renderResultModal()}
    </div>
  );
};

export default BackgroundCheck;
