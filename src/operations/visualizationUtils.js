
//draw bounding boxes on an faces
export function drawBoundingBoxes(image, boundingBoxes) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
  
    // Set canvas dimensions to match the image
    canvas.width = image.width;
    canvas.height = image.height;
  
    // Draw onto the canvas
    context.drawImage(image, 0, 0);
  
    // Draw bounding boxes on the canvas
    context.strokeStyle = 'red';
    context.lineWidth = 2;
    for (const bbox of boundingBoxes) {
      const [x, y, width, height] = bbox;
      context.strokeRect(x, y, width, height);
    }
  
    // Return the canvas with bounding boxes drawn
    return canvas;
  }
  