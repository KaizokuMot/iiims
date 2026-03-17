import React, { useEffect, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import data from '../TestDataPoint/Intel';
import "./NeualNet.css"
import JsonFormatter from "react-json-formatter"
import {visor} from '@tensorflow/tfjs-vis';
import * as tfvis from '@tensorflow/tfjs-vis';

//lets try this with a feedforward with a hyperbolic tangent

const NeuralNet = () => {
 
 
  const [model, setModel] = useState(null);
  const [threats, setThreats] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
 
  const [selectedThreatId, setSelectedThreatId] = useState(null);


  useEffect(() => {

    const prepareData = () => {
      // Preprocess the data and define input features (X) and target labels (Y)
      const X = []; //input features
      const Y = []; //target labels

      data.allInvestigations.forEach(investigation => {
        // Convert relevant features to numerical values
        const numericPriority = { 'low': 0, 'medium': 1, 'high': 2 }[investigation.priority];
        const numericStatus = investigation.status === 'closed' ? 0 : 1;
        //
        const numericAgency = { 'Police': 0, 'ISO': 1, 'ESO': 2, 'CMI': 3, 'CT': 4 }[investigation.agency];
        
        // Create feature vector
        const featureVector = [
          numericPriority,
          numericStatus,
          numericAgency
          //  more features I can add
        ];

        // Push feature vector to X[]
        X.push(featureVector);

        // Determine target label (1 for threat, 0 for non-threat)
        const isThreat = investigation.intelType !== 'Fraud' && investigation.intelType !== 'Counterfeiting'; // what is a threat(can anything
        const label = isThreat ? 1 : 0;

        // Push label to Y[]
        Y.push(label);
      });

      return { X, Y };
    };

    const trainModel = async () => {
      setLoadingProgress(0); 
      const { X, Y } = prepareData();
      // Defining neural network model
      const inputShape = [X[0].length];
      const model = tf.sequential();
      model.add(tf.layers.dense({ units: 64, inputShape, activation: 'relu' })); //rectified linear units 
      model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
      model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

      model.compile({
        optimizer: 'adam',
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
      });

      // Test Training
      const xs = tf.tensor2d(X);
      const ys = tf.tensor2d(Y, [Y.length, 1]);
      await model.fit(xs, ys, { epochs: 10 });

      // Save it
      setModel(model);

      // Clean up
      xs.dispose();
      ys.dispose();

      setLoadingProgress(100); // kale nga: 10% progress

    };

    // let's train the model bwana when the component mounts
    trainModel();
  }, []);

  useEffect(() => {


 const predictThreats = async () => {
  if (model) {
    const predictions = [];
    const today = new Date(); // Use today's date as the base


    data.allInvestigations.forEach(investigation => {
      const features = [
        { 'low': 0, 'medium': 1, 'high': 2 }[investigation.priority],
        investigation.status === 'closed' ? 0 : 1,
        { 'Police': 0, 'ISO': 1, 'ESO': 2, 'CMI': 3, 'CT': 4 }[investigation.agency]
      ];

      const input = tf.tensor2d([features]);
      const prediction = model.predict(input).dataSync()[0];

      // Calculate the threat date based on today's date
      const threatDate = new Date(today);
      const daysToAdd = Math.round(prediction * 30); // Assuming each prediction is for the next 30 days
      threatDate.setDate(today.getDate() + daysToAdd);

      predictions.push({ 
        id: investigation.id, 
        prediction, 
        originalDate: new Date(investigation.dateCreated), 
        predictedDate: threatDate 
      });
    });

    setThreats(predictions);
  }
};


    predictThreats();
    if (tfvis && model) {
      const visorInstance = visor();
      visorInstance.open();
      tfvis.show.modelSummary({ name: 'Model Summary', tab: 'Model' }, model);
      // const surface = tfvis.visor().surface({ name: 'Barchart', tab: 'Charts' });

      // Render a barchart on that surface
   //   tfvis.render.barchart(surface, model, {});
    }
  }, [model]);

  const jsonStyle = {
    propertyStyle: { color: 'green' },
    stringStyle: { color: 'green' },
    numberStyle: { color: 'darkorange' }
  }


  return (
    <div className='predictions-holder'>
  {model && (
  <div className='alogrithm-data'>
    <h2 style={{color:"white", margin:"20px"}}>Neural Network Output</h2>
    <JsonFormatter json={model.toJSON()}  jsonStyle={jsonStyle} tabWidth={4} />
  </div>
      )}
      <div className='prediction-data'>
         <h2 className='prd-title'>Predicted Threats</h2>
      <ul>
        {threats.map(threat => (
          <li key={threat.id} >
            Threat Type: {threat.id} (Original Date: {threat.originalDate.toDateString()}, Predicted Date: {threat.predictedDate.toDateString()}, Prediction Probability: {Math.round(threat.prediction * 100)}%)

            {data.allInvestigations.filter(investigation => investigation.id === threat.id).map((caseItem, index) => (
              <div key={index}>
                <p>Case ID: {caseItem.id}</p>
                <p>Intel Type: {caseItem.intelType}</p>
              </div>
            ))}
          </li>
        ))}
      </ul>
      </div>
      <div className='loading-progress'>
        <p>Neural Network Training Progress: {loadingProgress}%</p>
      </div>
    </div>
  );
};


export default NeuralNet;

