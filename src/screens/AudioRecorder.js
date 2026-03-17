import React, { useState, useRef, useEffect, createContext } from 'react';
import { useNavigate } from 'react-router-dom';
import './AudioRecorder.css';

// Create a context for sharing real-time transcription data
export const TranscriptionContext = createContext({
  transcript: '',
  isTranscribing: false,
  setTranscript: () => {},
});

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [analyserData, setAnalyserData] = useState(new Uint8Array(0));
  const [error, setError] = useState(null);
  const [realTimeTranscription, setRealTimeTranscription] = useState(true); // Enable real-time by default
  const [serverMessage, setServerMessage] = useState('');
  const [echoedAudioBlob, setEchoedAudioBlob] = useState(null);
  const [echoedTranscript, setEchoedTranscript] = useState('');

  // Create a value object for the TranscriptionContext
  const transcriptionValue = {
    transcript,
    isTranscribing,
    setTranscript
  };

  const navigate = useNavigate();

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const timerRef = useRef(null);
  const wsRef = useRef(null);
  const playbackAudioContextRef = useRef(null); // For playback of echoed audio
  const playbackSourceRef = useRef(null);
  const playbackQueueRef = useRef([]); // Queue for incoming audio chunks
  const isPlayingRef = useRef(false);
  const echoedChunksRef = useRef([]);

  // Initialize audio context and analyser
  useEffect(() => {
    try {
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();

      // Create analyser node
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      // Initialize analyser data array
      const bufferLength = analyserRef.current.frequencyBinCount;
      setAnalyserData(new Uint8Array(bufferLength));
    } catch (err) {
      setError('Error initializing audio context: ' + err.message);
    }

    // Clean up on component unmount
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Draw waveform visualization
  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Get frequency and time domain data
    const bufferLength = analyserRef.current.frequencyBinCount;
    const frequencyData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);

    analyserRef.current.getByteFrequencyData(frequencyData);
    analyserRef.current.getByteTimeDomainData(timeData);

    setAnalyserData(frequencyData);

    // Clear canvas
    ctx.fillStyle = '#131a24';
    ctx.fillRect(0, 0, width, height);

    // Draw frequency bars (bottom half)
    const barWidth = (width / bufferLength) * 2.5;
    let x = 0;

    // Create gradient for frequency bars
    const freqGradient = ctx.createLinearGradient(0, height/2, 0, height);
    freqGradient.addColorStop(0, '#10a37f');  // Green at top
    freqGradient.addColorStop(1, '#1a73e8');  // Blue at bottom

    ctx.fillStyle = freqGradient;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (frequencyData[i] / 255) * (height / 2);

      if (barHeight > 0) {
        // Add glow effect for active frequencies
        if (frequencyData[i] > 100) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#10a37f';
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
      }

      x += barWidth + 1;
    }

    // Draw time domain waveform (top half)
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.lineWidth = 2;

    // Create gradient for waveform line
    const waveGradient = ctx.createLinearGradient(0, 0, width, 0);
    waveGradient.addColorStop(0, '#e53935');  // Red
    waveGradient.addColorStop(0.5, '#ff9800');  // Orange
    waveGradient.addColorStop(1, '#e53935');  // Red

    ctx.strokeStyle = waveGradient;

    const sliceWidth = width / bufferLength;
    x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = timeData[i] / 128.0;
      const y = v * (height / 4) + (height / 4);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Add grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i < height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Vertical grid lines
    for (let i = 0; i < width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(drawWaveform);
  };

  // Start real-time transcription
  const startRealTimeTranscription = () => {
    try {
      // Check if the browser supports the Web Speech API
      if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
        setTranscript('Speech recognition is not supported in this browser. Try using Chrome for best results.');
        return null;
      }

      setIsTranscribing(true);
      setTranscript('Listening...');

      // Initialize speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;

      // Set up recognition event handlers
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join(' ');

        setTranscript(transcript);

        // Store in session storage for real-time access by other components
        sessionStorage.setItem('currentTranscript', transcript);

        // Broadcast transcript update via a custom event
        const transcriptEvent = new CustomEvent('transcriptUpdate', {
          detail: { transcript, isTranscribing: true }
        });
        window.dispatchEvent(transcriptEvent);
      };

      recognition.onerror = (event) => {
        setError('Error transcribing: ' + event.error);
        setIsTranscribing(false);
      };

      recognition.onend = () => {
        // If we're still recording, restart recognition
        if (isRecording) {
          recognition.start();
        } else {
          setIsTranscribing(false);

          // Broadcast transcription ended
          const transcriptEvent = new CustomEvent('transcriptUpdate', {
            detail: { transcript, isTranscribing: false }
          });
          window.dispatchEvent(transcriptEvent);
        }
      };

      // Start recognition
      recognition.start();
      return recognition;
    } catch (err) {
      setError('Error starting real-time transcription: ' + err.message);
      setIsTranscribing(false);
      return null;
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      // Reset state
      audioChunksRef.current = [];
      setAudioURL('');
      setTranscript('');
      setRecordingTime(0);
      setError(null);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Connect stream to audio context for visualization
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // Create media recorder
      mediaRecorderRef.current = new MediaRecorder(stream);

      // --- Use existing WebSocket connection ---
      // Do NOT create a new WebSocket here!
      // Send START message to server if needed
      if (wsRef.current && wsRef.current.readyState === 1) {
        wsRef.current.send(JSON.stringify({ type: 'START', timestamp: Date.now() }));
      }

      // Start recording timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      // Start visualization
      drawWaveform();
      // Start recording
      mediaRecorderRef.current.start();
      setIsRecording(true);
      // Start real-time transcription if enabled
      if (realTimeTranscription) {
        const recognition = startRealTimeTranscription();
        window.speechRecognitionInstance = recognition;
      }

      // Handle data available event
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          // Send audio chunk to server in real time
          if (wsRef.current && wsRef.current.readyState === 1) {
            event.data.arrayBuffer().then(buffer => {
              wsRef.current.send(buffer);
            });
          }
        }
      };

      // Handle recording stop event
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        const audioURL = URL.createObjectURL(audioBlob);
        setAudioURL(audioURL);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (!realTimeTranscription) {
          transcribeAudio(audioBlob);
        }
        sessionStorage.setItem('audioTranscript', transcript);
      };
    } catch (err) {
      setError('Error starting recording: ' + err.message);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      if (window.speechRecognitionInstance) {
        window.speechRecognitionInstance.stop();
        window.speechRecognitionInstance = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'STOP' }));
        } catch {}
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsRecording(false);
      setIsTranscribing(false);
      // Broadcast that transcription has ended
      const transcriptEvent = new CustomEvent('transcriptUpdate', {
        detail: { transcript, isTranscribing: false }
      });
      window.dispatchEvent(transcriptEvent);
      // --- Assemble echoed audio and transcribe ---
      if (echoedChunksRef.current.length > 0) {
        const echoedBlob = new Blob(echoedChunksRef.current, { type: 'audio/wav' });
        setEchoedAudioBlob(echoedBlob);
        transcribeEchoedAudio(echoedBlob);
      }
    }
  };

  // Transcribe audio using Web Speech API
  const transcribeAudio = async (audioBlob) => {
    try {
      // Check if the browser supports the Web Speech API
      if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
        setTranscript('Speech recognition is not supported in this browser. Try using Chrome for best results.');
        return;
      }

      setTranscript('Transcribing...');

      // Create audio element for playback during transcription
      const audioElement = new Audio(URL.createObjectURL(audioBlob));

      // Initialize speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = false;

      // Set up recognition event handlers
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join(' ');
        setTranscript(transcript);
      };

      recognition.onerror = (event) => {
        setError('Error transcribing: ' + event.error);
        audioElement.pause();
      };

      recognition.onend = () => {
        // If transcription ends before audio playback, restart it
        if (!audioElement.paused) {
          recognition.start();
        }
      };

      // Start recognition and audio playback
      recognition.start();
      audioElement.play();

      // When audio playback ends, stop recognition
      audioElement.onended = () => {
        recognition.stop();
      };

      // Fallback in case the Web Speech API doesn't work well
      setTimeout(() => {
        if (transcript === 'Transcribing...') {
          setTranscript('Transcription is taking longer than expected. The Web Speech API may not be fully supported in your browser. For best results, try using Google Chrome.');
        }
      }, 5000);
    } catch (err) {
      setError('Error transcribing audio: ' + err.message);

      // Fallback to simulated transcription
      setTranscript('Speech recognition failed. This would be where a cloud-based speech-to-text service like Google Speech-to-Text or Amazon Transcribe would be integrated in a production environment.');
    }
  };

  // Transcribe echoed audio using Web Speech API workaround
  const transcribeEchoedAudio = async (audioBlob) => {
    try {
      if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
        setEchoedTranscript('Speech recognition is not supported in this browser.');
        return;
      }
      setEchoedTranscript('Transcribing echoed audio...');
      const audioElement = new Audio(URL.createObjectURL(audioBlob));
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join(' ');
        setEchoedTranscript(transcript);
      };
      recognition.onerror = (event) => {
        setEchoedTranscript('Error transcribing: ' + event.error);
        audioElement.pause();
      };
      recognition.onend = () => {
        if (!audioElement.paused) {
          recognition.start();
        }
      };
      recognition.start();
      audioElement.play();
      audioElement.onended = () => {
        recognition.stop();
      };
      setTimeout(() => {
        if (echoedTranscript === 'Transcribing echoed audio...') {
          setEchoedTranscript('Transcription is taking longer than expected. The Web Speech API may not be fully supported in your browser.');
        }
      }, 5000);
    } catch (err) {
      setEchoedTranscript('Error transcribing echoed audio: ' + err.message);
    }
  };

  // Format recording time
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Save audio recording
  const saveRecording = () => {
    if (!audioBlob) return;

    const a = document.createElement('a');
    a.href = audioURL;
    a.download = `recording-${new Date().toISOString()}.wav`;
    a.click();
  };

  // Save transcript to text file
  const saveTranscript = () => {
    if (!transcript || transcript === 'Transcribing...') return;

    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Send transcript to AI Chat for analysis
  const sendToAIChat = () => {
    if (!transcript || transcript === 'Transcribing...' || transcript === 'Listening...') return;

    // Store the transcript in sessionStorage to retrieve it in the AI Chat component
    sessionStorage.setItem('audioTranscript', transcript);

    // Navigate to the AI Chat page - use the correct route
    navigate('/chat');
  };

  // Helper: Play audio buffer from received chunk
  const playReceivedAudioChunk = async (arrayBuffer) => {
    try {
      if (!playbackAudioContextRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        playbackAudioContextRef.current = new AudioContext();
      }
      const ctx = playbackAudioContextRef.current;
      // Decode audio data (assume PCM/WAV from server)
      ctx.decodeAudioData(arrayBuffer.slice(0), (audioBuffer) => {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();
        playbackSourceRef.current = source;
        // When finished, play next in queue
        source.onended = () => {
          isPlayingRef.current = false;
          if (playbackQueueRef.current.length > 0) {
            const nextBuffer = playbackQueueRef.current.shift();
            playReceivedAudioChunk(nextBuffer);
          }
        };
        isPlayingRef.current = true;
      }, (err) => {
        // Decoding error, skip this chunk
      });
    } catch (err) {
      // Ignore playback errors for now
    }
  };

  // Clean up playback context on component unmount
  useEffect(() => {
    return () => {
      if (playbackAudioContextRef.current) {
        playbackAudioContextRef.current.close();
        playbackAudioContextRef.current = null;
      }
      playbackQueueRef.current = [];
      isPlayingRef.current = false;
    };
  }, []);

  // --- WebSocket connection on mount, recording only on server broadcast ---
  useEffect(() => {
    wsRef.current = new window.WebSocket('wss://nvt.onrender.com/');
    wsRef.current.binaryType = 'arraybuffer';
    wsRef.current.onopen = () => {
      wsRef.current.send(JSON.stringify({ type: 'CLIENT_READY', timestamp: Date.now() }));
    };
    wsRef.current.onerror = (e) => {
      setError('WebSocket error: ' + e.message);
    };
    wsRef.current.onclose = () => {
      if (playbackAudioContextRef.current) {
        playbackAudioContextRef.current.close();
        playbackAudioContextRef.current = null;
      }
      playbackQueueRef.current = [];
      isPlayingRef.current = false;
    };
    wsRef.current.onmessage = (event) => {
      // Handle server broadcast control
      let msg;
      if (typeof event.data === 'string') {
        try {
          msg = JSON.parse(event.data);
        } catch {
          msg = event.data;
        }
        if (msg && msg.type === 'START_BROADCAST') {
          startRecording();
          setServerMessage('Broadcast started by server. Recording...');
          return;
        }
        if (msg && msg.type === 'STOP_BROADCAST') {
          stopRecording();
          setServerMessage('Broadcast stopped by server.');
          return;
        }
        setServerMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
      } else if (event.data instanceof ArrayBuffer) {
        echoedChunksRef.current.push(new Uint8Array(event.data));
        if (isPlayingRef.current) {
          playbackQueueRef.current.push(event.data);
        } else {
          playReceivedAudioChunk(event.data);
        }
        setServerMessage('Received audio chunk from server.');
      }
    };
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line
  }, []);

  return (
    <div className="audio-recorder-container" style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
      fontFamily: 'Segoe UI, Arial, sans-serif',
      padding: 0,
      margin: 0
    }}>
      <div className="audio-recorder-main" style={{
        maxWidth: 900,
        margin: '40px auto',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 24,
        boxShadow: '0 8px 32px 0 rgba(31,38,135,0.37)',
        padding: 32,
        display: 'flex',
        gap: 32,
        flexWrap: 'wrap',
        border: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div className='section1' style={{flex: 1, minWidth: 320}}>
          <div className="waveform-container" style={{marginBottom: 24}}>
            <canvas
              ref={canvasRef}
              className="waveform-canvas"
              width="600"
              height="200"
              style={{width: '100%', borderRadius: 12, background: '#181c24', boxShadow: '0 2px 8px #0002'}}
            />
            {isRecording && (
              <div className="recording-indicator" style={{marginTop: 16, display: 'flex', alignItems: 'center', gap: 8}}>
                <div className="recording-dot" style={{width: 14, height: 14, borderRadius: '50%', background: '#e53935', boxShadow: '0 0 8px #e53935'}}></div>
                <span style={{fontWeight: 500, color: '#fff'}}>Recording... {formatTime(recordingTime)}</span>
                {isTranscribing && <span className="transcribing-indicator" style={{color: '#10a37f', marginLeft: 8}}> (Transcribing in real-time)</span>}
              </div>
            )}
          </div>
          <div className="audio-controls" style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            <div className="transcription-toggle" style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={realTimeTranscription}
                  onChange={() => setRealTimeTranscription(!realTimeTranscription)}
                  disabled={isRecording}
                />
                <span className="toggle-slider"></span>
              </label>
              <span style={{color: '#fff'}}>Real-time Transcription</span>
            </div>
            {/* Only show Stop button since recording auto-starts */}
            {isRecording && (
              <button
                className="stop-button"
                onClick={stopRecording}
                style={{
                  background: 'linear-gradient(90deg, #e53935 0%, #ff9800 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 28px',
                  fontWeight: 600,

                  fontSize: 12,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px #e5393522',
                  marginTop: 8
                }}
              >
                <i className="fas fa-stop"></i> Stop Recording
              </button>
            )}
            {audioURL && (
              <div className="audio-playback" style={{marginTop: 24}}>
                <h3 style={{color: '#fff', marginBottom: 8}}>Playback</h3>
                <audio controls src={audioURL} className="audio-player" style={{width: '100%', borderRadius: 8}} />
                <button
                  className="save-button"
                  onClick={saveRecording}
                  style={{
                    background: 'linear-gradient(90deg, #1976d2 0%, #10a37f 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 20px',
                    fontWeight: 500,
                    fontSize: 16,
                    cursor: 'pointer',
                    marginTop: 8
                  }}
                >
                  <i className="fas fa-download"></i> Save Recording
                </button>
              </div>
            )}
          </div>
        </div>
        <div className='section2' style={{flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 24}}>
          {transcript && (
            <>
              <div className="transcript-container" style={{background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 20, boxShadow: '0 1px 6px #0001'}}>
                <div className="transcript-header" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                  <h3 style={{color: '#10a37f', margin: 0}}>Transcript {isTranscribing && <span className="live-indicator" style={{color: '#ff9800', fontSize: 16, marginLeft: 8}}>(Live)</span>}</h3>
                </div>
                <div className={`transcript-text ${isTranscribing ? 'live-transcript' : ''}`} style={{marginTop: 12, color: '#fff', fontSize: 17, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                  {transcript}
                  {isTranscribing && <span className="cursor-blink">|</span>}
                </div>
              </div>
              {/* Action buttons below the transcript card */}
              {transcript !== 'Transcribing...' && transcript !== 'Listening...' && (
                <div className="transcript-actions" style={{display: 'flex', gap: 12, marginTop: 16, justifyContent: 'flex-start'}}>
                  <button
                    className="save-transcript-button"
                    onClick={saveTranscript}
                    style={{background: '#fff', color: '#1976d2', border: 'none', borderRadius: 6, padding: '8px 20px', fontWeight: 500, cursor: 'pointer'}}>
                    <i className="fas fa-file-download"></i> Save
                  </button>
                  <button
                    className="analyze-transcript-button"
                    onClick={sendToAIChat}
                    style={{background: '#fff', color: '#10a37f', border: 'none', borderRadius: 6, padding: '8px 20px', fontWeight: 500, cursor: 'pointer'}}>
                    <i className="fas fa-robot"></i> Analyze with AI
                  </button>
                  <button
                    className="view-in-chat-button"
                    onClick={() => navigate('/chat')}
                    style={{background: '#fff', color: '#e53935', border: 'none', borderRadius: 6, padding: '8px 20px', fontWeight: 500, cursor: 'pointer'}}>
                    <i className="fas fa-comments"></i> View in Chat
                  </button>
                </div>
              )}
            </>
          )}
          {error && (
            <div className="error-message" style={{background: '#e53935', color: '#fff', borderRadius: 8, padding: 12, marginTop: 8, fontWeight: 500}}>
              <i className="fas fa-exclamation-triangle"></i> {error}
            </div>
          )}
          {serverMessage && (
            <div className="server-message" style={{ margin: '10px 0', color: '#1976d2', fontSize: 14, background: '#fff', borderRadius: 6, padding: 8, fontWeight: 500 }}>
              <b>Server:</b> {serverMessage}
            </div>
          )}
          {/* Echoed audio playback and transcript UI */}
          {echoedAudioBlob && (
            <div className="audio-playback" style={{background: 'rgba(16,163,127,0.08)', borderRadius: 12, padding: 16, marginTop: 12, boxShadow: '0 1px 6px #10a37f22'}}>
              <h3 style={{color: '#10a37f', marginBottom: 8}}>Echoed Audio Playback (from server)</h3>
              <audio controls src={URL.createObjectURL(echoedAudioBlob)} className="audio-player" style={{width: '100%', borderRadius: 8}} />
              {echoedTranscript && (
                <div className="transcript-container" style={{background: '#fff', borderRadius: 8, padding: 12, marginTop: 10, color: '#232526', fontWeight: 500, fontSize: 16}}>
                  <div className="transcript-header">
                    <h4 style={{margin: 0, color: '#10a37f'}}>Echoed Audio Transcript</h4>
                  </div>
                  <div className="transcript-text">
                    {echoedTranscript}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder;
