import React, { useState, useEffect, useRef } from 'react';
import './AIChat.css';
import axios from 'axios';
import nlpLib from 'compromise';
import { callOllamaChat, buildKnowledgeContext, checkOllamaConnection, ollamaModel } from '../services/ollamaService';
import { searchPeople, isPersonSearchQuery, extractNameFromQuery } from '../services/peopleSearchService';
import PersonSearchResults from '../components/PersonSearchResults';

// Advanced NLP learning system
// This system stores and learns from conversation patterns, not just keywords

// NLP Training Data Structure
const NLPTrainingData = {
  // Load training data from localStorage
  load: () => {
    try {
      return JSON.parse(localStorage.getItem('nlp_training_data') || JSON.stringify({
        patterns: [],
        contextPairs: [],
        keywords: [],
        synonyms: {},
        intentMap: {}
      }));
    } catch (e) {
      console.warn('Error loading NLP training data:', e);
      return {
        patterns: [],
        contextPairs: [],
        keywords: [],
        synonyms: {},
        intentMap: {}
      };
    }
  },

  // Save training data to localStorage
  save: (data) => {
    try {
      localStorage.setItem('nlp_training_data', JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Error saving NLP training data:', e);
      return false;
    }
  },

  // Add a new pattern to the training data
  addPattern: (pattern, intent) => {
    const data = NLPTrainingData.load();
    data.patterns.push({ pattern, intent, timestamp: Date.now() });
    // Also update the intent map
    if (!data.intentMap[intent]) {
      data.intentMap[intent] = [];
    }
    data.intentMap[intent].push(pattern);
    return NLPTrainingData.save(data);
  },

  // Add a context-response pair to the training data
  addContextPair: (context, response) => {
    const data = NLPTrainingData.load();
    data.contextPairs.push({ context, response, timestamp: Date.now() });
    return NLPTrainingData.save(data);
  },

  // Add keywords with their associated intents
  addKeywords: (keywords, intent) => {
    const data = NLPTrainingData.load();
    keywords.forEach(keyword => {
      data.keywords.push({ keyword, intent, timestamp: Date.now() });
    });
    return NLPTrainingData.save(data);
  },

  // Add synonyms for better matching
  addSynonyms: (word, synonyms) => {
    const data = NLPTrainingData.load();
    data.synonyms[word] = synonyms;
    return NLPTrainingData.save(data);
  }
};

// Enhanced NLP function that uses both compromise and advanced learning
const nlp = (text) => {
  try {
    // Try to use the real compromise library
    const nlpResult = nlpLib(text);

    // Load training data
    const trainingData = NLPTrainingData.load();

    // Enhance the topics function to include learned patterns and keywords
    const originalTopics = nlpResult.topics;
    nlpResult.topics = () => {
      const originalResult = originalTopics.call(nlpResult);

      // Create an enhanced output function that includes learned patterns
      const originalOut = originalResult.out;
      originalResult.out = (format) => {
        const originalOutput = originalOut.call(originalResult, format);

        // Check for pattern matches
        const matchingPatterns = [];
        trainingData.patterns.forEach(({ pattern, intent }) => {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(text)) {
            matchingPatterns.push(intent);
          }
        });

        // Check for keyword matches
        const matchingKeywords = trainingData.keywords
          .filter(({ keyword }) => text.toLowerCase().includes(keyword.toLowerCase()))
          .map(({ intent }) => intent);

        // Check for synonym matches
        const words = text.toLowerCase().split(/\W+/);
        const matchingSynonyms = [];
        words.forEach(word => {
          Object.entries(trainingData.synonyms).forEach(([mainWord, synonymList]) => {
            if (synonymList.includes(word)) {
              matchingSynonyms.push(mainWord);
            }
          });
        });

        // Combine all matches
        const allMatches = [...new Set([...matchingPatterns, ...matchingKeywords, ...matchingSynonyms])];

        if (format === 'array') {
          return [...originalOutput, ...allMatches];
        } else {
          return originalOutput + (originalOutput && allMatches.length ? ', ' : '') + allMatches.join(', ');
        }
      };

      return originalResult;
    };

    // Add a method to detect intent based on training data
    nlpResult.detectIntent = () => {
      const trainingData = NLPTrainingData.load();
      const intents = {};

      // Check pattern matches
      trainingData.patterns.forEach(({ pattern, intent }) => {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(text)) {
          intents[intent] = (intents[intent] || 0) + 2; // Patterns have higher weight
        }
      });

      // Check keyword matches
      trainingData.keywords.forEach(({ keyword, intent }) => {
        if (text.toLowerCase().includes(keyword.toLowerCase())) {
          intents[intent] = (intents[intent] || 0) + 1;
        }
      });

      // Find the intent with the highest score
      let topIntent = null;
      let topScore = 0;

      Object.entries(intents).forEach(([intent, score]) => {
        if (score > topScore) {
          topIntent = intent;
          topScore = score;
        }
      });

      return { intent: topIntent, confidence: topScore };
    };

    // Add a method to find the most similar context
    nlpResult.findSimilarContext = () => {
      const trainingData = NLPTrainingData.load();
      let bestMatch = null;
      let highestSimilarity = 0;

      trainingData.contextPairs.forEach(({ context, response }) => {
        // Calculate similarity (very simple implementation)
        const contextWords = context.toLowerCase().split(/\W+/).filter(w => w.length > 2);
        const textWords = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);

        // Count matching words
        let matchCount = 0;
        textWords.forEach(word => {
          if (contextWords.includes(word)) {
            matchCount++;
          }
        });

        // Calculate similarity score
        const similarity = matchCount / Math.max(contextWords.length, textWords.length);

        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          bestMatch = { context, response, similarity };
        }
      });

      return bestMatch;
    };

    return nlpResult;
  } catch (e) {
    // Fallback mock implementation if compromise fails
    console.warn('Compromise library failed to process text, using fallback implementation');

    // Load training data for the fallback implementation
    const trainingData = NLPTrainingData.load();

    return {
      people: () => ({
        out: (format) => {
          const matches = text.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [];
          return format === 'array' ? matches : matches.join(', ');
        }
      }),
      places: () => ({
        out: (format) => {
          const matches = text.match(/\b[A-Z][a-z]+\b/g) || [];
          const filtered = matches.filter(word => word.length > 3);
          return format === 'array' ? filtered : filtered.join(', ');
        }
      }),
      organizations: () => ({
        out: (format) => {
          const matches = text.match(/\b[A-Z][A-Z]+\b/g) || [];
          return format === 'array' ? matches : matches.join(', ');
        }
      }),
      topics: () => ({
        out: (format) => {
          // Extract potential topics (nouns) from the text
          const words = text.toLowerCase().split(/\W+/).filter(word => word.length > 3);
          // Filter out common stop words
          const stopWords = ['what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how',
            'that', 'this', 'these', 'those', 'there', 'their', 'they', 'them',
            'have', 'has', 'had', 'does', 'did', 'doing', 'about', 'should', 'could'];
          const topics = words.filter(word => !stopWords.includes(word));

          // Check for pattern matches
          const matchingPatterns = [];
          trainingData.patterns.forEach(({ pattern, intent }) => {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(text)) {
              matchingPatterns.push(intent);
            }
          });

          // Check for keyword matches
          const matchingKeywords = trainingData.keywords
            .filter(({ keyword }) => text.toLowerCase().includes(keyword.toLowerCase()))
            .map(({ intent }) => intent);

          const allTopics = [...topics, ...matchingPatterns, ...matchingKeywords];
          return format === 'array' ? allTopics : allTopics.join(', ');
        }
      }),
      dates: () => ({
        out: (format) => {
          // Simple date pattern matching
          const matches = text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{1,2}-\d{1,2}-\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}(?:st|nd|rd|th)?,? \d{4}\b/g) || [];
          return format === 'array' ? matches : matches.join(', ');
        }
      }),
      detectIntent: () => {
        const intents = {};

        // Check pattern matches
        trainingData.patterns.forEach(({ pattern, intent }) => {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(text)) {
            intents[intent] = (intents[intent] || 0) + 2; // Patterns have higher weight
          }
        });

        // Check keyword matches
        trainingData.keywords.forEach(({ keyword, intent }) => {
          if (text.toLowerCase().includes(keyword.toLowerCase())) {
            intents[intent] = (intents[intent] || 0) + 1;
          }
        });

        // Find the intent with the highest score
        let topIntent = null;
        let topScore = 0;

        Object.entries(intents).forEach(([intent, score]) => {
          if (score > topScore) {
            topIntent = intent;
            topScore = score;
          }
        });

        return { intent: topIntent, confidence: topScore };
      },
      findSimilarContext: () => {
        let bestMatch = null;
        let highestSimilarity = 0;

        trainingData.contextPairs.forEach(({ context, response }) => {
          // Calculate similarity (very simple implementation)
          const contextWords = context.toLowerCase().split(/\W+/).filter(w => w.length > 2);
          const textWords = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);

          // Count matching words
          let matchCount = 0;
          textWords.forEach(word => {
            if (contextWords.includes(word)) {
              matchCount++;
            }
          });

          // Calculate similarity score
          const similarity = matchCount / Math.max(contextWords.length, textWords.length);

          if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            bestMatch = { context, response, similarity };
          }
        });

        return bestMatch;
      }
    };
  }
};

// Helper function to train NLP with document data
const trainNLPWithDocument = (doc) => {
  if (!doc) return;
  // Add keywords
  if (doc.analysis && doc.analysis.keywords && Array.isArray(doc.analysis.keywords)) {
    NLPTrainingData.addKeywords(doc.analysis.keywords, 'investigation_query');
  }
  // Add context pairs for summary/insights
  if (doc.analysis && doc.analysis.summary && doc.analysis.summary.description) {
    NLPTrainingData.addContextPair(doc.name, doc.analysis.summary.description);
  }
  // Add entities as keywords
  if (doc.analysis && doc.analysis.entities) {
    ['people', 'places', 'organizations'].forEach(type => {
      if (Array.isArray(doc.analysis.entities[type])) {
        NLPTrainingData.addKeywords(doc.analysis.entities[type], 'investigation_query');
      }
    });
  }
};

// Function to analyze document patterns
const analyzeDocumentPatterns = () => {
  // Get document analysis data from localStorage
  let documents = [];
  try {
    const savedDocs = localStorage.getItem('case_documents');
    if (savedDocs) {
      documents = JSON.parse(savedDocs);
    }
  } catch (error) { }

  if (!documents || documents.length === 0) {
    return "No analyzed documents available for pattern analysis.";
  }

  // Aggregate all text for NLP
  const allText = documents.map(doc => doc.content || '').join('\n\n');
  const nlpResult = nlp(allText);

  // Extract entities/topics
  const people = nlpResult.people().out('array');
  const orgs = nlpResult.organizations().out('array');
  const places = nlpResult.places().out('array');
  const topics = nlpResult.topics().out('array');
  const keywords = Array.from(new Set(allText.toLowerCase().match(/\b[a-z]{4,}\b/g) || []))
    .filter(word => !['this', 'that', 'with', 'from', 'have', 'were', 'they', 'their', 'which', 'about', 'there', 'where', 'when', 'what', 'will', 'shall', 'upon', 'said', 'also', 'such', 'been', 'into', 'only', 'some', 'most', 'more', 'than', 'each', 'very', 'over', 'case', 'cases', 'file', 'files', 'report', 'reports', 'document', 'documents'].includes(word))
    .slice(0, 20);

  // Category distribution
  const categoryCounts = {};
  documents.forEach(doc => {
    const cat = doc.category || 'Other';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  // Cross-reference with investigations (if available)
  let investigations = [];
  try {
    // If you import your investigations data, use it here:
    // import investigationsData from '../TestDataPoint/Investigation';
    // investigations = investigationsData.allInvestigations || [];
    // For now, try to get from localStorage if available:
    const inv = localStorage.getItem('investigations');
    if (inv) investigations = JSON.parse(inv);
  } catch (e) { }

  // Find people/entities that match investigations
  let referencedInvestigations = [];
  if (investigations.length && people.length) {
    referencedInvestigations = investigations.filter(inv =>
      people.some(person =>
        (inv.suspects && inv.suspects.some(s => s.toLowerCase().includes(person.toLowerCase()))) ||
        (inv.victims && inv.victims.some(v => v.toLowerCase().includes(person.toLowerCase())))
      )
    );
  }

  // Compose summary
  let summary = `<h2>Crime Document NLP Summary (${documents.length} Documents)</h2>`;
  summary += `<div><strong>Categories:</strong> ${Object.entries(categoryCounts).map(([cat, count]) => `${cat}: ${count}`).join(', ')}</div>`;

  summary += `<h3 style="margin:8px 0 4px;">Key Entities</h3>`;
  summary += `<div><strong>People:</strong> ${people.length ? people.join(', ') : 'N/A'}</div>`;
  summary += `<div><strong>Organizations:</strong> ${orgs.length ? orgs.join(', ') : 'N/A'}</div>`;
  summary += `<div><strong>Places:</strong> ${places.length ? places.join(', ') : 'N/A'}</div>`;

  summary += `<h3 style="margin:8px 0 4px;">Topics & Keywords</h3>`;
  summary += `<div><strong>Topics:</strong> ${topics.length ? topics.join(', ') : 'N/A'}</div>`;
  summary += `<div><strong>Keywords:</strong> ${keywords.length ? keywords.join(', ') : 'N/A'}</div>`;

  if (referencedInvestigations.length) {
    summary += `<h3 style="margin:8px 0 4px;">Referenced Investigations</h3>`;
    summary += `<ul>`;
    referencedInvestigations.forEach(inv => {
      summary += `<li><strong>${inv.intelType || 'Case'}:</strong> ${inv.desc ? inv.desc.substring(0, 100) + '...' : 'No description'} (Location: ${inv.location || 'N/A'})</li>`;
    });
    summary += `</ul>`;
  }

  summary += `<h3 style="margin:8px 0 4px;">Summary</h3>`;
  summary += `<div>This summary is based on NLP analysis of all uploaded documents. Entities and topics above are extracted from the actual document content. ${referencedInvestigations.length ? 'Some people/entities in the documents match investigations in your database.' : ''}</div>`;

  return summary;
};

// Knowledge base for common questions
const knowledgeBase = {
  greetings: [
    "Hello! How can I help you today?",
    "Hi there! What can I do for you?",
    "Greetings! How may I assist you?",
    "Hello! I'm here to help. What do you need?"
  ],
  farewells: [
    "Goodbye! Have a great day!",
    "See you later! Feel free to come back if you have more questions.",
    "Farewell! It was nice chatting with you.",
    "Bye for now! Let me know if you need anything else."
  ],
  thanks: [
    "You're welcome!",
    "Happy to help!",
    "Anytime!",
    "No problem at all!"
  ]
};


const AIChat = ({ data }) => {
  const [messages, setMessages] = useState([]);
  const [trainedModel, setTrainedModel] = useState(null);
  const [activeTab, setActiveTab] = useState('current'); // 'current' or 'old'
  const [oldChats, setOldChats] = useState([]);
  const [selectedOldChat, setSelectedOldChat] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  // These state variables are used by the event listeners
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isReceivingTranscript, setIsReceivingTranscript] = useState(false);
  const [conversationContext, setConversationContext] = useState({
    lastQuery: null,
    lastResponse: null,
    lastResults: [],
    followUpCount: 0,
    activeTopics: new Set(),
    recentEntities: [],
    conversationHistory: [],
    lastInteractionTime: new Date()
  });
  const [ollamaAvailable, setOllamaAvailable] = useState(null); // null=checking, true/false=result
  const inputRef = useRef(null);
  const chatAreaRef = useRef(null); // For current chat
  const oldChatAreaRef = useRef(null); // For old chat detail

  // Load old chats from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('old_chats');
    if (stored) {
      setOldChats(JSON.parse(stored));
    }
  }, []);

  // Check Ollama connection on mount
  useEffect(() => {
    checkOllamaConnection().then(ok => setOllamaAvailable(ok));
  }, []);

  // Define trainInvestigationModel function
  const trainInvestigationModel = (customData = null) => {
    // Create a simple NLP model based on your investigation data
    // If customData is provided, use it instead of the default data
    const dataToUse = customData || data;

    // Get document analysis data from localStorage
    const documentData = getDocumentAnalysisData();

    const model = {
      entities: extractEntities(dataToUse, documentData),
      keywords: buildKeywordIndex(dataToUse, documentData),
      patterns: learnPatterns(),
      documents: documentData // Store document data in the model
    };

    setTrainedModel(model);
    return "Model successfully trained with " +
      (dataToUse && dataToUse.allInvestigations ? dataToUse.allInvestigations.length : 0) +
      " investigations and " + (documentData ? documentData.length : 0) + " analyzed documents.";
  };

  // Function to get document analysis data from localStorage
  const getDocumentAnalysisData = () => {
    try {
      const savedDocs = localStorage.getItem('case_documents');
      if (savedDocs) {
        return JSON.parse(savedDocs);
      }
      return [];
    } catch (error) {
      console.error('Error loading document analysis data:', error);
      return [];
    }
  };

  // Function to train model with new data
  const trainModelWithNewData = (newInvestigations) => {
    // Create a new data object that combines existing data with new investigations
    const combinedData = {
      allInvestigations: [
        ...(data && data.allInvestigations ? data.allInvestigations : []),
        ...newInvestigations
      ]
    };

    // Train the model with the combined data
    return trainInvestigationModel(combinedData);
  };

  const extractEntities = (dataSource = data, documentData = []) => {
    // Extract named entities from your investigation data and document analysis
    const entities = {
      people: new Set(),
      locations: new Set(),
      organizations: new Set(),
      dates: new Set(),
      caseNumbers: new Set(),
      crimeTypes: new Set(),
      weapons: new Set(),
      legalReferences: new Set()
    };

    // Extract entities from investigation data
    if (dataSource && dataSource.allInvestigations) {
      dataSource.allInvestigations.forEach(investigation => {
        // Add suspects and victims to people entities
        if (investigation.suspects) {
          investigation.suspects.forEach(suspect => entities.people.add(suspect.toLowerCase()));
        }
        if (investigation.victims) {
          investigation.victims.forEach(victim => entities.people.add(victim.toLowerCase()));
        }

        // Add location
        if (investigation.location) {
          entities.locations.add(investigation.location.toLowerCase());
        }

        // Add agency as organization
        if (investigation.agency) {
          entities.organizations.add(investigation.agency.toLowerCase());
        }
      });
    }

    // Extract entities from document analysis data
    if (documentData && documentData.length > 0) {
      documentData.forEach(doc => {
        if (doc.analysis && doc.analysis.entities) {
          // Extract entities from the document analysis
          const docEntities = doc.analysis.entities;

          // Helper function to extract entities from HTML description
          const extractEntitiesFromDescription = (description) => {
            if (!description) return [];
            const matches = description.match(/<span class="key-item">([^<]+)<\/span>/g) || [];
            return matches.map(match =>
              match.replace(/<span class="key-item">/, '').replace(/<\/span>/, '').trim()
            );
          };

          // Process each entity type
          if (typeof docEntities.description === 'string') {
            // If entities are stored as HTML description, extract them
            const entityMatches = extractEntitiesFromDescription(docEntities.description);
            entityMatches.forEach(entity => {
              // Try to categorize the entity
              if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(entity)) {
                entities.people.add(entity.toLowerCase());
              } else if (/^[A-Z][a-z]+$/.test(entity) && entity.length > 3) {
                entities.locations.add(entity.toLowerCase());
              }
            });
          } else {
            // If entities are stored as structured data
            if (docEntities.people) {
              docEntities.people.forEach(person => entities.people.add(person.toLowerCase()));
            }
            if (docEntities.places) {
              docEntities.places.forEach(place => entities.locations.add(place.toLowerCase()));
            }
            if (docEntities.organizations) {
              docEntities.organizations.forEach(org => entities.organizations.add(org.toLowerCase()));
            }
            if (docEntities.dates) {
              docEntities.dates.forEach(date => entities.dates.add(date));
            }
            if (docEntities.caseNumbers) {
              docEntities.caseNumbers.forEach(caseNum => entities.caseNumbers.add(caseNum));
            }
            if (docEntities.crimeTypes) {
              docEntities.crimeTypes.forEach(crimeType => entities.crimeTypes.add(crimeType.toLowerCase()));
            }
            if (docEntities.weapons) {
              docEntities.weapons.forEach(weapon => entities.weapons.add(weapon.toLowerCase()));
            }
            if (docEntities.legalReferences) {
              docEntities.legalReferences.forEach(ref => entities.legalReferences.add(ref));
            }
          }
        }
      });
    }

    return entities;
  };

  const buildKeywordIndex = (dataSource = data, documentData = []) => {
    // Build keyword index for faster searching
    const keywordMap = {};

    // Add keywords from investigation data
    if (dataSource && dataSource.allInvestigations) {
      dataSource.allInvestigations.forEach(investigation => {
        // Add keywords from description
        if (investigation.desc) {
          const keywords = investigation.desc.toLowerCase().split(/\W+/).filter(word => word.length > 3);

          keywords.forEach(keyword => {
            if (!keywordMap[keyword]) {
              keywordMap[keyword] = { investigations: [], documents: [] };
            }
            keywordMap[keyword].investigations.push(investigation.id);
          });
        }

        // Add intel type as keyword
        if (investigation.intelType) {
          const intelType = investigation.intelType.toLowerCase();
          if (!keywordMap[intelType]) {
            keywordMap[intelType] = { investigations: [], documents: [] };
          }
          keywordMap[intelType].investigations.push(investigation.id);
        }
      });
    }

    // Add keywords from document analysis data
    if (documentData && documentData.length > 0) {
      documentData.forEach(doc => {
        // Add document ID to keyword map
        const docId = doc.id;

        // Helper function to extract keywords from HTML description
        const extractKeywordsFromDescription = (description) => {
          if (!description) return [];
          const matches = description.match(/<span class="key-item">([^<(]+)/g) || [];
          return matches.map(match =>
            match.replace(/<span class="key-item">/, '').trim().split(' ')[0].toLowerCase()
          ).filter(word => word.length > 3);
        };

        // Extract keywords from document content
        if (doc.content) {
          const contentKeywords = doc.content.toLowerCase()
            .split(/\W+/)
            .filter(word => word.length > 3);

          contentKeywords.forEach(keyword => {
            if (!keywordMap[keyword]) {
              keywordMap[keyword] = { investigations: [], documents: [] };
            }
            if (!keywordMap[keyword].documents.includes(docId)) {
              keywordMap[keyword].documents.push(docId);
            }
          });
        }

        // Extract keywords from document analysis
        if (doc.analysis) {
          // Extract from keywords section if available
          if (doc.analysis.keywords && doc.analysis.keywords.description) {
            const analysisKeywords = extractKeywordsFromDescription(doc.analysis.keywords.description);

            analysisKeywords.forEach(keyword => {
              if (!keywordMap[keyword]) {
                keywordMap[keyword] = { investigations: [], documents: [] };
              }
              if (!keywordMap[keyword].documents.includes(docId)) {
                keywordMap[keyword].documents.push(docId);
              }
            });
          }

          // Add document category as keyword
          if (doc.analysis.category && doc.analysis.category.primary) {
            const category = doc.analysis.category.primary.toLowerCase();
            if (!keywordMap[category]) {
              keywordMap[category] = { investigations: [], documents: [] };
            }
            if (!keywordMap[category].documents.includes(docId)) {
              keywordMap[category].documents.push(docId);
            }
          }
        }
      });
    }

    return keywordMap;
  };

  const learnPatterns = () => {
    // Learn common query patterns
    return {
      caseQuery: /case(s)?\s+(on|about|related to|involving)\s+(\w+)/i,
      locationQuery: /cases?\s+(in|from|at)\s+(\w+)/i,
      statusQuery: /(open|closed|active)\s+cases?/i,
      personQuery: /cases?\s+(involving|with|about)\s+(\w+\s+\w+)/i
    };
  };

  // --- MISSING FUNCTION STUBS TO FIX ESLINT ERRORS ---

  // Trains the NLP model (stub)
  function trainNLPModel() {
    // You can call trainInvestigationModel() or add your own logic here
    // For now, just call trainInvestigationModel if available
    if (typeof trainInvestigationModel === 'function') {
      trainInvestigationModel();
    }
  }

  // Trains the NLP model with example data (stub)
  function trainNLPWithExamples() {
    // Add your example-based training logic here if needed
  }

  // Determines if a message should trigger an internet search (stub)
  function shouldSearchInternet(message) {
    // Simple keyword-based check; customize as needed
    if (!message) return false;
    const searchKeywords = ['search', 'find', 'lookup', 'google', 'news', 'web', 'internet'];
    return searchKeywords.some(kw => message.toLowerCase().includes(kw));
  }

  // Processes a user message (improved)
  function processUserMessage(message) {
    const lowerMsg = message.trim().toLowerCase();
    // Greeting (expanded to include 'how are you' and similar)
    if (/^(hi|hello|hey|greetings|good (morning|afternoon|evening))\b|\bhow (are you|are you doing|is it going|are things)\b/.test(lowerMsg)) {
      const reply = knowledgeBase.greetings[Math.floor(Math.random() * knowledgeBase.greetings.length)];
      // Add a friendly bot-specific response for 'how are you' style
      if (/how (are you|are you doing|is it going|are things)/.test(lowerMsg)) {
        setMessages(prev => [...prev, { text: "I'm Okay, thanks asking!", sender: 'bot' }]);
      } else {
        setMessages(prev => [...prev, { text: reply, sender: 'bot' }]);
      }
      return;
    }
    // Farewell
    if (/\b(bye|goodbye|see you|farewell)\b/.test(lowerMsg)) {
      const reply = knowledgeBase.farewells[Math.floor(Math.random() * knowledgeBase.farewells.length)];
      setMessages(prev => [...prev, { text: reply, sender: 'bot' }]);
      return;
    }
    // Thanks
    if (/\b(thank(s| you)?|thx|appreciate)\b/.test(lowerMsg)) {
      const reply = knowledgeBase.thanks[Math.floor(Math.random() * knowledgeBase.thanks.length)];
      setMessages(prev => [...prev, { text: reply, sender: 'bot' }]);
      return;
    }
    // What time is it?
    if (/\b(time|date)\b/.test(lowerMsg)) {
      const now = new Date();
      setMessages(prev => [...prev, { text: `It's ${now.toLocaleString()}.`, sender: 'bot' }]);
      return;
    }
    // What can you do?
    if (/\b(what can you do|your capabilities|help|how can you help)\b/.test(lowerMsg)) {
      setMessages(prev => [...prev, {
        text: `I can help you search and analyze case files, answer questions about investigations, provide statistics, analyze documents, and have a general conversation. Try asking: "Which areas have the most cases?" or "Show me cases in Kampala."`,
        sender: 'bot'
      }]);
      return;
    }
    // Show all cases in a specific location (e.g., Kampala)
    const locationMatch = lowerMsg.match(/(?:show|list|display)?\s*(?:all\s*)?(?:cases?|incidents?|files?)\s*(?:in|from|at)\s+([a-zA-Z\s]+)/);
    if (locationMatch && locationMatch[1]) {
      const location = locationMatch[1].trim().toLowerCase();
      let foundCases = [];
      if (data && data.allInvestigations) {
        foundCases = data.allInvestigations.filter(inv =>
          inv.location && inv.location.trim().toLowerCase().includes(location)
        );
      }
      if (foundCases.length > 0) {
        const caseList = foundCases.map((inv, idx) =>
          `${idx + 1}. [${inv.intelType || 'Case'}] ${inv.desc ? inv.desc.substring(0, 80) : 'No description'} (Status: ${inv.status || 'N/A'})` +
          (inv.suspects && inv.suspects.length ? ` | Suspects: ${inv.suspects.join(', ')}` : '') +
          (inv.victims && inv.victims.length ? ` | Victims: ${inv.victims.join(', ')}` : '')
        ).join('\n');
        setMessages(prev => [...prev, {
          text: `Here are the cases in ${location.charAt(0).toUpperCase() + location.slice(1)}:\n${caseList}`,
          sender: 'bot'
        }]);
      } else {
        setMessages(prev => [...prev, {
          text: `No cases found in ${location.charAt(0).toUpperCase() + location.slice(1)}.`,
          sender: 'bot'
        }]);
      }
      return;
    }
    // Statistics: Which areas have the most cases?
    if (/\b(areas?|locations?|places?)\b.*\b(most|highest)\b.*\b(cases?|incidents?)\b/.test(lowerMsg) || /\bwhich areas? has? the most cases?\b/.test(lowerMsg)) {
      if (!trainedModel || !trainedModel.entities || !trainedModel.entities.locations) {
        setMessages(prev => [...prev, { text: "Sorry, I don't have enough data to answer that yet.", sender: 'bot' }]);
        return;
      }
      // Count cases per location
      const locationCounts = {};
      if (data && data.allInvestigations) {
        data.allInvestigations.forEach(inv => {
          if (inv.location) {
            const loc = inv.location.trim();
            locationCounts[loc] = (locationCounts[loc] || 0) + 1;
          }
        });
      }
      // Sort locations by count
      const sorted = Object.entries(locationCounts).sort((a, b) => b[1] - a[1]);
      if (sorted.length === 0) {
        setMessages(prev => [...prev, { text: "No case data available to analyze locations.", sender: 'bot' }]);
        return;
      }
      const top = sorted.slice(0, 5).map(([loc, count], i) => `${i + 1}. ${loc} (${count} cases)`).join('\n');
      setMessages(prev => [...prev, {
        text: `The areas with the most cases are:\n${top}`,
        sender: 'bot'
      }]);
      return;
    }
    // Show all documents (triggered by user query)
    if (/^(show|list|display)( me)? (all )?(documents|case reports|case documents|reports|files)\b/.test(lowerMsg) || /\bshow documents\b/.test(lowerMsg)) {
      showAllDocuments();
      return;
    }
    // Fallback: try to find a similar context
    const nlpResult = nlp(message);
    const similar = nlpResult.findSimilarContext && nlpResult.findSimilarContext();
    if (similar && similar.similarity > 0.5) {
      setMessages(prev => [...prev, { text: similar.response, sender: 'bot' }]);
      return;
    }
    // Default fallback
    setMessages(prev => [...prev, {
      text: `I'm not sure what you're asking. You can try:\n- Asking about case files (e.g., 'Show me cases in Kampala')\n- Asking general questions (e.g., 'What time is it?')\n- Asking about my capabilities (e.g., 'What can you do?')\n- Asking about case statistics (e.g., 'Which areas have the most cases?')`,
      sender: 'bot'
    }]);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleAudioTranscript = () => {
    // Check for audio transcript from AudioRecorder component
    const audioTranscript = sessionStorage.getItem('audioTranscript');
    if (audioTranscript) {
      // Add the transcript to the chat as a user message
      setMessages((prevMessages) => [...prevMessages, {
        text: `Analyze this transcript: ${audioTranscript}`,
        sender: 'user'
      }]);

      // Process the transcript directly with our analysis function
      const response = handleTranscriptAnalysis(`Analyze this transcript: ${audioTranscript}`);

      // Format and display response
      const formattedText = response.split('\n').map((line, idx) => {
        if (line.startsWith('**')) {
          return <h3 key={`line-${idx}`} style={{ marginTop: '15px', marginBottom: '5px' }}>{line.replace(/\*\*/g, '')}</h3>;
        } else if (line.startsWith('-')) {
          return <li key={`line-${idx}`} style={{ marginLeft: '20px' }}>{line.substring(2)}</li>;
        } else if (line.trim() === '') {
          return <br key={`line-${idx}`} />;
        } else {
          return <p key={`line-${idx}`}>{line}</p>;
        }
      });

      const formattedResponse = (
        <div className="transcript-analysis">
          {formattedText}
        </div>
      );

      // Add AI response to chat with a slight delay to show typing effect
      setTimeout(() => {
        setMessages((prevMessages) => [...prevMessages, {
          text: formattedResponse,
          sender: 'bot'
        }]);
      }, 1000);

      // Clear the transcript from sessionStorage
      sessionStorage.removeItem('audioTranscript');

      // Also check for current transcript
      sessionStorage.removeItem('currentTranscript');
    }
  };

  // Listen for real-time transcription updates
  useEffect(() => {
    // Function to handle transcript updates
    const handleTranscriptUpdate = (event) => {
      const { transcript, isTranscribing } = event.detail;
      setLiveTranscript(transcript);
      setIsReceivingTranscript(isTranscribing);

      // Update the input field with the current transcript
      if (inputRef.current && isTranscribing) {
        inputRef.current.value = `Analyzing transcript: ${transcript}`;
      }
    };

    // Add event listener for transcript updates
    window.addEventListener('transcriptUpdate', handleTranscriptUpdate);

    // Check for current transcript in session storage
    const currentTranscript = sessionStorage.getItem('currentTranscript');
    if (currentTranscript) {
      setLiveTranscript(currentTranscript);
      setIsReceivingTranscript(true);

      if (inputRef.current) {
        inputRef.current.value = `Analyzing transcript: ${currentTranscript}`;
      }
    }

    // Clean up event listener
    return () => {
      window.removeEventListener('transcriptUpdate', handleTranscriptUpdate);
    };
  }, []);

  // Auto-scroll to bottom when messages change (current chat)
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages, isReceivingTranscript]);

  // Auto-scroll to bottom when viewing an old chat
  useEffect(() => {
    if (oldChatAreaRef.current) {
      oldChatAreaRef.current.scrollTop = oldChatAreaRef.current.scrollHeight;
    }
  }, [selectedOldChat]);

  useEffect(() => {
    // Train NLP model when component mounts
    trainNLPModel();

    // Also train with examples to improve follow-up question handling
    trainNLPWithExamples();

    console.log("NLP model trained with examples for improved follow-up question handling");

    // Add welcome greeting when component mounts
    if (messages.length === 0) {
      setMessages([{
        text: "Hello there, I am your intelligent investigation assistant. How can I help you today?",
        sender: 'bot'
      }]);
    }

    // Handle audio transcript if present
    handleAudioTranscript();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, messages.length]);

  // Save current chat to old chats when clearing
  function startNewChat() {
    if (messages.length > 1) { // >1 to account for greeting
      const stored = localStorage.getItem('old_chats');
      const chats = stored ? JSON.parse(stored) : [];
      chats.unshift({
        id: Date.now(),
        date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        messages: messages
      });
      localStorage.setItem('old_chats', JSON.stringify(chats));
      setOldChats(chats);
    }
    setSelectedOldChat(null);
    setMessages([{
        text: "Hello there, I am your intelligent investigation assistant. How can I help you today?",
      sender: 'bot'
    }]);
  }

  function clearBotMessages() {
    if (messages.length > 0) {
      const stored = localStorage.getItem('old_chats');
      const chats = stored ? JSON.parse(stored) : [];
      chats.unshift({
        id: Date.now(),
        date: new Date().toLocaleString(),
        messages: messages
      });
      localStorage.setItem('old_chats', JSON.stringify(chats));
      setOldChats(chats);
    }
    setMessages(prevMessages => prevMessages.filter(msg => msg.sender !== 'bot'));
  }

  // This function is used by the parent component to submit messages
  const handleMessageSubmit = async (message) => {
    // Add user message to chat
    setMessages((prevMessages) => [...prevMessages, { text: message, sender: 'user' }]);

    // Show typing indicator
    setMessages((prevMessages) => [...prevMessages, {
      text: <div className="typing-indicator"><span></span><span></span><span></span></div>,
      sender: 'bot',
      isTyping: true
    }]);

    // Check if we should search the internet (search path unchanged)
    if (shouldSearchInternet(message)) {
      setTimeout(() => {
        setMessages((prevMessages) => prevMessages.filter(msg => !msg.isTyping));
        processSearchQuery(message);
      }, 800);
      return;
    }

    // Check if user is searching for a person in our knowledge base
    if (isPersonSearchQuery(message)) {
      const nameQuery = extractNameFromQuery(message);
      try {
        const results = await searchPeople(nameQuery);
        if (results && results.length > 0) {
          setMessages((prevMessages) => {
            const filtered = prevMessages.filter(msg => !msg.isTyping);
            return [...filtered, {
              text: <PersonSearchResults query={nameQuery} results={results} />,
              sender: 'bot'
            }];
          });
          return;
        }
        // If no structured results, we continue to AI chat for an intelligent response
        console.log('No structured results for person search, continuing to AI chat');
      } catch (err) {
        console.warn('People search failed, falling back to AI chat:', err);
      }
    }

    // Use Ollama for chat (with fallback to rule-based)
    try {
      const context = buildKnowledgeContext(data);
      const history = messages
        .filter(m => m.sender && m.text && !m.isTyping && !m.isLoading)
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: typeof m.text === 'string' ? m.text : (m.text?.props?.children || '[attachment]')
        }))
        .concat([{ role: 'user', content: message }]);

      const response = await callOllamaChat({
        messages: history,
        systemContext: context,
        stream: false
      });

      setMessages((prevMessages) => {
        const filtered = prevMessages.filter(msg => !msg.isTyping);
        return [...filtered, { text: response, sender: 'bot' }];
      });
    } catch (err) {
      console.warn('Ollama unavailable, using fallback:', err.message);
      setOllamaAvailable(false);
      setMessages((prevMessages) => prevMessages.filter(msg => !msg.isTyping));
      processUserMessage(message);
    }
  };

  // Function to handle search queries specifically
  const processSearchQuery = async (message) => {
    try {
      // Show loading state
      setMessages((prevMessages) => [...prevMessages, {
        text: <div className="loading-search">Searching online...</div>,
        sender: 'bot',
        isLoading: true
      }]);

      // Perform the search
      const searchResponse = await searchInternet(message);

      // Remove loading indicator
      setMessages((prevMessages) => prevMessages.filter(msg => !msg.isLoading));

      // Format the response
      let formattedResponse;

      if (typeof searchResponse === 'object' && (searchResponse.internetResults || searchResponse.socialMediaResults)) {
        formattedResponse = (
          <div>
            <p className='your-search'>Here's what I found for "{searchResponse.query || 'your search'}":</p>

            {/* Display social media results if available */}
            {searchResponse.socialMediaResults && searchResponse.socialMediaResults.length > 0 && (
              <div className="social-media-results">
                <h3 className="section-title">Social Media Profiles</h3>
                <div className="social-media-grid">
                  {searchResponse.socialMediaResults.map((result, index) => (
                    <div className="social-media-card" key={index} style={{ borderColor: result.color }}>
                      <h4>{result.title}</h4>
                      <p>{result.snippet}</p>
                      <a
                        href={result.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-media-link"
                        style={{ backgroundColor: result.color }}
                      >
                        <i className={result.icon}></i> Search on {result.platform}
                      </a>
                    </div>
                  ))}
                </div>
                <p className="social-media-disclaimer">Note: These are search links that will help you find profiles, not direct links to specific profiles.</p>
              </div>
            )}

            {/* Display internet/news results */}
            {searchResponse.internetResults && searchResponse.internetResults.length > 0 ? (
              <div className="news-results">
                <h3 className="section-title">News & Web Results</h3>
                {searchResponse.internetResults.map((result, index) => (
                  <div className="internet-result" key={index}>
                    <h4>{result.title}</h4>
                    <p>{result.snippet}</p>
                    <div className="result-footer">
                      <span className="result-source">{result.source}</span>
                      <a href={result.link} target="_blank" rel="noopener noreferrer">Read more</a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !searchResponse.socialMediaResults && (
                <div className="no-results">
                  <p>No results found. Try rephrasing your search or using more general terms.</p>
                </div>
              )
            )}
          </div>
        );
      } else {
        // Handle string response or error
        formattedResponse = <p>{typeof searchResponse === 'string' ? searchResponse : "Sorry, I couldn't find any results for your search."}</p>;
      }

      // Add the formatted response to the chat
      setMessages((prevMessages) => [...prevMessages, {
        text: formattedResponse,
        sender: 'bot',
        isSearchResult: true,
        searchData: searchResponse // Store the original search data for persistence
      }]);

      // Update conversation context
      setConversationContext(prevContext => {
        return {
          ...prevContext,
          lastQuery: message,
          lastResponse: "Search results for: " + (searchResponse.query || message)
        };
      });

      // Focus input field for next question
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (error) {
      console.error("Error processing search query:", error);
      setMessages((prevMessages) => [...prevMessages, {
        text: <p>Sorry, I encountered an error while searching. Please try again later.</p>,
        sender: 'bot'
      }]);
    }
  };

  // Function to handle transcript analysis
  const handleTranscriptAnalysis = (transcript) => {
    // Extract the actual transcript from the message
    const transcriptText = transcript.replace(/analyze this transcript:?:?\s*/i, '').trim();

    if (!transcriptText || transcriptText.length < 5) {
      return "The transcript appears to be empty or too short to analyze.";
    }

    // Analyze the transcript content
    const sentences = transcriptText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = transcriptText.split(/\s+/).filter(w => w.trim().length > 0);

    // Extract potential names (capitalized words not at the beginning of sentences)
    const potentialNames = [];
    const wordRegex = /\b[A-Z][a-z]+\b/g;
    let match;
    while ((match = wordRegex.exec(transcriptText)) !== null) {
      // Skip words at the beginning of sentences
      const prevChar = transcriptText.charAt(Math.max(0, match.index - 1));
      if (prevChar !== '' && prevChar !== '.' && prevChar !== '!' && prevChar !== '?') {
        potentialNames.push(match[0]);
      }
    }

    // Basic sentiment analysis
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'happy', 'pleased', 'love', 'like', 'enjoy'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'sad', 'unhappy', 'hate', 'dislike', 'poor', 'wrong'];

    let positiveCount = 0;
    let negativeCount = 0;

    words.forEach(word => {
      const lowerWord = word.toLowerCase();
      if (positiveWords.includes(lowerWord)) positiveCount++;
      if (negativeWords.includes(lowerWord)) negativeCount++;
    });

    let sentiment = "neutral";
    if (positiveCount > negativeCount) sentiment = "positive";
    if (negativeCount > positiveCount) sentiment = "negative";

    // Investigative checks
    const contextKeywords = ['context', 'background', 'situation', 'details', 'intent', 'purpose', 'reason'];
    const intentKeywords = ['intent', 'plan', 'purpose', 'goal', 'motive', 'motivation'];
    const criminalKeywords = ['crime', 'criminal', 'illegal', 'theft', 'assault', 'murder', 'robbery', 'fraud', 'arson', 'homicide', 'felony', 'misdemeanor', 'offense', 'charge', 'arrest', 'conviction', 'suspect', 'victim', 'witness'];
    const firearmKeywords = ['firearm', 'gun', 'rifle', 'pistol', 'shotgun', 'weapon', 'handgun', 'revolver', 'ammunition', 'bullet'];

    // Known cases (from investigations in localStorage)
    let knownCases = [];
    try {
      const investigations = localStorage.getItem('investigations');
      if (investigations) {
        knownCases = JSON.parse(investigations).map(inv => inv.desc?.toLowerCase() || '').filter(Boolean);
      }
    } catch (e) { }

    // Helper to check if any keyword is present
    const containsKeyword = (keywords) => keywords.some(kw => transcriptText.toLowerCase().includes(kw));

    // Checks
    const hasContext = containsKeyword(contextKeywords);
    const hasIntent = containsKeyword(intentKeywords);
    const hasCriminal = containsKeyword(criminalKeywords);
    const hasFirearm = containsKeyword(firearmKeywords);
    const matchesKnownCase = knownCases.some(desc => desc && transcriptText.toLowerCase().includes(desc));

    // Build investigative feedback
    let investigativeNotes = [];
    if (!hasContext) investigativeNotes.push('⚠️ Missing context or background information.');
    if (!hasIntent) investigativeNotes.push('⚠️ No clear intent or motivation detected.');
    if (!hasCriminal) investigativeNotes.push('⚠️ No mention of criminal activity or relevant legal terms.');
    if (!hasFirearm) investigativeNotes.push('⚠️ No mention of firearms or weapons.');
    if (!matchesKnownCase) investigativeNotes.push('⚠️ No reference to known cases in your database.');

    if (investigativeNotes.length === 0) {
      investigativeNotes.push('✅ Transcript contains context, intent, and relevant investigative details.');
    }

    // Actionable suggestions
    let suggestions = [];
    if (!hasContext || !hasIntent || !hasCriminal) {
      suggestions.push('• Consider providing more context, intent, or details about criminal activity.');
    }
    if (!hasFirearm) {
      suggestions.push('• If relevant, mention any weapons or firearms involved.');
    }
    if (!matchesKnownCase) {
      suggestions.push('• Reference a known case or provide a case number for better analysis.');
    }

    // Generate analysis response
    return `I've analyzed the transcript and here's what I found:

**Transcript Summary:**
- Length: ${words.length} words, ${sentences.length} sentences
- Sentiment: ${sentiment} (${positiveCount} positive words, ${negativeCount} negative words)
${potentialNames.length > 0 ? `- Potential names mentioned: ${[...new Set(potentialNames)].join(', ')}` : ''}

**Content Analysis:**
${transcriptText.length > 200
        ? `The transcript appears to be a ${sentiment} conversation${potentialNames.length > 0 ? ' mentioning ' + [...new Set(potentialNames)].join(', ') : ''}.`
        : `"${transcriptText}"`}

**Investigative Notes:**
${investigativeNotes.map(note => '- ' + note).join('\n')}

${suggestions.length > 0 ? '**Suggestions:**\n' + suggestions.map(s => '- ' + s).join('\n') : ''}

I can provide more detailed analysis if you have specific questions about this transcript.`;
  };

  // Commented out legacy code
  // const formatCaseDetails = (caseData) => {
  //   return `Case ID: ${caseData.id}\nIntel Type: ${caseData.intelType}\nPriority: ${caseData.priority}\nDate Created: ${caseData.dateCreated}\nPosted By: ${caseData.postedBy}\nVictims: ${caseData.victims.join(', ')}\nStatus: ${caseData.status}\nLocation: ${caseData.location}\nDescription: ${caseData.desc}\nSuspects: ${caseData.suspects.join(', ')}`;
  // };

  // --- STUBS TO FIX ESLINT ERRORS ---
  // Simulate an internet search (stub)
  async function searchInternet(message) {
    // Replace with real search logic or API call
    return {
      query: message,
      internetResults: [],
      socialMediaResults: []
    };
  }

  // Clear only bot messages from the chat (stub)
  function clearBotMessages() {
    setMessages(prevMessages => prevMessages.filter(msg => msg.sender !== 'bot'));
  }

  // Handler to view a document (appends full content to chat)
  function handleViewDocument(doc, idx) {
    const details = (
      <div className="document-card-full">
        <h3>{doc.name || doc.title || `Document #${idx + 1}`}</h3>
        <p><strong>Category:</strong> {inferDocumentCategoryNLP(doc)}</p>
        <p><strong>Description:</strong> {doc.desc || (doc.analysis && doc.analysis.summary && doc.analysis.summary.description) || 'No description.'}</p>
        <div style={{ marginTop: 12 }}>
          <strong>Full Content:</strong>
          <div style={{ background: '#f7f7f8', borderRadius: 8, padding: 12, marginTop: 6, fontSize: 14, whiteSpace: 'pre-wrap' }}>{doc.content || 'No content available.'}</div>
        </div>
      </div>
    );
    setMessages(prevMessages => [
      ...prevMessages,
      { text: details, sender: 'bot' }
    ]);
  }

  // Show all documents (now displays actual documents with view button)
  function showAllDocuments() {
    let docs = [];
    try {
      const savedDocs = localStorage.getItem('case_documents');
      if (savedDocs) {
        docs = JSON.parse(savedDocs);
      }
    } catch (e) { }
    setDocuments(docs);
    if (!docs || docs.length === 0) {
      setMessages(prevMessages => [
        ...prevMessages,
        { text: 'No documents found. Please upload case reports or documents first.', sender: 'bot' }
      ]);
      return;
    }
    // Format document list for chat
    const docList = (
      <div className="documents-list">
        <h3>Uploaded Case Documents</h3>
        <div className="documents-grid">
          {docs.map((doc, idx) => (
            <div className="document-card" key={doc.id || idx}>
              <h4>{doc.name || doc.title || `Document #${idx + 1}`}</h4>
              <p><strong>Category:</strong> {inferDocumentCategoryNLP(doc)}</p>
              <p>{doc.desc || (doc.analysis && doc.analysis.summary && doc.analysis.summary.description) || (doc.content && doc.content.slice(0, 120)) || 'No description.'}</p>
              <button className="view-document-btn" onClick={() => handleViewDocument(doc, idx)} style={{ marginTop: 10 }}>View</button>
            </div>
          ))}
        </div>
      </div>
    );
    setMessages(prevMessages => [
      ...prevMessages,
      { text: docList, sender: 'bot' }
    ]);
  }

  const renderFileSelector = () => {
    if (!showFileSelector) return null;
    
    let docs = [];
    try {
      const savedDocs = localStorage.getItem('case_documents');
      if (savedDocs) docs = JSON.parse(savedDocs);
    } catch (e) {}

    return (
      <div className="chat-modal-overlay" onClick={() => setShowFileSelector(false)} style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)'
      }}>
        <div className="chat-modal-content" onClick={e => e.stopPropagation()} style={{
          backgroundColor: 'white', borderRadius: '16px', width: '90%', maxWidth: '500px',
          maxHeight: '70%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Select Document to Analyze</h3>
            <button onClick={() => setShowFileSelector(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
          </div>
          <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {docs.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>No documents found in hub.</p>
            ) : (
              docs.map((doc, idx) => (
                <div key={doc.id || idx} onClick={() => {
                  setShowFileSelector(false);
                  handleMessageSubmit(`Analyze this document: ${doc.name || doc.title || 'Selected Document'}`);
                }} style={{
                  padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', marginBottom: '8px',
                  border: '1px solid #e2e8f0', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '12px'
                }} className="file-item-hover">
                  <i className="fas fa-file-alt" style={{ color: '#3b82f6' }}></i>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{doc.name || doc.title}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{doc.category || 'Uncategorized'}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // Split Layout UI
  return (
    <div className="ai-container">
      <div className="app-layout">
        {/* Main Chat Area */}
        <div className='main-chat-area'>
          {/* We no longer use activeTab, just show the selected old chat or current chat */}
          {selectedOldChat ? (
            <div className="chatbot-messages" ref={oldChatAreaRef}>
              <div className="back-nav-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: '0 10px' }}>
                <button onClick={() => setSelectedOldChat(null)} className="back-to-list" style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg> Back to current chat
                </button>
                <h3 style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Archived Chat ({selectedOldChat.date})</h3>
              </div>
              {selectedOldChat.messages.map((message, index) => (
                <div key={index} className={`chat-item ${message.sender}`}>
                  {message.sender === 'bot' && (
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 4, flexShrink: 0, boxShadow: '0 2px 5px rgba(59,130,246,0.3)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>
                    </div>
                  )}
                  <div className="message-content">
                    {message.text}
                  </div>
                  {message.sender === 'user' && (
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: '#f1f5f9', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 12, marginTop: 4, flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="chatbot-messages" ref={chatAreaRef}>
              {/* Show empty state gracefully if only the greeting is present or no user messages */}
              {messages.filter(m => m.sender === 'user').length === 0 && (
                <div className='empty-div'>
                  <h1 className='empty-chat'>Welcome to IIIMS-GPT</h1>
                  <h1 className='empty-chat-text-two'>Get started by giving IIIMS-GPT a task and Chat can do the rest. Not sure where to start?</h1>
                  <div className='try-these'>
                    <div className='try-card' onClick={() => handleMessageSubmit("Search for case files with specific criteria")}>
                      <div className="try-icon"><i className="fas fa-search"></i></div>
                      <span className="try-text">Search for cases</span>
                      <div className="try-plus">+</div>
                    </div>
                    <div className='try-card' onClick={() => handleMessageSubmit("Analyze document contents")}>
                      <div className="try-icon" style={{ background: '#e0e7ff', color: '#4f46e5' }}><i className="fas fa-file-alt"></i></div>
                      <span className="try-text">Analyze documents</span>
                      <div className="try-plus">+</div>
                    </div>
                    <div className='try-card' onClick={() => handleMessageSubmit("Show me all cases in Kampala")}>
                      <div className="try-icon" style={{ background: '#dcfce7', color: '#16a34a' }}><i className="fas fa-map-marker-alt"></i></div>
                      <span className="try-text">Cases in Kampala</span>
                      <div className="try-plus">+</div>
                    </div>
                    <div className='try-card' onClick={() => handleMessageSubmit("What can you do?")}>
                      <div className="try-icon" style={{ background: '#fce7f3', color: '#db2777' }}><i className="fas fa-robot"></i></div>
                      <span className="try-text">What can you do?</span>
                      <div className="try-plus">+</div>
                    </div>
                  </div>
                </div>
              )}
              {messages.map((message, index) => (
                <div key={index} className={`chat-item ${message.sender}`}>
                  {message.sender === 'bot' && (
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 4, flexShrink: 0, boxShadow: '0 2px 5px rgba(59,130,246,0.3)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>
                    </div>
                  )}
                  <div className="message-content">
                    {message.text}
                  </div>
                  {message.sender === 'user' && (
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: '#f1f5f9', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 12, marginTop: 4, flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isReceivingTranscript && (
            <div className="live-transcript-display">
              <h3>Live Transcript</h3>
              <div className="live-transcript-text">
                {liveTranscript || "Waiting for speech..."}
                <span className="cursor-blink">|</span>
              </div>
            </div>
          )}

          {/* Removed chat-controls from here, now inside input area */}

          {/* --- Ai Input Field starts here INSIDE main-chat-area --- */}
          <div className='ai-input-field'>
            <div className="input-container">
              <textarea
                ref={inputRef}
                className='user-query'
                placeholder="Summarize the latest..."
                rows="1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (e.target.value.trim()) {
                      handleMessageSubmit(e.target.value);
                      e.target.value = '';
                    }
                  }
                }}
                onChange={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                }}
              />
              <button
                className="send-button"
                onClick={() => {
                  if (inputRef.current && inputRef.current.value.trim()) {
                    handleMessageSubmit(inputRef.current.value);
                    inputRef.current.value = '';
                    inputRef.current.style.height = 'auto';
                  }
                }}
              >
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Internal Input Toolbar */}
              <div className="input-toolbar">
                <div className="toolbar-left">
                  <button className="toolbar-btn" onClick={() => setShowFileSelector(true)}><i className="fas fa-paperclip"></i> Attach</button>
                  <div className="toolbar-divider"></div>
                  <button className="toolbar-btn" onClick={() => handleMessageSubmit("Analyze recent voice transcripts")}><i className="fas fa-microphone"></i> Voice Message</button>
                  <div className="toolbar-divider"></div>
                  <button className="toolbar-btn" onClick={() => handleMessageSubmit("Show available analysis prompts")}><i className="fas fa-search"></i> Browse Prompts</button>
                  <div className="toolbar-divider"></div>
                  <button className="toolbar-btn" style={{ color: '#3b82f6' }} onClick={startNewChat}><i className="fas fa-plus"></i> New Chat</button>
                </div>
                <div className="toolbar-right">
                  <span className="char-count">20 / 3,000</span>
                </div>
              </div>
            </div>

            <div className="disclaimer-text">
              IIIMS-GPT may generate inaccurate information about people, places, or facts. Model: IIIMS-GPT v1.3
            </div>
          </div> {/* Closes ai-input-field */}
          {renderFileSelector()}
        </div> {/* Closes main-chat-area */}

        {/* Right Sidebar */}
        <div className="right-sidebar">
          <div className="sidebar-header">
            <h2>Previous Chats</h2>
            <button className="new-chat-btn" onClick={() => {
              // Save current chat if there is one
              if (messages.length > 1) { // >1 to account for greeting
                const stored = localStorage.getItem('old_chats');
                const chats = stored ? JSON.parse(stored) : [];
                chats.unshift({
                  id: Date.now(),
                  date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  messages: messages
                });
                localStorage.setItem('old_chats', JSON.stringify(chats));
                setOldChats(chats);
              }
              setSelectedOldChat(null);
              setMessages([{
                text: "Hello! I am called Dixon, your intelligent investigation assistant. How can I help you today?",
                sender: 'bot'
              }]);
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>

          <div className="history-list">
            {oldChats.length === 0 ? (
              <div className="empty-history">No previous chats</div>
            ) : (
              oldChats.map(chat => (
                <div key={chat.id} className={`history-card ${selectedOldChat && selectedOldChat.id === chat.id ? 'active' : ''}`} onClick={() => setSelectedOldChat(chat)}>
                  <h4>Chat from {chat.date.split(' ')[0]}</h4>
                  <p className="history-preview">
                    {chat.messages.length > 1 ? chat.messages[1].text.substring(0, 40) + '...' : 'Empty chat'}
                  </p>
                  <div className="card-radio"></div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;

// Helper: Infer document category from content, description, and keywords
const CATEGORY_KEYWORDS = {
  Financial: ["fraud", "embezzlement", "theft", "bank", "transaction", "money", "finance", "bribery", "counterfeit", "scam"],
  Social: ["missing person", "abduction", "kidnapping", "domestic", "family", "child", "youth", "elderly", "abuse", "runaway"],
  Legal: ["arrest", "charge", "court", "warrant", "conviction", "sentence", "prosecution", "legal", "law", "trial"],
  Medical: ["injury", "hospital", "medical", "doctor", "clinic", "ambulance", "health", "disease", "mental", "trauma"],
  Violent: ["assault", "homicide", "murder", "robbery", "armed", "weapon", "shooting", "stabbing", "violence", "attack"],
  Narcotics: ["drug", "narcotic", "trafficking", "substance", "cocaine", "heroin", "marijuana", "meth", "seized drugs"],
  Human: ["human trafficking", "smuggling", "exploitation", "forced labor", "prostitution", "victim", "rescued victims"],
  Cyber: ["cyber", "phishing", "hacking", "computer", "online", "internet", "data breach", "malware", "ransomware"],
  Property: ["burglary", "theft", "stolen", "property", "vandalism", "break-in", "trespass", "arson", "fire"],
  Other: []
};

function inferDocumentCategory(doc) {
  // Priority: explicit category, then analysis, then content/desc/keywords
  if (doc.category && doc.category !== 'Other') return doc.category;
  if (doc.analysis && doc.analysis.category && doc.analysis.category.primary && doc.analysis.category.primary !== 'Other') {
    return doc.analysis.category.primary;
  }
  const text = [doc.name, doc.title, doc.desc, doc.content]
    .filter(Boolean)
    .join(' ') // join all text fields
    .toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (cat === 'Other') continue;
    for (const kw of keywords) {
      if (text.includes(kw)) return cat;
    }
  }
  // Try keywords array if present
  if (doc.analysis && doc.analysis.keywords && Array.isArray(doc.analysis.keywords)) {
    for (const kw of doc.analysis.keywords) {
      for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (cat === 'Other') continue;
        if (keywords.some(k => kw.toLowerCase().includes(k))) return cat;
      }
    }
  }
  return 'Other';
}

// Helper: Infer document category using NLP (compromise)
function inferDocumentCategoryNLP(doc) {
  const text = [doc.name, doc.title, doc.desc, doc.content]
    .filter(Boolean)
    .join(' ');
  if (!text || text.length < 10) return 'Other';
  const nlpResult = nlpLib(text);
  // Extract topics and nouns
  const topics = nlpResult.topics().out('array').map(t => t.toLowerCase());
  const nouns = nlpResult.nouns().out('array').map(n => n.toLowerCase());
  // Merge topics and nouns for matching
  const allTerms = [...topics, ...nouns];
  // Map terms to categories
  const CATEGORY_MAP = {
    Financial: ["fraud", "bank", "transaction", "money", "finance", "bribery", "counterfeit", "scam", "embezzlement"],
    Social: ["missing person", "abduction", "kidnapping", "domestic", "family", "child", "youth", "elderly", "abuse", "runaway"],
    Legal: ["arrest", "charge", "court", "warrant", "conviction", "sentence", "prosecution", "legal", "law", "trial"],
    Medical: ["injury", "hospital", "medical", "doctor", "clinic", "ambulance", "health", "disease", "mental", "trauma"],
    Violent: ["assault", "homicide", "murder", "robbery", "armed", "weapon", "shooting", "stabbing", "violence", "attack"],
    Narcotics: ["drug", "narcotic", "trafficking", "substance", "cocaine", "heroin", "marijuana", "meth", "seized drugs"],
    Human: ["human trafficking", "smuggling", "exploitation", "forced labor", "prostitution", "victim", "rescued victims"],
    Cyber: ["cyber", "phishing", "hacking", "computer", "online", "internet", "data breach", "malware", "ransomware"],
    Property: ["burglary", "theft", "stolen", "property", "vandalism", "break-in", "trespass", "arson", "fire"]
  };
  for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
    if (allTerms.some(term => keywords.includes(term))) return cat;
  }
  // Fallback: use first topic as category if it's not generic
  if (topics.length && !["report", "case", "document", "incident"].includes(topics[0])) {
    return topics[0].charAt(0).toUpperCase() + topics[0].slice(1);
  }
  return 'Other';
}
