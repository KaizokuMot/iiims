import React from 'react';
import NeuralNet from './NeuralNet';
import { drawBoundingBoxes } from './visualizationUtils.js'; 
const NeuralNetWithVis = ({ images, predictions }) => {
  // Implementing logic to visualize images and their bounding boxes
  const renderVisualization = () => {
    return images.map((image, index) => (
      <div key={index} className="image-container">
        <img src={image} alt={`Image ${index}`} className="image" />
        {/* Draw  boxes on the faces */}
        {/* <canvas ref={(canvas) => drawBoundingBoxes(canvas, predictions[index])} className="bounding-boxes"></canvas> */}
      </div>
    ));
  };

  return (
    <div>
      {/* Render NeuralNet component to perform predictions */}
      <NeuralNet images={images} predictions={predictions} />
      {/* Render visualization */}
      {renderVisualization()}
    </div>
  );
};

export default NeuralNetWithVis;
