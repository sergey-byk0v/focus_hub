let audioCtx = null;
let sourceNode = null;
let modOscillator = null;
let modGain = null;
let carrierGain = null;
let spatialPanner = null;
let spatialLFO = null;
let spatialWidthGain = null;
let currentStream = null;

const DEFAULT_PARAMS = {
  frequency: 16,
  depth: 0.5,
  waveform: 'sine',
  spatialEnabled: false,
  spatialSpeed: 0.3,
  spatialWidth: 0.7
};

let params = { ...DEFAULT_PARAMS };

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

  carrierGain.connect(spatialPanner);
  spatialPanner.connect(audioCtx.destination);

  modGain.connect(carrierGain.gain);
  spatialWidthGain.connect(spatialPanner.pan);

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
  sourceNode.connect(carrierGain);

  startModulator();
  startSpatialLFO();
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
  }
}

function stop() {
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
