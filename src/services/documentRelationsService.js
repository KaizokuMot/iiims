/**
 * Finds patterns and relations between a document and other data points in the system.
 * Cross-references document entities (people, places, phones, etc.) with Intel, Arrests, Prison, Images, and other documents.
 */

import IntelData from '../TestDataPoint/Intel';
import ArrestData from '../TestDataPoint/ArrestData';
import PrisonData from '../TestDataPoint/PrisonData';
import ImageData from '../TestDataPoint/ImageData';

const LABEL_IDS = ['dixon', 'eugene', 'eric', 'paul', 'devon', 'president'];
const PUBLIC_URL = process.env.PUBLIC_URL || '';

function normalizeName(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

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

function normalizePhone(s) {
  return (s || '').replace(/\D/g, '');
}

function phoneMatches(a, b) {
  if (!a || !b) return false;
  const pa = normalizePhone(a);
  const pb = normalizePhone(b);
  return pa.length >= 4 && (pb.includes(pa) || pa.includes(pb));
}

/**
 * Extract entities from a document (people, places, phones, etc.)
 */
function extractDocEntities(doc) {
  const entities = {
    people: [],
    places: [],
    phones: [],
    organizations: []
  };

  const ents = doc.analysis?.entities;
  if (ents) {
    if (Array.isArray(ents.people)) entities.people = ents.people;
    else if (ents.people?.description) {
      const m = ents.people.description.match(/<span class="key-item">([^<]+)<\/span>/g) || [];
      entities.people = m.map(x => x.replace(/<span class="key-item">|<\/span>/g, '').trim());
    }
    if (Array.isArray(ents.places)) entities.places = ents.places;
    else if (ents.places?.description) {
      const m = ents.places.description.match(/<span class="key-item">([^<]+)<\/span>/g) || [];
      entities.places = m.map(x => x.replace(/<span class="key-item">|<\/span>/g, '').trim());
    }
    if (Array.isArray(ents.phones)) entities.phones = ents.phones;
    else if (ents.phones) entities.phones = Array.isArray(ents.phones) ? ents.phones : [];
    if (Array.isArray(ents.organizations)) entities.organizations = ents.organizations;
  }

  const content = doc.content || '';
  if (entities.people.length === 0) {
    const peopleMatch = content.match(/\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Officer|Detective|Suspect|Victim|Witness)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    entities.people = [...new Set(peopleMatch)];
  }
  if (entities.phones.length === 0) {
    const phonesMatch = content.match(/\b(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g) || [];
    entities.phones = [...new Set(phonesMatch)];
  }

  return entities;
}

/**
 * Find relations between a document and system data points.
 * @param {Object} doc - Document with analysis
 * @param {Array} allDocuments - All documents (for doc-to-doc relations)
 * @returns {Object} { relations: [...], hasRelations: boolean }
 */
export function findDocumentDataPointRelations(doc, allDocuments = []) {
  const entities = extractDocEntities(doc);
  const relations = [];

  // --- Intel (investigations) ---
  const intel = IntelData.allInvestigations || [];
  intel.forEach((inv) => {
    const suspectMatches = entities.people.filter((p) => (inv.suspects || []).some((s) => nameMatches(p, s)));
    const victimMatches = entities.people.filter((p) => (inv.victims || []).some((v) => nameMatches(p, v)));
    const officerMatches = entities.people.filter((p) => (inv.officersOnScene || []).some((o) => nameMatches(p, o)));
    const locMatch = entities.places.some((p) => nameMatches(p, inv.location));

    if (suspectMatches.length > 0 || victimMatches.length > 0 || officerMatches.length > 0 || locMatch) {
      const matchedRoles = [];
      if (suspectMatches.length > 0) matchedRoles.push(`Suspects: ${suspectMatches.join(', ')}`);
      if (victimMatches.length > 0) matchedRoles.push(`Victims: ${victimMatches.join(', ')}`);
      if (officerMatches.length > 0) matchedRoles.push(`Officers: ${officerMatches.join(', ')}`);

      relations.push({
        type: 'investigation',
        source: 'Intel',
        id: inv.id,
        label: inv.intelType,
        description: inv.desc,
        location: inv.location,
        status: inv.status,
        matchedPeople: [...new Set([...suspectMatches, ...victimMatches, ...officerMatches])],
        matchedRoles: matchedRoles,
        matchedLocation: locMatch ? inv.location : null,
        link: null
      });
    }
  });

  // --- Arrest data ---
  const arrests = ArrestData.arrest_data || [];
  arrests.forEach((a) => {
    const perpMatch = a.perp_name && entities.people.some((p) => nameMatches(p, a.perp_name)) ? [a.perp_name] : [];
    const suspectMatches = entities.people.filter((p) => (a.suspects || []).some((s) => nameMatches(p, s)));
    const officerMatches = entities.people.filter((p) => (a.officersOnScene || []).some((o) => nameMatches(p, o)));
    const locMatch = entities.places.some((p) => nameMatches(p, a.location));

    if (perpMatch.length > 0 || suspectMatches.length > 0 || officerMatches.length > 0 || locMatch) {
      const matchedRoles = [];
      if (perpMatch.length > 0) matchedRoles.push(`Perpetrator: ${perpMatch[0]}`);
      if (suspectMatches.length > 0) matchedRoles.push(`Suspects: ${suspectMatches.join(', ')}`);
      if (officerMatches.length > 0) matchedRoles.push(`Officers: ${officerMatches.join(', ')}`);

      relations.push({
        type: 'arrest',
        source: 'Arrest Data',
        id: a.caseID,
        label: a.details,
        description: a.desc,
        location: a.location,
        status: a.status,
        matchedPeople: [...new Set([...perpMatch, ...suspectMatches, ...officerMatches])],
        matchedRoles: matchedRoles,
        matchedLocation: locMatch ? a.location : null,
        link: null
      });
    }
  });

  // --- Prison data ---
  const prisons = PrisonData.prisons_data || [];
  prisons.forEach((p) => {
    const peopleMatch = entities.people.some((ep) => nameMatches(ep, p.name));
    const locMatch = entities.places.some((pl) => nameMatches(pl, p.location));
    if (peopleMatch || locMatch) {
      relations.push({
        type: 'prison',
        source: 'Prison Data',
        id: p.id,
        label: p.crime,
        description: `${p.name} - ${p.sentence}`,
        location: p.location,
        matchedPeople: peopleMatch ? [p.name] : [],
        matchedLocation: locMatch ? p.location : null,
        link: null
      });
    }
  });

  // --- Image data (people with photos) ---
  ImageData.imageData.forEach((img) => {
    const names = [img.name, ...(img.labels || [])].filter(Boolean);
    const peopleMatches = entities.people.filter((p) => names.some((n) => nameMatches(p, n)));
    if (peopleMatches.length > 0) {
      relations.push({
        type: 'image',
        source: 'Image Database',
        id: img.name,
        label: img.name,
        imageUrl: img.imageUrl,
        matchedPeople: peopleMatches,
        link: null
      });
    }
  });

  // --- Facial recognition labels (phone match - known labels use 123-456-7890) ---
  const knownLabelPhones = [{ phone: '123-456-7890', name: 'Dixon Kalanzi' }, { phone: '1234567890', name: 'Dixon Kalanzi' }];
  entities.phones.forEach((phone) => {
    const match = knownLabelPhones.find((kp) => phoneMatches(phone, kp.phone));
    if (match) {
      relations.push({
        type: 'facial_recognition',
        source: 'Facial Recognition',
        label: match.name,
        matchedPhone: phone,
        link: null
      });
    }
  });

  // --- localStorage investigations ---
  try {
    const stored = localStorage.getItem('investigations');
    if (stored) {
      const invs = JSON.parse(stored);
      (invs || []).forEach((inv) => {
        const people = [...(inv.suspects || []), ...(inv.victims || [])];
        const peopleMatches = entities.people.filter((p) => people.some((pp) => nameMatches(p, pp)));
        const locMatch = inv.location && entities.places.some((p) => nameMatches(p, inv.location));
        if (peopleMatches.length > 0 || locMatch) {
          relations.push({
            type: 'data_entry',
            source: 'Data Entry',
            id: inv.id,
            label: inv.intelType,
            description: inv.desc,
            location: inv.location,
            matchedPeople: peopleMatches,
            matchedLocation: locMatch ? inv.location : null,
            link: null
          });
        }
      });
    }
  } catch {}

  // --- Other documents (cross-doc relations) ---
  const otherDocs = (allDocuments || []).filter((d) => d.id !== doc.id);
  otherDocs.forEach((other) => {
    const otherEnts = extractDocEntities(other);
    const commonPeople = entities.people.filter((ep) =>
      otherEnts.people.some((op) => nameMatches(ep, op))
    );
    const commonPlaces = entities.places.filter((ep) =>
      otherEnts.places.some((op) => nameMatches(ep, op))
    );
    if (commonPeople.length > 0 || commonPlaces.length > 0) {
      relations.push({
        type: 'document',
        source: 'Other Document',
        id: other.id,
        label: other.name,
        description: other.analysis?.summary?.description?.substring(0, 150) || '',
        matchedPeople: commonPeople,
        matchedPlaces: commonPlaces,
        link: null
      });
    }
  });

  return {
    relations,
    hasRelations: relations.length > 0,
    summary: relations.length > 0
      ? `${relations.length} pattern match(es) with data points`
      : 'No patterns found with existing data'
  };
}
