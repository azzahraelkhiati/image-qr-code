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

    // URL brute du fichier sur GitHub
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
        logo.src = './Images/CDRIN.png'; // Chemin relatif au logo
        logo.onload = () => {
            const logoWidth = canvas.width * 0.2; // 20% de la largeur du canvas
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

            context.clearRect(0, 0, containerWidth, containerHeight); 
            context.drawImage(
                video,
                sourceX, sourceY, sourceWidth, sourceHeight,
                0, 0, containerWidth, containerHeight 
            );

            await overlayLogo(); // Superposition du logo

            const fileName = `image_${Date.now()}.png`;
            const imageData = canvas.toDataURL('image/png');

            // Upload et push sur Git
            const pushedFileName = await pushImageToGit(imageData, fileName);
            currentImageName = pushedFileName; 

            // On affiche la vue "captured"
            switchToCapturedView();

            // Génération du QR code pour l'image poussée
            if (currentImageName) {
                generateQRCode(currentImageName);
            }

            video.style.display = 'none';
            canvas.style.display = 'block';

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

function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

function switchToCapturedView() {
    initialView.classList.add('hidden');
    capturedView.classList.remove('hidden');
    createQRContainer(); // Préparation du container QR
}

function restartPhoto() {
    capturedView.classList.add('hidden');
    initialView.classList.remove('hidden');
    video.style.display = 'block';
    canvas.style.display = 'none';
    stopCamera();
    startCamera();
}

window.addEventListener('load', startCamera);
captureButton.addEventListener('click', takePicture);
restartButton.addEventListener('click', restartPhoto);
