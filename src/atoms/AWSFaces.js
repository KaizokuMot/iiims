import React, { useEffect, useRef } from 'react'
import "@tensorflow/tfjs"
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "./AWSFaces.css"

function AWSFaces() {
  const canvasRef = useRef();
  const videoRef = useRef();


  useEffect(() => {
    const setupCamera = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: "user" }
          });
          videoRef.current.srcObject = stream;
          return new Promise(resolve => {
            videoRef.current.onloadedmetadata = () => {
              resolve();
            };
          });
        } catch (err) {
          console.error("Error accessing the camera:", err);
        }
      }
    };

    const detectFrame = async () => {
      try {
        const model = await cocoSsd.load();
        await setupCamera();
        while (true) {
          const predictions = await model.detect(videoRef.current);
          renderPredictions(predictions);
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
      } catch (err) {
        console.error("Error detecting objects:", err);
      }
    };

    detectFrame();
    return () => {
      if (videoRef.current.srcObject) {
        videoRef.current.srcObject.getVideoTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, [])

  const renderPredictions = predictions => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const font = "16px sans-serif";
    ctx.font = font;
    ctx.textBaseline = "top";

    predictions.forEach(prediction => {
      const x = prediction.bbox[0];
      const y = prediction.bbox[1];
      const width = prediction.bbox[2];
      const height = prediction.bbox[3];

      ctx.strokeStyle = "#131a24";
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = "#00FFFF";
      const textWidth = ctx.measureText(prediction.class).width;
      const textHeight = parseInt(font, 10);
      ctx.fillRect(x, y, textWidth + 4, textHeight + 4);

      ctx.fillStyle = "#000000";
      ctx.fillText(prediction.class, x, y);
    });
  };

  return (
    <div className='face-recog-page'>
      <div>
        <video
          className="size"
          autoPlay
          playsInline
          muted
          ref={videoRef}
          width="600"
          height="500"
        />
        <canvas
          className="size"
          ref={canvasRef}
          width="600"
          height="500"
        />
      </div>
    </div>

  );
}

export default AWSFaces