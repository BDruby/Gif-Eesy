import confetti from 'canvas-confetti';
import { extractVideoFrames } from './engine/video-processor.js';
import { decodeGif, processGifFramesForCompression } from './engine/gif-optimizer.js';
import { generateSampleVideo } from './engine/sample-generator.js';

// --- State Management ---
const state = {
  mode: 'video', // 'video' | 'compress'
  file: null,
  fileType: null, // 'video' | 'gif'
  fileSize: 0,
  
  // Media dimensions & metadata
  mediaWidth: 0,
  mediaHeight: 0,
  duration: 0,

  // Video playback
  isPlaying: false,
  loopSegment: true,

  // Trimmer
  trimStart: 0,
  trimEnd: 3.0,

  // Cropping
  cropActive: false,
  cropRatio: 'free', // 'free' | '1:1' | '9:16' | '16:9' | '4:3'
  crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, // relative 0..1

  // Video settings
  resolution: 400,
  fps: 12,
  speed: 1.0,
  playback: 'normal',
  colors: 64,
  dither: true,
  topText: '',
  bottomText: '',
  watermark: '',
  watermarkPos: 'br',

  // Compress settings
  compressScale: 0.75,
  compressSkip: 1,
  compressColors: 64,

  // Result
  resultBlob: null,
  resultUrl: null,

  // Worker
  worker: null
};

// --- DOM Elements ---
const dom = {
  brandRefreshLink: document.getElementById('brand-refresh-link'),
  tabVideo: document.getElementById('tab-video'),
  tabCompress: document.getElementById('tab-compress'),
  btnQuickSample: document.getElementById('btn-quick-sample'),
  
  uploadZone: document.getElementById('upload-zone'),
  uploadTitle: document.getElementById('upload-title-text'),
  uploadDesc: document.getElementById('upload-desc-text'),
  fileInput: document.getElementById('file-input'),
  btnBrowseFile: document.getElementById('btn-browse-file'),
  btnLoadDemoVideo: document.getElementById('btn-load-demo-video'),

  editorWorkspace: document.getElementById('editor-workspace'),
  btnChangeFile: document.getElementById('btn-change-file'),
  fileBadge: document.getElementById('file-badge'),
  fileName: document.getElementById('file-name'),
  fileSpecs: document.getElementById('file-specs'),

  // Stage & Video
  viewportWrapper: document.getElementById('viewport-wrapper'),
  mediaContainer: document.getElementById('media-container'),
  mediaStageFrame: document.getElementById('media-stage-frame'),
  previewVideo: document.getElementById('preview-video'),
  previewCanvas: document.getElementById('preview-canvas'),
  cropBox: document.getElementById('crop-box'),
  cropDimBadge: document.getElementById('crop-dim-badge'),
  resCalcBadge: document.getElementById('res-calc-badge'),
  btnToggleCrop: document.getElementById('btn-toggle-crop'),
  btnToggleLoop: document.getElementById('btn-toggle-loop'),
  btnPlayPause: document.getElementById('btn-play-pause'),
  iconPlay: document.getElementById('icon-play'),
  iconPause: document.getElementById('icon-pause'),
  timeCurrent: document.getElementById('time-current'),
  timeDuration: document.getElementById('time-duration'),

  // Timeline
  timelineContainer: document.getElementById('timeline-container'),
  clipRangeText: document.getElementById('clip-range-text'),
  clipDurationBadge: document.getElementById('clip-duration-badge'),
  timelineTrackWrap: document.getElementById('timeline-track-wrap'),
  timelineSelection: document.getElementById('timeline-selection'),
  handleStart: document.getElementById('handle-start'),
  handleEnd: document.getElementById('handle-end'),
  timelinePlayhead: document.getElementById('timeline-playhead'),
  btnNudgeLeft: document.getElementById('btn-nudge-left'),
  btnNudgeRight: document.getElementById('btn-nudge-right'),
  btnResetRange: document.getElementById('btn-reset-range'),

  // Meme Overlay
  memeOverlay: document.getElementById('meme-overlay'),
  memePreviewTop: document.getElementById('meme-preview-top'),
  memePreviewBottom: document.getElementById('meme-preview-bottom'),
  watermarkPreview: document.getElementById('watermark-preview'),

  // Controls Panels
  videoSpecificControls: document.getElementById('video-specific-controls'),
  compressSpecificControls: document.getElementById('compress-specific-controls'),

  // Inputs
  fpsSlider: document.getElementById('slider-fps'),
  fpsVal: document.getElementById('fps-val'),
  switchDither: document.getElementById('switch-dither'),
  inputTopText: document.getElementById('input-top-text'),
  inputBottomText: document.getElementById('input-bottom-text'),
  inputWatermark: document.getElementById('input-watermark'),
  selectWatermarkPos: document.getElementById('select-watermark-pos'),
  
  compressScaleSlider: document.getElementById('slider-compress-scale'),
  compressScaleVal: document.getElementById('compress-scale-val'),

  // Footer & Estimation
  estText: document.getElementById('est-text'),
  btnGenerate: document.getElementById('btn-generate-gif'),
  btnGenerateText: document.getElementById('btn-generate-text'),

  // Modals
  modalProcessing: document.getElementById('modal-processing'),
  progressTitle: document.getElementById('progress-status-title'),
  progressSub: document.getElementById('progress-status-sub'),
  progressBarFill: document.getElementById('progress-bar-fill'),
  progressPercent: document.getElementById('progress-percent'),
  progressFrames: document.getElementById('progress-frames'),
  btnCancelProcess: document.getElementById('btn-cancel-process'),

  modalResult: document.getElementById('modal-result'),
  resultImg: document.getElementById('result-gif-img'),
  resStatSize: document.getElementById('res-stat-size'),
  resStatDim: document.getElementById('res-stat-dim'),
  resStatFrames: document.getElementById('res-stat-frames'),
  resStatSaving: document.getElementById('res-stat-saving'),
  btnDownloadGif: document.getElementById('btn-download-gif'),
  btnCopyClipboard: document.getElementById('btn-copy-clipboard'),
  btnShareMobile: document.getElementById('btn-share-mobile'),
  btnCloseResult: document.getElementById('btn-close-result')
};

// --- Initialization ---
function init() {
  if (dom.brandRefreshLink) {
    dom.brandRefreshLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.reload();
    });
  }

  window.addEventListener('resize', () => {
    updateStageFrameSize();
  });

  bindTabEvents();
  bindUploadEvents();
  bindPlayerEvents();
  bindTimelineEvents();
  bindCropEvents();
  bindControlsEvents();
  bindResultEvents();
  updateEstimation();
}

// --- Tabs & Mode Switching ---
function bindTabEvents() {
  dom.tabVideo.addEventListener('click', () => setMode('video'));
  dom.tabCompress.addEventListener('click', () => setMode('compress'));

  dom.btnQuickSample.addEventListener('click', async () => {
    loadSampleDemo();
  });
}

function setMode(mode) {
  state.mode = mode;
  dom.tabVideo.classList.toggle('active', mode === 'video');
  dom.tabCompress.classList.toggle('active', mode === 'compress');
  dom.tabVideo.setAttribute('aria-selected', mode === 'video');
  dom.tabCompress.setAttribute('aria-selected', mode === 'compress');

  if (mode === 'video') {
    dom.uploadTitle.textContent = '点击或拖拽上传视频 (MP4, WebM, MOV)';
    dom.uploadDesc.textContent = '精准剪辑、自由裁剪、倒放鬼畜与个性文字水印，一键导出高清或表情包动图';
    dom.btnGenerateText.textContent = '立即生成 GIF 动图';
    dom.videoSpecificControls.classList.remove('hidden');
    dom.compressSpecificControls.classList.add('hidden');
    dom.timelineContainer.classList.remove('hidden');
    dom.btnToggleCrop.classList.remove('hidden');
  } else {
    dom.uploadTitle.textContent = '点击或拖拽上传需要压缩的 GIF 动图';
    dom.uploadDesc.textContent = '智能抽帧、深度量化重采样、缩减无损体积，轻松突破微信 1MB / 5MB 表情限制';
    dom.btnGenerateText.textContent = '立即极速压缩 GIF';
    dom.videoSpecificControls.classList.add('hidden');
    dom.compressSpecificControls.classList.remove('hidden');
    dom.timelineContainer.classList.add('hidden');
    dom.btnToggleCrop.classList.add('hidden');
    disableCrop();
  }

  updateEstimation();
}

// --- Upload & File Ingestion ---
function bindUploadEvents() {
  dom.btnBrowseFile.addEventListener('click', () => dom.fileInput.click());
  dom.btnChangeFile.addEventListener('click', () => dom.fileInput.click());

  dom.btnLoadDemoVideo.addEventListener('click', () => loadSampleDemo());

  dom.fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  });

  // Drag & Drop
  const dropZone = dom.uploadZone;
  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.querySelector('.upload-card').classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.querySelector('.upload-card').classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });
}

async function loadSampleDemo() {
  dom.btnLoadDemoVideo.disabled = true;
  dom.btnLoadDemoVideo.innerHTML = '<span>⚡ 正在实时合成演示视频...</span>';
  try {
    const file = await generateSampleVideo();
    handleFile(file);
  } catch (err) {
    console.error('Failed to generate sample video:', err);
    alert('合成演示视频失败，请手动选择本地视频文件');
  } finally {
    dom.btnLoadDemoVideo.disabled = false;
    dom.btnLoadDemoVideo.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      <span>加载动态演示视频</span>
    `;
  }
}

async function handleFile(file) {
  state.file = file;
  state.fileSize = file.size;

  const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
  state.fileType = isGif ? 'gif' : 'video';

  // Automatically adjust mode if file doesn't match current tab
  if (isGif && state.mode !== 'compress') {
    setMode('compress');
  } else if (!isGif && state.mode !== 'video') {
    setMode('video');
  }

  // Update Top Info Bar
  dom.fileName.textContent = file.name;
  dom.fileBadge.textContent = isGif ? 'GIF 动图' : 'VIDEO 视频';
  dom.fileBadge.className = isGif ? 'badge' : 'badge badge-emerald';

  if (isGif) {
    await loadGifFile(file);
  } else {
    await loadVideoFile(file);
  }

  dom.uploadZone.classList.add('hidden');
  dom.editorWorkspace.classList.remove('hidden');
  updateEstimation();
}

// Load Video Media
function loadVideoFile(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = dom.previewVideo;
    dom.previewCanvas.classList.add('hidden');
    video.classList.remove('hidden');

    video.src = url;
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      state.mediaWidth = video.videoWidth;
      state.mediaHeight = video.videoHeight;
      state.duration = video.duration || 5;

      // Set initial clip range: default to first 3 seconds or full video if shorter
      state.trimStart = 0;
      state.trimEnd = Math.min(video.duration, 3.5);

      dom.fileSpecs.textContent = `${video.videoWidth}×${video.videoHeight} • ${formatTime(video.duration)} • ${formatSize(file.size)}`;
      dom.timeDuration.textContent = formatTime(video.duration);

      updateStageFrameSize();
      updateTimelineUI();
      updateCropUI();
      video.currentTime = 0;
      resolve();
    };
  });
}

// Load GIF Media
async function loadGifFile(file) {
  const buffer = await file.arrayBuffer();
  try {
    const decoded = decodeGif(buffer);
    state.decodedGif = decoded;
    state.mediaWidth = decoded.width;
    state.mediaHeight = decoded.height;
    state.duration = decoded.duration;

    dom.previewVideo.classList.add('hidden');
    dom.previewCanvas.classList.remove('hidden');

    // Draw first frame on preview canvas
    const canvas = dom.previewCanvas;
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const ctx = canvas.getContext('2d');
    
    if (decoded.frames.length > 0) {
      const imgData = ctx.createImageData(decoded.width, decoded.height);
      imgData.data.set(decoded.frames[0].data);
      ctx.putImageData(imgData, 0, 0);
    }

    dom.fileSpecs.textContent = `${decoded.width}×${decoded.height} • ${decoded.frames.length} 帧 • ${decoded.duration.toFixed(1)}s • ${formatSize(file.size)}`;
    dom.timeDuration.textContent = formatTime(decoded.duration);
    
    updateStageFrameSize();
    // Play GIF animation on canvas
    playDecodedGifAnimation();
  } catch (err) {
    console.error('Failed to decode GIF:', err);
    alert('无法解析该 GIF 文件，请检查文件是否损坏');
  }
}

let gifAnimId = null;
function playDecodedGifAnimation() {
  if (!state.decodedGif) return;
  if (gifAnimId) cancelAnimationFrame(gifAnimId);

  const canvas = dom.previewCanvas;
  const ctx = canvas.getContext('2d');
  const frames = state.decodedGif.frames;
  let currentFrame = 0;
  let lastTime = performance.now();

  const renderLoop = (now) => {
    const elapsed = now - lastTime;
    const targetDelay = frames[currentFrame]?.delay || 100;

    if (elapsed >= targetDelay) {
      currentFrame = (currentFrame + 1) % frames.length;
      const imgData = ctx.createImageData(canvas.width, canvas.height);
      imgData.data.set(frames[currentFrame].data);
      ctx.putImageData(imgData, 0, 0);
      lastTime = now;
      
      const currentTime = frames.slice(0, currentFrame).reduce((acc, f) => acc + f.delay, 0) / 1000;
      dom.timeCurrent.textContent = formatTime(currentTime);
    }

    gifAnimId = requestAnimationFrame(renderLoop);
  };

  gifAnimId = requestAnimationFrame(renderLoop);
}

// --- Player & Playback Loop ---
function bindPlayerEvents() {
  const video = dom.previewVideo;

  dom.btnPlayPause.addEventListener('click', togglePlayPause);

  video.addEventListener('timeupdate', () => {
    dom.timeCurrent.textContent = formatTime(video.currentTime);
    updatePlayheadPosition();

    // Segment loop check
    if (state.loopSegment && state.mode === 'video') {
      if (video.currentTime >= state.trimEnd) {
        video.currentTime = state.trimStart;
      }
    }
  });

  video.addEventListener('ended', () => {
    if (state.loopSegment) {
      video.currentTime = state.trimStart;
      video.play();
    } else {
      setPlayState(false);
    }
  });

  dom.btnToggleLoop.addEventListener('click', () => {
    state.loopSegment = !state.loopSegment;
    dom.btnToggleLoop.classList.toggle('active', state.loopSegment);
  });
}

function togglePlayPause() {
  const video = dom.previewVideo;
  if (state.mode === 'video') {
    if (video.paused) {
      if (video.currentTime >= state.trimEnd || video.currentTime < state.trimStart) {
        video.currentTime = state.trimStart;
      }
      video.play();
      setPlayState(true);
    } else {
      video.pause();
      setPlayState(false);
    }
  }
}

function setPlayState(playing) {
  state.isPlaying = playing;
  dom.iconPlay.classList.toggle('hidden', playing);
  dom.iconPause.classList.toggle('hidden', !playing);
}

// --- Timeline Trimmer (Pointer Interaction) ---
function bindTimelineEvents() {
  let draggingHandle = null;

  const onPointerDown = (e, handleType) => {
    e.preventDefault();
    e.stopPropagation();
    draggingHandle = handleType;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  dom.handleStart.addEventListener('pointerdown', (e) => onPointerDown(e, 'start'));
  dom.handleEnd.addEventListener('pointerdown', (e) => onPointerDown(e, 'end'));

  // Clicking directly on track to seek
  dom.timelineTrackWrap.addEventListener('pointerdown', (e) => {
    if (e.target === dom.handleStart || e.target === dom.handleEnd) return;
    const rect = dom.timelineTrackWrap.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const seekTime = ratio * state.duration;

    if (state.mode === 'video') {
      dom.previewVideo.currentTime = seekTime;
    }
  });

  const onPointerMove = (e) => {
    if (!draggingHandle) return;
    const rect = dom.timelineTrackWrap.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = ratio * state.duration;

    const minClip = 0.3; // minimum duration

    if (draggingHandle === 'start') {
      state.trimStart = Math.min(time, state.trimEnd - minClip);
      state.trimStart = Math.max(0, state.trimStart);
      dom.previewVideo.currentTime = state.trimStart;
    } else if (draggingHandle === 'end') {
      state.trimEnd = Math.max(time, state.trimStart + minClip);
      state.trimEnd = Math.min(state.duration, state.trimEnd);
      dom.previewVideo.currentTime = state.trimEnd;
    }

    updateTimelineUI();
    updateEstimation();
  };

  const onPointerUp = () => {
    draggingHandle = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  // Nudge buttons
  dom.btnNudgeLeft.addEventListener('click', () => {
    state.trimStart = Math.max(0, state.trimStart - 0.1);
    dom.previewVideo.currentTime = state.trimStart;
    updateTimelineUI();
    updateEstimation();
  });

  dom.btnNudgeRight.addEventListener('click', () => {
    state.trimEnd = Math.min(state.duration, state.trimEnd + 0.1);
    dom.previewVideo.currentTime = state.trimEnd;
    updateTimelineUI();
    updateEstimation();
  });

  dom.btnResetRange.addEventListener('click', () => {
    state.trimStart = 0;
    state.trimEnd = state.duration;
    dom.previewVideo.currentTime = 0;
    updateTimelineUI();
    updateEstimation();
  });
}

function updateTimelineUI() {
  if (!state.duration) return;
  const startPercent = (state.trimStart / state.duration) * 100;
  const endPercent = (state.trimEnd / state.duration) * 100;

  dom.timelineSelection.style.left = `${startPercent}%`;
  dom.timelineSelection.style.right = `${100 - endPercent}%`;

  const dur = Math.max(0.1, state.trimEnd - state.trimStart);
  dom.clipRangeText.textContent = `${formatTime(state.trimStart)} ~ ${formatTime(state.trimEnd)}`;
  dom.clipDurationBadge.textContent = `${dur.toFixed(1)} 秒`;
}

function updatePlayheadPosition() {
  if (!state.duration) return;
  const video = dom.previewVideo;
  const percent = (video.currentTime / state.duration) * 100;
  dom.timelinePlayhead.style.left = `${percent}%`;
}

// --- Cropping Interaction ---
function bindCropEvents() {
  dom.btnToggleCrop.addEventListener('click', () => {
    state.cropActive = !state.cropActive;
    dom.btnToggleCrop.classList.toggle('active', state.cropActive);
    dom.cropBox.classList.toggle('hidden', !state.cropActive);
    if (state.cropActive) {
      applyCropRatio(state.cropRatio);
      updateCropUI();
    }
  });

  // Ratio chips
  const chips = document.querySelectorAll('#crop-ratio-chips .chip-btn');
  chips.forEach(btn => {
    btn.addEventListener('click', () => {
      chips.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const ratio = btn.dataset.ratio;
      state.cropRatio = ratio;
      
      if (!state.cropActive) {
        state.cropActive = true;
        dom.btnToggleCrop.classList.add('active');
        dom.cropBox.classList.remove('hidden');
      }

      applyCropRatio(ratio);
      updateCropUI();
      updateEstimation();
    });
  });

  // Dragging crop box or handles
  let activeDrag = null; // 'box' or handle id
  let startX = 0, startY = 0;
  let startCrop = null;

  dom.cropBox.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const handle = e.target.dataset.handle;
    activeDrag = handle || 'box';
    startX = e.clientX;
    startY = e.clientY;
    startCrop = { ...state.crop };

    window.addEventListener('pointermove', onCropMove);
    window.addEventListener('pointerup', onCropUp);
  });

  const onCropMove = (e) => {
    if (!activeDrag || !dom.mediaStageFrame) return;
    const frameRect = dom.mediaStageFrame.getBoundingClientRect();
    const dx = (e.clientX - startX) / (frameRect.width || 1);
    const dy = (e.clientY - startY) / (frameRect.height || 1);

    let { x, y, w, h } = startCrop;

    if (activeDrag === 'box') {
      x = Math.max(0, Math.min(1 - w, x + dx));
      y = Math.max(0, Math.min(1 - h, y + dy));
    } else {
      // Handles
      if (activeDrag.includes('r')) w = Math.max(0.08, Math.min(1 - x, w + dx));
      if (activeDrag.includes('b')) h = Math.max(0.08, Math.min(1 - y, h + dy));
      if (activeDrag.includes('l')) {
        const newW = Math.max(0.08, Math.min(w + x, w - dx));
        x += (w - newW);
        w = newW;
      }
      if (activeDrag.includes('t')) {
        const newH = Math.max(0.08, Math.min(h + y, h - dy));
        y += (h - newH);
        h = newH;
      }

      // Constrain aspect ratio if not free
      if (state.cropRatio !== 'free' && state.mediaWidth && state.mediaHeight) {
        let targetAspect = 1.0;
        if (state.cropRatio === '1:1') targetAspect = 1.0;
        else if (state.cropRatio === '9:16') targetAspect = 9 / 16;
        else if (state.cropRatio === '16:9') targetAspect = 16 / 9;
        else if (state.cropRatio === '4:3') targetAspect = 4 / 3;

        // Real pixel ratio = (w * mediaWidth) / (h * mediaHeight) = targetAspect
        const normRatio = targetAspect * (state.mediaHeight / state.mediaWidth);
        w = Math.min(1 - x, Math.max(0.08, h * normRatio));
        h = Math.min(1 - y, w / normRatio);
      }
    }

    state.crop = { x, y, w, h };
    updateCropUI();
    updateMemePreview();
    updateEstimation();
  };

  const onCropUp = () => {
    activeDrag = null;
    window.removeEventListener('pointermove', onCropMove);
    window.removeEventListener('pointerup', onCropUp);
  };
}

function updateStageFrameSize() {
  if (!state.mediaWidth || !state.mediaHeight || !dom.mediaStageFrame) return;
  const containerRect = dom.mediaContainer.getBoundingClientRect();
  const maxW = Math.max(100, containerRect.width - 24);
  const maxH = Math.max(100, containerRect.height - 24);
  const scale = Math.min(maxW / state.mediaWidth, maxH / state.mediaHeight);
  const displayW = Math.max(50, Math.round(state.mediaWidth * scale));
  const displayH = Math.max(50, Math.round(state.mediaHeight * scale));

  dom.mediaStageFrame.style.width = `${displayW}px`;
  dom.mediaStageFrame.style.height = `${displayH}px`;

  updateCropUI();
  updateMemePreview();
}

function disableCrop() {
  state.cropActive = false;
  dom.btnToggleCrop.classList.remove('active');
  dom.cropBox.classList.add('hidden');
  updateMemePreview();
  updateEstimation();
}

function applyCropRatio(ratio) {
  if (!state.mediaWidth || !state.mediaHeight) return;
  const videoAspect = state.mediaWidth / state.mediaHeight;

  let targetAspect = videoAspect;
  if (ratio === '1:1') targetAspect = 1.0;
  else if (ratio === '9:16') targetAspect = 9 / 16;
  else if (ratio === '16:9') targetAspect = 16 / 9;
  else if (ratio === '4:3') targetAspect = 4 / 3;
  else {
    state.crop = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
    updateCropUI();
    updateMemePreview();
    return;
  }

  let normW, normH;
  if (targetAspect <= videoAspect) {
    // Narrower/taller than video -> fit height
    normH = 0.92;
    const realH = state.mediaHeight * normH;
    const realW = realH * targetAspect;
    normW = Math.min(1.0, realW / state.mediaWidth);
  } else {
    // Wider than video -> fit width
    normW = 0.92;
    const realW = state.mediaWidth * normW;
    const realH = realW / targetAspect;
    normH = Math.min(1.0, realH / state.mediaHeight);
  }

  const x = Math.max(0, (1 - normW) / 2);
  const y = Math.max(0, (1 - normH) / 2);
  state.crop = { x, y, w: normW, h: normH };
  updateCropUI();
  updateMemePreview();
}

function getExportDimensions() {
  if (!state.mediaWidth || !state.mediaHeight) {
    return { width: state.resolution, height: state.resolution };
  }

  const cropRealW = state.cropActive && state.crop.w > 0 ? (state.crop.w * state.mediaWidth) : state.mediaWidth;
  const cropRealH = state.cropActive && state.crop.h > 0 ? (state.crop.h * state.mediaHeight) : state.mediaHeight;
  const aspect = cropRealW / (cropRealH || 1);

  let outW, outH;
  if (aspect >= 1) {
    outW = state.resolution;
    outH = Math.round(outW / aspect);
  } else {
    outH = state.resolution;
    outW = Math.round(outH * aspect);
  }

  // Ensure even dimensions
  if (outW % 2 !== 0) outW -= 1;
  if (outH % 2 !== 0) outH -= 1;

  outW = Math.max(32, outW);
  outH = Math.max(32, outH);

  return { width: outW, height: outH };
}

function updateCropUI() {
  const { x, y, w, h } = state.crop;
  dom.cropBox.style.left = `${x * 100}%`;
  dom.cropBox.style.top = `${y * 100}%`;
  dom.cropBox.style.width = `${w * 100}%`;
  dom.cropBox.style.height = `${h * 100}%`;

  const dims = getExportDimensions();
  dom.cropDimBadge.textContent = `${state.cropRatio.toUpperCase()} (${dims.width}×${dims.height} px)`;
}

// --- Controls, Presets & Meme Inputs ---
function bindControlsEvents() {
  // Presets
  const presetCards = document.querySelectorAll('.preset-card');
  presetCards.forEach(card => {
    card.addEventListener('click', () => {
      presetCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      applyPreset(card.dataset.preset);
    });
  });

  // Resolution
  bindSegmentedControl('res-selector', (val) => {
    state.resolution = parseInt(val, 10);
    updateEstimation();
  });

  // FPS Slider
  dom.fpsSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    state.fps = val;
    dom.fpsVal.textContent = `${val} FPS`;
    updateEstimation();
  });

  // Speed
  bindSegmentedControl('speed-selector', (val) => {
    state.speed = parseFloat(val);
    updateEstimation();
  });

  // Playback mode
  const playChips = document.querySelectorAll('#playback-chips .chip-btn');
  playChips.forEach(btn => {
    btn.addEventListener('click', () => {
      playChips.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.playback = btn.dataset.playback;
      updateEstimation();
    });
  });

  // Color depth
  bindSegmentedControl('colors-selector', (val) => {
    state.colors = parseInt(val, 10);
    updateEstimation();
  });

  // Dither switch
  dom.switchDither.addEventListener('change', (e) => {
    state.dither = e.target.checked;
    updateEstimation();
  });

  // Meme texts & live preview
  dom.inputTopText.addEventListener('input', (e) => {
    state.topText = e.target.value;
    updateMemePreview();
  });

  dom.inputBottomText.addEventListener('input', (e) => {
    state.bottomText = e.target.value;
    updateMemePreview();
  });

  dom.inputWatermark.addEventListener('input', (e) => {
    state.watermark = e.target.value;
    updateMemePreview();
  });

  dom.selectWatermarkPos.addEventListener('change', (e) => {
    state.watermarkPos = e.target.value;
    updateMemePreview();
  });

  // Compress Mode controls
  dom.compressScaleSlider.addEventListener('input', (e) => {
    const scale = parseInt(e.target.value, 10);
    state.compressScale = scale / 100;
    dom.compressScaleVal.textContent = `${scale}%`;
    updateEstimation();
  });

  bindSegmentedControl('compress-skip-selector', (val) => {
    state.compressSkip = parseInt(val, 10);
    updateEstimation();
  });

  bindSegmentedControl('compress-colors-selector', (val) => {
    state.compressColors = parseInt(val, 10);
    updateEstimation();
  });

  // Start Generation Button
  dom.btnGenerate.addEventListener('click', () => {
    startConversion();
  });
}

function bindSegmentedControl(id, onSelect) {
  const container = document.getElementById(id);
  if (!container) return;
  const btns = container.querySelectorAll('.seg-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.dataset.res || btn.dataset.speed || btn.dataset.colors || btn.dataset.skip;
      onSelect(val);
    });
  });
}

function applyPreset(preset) {
  state.activePreset = preset;
  if (state.mode === 'video') {
    if (preset === 'wechat-1m') {
      state.resolution = 320;
      state.fps = 10;
      state.colors = 64;
      state.dither = false;
      setActiveSeg('res-selector', '280');
      dom.fpsSlider.value = '10';
      dom.fpsVal.textContent = '10 FPS';
      setActiveSeg('colors-selector', '64');
      dom.switchDither.checked = false;
    } else if (preset === 'wechat-5m') {
      state.resolution = 480;
      state.fps = 14;
      state.colors = 128;
      state.dither = true;
      setActiveSeg('res-selector', '400');
      dom.fpsSlider.value = '14';
      dom.fpsVal.textContent = '14 FPS';
      setActiveSeg('colors-selector', '128');
      dom.switchDither.checked = true;
    } else if (preset === 'discord') {
      state.resolution = 280;
      state.fps = 10;
      state.colors = 32;
      state.cropRatio = '1:1';
      state.cropActive = true;
      dom.btnToggleCrop.classList.add('active');
      dom.cropBox.classList.remove('hidden');
      applyCropRatio('1:1');
      updateCropUI();
      setActiveSeg('res-selector', '280');
      dom.fpsSlider.value = '10';
      dom.fpsVal.textContent = '10 FPS';
      setActiveSeg('colors-selector', '32');
    } else if (preset === 'hd') {
      state.resolution = 540;
      state.fps = 18;
      state.colors = 256;
      state.dither = true;
      setActiveSeg('res-selector', '540');
      dom.fpsSlider.value = '18';
      dom.fpsVal.textContent = '18 FPS';
      setActiveSeg('colors-selector', '256');
      dom.switchDither.checked = true;
    }
  } else {
    // Compress Mode
    if (preset === 'wechat-1m') {
      state.compressScale = 0.55;
      state.compressSkip = 2;
      state.compressColors = 64;
      dom.compressScaleSlider.value = '55';
      dom.compressScaleVal.textContent = '55%';
      setActiveSeg('compress-skip-selector', '2');
      setActiveSeg('compress-colors-selector', '64');
    } else if (preset === 'wechat-5m') {
      state.compressScale = 0.8;
      state.compressSkip = 1;
      state.compressColors = 128;
      dom.compressScaleSlider.value = '80';
      dom.compressScaleVal.textContent = '80%';
      setActiveSeg('compress-skip-selector', '1');
      setActiveSeg('compress-colors-selector', '128');
    } else if (preset === 'discord') {
      state.compressScale = 0.4;
      state.compressSkip = 2;
      state.compressColors = 32;
      dom.compressScaleSlider.value = '40';
      dom.compressScaleVal.textContent = '40%';
      setActiveSeg('compress-skip-selector', '2');
      setActiveSeg('compress-colors-selector', '32');
    } else if (preset === 'hd') {
      state.compressScale = 0.9;
      state.compressSkip = 1;
      state.compressColors = 256;
      dom.compressScaleSlider.value = '90';
      dom.compressScaleVal.textContent = '90%';
      setActiveSeg('compress-skip-selector', '1');
      setActiveSeg('compress-colors-selector', '256');
    }
  }

  updateEstimation();
}

function setActiveSeg(id, val) {
  const container = document.getElementById(id);
  if (!container) return;
  const btns = container.querySelectorAll('.seg-btn');
  btns.forEach(btn => {
    const attrVal = btn.dataset.res || btn.dataset.speed || btn.dataset.colors || btn.dataset.skip;
    btn.classList.toggle('active', attrVal === val);
  });
}

function updateMemePreview() {
  const hasText = state.topText.trim() || state.bottomText.trim() || state.watermark.trim();
  dom.memeOverlay.classList.toggle('hidden', !hasText);

  // When crop is active, strictly align meme overlay with the cropped area
  if (state.cropActive && state.crop) {
    dom.memeOverlay.style.left = `${state.crop.x * 100}%`;
    dom.memeOverlay.style.top = `${state.crop.y * 100}%`;
    dom.memeOverlay.style.width = `${state.crop.w * 100}%`;
    dom.memeOverlay.style.height = `${state.crop.h * 100}%`;
  } else {
    dom.memeOverlay.style.left = '0%';
    dom.memeOverlay.style.top = '0%';
    dom.memeOverlay.style.width = '100%';
    dom.memeOverlay.style.height = '100%';
  }

  dom.memePreviewTop.textContent = state.topText;
  dom.memePreviewBottom.textContent = state.bottomText;
  dom.watermarkPreview.textContent = state.watermark;

  dom.watermarkPreview.className = `watermark-text-render pos-${state.watermarkPos}`;
  dom.watermarkPreview.classList.toggle('hidden', !state.watermark.trim());
}

// Live size and frame estimation
function updateEstimation() {
  const dims = getExportDimensions();
  if (dom.resCalcBadge) {
    dom.resCalcBadge.textContent = `${dims.width} × ${dims.height} px`;
  }

  if (state.mode === 'video') {
    const dur = Math.max(0.2, state.trimEnd - state.trimStart);
    let frames = Math.round(dur * state.fps);
    if (state.playback === 'boomerang') frames *= 2;

    const w = dims.width;
    const h = dims.height;
    
    // Empirical byte calculation per frame based on colors and dimensions
    const bytesPerPixel = (Math.log2(state.colors) / 8) * (state.dither ? 0.45 : 0.3);
    const estBytes = frames * (w * h * bytesPerPixel * 0.12);

    dom.estText.textContent = `预估帧数: ~${frames} 帧 • 预估体积: ~${formatSize(estBytes)}`;
  } else {
    // Compress mode
    if (state.decodedGif) {
      const origFrames = state.decodedGif.frames.length;
      const finalFrames = Math.ceil(origFrames / state.compressSkip);
      const estRatio = (state.compressScale ** 2) * (1 / state.compressSkip) * (state.compressColors / 256);
      const estSize = state.fileSize * Math.max(0.15, estRatio * 0.9);

      dom.estText.textContent = `压缩后预估: ~${finalFrames} 帧 • 体积约: ~${formatSize(estSize)} (节省 ~${Math.round((1 - estSize / state.fileSize) * 100)}%)`;
    } else {
      dom.estText.textContent = '请先上传需要压缩的 GIF 文件';
    }
  }
}

// --- Conversion Pipeline ---
async function startConversion() {
  if (state.mode === 'video' && !dom.previewVideo.src) {
    alert('请先上传或选择视频文件');
    return;
  }
  if (state.mode === 'compress' && !state.decodedGif) {
    alert('请先上传 GIF 文件');
    return;
  }

  showProgressModal();

  try {
    if (state.mode === 'video') {
      await processVideoToGif();
    } else {
      await processGifCompression();
    }
  } catch (err) {
    console.error('Processing failed:', err);
    alert('生成失败: ' + (err.message || String(err)));
    hideProgressModal();
  }
}

async function processVideoToGif() {
  const video = dom.previewVideo;
  dom.progressTitle.textContent = '第一阶段：抽取与裁切视频帧...';
  dom.progressSub.textContent = '正在以高精度 Canvas 解码指定片段';

  // Calculate dimensions strictly based on crop and target resolution
  const { width: outW, height: outH } = getExportDimensions();

  const extractionResult = await extractVideoFrames(video, {
    startTime: state.trimStart,
    endTime: state.trimEnd,
    fps: state.fps,
    outputWidth: outW,
    outputHeight: outH,
    crop: state.cropActive ? state.crop : null,
    playback: state.playback,
    speed: state.speed,
    textOverlay: {
      topText: state.topText,
      bottomText: state.bottomText,
      watermark: state.watermark,
      watermarkPos: state.watermarkPos
    },
    onProgress: (percent, current, total) => {
      dom.progressPercent.textContent = `${Math.round(percent * 0.5)}%`;
      dom.progressBarFill.style.width = `${percent * 0.5}%`;
      dom.progressFrames.textContent = `截帧中: ${current} / ${total}`;
    }
  });

  // Stage 2: GIF Encoding in Web Worker
  dom.progressTitle.textContent = '第二阶段：多线程量化与色彩编码...';
  dom.progressSub.textContent = '正在运用 NeuQuant 量化算法压缩体积';

  const gifBuffer = await encodeFramesInWorker(
    extractionResult.frames,
    extractionResult.width,
    extractionResult.height,
    state.colors,
    state.dither
  );

  handleConversionSuccess(gifBuffer, extractionResult.width, extractionResult.height, extractionResult.frames.length, (state.trimEnd - state.trimStart));
}

async function processGifCompression() {
  dom.progressTitle.textContent = '第一阶段：抽帧与重采样...';
  dom.progressSub.textContent = '正在根据压缩设定优化像素与帧序列';

  const processed = processGifFramesForCompression(state.decodedGif, {
    scale: state.compressScale,
    frameSkip: state.compressSkip,
    onProgress: (percent) => {
      dom.progressPercent.textContent = `${Math.round(percent * 0.4)}%`;
      dom.progressBarFill.style.width = `${percent * 0.4}%`;
    }
  });

  dom.progressTitle.textContent = '第二阶段：重新压缩量化为 GIF...';
  dom.progressSub.textContent = '正在组装优化版动图二进制数据';

  const gifBuffer = await encodeFramesInWorker(
    processed.frames,
    processed.width,
    processed.height,
    state.compressColors,
    false // Disable dithering for maximum compression
  );

  handleConversionSuccess(gifBuffer, processed.width, processed.height, processed.frames.length, state.decodedGif.duration);
}

function encodeFramesInWorker(frames, width, height, paletteSize, dither) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./engine/gif-worker.js', import.meta.url), { type: 'module' });
    state.worker = worker;

    worker.onmessage = (e) => {
      const data = e.data;
      if (data.type === 'progress') {
        const overallPercent = 50 + Math.round(data.percent * 0.5);
        dom.progressPercent.textContent = `${overallPercent}%`;
        dom.progressBarFill.style.width = `${overallPercent}%`;
        dom.progressFrames.textContent = `编码帧: ${data.current} / ${data.total}`;
      } else if (data.type === 'done') {
        worker.terminate();
        state.worker = null;
        resolve(data.buffer);
      } else if (data.type === 'error') {
        worker.terminate();
        state.worker = null;
        reject(new Error(data.message));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      state.worker = null;
      reject(err);
    };

    // Transfer buffers to worker
    const transferables = frames.map(f => f.data.buffer);
    worker.postMessage({
      action: 'encode',
      frames,
      width,
      height,
      paletteSize,
      dither,
      loop: 0
    }, transferables);
  });
}

// --- Success & Result Modal ---
function handleConversionSuccess(buffer, width, height, totalFrames, duration) {
  hideProgressModal();

  const blob = new Blob([buffer], { type: 'image/gif' });
  state.resultBlob = blob;

  if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
  state.resultUrl = URL.createObjectURL(blob);

  // Populate Result Modal
  dom.resultImg.src = state.resultUrl;
  dom.resStatSize.textContent = formatSize(blob.size);
  dom.resStatDim.textContent = `${width}×${height}`;
  dom.resStatFrames.textContent = `${totalFrames} 帧 • ${duration.toFixed(1)}s`;

  // Saving stat
  if (state.fileSize > 0) {
    const saving = Math.round((1 - (blob.size / state.fileSize)) * 100);
    dom.resStatSaving.textContent = saving > 0 ? `-${saving}%` : '+0%';
  } else {
    dom.resStatSaving.textContent = '最优输出';
  }

  // Download Link
  dom.btnDownloadGif.href = state.resultUrl;
  const originalName = state.file?.name?.replace(/\.[^/.]+$/, '') || 'gifpulse';
  dom.btnDownloadGif.download = `${originalName}_optimized.gif`;

  // Show Result Modal
  dom.modalResult.classList.remove('hidden');

  // Trigger celebration confetti!
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 }
  });
}

function bindResultEvents() {
  dom.btnCloseResult.addEventListener('click', () => {
    dom.modalResult.classList.add('hidden');
  });

  dom.btnCancelProcess.addEventListener('click', () => {
    if (state.worker) {
      state.worker.terminate();
      state.worker = null;
    }
    hideProgressModal();
  });

  // Copy to Clipboard
  dom.btnCopyClipboard.addEventListener('click', async () => {
    if (!state.resultBlob) return;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/gif': state.resultBlob })
        ]);
        showNotification('已成功复制动图到剪贴板！');
      } else {
        alert('当前浏览器环境不支持直接写入 GIF 到剪贴板，请点击“下载 GIF 动图”保存');
      }
    } catch (err) {
      console.warn('Clipboard write failed:', err);
      alert('复制失败，请直接长按图片或点击“下载 GIF 动图”保存');
    }
  });

  // Native Web Share API
  dom.btnShareMobile.addEventListener('click', async () => {
    if (!state.resultBlob) return;
    if (navigator.share) {
      try {
        const file = new File([state.resultBlob], 'gifpulse.gif', { type: 'image/gif' });
        await navigator.share({
          files: [file],
          title: 'GifPulse 动图',
          text: '通过 GifPulse 灵动动图制作'
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      alert('您的设备或浏览器暂不支持直接系统分享，请点击“下载 GIF 动图”');
    }
  });
}

function showProgressModal() {
  dom.progressBarFill.style.width = '0%';
  dom.progressPercent.textContent = '0%';
  dom.progressFrames.textContent = '准备就绪...';
  dom.modalProcessing.classList.remove('hidden');
}

function hideProgressModal() {
  dom.modalProcessing.classList.add('hidden');
}

function showNotification(msg) {
  const toast = document.createElement('div');
  toast.className = 'badge badge-emerald';
  toast.style.position = 'fixed';
  toast.style.bottom = '30px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.padding = '12px 24px';
  toast.style.fontSize = '14px';
  toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
  toast.style.zIndex = '999';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// --- Utilities ---
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

function formatSize(bytes) {
  if (isNaN(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Start app
init();
