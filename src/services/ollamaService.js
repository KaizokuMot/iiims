/**
 * Ollama service - connects chat to local Llama 3.2 via Ollama API.
 * Builds context from investigations, uploaded documents, and data point sources.
 */

import ArrestData from '../TestDataPoint/ArrestData';
import PrisonData from '../TestDataPoint/PrisonData';
import ImageData from '../TestDataPoint/ImageData';
import { Hub } from './CentralHubService';

// Direct connection to Ollama (default localhost:11434). Ollama supports CORS from browsers.
// Use REACT_APP_OLLAMA_URL to override, e.g. for a remote server.
const OLLAMA_BASE = process.env.REACT_APP_OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.REACT_APP_OLLAMA_MODEL || 'iiims';

/**
 * Build knowledge context from all available data sources:
 * - Investigations from Intel (data point)
 * - Investigations from localStorage (data entry)
 * - Uploaded/analyzed documents from case_documents
 */

export function ollamaModel(){
return OLLAMA_MODEL.toString();
}
export function buildKnowledgeContext(investigationData = null) {

  const parts = [];

  // 1. Investigations from Intel / Data point
  const intelInvestigations = investigationData?.allInvestigations || [];
  if (intelInvestigations.length > 0) {
    parts.push('## INVESTIGATIONS (Data Point)');
    intelInvestigations.forEach((inv, i) => {
      const line = [
        `Case ${i + 1}: [${inv.intelType || 'Case'}]`,
        inv.location ? `Location: ${inv.location}` : '',
        inv.desc ? `Description: ${inv.desc}` : '',
        inv.suspects?.length ? `Suspects: ${inv.suspects.join(', ')}` : '',
        inv.victims?.length ? `Victims: ${inv.victims.join(', ')}` : '',
        inv.status ? `Status: ${inv.status}` : '',
        inv.dateCreated ? `Date: ${inv.dateCreated}` : '',
        inv.agency ? `Agency: ${inv.agency}` : ''
      ].filter(Boolean).join(' | ');
      parts.push(line);
    });
    parts.push('');
  }

  // 2. Additional investigations from localStorage (data entry)
  try {
    const storedInv = localStorage.getItem('investigations');
    if (storedInv) {
      const invs = JSON.parse(storedInv);
      if (Array.isArray(invs) && invs.length > 0) {
        parts.push('## INVESTIGATIONS (Data Entry)');
        invs.forEach((inv, i) => {
          const line = [
            `Entry ${i + 1}: [${inv.intelType || 'Case'}]`,
            inv.location ? `Location: ${inv.location}` : '',
            inv.desc ? `Description: ${inv.desc}` : '',
            inv.suspects?.length ? `Suspects: ${inv.suspects.join(', ')}` : '',
            inv.victims?.length ? `Victims: ${inv.victims.join(', ')}` : '',
            inv.status ? `Status: ${inv.status}` : ''
          ].filter(Boolean).join(' | ');
          parts.push(line);
        });
        parts.push('');
      }
    }
  } catch (e) {
    console.warn('Could not load investigations from localStorage:', e);
  }

  // 3. Uploaded and analyzed documents
  try {
    const savedDocs = localStorage.getItem('case_documents');
    if (savedDocs) {
      const docs = JSON.parse(savedDocs);
      if (Array.isArray(docs) && docs.length > 0) {
        parts.push('## UPLOADED DOCUMENTS');
        docs.forEach((doc, i) => {
          const name = doc.name || doc.title || `Document ${i + 1}`;
          const category = doc.category || doc.analysis?.category?.primary || 'Unknown';
          const desc = doc.desc || doc.analysis?.summary?.description || '';
          const content = doc.content ? doc.content.substring(0, 2000) : '';
          parts.push(`### ${name} (${category})`);
          if (desc) parts.push(`Summary: ${desc}`);
          if (content) parts.push(`Content excerpt: ${content}`);
          if (doc.analysis?.entities) {
            const ents = doc.analysis.entities;
            const people = ents.people || (Array.isArray(ents) ? [] : []);
            const places = ents.places || [];
            if (people.length || places.length) {
              parts.push(`Entities: People: ${[].concat(people).join(', ') || 'N/A'}; Places: ${[].concat(places).join(', ') || 'N/A'}`);
            }
          }
          parts.push('');
        });
      }
    }
  } catch (e) {
    console.warn('Could not load documents from localStorage:', e);
  }

  // 4. Arrest Records
  const arrests = ArrestData?.arrest_data || [];
  if (arrests.length > 0) {
    parts.push('## ARREST RECORDS');
    arrests.forEach((arr, i) => {
      const line = [
        `Arrest Case ${arr.caseID || i + 1}`,
        arr.perp_name ? `Name: ${arr.perp_name}` : '',
        arr.details ? `Details: ${arr.details}` : '',
        arr.status ? `Status: ${arr.status}` : '',
        arr.agency ? `Agency: ${arr.agency}` : '',
        arr.location ? `Location: ${arr.location}` : ''
      ].filter(Boolean).join(' | ');
      parts.push(line);
    });
    parts.push('');
  }

  // 5. Prison Records
  const prisons = PrisonData?.prisons_data || [];
  if (prisons.length > 0) {
    parts.push('## PRISON RECORDS');
    prisons.forEach((p, i) => {
      const line = [
        `Inmate: ${p.name}`,
        p.crime ? `Crime: ${p.crime}` : '',
        p.sentence ? `Sentence: ${p.sentence}` : '',
        p.location ? `Facility: ${p.location}` : '',
        p.date_of_entry ? `Entry: ${p.date_of_entry}` : ''
      ].filter(Boolean).join(' | ');
      parts.push(line);
    });
    parts.push('');
  }

  // 6. Image Intelligence
  const images = ImageData?.imageData || [];
  if (images.length > 0) {
    parts.push('## IMAGE INTELLIGENCE');
    images.forEach((img, i) => {
      const line = [
        `Image: ${img.name || 'Unknown'}`,
        img.description ? `Desc: ${img.description}` : '',
        img.location ? `Loc: ${img.location}` : '',
        img.labels ? `Labels: ${img.labels.join(', ')}` : ''
      ].filter(Boolean).join(' | ');
      parts.push(line);
    });
    parts.push('');
  }

  // 7. Geographic Intelligence (Hotspots)
  const hotspots = Hub.getGeographicIntelligence();
  if (Object.keys(hotspots).length > 0) {
    parts.push('## GEOGRAPHIC HOTSPOTS (UGANDA)');
    Object.entries(hotspots).forEach(([loc, data]) => {
      parts.push(`### ${loc} (${data.count} related incidents)`);
      parts.push(`Pattern: ${data.incidents.slice(0, 5).join(', ')}${data.incidents.length > 5 ? '...' : ''}`);
      parts.push(`Sources: ${data.sources.join(', ')}`);
      parts.push('');
    });
  }

  if (parts.length === 0) {
    return 'No investigation or document data is currently loaded. Answer based on general knowledge and suggest uploading documents or adding investigations for better answers.';
  }

  return parts.join('\n');
}

/**
 * Call Ollama chat API with the given messages and optional system context.
 * @param {Object} options
 * @param {Array} options.messages - Array of {role, content}
 * @param {string} options.systemContext - System prompt with knowledge base
 * @param {boolean} options.stream - Whether to stream the response (default: false)
 * @returns {Promise<string>} The assistant's response
 */
export async function callOllamaChat({ messages = [], systemContext = '', stream = false }) {
  const url = `${OLLAMA_BASE}/api/chat`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  const systemMessage = {
    role: 'system',
    content: `Your name is Dixon , a digital version of the your creator, an intelligence investigation assistant for Uganda law enforcement and analysts. 

IMPORTANT: The KNOWLEDGE BASE below contains the ACTUAL investigation files, arrest records, and documents from this system. When a user asks about "our cases", "investigations", or "ongoing data", they are referring to this specific data.

Your primary goal is to help officers search, analyze, and understand these specific case files and documents.

Your are safe secure and offline, and you know how sensitvie this information is.

--- KNOWLEDGE BASE ---
${systemContext}
--- END KNOWLEDGE BASE ---

Guidelines:
1. Use the data in the Knowledge Base as your primary source of truth.
2. If you find relevant cases (e.g. kidnappings in Kampala, fraud in Entebbe), summarize them clearly.
3. Be concise, accurate, and professional. 
4. If the data doesn't contain a specific answer, say so, but mention what IS available in the knowledge base.
5. Cite specific Case IDs or Document names when providing information.`
  };

  const fullMessages = systemContext ? [systemMessage, ...messages] : messages;

  const body = {
    model: OLLAMA_MODEL,
    messages: fullMessages,
    stream: !!stream
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama error (${res.status}): ${errText || res.statusText}`);
    }

    const data = await res.json();
    return data.message?.content || data.response || '';
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Ollama request timed out after 60 seconds');
    }
    console.error('Ollama request failed:', err);
    throw err;
  }
}

/**
 * Check if Ollama is reachable and return status info.
 */
export async function getOllamaStatus() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      const models = data.models || [];
      const currentModel = models.find(m => m.name.includes(OLLAMA_MODEL)) || models[0];
      return {
        online: true,
        model: currentModel ? currentModel.name : OLLAMA_MODEL,
        allModels: models.map(m => m.name)
      };
    }
    return { online: false, model: OLLAMA_MODEL };
  } catch (err) {
    return { online: false, model: OLLAMA_MODEL, error: err.message };
  }
}

export async function checkOllamaConnection() {
  const status = await getOllamaStatus();
  return status.online;
}
