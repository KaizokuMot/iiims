// Import necessary libraries

import * as faceapi from 'face-api.js';

async function getLabeledDescriptors(labeledFaceImages) {
  const labeledDescriptors = [];

  // Load face detection and recognition models
  await faceapi.nets.tinyFaceDetector.loadFromUri('../models/');
  await faceapi.nets.faceLandmark68Net.loadFromUri('../models/');
  await faceapi.nets.faceRecognitionNet.loadFromUri('../models/');

  // Iterate over labeled face images
  for (const labeledFaceImage of labeledFaceImages) {
    const { name, imageURL } = labeledFaceImage;

    // Load the image
    const image = await faceapi.fetchImage(imageURL);

    // Detect faces in the image
    const detections = await faceapi.detectAllFaces(image).withFaceLandmarks().withFaceDescriptors();

    // Check if a face is detected
    if (detections.length > 0) {
      // Assuming only one face is in the image
      const descriptor = detections[0].descriptor;
      labeledDescriptors.push({ name, descriptor });
    }
  }

  return labeledDescriptors;
}

export default getLabeledDescriptors;
