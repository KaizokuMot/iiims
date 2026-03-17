import React from 'react';
import './PersonSearchResults.css';

/**
 * Renders people search results as cards with images and information.
 */
function PersonSearchResults({ query, results }) {
  const isPhone = /\d{4}/.test(query || '');

  if (!results || results.length === 0) {
    return (
      <div className="person-search-results">
        <h3 className="person-search-title">No matches found for {isPhone ? `phone ${query}` : `"${query}"`}</h3>
        <p className="person-search-hint">
          {isPhone ? 'No phone number found in facial recognition labels, documents, or data entry.' : 'Try a different spelling or check if the person exists in investigations, documents, or image database.'}
        </p>
      </div>
    );
  }

  return (
    <div className="person-search-results">
      <h3 className="person-search-title">
        {results.length} {results.length === 1 ? 'match' : 'matches'} for {isPhone ? `phone ${query}` : `"${query}"`}
      </h3>
      <p className="person-search-hint">
        {isPhone ? 'Results from our knowledge base:' : 'People close to this name in our knowledge base:'}
      </p>
      <div className="person-cards-grid">
        {results.map((person, idx) => (
          <PersonCard key={`${person.name}-${idx}`} person={person} />
        ))}
      </div>
    </div>
  );
}

function PersonCard({ person }) {
  const { name, imageUrl, sources, info, documentRefs } = person;
  const roles = info.roles || [];
  const intel = info.intel || [];
  const arrests = info.arrests || [];
  const prison = info.prison;
  const profile = info; // from facial rec labels (role, department, email, etc.)

  return (
    <div className="person-card">
      <div className="person-card-header">
        <div className="person-card-image-wrap">
          {imageUrl && (
            <img src={imageUrl} alt={name} className="person-card-image" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling?.classList?.add('show'); }} />
          )}
          <div className={`person-card-image-placeholder ${!imageUrl ? 'show' : ''}`}>No image</div>
        </div>
        <div className="person-card-title">
          <h4>{name}</h4>
          {roles.length > 0 && (
            <div className="person-card-roles">
              {roles.map((r, i) => <span key={i} className="person-badge">{r}</span>)}
            </div>
          )}
        </div>
      </div>
      <div className="person-card-body">
        {sources.length > 0 && (
          <div className="person-sources">
            <strong>Sources:</strong> {sources.join(', ')}
          </div>
        )}
        {profile.role && !roles.includes(profile.role) && <p><strong>Role:</strong> {profile.role}</p>}
        {profile.department && <p><strong>Department:</strong> {profile.department}</p>}
        {profile.email && <p><strong>Email:</strong> {profile.email}</p>}
        {profile.phone && <p><strong>Phone:</strong> {profile.phone}</p>}
        {profile.status && <p><strong>Status:</strong> {profile.status}</p>}
        {profile.age && <p><strong>Age:</strong> {profile.age}</p>}
        {intel.length > 0 && (
          <div className="person-intel">
            <strong>Investigations:</strong>
            <ul>
              {intel.slice(0, 3).map((i, j) => (
                <li key={j}>{i.type} — {i.location || 'N/A'} ({i.status || 'N/A'})</li>
              ))}
            </ul>
          </div>
        )}
        {arrests.length > 0 && (
          <div className="person-arrests">
            <strong>Arrest records:</strong>
            <ul>
              {arrests.slice(0, 3).map((a, j) => (
                <li key={j}>{a.details} — {a.location || 'N/A'} ({a.status || 'N/A'})</li>
              ))}
            </ul>
          </div>
        )}
        {prison && (
          <div className="person-prison">
            <strong>Prison:</strong> {prison.crime} — {prison.sentence} at {prison.location}
          </div>
        )}
        {documentRefs.length > 0 && (
          <div className="person-docs">
            <strong>Mentioned in documents:</strong>
            <ul>
              {documentRefs.slice(0, 3).map((d, j) => (
                <li key={j} title={d.excerpt}>{d.docName}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="person-search-links">
          <a href={`https://www.google.com/search?q=${encodeURIComponent(name)}`} target="_blank" rel="noopener noreferrer" className="person-search-link">Google</a>
          <a href={`https://facebook.com/search/people/?q=${encodeURIComponent(name)}`} target="_blank" rel="noopener noreferrer" className="person-search-link">Facebook</a>
          <a href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name)}`} target="_blank" rel="noopener noreferrer" className="person-search-link">LinkedIn</a>
        </div>
      </div>
    </div>
  );
}

export default PersonSearchResults;
