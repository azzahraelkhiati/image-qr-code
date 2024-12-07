const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureButton = document.getElementById('capture-button');
const restartButton = document.getElementById('restart-button');
const initialView = document.getElementById('initial-view');
const filterView = document.getElementById('filter-view');
const context = canvas.getContext('2d');
const rectangle13 = document.querySelector('.rectangle-13');
const rectangle14 = document.querySelector('.rectangle-14');


let currentStream = null;
let isLoading = false;
let selectedFilter = null;
let currentImageName = null;

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
        const scriptEndpoint =
            element === rectangle13
                ? 'http://localhost:4000/run-stable-diffusion'
                : element === rectangle14
                    ? 'http://localhost:4000/run-stable-diffusion-squido'
                    : null;

        if (scriptEndpoint) {
            const response = await fetch(scriptEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error('Erreur lors de l\'exécution du script Python');
            }

            const result = await response.json();
            console.log('Résultat du script Python:', result);

            await new Promise(resolve => setTimeout(resolve, 1000));

            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = `http://localhost:4000/output-image?${Date.now()}`;
            });

            const mainCanvas = document.getElementById('canvas');
            const rectangleContainer = document.querySelector('.rectangle');
            const containerHeight = rectangleContainer.clientHeight;

            const scale = containerHeight / img.naturalHeight;
            const scaledWidth = img.naturalWidth * scale;

            mainCanvas.width = scaledWidth;
            mainCanvas.height = containerHeight;

            const ctx = mainCanvas.getContext('2d');
            ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
            ctx.drawImage(img, 0, 0, scaledWidth, containerHeight);

            mainCanvas.style.position = 'absolute';
            mainCanvas.style.left = '50%';
            mainCanvas.style.transform = 'translateX(-50%)';
            mainCanvas.style.height = '100%';
            mainCanvas.style.objectFit = 'cover';
            mainCanvas.style.margin = '0';
            mainCanvas.style.padding = '0';
            mainCanvas.style.display = 'block';

            const qrContainer = createQRContainer();
            if (result && result.fileName) {
                await generateQRCode(result.fileName);
            }
        }
    } catch (error) {
        console.error('Erreur lors du chargement:', error);
    } finally {
        loadingCircleContainer.remove();
        isLoading = false;
        document.querySelector('.main-container').classList.remove('loading-active');
    }
}

async function pushImageToGit(imageData, fileName) {
    try {
        const response = await fetch('http://localhost:4000/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageData, fileName }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const responseText = await response.text();
        console.log('Réponse du backend :', responseText);
    } catch (error) {
        console.error('Erreur lors de l\'envoi au backend :', error);
    }
}

async function takePicture() {
    createCountdownCircle(async () => {
        createFlashEffect();

        const containerWidth = 732;
        const containerHeight = 894;

        canvas.width = containerWidth;
        canvas.height = containerHeight;

        try {
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

            context.drawImage(
                video,
                sourceX, sourceY, sourceWidth, sourceHeight,
                0, 0, containerWidth, containerHeight
            );

            const fileName = `image_${Date.now()}.png`;
            const imageData = canvas.toDataURL('image/png');
            await pushImageToGit(imageData, fileName);

            video.style.display = 'none';
            canvas.style.display = 'block';

            switchToFilterView();
        } catch (error) {
            console.error('Erreur lors de la capture:', error);
        }
    });
}

function startCamera() {
    return navigator.mediaDevices.getUserMedia(cameraConfig)
        .then(stream => {
            video.srcObject = stream;
            currentStream = stream;
            video.style.display = 'block';
            canvas.style.display = 'none';
            return new Promise(resolve => video.onloadedmetadata = resolve);
        })
        .then(adjustVideoDisplay)
        .catch(err => console.error('Erreur lors de l\'accès à la caméra:', err));
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
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

function switchToFilterView() {
    initialView.classList.add('hidden');
    filterView.classList.remove('hidden');
}

function restartPhoto() {
    window.location.reload();
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
captureButton.addEventListener('click', takePicture);
restartButton.addEventListener('click', restartPhoto);
rectangle13.addEventListener('click', () => handleFilterSelection(rectangle13));
rectangle14.addEventListener('click', () => handleFilterSelection(rectangle14));