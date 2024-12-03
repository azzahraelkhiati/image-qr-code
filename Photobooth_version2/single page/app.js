const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureButton = document.getElementById('capture-button');
const restartButton = document.getElementById('restart-button');
const initialView = document.getElementById('initial-view');
const filterView = document.getElementById('filter-view');
const context = canvas.getContext('2d');
const rectangle13 = document.querySelector('.rectangle-13');
const rectangle14 = document.querySelector('.rectangle-14');
const rectangle15 = document.querySelector('.rectangle-15');


let selfieSegmentation;
let isMediaPipeReady = false;
let currentStream = null;
let isLoading = false;
let selectedFilter = null;

const cameraConfig = {
    video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 }
    }
};

function createQRContainer() {
    const oldContainer = document.querySelector('.qr-container');
    if (oldContainer) {
        oldContainer.remove();
    }

    const qrContainer = document.createElement('div');
    qrContainer.className = 'qr-container';
    qrContainer.innerHTML = `
        <span class="qr-download-text">Scannez pour télécharger votre image pour partager dans vos réseaux:</span>
        <div class="qr-code-box">
            <span class="qr-code-text">CODE<br>QR</span>
        </div>
    `;
    document.querySelector('.main-container').appendChild(qrContainer);
    return qrContainer;
}

async function generateQRCode(fileName) {
  const qrCodeScript = document.createElement('script');
  qrCodeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  document.head.appendChild(qrCodeScript);

  await new Promise(resolve => (qrCodeScript.onload = resolve));

  const qrCodeContainer = document.querySelector('.qr-code-box');
  qrCodeContainer.innerHTML = ''; 

  const rawDownloadUrl = `https://raw.githubusercontent.com/azzahraelkhiati/image-qr-code/main/${fileName}`;
  const encodedDownloadUrl = `${rawDownloadUrl}?dl=1`; 

  new QRCode(qrCodeContainer, {
      text: encodedDownloadUrl,
      width: 335,
      height: 335,
      colorDark: '#000000',
      colorLight: '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.H,
  });
}


async function initMediaPipe() {
    selfieSegmentation = new SelfieSegmentation({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
    });

    selfieSegmentation.setOptions({
        modelSelection: 1 
    });

    selfieSegmentation.onResults((results) => {
        if (results.segmentationMask && !isLoading) {
            processMask(results);
        }
    });

    await selfieSegmentation.initialize();
    isMediaPipeReady = true;
}

function processMask(results) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(results.segmentationMask, 0, 0, tempCanvas.width, tempCanvas.height);

    const maskImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const maskData = maskImageData.data;

    tempCtx.drawImage(results.image, 0, 0, tempCanvas.width, tempCanvas.height);
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const pixels = imageData.data;

    for (let i = 0; i < maskData.length; i += 4) {
        const maskValue = maskData[i];
        if (maskValue < 220) {
            maskData[i] = 0;
            maskData[i + 1] = 0;
            maskData[i + 2] = 0;
            maskData[i + 3] = 0;
        }
    }

    tempCtx.putImageData(maskImageData, 0, 0);
    tempCtx.filter = 'blur(-50px)';
    tempCtx.drawImage(tempCanvas, 0, 0);

    const blurredMaskImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const blurredMaskData = blurredMaskImageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        const maskValue = blurredMaskData[i];
        if (maskValue < 200) {
            pixels[i + 3] = 0;
        }
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.putImageData(imageData, 0, 0);
}

function createLoadingCircle() {
  const loadingContainer = document.createElement('div');
  loadingContainer.className = 'loading-container';

  const loadingBackground = document.createElement('div');
  loadingBackground.className = 'loading-background';

  const loadingImage = document.createElement('img');
  loadingImage.src = './Images/Loading.png';
  loadingImage.className = 'loading-image';

  loadingContainer.appendChild(loadingBackground);
  loadingContainer.appendChild(loadingImage);

  return loadingContainer;
}


async function handleFilterSelection(element) {
  if (isLoading) return;
  isLoading = true;

  if (selectedFilter) {
      selectedFilter.classList.remove('selected');
      selectedFilter.style.backgroundColor = '';
  }

  element.classList.add('selected');
  selectedFilter = element;

  const mainRectangle = document.querySelector('.rectangle');
  const loadingCircleContainer = createLoadingCircle();
  mainRectangle.appendChild(loadingCircleContainer);

  document.querySelector('.main-container').classList.add('loading-active');

  try {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const img = new Image();
      await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = './Images/FilterImage.png';
      });

      const mainCanvas = document.getElementById('canvas');
      const ctx = mainCanvas.getContext('2d');
      ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
      ctx.drawImage(img, 0, 0, mainCanvas.width, mainCanvas.height);

      const qrContainer = createQRContainer();
      await generateQRCode(fileName);

  } catch (error) {
      console.error('Erreur lors du chargement:', error);
  } finally {
      loadingCircleContainer.remove();
      isLoading = false;
      document.querySelector('.main-container').classList.remove('loading-active');
  }
}

async function pushImageToGit(imageData, fileName) {
  console.log('pushImageToGit() appelée avec :', { fileName, imageData });

  try {
      const response = await fetch('http://localhost:4000/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData, fileName }),
      });

      console.log('Requête envoyée, en attente de réponse...');

      if (!response.ok) {
          const errorText = await response.text();
          console.error('Erreur dans la réponse du backend :', errorText);
          throw new Error(errorText);
      }

      const responseText = await response.text();
      console.log('Réponse du backend :', responseText);
  } catch (error) {
      console.error('Erreur lors de l\'envoi au backend :', error);
  }
}


const fileName = `image-${Date.now()}.png`;
async function takePicture() {
  if (!selfieSegmentation) {
    await initMediaPipe();
  }

  createCountdownCircle(async () => {
    createFlashEffect();

    const containerWidth = 732;
    const containerHeight = 894;

    canvas.width = containerWidth;
    canvas.height = containerHeight;

    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = containerWidth;
      tempCanvas.height = containerHeight;
      const tempCtx = tempCanvas.getContext('2d');

      const videoRatio = video.videoWidth / video.videoHeight;
      const containerRatio = containerWidth / containerHeight;

      let sourceX, sourceY, sourceWidth, sourceHeight;

      if (videoRatio > containerRatio) {
        sourceHeight = video.videoHeight;
        sourceWidth = sourceHeight * containerRatio;
        sourceX = (video.videoWidth - sourceWidth) / 2;
        sourceY = 0;
      } else {
        sourceWidth = video.videoWidth;
        sourceHeight = sourceWidth / containerRatio;
        sourceX = 0;
        sourceY = (video.videoHeight - sourceHeight) / 2;
      }

      tempCtx.drawImage(
        video,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, containerWidth, containerHeight
      );

      await selfieSegmentation.send({ image: tempCanvas });

      video.style.display = 'none';
      canvas.style.display = 'block';

      const imageData = canvas.toDataURL('image/png');

      await pushImageToGit(imageData, fileName);

      if (selectedFilter) {
        selectedFilter.classList.remove('selected');
        selectedFilter.style.backgroundColor = '';
        selectedFilter = null;
      }

      switchToFilterView();
    } catch (error) {
      console.error('Erreur lors de la capture:', error);
    }
  });
}


async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia(cameraConfig);
        video.srcObject = stream;
        currentStream = stream;

        video.style.display = 'block';
        canvas.style.display = 'none';

        await new Promise((resolve) => (video.onloadedmetadata = resolve));
        adjustVideoDisplay();

        if (!isMediaPipeReady) {
            await initMediaPipe();
        }
    } catch (err) {
        console.error('Erreur lors de l\'accès à la caméra:', err);
    }
}

function adjustVideoDisplay() {
    const containerWidth = 732;
    const containerHeight = 894;
    const videoRatio = video.videoWidth / video.videoHeight;
    const containerRatio = containerWidth / containerHeight;

    if (videoRatio > containerRatio) {
        const scale = containerHeight / video.videoHeight;
        const width = video.videoWidth * scale;
        video.style.width = `${width}px`;
        video.style.height = `${containerHeight}px`;
        video.style.left = `${-(width - containerWidth) / 2}px`;
        video.style.top = '0';
    } else {
        const scale = containerWidth / video.videoWidth;
        const height = video.videoHeight * scale;
        video.style.width = `${containerWidth}px`;
        video.style.height = `${height}px`;
        video.style.top = `${-(height - containerHeight) / 2}px`;
        video.style.left = '0';
    }
}

function createFlashEffect() {
    const flash = document.createElement('div');
    flash.className = 'flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 500);
}

function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
        currentStream = null;
    }
}

function switchToFilterView() {
    initialView.classList.add('hidden');
    filterView.classList.remove('hidden');
}

function restartPhoto() {
    canvas.style.display = 'none';
    context.clearRect(0, 0, canvas.width, canvas.height);

    const qrContainer = document.querySelector('.qr-container');
    if (qrContainer) {
        qrContainer.remove();
    }
    
    startCamera();
    filterView.classList.add('hidden');
    initialView.classList.remove('hidden');
    
    if (selectedFilter) {
        selectedFilter.classList.remove('selected');
        selectedFilter.style.backgroundColor = '';
        selectedFilter = null;
    }
}

function createCountdownCircle(onComplete) {
  const loadingContainer = document.createElement('div');
  loadingContainer.className = 'loading-container';

  const loadingBackground = document.createElement('div');
  loadingBackground.className = 'loading-background';

  const countdownText = document.createElement('span');
  countdownText.className = 'countdown-text';
  countdownText.textContent = '5';

  loadingContainer.appendChild(loadingBackground);
  loadingContainer.appendChild(countdownText);

  const mainRectangle = document.querySelector('.rectangle'); 
  mainRectangle.appendChild(loadingContainer);

  let count = 5;
  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      countdownText.textContent = count;
    } else {
      clearInterval(interval);
      loadingContainer.remove(); 
      onComplete();
    }
  }, 1000);
}


window.addEventListener('load', startCamera);
captureButton.addEventListener('click', () => {
  console.log('Bouton capture cliqué');
  takePicture();
});
restartButton.addEventListener('click', restartPhoto);
rectangle13.addEventListener('click', () => handleFilterSelection(rectangle13));
rectangle14.addEventListener('click', () => handleFilterSelection(rectangle14));
rectangle15.addEventListener('click', () => handleFilterSelection(rectangle15));