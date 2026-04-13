
const video = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

let handLandmarker;
let lastVideoTime = -1;
let detectedNumber = 0;
let previousDetectedNumber = 0;

// Particle systems
let particles = [];
let textParticles = [];

const numberLanguages = {
    1: { ko: '하나', jp: 'いち', zh: '一' },
    2: { ko: '둘', jp: 'に', zh: '二' },
    3: { ko: '셋', jp: 'さん', zh: '三' },
    4: { ko: '넷', jp: 'し', zh: '四' },
    5: { ko: '다섯', jp: 'ご', zh: '五' }
};

// Create a new HandLandmarker instance
async function createHandLandmarker() {
    const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js");
    const { HandLandmarker, FilesetResolver } = vision;
    const visionResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(visionResolver, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
    });
    enableCam();
}

createHandLandmarker();

function enableCam() {
    if (!handLandmarker) {
        console.log("Wait! handLandmarker not loaded yet.");
        return;
    }

    const constraints = { video: true };

    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
    });
}

async function predictWebcam() {
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    let startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        const results = await handLandmarker.detectForVideo(video, startTimeMs);

        let currentNumber = 0;
        if (results.landmarks && results.landmarks.length > 0) {
            currentNumber = countFingers(results.landmarks[0]);
        }
        detectedNumber = currentNumber;

        if (detectedNumber !== previousDetectedNumber) {
            if (detectedNumber > 0) {
                // Create new particles only on number change
                createTextParticles(detectedNumber);
                createParticles(detectedNumber);
            }
        }
        previousDetectedNumber = detectedNumber;
    }

    draw();

    window.requestAnimationFrame(predictWebcam);
}

function countFingers(landmarks) {
    const tipIds = [4, 8, 12, 16, 20];
    let fingerCount = 0;

    // Thumb: Check if thumb tip is to the right of the knuckle (for a right hand mirrored)
    if (landmarks[tipIds[0]].x > landmarks[tipIds[0] - 1].x) {
        fingerCount++;
    }

    // Other 4 fingers: Check if finger tip is above the joint below it
    for (let i = 1; i < 5; i++) {
        if (landmarks[tipIds[i]].y < landmarks[tipIds[i] - 2].y) {
            fingerCount++;
        }
    }
    return fingerCount;
}

// ---- Particle and Drawing Logic ----
function draw() {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Update and draw background particles
    if (particles.length > 0) {
        updateAndDrawParticles();
    }

    // Update and draw falling text particles
    if (textParticles.length > 0) {
        updateAndDrawTextParticles();
    }

    // Draw the detected number on top
    if (detectedNumber > 0) {
        const centerX = canvasElement.width / 2;
        const centerY = canvasElement.height / 2;
        canvasCtx.font = "bold 200px Arial";
        canvasCtx.fillStyle = "white";
        canvasCtx.textAlign = "center";
        canvasCtx.strokeStyle = "black";
        canvasCtx.lineWidth = 5;
        canvasCtx.strokeText(detectedNumber, centerX, centerY + 70);
        canvasCtx.fillText(detectedNumber, centerX, centerY + 70);
    }
}

function createParticles(number) {
    particles = []; // Reset background particles
    const centerX = canvasElement.width / 2;
    const centerY = canvasElement.height / 2;
    for (let i = 0; i < 150; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        particles.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 100,
            color: `hsl(${Math.random() * 60 + 200}, 100%, 70%)`
        });
    }
}

function updateAndDrawParticles() {
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        canvasCtx.fillStyle = p.color;
        canvasCtx.globalAlpha = p.life / 100 > 0 ? p.life / 100 : 0;
        canvasCtx.beginPath();
        canvasCtx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        canvasCtx.fill();
    });
    canvasCtx.globalAlpha = 1.0;
    particles = particles.filter(p => p.life > 0);
}

function createTextParticles(number) {
    if (!numberLanguages[number]) return;

    const translations = numberLanguages[number];
    const centerX = canvasElement.width / 2;
    const centerY = canvasElement.height / 2;

    for (const lang in translations) {
        const text = translations[lang];
        textParticles.push({
            x: centerX,
            y: centerY,
            vx: (Math.random() - 0.5) * 6,
            vy: -Math.random() * 10 - 6, // Initial upward velocity
            ay: 0.3, // Gravity
            text: text,
            alpha: 1.0,
            life: 150,
            color: `hsl(${Math.random() * 360}, 100%, 80%)`
        });
    }
}

function updateAndDrawTextParticles() {
    canvasCtx.font = "bold 30px Arial";
    textParticles.forEach(p => {
        p.vy += p.ay;
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.alpha = p.life / 150;

        canvasCtx.globalAlpha = p.alpha > 0 ? p.alpha : 0;
        canvasCtx.fillStyle = p.color;
        canvasCtx.fillText(p.text, p.x, p.y);
    });
    canvasCtx.globalAlpha = 1.0;
    textParticles = textParticles.filter(p => p.life > 0);
}
