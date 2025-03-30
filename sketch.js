let video;
let handPose;
let hands = [];
let audioContext;
let oscillator;
let gainNode;
let convolver;
let reference_distance = 20;

function preload() {
  handPose = ml5.handPose({ flipped: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioContext.suspend()
    oscillator = audioContext.createOscillator();
    gainNode = audioContext.createGain();
    convolver = audioContext.createConvolver();
    dryGain = audioContext.createGain();
    wetGain = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(0, audioContext.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(dryGain);
    gainNode.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(audioContext.destination);
    wetGain.connect(audioContext.destination);

    gainNode.gain.setValueAtTime(0.0, audioContext.currentTime); 
    setReverbIntensity(0.3);

    oscillator.start();

    loadReverb('BIG_HALL_E001_M2S.wav');
}

function setReverbIntensity(intensity) {
  console.log('Reverb intensity:', intensity);
  dryGain.gain.setValueAtTime(1.0 - intensity, audioContext.currentTime); 
  wetGain.gain.setValueAtTime(intensity, audioContext.currentTime);       
}

function loadReverb(url) {
  fetch(url)
    .then(response => response.arrayBuffer())
    .then(data => {
      audioContext.decodeAudioData(data, buffer => {
        convolver.buffer = buffer;
        console.log('Reverb loaded successfully');
      });
    })
    .catch(err => console.error('Error loading reverb:', err));
}

function startStop() {
  if (audioContext.state === 'suspended') {
    audioContext.resume().then(() => {
      console.log('Audio context resumed');
      if (hands.length > 0 && reference_distance === 20) {
        reference_distance = findAndCalculateDistance(hands[0].keypoints).distance;
        console.log("Reference distance: ", reference_distance);
      }
    });
  } else {
    audioContext.suspend().then(() => {
      console.log('Audio context suspended');
    });
  }
}

function keyPressed() {
  if (key === ' ') {
    startStop();
  }
}

function gotHands(results) {
  hands = results;
}

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO, { flipped: true });
  video.hide();
  handPose.detectStart(video, gotHands);
}

function findAndCalculateDistance(keypoints) {
  let point1 = { x: 0, y: 0 };
  let point2 = { x: 0, y: 0 };

  for (let keypoint of keypoints) {
    if (keypoint.name === "thumb_mcp") {
      point1 = keypoint;
    } else if (keypoint.name === "pinky_finger_mcp") {
      point2 = keypoint;
    }
  }

  let distance = dist(point1.x, point1.y, point2.x, point2.y);
  return { point1, point2, distance };
}

function draw() {
  image(video, 0, 0);
  if (hands.length > 0) {
    let hand = hands[0];
    if (hand.confidence > 0.1) {
      console.log(hand);
      let x = 0;
      let y = 0;
      let count = 0;

      let output = findAndCalculateDistance(hand.keypoints);
      let thumb_base = output.point1;
      let pinky_base = output.point2;
      let distance = output.distance;

      for (let keypoint of hand.keypoints) {
        if(["wrist", "mcp"].some(substring => keypoint.name.includes(substring))){
          console.log("KeyPoint: ", keypoint);
          x += keypoint.x;
          y += keypoint.y;
          count++;
        }
      }
      x /= count;
      y /= count;

      //Draw circle in the palm
      fill(255, 0, 255);
      noStroke();
      circle(x, y, 16);

      // Draw line between thumb and pinky
      stroke(255, 255, 0);
      strokeWeight(2);
      line(thumb_base.x, thumb_base.y, pinky_base.x, pinky_base.y);

      //Normalize distance for reference value to 1
      distance = distance / reference_distance;
      setReverbIntensity(1-distance);


      // Use the y-position of the wrist to determine the tone
      let frequency = map(y, height * 0.9, height * 0.1, 40, 5000, true);//TODO: logaritmic scale
      console.log("Frequency:", frequency);
      if (oscillator) {
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      }

      // Use the x-position of the wrist to determine the volume
      let volume = map(x, width * 0.9, width * 0.1, 0.0, 1.0, true);
      console.log("Volume:", volume);
      if (oscillator) {
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      }
    }
  }
}
