// ============================================
// ASTROPOSE v18 — SOLAR SYSTEM
// ============================================
import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';

// --- CONFIGURAÇÕES GLOBAIS ---
const GLOBE_RADIUS = 2.5;
const GLOBE_SEGMENTS = 64; // Otimizado de 128 → 64

// --- SCENE STATES ---
const SceneState = { SOLAR_SYSTEM: 'SOLAR_SYSTEM', PLANET_APPROACH: 'PLANET_APPROACH', PLANET_SURFACE: 'PLANET_SURFACE' };
let currentState = SceneState.SOLAR_SYSTEM;
let selectedPlanet = null;
let selectedPlanetIndex = -1;
let transitionProgress = 0;
let isTransitioning = false;

// --- API CONFIG ---
const GEMINI_API_KEY = "SUA_CHAVE_AQUI";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const NASA_IMAGE_API = 'https://images-api.nasa.gov/search';
const NASA_APOD_API = 'https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY';
let isFetchingAI = false;

// --- PLANET DATA ---
const TEXTURE_BASE = 'https://upload.wikimedia.org/wikipedia/commons/';
// Procedural texture generator for planets (CORS-safe fallback)
function generatePlanetTexture(baseColor, variation, bands) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const r = (baseColor >> 16) & 0xff;
    const g = (baseColor >> 8) & 0xff;
    const b = baseColor & 0xff;

    // Base gradient
    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const noise = (Math.sin(x * 0.05 + y * 0.03) * 0.5 + 0.5) * variation;
            const bandNoise = bands ? Math.sin(y * 0.15) * 20 : 0;
            const cr = Math.min(255, Math.max(0, r + noise * 40 + bandNoise));
            const cg = Math.min(255, Math.max(0, g + noise * 30 + bandNoise * 0.5));
            const cb = Math.min(255, Math.max(0, b + noise * 20));
            ctx.fillStyle = `rgb(${cr|0},${cg|0},${cb|0})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Add some detail spots
    for (let i = 0; i < 30; i++) {
        const sx = Math.random() * canvas.width;
        const sy = Math.random() * canvas.height;
        const sr = Math.random() * 15 + 3;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r + 30},${g + 20},${b + 10},${Math.random() * 0.3})`;
        ctx.fill();
    }
    return canvas;
}

const PLANETS_DATA = [
    {
        name: 'Sol', nameEN: 'Sun', radius: 3.0, distance: 0, speed: 0, isStar: true,
        color: 0xffaa00,
        desc: 'O Sol é a estrela no centro do Sistema Solar. Contém 99.86% de toda a massa do sistema. Temperatura superficial: ~5,500°C.'
    },
    {
        name: 'Mercúrio', nameEN: 'Mercury', radius: 0.25, distance: 7, speed: 0.008, orbitOffset: Math.random() * Math.PI * 2,
        color: 0x8c7e6d,
        desc: 'Menor planeta do Sistema Solar e mais próximo do Sol. Sem atmosfera significativa. Temperatura varia de -180°C a 430°C.'
    },
    {
        name: 'Vênus', nameEN: 'Venus', radius: 0.5, distance: 10, speed: 0.006, orbitOffset: Math.random() * Math.PI * 2,
        color: 0xe8cda0,
        desc: 'Segundo planeta do Sol. Atmosfera densa de CO₂ cria efeito estufa extremo. Superfície mais quente que Mercúrio: ~465°C.'
    },
    {
        name: 'Terra', nameEN: 'Earth', radius: 0.55, distance: 14, speed: 0.005, orbitOffset: Math.random() * Math.PI * 2,
        texture: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg',
        bumpMap: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png',
        cloudMap: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-clouds.png',
        color: 0x4488ff,
        desc: 'Único planeta conhecido a abrigar vida. 71% de superfície coberta por oceanos. Atmosfera protetora de N₂ e O₂.',
        hasLandmarks: true
    },
    {
        name: 'Marte', nameEN: 'Mars', radius: 0.35, distance: 19, speed: 0.004, orbitOffset: Math.random() * Math.PI * 2,
        color: 0xcc4422,
        desc: 'Planeta vermelho. Possui o maior vulcão do sistema solar (Olympus Mons, 21km). Rover Perseverance ativo desde 2021.'
    },
    {
        name: 'Júpiter', nameEN: 'Jupiter', radius: 1.6, distance: 28, speed: 0.002, orbitOffset: Math.random() * Math.PI * 2,
        color: 0xc8a050, bands: true,
        desc: 'Maior planeta do Sistema Solar — 1,300 Terras caberiam dentro. Grande Mancha Vermelha é uma tempestade ativa há séculos.'
    },
    {
        name: 'Saturno', nameEN: 'Saturn', radius: 1.3, distance: 38, speed: 0.0015, orbitOffset: Math.random() * Math.PI * 2,
        color: 0xd4b86a, bands: true,
        hasRing: true,
        desc: 'Famoso por seus anéis de gelo e rocha. Menos denso que a água. 146 luas confirmadas, incluindo Titã com atmosfera.'
    },
    {
        name: 'Urano', nameEN: 'Uranus', radius: 0.85, distance: 48, speed: 0.001, orbitOffset: Math.random() * Math.PI * 2,
        color: 0x66cccc,
        desc: 'Gigante de gelo com eixo rotacional inclinado a 98°. Orbita o Sol "de lado". Visitado apenas pela Voyager 2 em 1986.'
    },
    {
        name: 'Netuno', nameEN: 'Neptune', radius: 0.8, distance: 56, speed: 0.0008, orbitOffset: Math.random() * Math.PI * 2,
        color: 0x3366ff,
        desc: 'Planeta mais distante do Sol. Ventos mais rápidos do sistema solar (2,100 km/h). 14 luas conhecidas, incluindo Tritão.'
    }
];

// --- NASA LANDMARKS (on Earth) ---
const NASA_LANDMARKS = [
    { name: 'Apollo 11 Splashdown', lat: 13.32, lon: -169.15, year: 1969, desc: 'Local de amerissagem da Apollo 11 no Pacífico. Primeiro pouso lunar tripulado da história. Armstrong, Aldrin e Collins.', icon: '🚀' },
    { name: 'Apollo 13 Splashdown', lat: -21.63, lon: -165.37, year: 1970, desc: '"Houston, we have a problem." Retorno de emergência após explosão de tanque de O₂. Tripulação resgatada com vida.', icon: '🆘' },
    { name: 'Point Nemo — Cemitério Espacial', lat: -48.88, lon: -123.39, year: null, desc: 'Polo oceânico de inacessibilidade. 263+ naves descartadas aqui, incluindo a estação Mir (2001) e Progress.', icon: '⚓' },
    { name: 'Skylab Debris', lat: -31.78, lon: 123.0, year: 1979, desc: 'Destroços da estação Skylab caíram na Austrália Ocidental. A cidade de Esperance multou a NASA em $400 por descarte de lixo.', icon: '💥' },
    { name: 'Cape Canaveral', lat: 28.39, lon: -80.60, year: null, desc: 'Centro de lançamento da NASA. De onde partiram todas as missões Apollo, ônibus espaciais, e SpaceX Falcon.', icon: '🏗️' },
    { name: 'Baikonur Cosmodrome', lat: 45.96, lon: 63.31, year: null, desc: 'Base de lançamento soviética/russa no Cazaquistão. De onde Gagarin partiu em 1961. Ainda ativa para missões Soyuz.', icon: '🛰️' },
    { name: 'Kennedy Space Center', lat: 28.57, lon: -80.65, year: null, desc: 'Centro espacial principal. Plataformas de lançamento 39A e 39B. Onde decolaram todas as missões Apollo com astronautas.', icon: '🌕' },
    { name: 'Apollo 17 Splashdown', lat: -17.88, lon: -166.11, year: 1972, desc: 'Última missão Apollo tripulada à Lua. Cernan e Schmitt passaram 75h na superfície lunar. Último humano na Lua.', icon: '🌙' },
    { name: 'Stardust Capsule Landing', lat: 40.36, lon: -113.50, year: 2006, desc: 'Cápsula Stardust pousou em Utah com amostras do cometa Wild 2. Primeira missão de retorno de amostra cometária.', icon: '☄️' },
    { name: 'Hayabusa2 Capsule Landing', lat: -31.4, lon: 136.9, year: 2020, desc: 'Cápsula japonesa pousou em Woomera, Austrália, com amostras do asteroide Ryugu coletadas no espaço profundo.', icon: '🔬' }
];

// --- DOM ELEMENTS ---
const loadingScreen = document.getElementById('loading');
const loadingStatus = document.getElementById('loading-status');
const gpsData = document.getElementById('gps-data');
const infoPanel = document.getElementById('info-panel');
const uiLayer = document.getElementById('ui-layer');
const modeLabel = document.getElementById('current-mode');
const modeDot = document.getElementById('mode-dot');
const bcSolar = document.getElementById('bc-solar');
const bcPlanet = document.getElementById('bc-planet');
const bcSurface = document.getElementById('bc-surface');
const transitionOverlay = document.getElementById('transition-overlay');

// --- THREE.JS SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 30, 80);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('output_canvas'),
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// --- GROUPS ---
const solarSystemGroup = new THREE.Group();
scene.add(solarSystemGroup);

const planetSurfaceGroup = new THREE.Group();
planetSurfaceGroup.visible = false;
scene.add(planetSurfaceGroup);

// --- SHARED GEOMETRY (performance) ---
const sharedSphereGeo = new THREE.SphereGeometry(1, GLOBE_SEGMENTS, GLOBE_SEGMENTS);
const sharedLowResSphereGeo = new THREE.SphereGeometry(1, 16, 16);

// --- TEXTURE LOADER ---
const texLoader = new THREE.TextureLoader();

// --- STARFIELD ---
function createStarfield() {
    const starCount = 3000;
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
        const r = 400 + Math.random() * 600;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
        sizes[i] = 0.5 + Math.random() * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.2,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8
    });
    const stars = new THREE.Points(geo, mat);
    scene.add(stars);
    return stars;
}
const starfield = createStarfield();

// --- LIGHTING ---
const sunLight = new THREE.PointLight(0xffffff, 2, 500);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

const ambientLight = new THREE.AmbientLight(0x111122, 0.3);
scene.add(ambientLight);

const hemisphereLight = new THREE.HemisphereLight(0x334466, 0x060612, 0.2);
scene.add(hemisphereLight);

// --- CREATE SOLAR SYSTEM ---
const planetMeshes = [];
const orbitLines = [];

function createSolarSystem() {
    loadingStatus.textContent = 'CONSTRUINDO SISTEMA SOLAR...';

    PLANETS_DATA.forEach((pData, index) => {
        let material;
        const mesh = new THREE.Mesh(sharedSphereGeo.clone());
        mesh.scale.set(pData.radius, pData.radius, pData.radius);

        if (pData.isStar) {
            // Sol — emissive material
            material = new THREE.MeshBasicMaterial({
                color: pData.color,
                transparent: true,
                opacity: 0.95
            });
            mesh.material = material;

            // Sun glow
            const glowGeo = new THREE.SphereGeometry(1, 32, 32);
            const glowMat = new THREE.MeshBasicMaterial({
                color: 0xffcc44,
                transparent: true,
                opacity: 0.15,
                side: THREE.BackSide
            });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            glow.scale.set(pData.radius * 1.4, pData.radius * 1.4, pData.radius * 1.4);
            solarSystemGroup.add(glow);
            mesh.userData.glow = glow;
        } else {
            // Try loading texture, fallback to procedural texture
            if (pData.texture) {
                try {
                    const tex = texLoader.load(pData.texture,
                        undefined,
                        undefined,
                        () => {
                            // Fallback on error — use procedural texture
                            const procCanvas = generatePlanetTexture(pData.color, 0.8, pData.bands || false);
                            const procTex = new THREE.CanvasTexture(procCanvas);
                            mesh.material = new THREE.MeshPhongMaterial({ map: procTex, shininess: 10 });
                        }
                    );
                    material = new THREE.MeshPhongMaterial({
                        map: tex,
                        shininess: 15,
                        specular: new THREE.Color(0x111111)
                    });

                    // Earth extras
                    if (pData.bumpMap) {
                        material.bumpMap = texLoader.load(pData.bumpMap);
                        material.bumpScale = 0.04;
                    }
                } catch (e) {
                    const procCanvas = generatePlanetTexture(pData.color, 0.8, pData.bands || false);
                    const procTex = new THREE.CanvasTexture(procCanvas);
                    material = new THREE.MeshPhongMaterial({ map: procTex, shininess: 10 });
                }
            } else {
                // No texture URL — generate procedural texture
                const procCanvas = generatePlanetTexture(pData.color, 0.8, pData.bands || false);
                const procTex = new THREE.CanvasTexture(procCanvas);
                material = new THREE.MeshPhongMaterial({
                    map: procTex,
                    shininess: 15,
                    specular: new THREE.Color(0x111111)
                });
            }
            mesh.material = material;

            // Clouds for Earth
            if (pData.cloudMap) {
                const cloudMesh = new THREE.Mesh(
                    sharedSphereGeo.clone(),
                    new THREE.MeshPhongMaterial({
                        map: texLoader.load(pData.cloudMap),
                        transparent: true,
                        opacity: 0.4,
                        blending: THREE.AdditiveBlending,
                        side: THREE.DoubleSide
                    })
                );
                cloudMesh.scale.set(pData.radius * 1.02, pData.radius * 1.02, pData.radius * 1.02);
                mesh.add(cloudMesh);
                mesh.userData.clouds = cloudMesh;
            }

            // Saturn ring
            if (pData.hasRing) {
                const ringGeo = new THREE.RingGeometry(pData.radius * 1.3, pData.radius * 2.2, 64);
                const ringMat = new THREE.MeshBasicMaterial({
                    color: 0xccbb88,
                    transparent: true,
                    opacity: 0.5,
                    side: THREE.DoubleSide
                });
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.rotation.x = Math.PI / 2.5;
                mesh.add(ring);
            }

            // Orbit line
            const orbitPoints = [];
            for (let a = 0; a <= Math.PI * 2; a += 0.02) {
                orbitPoints.push(new THREE.Vector3(
                    Math.cos(a) * pData.distance,
                    0,
                    Math.sin(a) * pData.distance
                ));
            }
            const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
            const orbitLine = new THREE.Line(orbitGeo, new THREE.LineBasicMaterial({
                color: 0x334466,
                transparent: true,
                opacity: 0.2
            }));
            solarSystemGroup.add(orbitLine);
            orbitLines.push(orbitLine);
        }

        // Label
        const label = createLabelSprite(pData.name, pData.radius * 0.3 + 0.15);
        label.position.y = pData.radius + 0.5;
        mesh.add(label);

        mesh.userData.planetData = pData;
        mesh.userData.planetIndex = index;
        solarSystemGroup.add(mesh);
        planetMeshes.push(mesh);
    });
}

function createLabelSprite(text, scale = 0.15, color = '#00f2fe') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;
    ctx.font = 'bold 48px "Orbitron", "Segoe UI", sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
    }));
    sprite.scale.set(scale * 4, scale, 1);
    return sprite;
}

// --- PLANET SURFACE VIEW ---
let surfaceEarth = null;
let surfaceGroup = null;
let landmarkMeshes = [];

function createPlanetSurface(pData) {
    // Clear previous
    while (planetSurfaceGroup.children.length > 0) {
        const child = planetSurfaceGroup.children[0];
        planetSurfaceGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
        }
    }
    landmarkMeshes = [];

    surfaceGroup = new THREE.Group();

    // Create the globe
    let material;
    if (pData.name === 'Terra') {
        material = new THREE.MeshPhongMaterial({
            map: texLoader.load(pData.texture),
            bumpMap: pData.bumpMap ? texLoader.load(pData.bumpMap) : null,
            bumpScale: 0.05,
            specular: new THREE.Color(0x222222),
            shininess: 12
        });
    } else if (pData.isStar) {
        material = new THREE.MeshBasicMaterial({ color: pData.color });
    } else if (pData.texture) {
        try {
            material = new THREE.MeshPhongMaterial({
                map: texLoader.load(pData.texture),
                shininess: 15,
                specular: new THREE.Color(0x111111)
            });
        } catch (e) {
            const procCanvas = generatePlanetTexture(pData.color, 0.8, pData.bands || false);
            material = new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(procCanvas), shininess: 10 });
        }
    } else {
        // Procedural texture for non-Earth planets
        const procCanvas = generatePlanetTexture(pData.color, 0.8, pData.bands || false);
        material = new THREE.MeshPhongMaterial({
            map: new THREE.CanvasTexture(procCanvas),
            shininess: 15,
            specular: new THREE.Color(0x111111)
        });
    }

    surfaceEarth = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS, GLOBE_SEGMENTS, GLOBE_SEGMENTS),
        material
    );
    surfaceGroup.add(surfaceEarth);

    // Clouds for Earth
    if (pData.cloudMap) {
        const clouds = new THREE.Mesh(
            new THREE.SphereGeometry(GLOBE_RADIUS + 0.04, GLOBE_SEGMENTS, GLOBE_SEGMENTS),
            new THREE.MeshPhongMaterial({
                map: texLoader.load(pData.cloudMap),
                transparent: true,
                opacity: 0.5,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide
            })
        );
        surfaceGroup.add(clouds);
        surfaceGroup.userData.clouds = clouds;
    }

    // Country borders (only for Earth)
    if (pData.name === 'Terra') {
        loadEarthBorders(surfaceGroup);
    }

    // Landmarks (only for Earth)
    if (pData.hasLandmarks) {
        createLandmarks(surfaceGroup);
    }

    // Saturn ring on surface view
    if (pData.hasRing) {
        const ringGeo = new THREE.RingGeometry(GLOBE_RADIUS * 1.3, GLOBE_RADIUS * 2.2, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xccbb88,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2.5;
        surfaceGroup.add(ring);
    }

    // Lighting for surface
    const surfaceLight = new THREE.DirectionalLight(0xffffff, 1.5);
    surfaceLight.position.set(5, 3, 8);
    surfaceGroup.add(surfaceLight);
    surfaceGroup.add(new THREE.AmbientLight(0x222233, 0.5));

    planetSurfaceGroup.add(surfaceGroup);
}

// --- EARTH BORDERS ---
const COUNTRY_DB = [];
async function loadEarthBorders(group) {
    try {
        loadingStatus.textContent = 'CARREGANDO FRONTEIRAS...';
        const res = await fetch("https://cdn.jsdelivr.net/gh/holtzy/D3-graph-gallery@master/DATA/world.geojson");
        if (!res.ok) throw new Error("Erro ao baixar mapa mundi");
        const geojson = await res.json();

        const borderMaterial = new THREE.LineBasicMaterial({
            color: 0x00f2fe,
            transparent: true,
            opacity: 0.4
        });

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
                    const v = latLonToVector3(lat, lon, GLOBE_RADIUS + 0.04);
                    vertices.push(v.x, v.y, v.z);
                });
                if (vertices.length >= 6) {
                    const g = new THREE.BufferGeometry();
                    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                    group.add(new THREE.Line(g, borderMaterial));
                }
            }
            if (geom.type === "Polygon") geom.coordinates.forEach(processRing);
            else if (geom.type === "MultiPolygon") geom.coordinates.forEach(poly => poly.forEach(processRing));

            if (allCoords.length > 0) {
                let sumLat = 0, sumLon = 0;
                allCoords.forEach(c => { sumLat += c.lat; sumLon += c.lon; });
                const centerLat = sumLat / allCoords.length;
                const centerLon = sumLon / allCoords.length;

                const displayName = originalName.toUpperCase();
                COUNTRY_DB.push({ name: displayName, lat: centerLat, lon: centerLon });
            }
        });
    } catch (err) { console.error("Erro no mapa mundi:", err); }
}

// --- LANDMARKS ---
function createLandmarks(group) {
    NASA_LANDMARKS.forEach(lm => {
        const pos = latLonToVector3(lm.lat, lm.lon, GLOBE_RADIUS + 0.06);

        // Pulsating marker
        const markerGeo = new THREE.SphereGeometry(0.04, 12, 12);
        const markerMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.position.copy(pos);

        // Glow ring
        const ringGeo = new THREE.RingGeometry(0.05, 0.08, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xf97316,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        ring.lookAt(0, 0, 0);

        // Label
        const label = createLabelSprite(lm.icon + ' ' + lm.name.substring(0, 15), 0.06, '#f97316');
        label.position.copy(latLonToVector3(lm.lat, lm.lon, GLOBE_RADIUS + 0.15));

        marker.userData.landmark = lm;
        ring.userData.landmark = lm;

        group.add(marker);
        group.add(ring);
        group.add(label);

        landmarkMeshes.push({ marker, ring, label, data: lm });
    });
}

// --- HELPER FUNCTIONS ---
function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = (radius * Math.sin(phi) * Math.sin(theta));
    const y = (radius * Math.cos(phi));
    return new THREE.Vector3(x, y, z);
}

// --- CAMERA CONTROL ---
let cameraTarget = new THREE.Vector3(0, 0, 0);
let cameraPosition = new THREE.Vector3(0, 30, 80);
let cameraLerp = 0.04;

// Solar System camera
let solarRotY = 0;
let solarRotX = 0.4;
let solarDistance = 80;

// Planet surface camera
let surfaceRotY = 4.7;
let surfaceRotX = 0.2;
let surfaceScale = 1;
let targetSurfaceScale = 1;

// --- HAND TRACKING ---
let isGrabbing = false;
let lastHandPos = { x: 0, y: 0 };
let isScanning = false;
const ROTATION_SPEED = 0.004;
let frameCount = 0;

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
});

const skeletonCanvasEl = document.getElementById('skeleton_canvas');
const sCtx = skeletonCanvasEl.getContext('2d');
skeletonCanvasEl.width = window.innerWidth;
skeletonCanvasEl.height = window.innerHeight;

function isFingerFolded(lm, tipIdx, pipIdx) {
    const wrist = lm[0]; const tip = lm[tipIdx]; const pip = lm[pipIdx];
    return Math.hypot(tip.x - wrist.x, tip.y - wrist.y) < Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
}

// --- GESTURE HANDLER ---
hands.onResults((results) => {
    loadingScreen.style.display = 'none';
    sCtx.clearRect(0, 0, skeletonCanvasEl.width, skeletonCanvasEl.height);

    // Throttle: process every 2nd frame for performance
    frameCount++;
    if (frameCount % 2 !== 0 && results.multiHandLandmarks?.length > 0) {
        // Still draw skeleton on skipped frames
        const lm = results.multiHandLandmarks[0];
        drawConnectors(sCtx, lm, HAND_CONNECTIONS, { color: '#00f2fe', lineWidth: 2 });
        drawLandmarks(sCtx, lm, { color: '#fff', lineWidth: 1, radius: 2 });
        return;
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];
        drawConnectors(sCtx, lm, HAND_CONNECTIONS, { color: '#00f2fe', lineWidth: 2 });
        drawLandmarks(sCtx, lm, { color: '#fff', lineWidth: 1, radius: 2 });

        const hX = (1 - lm[9].x) * window.innerWidth;
        const hY = lm[9].y * window.innerHeight;

        const indexFolded = isFingerFolded(lm, 8, 6);
        const middleFolded = isFingerFolded(lm, 12, 10);
        const ringFolded = isFingerFolded(lm, 16, 14);
        const pinkyFolded = isFingerFolded(lm, 20, 18);

        // FIST - Move
        if (indexFolded && middleFolded && ringFolded && pinkyFolded) {
            setMode('MOVER ✊', 'yellow');
            uiLayer.classList.remove('scanning');
            isScanning = false;

            if (!isGrabbing) {
                isGrabbing = true;
                lastHandPos = { x: hX, y: hY };
            } else {
                const dx = (hX - lastHandPos.x) * ROTATION_SPEED;
                const dy = (hY - lastHandPos.y) * ROTATION_SPEED;

                if (currentState === SceneState.SOLAR_SYSTEM) {
                    solarRotY += dx;
                    solarRotX += dy;
                    solarRotX = Math.max(-0.8, Math.min(1.2, solarRotX));
                } else {
                    surfaceRotY += dx;
                    surfaceRotX += dy;
                    surfaceRotX = Math.max(-1.0, Math.min(1.0, surfaceRotX));
                }
                lastHandPos = { x: hX, y: hY };
            }
        }
        // PALM - Scan
        else if (!indexFolded && !middleFolded && !ringFolded && !pinkyFolded) {
            isGrabbing = false;
            isScanning = true;
            uiLayer.classList.add('scanning');
            setMode('ESCANEAR ✋', '#00f2fe');
        }
        // PEACE - Zoom In
        else if (!indexFolded && !middleFolded && ringFolded && pinkyFolded) {
            isGrabbing = false;
            isScanning = false;
            uiLayer.classList.remove('scanning');
            setMode('ZOOM + ✌️', '#22c55e');

            if (currentState === SceneState.SOLAR_SYSTEM) {
                solarDistance = Math.max(15, solarDistance - 0.6);

                // If close enough to a planet, transition
                if (solarDistance < 20 && selectedPlanet) {
                    enterPlanet(selectedPlanet);
                }
            } else {
                targetSurfaceScale = Math.min(3.5, targetSurfaceScale + 0.03);
            }
        }
        // INDEX ONLY - Zoom Out
        else if (!indexFolded && middleFolded && ringFolded && pinkyFolded) {
            isGrabbing = false;
            isScanning = false;
            uiLayer.classList.remove('scanning');
            setMode('ZOOM - ☝️', '#f97316');

            if (currentState === SceneState.SOLAR_SYSTEM) {
                solarDistance = Math.min(120, solarDistance + 0.6);
            } else {
                targetSurfaceScale = Math.max(0.3, targetSurfaceScale - 0.03);

                // If zoomed out enough, return to solar system
                if (targetSurfaceScale <= 0.35) {
                    exitPlanet();
                }
            }
        }
        // NEUTRAL
        else {
            isGrabbing = false;
            isScanning = false;
            uiLayer.classList.remove('scanning');
            setMode('NEUTRO', '#555');
        }
    } else {
        uiLayer.classList.remove('scanning');
        isScanning = false;
        isGrabbing = false;
        setMode('SEM MÃO', '#888');
    }
});

function setMode(text, color) {
    modeLabel.innerText = text;
    modeLabel.style.color = color;
    if (modeDot) modeDot.style.background = color;
}

// --- TRANSITIONS ---
function enterPlanet(pData) {
    if (isTransitioning) return;
    isTransitioning = true;
    selectedPlanet = pData;

    transitionOverlay.classList.add('active');
    updateBreadcrumb(SceneState.PLANET_SURFACE);

    // Hide planet selector
    const ps = document.getElementById('planet-selector');
    if (ps) ps.classList.add('hidden');

    setTimeout(() => {
        currentState = SceneState.PLANET_SURFACE;
        solarSystemGroup.visible = false;
        planetSurfaceGroup.visible = true;

        createPlanetSurface(pData);

        // Reset surface camera
        surfaceRotY = 4.7;
        surfaceRotX = 0.2;
        targetSurfaceScale = 1;
        surfaceScale = 0.3; // Start small for zoom-in effect

        camera.position.set(0, 0, 14);
        camera.lookAt(0, 0, 0);

        // Show info panel
        showPlanetInfo(pData);

        // Fetch NASA image
        fetchNASAImage(pData.nameEN);

        setTimeout(() => {
            transitionOverlay.classList.remove('active');
            isTransitioning = false;
        }, 600);
    }, 800);
}

function exitPlanet() {
    if (isTransitioning) return;
    isTransitioning = true;

    transitionOverlay.classList.add('active');
    updateBreadcrumb(SceneState.SOLAR_SYSTEM);

    setTimeout(() => {
        currentState = SceneState.SOLAR_SYSTEM;
        solarSystemGroup.visible = true;
        planetSurfaceGroup.visible = false;

        // Dispose surface resources
        while (planetSurfaceGroup.children.length > 0) {
            const child = planetSurfaceGroup.children[0];
            planetSurfaceGroup.remove(child);
        }
        landmarkMeshes = [];
        COUNTRY_DB.length = 0;

        // Reset solar camera
        solarDistance = 80;
        camera.position.set(0, 30, 80);

        // Hide info panel
        infoPanel.classList.remove('active');
        document.getElementById('landmark-info').style.display = 'none';

        // Show planet selector again & reset selection
        selectedPlanetIndex = -1;
        selectedPlanet = null;
        highlightPlanetSelector(-1);
        const ps = document.getElementById('planet-selector');
        if (ps) ps.classList.remove('hidden');

        setTimeout(() => {
            transitionOverlay.classList.remove('active');
            isTransitioning = false;
        }, 600);
    }, 800);
}

function updateBreadcrumb(state) {
    bcSolar.classList.toggle('active', state === SceneState.SOLAR_SYSTEM);
    bcPlanet.classList.toggle('active', state === SceneState.PLANET_APPROACH);
    bcSurface.classList.toggle('active', state === SceneState.PLANET_SURFACE);
}

// --- PLANET INFO ---
function showPlanetInfo(pData) {
    document.getElementById('info-badge').textContent = pData.isStar ? 'ESTRELA' : 'PLANETA';
    document.getElementById('geo-name').textContent = pData.name;
    document.getElementById('geo-coord').textContent = pData.isStar
        ? 'CENTRO DO SISTEMA SOLAR'
        : `DISTÂNCIA: ${pData.distance} UA (escala)`;
    document.getElementById('geo-details').textContent = pData.desc;
    infoPanel.classList.add('active');
}

// --- SCANNING LOGIC ---
function findNearestPlanet() {
    // Find which planet is closest to screen center (including the sun)
    let closest = null;
    let minDist = Infinity;

    const tempVec = new THREE.Vector3();

    planetMeshes.forEach(mesh => {
        tempVec.setFromMatrixPosition(mesh.matrixWorld);
        tempVec.project(camera);

        // Only consider planets that are in front of the camera (z < 1)
        if (tempVec.z > 1) return;

        const dist = Math.sqrt(tempVec.x * tempVec.x + tempVec.y * tempVec.y);
        if (dist < minDist) {
            minDist = dist;
            closest = mesh;
        }
    });

    return minDist < 0.8 ? closest : null;
}

function getCoordinatesFromRotation(rY, rX) {
    let lon = -((rY % (Math.PI * 2)) / Math.PI) * 180;
    lon = (lon % 360);
    if (lon > 180) lon -= 360;
    if (lon < -180) lon += 360;
    lon -= 90;
    if (lon < -180) lon += 360;
    let lat = (rX / (Math.PI / 2)) * 90;
    return { lat, lon };
}

function findNearestLocation(lat, lon) {
    if (!COUNTRY_DB.length) return null;
    let closest = null;
    let minDist = 10000;
    COUNTRY_DB.forEach(loc => {
        const dist = Math.sqrt((loc.lat - lat) ** 2 + (loc.lon - lon) ** 2);
        if (dist < minDist) { minDist = dist; closest = loc; }
    });
    return minDist < 20 ? closest : null;
}

function findNearestLandmark(lat, lon) {
    let closest = null;
    let minDist = 10000;
    NASA_LANDMARKS.forEach(lm => {
        const dist = Math.sqrt((lm.lat - lat) ** 2 + (lm.lon - lon) ** 2);
        if (dist < minDist) { minDist = dist; closest = lm; }
    });
    return minDist < 8 ? closest : null;
}

// --- NASA API ---
async function fetchNASAImage(query) {
    try {
        const container = document.getElementById('nasa-image-container');
        const res = await fetch(`${NASA_IMAGE_API}?q=${encodeURIComponent(query)}&media_type=image&page_size=1`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.collection?.items?.length > 0) {
            const item = data.collection.items[0];
            const imageUrl = item.links?.[0]?.href;
            const title = item.data?.[0]?.title || '';
            if (imageUrl) {
                document.getElementById('nasa-image').src = imageUrl;
                document.getElementById('nasa-caption').textContent = title;
                container.style.display = 'block';
            }
        }
    } catch (e) {
        console.error('NASA Image API error:', e);
    }
}

async function fetchAPOD() {
    try {
        const res = await fetch(NASA_APOD_API);
        if (!res.ok) return;
        const data = await res.json();
        if (data.url && data.media_type === 'image') {
            document.getElementById('apod-image').src = data.url;
            document.getElementById('apod-title').textContent = data.title || '';
            document.getElementById('apod-panel').classList.add('visible');
        }
    } catch (e) {
        console.error('APOD error:', e);
    }
}

// --- AI FETCH ---
async function fetchCountryDescription(countryName) {
    if (isFetchingAI) return;
    isFetchingAI = true;
    document.getElementById('geo-details').innerText = "📡 Obtendo dados...";

    try {
        const prompt = `Descreva o país ${countryName} em APENAS UMA frase curta e técnica em Português.`;
        const res = await fetch(GEMINI_API_URL, {
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
        document.getElementById('geo-details').innerText = aiText;
    } catch (error) {
        document.getElementById('geo-details').innerText = "Sem conexão IA.";
    } finally {
        isFetchingAI = false;
    }
}

// --- CHATBOT ---
const cIn = document.getElementById('chat-input');
const cBtn = document.getElementById('chat-send');
const cHist = document.getElementById('chat-history');

async function askAI(q) {
    if (!q) return;
    const userMsg = document.createElement('div');
    userMsg.className = 'msg msg-user';
    userMsg.innerText = q;
    cHist.appendChild(userMsg);
    cIn.value = '';
    cHist.scrollTop = cHist.scrollHeight;

    const typing = document.createElement('div');
    typing.className = 'msg msg-ai typing-indicator';
    typing.id = 'ai-typing';
    typing.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
    cHist.appendChild(typing);
    cHist.scrollTop = cHist.scrollHeight;

    try {
        const prompt = `Você é uma IA tática espacial do AstroPose. Responda APENAS a: "${q}". Regras: Sem saudações. Resposta curta em Português. Foque em astronomia e exploração espacial.`;
        const res = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 200 } })
        });
        if (!res.ok) throw new Error("Erro API");
        const data = await res.json();
        document.getElementById('ai-typing')?.remove();

        let ansText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Erro na resposta.";
        const ans = document.createElement('div');
        ans.className = 'msg msg-ai';
        ans.innerText = ansText;
        cHist.appendChild(ans);
    } catch (e) {
        document.getElementById('ai-typing')?.remove();
        const err = document.createElement('div');
        err.className = 'msg msg-error';
        err.innerText = "Erro conexão.";
        cHist.appendChild(err);
    }
    cHist.scrollTop = cHist.scrollHeight;
}
cBtn.onclick = () => askAI(cIn.value);
cIn.addEventListener("keypress", (e) => { if (e.key === "Enter") cBtn.click(); });

// --- ANIMATION LOOP ---
let prevTime = performance.now();

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const delta = (now - prevTime) / 1000;
    prevTime = now;

    if (currentState === SceneState.SOLAR_SYSTEM) {
        animateSolarSystem(delta);
    } else if (currentState === SceneState.PLANET_SURFACE) {
        animatePlanetSurface(delta);
    }

    renderer.render(scene, camera);
}

function animateSolarSystem(delta) {
    // Update planet positions (orbit)
    const time = performance.now() * 0.001;

    planetMeshes.forEach(mesh => {
        const pData = mesh.userData.planetData;
        if (pData.isStar) {
            // Sun rotation
            mesh.rotation.y += 0.001;
            // Sunlight glow pulsing
            if (mesh.userData.glow) {
                const pulse = 1 + Math.sin(time * 2) * 0.05;
                mesh.userData.glow.scale.set(pData.radius * 1.4 * pulse, pData.radius * 1.4 * pulse, pData.radius * 1.4 * pulse);
            }
        } else {
            // Orbit
            const angle = time * pData.speed + (pData.orbitOffset || 0);
            mesh.position.x = Math.cos(angle) * pData.distance;
            mesh.position.z = Math.sin(angle) * pData.distance;

            // Self rotation
            mesh.rotation.y += 0.005;

            // Earth clouds
            if (mesh.userData.clouds) {
                mesh.userData.clouds.rotation.y += 0.002;
            }
        }
    });

    // Camera orbit
    const camX = Math.sin(solarRotY) * solarDistance * Math.cos(solarRotX);
    const camY = Math.sin(solarRotX) * solarDistance * 0.5;
    const camZ = Math.cos(solarRotY) * solarDistance * Math.cos(solarRotX);

    camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.06);
    camera.lookAt(0, 0, 0);

    // Scanning in solar system
    if (isScanning) {
        const nearest = findNearestPlanet();
        if (nearest) {
            selectedPlanet = nearest.userData.planetData;
            selectedPlanetIndex = nearest.userData.planetIndex;
            showPlanetInfo(selectedPlanet);
            highlightPlanetSelector(selectedPlanetIndex);
        } else {
            infoPanel.classList.remove('active');
            selectedPlanet = null;
            selectedPlanetIndex = -1;
            highlightPlanetSelector(-1);
        }
    } else {
        if (!isTransitioning && selectedPlanetIndex === -1) {
            infoPanel.classList.remove('active');
        }
    }

    // Starfield gentle rotation
    starfield.rotation.y += 0.00005;
}

function animatePlanetSurface(delta) {
    if (!surfaceGroup) return;

    // Smooth rotation
    surfaceGroup.rotation.y += (surfaceRotY - surfaceGroup.rotation.y) * 0.1;
    surfaceGroup.rotation.x += (surfaceRotX - surfaceGroup.rotation.x) * 0.1;
    surfaceGroup.rotation.x = Math.max(-1.0, Math.min(1.0, surfaceGroup.rotation.x));

    // Smooth scale
    surfaceScale += (targetSurfaceScale - surfaceScale) * 0.08;
    surfaceGroup.scale.set(surfaceScale, surfaceScale, surfaceScale);

    // Clouds rotation
    if (surfaceGroup.userData.clouds) {
        surfaceGroup.userData.clouds.rotation.y += 0.0003;
    }

    // Landmark pulsing animation
    const time = performance.now() * 0.001;
    landmarkMeshes.forEach(lm => {
        const pulse = 1 + Math.sin(time * 3) * 0.3;
        lm.ring.scale.set(pulse, pulse, pulse);
        lm.marker.scale.set(pulse * 0.8, pulse * 0.8, pulse * 0.8);
    });

    // GPS & scanning for surface
    const coords = getCoordinatesFromRotation(surfaceGroup.rotation.y, surfaceGroup.rotation.x);
    gpsData.innerText = `LAT: ${coords.lat.toFixed(1)} | LON: ${coords.lon.toFixed(1)}`;

    if (isScanning && selectedPlanet?.name === 'Terra') {
        // Check for landmarks
        const landmark = findNearestLandmark(coords.lat, coords.lon);
        if (landmark) {
            showLandmarkInfo(landmark);
        } else {
            document.getElementById('landmark-info').style.display = 'none';

            // Check for countries
            const loc = findNearestLocation(coords.lat, coords.lon);
            if (loc) {
                document.getElementById('info-badge').textContent = 'PAÍS';
                document.getElementById('geo-name').textContent = loc.name;
                document.getElementById('geo-coord').textContent = `${coords.lat.toFixed(1)}°, ${coords.lon.toFixed(1)}°`;
                infoPanel.classList.add('active');
            }
        }
    } else if (isScanning && selectedPlanet) {
        // Show planet info when scanning non-Earth
        showPlanetInfo(selectedPlanet);
    }

    // Camera for surface
    camera.position.set(0, 0, 14);
    camera.lookAt(0, 0, 0);
}

function showLandmarkInfo(lm) {
    infoPanel.classList.add('active');
    document.getElementById('info-badge').textContent = 'MARCO NASA';
    document.getElementById('geo-name').textContent = selectedPlanet?.name || 'Terra';

    const landmarkDiv = document.getElementById('landmark-info');
    landmarkDiv.style.display = 'block';
    document.getElementById('landmark-name').textContent = lm.icon + ' ' + lm.name;
    document.getElementById('landmark-desc').textContent =
        (lm.year ? `[${lm.year}] ` : '') + lm.desc;
}

// --- INIT ---
async function init() {
    loadingStatus.textContent = 'INICIALIZANDO CÂMERA...';

    createSolarSystem();

    // Start camera
    const cam = new Camera(document.getElementById('input_video'), {
        onFrame: async () => {
            await hands.send({ image: document.getElementById('input_video') });
        },
        width: 1280,
        height: 720
    });
    cam.start();

    // Load APOD
    fetchAPOD();

    // Set initial breadcrumb
    updateBreadcrumb(SceneState.SOLAR_SYSTEM);

    // Loading timeout
    setTimeout(() => {
        if (loadingScreen.style.display !== 'none') {
            loadingStatus.textContent = 'AGUARDANDO CÂMERA...';
        }
    }, 5000);
}

// --- PLANET SELECTOR UI ---
function createPlanetSelector() {
    const container = document.createElement('div');
    container.id = 'planet-selector';
    container.innerHTML = `
        <div class="ps-header">SELECIONAR PLANETA</div>
        <div class="ps-list" id="ps-list"></div>
    `;
    document.getElementById('ui-layer').appendChild(container);

    const list = document.getElementById('ps-list');
    PLANETS_DATA.forEach((pData, index) => {
        const item = document.createElement('div');
        item.className = 'ps-item';
        item.id = `ps-item-${index}`;
        item.dataset.index = index;

        // Color preview dot
        const colorHex = '#' + pData.color.toString(16).padStart(6, '0');
        item.innerHTML = `
            <div class="ps-color" style="background: ${colorHex}; box-shadow: 0 0 8px ${colorHex};"></div>
            <div class="ps-name">${pData.name}</div>
        `;

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isTransitioning) return;

            if (currentState === SceneState.SOLAR_SYSTEM) {
                selectedPlanetIndex = index;
                selectedPlanet = pData;
                showPlanetInfo(pData);
                highlightPlanetSelector(index);

                // Auto-enter the planet
                enterPlanet(pData);
            }
        });

        list.appendChild(item);
    });
}

function highlightPlanetSelector(index) {
    const items = document.querySelectorAll('.ps-item');
    items.forEach((item, i) => {
        item.classList.toggle('active', i === index);
    });
}

// --- KEYBOARD CONTROLS ---
window.addEventListener('keydown', (e) => {
    if (isTransitioning) return;

    if (currentState === SceneState.SOLAR_SYSTEM) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            selectedPlanetIndex = Math.min(PLANETS_DATA.length - 1, selectedPlanetIndex + 1);
            if (selectedPlanetIndex < 0) selectedPlanetIndex = 0;
            selectedPlanet = PLANETS_DATA[selectedPlanetIndex];
            showPlanetInfo(selectedPlanet);
            highlightPlanetSelector(selectedPlanetIndex);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            selectedPlanetIndex = Math.max(0, selectedPlanetIndex - 1);
            selectedPlanet = PLANETS_DATA[selectedPlanetIndex];
            showPlanetInfo(selectedPlanet);
            highlightPlanetSelector(selectedPlanetIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedPlanet) {
                enterPlanet(selectedPlanet);
            }
        }
    } else if (currentState === SceneState.PLANET_SURFACE) {
        if (e.key === 'Escape' || e.key === 'Backspace') {
            e.preventDefault();
            exitPlanet();
        }
    }
});

// --- RESIZE ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    skeletonCanvasEl.width = window.innerWidth;
    skeletonCanvasEl.height = window.innerHeight;
});

// --- START ---
createPlanetSelector();
init();
animate();