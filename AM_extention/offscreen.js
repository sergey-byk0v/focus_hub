let audioCtx = null;
let sourceNode = null;
let modOscillator = null;
let modGain = null;
let carrierGain = null;
let spatialPanner = null;
let spatialLFO = null;
let spatialWidthGain = null;
let currentStream = null;
let lowPass = null;
let highPass = null;
let dryGain = null;
let summer = null;
let crossoverEnabled = false;
let pinkNoiseSource = null;
let pinkNoiseGain = null;
let pinkNoiseBuffer = null;
let pinkNoiseModScale = null;
let currentNoiseType = 'pink';

const DEFAULT_PARAMS = {
  frequency: 16,
  depth: 0.5,
  waveform: 'sine',
  spatialEnabled: false,
  spatialSpeed: 0.3,
  spatialWidth: 0.7,
  crossoverEnabled: false,
  crossoverFreq: 300,
  pinkNoiseEnabled: false,
  pinkNoiseMix: 0.03,
  pinkNoiseModulate: false,
  noiseType: 'pink'
};

let params = { ...DEFAULT_PARAMS };

function generateWhiteNoise(numSamples) {
  const data = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return data;
}

function generatePinkNoise(numSamples) {
  const data = new Float32Array(numSamples);
  let white, pink;
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

  for (let i = 0; i < numSamples; i++) {
    white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
    data[i] = pink;
  }
  return data;
}

function generateBrownNoise(numSamples) {
  const data = new Float32Array(numSamples);
  let last = 0;
  let max = 0;
  for (let i = 0; i < numSamples; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + white * 0.15) * 0.98;
    if (Math.abs(last) > max) max = Math.abs(last);
    data[i] = last;
  }
  if (max > 0) {
    for (let i = 0; i < numSamples; i++) data[i] /= max;
  }
  return data;
}

function generateGrayNoise(numSamples) {
  const pink = generatePinkNoise(numSamples);
  const data = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    data[i] = pink[i] * 0.6 + (Math.random() * 2 - 1) * 0.4;
  }
  return data;
}

function createAudioGraph() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  carrierGain = audioCtx.createGain();
  carrierGain.gain.value = 1.0;

  modGain = audioCtx.createGain();
  modGain.gain.value = 0.0;

  spatialPanner = audioCtx.createStereoPanner();
  spatialPanner.pan.value = 0.0;

  spatialWidthGain = audioCtx.createGain();
  spatialWidthGain.gain.value = 0.0;

  lowPass = audioCtx.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = params.crossoverFreq;
  lowPass.Q.value = 0.5;

  highPass = audioCtx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = params.crossoverFreq;
  highPass.Q.value = 0.5;

  dryGain = audioCtx.createGain();
  dryGain.gain.value = 1.0;

  summer = audioCtx.createGain();
  summer.gain.value = 1.0;

  pinkNoiseGain = audioCtx.createGain();
  pinkNoiseGain.gain.value = 0.0;

  pinkNoiseModScale = audioCtx.createGain();
  pinkNoiseModScale.gain.value = 0;

  spatialPanner.connect(audioCtx.destination);
  modGain.connect(carrierGain.gain);
  modGain.connect(pinkNoiseModScale);
  pinkNoiseModScale.connect(pinkNoiseGain.gain);
  spatialWidthGain.connect(spatialPanner.pan);
  pinkNoiseGain.connect(spatialPanner);

  pinkNoiseBuffer = null;
}

function rewireGraph() {
  if (!sourceNode) return;

  sourceNode.disconnect();
  lowPass.disconnect();
  highPass.disconnect();
  dryGain.disconnect();
  summer.disconnect();
  carrierGain.disconnect();

  if (crossoverEnabled) {
    sourceNode.connect(lowPass);
    sourceNode.connect(highPass);
    lowPass.connect(carrierGain);
    highPass.connect(dryGain);
    carrierGain.connect(summer);
    dryGain.connect(summer);
    summer.connect(spatialPanner);
  } else {
    sourceNode.connect(carrierGain);
    carrierGain.connect(spatialPanner);
  }
}

function generateNoiseBuffer() {
  const sampleRate = audioCtx.sampleRate;
  const numSamples = sampleRate * 10;
  let data;

  switch (params.noiseType) {
    case 'white': data = generateWhiteNoise(numSamples); break;
    case 'pink':  data = generatePinkNoise(numSamples); break;
    case 'brown': data = generateBrownNoise(numSamples); break;
    case 'gray':  data = generateGrayNoise(numSamples); break;
    default:      data = generatePinkNoise(numSamples);
  }

  pinkNoiseBuffer = audioCtx.createBuffer(1, numSamples, sampleRate);
  pinkNoiseBuffer.getChannelData(0).set(data);
  currentNoiseType = params.noiseType;
}

function startPinkNoise() {
  if (!audioCtx) return;

  if (pinkNoiseSource) {
    pinkNoiseSource.disconnect();
    pinkNoiseSource = null;
  }

  if (!pinkNoiseBuffer || currentNoiseType !== params.noiseType) {
    generateNoiseBuffer();
  }

  pinkNoiseSource = audioCtx.createBufferSource();
  pinkNoiseSource.buffer = pinkNoiseBuffer;
  pinkNoiseSource.loop = true;
  pinkNoiseSource.connect(pinkNoiseGain);
  pinkNoiseGain.gain.setTargetAtTime(params.pinkNoiseMix, audioCtx.currentTime, 0.01);
  pinkNoiseSource.start();
}

function stopPinkNoise() {
  if (pinkNoiseSource) {
    pinkNoiseSource.stop();
    pinkNoiseSource.disconnect();
    pinkNoiseSource = null;
  }
  if (pinkNoiseGain) {
    pinkNoiseGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.01);
  }
}

async function startFromStreamId(streamId) {
  createAudioGraph();

  if (sourceNode) {
    sourceNode.disconnect();
  }

  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
  }

  const media = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    video: false
  });

  if (media.getAudioTracks().length === 0) {
    throw new Error('No audio tracks in captured stream. Make sure audio is playing.');
  }

  currentStream = media;
  sourceNode = audioCtx.createMediaStreamSource(media);
  rewireGraph();

  startModulator();
  startSpatialLFO();

  if (params.pinkNoiseEnabled) {
    startPinkNoise();
  }
}

function startModulator() {
  if (modOscillator) {
    modOscillator.stop();
    modOscillator.disconnect();
  }

  modOscillator = audioCtx.createOscillator();
  modOscillator.type = params.waveform;
  modOscillator.frequency.value = params.frequency;

  carrierGain.gain.value = 1.0;
  modGain.gain.value = params.depth;

  modOscillator.connect(modGain);
  modOscillator.start();
}

function startSpatialLFO() {
  if (spatialLFO) {
    spatialLFO.stop();
    spatialLFO.disconnect();
  }

  spatialLFO = audioCtx.createOscillator();
  spatialLFO.type = 'sine';
  spatialLFO.frequency.value = params.spatialSpeed;

  spatialLFO.connect(spatialWidthGain);
  spatialLFO.start();
}

function updateParams(newParams) {
  const prevCrossover = params.crossoverEnabled;
  const prevSpatial = params.spatialEnabled;
  const prevPinkNoise = params.pinkNoiseEnabled;
  const prevNoiseType = params.noiseType;
  Object.assign(params, newParams);

  if (audioCtx && modOscillator) {
    modOscillator.frequency.setTargetAtTime(params.frequency, audioCtx.currentTime, 0.01);
    modOscillator.type = params.waveform;

    carrierGain.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.01);
    modGain.gain.setTargetAtTime(params.depth, audioCtx.currentTime, 0.01);
    if (spatialLFO) {
      spatialLFO.frequency.setTargetAtTime(params.spatialSpeed, audioCtx.currentTime, 0.01);
    }

    if (params.spatialEnabled) {
      spatialWidthGain.gain.setTargetAtTime(params.spatialWidth, audioCtx.currentTime, 0.01);
    } else {
      spatialWidthGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.01);
    }

    if (params.spatialEnabled !== prevSpatial) {
      if (params.spatialEnabled) {
        startSpatialLFO();
      } else if (spatialLFO) {
        spatialLFO.stop();
        spatialLFO.disconnect();
        spatialLFO = null;
      }
    }

    if (params.crossoverEnabled !== prevCrossover) {
      crossoverEnabled = params.crossoverEnabled;
      rewireGraph();
    }

    if (audioCtx && lowPass) {
      lowPass.frequency.setTargetAtTime(params.crossoverFreq, audioCtx.currentTime, 0.01);
      highPass.frequency.setTargetAtTime(params.crossoverFreq, audioCtx.currentTime, 0.01);
    }

    if (params.pinkNoiseEnabled !== prevPinkNoise) {
      if (params.pinkNoiseEnabled) {
        startPinkNoise();
      } else {
        stopPinkNoise();
      }
    } else if (pinkNoiseGain) {
      if (params.noiseType !== prevNoiseType && params.pinkNoiseEnabled) {
        stopPinkNoise();
        startPinkNoise();
      } else {
        pinkNoiseGain.gain.setTargetAtTime(params.pinkNoiseEnabled ? params.pinkNoiseMix : 0, audioCtx.currentTime, 0.01);
        if (pinkNoiseModScale) {
          const target = params.pinkNoiseEnabled && params.pinkNoiseModulate ? params.pinkNoiseMix : 0;
          pinkNoiseModScale.gain.setTargetAtTime(target, audioCtx.currentTime, 0.01);
        }
      }
    }
  }
}

function stop() {
  stopPinkNoise();
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (modOscillator) {
    modOscillator.stop();
    modOscillator.disconnect();
    modOscillator = null;
  }
  if (spatialLFO) {
    spatialLFO.stop();
    spatialLFO.disconnect();
    spatialLFO = null;
  }
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SET_STREAM_ID') {
    startFromStreamId(message.streamId)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'UPDATE_PARAMS') {
    updateParams(message.params);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'PLAY_ALERT') {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.2);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'STOP') {
    stop();
    sendResponse({ success: true });
    return true;
  }
});
