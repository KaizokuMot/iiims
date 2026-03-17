import React, { useEffect, useState } from "react";
import "./ML.css";
import Intel from "../TestDataPoint/Intel";
import NeuralNetWithVis from "../operations/NeuralNetVis";
import ImageData from "../TestDataPoint/ImageData";

function ML() {
  const [images, setImages] = useState([]);
  const [predictions, setPredictions] = useState([]);

  console.log("data ml", ImageData.imageData);

  useEffect(() => {
    setImages(ImageData.imageData);
    setPredictions(Intel.allInvestigations);
  }, []);

  return (
    <div>
      
      {/* <div>hello world</div> */}
      <NeuralNetWithVis images={images} predictions={predictions} />
    </div>
  );
}

export default ML;
