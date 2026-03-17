/**
 * Central Hub Service - The Master Brain
 * 
 * Automatically indexes all intelligence and creates cross-references
 * between documents, databases, and agents.
 */

import IntelData from '../TestDataPoint/Intel';
import ArrestData from '../TestDataPoint/ArrestData';
import PrisonData from '../TestDataPoint/PrisonData';
import ImageData from '../TestDataPoint/ImageData';

class CentralHubService {
  constructor() {
    this.storageKey = 'central_hub_index';
    this.isInitialized = false;
  }

  /**
   * Scans existing documents and builds the initial index if needed.
   */
  initialize() {
    if (this.isInitialized) return;
    console.log("[Hub] Initializing Intelligence Sync...");
    
    try {
      const savedDocs = JSON.parse(localStorage.getItem('case_documents') || '[]');
      if (savedDocs.length > 0) {
        savedDocs.forEach(doc => this.registerIntelligence('DOCUMENT_ANALYSIS', doc, true));
      }
    } catch (e) {
      console.warn("[Hub] Sync failed:", e);
    }
    
    this.isInitialized = true;
  }

  /**
   * Automatically integrates a new piece of intelligence.
   * @param {boolean} skipSave - If true, don't write to localStorage yet (used during batch sync)
   */
  async registerIntelligence(sourceType, data, skipSave = false) {
    const index = this.getIndex();
    const timestamp = data.uploadDate || new Date().toISOString();

    if (sourceType === 'DOCUMENT_ANALYSIS') {
      const entities = data.analysis?.entities || {};
      let people = entities.people || [];
      const places = entities.places || [];
      
      // Index Locations
      places.forEach(place => {
        if (!place || place.length < 3) return;
        const pKey = place.toLowerCase().trim();
        if (!index.locations[pKey]) index.locations[pKey] = { mentions: [] };
        index.locations[pKey].mentions.push({
          source: data.name,
          date: timestamp,
          type: 'Document Mention'
        });
      });

      // IMPROVED EXTRACTION: Handle space-separated names in a single string
      if (typeof people === 'string') {
        if (!people.includes(',') && !people.includes(';')) {
          const words = people.split(/\s+/);
          const names = [];
          for (let i = 0; i < words.length; i++) {
            if (words[i].length > 2 && /^[A-Z]/.test(words[i])) {
              if (i + 1 < words.length && /^[A-Z]/.test(words[i+1])) {
                names.push(`${words[i]} ${words[i+1]}`);
                i++;
              } else {
                names.push(words[i]);
              }
            }
          }
          people = names;
        } else {
          people = people.split(/[,;]/).map(p => p.trim());
        }
      }

      people.forEach(person => {
        if (!person || person.length < 3) return;
        const key = person.toLowerCase().trim();
        
        if (!index.people[key]) index.people[key] = { mentions: [], connections: [] };
        
        const alreadyMentioned = index.people[key].mentions.some(m => m.source === data.name);
        if (!alreadyMentioned) {
          index.people[key].mentions.push({
            source: data.name,
            date: timestamp,
            summary: data.analysis?.summary?.description || 'Mentioned in intelligence report',
            isSuspect: (person.toLowerCase().includes('suspect') || (data.analysis?.summary?.description || '').toLowerCase().includes('suspect'))
          });
        }
      });
    }

    if (!skipSave) this.saveIndex(index);
    return true;
  }

  getIndex() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : { people: {}, plates: {}, locations: {} };
    } catch {
      return { people: {}, plates: {}, locations: {} };
    }
  }

  saveIndex(index) {
    localStorage.setItem(this.storageKey, JSON.stringify(index));
  }

  /**
   * Returns everything the system knows about a subject.
   */
  getConnectedProfile(query) {
    if (!this.isInitialized) this.initialize();
    
    const q = (query || '').toLowerCase().trim();
    const index = this.getIndex();
    
    let hubMentions = [];
    let containsSuspectFlag = false;
    
    // AGGRESSIVE FUZZY MATCHING
    Object.keys(index.people).forEach(key => {
      if (key.includes(q) || q.includes(key)) {
        const mentions = index.people[key].mentions;
        hubMentions = [...hubMentions, ...mentions];
        if (mentions.some(m => m.isSuspect)) containsSuspectFlag = true;
      }
    });

    // Deduplicate mentions by source
    const uniqueMentions = [];
    const seenSources = new Set();
    hubMentions.forEach(m => {
      if (!seenSources.has(m.source)) {
        uniqueMentions.push(m);
        seenSources.add(m.source);
      }
    });

    const investigations = IntelData.allInvestigations.filter(i => 
      (i.suspects || []).some(s => s.toLowerCase().includes(q)) ||
      (i.victims || []).some(v => v.toLowerCase().includes(q)) ||
      (i.desc && i.desc.toLowerCase().includes(q))
    );

    const arrests = ArrestData.arrest_data.filter(a => 
      (a.perp_name && a.perp_name.toLowerCase().includes(q)) ||
      (a.details && a.details.toLowerCase().includes(q))
    );

    const prison = PrisonData.prisons_data.find(p => 
      p.name && p.name.toLowerCase().includes(q)
    );

    return {
      hubMentions: uniqueMentions,
      investigations,
      arrests,
      prison,
      isSuspect: containsSuspectFlag || arrests.length > 0 || prison || investigations.some(i => (i.suspects || []).some(s => s.toLowerCase().includes(q))),
      isHighInterest: uniqueMentions.length > 0 || arrests.length > 0 || prison || investigations.length > 0
    };
  }

  /**
   * Returns a summary of geographic hotspots for the AI and Map.
   */
  getGeographicIntelligence() {
    if (!this.isInitialized) this.initialize();
    
    const index = this.getIndex();
    const hotspots = {};

    // 1. Process Investigations & Arrests (Static DBs)
    [...IntelData.allInvestigations, ...ArrestData.arrest_data].forEach(item => {
      if (item.location) {
        const loc = item.location.split(',')[0].trim();
        if (!hotspots[loc]) hotspots[loc] = { count: 0, incidents: [], sources: new Set() };
        hotspots[loc].count++;
        hotspots[loc].incidents.push({
          type: item.intelType || 'Arrest',
          desc: item.desc || item.details || 'No additional details provided.',
          status: item.status || 'Active'
        });
        hotspots[loc].sources.add('Internal Database');
      }
    });

    // 2. Process Indexed Documents (Hub Memory)
    Object.keys(index.locations).forEach(locKey => {
      const loc = locKey.charAt(0).toUpperCase() + locKey.slice(1);
      if (!hotspots[loc]) hotspots[loc] = { count: 0, incidents: [], sources: new Set() };
      
      index.locations[locKey].mentions.forEach(m => {
        hotspots[loc].count++;
        hotspots[loc].incidents.push({
          type: 'Document Mention',
          desc: `Reference found in: ${m.source}`,
          status: 'Analyzed'
        });
        hotspots[loc].sources.add('Intelligence Reports');
      });
    });

    // Convert Sets to Arrays for JSON serialization
    Object.keys(hotspots).forEach(k => {
      hotspots[k].sources = Array.from(hotspots[k].sources);
    });

    return hotspots;
  }
}

export const Hub = new CentralHubService();
