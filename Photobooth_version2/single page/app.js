const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureButton = document.getElementById('capture-button');
const restartButton = document.getElementById('restart-button');
const initialView = document.getElementById('initial-view');
const capturedView = document.getElementById('captured-view');
const context = canvas.getContext('2d');

let currentStream = null;
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
        <span class="qr-download-text">Scannez pour télécharger votre image et la partager sur vos réseaux :</span>
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

async function overlayLogo() {
    return new Promise((resolve, reject) => {
        const logo = new Image();
        logo.src = './Images/CDRIN.png';
        logo.onload = () => {
            const logoWidth = canvas.width * 0.2;
            const logoHeight = (logo.height / logo.width) * logoWidth;
            context.drawImage(logo, canvas.width - logoWidth - 20, canvas.height - logoHeight - 20, logoWidth, logoHeight);
            resolve();
        };
        logo.onerror = reject;
    });
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

        const jsonResponse = await response.json();
        console.log('Réponse du backend (upload) :', jsonResponse);
        return jsonResponse.fileName;
    } catch (error) {
        console.error('Erreur lors de l\'envoi au backend :', error);
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

function createFlashEffect() {
    const flash = document.createElement('div');
    flash.className = 'flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 500);
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
    const container = document.querySelector('.rectangle');
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    
    const videoRatio = video.videoWidth / video.videoHeight;
    const containerRatio = containerWidth / containerHeight;

    if (videoRatio > containerRatio) {
        const scale = containerHeight / video.videoHeight;
        const width = video.videoWidth * scale;
        video.style.width = 'auto';
        video.style.height = '100%';
    } else {
        const scale = containerWidth / video.videoWidth;
        const height = video.videoHeight * scale;
        video.style.width = '100%';
        video.style.height = 'auto';
    }
}

async function takePicture() {
    createCountdownCircle(async () => {
        createFlashEffect();

        const container = document.querySelector('.rectangle');
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;

        canvas.width = containerWidth;
        canvas.height = containerHeight;

        try {
            context.clearRect(0, 0, containerWidth, containerHeight);
            
            const videoRatio = video.videoWidth / video.videoHeight;
            const containerRatio = containerWidth / containerHeight;
            
            let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
            
            if (videoRatio > containerRatio) {
                drawHeight = containerHeight;
                drawWidth = drawHeight * videoRatio;
                offsetX = -(drawWidth - containerWidth) / 2;
            } else {
                drawWidth = containerWidth;
                drawHeight = drawWidth / videoRatio;
                offsetY = -(drawHeight - containerHeight) / 2;
            }
            
            context.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
            await overlayLogo();

            const fileName = `image_${Date.now()}.png`;
            const imageData = canvas.toDataURL('image/png');

            // Stop the camera stream after capturing
            stopCamera();
            
            // Hide video and show canvas with captured image
            video.style.display = 'none';
            canvas.style.display = 'block';

            const pushedFileName = await pushImageToGit(imageData, fileName);
            currentImageName = pushedFileName;

            // Switch to captured view while keeping the canvas visible
            initialView.classList.add('hidden');
            capturedView.classList.remove('hidden');

            if (currentImageName) {
                createQRContainer();
                generateQRCode(currentImageName);
            }

        } catch (error) {
            console.error('Erreur lors de la capture:', error);
        }
    });
}

function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

function restartPhoto() {
    // Remove QR container if it exists
    const qrContainer = document.querySelector('.qr-container');
    if (qrContainer) {
        qrContainer.remove();
    }
    
    capturedView.classList.add('hidden');
    initialView.classList.remove('hidden');
    canvas.style.display = 'none';
    startCamera();
}

// Initial setup
window.addEventListener('load', startCamera);
captureButton.addEventListener('click', takePicture);
restartButton.addEventListener('click', restartPhoto);