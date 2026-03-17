/**
 * People search service - finds people across investigations, documents, images, and data points.
 * Supports fuzzy name matching and returns results with images and information.
 */

import IntelData from '../TestDataPoint/Intel';
import ArrestData from '../TestDataPoint/ArrestData';
import PrisonData from '../TestDataPoint/PrisonData';
import ImageData from '../TestDataPoint/ImageData';
import { Hub } from './CentralHubService';

const LABEL_IDS = ['dixon', 'eugene', 'eric', 'paul', 'devon', 'president'];
const PUBLIC_URL = process.env.PUBLIC_URL || '';

/**
 * Normalize name for comparison (lowercase, collapse spaces).
 */
function normalizeName(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Check if a name matches the query (fuzzy).
 * Matches: exact, contains, word overlap, or first/last name match.
 */
function nameMatches(query, name) {
  if (!name || !query) return false;
  const q = normalizeName(query);
  const n = normalizeName(name);
  if (q === n) return true;
  if (n.includes(q)) return true;
  if (q.includes(n)) return true;
  const qWords = q.split(/\s+/).filter(Boolean);
  const nWords = n.split(/\s+/).filter(Boolean);
  const overlap = qWords.filter(w => nWords.some(nw => nw.includes(w) || w.includes(nw)));
  if (overlap.length >= Math.min(qWords.length, 1)) return true;
  return false;
}

/**
 * Normalize phone for comparison - digits only.
 */
function normalizePhone(s) {
  return (s || '').replace(/\D/g, '');
}

/**
 * Check if a phone number matches the query (partial match for international).
 */
function phoneMatches(query, phone) {
  if (!phone || !query) return false;
  const qDigits = normalizePhone(query);
  const pDigits = normalizePhone(phone);
  if (qDigits.length < 4) return false;
  return pDigits.includes(qDigits) || qDigits.includes(pDigits);
}

/**
 * Check if query looks like a phone number (4+ digits).
 */
function isPhoneQuery(query) {
  const digits = normalizePhone(query);
  return digits.length >= 4;
}

/**
 * Load label (facial rec) info and image URL.
 */
async function loadLabelPerson(labelId) {
  try {
    const infoRes = await fetch(`${PUBLIC_URL}/labels/${labelId}/info.json`);
    if (!infoRes.ok) return null;
    const info = await infoRes.json();
    const name = info.name || labelId;
    const imgPath = `${PUBLIC_URL}/labels/${labelId}/1.jpg`;
    return {
      name,
      imageUrl: imgPath,
      source: 'facial_recognition',
      info: { ...info, labelId }
    };
  } catch {
    return null;
  }
}

/**
 * Search all data sources for people matching the query.
 * @param {string} query - Name or partial name to search
 * @returns {Promise<Array>} Array of { name, imageUrl?, role, sources, info, documentRefs }
 */
export async function searchPeople(query) {
  if (!query) return [];
  const q = query.trim();
  if (q.length < 2 && !isPhoneQuery(q)) return [];
  if (isPhoneQuery(q) && normalizePhone(q).length < 4) return [];

  const results = new Map(); // name -> result (dedupe)

  // --- 1. ImageData (has images) ---
  ImageData.imageData.forEach((img) => {
    const names = [img.name, ...(img.labels || [])].filter(Boolean);
    for (const n of names) {
      if (nameMatches(query, n)) {
        const key = normalizeName(n);
        if (!results.has(key)) {
          results.set(key, {
            name: img.name || n,
            imageUrl: img.imageUrl,
            sources: [],
            info: {},
            documentRefs: []
          });
        }
        const r = results.get(key);
        if (!r.sources.includes('ImageData')) r.sources.push('ImageData');
      }
    }
  });

  // --- 2. Facial recognition labels (name + phone) ---
  const labelPeople = await Promise.all(LABEL_IDS.map(loadLabelPerson));
  labelPeople.filter(Boolean).forEach((p) => {
    const matchByName = nameMatches(query, p.name);
    const matchByPhone = p.info?.phone && phoneMatches(query, p.info.phone);
    if (matchByName || matchByPhone) {
      const key = normalizeName(p.name);
      if (!results.has(key)) {
        results.set(key, {
          name: p.name,
          imageUrl: p.imageUrl,
          sources: [],
          info: p.info || {},
          documentRefs: []
        });
      }
      const r = results.get(key);
      if (!r.sources.includes('Facial Recognition')) r.sources.push('Facial Recognition');
      Object.assign(r.info, p.info);
      if (p.imageUrl && !r.imageUrl) r.imageUrl = p.imageUrl;
    }
  });

  // --- 3. Intel investigations (suspects, victims, officers, postedBy) ---
  const intel = IntelData.allInvestigations || [];
  intel.forEach((inv) => {
    const people = [
      ...(inv.suspects || []).map((s) => ({ name: s, role: 'Suspect' })),
      ...(inv.victims || []).map((v) => ({ name: v, role: 'Victim' })),
      ...(inv.officersOnScene || []).map((o) => ({ name: o, role: 'Officer' })),
      ...(inv.postedBy ? [{ name: inv.postedBy, role: 'Posted By' }] : [])
    ];
    people.forEach(({ name, role }) => {
      if (nameMatches(query, name)) {
        const key = normalizeName(name);
        if (!results.has(key)) {
          results.set(key, {
            name,
            imageUrl: null,
            sources: [],
            info: {},
            documentRefs: []
          });
        }
        const r = results.get(key);
        if (!r.sources.includes('Investigations')) r.sources.push('Investigations');
        if (!r.info.intel) r.info.intel = [];
        r.info.intel.push({
          type: inv.intelType,
          location: inv.location,
          status: inv.status,
          desc: inv.desc
        });
        if (role && !r.info.roles) r.info.roles = [];
        if (role && r.info.roles && !r.info.roles.includes(role)) r.info.roles.push(role);
      }
    });
  });

  // --- 4. Arrest data ---
  const arrests = ArrestData.arrest_data || [];
  arrests.forEach((a) => {
    const people = [
      ...(a.perp_name ? [{ name: a.perp_name, role: 'Perpetrator' }] : []),
      ...(a.suspects || []).map((s) => ({ name: s, role: 'Suspect' }))
    ];
    people.forEach(({ name, role }) => {
      if (nameMatches(query, name)) {
        const key = normalizeName(name);
        if (!results.has(key)) {
          results.set(key, {
            name,
            imageUrl: null,
            sources: [],
            info: {},
            documentRefs: []
          });
        }
        const r = results.get(key);
        if (!r.sources.includes('Arrests')) r.sources.push('Arrests');
        if (!r.info.arrests) r.info.arrests = [];
        r.info.arrests.push({
          caseID: a.caseID,
          details: a.details,
          location: a.location,
          status: a.status,
          agency: a.agency
        });
        if (role && !r.info.roles) r.info.roles = [];
        if (role && r.info.roles && !r.info.roles.includes(role)) r.info.roles.push(role);
      }
    });
  });

  // --- 5. Prison data ---
  const prisons = PrisonData.prisons_data || [];
  prisons.forEach((p) => {
    if (p.name && nameMatches(query, p.name)) {
      const key = normalizeName(p.name);
      if (!results.has(key)) {
        results.set(key, {
          name: p.name,
          imageUrl: null,
          sources: [],
          info: {},
          documentRefs: []
        });
      }
      const r = results.get(key);
      if (!r.sources.includes('Prison')) r.sources.push('Prison');
      r.info.prison = {
        crime: p.crime,
        sentence: p.sentence,
        location: p.location,
        date_of_entry: p.date_of_entry
      };
    }
  });

  // --- 6. localStorage investigations (name + phone) ---
  try {
    const stored = localStorage.getItem('investigations');
    if (stored) {
      const invs = JSON.parse(stored);
      (invs || []).forEach((inv) => {
        const invPhone = inv.phone || inv.mobile || inv.phoneNumber;
        if (isPhoneQuery(query) && invPhone && phoneMatches(query, invPhone)) {
          const name = inv.suspects?.[0] || inv.victims?.[0] || inv.postedBy || 'Unknown';
          const key = `inv-phone:${inv.id || Math.random()}`;
          if (!results.has(key)) {
            results.set(key, {
              name: inv.desc ? `${name} (Data Entry)` : name,
              imageUrl: null,
              sources: [],
              info: { phone: invPhone, intel: [{ type: inv.intelType, location: inv.location, status: inv.status, desc: inv.desc }] },
              documentRefs: []
            });
          }
          const r = results.get(key);
          if (!r.sources.includes('Data Entry')) r.sources.push('Data Entry');
        }
        [...(inv.suspects || []), ...(inv.victims || [])].forEach((name) => {
          if (nameMatches(query, name)) {
            const key = normalizeName(name);
            if (!results.has(key)) {
              results.set(key, {
                name,
                imageUrl: null,
                sources: [],
                info: {},
                documentRefs: []
              });
            }
            const r = results.get(key);
            if (!r.sources.includes('Data Entry')) r.sources.push('Data Entry');
            if (!r.info.intel) r.info.intel = [];
            r.info.intel.push({
              type: inv.intelType,
              location: inv.location,
              status: inv.status,
              desc: inv.desc
            });
          }
        });
      });
    }
  } catch {}

  // --- 7. Uploaded documents (case_documents) - people + phones ---
  try {
    // Master index cross-reference
    const hubProfile = Hub.getConnectedProfile(query);
    if (hubProfile.hubMentions.length > 0) {
      const key = `hub:${normalizeName(query)}`;
      if (!results.has(key)) {
        results.set(key, {
          name: query,
          imageUrl: null,
          sources: ['Central Hub Index'],
          info: { 
            intel: hubProfile.investigations.map(i => ({ type: i.intelType, location: i.location, status: i.status, desc: i.desc })),
            arrests: hubProfile.arrests,
            prison: hubProfile.prison
          },
          documentRefs: hubProfile.hubMentions.map(m => ({ docName: m.source, excerpt: m.summary }))
        });
      } else {
        // Enrich existing result with hub document refs
        const existing = results.get(key);
        hubProfile.hubMentions.forEach(m => {
          if (!existing.documentRefs.some(dr => dr.docName === m.source)) {
            existing.documentRefs.push({ docName: m.source, excerpt: m.summary });
          }
        });
        if (!existing.sources.includes('Central Hub Index')) existing.sources.push('Central Hub Index');
      }
    }

    const saved = localStorage.getItem('case_documents');
    if (saved) {
      const docs = JSON.parse(saved);
      (docs || []).forEach((doc) => {
        const people = [];
        if (doc.analysis?.entities?.people && Array.isArray(doc.analysis.entities.people)) {
          people.push(...doc.analysis.entities.people);
        }
        const content = doc.content || '';
        const docName = doc.name || doc.title || 'Document';
        const phones = doc.analysis?.entities?.phones || [];
        people.forEach((name) => {
          if (nameMatches(query, name)) {
            const key = normalizeName(name);
            if (!results.has(key)) {
              results.set(key, {
                name,
                imageUrl: null,
                sources: [],
                info: {},
                documentRefs: []
              });
            }
            const r = results.get(key);
            if (!r.sources.includes('Documents')) r.sources.push('Documents');
            r.documentRefs.push({
              docName,
              excerpt: content.substring(0, 200)
            });
          }
        });
        if (isPhoneQuery(query)) {
          const matchingPhones = phones.filter((ph) => phoneMatches(query, ph));
          const contentPhones = content.match(/\b(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g) || [];
          const hasMatch = matchingPhones.length > 0 || contentPhones.some((ph) => phoneMatches(query, ph));
          if (hasMatch) {
            const foundPhone = matchingPhones[0] || contentPhones.find((ph) => phoneMatches(query, ph));
            const key = `phone-doc:${docName}:${normalizePhone(query)}`;
            if (!results.has(key)) {
              results.set(key, {
                name: foundPhone ? `Phone ${foundPhone} in document` : `Phone match in "${docName}"`,
                imageUrl: null,
                sources: [],
                info: foundPhone ? { phone: foundPhone } : {},
                documentRefs: [{ docName, excerpt: content.substring(0, 300) }]
              });
            } else {
              results.get(key).documentRefs.push({ docName, excerpt: content.substring(0, 300) });
            }
            const r = results.get(key);
            if (!r.sources.includes('Documents')) r.sources.push('Documents');
          }
        }
      });
    }
  } catch {}

  // Add image from ImageData if we found match elsewhere but no image yet
  const arr = Array.from(results.values());
  arr.forEach((r) => {
    const imgMatch = ImageData.imageData.find(
      (img) =>
        nameMatches(r.name, img.name) ||
        (img.labels || []).some((l) => nameMatches(r.name, l))
    );
    if (imgMatch && !r.imageUrl) r.imageUrl = imgMatch.imageUrl;
  });

  return arr;
}

/**
 * Check if a message looks like a person search intent (name or phone).
 */
export function isPersonSearchQuery(message) {
  if (!message || message.length < 2) return false;
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // If it's just a greeting or common AI question, don't treat as person search
  const commonAIQuestions = [
    'who are you', 'what are you', 'your name', 'hello', 'hi', 'hey', 
    'help', 'capabilities', 'what can you do', 'tell me about yourself',
    'how are you', 'how is it going', 'who created you'
  ];
  if (commonAIQuestions.some(q => lower.includes(q))) return false;

  // If it's about "cases" in general, don't treat as person search
  if (/\b(our cases|all cases|latest cases|recent cases|statistics|stats|incidents)\b/i.test(lower)) return false;

  if (isPhoneQuery(trimmed)) return true;

  const patterns = [
    /who\s+is\s+(?!you|your|the\s+bot|the\s+ai)[\w\s\d.-]+/i,
    /look\s*up\s+(?!cases|incidents|reports)[\w\s\d.-]+/i,
    /find\s+(?:person|people|info|phone)\s+(?:with\s+)?(?:about\s+)?[\w\s\d.-]+/i,
    /search\s+(?:for\s+)?(?:phone\s+)?[\w\s\d.-]+/i,
    /information\s+(?:about|on)\s+(?!cases|incidents|reports)[\w\s\d.-]+/i,
    /tell\s+me\s+(?:about|more)\s+(?!cases|incidents|reports|you)[\w\s\d.-]+/i,
    /who\s+(?:is|are|has)\s+(?!you|your|the\s+bot|the\s+ai)[\w\s\d.-]+/i,
    /^(?:info|details?)\s+on\s+[\w\s\d.-]+/i,
    /^(?:lookup|search)\s+(?!cases|incidents|reports)[\w\s\d.-]+/i,
    /phone\s+(?:number\s+)?[\d\s.-]+/i,
    /(?:who|what)\s+(?:has\s+)?(?:phone|number)\s+[\d\s.-]+/i
  ];
  if (patterns.some((p) => p.test(lower))) return true;
  
  const words = lower.split(/\s+/).filter(Boolean);
  const notNames = ['hello', 'hi', 'help', 'what', 'show', 'list', 'all', 'time', 'date', 'bye', 'thanks', 'you', 'your', 'cases', 'incidents', 'reports', 'who', 'me', 'about'];
  
  // If it's 1-3 words and looks like a name (capitalized in original, but here we only have lower)
  // We check if it doesn't contain common words
  if (words.length >= 1 && words.length <= 3 && 
      words.every(w => w.length >= 2 && /^[a-z]+$/i.test(w)) && 
      !words.some(w => notNames.includes(w))) {
    return true;
  }
  
  return false;
}

/**
 * Extract search term (name or phone) from a person-search query.
 */
export function extractNameFromQuery(message) {
  const m = message.trim();
  if (isPhoneQuery(m)) {
    const phoneMatch = m.match(/(\+?\d[\d\s.-]{6,})|(\d{4,})/);
    return phoneMatch ? phoneMatch[0].trim() : m;
  }
  const patterns = [
    /who\s+is\s+([\w\s\d.-]+?)(?:\?|$)/i,
    /look\s*up\s+([\w\s\d.-]+?)(?:\?|$)/i,
    /find\s+(?:person|people|info|phone)\s+(?:with\s+)?(?:about\s+)?([\w\s\d.-]+?)(?:\?|$)/i,
    /search\s+(?:for\s+)?(?:phone\s+)?([\w\s\d.-]+?)(?:\?|$)/i,
    /information\s+(?:about|on)\s+([\w\s\d.-]+?)(?:\?|$)/i,
    /tell\s+me\s+(?:about|more)\s+([\w\s\d.-]+?)(?:\?|$)/i,
    /^(?:info|details?)\s+on\s+([\w\s\d.-]+?)(?:\?|$)/i,
    /^(?:lookup|search)\s+([\w\s\d.-]+?)(?:\?|$)/i,
    /phone\s+(?:number\s+)?([\d\s.-]+?)(?:\?|$)/i
  ];
  for (const p of patterns) {
    const match = m.match(p);
    if (match && match[1]) return match[1].trim();
  }
  const cleaned = m.replace(/\?/g, '').trim();
  if (cleaned.length >= 2) return cleaned;
  return cleaned;
}
