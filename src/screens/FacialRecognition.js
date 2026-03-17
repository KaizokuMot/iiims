import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import './FacialRecognition.css';
import { useSocialMedia } from '../context/SocialMediaContext';
import crowdVideo from '../media/crowd_video.mp4';

function FacialRecognition() {
  const videoRef = useRef();
  const canvasRef = useRef();
  const stillCanvasRef = useRef();
  const videoContainerRef = useRef();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [socialMediaResults, setSocialMediaResults] = useState({});
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const labeledFaceDescriptorsRef = useRef(null);
  const [descriptorsLoading, setDescriptorsLoading] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [detectionActive, setDetectionActive] = useState(false);
  const [showAllFaces, setShowAllFaces] = useState(true); // Show boxes for all faces (including unknown) by default
  const showAllFacesRef = useRef(showAllFaces);
  showAllFacesRef.current = showAllFaces;

  // Social media context
  const { lookupSocialMedia } = useSocialMedia();

  // Detection cycle timing
  const DETECTION_INTERVAL = 2000; // ms between detection cycles
  const BOX_DISPLAY_TIME = 1500; // ms to hold boxes on screen before resuming
  let lastDetectionTime = useRef(0);
  const detectionLoopRef = useRef(null);

  // Load face descriptors ONCE after models are loaded
  useEffect(() => {
    if (!isLoading && !labeledFaceDescriptorsRef.current && !descriptorsLoading) {
      setDescriptorsLoading(true);
      getLabeledFaceDescriptions().then(descriptors => {
        labeledFaceDescriptorsRef.current = descriptors;
        setDescriptorsLoading(false);
      });
    }
    // eslint-disable-next-line
  }, [isLoading]);

  // Load models with progress tracking
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true);
        await faceapi.tf.setBackend('webgl');
        await faceapi.tf.ready();

        const MODEL_URL = `${process.env.PUBLIC_URL}/models`;
        const models = [
          { name: 'SSD MobileNet v1', url: '/ssd_mobilenetv1_model-weights_manifest.json', net: faceapi.nets.ssdMobilenetv1 },
          { name: 'Tiny Face Detector', url: '/tiny_face_detector_model-weights_manifest.json', net: faceapi.nets.tinyFaceDetector },
          { name: 'Face Landmark 68', url: '/face_landmark_68_model-weights_manifest.json', net: faceapi.nets.faceLandmark68Net },
          { name: 'Face Recognition', url: '/face_recognition_model-weights_manifest.json', net: faceapi.nets.faceRecognitionNet }
        ];

        for (let i = 0; i < models.length; i++) {
          const model = models[i];
          setLoadingMessage(`Loading ${model.name}...`);
          setLoadingProgress(Math.round((i / models.length) * 100));
          await model.net.load(MODEL_URL + model.url);
        }

        setLoadingProgress(100);
        setLoadingMessage('Models loaded! Initializing face database...');
        setModelsReady(true);
        setIsLoading(false);
      } catch (err) {
        setError('Failed to load face detection models. ' + err.message);
        setIsLoading(false);
      }
    };
    loadModels();
  }, []);

  // Start video playback when models are ready
  useEffect(() => {
    if (modelsReady && videoRef.current) {
      videoRef.current.play().catch(err => {
        console.error('Video playback failed:', err);
      });
    }
  }, [modelsReady]);

  // Fullscreen handler
  const handleFullscreen = () => {
    const container = videoContainerRef.current;
    if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if (container.mozRequestFullScreen) {
      container.mozRequestFullScreen();
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    } else if (container.msRequestFullscreen) {
      container.msRequestFullscreen();
    }
  };

  // Safe Detection Loop
  const isDetectingRef = useRef(false);

  // Pause-Analyze-Draw-Resume detection cycle
  const runDetectionCycle = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.ended) return;
    if (isDetectingRef.current) return;

    isDetectingRef.current = true;

    try {
      const labeledFaceDescriptors = labeledFaceDescriptorsRef.current;

      // Ensure canvas matches video dimensions
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d');

      // Step 1: Pause the video to get a clean still frame
      video.pause();

      // Step 2: Snapshot the current video frame onto the canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Step 3: Run face detection on the frozen canvas frame
      const detections = await faceapi
        .detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      const displaySize = { width: canvas.width, height: canvas.height };
      const resizedDetections = faceapi.resizeResults(detections, displaySize);

      // Update HUD face count
      setFaceCount(resizedDetections.length);
      if (!detectionActive) setDetectionActive(true);

      // Step 4: Check for known faces and only show info for them
      let hasKnownFace = false;

      if (resizedDetections.length > 0) {
        let faceMatcher = null;
        if (labeledFaceDescriptors && labeledFaceDescriptors.length > 0) {
          faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.45);
        }

        resizedDetections.forEach(detection => {
          const box = detection.detection.box;
          let match = { label: 'Detecting...', distance: 1.0 };
          let personInfo = null;

          if (faceMatcher) {
            match = faceMatcher.findBestMatch(detection.descriptor);
            const personDescriptor = labeledFaceDescriptors.find(d => d.label === match.label);
            personInfo = personDescriptor?.personInfo;
          } else {
            match = { label: 'Loading...', distance: 1.0 };
          }

          const isUnknown = match.label === 'unknown' || match.distance > 0.45;
          if (!isUnknown) hasKnownFace = true;

          // Only draw for known faces unless showAllFaces is enabled
          if (isUnknown && !showAllFacesRef.current) return;

          const boxColor = isUnknown ? '#FF4444' : '#00FF00'; // Red for unknown, green for known

          ctx.strokeStyle = boxColor;
          ctx.lineWidth = 3;
          ctx.strokeRect(box.x, box.y, box.width, box.height);

          // Info Box Logic
          const infoBoxWidth = 240;
          let infoBoxHeight = 56;
          if (personInfo) {
            const extraFields = Object.entries(personInfo).filter(([key]) => key !== 'name');
            infoBoxHeight += extraFields.length * 18 + 8;
          }

          const infoBoxY = Math.max(0, box.y - infoBoxHeight - 8);
          const infoBoxX = Math.max(0, box.x);

          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.7)';
          ctx.shadowBlur = 8;
          ctx.fillStyle = 'rgba(30, 30, 30, 0.92)';
          ctx.fillRect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight);
          ctx.restore();

          ctx.save();
          ctx.strokeStyle = boxColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight);
          ctx.restore();

          const confidence = ((1 - match.distance) * 100).toFixed(0);

          ctx.fillStyle = '#00FF99';
          ctx.font = 'bold 17px Segoe UI, Arial';
          ctx.fillText(match.label, infoBoxX + 12, infoBoxY + 24);

          ctx.font = '14px Segoe UI, Arial';
          ctx.fillStyle = '#fff';
          ctx.fillText(`Confidence: ${confidence}%`, infoBoxX + 12, infoBoxY + 44);

          ctx.save();
          ctx.fillStyle = '#222';
          ctx.fillRect(infoBoxX + 12, infoBoxY + 50, infoBoxWidth - 24, 10);
          ctx.fillStyle = '#00FF99';
          ctx.fillRect(infoBoxX + 12, infoBoxY + 50, (infoBoxWidth - 24) * (confidence / 100), 10);
          ctx.restore();

          if (personInfo) {
            ctx.font = '13px Segoe UI, Arial';
            ctx.fillStyle = '#bbb';
            let yOffset = 72;
            Object.entries(personInfo).forEach(([key, value]) => {
              if (key !== 'name') {
                ctx.fillText(`${key}: ${value}`, infoBoxX + 12, infoBoxY + yOffset);
                yOffset += 18;
              }
            });
          }
        });
      }

      // Step 5: Hold the frame so user can see the drawn boxes
      if (hasKnownFace || (showAllFacesRef.current && resizedDetections.length > 0)) {
        await new Promise(resolve => setTimeout(resolve, BOX_DISPLAY_TIME));
      }

      // Step 6: Clear canvas and resume video playback
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      video.play().catch(() => {});

    } catch (err) {
      console.error("Detection error:", err);
      // Resume video even on error
      const video = videoRef.current;
      if (video) video.play().catch(() => {});
    } finally {
      isDetectingRef.current = false;
    }
  };

  // Start detection loop using setInterval when video is ready
  useEffect(() => {
    if (!modelsReady) return;

    const video = videoRef.current;
    if (!video) return;

    // Run first cycle after a short delay
    const initialTimeout = setTimeout(() => {
      runDetectionCycle();
    }, 1000);

    // Then run on interval
    detectionLoopRef.current = setInterval(() => {
      if (!isDetectingRef.current) {
        runDetectionCycle();
      }
    }, DETECTION_INTERVAL + BOX_DISPLAY_TIME);

    return () => {
      clearTimeout(initialTimeout);
      if (detectionLoopRef.current) clearInterval(detectionLoopRef.current);
    };
    // eslint-disable-next-line
  }, [modelsReady]);

  // Social media lookup for stills
  const fetchSocialMediaProfiles = async (name) => {
    if (!name || name === 'Unknown' || name === 'Error' || name === 'No faces detected') return {};
    try {
      const profiles = await lookupSocialMedia(name);
      return profiles;
    } catch {
      return {};
    }
  };

  // Still image upload handler (optimized)
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsProcessingImage(true);
    setSocialMediaResults({});
    setDetectedFaces([]);
    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = async () => {
        const canvas = stillCanvasRef.current;
        const container = canvas.parentElement;
        const maxWidth = container.clientWidth;
        const maxHeight = container.clientHeight;
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const labeledFaceDescriptors = labeledFaceDescriptorsRef.current;
        if (!labeledFaceDescriptors || labeledFaceDescriptors.length === 0) {
          setDetectedFaces([{ label: 'Error', confidence: 0, personInfo: { error: 'No face data available for comparison' } }]);
          setSocialMediaResults({});
          setIsProcessingImage(false);
          return;
        }
        const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
        const detections = await faceapi
          .detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
          .withFaceLandmarks()
          .withFaceDescriptors();
        if (detections.length === 0) {
          setDetectedFaces([{ label: 'No faces detected', confidence: 0, personInfo: null }]);
          setSocialMediaResults({});
          setIsProcessingImage(false);
          return;
        }
        const faces = await Promise.all(detections.map(async (detection) => {
          const match = faceMatcher.findBestMatch(detection.descriptor);
          const personDescriptor = labeledFaceDescriptors.find(d => d.label === match.label);
          const { box } = detection.detection;
          ctx.strokeStyle = match.distance > 0.6 ? '#FF0000' : '#00FF00';
          ctx.lineWidth = 2;
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          const landmarks = detection.landmarks;
          ctx.fillStyle = '#00FF00';
          for (const point of landmarks.positions) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
            ctx.fill();
          }
          return {
            label: match.distance > 0.6 ? 'Unknown' : match.label,
            confidence: ((1 - match.distance) * 100).toFixed(1),
            personInfo: personDescriptor?.personInfo
          };
        }));
        setDetectedFaces(faces);
        if (faces.length > 0 && faces[0].label !== 'Unknown') {
          const profiles = await fetchSocialMediaProfiles(faces[0].label);
          setSocialMediaResults(profiles);
        } else {
          setSocialMediaResults({});
        }
        setIsProcessingImage(false);
      };
    } catch (error) {
      setDetectedFaces([{ label: 'Error', confidence: 0, personInfo: { error: error.message } }]);
      setSocialMediaResults({});
      setIsProcessingImage(false);
    }
  };

  // Load face descriptors (Optimized & Parallelized)
  const getLabeledFaceDescriptions = async () => {
    const labels = ["dixon", "eugene", "eric", "paul", "devon"];
    const supportedExtensions = ['png', 'jpg', 'jpeg', 'webp'];

    // Process all labels in parallel
    const validDescriptors = await Promise.all(
      labels.map(async (label) => {
        let descriptions = [];
        let personInfo = null;

        // Fetch info.json
        try {
          const infoResponse = await fetch(`${process.env.PUBLIC_URL}/labels/${label}/info.json`);
          if (infoResponse.ok) {
            personInfo = await infoResponse.json();
          }
        } catch { }

        // Load images (limited to 5 for speed, parallelized)
        const imagePromises = [];
        for (let i = 1; i <= 5; i++) {
          const loadAttempt = async () => {
            for (const ext of supportedExtensions) {
              try {
                const imgPath = `${process.env.PUBLIC_URL}/labels/${label}/${i}.${ext}`;
                const img = new window.Image();
                img.crossOrigin = 'anonymous';
                // Short timeout for 404s
                await new Promise((resolve, reject) => {
                  const timeout = setTimeout(() => reject('timeout'), 2000);
                  img.onload = () => { clearTimeout(timeout); resolve(); };
                  img.onerror = () => { clearTimeout(timeout); reject('error'); };
                  img.src = imgPath;
                });
                // If loaded, detect face
                const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
                if (detection) return detection.descriptor;
                return null; // Image loaded but no face
              } catch {
                continue; // Next extension
              }
            }
            return null;
          };
          imagePromises.push(loadAttempt());
        }

        const results = await Promise.all(imagePromises);
        results.forEach(desc => {
          if (desc) descriptions.push(desc);
        });

        if (descriptions.length > 0) {
          const displayName = personInfo && personInfo.name ? personInfo.name : label;
          const labeledDescriptor = new faceapi.LabeledFaceDescriptors(displayName, descriptions);
          labeledDescriptor.personInfo = personInfo;
          return labeledDescriptor;
        }
        return null;
      })
    );

    return validDescriptors.filter(d => d !== null);
  };

  return (
    <div className="facial-recognition-container">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <div className="loading-title">Initializing Face Recognition</div>
            <div className="loading-status">{loadingMessage}</div>
            <div className="loading-bar-container">
              <div className="loading-bar" style={{ width: `${loadingProgress}%` }} />
            </div>
            <div className="loading-percent">{loadingProgress}%</div>
          </div>
        </div>
      )}
      {error && <div className="error">{error}</div>}
      {/* Crowd Video Feed */}
      <div
        className="video-wrapper"
        ref={videoContainerRef}
        style={{
          position: 'relative',
          width: '100vw',
          height: '100vh',
          maxWidth: '100vw',
          maxHeight: '100vh',
          overflow: 'hidden',
          background: '#000'
        }}
      >
        <video
          ref={videoRef}
          src={crowdVideo}
          muted
          loop
          playsInline
          style={{
            width: '100vw',
            height: '100vh',
            objectFit: 'cover',
            background: '#000'
          }}
        />
        <canvas
          ref={canvasRef}
          className="face-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            objectFit: 'cover',
            pointerEvents: 'none'
          }}
        />
        {/* HUD Overlay */}
        <div className="video-hud">
          <div className="hud-left">
            <div className="hud-badge live">
              <span className="hud-dot red"></span>
              LIVE
            </div>
            <div className="hud-badge">
              <span className="hud-dot green"></span>
              <span className="hud-face-count">{faceCount}</span> face{faceCount !== 1 ? 's' : ''} detected
            </div>
            {descriptorsLoading && (
              <div className="hud-badge">
                <span className="hud-dot yellow"></span>
                Loading face database...
              </div>
            )}
            {!descriptorsLoading && labeledFaceDescriptorsRef.current && (
              <div className="hud-badge">
                <span className="hud-dot green"></span>
                {labeledFaceDescriptorsRef.current.length} known face{labeledFaceDescriptorsRef.current.length !== 1 ? 's' : ''} loaded
              </div>
            )}
          </div>
          <div className="hud-right">
            <div className="hud-badge">
              <span className={`hud-dot ${detectionActive ? 'green' : 'cyan'}`}></span>
              {detectionActive ? 'Detection Active' : 'Initializing...'}
            </div>
            {/* <button
              className={`mode-btn ${showAllFaces ? 'active' : ''}`}
              onClick={() => setShowAllFaces(!showAllFaces)}
              style={{ pointerEvents: 'auto', marginTop: 6 }}
            >
              {showAllFaces ? 'Hide Unknown Faces' : 'Show All Faces'}
            </button> */}
            <button className="mode-btn still-btn" onClick={() => setShowModal(true)} style={{ pointerEvents: 'auto', marginTop: 6 }}>
              Still Image Analysis
            </button>
          </div>
        </div>
        <button
          className="fullscreen-btn"
          style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            zIndex: 10,
            padding: '6px 12px',
            background: '#222',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          onClick={handleFullscreen}
        >
          Fullscreen
        </button>
      </div>
      {/* Modal for Still Image Analysis */}
      {showModal && (
        <div className="modal-overlay-2">
          <div className="modal-content-2">
            <div className="modal-header">
              <h2>IIIM Stills Analysis</h2>
              <div style={{ marginBottom: 12 }}>
                <button
                  className="clear-btn"
                  style={{
                    background: '#f5f5f7',
                    color: '#333',
                    border: '1px solid #bbb',
                    borderRadius: 20,
                    padding: '4px 18px',
                    fontWeight: 600,
                    fontSize: 15,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                    cursor: 'pointer',
                    marginRight: 4,
                    transition: 'background 0.2s, color 0.2s',
                  }}
                  onMouseOver={e => { e.target.style.background = '#e0e0e0'; e.target.style.color = '#111'; }}
                  onMouseOut={e => { e.target.style.background = '#f5f5f7'; e.target.style.color = '#333'; }}
                  onClick={() => {
                    setDetectedFaces([]);
                    setSocialMediaResults({});
                    setIsProcessingImage(false);
                    if (stillCanvasRef.current) {
                      const ctx = stillCanvasRef.current.getContext('2d');
                      ctx && ctx.clearRect(0, 0, stillCanvasRef.current.width, stillCanvasRef.current.height);
                    }
                    // Also clear file input value
                    const fileInput = document.getElementById('image-upload');
                    if (fileInput) fileInput.value = '';
                  }}
                >
                  <span style={{ fontSize: 17, marginRight: 6, verticalAlign: 'middle' }}></span>Clear
                </button>
              </div>
              <button style={{
                background: 'red',
                color: 'white',
                // border: '1px solid #bbb',
                borderRadius: 20,
                padding: '4px 18px',
                fontWeight: 600,
                fontSize: 15,
                // boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                cursor: 'pointer',
                marginRight: 4,
                transition: 'background 0.2s, color 0.2s',
              }} className="close-btn" onClick={() => setShowModal(false)}>Close</button>
            </div>
            <div className="modal-body">

              <div className="social-media-section">
                <h3>Social Media Profiles</h3>
                {isProcessingImage ? (
                  <div className="no-social-media">
                    <div className="loading-spinner" style={{ margin: '20px auto' }}></div>
                    <p>Searching for social media profiles...</p>
                  </div>
                ) : Object.keys(socialMediaResults).length > 0 ? (
                  <div className="social-media-grid">
                    {Object.entries(socialMediaResults).map(([platform, url], index) => {
                      const platformConfig = {
                        facebook: { color: '#3b5998', icon: 'fab fa-facebook-f' },
                        instagram: { color: '#e1306c', icon: 'fab fa-instagram' },
                        twitter: { color: '#1da1f2', icon: 'fab fa-twitter' },
                        linkedin: { color: '#0077b5', icon: 'fab fa-linkedin-in' },
                        github: { color: '#333', icon: 'fab fa-github' },
                        reddit: { color: '#ff4500', icon: 'fab fa-reddit-alien' }
                      };
                      const config = platformConfig[platform] || { color: '#666', icon: 'fas fa-globe' };
                      return (
                        <div className="social-media-card" key={index} style={{ borderColor: config.color }}>
                          <h4>{platform.charAt(0).toUpperCase() + platform.slice(1)}</h4>
                          <p className="social-url">{url}</p>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="social-media-link"
                            style={{ backgroundColor: config.color }}
                          >
                            <i className={config.icon}></i> View Profile
                          </a>
                        </div>

                      );
                    })}

                    <div className="social-media-card" style={{ borderColor: '#4285F4' }}>
                      <h4>Google Search</h4>
                      <p className="social-url">Search for "{detectedFaces[0]?.label}"</p>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(detectedFaces[0]?.label)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-media-link"
                        style={{ backgroundColor: '#4285F4' }}
                      >
                        <i className="fab fa-google"></i> Google It
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="no-social-media">
                    <p>No social media profiles found for this person.</p>
                    <p>Upload an image with a recognized face to see social media details.</p>
                  </div>
                )}
              </div>
              <div className="image-section">
                <div className="image-upload-container">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="image-upload"
                    id="image-upload"
                  />
                </div>
                <div className="canvas-container">
                  <canvas ref={stillCanvasRef} className="still-canvas" />
                  {isProcessingImage && (
                    <div className="loading-spinner-container">
                      <div className="loading-spinner"></div>
                      <div className="loading-text">Processing image and searching for faces...</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="info-section">
                {isProcessingImage ? (
                  <div className="person-info" style={{ textAlign: 'center' }}>
                    <div className="loading-spinner" style={{ margin: '20px auto' }}></div>
                    <p>Analyzing face data...</p>
                  </div>
                ) : detectedFaces.length > 0 ? (
                  detectedFaces.map((face, index) => (
                    <div key={index} className="person-info">
                      <h3>{face.label}</h3>
                      <div className="info-item">
                        <span className="info-label">Confidence:</span>
                        <span className="info-value">{face.confidence}%</span>
                      </div>
                      <div className="confidence-bar">
                        <div
                          className="confidence-level"
                          style={{ width: `${face.confidence}%` }}
                        />
                      </div>
                      {face.personInfo && Object.entries(face.personInfo).map(([key, value]) => (
                        <div key={key} className="info-item">
                          <span className="info-label">{key}:</span>
                          <span className="info-value">{value}</span>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="person-info">
                    <h3>No Face Data</h3>
                    <p>Upload an image to analyze face data</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FacialRecognition;