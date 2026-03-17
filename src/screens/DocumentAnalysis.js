import React, { useState, useEffect, useCallback } from 'react';
import './DocumentAnalysis.css';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import nlp from 'compromise';
import nlpLib from 'compromise';
import { groupBy, debounce } from 'lodash';
import axios from 'axios';
import PrisonData from '../TestDataPoint/PrisonData';
import ArrestData from '../TestDataPoint/ArrestData';
import IntelData from '../TestDataPoint/Intel';
import ImageData from '../TestDataPoint/ImageData';
import { findDocumentDataPointRelations } from '../services/documentRelationsService';
import { callOllamaChat, checkOllamaConnection, getOllamaStatus } from '../services/ollamaService';
import { Hub } from '../services/CentralHubService';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();


const DocumentAnalysis = () => {
  const [documents, setDocuments] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [compareDocument, setCompareDocument] = useState(null);
  const [viewMode, setViewMode] = useState('summary'); // 'summary', 'detail', or 'compare'
  const [categories, setCategories] = useState({
    'Social': { color: '#4299e1', count: 0 },
    'Financial': { color: '#48bb78', count: 0 },
    'Legal': { color: '#ed8936', count: 0 },
    'Medical': { color: '#9f7aea', count: 0 },
    'Other': { color: '#718096', count: 0 }
  });
  // --- Dynamic crime-type tagging and filtering ---
const crimeTypeColors = [
  '#e53e3e', '#ed8936', '#f6ad55', '#ecc94b', '#48bb78', '#38b2ac', '#4299e1', '#9f7aea', '#ed64a6', '#718096'
];
const [dynamicCategories, setDynamicCategories] = useState({});

// Allowed crime categories for grouping/filtering
const ALLOWED_CATEGORIES = [
  'Social', 'Financial', 'Legal', 'Criminal', 'Violent Crime', 'Robbery',
  'Property Crime', 'Arms', 'Narcotics', 'Cybercrime', 'Organized Crime', 'Human Trafficking', 'Other'
];

// Synonyms and semantic mapping for NLP normalization
const CATEGORY_SYNONYMS = {
  'Robbery': ['robbery', 'robberies', 'mugging', 'heist'],
  'Violent Crime': ['assault', 'homicide', 'murder', 'attack', 'violence', 'shooting', 'stabbing'],
  'Property Crime': ['theft', 'burglary', 'larceny', 'stolen', 'break-in', 'vandalism'],
  'Financial': ['fraud', 'embezzlement', 'scam', 'bribery', 'counterfeit', 'corruption'],
  'Narcotics': ['drug', 'narcotic', 'trafficking', 'cocaine', 'heroin', 'marijuana', 'meth'],
  'Arms': ['weapon', 'gun', 'firearm', 'pistol', 'rifle', 'ammunition'],
  'Cybercrime': ['cyber', 'phishing', 'hacking', 'malware', 'ransomware'],
  'Organized Crime': ['gang', 'mafia', 'cartel', 'syndicate'],
  'Human Trafficking': ['human trafficking', 'smuggling', 'exploitation', 'forced labor'],
  'Legal': ['court', 'prosecution', 'law', 'legal', 'trial', 'conviction'],
  'Social': ['family', 'domestic', 'child', 'youth', 'elderly', 'abuse', 'runaway'],
  'Criminal': ['criminal', 'crime', 'offense', 'felony', 'misdemeanor'],
  'Other': []
};

// Helper to build dynamic categories (base + all detected categories with confidence)
useEffect(() => {
  const baseCategories = { ...categories };
  const dynamic = { ...baseCategories };
  let colorIdx = 0;
  documents.forEach(doc => {
    // Always include the primary category
    if (doc.category && !dynamic[doc.category]) {
      dynamic[doc.category] = {
        color: crimeTypeColors[colorIdx % crimeTypeColors.length],
        count: 0,
        confidence: doc.analysis?.category?.confidence || 0
      };
      colorIdx++;
    }
    // If the document has a category analysis with secondary categories, add them
    if (doc.analysis?.category?.secondary && Array.isArray(doc.analysis.category.secondary)) {
      doc.analysis.category.secondary.forEach((cat, idx) => {
        if (cat && !dynamic[cat]) {
          dynamic[cat] = {
            color: crimeTypeColors[(colorIdx + idx) % crimeTypeColors.length],
            count: 0,
            confidence: 0
          };
        }
      });
    }
  });
  // Count documents for each dynamic category
  Object.keys(dynamic).forEach(cat => {
    dynamic[cat].count = documents.filter(doc => doc.category === cat || (doc.analysis?.category?.secondary || []).includes(cat)).length;
    // Set confidence if available (for badges)
    const docWithCat = documents.find(doc => doc.category === cat || (doc.analysis?.category?.secondary || []).includes(cat));
    if (docWithCat && docWithCat.analysis?.category) {
      if (docWithCat.category === cat && docWithCat.analysis.category.confidence) {
        dynamic[cat].confidence = docWithCat.analysis.category.confidence;
      } else if ((docWithCat.analysis.category.secondary || []).includes(cat) && docWithCat.analysis.category.secondaryConfidence) {
        dynamic[cat].confidence = docWithCat.analysis.category.secondaryConfidence;
      }
    }
  });
  setDynamicCategories(dynamic);
}, [documents, categories]);

  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [fileArray, setFileArray] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportHtml, setReportHtml] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [relatedContent, setRelatedContent] = useState('');
  const [isOllamaAvailable, setIsOllamaAvailable] = useState(false);
  const [ollamaInfo, setOllamaInfo] = useState({ online: false, model: 'Unknown' });
  const [analysisStatus, setAnalysisStatus] = useState('');

  const getCategoryColor = (categoryName) => {
    if (!categoryName) return '#718096';
    
    // Check base categories
    if (categories[categoryName] && categories[categoryName].color) {
      return categories[categoryName].color;
    }
    
    // Check dynamic categories
    if (dynamicCategories[categoryName] && dynamicCategories[categoryName].color) {
      return dynamicCategories[categoryName].color;
    }
    
    // Fallback based on name
    const colorMap = {
      'Criminal': '#e53e3e',
      'Violent Crime': '#e53e3e',
      'Property Crime': '#ed8936',
      'Financial': '#48bb78',
      'Legal': '#ed8936',
      'Social': '#4299e1',
      'Medical': '#9f7aea',
      'Narcotics': '#38b2ac',
      'Arms': '#ecc94b',
      'Cybercrime': '#4299e1',
      'Organized Crime': '#9f7aea',
      'Human Trafficking': '#ed64a6'
    };
    
    return colorMap[categoryName] || '#718096';
  };

  useEffect(() => {
    getOllamaStatus().then(status => {
      setIsOllamaAvailable(status.online);
      setOllamaInfo(status);
      console.log('Ollama Status for Document Analysis:', status);
    });
  }, []);


  const extractText = async (file) => {
    console.log(`Extracting text from: ${file.name} (${file.type})`);
    try {
      if (file.type.startsWith('image/')) {
        setAnalysisStatus(`Running OCR on image: ${file.name}...`);
        try {
          const Tesseract = await import('tesseract.js');
          const { data: { text } } = await Tesseract.recognize(file, 'eng', {
            logger: m => {
              if (m.status === 'recognizing text') {
                setAnalysisStatus(`OCR: ${Math.round(m.progress * 100)}% complete...`);
              }
            }
          });
          console.log(`OCR complete, text length: ${text.length}`);
          return text;
        } catch (ocrErr) {
          console.error('OCR failed. Make sure tesseract.js is installed:', ocrErr);
          throw new Error('OCR failed. Handwritten document analysis requires tesseract.js.');
        }
      }

      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        console.log('PDF ArrayBuffer loaded, size:', arrayBuffer.byteLength);
        const loadingTask = pdfjsLib.getDocument(arrayBuffer);
        const pdf = await loadingTask.promise;
        console.log(`PDF loaded: ${pdf.numPages} pages`);
        let text = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => item.str).join(' ');
          text += pageText + '\n';
        }
        console.log(`Extraction complete, text length: ${text.length}`);
        return text;
      }

      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
      }

      const text = await file.text();
      return text;
    } catch (error) {
      console.error('Text extraction failed:', error);
      throw new Error(`Text extraction failed: ${error.message}`);
    }
  };

  // Function to update filtered documents based on search term and category
  const updateFilteredDocuments = useCallback((docs, term, category) => {
    let filtered = [...docs];

    // Filter by search term
    if (term && term.trim() !== '') {
      const searchLower = term.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.name.toLowerCase().includes(searchLower) ||
        doc.content.toLowerCase().includes(searchLower) ||
        (doc.analysis?.entities?.description && doc.analysis.entities.description.toLowerCase().includes(searchLower)) ||
        (doc.analysis?.keywords?.description && doc.analysis.keywords.description.toLowerCase().includes(searchLower))
      );
    }

    // Filter by category
    if (category && category !== 'All') {
      filtered = filtered.filter(doc => {
        const crimeTypes = doc.analysis?.entities?.crimeTypes || [];
        if (crimeTypes.includes(category)) return true;
        return doc.category === category;
      });
    }

    setFilteredDocuments(filtered);
  }, []);

  // Handle search input change
  const handleSearchChange = useCallback((e) => {
    const term = e.target.value;
    setSearchTerm(term);
    updateFilteredDocuments(documents, term, selectedCategory);
  }, [documents, selectedCategory, updateFilteredDocuments]);

  // Handle category filter change
  const handleCategoryChange = useCallback((category) => {
    setSelectedCategory(category);
    updateFilteredDocuments(documents, searchTerm, category);
  }, [documents, searchTerm, updateFilteredDocuments]);

  // Initialize documents from localStorage
  useEffect(() => {
    const savedDocs = localStorage.getItem('case_documents');
    if (savedDocs) {
      let parsedDocs = JSON.parse(savedDocs);
      console.log('Loaded documents from localStorage:', parsedDocs.length);

      // Debug: Log the first document's structure
      if (parsedDocs.length > 0) {
        const firstDoc = parsedDocs[0];
        console.log('First document structure:', {
          id: firstDoc.id,
          name: firstDoc.name,
          category: firstDoc.category,
          hasAnalysis: !!firstDoc.analysis,
          analysisKeys: firstDoc.analysis ? Object.keys(firstDoc.analysis) : [],
          categoryObject: firstDoc.analysis?.category,
          primaryCategory: firstDoc.analysis?.category?.primary,
          subcategory: firstDoc.analysis?.category?.subcategory
        });

        // Log the category description HTML
        if (firstDoc.analysis?.category?.description) {
          console.log('Category description HTML:', firstDoc.analysis.category.description);
        }
      }

      // Enrich with data point relations if missing (for docs loaded from storage)
      parsedDocs = parsedDocs.map(doc => {
        if (!doc.dataPointRelations) {
          const rel = findDocumentDataPointRelations(doc, parsedDocs);
          return { ...doc, dataPointRelations: rel };
        }
        return doc;
      });
      parsedDocs = parsedDocs.map(doc => {
        if (doc.analysis && doc.analysis.category) {
          // Use our helper function to extract the category
          let analysisCategory = extractCategoryFromAnalysis(doc.analysis);

          // Force Criminal category if the description mentions it
          if (analysisCategory === 'Other' &&
              doc.analysis.category.description &&
              doc.analysis.category.description.includes('Criminal') &&
              doc.analysis.category.description.includes('Violent Crime')) {
            analysisCategory = 'Criminal';
            console.log('Forcing Criminal category based on description content during load');
          }

          // If we found a category and it's different from the current one, update it
          if (analysisCategory && doc.category !== analysisCategory) {
            console.log('Fixing document category:', {
              docId: doc.id,
              docName: doc.name,
              currentCategory: doc.category,
              analysisCategory: analysisCategory,
              extractionMethod: doc.analysis.category.primary ? 'direct' :
                               (doc.analysis.category.description ? 'from HTML' : 'forced')
            });

            // Update the document's category to match the analysis category
            return {
              ...doc,
              category: analysisCategory
            };
          }
        }
        return doc;
      });

      // Save the fixed documents back to localStorage
      localStorage.setItem('case_documents', JSON.stringify(parsedDocs));

      setDocuments(parsedDocs);
      setFilteredDocuments(parsedDocs);

      // Update category counts
      const categoryCounts = {};
      Object.keys(categories).forEach(cat => {
        categoryCounts[cat] = {
          ...categories[cat],
          count: parsedDocs.filter(doc => doc.category === cat).length
        };
      });
      setCategories(categoryCounts);

      console.log('Updated category counts:', categoryCounts);
    }
  }, []);

  // Use NLP-based category extraction when loading and processing documents
  useEffect(() => {
    const savedDocs = localStorage.getItem('case_documents');
    if (savedDocs) {
      let parsedDocs = JSON.parse(savedDocs);
      parsedDocs = parsedDocs.map(doc => {
        const nlpCategory = inferDocumentCategoryNLP(doc);
        if (nlpCategory && doc.category !== nlpCategory) {
          return { ...doc, category: nlpCategory };
        }
        return doc;
      });
      localStorage.setItem('case_documents', JSON.stringify(parsedDocs));
      setDocuments(parsedDocs);
      setFilteredDocuments(parsedDocs);

      // Update category counts
      const categoryCounts = {};
      Object.keys(categories).forEach(cat => {
        categoryCounts[cat] = {
          ...categories[cat],
          count: parsedDocs.filter(doc => doc.category === cat).length
        };
      });
      setCategories(categoryCounts);
    }
  }, []);

  // Fix: Always update category counts after NLP category assignment
  useEffect(() => {
    const savedDocs = localStorage.getItem('case_documents');
    if (savedDocs) {
      let parsedDocs = JSON.parse(savedDocs);
      parsedDocs = parsedDocs.map(doc => {
        const nlpCategory = inferDocumentCategoryNLP(doc);
        return { ...doc, category: nlpCategory };
      });
      localStorage.setItem('case_documents', JSON.stringify(parsedDocs));
      setDocuments(parsedDocs);
      setFilteredDocuments(parsedDocs);
      // Update category counts based on NLP categories
      const categoryCounts = {};
      Object.keys(categories).forEach(cat => {
        categoryCounts[cat] = {
          ...categories[cat],
          count: parsedDocs.filter(doc => doc.category === cat).length
        };
      });
      setCategories(categoryCounts);
    }
  }, []);

  // Function to find common entities between two documents
  const findCommonEntities = (doc1, doc2) => {
    if (!doc1?.analysis?.entities || !doc2?.analysis?.entities) {
      return [];
    }

    // Extract entities from both documents
    const getEntitiesFromDoc = (doc) => {
      const entityTypes = ['people', 'organizations', 'places', 'dates', 'emails', 'phones'];
      const allEntities = [];

      entityTypes.forEach(type => {
        if (doc.analysis.entities[type]) {
          allEntities.push(...doc.analysis.entities[type]);
        }
      });

      return allEntities;
    };

    const entities1 = getEntitiesFromDoc(doc1);
    const entities2 = getEntitiesFromDoc(doc2);

    // Find common entities (case-insensitive)
    const common = entities1.filter(entity =>
      entities2.some(e2 => e2.toLowerCase() === entity.toLowerCase())
    );

    return [...new Set(common)]; // Remove duplicates
  };

  // Function to find common keywords between two documents
  const findCommonKeywords = (doc1, doc2) => {
    if (!doc1?.analysis?.keywords || !doc2?.analysis?.keywords) {
      return [];
    }

    // Extract keywords from both documents
    const getKeywordsFromDoc = (doc) => {
      if (typeof doc.analysis.keywords.description !== 'string') {
        return [];
      }

      // Extract words from the key-item spans
      const keywordMatches = doc.analysis.keywords.description.match(/<span class="key-item">([^<|(]+)/g) || [];
      return keywordMatches.map(match => {
        const word = match.replace(/<span class="key-item">/, '').trim();
        return word;
      });
    };

    const keywords1 = getKeywordsFromDoc(doc1);
    const keywords2 = getKeywordsFromDoc(doc2);

    // Find common keywords (case-insensitive)
    const common = keywords1.filter(keyword =>
      keywords2.some(k2 => k2.toLowerCase() === keyword.toLowerCase())
    );

    return [...new Set(common)]; // Remove duplicates
  };

  // Function to calculate similarity score between two documents
  const calculateSimilarity = (doc1, doc2) => {
    if (!doc1 || !doc2) {
      return 0;
    }

    let score = 0;

    // Check category similarity
    if (doc1.category === doc2.category) {
      score += 30; // Same category is a strong indicator of similarity
    }

    // Check entity similarity
    const commonEntities = findCommonEntities(doc1, doc2);
    const totalEntities = (
      (doc1.analysis?.entities?.matches || 0) +
      (doc2.analysis?.entities?.matches || 0)
    ) / 2; // Average entity count

    if (totalEntities > 0) {
      score += Math.min(40, (commonEntities.length / totalEntities) * 40);
    }

    // Check keyword similarity
    const commonKeywords = findCommonKeywords(doc1, doc2);
    const totalKeywords = (
      (doc1.analysis?.keywords?.matches || 0) +
      (doc2.analysis?.keywords?.matches || 0)
    ) / 2; // Average keyword count

    if (totalKeywords > 0) {
      score += Math.min(30, (commonKeywords.length / totalKeywords) * 30);
    }

    return Math.round(score);
  };

  // Function to extract category from analysis
  const extractCategoryFromAnalysis = (analysis) => {
    // Default to Other
    let category = 'Other';

    if (analysis && analysis.category) {
      // Try to extract the primary category from different possible structures

      // Check if primary property exists directly
      if (analysis.category.primary) {
        category = analysis.category.primary;
      }
      // Check if we can extract it from the description HTML
      else if (analysis.category.description) {
        // Try to extract from the category badge in the HTML
        const match = analysis.category.description.match(/class="category-badge"[^>]*>\s*([^<\s]+)/);
        if (match && match[1]) {
          category = match[1];
        }

        // Force Criminal category if the description mentions it
        if (category === 'Other' &&
            analysis.category.description.includes('Criminal') &&
            analysis.category.description.includes('Violent Crime')) {
          category = 'Criminal';
          console.log('Forcing Criminal category based on description content');
        }
      }
    }

    return category;
  };

  // NLP-based category extraction using compromise
  function inferDocumentCategoryNLP(doc) {
    // 1. Check for explicit incident types in analysis entities
    const incidentTypes = (doc.analysis?.entities?.crimeTypes || [])
      .map(type => type && typeof type === 'string' ? type.trim().toLowerCase() : null)
      .filter(Boolean);

    // Try to map incident types to allowed categories using synonyms
    for (const type of incidentTypes) {
      for (const [cat, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
        if (synonyms.some(syn => type.includes(syn))) {
          return cat;
        }
      }
    }

    // 2. Check for incident type mentions in summary/description fields
    const summaryFields = [doc.analysis?.summary?.description, doc.analysis?.category?.description, doc.desc, doc.content]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    for (const [cat, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
      if (synonyms.some(syn => summaryFields.includes(syn))) {
        return cat;
      }
    }

    // 3. Fallback to NLP-based extraction (topics/nouns)
    const text = [doc.name, doc.title, doc.desc, doc.content]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!text || text.length < 10) return 'Other';

    const nlpResult = nlpLib(text);
    const topics = nlpResult.topics().out('array').map(t => t.toLowerCase());
    const nouns = nlpResult.nouns().out('array').map(n => n.toLowerCase());
    const allTerms = [...topics, ...nouns];

    for (const [cat, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
      if (allTerms.some(term => synonyms.includes(term))) {
        return cat;
      }
    }

    return 'Other';
  }

  const handleFiles = async (files) => {
    setIsAnalyzing(true);
    const filesArray = Array.from(files);
    setFileArray(filesArray);
    const processedFiles = [];
    for (const file of filesArray) {
      try {
        console.log(`Processing file: ${file.name}`);
        setAnalysisStatus(`Extracting text from: ${file.name}...`);
        const content = await extractText(file);
        if (!content || content.trim() === '') {
          throw new Error('No text content extracted from document');
        }
        console.log('Analyzing content...');
        setAnalysisStatus(`Analyzing document content: ${file.name}...`);
        const analysis = await analyzeDocument(content);
        console.log('Analysis complete');
        setAnalysisStatus(`Categorizing document: ${file.name}...`);
        const uniqueId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        let docCategory = inferDocumentCategoryNLP({ ...analysis, name: file.name, content });
        const processedFile = {
          id: uniqueId,
          name: file.name,
          type: file.type,
          content: content,
          uploadDate: new Date().toISOString(),
          analysis: analysis,
          size: (file.size / 1024).toFixed(2) + ' KB',
          category: docCategory
        };

        // AUTO-INTEGRATION: Register with the Master Brain
        await Hub.registerIntelligence('DOCUMENT_ANALYSIS', processedFile);

        const allDocsSoFar = [...documents, ...processedFiles, processedFile];
        processedFile.dataPointRelations = findDocumentDataPointRelations(processedFile, allDocsSoFar);
        processedFiles.push(processedFile);
        setDocuments(prevDocs => [...prevDocs, processedFile]);
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        setAnalysisStatus(`Error: ${error.message}`);
        // ... rest of error handling ...

        const errorFile = {
          id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          name: file.name,
          type: file.type,
          content: '',
          uploadDate: new Date().toISOString(),
          analysis: {
            error: {
              description: 'Failed to analyze document',
              matches: 0
            },
            summary: {
              description: 'Document analysis failed. The file may be corrupted or in an unsupported format.',
              matches: 0,
              important: false
            }
          },
          size: (file.size / 1024).toFixed(2) + ' KB',
          category: 'Other'
        };

        processedFiles.push(errorFile);

        // Update documents state incrementally
        setDocuments(prevDocs => [...prevDocs, errorFile]);
      }
    }
    const updatedDocs = [...documents, ...processedFiles];
    localStorage.setItem('case_documents', JSON.stringify(updatedDocs));
    updateFilteredDocuments(updatedDocs, searchTerm, selectedCategory);
    setIsAnalyzing(false);
  };

  const handleDelete = (docId) => {
    const updatedDocs = documents.filter(doc => doc.id !== docId);
    setDocuments(updatedDocs);
    localStorage.setItem('case_documents', JSON.stringify(updatedDocs));

    if (selectedDocument?.id === docId) {
      setSelectedDocument(null);
    }
  };

  const handleFileUpload = (e) => {
    const { files } = e.target;
    if (files && files.length) {
      handleFiles(files);
    }
  };

  const exportIntelligenceJSON = () => {
    if (documents.length === 0) return;
    
    // Create a structured intelligence map
    const intelligence = documents.map(doc => ({
      source_file: doc.name,
      extraction_date: doc.uploadDate,
      category: doc.category,
      summary: doc.analysis?.summary || doc.analysis?.documentStructure?.description,
      entities: doc.analysis?.entities || {},
      full_content: doc.content
    }));

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(intelligence, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `intelligence_hub_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };


  // Function to categorize document based on content with enhanced criminal case detection
  const categorizeDocument = (text, entities, keywords) => {
    // Define category indicators with expanded criminal and legal terms
    const categoryIndicators = {
      'Social': ['social', 'community', 'family', 'relationship', 'welfare', 'support', 'assistance', 'benefit', 'rehabilitation', 'counseling'],
      'Financial': ['money', 'financial', 'payment', 'transaction', 'bank', 'credit', 'debit', 'fund', 'dollar', 'income', 'expense', 'asset', 'liability', 'fraud', 'embezzlement'],
      'Legal': ['legal', 'law', 'court', 'judge', 'attorney', 'lawyer', 'plaintiff', 'defendant', 'lawsuit', 'litigation', 'justice', 'statute', 'regulation', 'act', 'section', 'code', 'prosecution', 'defense', 'bail', 'hearing', 'trial', 'verdict', 'sentence', 'appeal'],
      'Medical': ['medical', 'health', 'doctor', 'hospital', 'patient', 'treatment', 'diagnosis', 'symptom', 'illness', 'disease', 'prescription', 'injury', 'wound', 'trauma', 'emergency', 'ambulance', 'paramedic', 'surgery', 'recovery', 'therapy', 'medication']
    };

    // Add case-specific subcategories for more detailed classification
    const criminalSubcategories = {
      'Violent Crime': ['murder', 'homicide', 'assault', 'battery', 'attack', 'violent', 'weapon', 'gun', 'knife', 'machete', 'injury', 'wound', 'victim', 'blood', 'death', 'kill', 'stab', 'shot', 'beaten', 'fight'],
      'Property Crime': ['theft', 'robbery', 'burglary', 'stealing', 'shoplifting', 'larceny', 'stolen', 'property', 'break-in', 'trespass', 'vandalism', 'damage'],
      'Financial Crime': ['fraud', 'embezzlement', 'forgery', 'counterfeit', 'money laundering', 'bribery', 'corruption', 'extortion', 'blackmail', 'scam'],
      'Drug Crime': ['drug', 'narcotic', 'substance', 'cocaine', 'heroin', 'marijuana', 'cannabis', 'methamphetamine', 'trafficking', 'dealing', 'possession'],
      'Cybercrime': ['cyber', 'computer', 'online', 'internet', 'hacking', 'phishing', 'identity theft', 'data breach', 'malware', 'ransomware'],
      'Organized Crime': ['gang', 'syndicate', 'cartel', 'mafia', 'organized', 'network', 'ring', 'racket']
    };

    // Count matches for each category
    const categoryCounts = {};
    Object.entries(categoryIndicators).forEach(([category, indicators]) => {
      let count = 0;

      // Check keywords
      keywords.forEach(([word]) => {
        if (indicators.some(indicator => word.toLowerCase().includes(indicator) || indicator.includes(word.toLowerCase()))) {
          count += 3; // Keywords are strong indicators
        }
      });

      // Check text for direct mentions
      indicators.forEach(indicator => {
        const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
        const matches = (text.match(regex) || []).length;
        count += matches;
      });

      // Check entities with enhanced weighting for criminal case entities
      Object.entries(entities).forEach(([entityType, entityValues]) => {
        entityValues.forEach(entity => {
          // Check if entity matches any indicator
          if (indicators.some(indicator =>
            entity.toLowerCase().includes(indicator) ||
            indicator.includes(entity.toLowerCase()))) {

            // Apply different weights based on entity type
            if (entityType === 'crimeTypes' && category === 'Criminal') {
              count += 5; // Crime types are very strong indicators for Criminal category
            } else if (entityType === 'weapons' && category === 'Criminal') {
              count += 4; // Weapons are strong indicators for Criminal category
            } else if (entityType === 'legalReferences' && (category === 'Legal' || category === 'Criminal')) {
              count += 4; // Legal references are strong indicators for Legal and Criminal categories
            } else {
              count += 2; // Other entities are medium indicators
            }
          }
        });
      });

      categoryCounts[category] = count;
    });

    // Determine primary category
    let primaryCategory = 'Other';
    let maxCount = 0;

    Object.entries(categoryCounts).forEach(([category, count]) => {
      if (count > maxCount) {
        maxCount = count;
        primaryCategory = category;
      }
    });

    // If no strong category found, use 'Other'
    if (maxCount < 3) {
      primaryCategory = 'Other';
    }

    // Get secondary categories (at least 40% of primary category count)
    const secondaryCategories = Object.entries(categoryCounts)
      .filter(([category, count]) => category !== primaryCategory && count >= maxCount * 0.4)
      .map(([category]) => category);

    // Determine subcategory for Criminal documents
    let subcategory = null;
    let subcategoryConfidence = 0;

    if (primaryCategory === 'Criminal') {
      const subcategoryCounts = {};

      Object.entries(criminalSubcategories).forEach(([subcat, indicators]) => {
        let count = 0;

        // Check text for subcategory indicators
        indicators.forEach(indicator => {
          const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
          const matches = (text.match(regex) || []).length;
          count += matches;
        });

        // Check crime types against subcategory indicators
        if (entities.crimeTypes) {
          entities.crimeTypes.forEach(crimeType => {
            if (indicators.some(indicator =>
              crimeType.toLowerCase().includes(indicator) ||
              indicator.includes(crimeType.toLowerCase()))) {
              count += 3;
            }
          });
        }

        // Check weapons for violent crime subcategory
        if (subcat === 'Violent Crime' && entities.weapons && entities.weapons.length > 0) {
          count += entities.weapons.length * 2;
        }

        subcategoryCounts[subcat] = count;
      });

      // Find highest subcategory
      Object.entries(subcategoryCounts).forEach(([subcat, count]) => {
        if (count > subcategoryConfidence) {
          subcategory = subcat;
          subcategoryConfidence = count;
        }
      });
    }

    return {
      primary: primaryCategory,
      secondary: secondaryCategories,
      subcategory: subcategory,
      confidence: Math.min(100, Math.round((maxCount / 15) * 100)), // Convert to percentage with max of 100%
      subcategoryConfidence: subcategory ? Math.min(100, Math.round((subcategoryConfidence / 5) * 100)) : 0
    };
  };

  // Function to fetch related online content
  const fetchRelatedContent = async (entities, keywords) => {
    try {
      // Extract meaningful search terms from entities
      const extractEntityTerms = () => {
        const result = [];

        // Add people (up to 2)
        if (entities.people && entities.people.length > 0) {
          // Clean up people names (remove punctuation)
          const cleanPeople = entities.people
            .map(person => person.trim().replace(/[,.;:]/g, ''))
            .filter(person => person.length > 2);
          result.push(...cleanPeople.slice(0, 2));
        }

        // Add organizations (up to 2)
        if (entities.organizations && entities.organizations.length > 0) {
          // Clean up organization names
          const cleanOrgs = entities.organizations
            .map(org => org.trim().replace(/[,.;:]/g, ''))
            .filter(org => org.length > 2);
          result.push(...cleanOrgs.slice(0, 2));
        }

        // Add places (up to 1)
        if (entities.places && entities.places.length > 0) {
          // Clean up place names
          const cleanPlaces = entities.places
            .map(place => place.trim().replace(/[,.;:]/g, ''))
            .filter(place => place.length > 2);
          if (cleanPlaces.length > 0) {
            result.push(cleanPlaces[0]);
          }
        }

        return result;
      };

      // Get top keywords
      const topKeywords = keywords.slice(0, 3).map(([word]) => word);

      // Combine entities and keywords for search
      const entityTerms = extractEntityTerms();

      // Create search terms
      let searchTerms = [...entityTerms, ...topKeywords]
        .filter(Boolean)
        .filter(term => term.length > 2) // Filter out very short terms
        .map(term => term.trim().replace(/[,.;:]/g, '')) // Clean up punctuation
        .join(' ');

      // If no search terms found, use a default
      if (!searchTerms || searchTerms.trim() === '') {
        // Try to get the document category if available
        searchTerms = "document analysis";
      }

      // Create search results with real search engines
      return [
        {
          title: `General Information: ${searchTerms}`,
          snippet: `Search for information about ${entityTerms.length > 0 ? entityTerms.join(', ') : searchTerms}.`,
          link: `https://www.google.com/search?q=${encodeURIComponent(searchTerms)}`
        },
        {
          title: `News Articles: ${entityTerms.length > 0 ? entityTerms[0] : searchTerms}`,
          snippet: `Find recent news articles related to ${entityTerms.length > 0 ? entityTerms[0] : searchTerms}.`,
          link: `https://news.google.com/search?q=${encodeURIComponent(searchTerms)}`
        },
        {
          title: `Research: ${searchTerms}`,
          snippet: `Find academic papers and research about ${searchTerms}.`,
          link: `https://scholar.google.com/scholar?q=${encodeURIComponent(searchTerms)}`
        }
      ];
    } catch (error) {
      console.error('Error fetching related content:', error);
      return [{
        title: "Error generating search links",
        snippet: "There was a problem creating search links for this document.",
        link: "https://www.google.com"
      }];
    }
  };

  const analyzeWithAI = async (text) => {
    try {
      const prompt = `You are a forensic document analyst. Analyze the following document text and provide a structured JSON response.

DOCUMENT TEXT:
${text.substring(0, 6000)}

Provide a JSON object with the following structure:
{
  "summary": "A concise professional summary of the document (2-3 sentences)",
  "entities": {
    "people": ["Name1", "Name2"],
    "organizations": ["Org1"],
    "places": ["Place1"],
    "crimeTypes": ["Type1"],
    "weapons": ["Weapon1"],
    "caseNumbers": ["Case1"]
  },
  "category": "One of: Social, Financial, Legal, Criminal, Medical, Other",
  "subcategory": "Specific crime type if Criminal (e.g. Robbery, Burglary, etc)",
  "insights": ["Insight 1", "Insight 2"],
  "evidence": ["Evidence 1", "Evidence 2"]
}

ONLY return the JSON object. No other text.`;

      const response = await callOllamaChat({
        messages: [{ role: 'user', content: prompt }],
        systemContext: 'You are a specialized document analysis tool. Respond only with valid JSON.',
        stream: false
      });

      // Clean up the response to ensure it's valid JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('Ollama response did not contain valid JSON:', response);
        return null;
      }
      
      const aiResult = JSON.parse(jsonMatch[0]);
      return aiResult;
    } catch (error) {
      console.error('Ollama analysis failed:', error);
      return null;
    }
  };

  const analyzeDocument = async (text) => {
    // Check if AI is available for deeper analysis
    let aiResult = null;
    if (isOllamaAvailable) {
      console.log('Using AI for deep analysis...');
      setAnalysisStatus('Using AI for deep analysis...');
      aiResult = await analyzeWithAI(text);
    }

    // Date extraction with importance scoring
    setAnalysisStatus('Extracting entities and key terms...');
    const dateMatches = text.match(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/g) || [];
    const dates = [...new Set(dateMatches)];

    // Enhanced entity extraction with more types and improved patterns
    const doc = nlp(text);

    // Extract people with titles and positions
    const peopleWithTitles = text.match(/\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Officer|Detective|Inspector|Sergeant|Captain|Chief|Judge|Lawyer|Advocate|Counsel|Suspect|Victim|Witness|Accused)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];

    // Extract case-specific entities
    const caseNumbers = text.match(/\b(?:Case|Reference|File)\s+(?:No\.|Number|#)?\s*[A-Z0-9-/]+\b/gi) || [];
    const crimeTypes = text.match(/\b(?:Theft|Robbery|Murder|Assault|Fraud|Corruption|Kidnapping|Trafficking|Burglary|Homicide|Rape|Arson|Forgery|Bribery|Extortion|Embezzlement|Smuggling)(?:\s+(?:with|by|of|and)\s+(?:violence|force|weapons|firearms|threats|deception))?\b/gi) || [];
    const weapons = text.match(/\b(?:Gun|Pistol|Rifle|Knife|Machete|Panga|Weapon|Firearm|Explosive|Bomb|Grenade|Ammunition|Bullet)s?\b/gi) || [];
    const legalReferences = text.match(/\b(?:Section|Act|Code|Statute|Law|Regulation|Penal Code|Criminal Code)\s+(?:[A-Z0-9-]+\s+)*(?:\d+(?:[A-Z])?(?:\(\d+\))?(?:\s*&\s*\d+(?:[A-Z])?(?:\(\d+\))?)*)/gi) || [];

    // Extract times with improved pattern
    const times = text.match(/\b(?:at|around|about)?\s*(?:1[0-2]|0?[1-9])[:.]?(?:[0-5][0-9])?\s*(?:am|pm|a\.m\.|p\.m\.|hours)\b/gi) || [];

    // Combine with standard NLP extraction
    const entities = {
      people: [...new Set([...(aiResult?.entities?.people || []), ...doc.people().out('array'), ...peopleWithTitles])].slice(0, 15),
      organizations: [...new Set([...(aiResult?.entities?.organizations || []), ...doc.organizations().out('array')])].slice(0, 10),
      places: [...new Set([...(aiResult?.entities?.places || []), ...doc.places().out('array')])].slice(0, 10),
      dates: dates.slice(0, 5),
      times: times.slice(0, 5),
      caseNumbers: [...new Set([...(aiResult?.entities?.caseNumbers || []), ...caseNumbers])].slice(0, 5),
      crimeTypes: [...new Set([...(aiResult?.entities?.crimeTypes || []), ...crimeTypes])].slice(0, 8),
      weapons: [...new Set([...(aiResult?.entities?.weapons || []), ...weapons])].slice(0, 8),
      legalReferences: legalReferences.slice(0, 5),
      emails: (text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || []).slice(0, 5),
      phones: (text.match(/\b(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g) || []).slice(0, 5)
    };

    // Advanced context-aware summarization
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];

    // Define important terms based on document context
    const importantTerms = [
      'case', 'suspect', 'illegal', 'trafficking', 'evidence', 'investigation',
      'report', 'victim', 'witness', 'statement', 'document', 'record',
      'incident', 'crime', 'violation', 'offense', 'complaint', 'allegation'
    ];

    const importantSentences = sentences
      .filter(s => s.length > 20 && s.length < 200) // Filter extremes
      .map(sentence => {
        // Score by presence of important terms and entities
        let score = 0;

        // Check for important terms
        importantTerms.forEach(term => {
          const regex = new RegExp(`\\b${term}\\b`, 'gi');
          const matches = (sentence.match(regex) || []).length;
          score += matches * 2; // Each important term adds 2 points
        });

        // Check for entities
        Object.values(entities).flat().forEach(entity => {
          if (sentence.includes(entity)) {
            score += 3; // Each entity mention adds 3 points
          }
        });

        // Check for dates
        dates.forEach(date => {
          if (sentence.includes(date)) {
            score += 2; // Each date mention adds 2 points
          }
        });

        return { sentence, score };
      })
      .sort((a, b) => b.score - a.score) // Sort by score
      .slice(0, 5) // Take top 5
      .map(item => item.sentence);

    // Enhanced keyword extraction with importance
    const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const wordCounts = groupBy(words);
    const keywords = Object.entries(wordCounts)
      .filter(([word]) => !['this', 'that', 'with', 'from', 'have', 'were', 'they', 'their'].includes(word))
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 12);

    // Categorize the document
    const category = aiResult?.category ? 
      { primary: aiResult.category, secondary: [], confidence: 95, subcategory: aiResult.subcategory, subcategoryConfidence: 90 } :
      categorizeDocument(text, entities, keywords);

    // Generate insights based on analysis
    const insights = aiResult?.insights || generateInsights(text, entities, keywords, category);

    // Calculate document statistics
    const stats = {
      wordCount: words.length,
      sentenceCount: sentences.length,
      entityCount: Object.values(entities).flat().length,
      averageSentenceLength: words.length / (sentences.length || 1)
    };

    // Extract evidence items
    const evidenceItems = aiResult?.evidence || [];
    if (evidenceItems.length === 0) {
      const evidencePatterns = [
        /\b(?:evidence|exhibit|item)\s+(?:collected|found|recovered|seized|obtained|discovered)\b.{1,100}/gi,
        /\b(?:collected|found|recovered|seized|obtained|discovered)\s+(?:evidence|exhibit|item)\b.{1,100}/gi,
        /\b(?:CCTV|camera|video|footage|recording|photograph|fingerprint|blood|DNA|sample|statement|testimony|document|weapon)\b.{1,100}/gi
      ];

      evidencePatterns.forEach(pattern => {
        const matches = text.match(pattern) || [];
        matches.forEach(match => {
          evidenceItems.push(match.trim());
        });
      });
    }

    // Extract actions taken
    const actionsTaken = [];
    const actionPatterns = [
      /\b(?:arrested|detained|charged|interviewed|questioned|investigated|searched|seized|confiscated|secured|processed|analyzed|examined)\b.{1,100}/gi,
      /\b(?:action|measure|step|procedure|operation)\s+(?:taken|implemented|conducted|carried out|performed|executed)\b.{1,100}/gi
    ];

    actionPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        actionsTaken.push(match.trim());
      });
    });

    // Extract recommendations
    const recommendations = [];
    const recommendationPatterns = [
      /\b(?:recommend|recommendation|suggested|proposal|advised|advise|propose)\b.{1,100}/gi,
      /\b(?:should|must|need to|required to|necessary to|important to)\b.{1,100}/gi
    ];

    recommendationPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        recommendations.push(match.trim());
      });
    });

    // Create structured analysis report
    const structuredAnalysis = {
      documentStructure: {
        description: aiResult?.summary ? 
          `<h4>AI-Generated Summary</h4><p>${aiResult.summary}</p>` :
          `
          <h4>Document Structure and Clarity</h4>
          <ul>
            <li>The report is ${sentences.length > 15 ? 'well-organized' : 'brief'} with ${Object.values(entities).some(arr => arr.length > 0) ? 'clear identification of key elements' : 'limited detail'}.</li>
            <li>Key details ${entities.dates.length > 0 || entities.places.length > 0 ? '(date, location, ' + (entities.people.length > 0 ? 'individuals involved' : 'events') + ')' : ''} are ${importantSentences.length > 3 ? 'highlighted' : 'present but limited'}.</li>
          </ul>
        `,
        matches: aiResult?.summary ? 10 : 2,
        important: true
      },

      incidentSummary: {
        description: `
          <h4>Incident Summary</h4>
          <h5>Strengths:</h5>
          <ul>
            ${entities.dates.length > 0 ? `<li>Timeline information available (${entities.dates.join(', ')}${entities.times.length > 0 ? ' at ' + entities.times[0] : ''}).</li>` : '<li>Limited timeline information available.</li>'}
            ${entities.crimeTypes.length > 0 ? `<li>Clear description of the incident type (${entities.crimeTypes.join(', ')}).</li>` : ''}
            ${importantSentences.length > 0 ? `<li>Key details: "${importantSentences[0]}"</li>` : ''}
          </ul>
          <h5>Gaps:</h5>
          <ul>
            ${entities.places.length === 0 ? '<li>No specific location details provided.</li>' : ''}
            ${entities.people.length === 0 ? '<li>Limited information about individuals involved.</li>' : ''}
            <li>${entities.crimeTypes.length === 0 ? 'Incident classification is unclear.' : 'Additional context about circumstances would be beneficial.'}</li>
          </ul>
        `,
        matches: entities.dates.length + entities.crimeTypes.length + importantSentences.length,
        important: true
      },

      evidenceCollected: {
        description: `
          <h4>Evidence Collected</h4>
          <h5>Strengths:</h5>
          <ul>
            ${evidenceItems.length > 0 ?
              evidenceItems.slice(0, 3).map(item => `<li>${item}</li>`).join('') :
              '<li>Limited evidence details found in document.</li>'}
            ${entities.weapons.length > 0 ? `<li>Weapons/items identified: ${entities.weapons.join(', ')}.</li>` : ''}
          </ul>
          <h5>Gaps:</h5>
          <ul>
            <li>${evidenceItems.length === 0 ? 'No clear evidence collection details.' : 'Evidence quality and processing information limited.'}</li>
            <li>Chain of custody information not specified.</li>
            ${/witness|statement|testimony/i.test(text) ? '<li>Witness statements mentioned but not summarized.</li>' : '<li>No witness accounts documented.</li>'}
          </ul>
        `,
        matches: evidenceItems.length + entities.weapons.length,
        important: true
      },

      preliminaryFindings: {
        description: `
          <h4>Preliminary Findings</h4>
          <h5>Strengths:</h5>
          <ul>
            ${insights.length > 0 ?
              insights.slice(0, 2).map(insight => `<li>${insight}</li>`).join('') :
              '<li>Limited findings identified in document.</li>'}
            ${entities.people.length > 0 ? `<li>Individuals identified: ${entities.people.slice(0, 3).join(', ')}.</li>` : ''}
          </ul>
          <h5>Gaps:</h5>
          <ul>
            <li>${/suspect|perpetrator|offender/i.test(text) ? 'Suspect identification process not fully explained.' : 'Suspect identification information missing.'}</li>
            <li>Forensic analysis results ${/forensic|analysis|sample|dna|blood/i.test(text) ? 'mentioned but incomplete' : 'not mentioned'}.</li>
            <li>Causal factors and motivation analysis limited.</li>
          </ul>
        `,
        matches: insights.length + entities.people.length,
        important: true
      },

      actionTaken: {
        description: `
          <h4>Action Taken</h4>
          <h5>Strengths:</h5>
          <ul>
            ${actionsTaken.length > 0 ?
              actionsTaken.slice(0, 3).map(action => `<li>${action}</li>`).join('') :
              '<li>Limited action information found in document.</li>'}
          </ul>
          <h5>Gaps:</h5>
          <ul>
            <li>${actionsTaken.length === 0 ? 'No clear action steps documented.' : 'Timeline for follow-up actions not specified.'}</li>
            <li>Coordination with other agencies/units not detailed.</li>
            <li>Results of actions taken not fully documented.</li>
          </ul>
        `,
        matches: actionsTaken.length,
        important: true
      },

      recommendations: {
        description: `
          <h4>Recommendations</h4>
          <h5>Strengths:</h5>
          <ul>
            ${recommendations.length > 0 ?
              recommendations.slice(0, 3).map(rec => `<li>${rec}</li>`).join('') :
              '<li>Limited recommendations found in document.</li>'}
            ${entities.legalReferences.length > 0 ? `<li>Legal references cited: ${entities.legalReferences.join(', ')}.</li>` : ''}
          </ul>
          <h5>Gaps:</h5>
          <ul>
            <li>${recommendations.length === 0 ? 'No clear recommendations provided.' : 'Implementation plan for recommendations not detailed.'}</li>
            <li>Preventive measures not adequately addressed.</li>
            <li>Resource requirements for recommended actions not specified.</li>
          </ul>
        `,
        matches: recommendations.length + entities.legalReferences.length,
        important: true
      },

      overallAssessment: {
        description: `
          <h4>Overall Assessment</h4>
          <h5>Effective Aspects:</h5>
          <ul>
            <li>${sentences.length > 15 ? 'Document provides comprehensive coverage of the incident.' : 'Document provides basic information about the incident.'}</li>
            <li>${entities.crimeTypes.length > 0 ? `Clear identification of incident type (${entities.crimeTypes.join(', ')}).` : 'Basic incident information provided.'}</li>
            <li>${evidenceItems.length > 0 ? 'Evidence collection documented.' : 'Initial case information established.'}</li>
          </ul>
          <h5>Areas for Improvement:</h5>
          <ul>
            <li>${entities.people.length === 0 ? 'Better identification of individuals involved needed.' : 'More detailed roles of individuals would strengthen the report.'}</li>
            <li>Enhanced documentation of investigative procedures would improve clarity.</li>
            <li>${recommendations.length === 0 ? 'Clear recommendations should be added.' : 'More detailed action plans for recommendations needed.'}</li>
          </ul>
        `,
        matches: 6,
        important: true
      },

      suggestedEnhancements: {
        description: `
          <h4>Suggested Enhancements</h4>
          <ul>
            <li>Include a <strong>risk assessment</strong> for future incidents of similar nature.</li>
            <li>Add a <strong>timeline</strong> for pending actions and follow-up investigations.</li>
            <li>Propose <strong>interagency collaboration</strong> strategies for more effective resolution.</li>
            <li>Develop a <strong>case progression roadmap</strong> with key milestones and responsible parties.</li>
            <li>Include <strong>resource requirements</strong> for implementing recommendations.</li>
          </ul>

          <h4>Key Questions for Follow-Up:</h4>
          <ol>
            <li>What is the current status of the investigation/case?</li>
            <li>Have all potential witnesses been identified and interviewed?</li>
            <li>What additional resources are needed to progress this case effectively?</li>
          </ol>
        `,
        matches: 8,
        important: true
      },

      // Keep original analysis sections as well
      entities: {
        description: Object.entries(entities)
          .filter(([_, items]) => items.length > 0)
          .map(([type, items]) =>
            `<strong>${type.charAt(0).toUpperCase() + type.slice(1)}:</strong> ` +
            items.map(item => `<span class="da-key-item">${item}</span>`).join(' '))
          .join('<br>'),
        matches: Object.values(entities).flat().length,
        important: false
      },

      keywords: {
        description: keywords.map(([word, instances]) =>
          `<span class="da-key-item">${word} (${instances.length})</span>`).join(' '),
        matches: keywords.length,
        important: false
      },

      category: {
        description: `
          <div class="da-category-badge" style="background-color: ${getCategoryColor(category.primary)}">
            ${category.primary}
            <span class="confidence">${category.confidence}%</span>
          </div>
          ${category.secondary.map(cat =>
            `<div class="da-category-badge secondary" style="background-color: ${getCategoryColor(cat)}">
              ${cat}
            </div>`).join('')}
          ${category.subcategory ?
            `<div class="da-subcategory-badge" style="background-color: ${getCategoryColor('Criminal')}80; margin-top: 8px;">
              Subcategory: ${category.subcategory}
              <span class="confidence">${category.subcategoryConfidence}%</span>
            </div>` : ''}
          <p class="da-category-description">
            This document appears to be primarily related to ${category.primary.toLowerCase()} matters.
            ${category.subcategory ? `It has been classified as a <strong>${category.subcategory.toLowerCase()}</strong> case.` : ''}
          </p>
        `,
        matches: 1,
        important: false
      },

      relatedContent: {
        description: 'Click the globe icon to search for related online content.',
        matches: 0,
        important: false
      },

      statistics: {
        description: `
          <div class="da-stats-grid">
            <div class="da-stat-item">
              <span class="da-stat-value">${stats.wordCount}</span>
              <span class="da-stat-label">Words</span>
            </div>
            <div class="da-stat-item">
              <span class="da-stat-value">${stats.sentenceCount}</span>
              <span class="da-stat-label">Sentences</span>
            </div>
            <div class="da-stat-item">
              <span class="da-stat-value">${stats.entityCount}</span>
              <span class="da-stat-label">Entities</span>
            </div>
            <div class="da-stat-item">
              <span class="da-stat-value">${Math.round(stats.averageSentenceLength)}</span>
              <span class="da-stat-label">Avg. Sentence Length</span>
            </div>
          </div>
        `,
        matches: 4,
        important: false
      }
    };

    return structuredAnalysis;
  };

  // Generate enhanced insights based on document analysis with focus on criminal cases
  const generateInsights = (text, entities, keywords, category) => {
    const insights = [];

    // Check for people mentioned with role identification
    if (entities.people && entities.people.length > 0) {
      // Try to identify roles for people
      // Create pattern templates that will be used to create actual RegExp objects
      const suspectPatternTemplates = [
        '\\b(suspect|accused|perpetrator|offender|criminal|convict|inmate|detainee)\\b.{1,30}?\\b(PERSON)\\b',
        '\\b(PERSON)\\b.{1,30}?\\b(suspect|accused|perpetrator|offender|criminal|convict|inmate|detainee)\\b',
        '\\b(PERSON)\\b.{1,30}?\\b(arrested|detained|charged|convicted|sentenced|imprisoned)\\b'
      ];

      const victimPatternTemplates = [
        '\\b(victim|complainant|injured|affected)\\b.{1,30}?\\b(PERSON)\\b',
        '\\b(PERSON)\\b.{1,30}?\\b(victim|complainant|injured|affected)\\b'
      ];

      const witnessPatternTemplates = [
        '\\b(witness|testified|observed|saw|reported|statement)\\b.{1,30}?\\b(PERSON)\\b',
        '\\b(PERSON)\\b.{1,30}?\\b(witness|testified|observed|saw|reported|statement)\\b'
      ];

      const officerPatternTemplates = [
        '\\b(officer|detective|inspector|sergeant|captain|chief|police|law enforcement)\\b.{1,30}?\\b(PERSON)\\b',
        '\\b(PERSON)\\b.{1,30}?\\b(officer|detective|inspector|sergeant|captain|chief|police|law enforcement)\\b'
      ];

      // Identify suspects
      const suspects = [];
      entities.people.forEach(person => {
        for (const patternTemplate of suspectPatternTemplates) {
          const regex = new RegExp(patternTemplate.replace('PERSON', person.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'gi');
          if (regex.test(text)) {
            suspects.push(person);
            break;
          }
        }
      });

      // Identify victims
      const victims = [];
      entities.people.forEach(person => {
        for (const patternTemplate of victimPatternTemplates) {
          const regex = new RegExp(patternTemplate.replace('PERSON', person.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'gi');
          if (regex.test(text)) {
            victims.push(person);
            break;
          }
        }
      });

      // Identify witnesses
      const witnesses = [];
      entities.people.forEach(person => {
        for (const patternTemplate of witnessPatternTemplates) {
          const regex = new RegExp(patternTemplate.replace('PERSON', person.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'gi');
          if (regex.test(text)) {
            witnesses.push(person);
            break;
          }
        }
      });

      // Identify officers
      const officers = [];
      entities.people.forEach(person => {
        for (const patternTemplate of officerPatternTemplates) {
          const regex = new RegExp(patternTemplate.replace('PERSON', person.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'gi');
          if (regex.test(text)) {
            officers.push(person);
            break;
          }
        }
      });

      // Add insights based on roles
      if (suspects.length > 0) {
        insights.push(`Identified ${suspects.length} potential suspect(s): ${suspects.join(', ')}.`);
      }

      if (victims.length > 0) {
        insights.push(`Identified ${victims.length} potential victim(s): ${victims.join(', ')}.`);
      }

      if (witnesses.length > 0) {
        insights.push(`Identified ${witnesses.length} potential witness(es): ${witnesses.join(', ')}.`);
      }

      if (officers.length > 0) {
        insights.push(`Identified ${officers.length} law enforcement officer(s): ${officers.join(', ')}.`);
      }

      // For people without identified roles
      const othersCount = entities.people.length - (suspects.length + victims.length + witnesses.length + officers.length);
      if (othersCount > 0) {
        const others = entities.people.filter(person =>
          !suspects.includes(person) &&
          !victims.includes(person) &&
          !witnesses.includes(person) &&
          !officers.includes(person)
        );
        insights.push(`This document also mentions ${othersCount} other individual(s): ${others.slice(0, 3).join(', ')}${others.length > 3 ? '...' : ''}.`);
      }
    }

    // Check for organizations with context
    if (entities.organizations && entities.organizations.length > 0) {
      // Try to identify organization types
      const lawEnforcementOrgs = entities.organizations.filter(org =>
        /police|enforcement|precinct|station|department|bureau|agency|force|patrol|security|prison|jail|correctional/i.test(org)
      );

      const judicialOrgs = entities.organizations.filter(org =>
        /court|judicial|justice|tribunal|legal|attorney|prosecution|defense/i.test(org)
      );

      const otherOrgs = entities.organizations.filter(org =>
        !lawEnforcementOrgs.includes(org) && !judicialOrgs.includes(org)
      );

      if (lawEnforcementOrgs.length > 0) {
        insights.push(`Law enforcement agencies involved: ${lawEnforcementOrgs.join(', ')}.`);
      }

      if (judicialOrgs.length > 0) {
        insights.push(`Judicial/legal organizations mentioned: ${judicialOrgs.join(', ')}.`);
      }

      if (otherOrgs.length > 0) {
        insights.push(`Other organizations referenced: ${otherOrgs.slice(0, 3).join(', ')}}${otherOrgs.length > 3 ? '...' : ''}.`);
      }
    }

    // Check for locations with context
    if (entities.places && entities.places.length > 0) {
      // Try to identify location types
      const crimeScenes = [];
      const detentionLocations = [];
      const otherLocations = [];

      entities.places.forEach(place => {
        if (/\b(scene|location|site|area)\s+of\s+(crime|incident|offense|attack|robbery|murder|assault)/i.test(text.replace(place, "LOCATION"))) {
          crimeScenes.push(place);
        } else if (/\b(prison|jail|cell|detention|custody|holding|station|headquarters)/i.test(place)) {
          detentionLocations.push(place);
        } else {
          otherLocations.push(place);
        }
      });

      if (crimeScenes.length > 0) {
        insights.push(`Potential crime scene location(s): ${crimeScenes.join(', ')}.`);
      }

      if (detentionLocations.length > 0) {
        insights.push(`Detention/law enforcement location(s): ${detentionLocations.join(', ')}.`);
      }

      if (otherLocations.length > 0) {
        insights.push(`Other locations mentioned: ${otherLocations.join(', ')}.`);
      }
    }

    // Check for dates and times to establish timeline
    const timeline = [];

    if (entities.dates && entities.dates.length > 0) {
      entities.dates.forEach(date => {
        // Look for context around the date
        const dateContext = text.split(/[.!?]/).find(sentence => sentence.includes(date));
        if (dateContext) {
          timeline.push({ date, context: dateContext.trim() });
        } else {
          timeline.push({ date, context: null });
        }
      });
    }

    if (entities.times && entities.times.length > 0) {
      entities.times.forEach(time => {
        // Look for context around the time
        const timeContext = text.split(/[.!?]/).find(sentence => sentence.includes(time));
        if (timeContext) {
          // Check if this time is already associated with a date
          const existingEntry = timeline.find(entry => entry.context && entry.context.includes(time));
          if (!existingEntry) {
            timeline.push({ time, context: timeContext.trim() });
          }
        }
      });
    }

    if (timeline.length > 0) {
      insights.push(`Timeline of events: ${timeline.slice(0, 3).map(t => t.context || (t.date || t.time)).join('; ')}${timeline.length > 3 ? '...' : ''}`);
    }

    // Check for crime types and legal references
    if (entities.crimeTypes && entities.crimeTypes.length > 0) {
      insights.push(`Identified crime type(s): ${entities.crimeTypes.join(', ')}.`);
    }

    if (entities.weapons && entities.weapons.length > 0) {
      insights.push(`Weapon(s) mentioned: ${entities.weapons.join(', ')}.`);
    }

    if (entities.legalReferences && entities.legalReferences.length > 0) {
      insights.push(`Legal reference(s): ${entities.legalReferences.join(', ')}.`);
    }

    // Add category-specific insights
    switch (category.primary) {
      case 'Criminal':
        if (category.subcategory) {
          insights.push(`This appears to be a ${category.subcategory.toLowerCase()} case with ${category.subcategoryConfidence}% confidence.`);
        } else {
          insights.push('This appears to be related to a criminal matter. Consider reviewing for potential legal implications.');
        }

        // Look for status indicators
        if (/\b(ongoing|active|current|pending|open|investigation|investigating)\b/i.test(text)) {
          insights.push('This case appears to be ongoing or under active investigation.');
        } else if (/\b(closed|resolved|concluded|completed|finished|solved)\b/i.test(text)) {
          insights.push('This case appears to be closed or resolved.');
        }

        // Look for recommendation patterns
        const recommendationMatch = text.match(/\b(recommend|recommendation|suggested|proposal|advised|advise)\b.{1,100}/gi);
        if (recommendationMatch && recommendationMatch.length > 0) {
          insights.push(`Recommendation identified: "${recommendationMatch[0].trim()}..."`);
        }
        break;

      case 'Financial':
        insights.push('This document contains financial information. Verify all monetary figures for accuracy.');
        break;

      case 'Legal':
        insights.push('This document has legal content. Consider consulting with legal counsel for proper interpretation.');
        break;

      case 'Social':
        insights.push('This document contains social welfare or community-related information.');
        break;

      case 'Medical':
        insights.push('This document contains medical information. Ensure all health-related data is handled according to privacy regulations.');
        break;

      default:
        break;
    }

    // Add keyword-based insights
    if (keywords.length > 0) {
      const topKeywords = keywords.slice(0, 5).map(([word]) => word);
      insights.push(`Key topics in this document include: ${topKeywords.join(', ')}.`);
    }

    return insights;
  };

  // Helper to generate a full HTML report for all documents
 const generateCorpusSummaryHtml = (docs) => {
  if (!docs || docs.length === 0) {
    return '<div>No documents available for summary.</div>';
  }
  // Aggregate all text
  const allText = docs.map(doc => doc.content || '').join('\n\n');
  const allCategories = {};
  docs.forEach(doc => {
    const cat = doc.category || 'Other';
    allCategories[cat] = (allCategories[cat] || 0) + 1;
  });

  // Use compromise NLP to extract entities from the combined text
  let people = [];
  let orgs = [];
  let places = [];
  let topics = [];
  try {
    const nlpDoc = nlp(allText);
    people = nlpDoc.people().out('array');
    orgs = nlpDoc.organizations().out('array');
    places = nlpDoc.places().out('array');
    topics = nlpDoc.topics().out('array');
  } catch (e) {}

  // Extract keywords from all text
  const words = allText.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const wordCounts = {};
  words.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  // Remove stopwords and sort
  const stopwords = ['this','that','with','from','have','were','they','their','which','about','there','where','when','what','will','shall','upon','said','also','such','been','into','only','some','most','more','than','each','very','over','case','cases','file','files','report','reports','document','documents','date','number','title','summary','authoritydate','ministry'];
  const keywords = Object.entries(wordCounts)
    .filter(([word]) => !stopwords.includes(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => `${word} (${count})`);

  // Helper to get top N items
  const topN = (arr, n = 8) => {
    const counts = {};
    arr.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
    return Object.entries(counts)
      .filter(([k]) => k && k.length > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => `${k} (${v})`);
  };

  // --- Patterns & Cross-References Section ---
  let html = `<h2>Corpus Summary Report</h2>`;
  html += `<p><strong>Date:</strong> ${new Date().toLocaleString()}</p>`;
  html += `<p><strong>Total Documents:</strong> ${docs.length}</p>`;
  html += `<h3>Patterns & Cross-References</h3><div class='dx-patterns-section-dx'>`;
  const allEntities = [...new Set([...people, ...orgs, ...places])];
  allEntities.forEach(entity => {
    const matches = getCrossReferences(entity);
    if (matches.length) {
      html += `<span class='da-tag-dx dx-hoverable-dx' data-tooltip="${encodeURIComponent(renderTooltip(entity))}">${entity} ${renderCrossRefBadges(matches)}</span> `;
    }
  });
  html += `<div style='margin-top:8px;font-size:0.98em;color:#718096;'>Hover for details. Only entities with cross-references are shown.</div></div>`;

  // --- Visualization: Category Distribution Bar Chart ---
  html += `<h3>Category Distribution</h3>
    <div class="da-summary-bar-chart">`;
  const maxCount = Math.max(...Object.values(allCategories));
  Object.entries(allCategories).forEach(([cat, count]) => {
    const percent = Math.round((count / maxCount) * 100);
    html += `
      <div class="da-bar-row">
        <span class="da-bar-label">${cat}</span>
        <div class="da-bar-bg">
          <div class="da-bar-fill" style="width:${percent}%;"></div>
        </div>
        <span class="da-bar-count">${count}</span>
      </div>
    `;
  });
  html += `</div>`;

  // Compose a readable summary
  let readableSummary = '';
  if (people.length || orgs.length || places.length) {
    readableSummary += `<p><strong>Summary:</strong> `;
    if (people.length) readableSummary += `The most frequently mentioned people are: <b>${topN(people, 5).join(', ')}</b>. `;
    if (orgs.length) readableSummary += `Key organizations include: <b>${topN(orgs, 5).join(', ')}</b>. `;
    if (places.length) readableSummary += `Locations of interest: <b>${topN(places, 5).join(', ')}</b>. `;
    readableSummary += `</p>`;
  } else {
    readableSummary += `<p><strong>Summary:</strong> The uploaded documents cover a range of topics and categories. The most common keywords are: <b>${keywords.slice(0, 5).join(', ')}</b>.</p>`;
  }
  html += readableSummary;

  // --- Visualization: Key Entities & Patterns ---
  html += `<h3>Key Entities & Patterns</h3>`;
  html += `<div><strong>People:</strong> ${topN(people, 8).map(p => `<span class="da-tag">${p}</span>`).join(' ') || 'N/A'}</div>`;
  html += `<div><strong>Organizations:</strong> ${topN(orgs, 8).map(o => `<span class="da-tag">${o}</span>`).join(' ') || 'N/A'}</div>`;
  html += `<div><strong>Places:</strong> ${topN(places, 8).map(pl => `<span class="da-tag">${pl}</span>`).join(' ') || 'N/A'}</div>`;

  // --- Visualization: Top Keywords Tag Cloud ---
  html += `<h3>Top Keywords</h3>
    <div class="da-tag-cloud">
      ${keywords.map(word => `<span class="da-tag">${word}</span>`).join(' ')}
    </div>`;

  // --- Visualization: Criminal Activity by Location ---
  if (places.length > 0) {
    html += `<h3>Criminal Activity by Location</h3>
      <div class="da-location-bar-chart">`;
    const placeCounts = {};
    places.forEach(p => { placeCounts[p] = (placeCounts[p] || 0) + 1; });
    const maxPlace = Math.max(...Object.values(placeCounts));
    Object.entries(placeCounts).forEach(([place, count]) => {
      const percent = Math.round((count / maxPlace) * 100);
      html += `
        <div class="da-bar-row">
          <span class="da-bar-label">${place}</span>
          <div class="da-bar-bg">
            <div class="da-bar-fill location" style="width:${percent}%;"></div>
          </div>
          <span class="da-bar-count">${count}</span>
        </div>
      `;
    });
    html += `</div>`;
  }

  // --- Detected Topics ---
  if (topics.length) {
    html += `<h3>Detected Topics</h3><div>${topics.slice(0, 10).map(t => `<span class="da-tag">${t}</span>`).join(' ')}</div>`;
  }

  // --- Trends & Insights ---
  html += `<h3>Trends & Insights</h3>`;
  if (topN(orgs).length > 0) {
    html += `<div class="da-trends">Key organizations: ${topN(orgs).join(', ')}</div>`;
  }
  if (topN(people).length > 0) {
    html += `<div class="da-trends">Frequently mentioned people: ${topN(people).join(', ')}</div>`;
  }
  if (topN(places).length > 0) {
    html += `<div class="da-trends">Frequently mentioned locations: ${topN(places).join(', ')}</div>`;
  }
  html += `<div class="da-trends">This summary aggregates all uploaded documents and highlights the most frequent entities, topics, and patterns detected by NLP analysis.</div>`;

  // --- Data Point Relations by Document ---
  html += `<h3>Data Point Relations by Document</h3><div class="da-relations-section">`;
  docs.forEach(doc => {
    const rel = doc.dataPointRelations || findDocumentDataPointRelations(doc, docs);
    html += `<div class="da-doc-relations"><strong>${doc.name}</strong>: ${rel.summary}`;
    if (rel.hasRelations) {
      html += `<ul>`;
      rel.relations.slice(0, 5).forEach(r => {
        html += `<li><span class="da-relation-badge">${r.source}</span> ${r.label}${r.matchedPeople?.length ? ` (People: ${r.matchedPeople.join(', ')})` : ''}${r.matchedLocation ? ` @ ${r.matchedLocation}` : ''}</li>`;
      });
      if (rel.relations.length > 5) html += `<li>... and ${rel.relations.length - 5} more</li>`;
      html += `</ul>`;
    }
    html += `</div>`;
  });
  html += `</div>`;

  return html;
};

// Helper to find cross-references for a person/case/org in TestDataPoint
function getCrossReferences(name) {
  const matches = [];
  // PrisonData
  if (PrisonData.prisons_data.some(p => p.name && p.name.toLowerCase() === name.toLowerCase())) {
    matches.push({ type: 'Prison', clue: 'Listed in PrisonData' });
  }
  // ArrestData
  if (ArrestData.arrest_data.some(a => a.perp_name && a.perp_name.toLowerCase() === name.toLowerCase() || (a.suspects && a.suspects.some(s => s.toLowerCase() === name.toLowerCase())))) {
    matches.push({ type: 'Arrest', clue: 'Involved in ArrestData' });
  }
  // IntelData
  if (IntelData.allInvestigations.some(inv => (inv.victims && inv.victims.some(v => v.toLowerCase() === name.toLowerCase())) || (inv.suspects && inv.suspects.some(s => s.toLowerCase() === name.toLowerCase())))) {
    matches.push({ type: 'Intel', clue: 'Mentioned in Intel investigations' });
  }
  // ImageData
  if (ImageData.imageData.some(img => img.name && img.name.toLowerCase() === name.toLowerCase() || (img.labels && img.labels.some(l => l.toLowerCase() === name.toLowerCase())))) {
    matches.push({ type: 'Image', clue: 'Has associated image' });
  }
  return matches;
}

// Helper: Render cross-reference badges
function renderCrossRefBadges(matches) {
  return matches.map(m => `<span class="dx-badge-dx dx-badge-${m.type.toLowerCase()}-dx" title="${m.clue}">${m.type}</span>`).join(' ');
}

// Helper: Tooltip for cross-ref
function renderTooltip(name) {
  let html = `<div class='dx-tooltip-content-dx'><strong>${name}</strong><ul>`;
  const prison = PrisonData.prisons_data.find(p => p.name && p.name.toLowerCase() === name.toLowerCase());
  if (prison) html += `<li>Prison: ${prison.location}, Crime: ${prison.crime}, Sentence: ${prison.sentence}</li>`;
  const arrest = ArrestData.arrest_data.find(a => a.perp_name && a.perp_name.toLowerCase() === name.toLowerCase());
  if (arrest) {
    let arrestDate = arrest.date || arrest.arrest_date || arrest.arrestDate || '';
    if (arrestDate) {
      html += `<li>Arrested: ${arrest.details}, <b>Date:</b> ${arrestDate}, Status: ${arrest.status || 'N/A'}, Agency: ${arrest.agency}</li>`;
    } else {
      html += `<li>Arrested: ${arrest.details}, Status: ${arrest.status || 'N/A'}, Agency: ${arrest.agency}</li>`;
    }
  }
  const intel = IntelData.allInvestigations.find(inv => (inv.victims && inv.victims.some(v => v.toLowerCase() === name.toLowerCase())) || (inv.suspects && inv.suspects.some(s => s.toLowerCase() === name.toLowerCase())));
  if (intel) html += `<li>Intel: ${intel.intelType}, Status: ${intel.status}, Location: ${intel.location}</li>`;
  const img = ImageData.imageData.find(img => img.name && img.name.toLowerCase() === name.toLowerCase());
  if (img) html += `<li>Image: <img src='${img.imageUrl}' alt='${name}' style='max-width:60px;vertical-align:middle;border-radius:4px;'/></li>`;
  html += '</ul></div>';
  return html;
}

// Add tooltip logic on mount
useEffect(() => {
  if (!showReportModal) return;
  const handler = (e) => {
    const el = e.target.closest('.dx-hoverable-dx');
    let tooltip = document.getElementById('dx-tooltip-dx');
    if (el) {
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'dx-tooltip-dx';
        tooltip.className = 'dx-tooltip-dx';
        document.body.appendChild(tooltip);
      }
      tooltip.innerHTML = decodeURIComponent(el.getAttribute('data-tooltip'));
      tooltip.style.display = 'block';
      const rect = el.getBoundingClientRect();
      tooltip.style.left = (rect.left + window.scrollX + rect.width/2 - 120) + 'px';
      tooltip.style.top = (rect.top + window.scrollY + rect.height + 8) + 'px';
    } else if (tooltip) {
      tooltip.style.display = 'none';
    }
  };
  document.addEventListener('mouseover', handler);
  document.addEventListener('mouseout', handler);
  return () => {
    document.removeEventListener('mouseover', handler);
    document.removeEventListener('mouseout', handler);
    const tooltip = document.getElementById('dx-tooltip-dx');
    if (tooltip) tooltip.remove();
  };
}, [showReportModal]);

  return (
    <div className="document-analysis-container">
      {/* Left Section - Document List */}
      <div className="documents-sidebar">
        <div className="sidebar-header">
          <div className="ai-status-indicator" style={{ 
            padding: '10px 15px', 
            background: 'rgba(255,255,255,0.05)', 
            borderRadius: '8px', 
            marginBottom: '15px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <span style={{ 
              width: '10px', 
              height: '10px', 
              borderRadius: '50%', 
              backgroundColor: ollamaInfo.online ? '#48bb78' : '#e53e3e',
              boxShadow: ollamaInfo.online ? '0 0 8px #48bb78' : 'none'
            }}></span>
            <span>
              AI: <strong style={{ color: ollamaInfo.online ? '#48bb78' : '#e53e3e' }}>{ollamaInfo.online ? 'Online' : 'Offline'}</strong>
              {ollamaInfo.online && <span style={{ opacity: 0.8, marginLeft: '5px' }}>({ollamaInfo.model})</span>}
            </span>
          </div>
          <div className="search-container">
            <div className="search-input-wrapper">
              {/* <i className="fas fa-search search-icon"></i> */}
              <input
                type="text"
                placeholder="Search documents..."
                className="search-input"
                value={searchTerm}
                onChange={handleSearchChange}
              />
              {searchTerm && (
                <button
                  className="clear-search-btn"
                  onClick={() => {
                    setSearchTerm('');
                    updateFilteredDocuments(documents, '', selectedCategory);
                  }}
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
          </div>

          <div className="upload-controls">
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              className="file-input"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="upload-btn">
              <i className="fas fa-upload" style={{ marginRight: 6 }}></i>
              Upload Document(s)
            </label>
            <button 
              className="export-json-btn" 
              onClick={exportIntelligenceJSON}
              disabled={documents.length === 0}
              style={{
                marginTop: '10px',
                width: '100%',
                padding: '12px',
                background: '#4a5568',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: documents.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <i className="fas fa-file-code"></i>
              Export Hub Intelligence (JSON)
            </button>
            <span className="upload-hint">One at a time or multiple — each is analyzed and matched to data points</span>
          </div>

          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'summary' ? 'active' : ''}`}
              onClick={() => setViewMode('summary')}
            >
              {/* <i style={{fontSize: '1em'}} className="fas fa-th-large"></i> */}
               Summary View
            </button>
            <button
              className={`toggle-btn ${viewMode === 'detail' ? 'active' : ''}`}
              onClick={() => setViewMode('detail')}
            >
              {/* <i className="fas fa-list"></i>  */}
              Detail View
            </button>
            <button
              className={`toggle-btn ${viewMode === 'compare' ? 'active' : ''}`}
              onClick={() => setViewMode('compare')}
            >
              {/* <i className="fas fa-columns"></i> */}
               Compare
            </button>
          </div>

          <div className="summary-header">
          <h2 className="summary-title">Document Analysis Overview</h2>
          <div className="summary-stats-2">
            <div className="stat-box">
              <span className="stat-value">{(filteredDocuments.length > 0 ? filteredDocuments : documents).length}</span>
              <span className="stat-label">Documents</span>
            </div>
            {Object.entries(dynamicCategories).map(([category, { color, count, confidence }]) =>
              count > 0 && (
                <div key={category} className="stat-box" style={{ borderBottom: `3px solid ${color || '#718096'}` }}>
                  <span className="stat-value">{count || 0}</span>
                  <span className="stat-label">{category}{confidence ? ` ${confidence}%` : ''}</span>
                </div>
              )
            )}
          </div>
        </div>

        <div className="category-filters">
          <button
            className={`category-filter-btn ${selectedCategory === 'All' ? 'active' : ''}`}
            onClick={() => handleCategoryChange('All')}
          >
            All ({documents.length})
          </button>
          {Object.entries(dynamicCategories).map(([category, { color, count, confidence }]) => (
            count > 0 && (
              <button
                key={category}
                className={`category-filter-btn ${selectedCategory === category ? 'active' : ''}`}
                style={{ borderLeft: `3px solid ${color || '#718096'}` }}
                onClick={() => handleCategoryChange(category)}
              >
                {category} ({count || 0}){confidence ? ` ${confidence}%` : ''}
              </button>
            )
          ))}
        </div>
        </div>

        <div className="documents-list">
          {(filteredDocuments.length > 0 ? filteredDocuments : documents).map(doc => (
            <div
              key={doc.id}
              className={`document-list-item ${selectedDocument?.id === doc.id ? 'selected' : ''}`}
              onClick={() => {
                // Always check if the document's category matches its analysis category
                // and update it if necessary
                if (doc.analysis && doc.analysis.category) {
                  // Try to extract the primary category from different possible structures
                  let analysisCategory = null;

                  // Check if primary property exists directly
                  if (doc.analysis.category.primary) {
                    analysisCategory = doc.analysis.category.primary;
                  }
                  // Check if we can extract it from the description HTML

                  else if (doc.analysis.category.description) {
                    // Try to extract from the category badge in the HTML
                    const match = doc.analysis.category.description.match(/class="category-badge"[^>]*>\s*([^<\s]+)/);
                    if (match && match[1]) {
                      analysisCategory = match[1];
                    }
                  }

                  // Force Criminal category if the description mentions it
                  if (!analysisCategory || analysisCategory === 'Other') {
                    if (doc.analysis.category.description &&
                        doc.analysis.category.description.includes('Criminal') &&
                        doc.analysis.category.description.includes('Violent Crime')) {
                      analysisCategory = 'Criminal';
                      console.log('Forcing Criminal category based on description content');
                    }
                  }

                  if (analysisCategory && (!doc.category || doc.category !== analysisCategory)) {
                    console.log('Updating document category on selection:', {
                      docName: doc.name,
                      currentCategory: doc.category,
                      analysisCategory: analysisCategory,
                      extractionMethod: doc.analysis.category.primary ? 'direct' :
                                       (doc.analysis.category.description ? 'from HTML' : 'forced')
                    });

                    // Create updated document with correct category
                    const updatedDoc = {
                      ...doc,
                      category: analysisCategory
                    };

                    // Update the document in the documents array
                    setDocuments(prevDocs =>
                      prevDocs.map(d => d.id === doc.id ? updatedDoc : d)
                    );

                    // Update filtered documents as well
                    setFilteredDocuments(prevDocs =>
                      prevDocs.map(d => d.id === doc.id ? updatedDoc : d)
                    );

                    // Update category counts
                    setCategories(prevCategories => {
                      const newCategories = {...prevCategories};

                      // Decrement old category count if it exists
                      if (doc.category && newCategories[doc.category]) {
                        newCategories[doc.category] = {
                          ...newCategories[doc.category],
                          count: Math.max(0, newCategories[doc.category].count - 1)
                        };
                      }

                      // Increment new category count
                      if (newCategories[analysisCategory]) {
                        newCategories[analysisCategory] = {
                          ...newCategories[analysisCategory],
                          count: newCategories[analysisCategory].count + 1
                        };
                      }

                      return newCategories;
                    });

                    // Save the updated documents to localStorage
                    const updatedDocs = documents.map(d => d.id === doc.id ? updatedDoc : d);
                    localStorage.setItem('case_documents', JSON.stringify(updatedDocs));

                    // Set the updated document as selected
                    setSelectedDocument(updatedDoc);
                  } else {
                    setSelectedDocument(doc);
                  }
                } else {
                  setSelectedDocument(doc);
                }
                setViewMode('detail');
              }}
            >
              <div className="doc-icon" style={{ color: dynamicCategories[doc.category]?.color || '#718096' }}>
                <i className="fas fa-file-alt"></i>
              </div>
              <div className="doc-info">
                <h4>{doc.name}</h4>
                <div className="doc-meta">
                  <span className="doc-date">{doc.size} • {new Date(doc.uploadDate).toLocaleDateString()}</span>
                  {doc.category && (
                    <span className="doc-category" style={{ backgroundColor: dynamicCategories[doc.category]?.color || '#718096' }}>
                      {doc.category}
                    </span>
                  )}
                </div>
              </div>
              <div className="doc-actions">
                <button
                  className="action-btn"
                  title="View related content"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDocument(doc);
                    // Fetch related content if not already loaded
                    if (doc.analysis && doc.analysis.entities) {
                      setIsLoadingRelated(true);

                      // Extract entities from the document
                      const extractEntities = (entities) => {
                        // Create a clean object with just the entity arrays
                        const cleanEntities = {};

                        // Process each entity type
                        Object.entries(entities).forEach(([type, value]) => {
                          if (Array.isArray(value)) {
                            // If it's already an array, use it directly
                            cleanEntities[type] = value;
                          } else if (typeof value === 'object' && value.description) {
                            // If it's an object with HTML description, extract entities
                            const entityMatches = value.description.match(/<span class="key-item">([^<]+)<\/span>/g) || [];
                            cleanEntities[type] = entityMatches.map(match =>
                              match.replace(/<span class="key-item">/, '').replace(/<\/span>/, '').trim()
                            );
                          }
                        });

                        return cleanEntities;
                      };

                      // Extract keywords from the document
                      const extractKeywords = (keywords) => {
                        const keywordEntries = [];

                        if (keywords && typeof keywords === 'object') {
                          if (keywords.description) {
                            const keywordMatches = keywords.description.match(/<span class="key-item">([^<(]+)/g) || [];
                            keywordMatches.forEach(match => {
                              const word = match.replace(/<span class="key-item">/, '').trim().split(' ')[0];
                              if (word.length > 2) {
                                keywordEntries.push([word, [word]]);
                              }
                            });
                          }
                        }

                        return keywordEntries;
                      };

                      // Get clean entities and keywords
                      const cleanEntities = extractEntities(doc.analysis.entities);
                      const keywordEntries = extractKeywords(doc.analysis.keywords);

                      // Fetch related content
                      fetchRelatedContent(cleanEntities, keywordEntries)
                        .then(content => {
                          setRelatedContent(content);
                          setIsLoadingRelated(false);
                        })
                        .catch(error => {
                          console.error("Error fetching related content:", error);
                          setIsLoadingRelated(false);
                          setRelatedContent([{
                            title: "Error fetching related content",
                            snippet: "There was a problem generating search links. Please try again.",
                            link: "https://www.google.com"
                          }]);
                        });
                    }
                  }}
                >
                  <i className="fas fa-globe"></i>
                </button>
                <button
                  className="delete-btn"
                  title="Delete document"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(doc.id);
                  }}
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Section - Analysis */}
      <div className="analysis-section">
        {isAnalyzing ? (
          <div className="analyzing-indicator">
            <i className="fas fa-spinner fa-spin"></i>
            <span>{analysisStatus || 'Analyzing documents...'}</span>
            <div className="progress-bar">              <div className="progress-fill" style={{ width: `${(documents.length / (documents.length + fileArray.length)) * 100}%` }}></div>
            </div>
          </div>
        ) : viewMode === 'summary' ? (
          <div className="summary-view">
            <div className="summary-header">
              <h2 className="summary-title">Document Analysis Overview</h2>
              <div className="summary-stats-2">
                <div className="stat-box">
                  <span className="stat-value">{(filteredDocuments.length > 0 ? filteredDocuments : documents).length}</span>
                  <span className="stat-label">Documents</span>
                </div>
                {Object.entries(dynamicCategories).map(([category, { color, count, confidence }]) =>
                  count > 0 && (
                    <div key={category} className="stat-box" style={{ borderBottom: `3px solid ${color || '#718096'}` }}>
                      <span className="stat-value">{count || 0}</span>
                      <span className="stat-label">{category}{confidence ? ` ${confidence}%` : ''}</span>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="batch-actions">
              <h3>Batch Actions</h3>
              <div className="batch-buttons">
                <button className="batch-btn" onClick={() => {
                  // Export all document summaries as CSV
                  const csvContent = [
                    ['Document Name', 'Category', 'Upload Date', 'Size', 'Key Entities', 'Keywords'].join(','),
                    ...(filteredDocuments.length > 0 ? filteredDocuments : documents).map(doc => [
                      doc.name,
                      doc.category || 'Other',
                      new Date(doc.uploadDate).toLocaleDateString(),
                      doc.size,
                      doc.analysis?.entities?.matches || 0,
                      doc.analysis?.keywords?.matches || 0
                    ].join(','))
                  ].join('\n');

                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.setAttribute('href', url);
                  link.setAttribute('download', 'document_analysis.csv');
                  link.style.visibility = 'hidden';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}>
                  <i className="fas fa-file-csv"></i> Export as CSV
                </button>

                <button className="batch-btn" onClick={() => {
                  const docs = filteredDocuments.length > 0 ? filteredDocuments : documents;
                  setReportHtml(generateCorpusSummaryHtml(docs));
                  setShowReportModal(true);
                }}>
                  <i className="fas fa-file-alt"></i> Generate Report
                </button>

                <button className="batch-btn danger" onClick={() => {
                  if (window.confirm('Are you sure you want to delete all documents? This action cannot be undone.')) {
                    setDocuments([]);
                    setFilteredDocuments([]);
                    setSelectedDocument(null);
                    localStorage.removeItem('case_documents');

                    // Reset category counts
                    const resetCategories = {};
                    Object.keys(categories).forEach(cat => {
                      resetCategories[cat] = { ...categories[cat], count: 0 };
                    });
                    setCategories(resetCategories);
                  }
                }}>
                  <i className="fas fa-trash-alt"></i> Delete All
                </button>
              </div>
            </div>

            <div className="summary-grid">
              {(filteredDocuments.length > 0 ? filteredDocuments : documents).map(doc => (
                <div
                  key={doc.id}
                  className={`summary-card ${doc.category ? `category-${doc.category.toLowerCase()}` : ''}`}
                  onClick={() => {
                    // Always check if the document's category matches its analysis category
                    // and update it if necessary
                    if (doc.analysis && doc.analysis.category) {
                      // Try to extract the primary category from different possible structures
                      let analysisCategory = null;

                      // Check if primary property exists directly
                      if (doc.analysis.category.primary) {
                        analysisCategory = doc.analysis.category.primary;
                      }
                      // Check if we can extract it from the description HTML
                      else if (doc.analysis.category.description) {
                        // Try to extract from the category badge in the HTML
                        const match = doc.analysis.category.description.match(/class="category-badge"[^>]*>\s*([^<\s]+)/);
                        if (match && match[1]) {
                          analysisCategory = match[1];
                        }
                      }

                      // Force Criminal category if the description mentions it
                      if (!analysisCategory || analysisCategory === 'Other') {
                        if (doc.analysis.category.description &&
                            doc.analysis.category.description.includes('Criminal') &&
                            doc.analysis.category.description.includes('Violent Crime')) {
                          analysisCategory = 'Criminal';
                          console.log('Forcing Criminal category based on description content (summary view)');
                        }
                      }

                      if (analysisCategory && (!doc.category || doc.category !== analysisCategory)) {
                        console.log('Updating document category on selection (summary view):', {
                          docName: doc.name,
                          currentCategory: doc.category || 'undefined',
                          analysisCategory: analysisCategory,
                          extractionMethod: doc.analysis.category.primary ? 'direct' :
                                           (doc.analysis.category.description ? 'from HTML' : 'forced')
                        });

                        // Create updated document with correct category
                        const updatedDoc = {
                          ...doc,
                          category: analysisCategory
                        };

                        // Update the document in the documents array
                        setDocuments(prevDocs =>
                          prevDocs.map(d => d.id === doc.id ? updatedDoc : d)
                        );

                        // Update filtered documents as well
                        setFilteredDocuments(prevDocs =>
                          prevDocs.map(d => d.id === doc.id ? updatedDoc : d)
                        );

                        // Update category counts
                        setCategories(prevCategories => {
                          const newCategories = {...prevCategories};

                          // Decrement old category count if it exists
                          if (doc.category && newCategories[doc.category]) {
                            newCategories[doc.category] = {
                              ...newCategories[doc.category],
                              count: Math.max(0, newCategories[doc.category].count - 1)
                            };
                          }

                          // Increment new category count
                          if (newCategories[analysisCategory]) {
                            newCategories[analysisCategory] = {
                              ...newCategories[analysisCategory],
                              count: newCategories[analysisCategory].count + 1
                            };
                          }

                          return newCategories;
                        });

                        // Save the updated documents to localStorage
                        const updatedDocs = documents.map(d => d.id === doc.id ? updatedDoc : d);
                        localStorage.setItem('case_documents', JSON.stringify(updatedDocs));

                        // Set the updated document as selected
                        setSelectedDocument(updatedDoc);
                      } else {
                        setSelectedDocument(doc);
                      }
                    } else {
                      setSelectedDocument(doc);
                    }
                    setViewMode('detail');
                  }}
                >
                  <div className="card-header">
                    <h3>{doc.name}</h3>
                    <span className="date">{new Date(doc.uploadDate).toLocaleDateString()}</span>
                  </div>

                  {doc.category && (
                    <div className="card-category" style={{ backgroundColor: dynamicCategories[doc.category]?.color || '#718096' }}>
                      {doc.category}
                    </div>
                  )}

                  <div className="card-summary">
                    {doc.analysis?.documentStructure ? (
                      <div dangerouslySetInnerHTML={{
                        __html: doc.analysis.documentStructure.description.replace(/<h4>.*?<\/h4>/, '').replace(/<\/?ul>/g, '')
                      }} />
                    ) : (
                      <div dangerouslySetInnerHTML={{
                        __html: doc.analysis?.summary?.description || 'No summary available'
                      }} />
                    )}
                  </div>

                  {doc.dataPointRelations && doc.dataPointRelations.hasRelations && (
                    <div className="card-patterns">
                      <div className="pattern-label">Patterns Found:</div>
                      {doc.dataPointRelations.relations.slice(0, 3).map((rel, idx) => (
                        <div key={idx} className="pattern-badge-item">
                          <span className={`pattern-source-badge badge-${rel.type}`}>{rel.source}</span>
                          {rel.matchedRoles && rel.matchedRoles.length > 0 ? (
                            <span className="pattern-match-text">{rel.matchedRoles[0]}</span>
                          ) : (
                            <span className="pattern-match-text">{rel.label}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {doc.analysis?.keywords && (
                    <div className="card-keywords">
                      {doc.analysis.keywords.description && (
                        <div dangerouslySetInnerHTML={{ __html: doc.analysis.keywords.description.split(' ').slice(0, 5).join(' ') }} />
                      )}
                    </div>
                  )}

                  <div className="card-footer">
                    <span className="doc-size">{doc.size}</span>
                    <button className="view-details">
                      View Details <i className="fas fa-arrow-right"></i>
                    </button>
                  </div>
                </div>
              ))}

              {(filteredDocuments.length > 0 ? filteredDocuments : documents).length === 0 && (
                <div className="no-documents">
                  <i className="fas fa-file-search"></i>
                  <p>No documents found. Upload documents to begin analysis.</p>
                </div>
              )}
            </div>
          </div>
        ) : viewMode === 'compare' ? (
          <div className="compare-view">
            <h2>Document Comparison</h2>

            {documents.length < 2 ? (
              <div className="no-documents">
                <i className="fas fa-file-search"></i>
                <p>You need at least two documents to use the comparison view.</p>
              </div>
            ) : (
              <>
                <div className="compare-controls">
                  <div className="compare-select">
                    <label>Document 1</label>
                    <select
                      value={selectedDocument?.id || ''}
                      onChange={(e) => {
                        const doc = documents.find(d => d.id === e.target.value);
                        setSelectedDocument(doc || null);
                      }}
                    >
                      <option value="">Select a document</option>
                      {documents.map(doc => (
                        <option key={doc.id} value={doc.id}>{doc.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="compare-select">
                    <label>Document 2</label>
                    <select
                      value={compareDocument?.id || ''}
                      onChange={(e) => {
                        const doc = documents.find(d => d.id === e.target.value);
                        setCompareDocument(doc || null);
                      }}
                    >
                      <option value="">Select a document</option>
                      {documents.filter(doc => doc.id !== selectedDocument?.id).map(doc => (
                        <option key={doc.id} value={doc.id}>{doc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedDocument && compareDocument ? (
                  <div className="comparison-results">
                    <div className="comparison-header">
                      <h3>Comparing {selectedDocument.name} with {compareDocument.name}</h3>
                    </div>

                    <div className="comparison-grid">
                      <div className="comparison-card">
                        <h4>Common Entities</h4>
                        <div className="comparison-content">
                          {findCommonEntities(selectedDocument, compareDocument).map((entity, index) => (
                            <span key={index} className="common-entity">{entity}</span>
                          ))}
                          {findCommonEntities(selectedDocument, compareDocument).length === 0 && (
                            <p>No common entities found.</p>
                          )}
                        </div>
                      </div>

                      <div className="comparison-card">
                        <h4>Common Keywords</h4>
                        <div className="comparison-content">
                          {findCommonKeywords(selectedDocument, compareDocument).map((keyword, index) => (
                            <span key={index} className="common-keyword">{keyword}</span>
                          ))}
                          {findCommonKeywords(selectedDocument, compareDocument).length === 0 && (
                            <p>No common keywords found.</p>
                          )}
                        </div>
                      </div>

                      <div className="comparison-card">
                        <h4>Category Comparison</h4>
                        <div className="comparison-content">
                          <div className="category-comparison">
                            <div className="doc-category-badge" style={{ backgroundColor: dynamicCategories[selectedDocument.category]?.color || '#718096' }}>
                              {selectedDocument.name}: {selectedDocument.category || 'Other'}
                            </div>
                            <div className="doc-category-badge" style={{ backgroundColor: dynamicCategories[compareDocument.category]?.color || '#718096' }}>
                              {compareDocument.name}: {compareDocument.category || 'Other'}
                            </div>
                          </div>
                          <p>
                            {selectedDocument.category === compareDocument.category ?
                              `Both documents are categorized as ${selectedDocument.category || 'Other'}.` :
                              `Documents have different categories.`}
                          </p>
                        </div>
                      </div>

                      <div className="comparison-card">
                        <h4>Similarity Score</h4>
                        <div className="comparison-content">
                          <div className="similarity-meter">
                            <div className="similarity-fill" style={{ width: `${calculateSimilarity(selectedDocument, compareDocument)}%` }}></div>
                          </div>
                          <p className="similarity-value">{calculateSimilarity(selectedDocument, compareDocument)}% Similar</p>
                          <p className="similarity-explanation">
                            Based on common entities, keywords, and categories.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="no-selection">
                    <i className="fas fa-file-search"></i>
                    <p>Select two documents to compare</p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : selectedDocument ? (
          <div className="analysis-content">
            <div className="analysis-header">
              <div className="document-title-section">
                <h2>{selectedDocument.name}</h2>
                <span className="upload-date">
                  Uploaded on {new Date(selectedDocument.uploadDate).toLocaleString()}
                </span>
              </div>

              <div className="document-actions">
                <button className="doc-action-btn" onClick={() => {
                  // Download the original document content as a text file
                  const blob = new Blob([selectedDocument.content], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.setAttribute('href', url);
                  link.setAttribute('download', `${selectedDocument.name.split('.')[0]}.txt`);
                  link.style.visibility = 'hidden';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}>
                  <i className="fas fa-download"></i> Download Text
                </button>

                <button className="doc-action-btn" onClick={() => {
                  // Export analysis as JSON
                  const analysisData = {
                    document: selectedDocument.name,
                    uploadDate: selectedDocument.uploadDate,
                    size: selectedDocument.size,
                    category: selectedDocument.category || 'Other',
                    analysis: selectedDocument.analysis
                  };

                  const blob = new Blob([JSON.stringify(analysisData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.setAttribute('href', url);
                  link.setAttribute('download', `${selectedDocument.name.split('.')[0]}_analysis.json`);
                  link.style.visibility = 'hidden';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}>
                  <i className="fas fa-file-export"></i> Export Analysis
                </button>
              </div>
            </div>

            {selectedDocument && (
              <div className="document-category-banner" style={{
                backgroundColor: (dynamicCategories[selectedDocument.category]?.color || '#718096') + '20',
                borderColor: dynamicCategories[selectedDocument.category]?.color || '#718096'
              }}>
                <i className="fas fa-tag"></i>
                <span>
                  This document is categorized as <strong>{selectedDocument.category || 'Other'}</strong>
                  {selectedDocument.analysis?.category?.subcategory && (
                    <span> ({selectedDocument.analysis.category.subcategory})</span>
                  )}
                </span>
                {selectedDocument.analysis?.category?.confidence && (
                  <span className="confidence-badge">{selectedDocument.analysis.category.confidence}% confidence</span>
                )}
              </div>
            )}

            {/* Data Point Relations - patterns matched with investigations, arrests, etc. */}
            {selectedDocument && (() => {
              const rel = selectedDocument.dataPointRelations || findDocumentDataPointRelations(selectedDocument, documents);
              return (
                <div className={`data-point-relations-panel ${rel.hasRelations ? 'has-relations' : 'no-relations'}`}>
                  <h3 className="relations-title">
                    <i className="fas fa-project-diagram"></i> Data Point Relations
                  </h3>
                  {rel.hasRelations ? (
                    <div className="relations-list">
                      {rel.relations.map((r, idx) => (
                        <div key={idx} className="relation-card" data-source={r.source}>
                          <div className="relation-header">
                            <span className="relation-source-badge">{r.source}</span>
                            <span className="relation-type">{r.label}</span>
                          </div>
                          {(r.matchedPeople?.length > 0 || r.matchedLocation) && (
                            <div className="relation-matches">
                              {r.matchedPeople?.length > 0 && (
                                <span><strong>People:</strong> {r.matchedPeople.join(', ')}</span>
                              )}
                              {r.matchedLocation && (
                                <span><strong>Location:</strong> {r.matchedLocation}</span>
                              )}
                              {r.matchedPhone && (
                                <span><strong>Phone:</strong> {r.matchedPhone}</span>
                              )}
                            </div>
                          )}
                          {r.description && <p className="relation-desc">{r.description}</p>}
                          {r.location && <span className="relation-meta"><i className="fas fa-map-marker-alt"></i> {r.location}</span>}
                          {r.status && <span className="relation-meta"><i className="fas fa-info-circle"></i> {r.status}</span>}
                          {r.imageUrl && (
                            <div className="relation-image">
                              <img src={r.imageUrl} alt={r.label} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="relations-empty">
                      <i className="fas fa-info-circle"></i> No patterns found between this document and other data points (investigations, arrests, prison, images).
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="structured-report">
              <h2>Analysis of Document {selectedDocument.name}</h2>

              {/* Display structured report sections first */}
              {['documentStructure', 'incidentSummary', 'evidenceCollected', 'preliminaryFindings',
                'actionTaken', 'recommendations', 'overallAssessment', 'suggestedEnhancements'].map(sectionKey => {
                  const section = selectedDocument.analysis?.[sectionKey];
                  if (!section) return null;

                  return (
                    <div key={sectionKey} className="report-section">
                      <div
                        className="section-content"
                        dangerouslySetInnerHTML={{ __html: section.description }}
                      />
                    </div>
                  );
                })}

              {/* Additional Analysis Details (collapsible) */}
              <div className="additional-analysis">
                <details>
                  <summary>Additional Analysis Details</summary>
                  <div className="analysis-grid">
                    {Object.entries(selectedDocument.analysis || {})
                      .filter(([key]) =>
                        !['documentStructure', 'incidentSummary', 'evidenceCollected', 'preliminaryFindings',
                          'actionTaken', 'recommendations', 'overallAssessment', 'suggestedEnhancements',
                          'error', 'relatedContent'].includes(key))
                      .sort(([_, val]) => val.important ? -1 : 1)
                      .map(([key, value]) => (
                        <div key={key} className={`analysis-card ${value.important ? 'important-card' : ''}`}>
                          <h3 className="card-title">
                            {key.charAt(0).toUpperCase() + key.slice(1)}
                            {value.important && <span className="importance-badge">!</span>}
                          </h3>
                          <div
                            className="card-description"
                            dangerouslySetInnerHTML={{ __html: value.description }}
                          />
                          <div className="card-stats">
                            <span className="matches">
                              {value.matches} {value.matches === 1 ? 'match' : 'matches'} found
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </details>
              </div>
            </div>

            {isLoadingRelated ? (
              <div className="loading-related">
                <i className="fas fa-spinner fa-spin"></i>
                <span>Loading related content...</span>
              </div>
            ) : relatedContent.length > 0 && (
              <div className="related-content-section">
                <h3>Related Online Content</h3>
                <div className="related-content-grid">
                  {relatedContent.map((item, index) => (
                    <div key={index} className="related-content-card">
                      <h4>{item.title}</h4>
                      <p>{item.snippet}</p>
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="source-link">
                        <i className="fas fa-external-link-alt"></i> Search Online
                      </a>
                    </div>
                  ))}
                </div>
                <div className="related-content-note">
                  <p><i className="fas fa-info-circle"></i> These links will open searches in your browser based on key information found in this document.</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="no-selection">
            <i className="fas fa-file-search"></i>
            <p>Select a document to view its analysis</p>
          </div>
        )}
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.45)',
          zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 12,
            maxWidth: 800,
            width: '95vw',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 8px 32px #0003',
            padding: 32,
            position: 'relative'
          }}>
            <button
              onClick={() => setShowReportModal(false)}
              style={{
                position: 'absolute',
                top: 12, right: 16,
                background: 'none',
                border: 'none',
                fontSize: 28,
                color: '#888',
                cursor: 'pointer'
              }}
              aria-label="Close"
            >
              &times;
            </button>
            <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentAnalysis;













