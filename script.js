import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';

// --- CONFIGURAÇÕES GLOBAIS (HD) ---
const GLOBE_RADIUS = 2.5; 
const GLOBE_SEGMENTS = 128; 

// --- API GEMINI ---
// ⚠️ COLE SUA CHAVE AQUI:
const API_KEY = "SUA_CHAVE_AQUI"; 
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

// --- MAPAS ESTADUAIS / REGIONAIS ---
// ✅ NOVO LINK PARA OS EUA (PublicaMundi - Lat/Lon Correto)
const USA_URL = "https://cdn.jsdelivr.net/gh/PublicaMundi/MappingAPI@master/data/geojson/us-states.json";
const RUSSIA_URL = "https://cdn.jsdelivr.net/gh/codeforgermany/click_that_hood@main/public/data/russia.geojson";

const STATE_MAPS = {
    "BRAZIL": "https://cdn.jsdelivr.net/gh/codeforgermany/click_that_hood@main/public/data/brazil-states.geojson",
    
    // Variações de nome para garantir o carregamento
    "USA": USA_URL,
    "UNITED STATES": USA_URL,
    "UNITED STATES OF AMERICA": USA_URL,
    
    "RUSSIA": RUSSIA_URL,
    "RUSSIAN FEDERATION": RUSSIA_URL,

    "INDIA": "https://cdn.jsdelivr.net/gh/codeforgermany/click_that_hood@main/public/data/india.geojson",
    "AUSTRALIA": "https://cdn.jsdelivr.net/gh/codeforgermany/click_that_hood@main/public/data/australia.geojson",
    "MEXICO": "https://cdn.jsdelivr.net/gh/codeforgermany/click_that_hood@main/public/data/mexico.geojson",
    "NIGERIA": "https://cdn.jsdelivr.net/gh/codeforgermany/click_that_hood@main/public/data/nigeria.geojson",
    "MALAYSIA": "https://cdn.jsdelivr.net/gh/codeforgermany/click_that_hood@main/public/data/malaysia.geojson",
    "GERMANY": "https://cdn.jsdelivr.net/gh/codeforgermany/click_that_hood@main/public/data/germany.geojson",
    "AUSTRIA": "https://cdn.jsdelivr.net/gh/codeforgermany/click_that_hood@main/public/data/austria.geojson",
    "VENEZUELA": "https://cdn.jsdelivr.net/gh/codeforgermany/click_that_hood@main/public/data/venezuela.geojson",
    "CANADA": "https://cdn.jsdelivr.net/gh/codeforgermany/click_that_hood@main/public/data/canada.geojson",
    "CHINA": "https://cdn.jsdelivr.net/gh/codeforgermany/click_that_hood@main/public/data/china.geojson"
};

// --- CACHE DE DADOS ---
const WORLD_DATA = {
    "BRAZIL": { desc: "Maior economia da América Latina. Líder em biodiversidade (Amazônia) e agricultura." },
    "UNITED STATES OF AMERICA": { desc: "Potência global tecnológica e militar. Centro financeiro mundial." }
};

let isFetchingAI = false;

// --- DOM ELEMENTS ---
const loadingScreen = document.getElementById('loading');
const gpsData = document.getElementById('gps-data');
const infoPanel = document.getElementById('info-panel');
const uiLayer = document.getElementById('ui-layer');
const modeLabel = document.getElementById('current-mode');

// --- THREE.JS SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 14; // Câmera afastada para ver o globo grande

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('output_canvas'), alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const earthGroup = new THREE.Group();
scene.add(earthGroup);
const statesGroup = new THREE.Group();
earthGroup.add(statesGroup);

// --- GLOBO E TEXTURAS ---
const texLoader = new THREE.TextureLoader();
const earth = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS, GLOBE_SEGMENTS, GLOBE_SEGMENTS),
    new THREE.MeshPhongMaterial({
        map: texLoader.load('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg'),
        bumpMap: texLoader.load('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png'),
        bumpScale: 0.05, specular: new THREE.Color(0x222222), shininess: 12
    })
);
earthGroup.add(earth);

const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS + 0.05, GLOBE_SEGMENTS, GLOBE_SEGMENTS),
    new THREE.MeshPhongMaterial({
        map: texLoader.load('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-clouds.png'),
        transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    })
);
earthGroup.add(clouds);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.position.set(5, 3, 8);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x111111));

// --- FUNÇÕES AUXILIARES ---
function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = (radius * Math.sin(phi) * Math.sin(theta));
    const y = (radius * Math.cos(phi));
    return new THREE.Vector3(x, y, z);
}

function createLabelSprite(text, scale = 0.07, color = 'rgba(0, 242, 254, 1.0)') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256; canvas.height = 64;
    ctx.font = 'bold 24px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'; ctx.shadowBlur = 4;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.9, depthWrite: false }));
    sprite.scale.set(scale * 2, scale * 0.5, 1);
    return sprite;
}

// --- CARREGAMENTO DO MUNDO (FRONTEIRAS PAÍSES) ---
const COUNTRY_DB = [];
async function loadWorldGeoJSON() {
    try {
        const res = await fetch("https://cdn.jsdelivr.net/gh/holtzy/D3-graph-gallery@master/DATA/world.geojson");
        if (!res.ok) throw new Error("Erro ao baixar mapa mundi");
        const geojson = await res.json();
        
        // Linhas mais visíveis
        const borderMaterial = new THREE.LineBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.5 });
        
        geojson.features.forEach(feat => {
            if (!feat.geometry) return;
            const props = feat.properties || {};
            const originalName = (props.name || props.admin || "Unknown").toString();
            const iso3 = (props.iso_a3 || props.iso3 || "").toString();
            const geom = feat.geometry;
            const allCoords = [];

            function processRing(ring) {
                const vertices = [];
                ring.forEach(coord => {
                    const lon = coord[0]; const lat = coord[1];
                    allCoords.push({ lat, lon });
                    // ⚠️ ELEVAÇÃO AUMENTADA PARA NÃO SUMIR NA TERRA
                    const v = latLonToVector3(lat, lon, GLOBE_RADIUS + 0.06); 
                    vertices.push(v.x, v.y, v.z);
                });
                if (vertices.length >= 6) {
                    const g = new THREE.BufferGeometry();
                    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                    earthGroup.add(new THREE.Line(g, borderMaterial));
                }
            }
            if (geom.type === "Polygon") geom.coordinates.forEach(processRing);
            else if (geom.type === "MultiPolygon") geom.coordinates.forEach(poly => poly.forEach(processRing));

            if (allCoords.length > 0) {
                let sumLat = 0, sumLon = 0;
                allCoords.forEach(c => { sumLat += c.lat; sumLon += c.lon; });
                const centerLat = sumLat / allCoords.length;
                const centerLon = sumLon / allCoords.length;
                
                const labelText = (iso3 && iso3 !== "-99") ? iso3.toUpperCase() : originalName.toUpperCase().substring(0, 3);
                const label = createLabelSprite(labelText, 0.3);
                
                // Texto bem alto
                label.position.copy(latLonToVector3(centerLat, centerLon, GLOBE_RADIUS + 0.25));
                earthGroup.add(label);
                
                const displayName = originalName.toUpperCase();
                const desc = WORLD_DATA[displayName] ? WORLD_DATA[displayName].desc : null;
                COUNTRY_DB.push({ name: displayName, short: labelText, lat: centerLat, lon: centerLon, desc: desc });
            }
        });
        console.log("Mapa Mundi Carregado com Sucesso!");
    } catch (err) { console.error("Erro crítico no mapa mundi:", err); }
}

// --- CARREGAMENTO DOS ESTADOS ---
let currentlyLoadedCountry = null;

async function loadStatesForCountry(countryName) {
    if (currentlyLoadedCountry === countryName) return;
    statesGroup.clear();
    currentlyLoadedCountry = countryName;
    
    const url = STATE_MAPS[countryName];
    if (!url) return;

    console.log(`Carregando estados para: ${countryName}...`);

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
        const geojson = await res.json();
        
        const stateMaterial = new THREE.LineBasicMaterial({ 
            color: 0xFE0000, 
            transparent: true, 
            opacity: 0.8 // Mais opaco para ver bem
        });

        geojson.features.forEach(feat => {
            if (!feat.geometry) return;
            const props = feat.properties;
            // Tenta achar o nome em várias propriedades comuns
            const stateName = props.name || props.NAME || props.sigla || ""; 
            const allStateCoords = [];
            
            function processStateRing(ring) {
                const vertices = [];
                ring.forEach(coord => {
                    const lon = coord[0]; const lat = coord[1];
                    allStateCoords.push({lat, lon});
                    // Estados flutuando ACIMA das fronteiras do país (+0.08)
                    const v = latLonToVector3(lat, lon, GLOBE_RADIUS + 0.08);
                    vertices.push(v.x, v.y, v.z);
                });
                if (vertices.length >= 4) {
                    const g = new THREE.BufferGeometry();
                    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                    statesGroup.add(new THREE.Line(g, stateMaterial));
                }
            }
            
            const geom = feat.geometry;
            if (geom.type === "Polygon") geom.coordinates.forEach(processStateRing);
            else if (geom.type === "MultiPolygon") geom.coordinates.forEach(poly => poly.forEach(processStateRing));

            if (allStateCoords.length > 0 && stateName) {
                let sLat = 0, sLon = 0;
                allStateCoords.forEach(c => { sLat += c.lat; sLon += c.lon; });
                const cLat = sLat / allStateCoords.length;
                const cLon = sLon / allStateCoords.length;
                
                const sLabel = createLabelSprite(stateName.toUpperCase(), 0.1, '#00f2fe');
                // Nome do estado bem alto (+0.12)
                sLabel.position.copy(latLonToVector3(cLat, cLon, GLOBE_RADIUS + 0.12));
                statesGroup.add(sLabel);
            }
        });
        console.log("Estados carregados!");
    } catch (err) { 
        console.error("Erro ao carregar estados:", err);
        currentlyLoadedCountry = null; 
    }
}

// --- IA FETCH ---
async function fetchCountryDescription(countryName) {
    if (isFetchingAI) return;
    isFetchingAI = true;
    document.getElementById('geo-details').innerText = "📡 Obtendo dados...";

    try {
        const prompt = `Descreva o país ${countryName} em APENAS UMA frase curta e técnica em Português.`;
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 200 } })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        let aiText = "Dados indisponíveis.";
        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            aiText = data.candidates[0].content.parts[0].text.replace(/\*/g, '');
        }

        WORLD_DATA[countryName] = { desc: aiText };
        if (document.getElementById('geo-name').innerText === countryName) {
            document.getElementById('geo-details').innerText = aiText;
        }
    } catch (error) {
        console.error("Erro IA:", error);
        document.getElementById('geo-details').innerText = "Sem conexão IA.";
    } finally {
        isFetchingAI = false;
    }
}

// --- HAND TRACKING SETUP ---
let isGrabbing = false;
let lastHandPos = { x: 0, y: 0 };
let targetScale = 1;
let rotY = 4.7;
let rotX = 0.2;
let isScanning = false;
const ROTATION_SPEED = 0.003;

function getCoordinatesFromRotation(rY, rX) {
    let lon = -((rY % (Math.PI * 2)) / Math.PI) * 180;
    lon = (lon % 360);
    if (lon > 180) lon -= 360; if (lon < -180) lon += 360;
    lon -= 90;
    if (lon < -180) lon += 360;
    let lat = (rX / (Math.PI / 2)) * 90;
    return { lat: lat, lon: lon };
}

function findNearestLocation(lat, lon) {
    if (!COUNTRY_DB.length) return null;
    let closest = null; let minDist = 10000;
    COUNTRY_DB.forEach(loc => {
        const dist = Math.sqrt(Math.pow(loc.lat - lat, 2) + Math.pow(loc.lon - lon, 2));
        if (dist < minDist) { minDist = dist; closest = loc; }
    });
    return minDist < 20 ? closest : null;
}

const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });

const skeletonCanvasEl = document.getElementById('skeleton_canvas');
const sCtx = skeletonCanvasEl.getContext('2d');
skeletonCanvasEl.width = window.innerWidth; skeletonCanvasEl.height = window.innerHeight;

function isFingerFolded(lm, tipIdx, pipIdx) {
    const wrist = lm[0]; const tip = lm[tipIdx]; const pip = lm[pipIdx];
    return Math.hypot(tip.x - wrist.x, tip.y - wrist.y) < Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
}

hands.onResults((results) => {
    loadingScreen.style.display = 'none';
    sCtx.clearRect(0, 0, skeletonCanvasEl.width, skeletonCanvasEl.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];
        drawConnectors(sCtx, lm, HAND_CONNECTIONS, {color: '#00f2fe', lineWidth: 2});
        drawLandmarks(sCtx, lm, {color: '#fff', lineWidth: 1, radius: 3});

        const hX = (1 - lm[9].x) * window.innerWidth;
        const hY = lm[9].y * window.innerHeight;
        const indexFolded = isFingerFolded(lm, 8, 6);
        const middleFolded = isFingerFolded(lm, 12, 10);
        const ringFolded = isFingerFolded(lm, 16, 14);
        const pinkyFolded = isFingerFolded(lm, 20, 18);

        if (indexFolded && middleFolded && ringFolded && pinkyFolded) {
            modeLabel.innerText = "MOVER (PUNHO)"; modeLabel.style.color = "yellow";
            uiLayer.classList.remove('scanning'); isScanning = false;
            if (!isGrabbing) { isGrabbing = true; lastHandPos = { x: hX, y: hY }; }
            else { rotY += (hX - lastHandPos.x) * ROTATION_SPEED; rotX += (hY - lastHandPos.y) * ROTATION_SPEED; lastHandPos = { x: hX, y: hY }; }
        } else if (!indexFolded && !middleFolded && !ringFolded && !pinkyFolded) {
            isGrabbing = false; isScanning = true;
            uiLayer.classList.add('scanning');
            modeLabel.innerText = "ESCANEAR (PALMA)"; modeLabel.style.color = "#00f2fe";
        } else if (!indexFolded && !middleFolded && ringFolded && pinkyFolded) {
            isGrabbing = false; isScanning = false; uiLayer.classList.remove('scanning');
            targetScale = Math.min(3.5, targetScale + 0.03);
            modeLabel.innerText = "ZOOM + (PAZ)"; modeLabel.style.color = "lime";
        } else if (!indexFolded && middleFolded && ringFolded && pinkyFolded) {
            isGrabbing = false; isScanning = false; uiLayer.classList.remove('scanning');
            targetScale = Math.max(0.8, targetScale - 0.03);
            modeLabel.innerText = "ZOOM - (DEDO 1)"; modeLabel.style.color = "orange";
        } else {
            isGrabbing = false; isScanning = false; uiLayer.classList.remove('scanning');
            modeLabel.innerText = "NEUTRO"; modeLabel.style.color = "#555";
        }
    } else { 
        uiLayer.classList.remove('scanning'); isScanning = false; isGrabbing = false; 
        modeLabel.innerText = "SEM MÃO"; modeLabel.style.color = "#fff"; 
    }
});

// --- CHATBOT ---
const cIn = document.getElementById('chat-input');
const cBtn = document.getElementById('chat-send');
const cHist = document.getElementById('chat-history');

async function askAI(q) {
    if (!q) return;
    const userMsg = document.createElement('div'); userMsg.className = 'msg msg-user'; userMsg.innerText = q;
    cHist.appendChild(userMsg); cIn.value = ''; cHist.scrollTop = cHist.scrollHeight;
    
    const typing = document.createElement('div'); typing.className = 'msg msg-ai typing-indicator'; typing.id = 'ai-typing';
    typing.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
    cHist.appendChild(typing); cHist.scrollTop = cHist.scrollHeight;

    try {
        const prompt = `Você é uma IA tática. Responda APENAS a: "${q}". Regras: Sem saudações. Resposta curta em Português.`;
        const res = await fetch(API_URL, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 200 } })
        });
        if (!res.ok) throw new Error("Erro API");
        const data = await res.json();
        document.getElementById('ai-typing')?.remove();
        
        let ansText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Erro na resposta.";
        const ans = document.createElement('div'); ans.className = 'msg msg-ai'; ans.innerText = ansText;
        cHist.appendChild(ans);
    } catch (e) { 
        document.getElementById('ai-typing')?.remove();
        const err = document.createElement('div'); err.className = 'msg msg-error'; err.innerText = "Erro conexão."; cHist.appendChild(err); 
    }
    cHist.scrollTop = cHist.scrollHeight;
}
cBtn.onclick = () => askAI(cIn.value);
cIn.addEventListener("keypress", (e) => { if (e.key === "Enter") cBtn.click(); });

// --- ANIMAÇÃO ---
const targetMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.02, 0.03, 32),
    new THREE.MeshBasicMaterial({ color: 0x00f2fe, side: THREE.DoubleSide })
);
earthGroup.add(targetMarker);

function animate() {
    requestAnimationFrame(animate);
    earthGroup.rotation.y += (rotY - earthGroup.rotation.y) * 0.1;
    earthGroup.rotation.x += (rotX - earthGroup.rotation.x) * 0.1;
    earthGroup.rotation.x = Math.max(-1.0, Math.min(1.0, earthGroup.rotation.x));
    
    const currentScale = earthGroup.scale.x || 1;
    const newScale = currentScale + (targetScale - currentScale) * 0.1;
    earthGroup.scale.set(newScale, newScale, newScale);
    
    if(clouds) clouds.rotation.y += 0.0002;
    
    const coords = getCoordinatesFromRotation(earthGroup.rotation.y, earthGroup.rotation.x);
    gpsData.innerText = `LAT: ${coords.lat.toFixed(1)} | LON: ${coords.lon.toFixed(1)}`;

    if (isScanning) {
        const loc = findNearestLocation(coords.lat, coords.lon);
        if (loc) {
            // Debug no console para ver qual país estamos
            console.log("País detectado:", loc.name);

            infoPanel.classList.add('active');
            document.getElementById('geo-name').innerText = loc.name;
            document.getElementById('geo-coord').innerText = `${coords.lat.toFixed(1)}°, ${coords.lon.toFixed(1)}°`;
            
            targetMarker.visible = true; 
            // Marcador também elevado (+0.06)
            targetMarker.position.copy(latLonToVector3(loc.lat, loc.lon, GLOBE_RADIUS + 0.06)); 
            targetMarker.lookAt(0, 0, 0);
            
            if (loc.desc) document.getElementById('geo-details').innerText = loc.desc;
            else fetchCountryDescription(loc.name);

            if (STATE_MAPS[loc.name]) {
                loadStatesForCountry(loc.name);
            }
            else if (currentlyLoadedCountry) { 
                statesGroup.clear(); 
                currentlyLoadedCountry = null; 
            }
        } else { 
            infoPanel.classList.remove('active'); 
            targetMarker.visible = false; 
        }
    } else { 
        if (currentlyLoadedCountry) { statesGroup.clear(); currentlyLoadedCountry = null; } 
        targetMarker.visible = false; 
    }
    
    renderer.render(scene, camera);
}

// --- INIT ---
const cam = new Camera(document.getElementById('input_video'), { onFrame: async () => { await hands.send({ image: document.getElementById('input_video') }); }, width: 1280, height: 720 });
cam.start();

setTimeout(() => { if (loadingScreen.style.display !== 'none') loadingScreen.innerText = "Aguardando câmera..."; }, 5000);
window.addEventListener('resize', () => { 
    camera.aspect = window.innerWidth / window.innerHeight; 
    camera.updateProjectionMatrix(); 
    renderer.setSize(window.innerWidth, window.innerHeight); 
    skeletonCanvasEl.width = window.innerWidth; 
    skeletonCanvasEl.height = window.innerHeight; 
});

loadWorldGeoJSON();
animate();