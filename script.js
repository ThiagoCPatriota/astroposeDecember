// ============================================
// ASTROPOSE v18 — SOLAR SYSTEM
// ============================================
import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
// import { NASA_API_KEY } from './config.js';
let apiKey = 'DEMO_KEY';
// Tenta obter a chave da Vercel (se estiver lá) ou de uma variável global
if (typeof NASA_API_KEY !== 'undefined') {
    apiKey = NASA_API_KEY;
} else if (import.meta.env && import.meta.env.VITE_NASA_KEY) {
    apiKey = import.meta.env.VITE_NASA_KEY;
}

// const NASA_APOD_API = `https://api.nasa.gov/planetary/apod?api_key=${apiKey}`;



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

const NASA_IMAGE_API = 'https://images-api.nasa.gov/search';
// const NASA_APOD_API = `https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}`;
const NASA_APOD_API = `https://api.nasa.gov/planetary/apod?api_key=${apiKey}`;

// --- PLANET DATA ---
const TEXTURE_BASE = 'https://upload.wikimedia.org/wikipedia/commons/';

// --- SEEDED RANDOM for consistent procedural textures ---
function seededRandom(seed) {
    let s = seed;
    return function () {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
}

// --- SIMPLEX-LIKE NOISE (fast 2D) ---
function fbmNoise(x, y, octaves = 4) {
    let val = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
        val += amp * (Math.sin(x * freq * 1.7 + y * freq * 0.9) * Math.cos(y * freq * 1.3 + x * freq * 0.7) * 0.5 + 0.5);
        max += amp;
        amp *= 0.5;
        freq *= 2.1;
    }
    return val / max;
}

// --- ADVANCED PROCEDURAL TEXTURE GENERATOR ---
function generatePlanetTexture(baseColor, variation, bands, planetType) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const r = (baseColor >> 16) & 0xff;
    const g = (baseColor >> 8) & 0xff;
    const b = baseColor & 0xff;
    const rng = seededRandom(baseColor);

    // Fill base
    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const data = imgData.data;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const nx = x / canvas.width;
            const ny = y / canvas.height;

            let cr, cg, cb;

            if (planetType === 'mercury') {
                // Rocky, cratered surface
                const n = fbmNoise(nx * 20, ny * 12, 5);
                const detail = fbmNoise(nx * 50, ny * 30, 3) * 0.3;
                const val = n * 0.7 + detail;
                cr = r + (val - 0.5) * 60;
                cg = g + (val - 0.5) * 50;
                cb = b + (val - 0.5) * 40;
            } else if (planetType === 'venus') {
                // Thick swirling clouds
                const swirl = fbmNoise(nx * 8 + ny * 2, ny * 6, 5);
                const clouds = fbmNoise(nx * 15 + swirl * 3, ny * 10, 4) * 0.4;
                const val = swirl * 0.6 + clouds;
                cr = r + (val - 0.5) * 50;
                cg = g + (val - 0.5) * 45;
                cb = b + (val - 0.5) * 30;
            } else if (planetType === 'mars') {
                // Red desert with polar caps and canyons
                const terrain = fbmNoise(nx * 16, ny * 10, 5);
                const canyon = Math.max(0, 1 - Math.abs(fbmNoise(nx * 8 + 5, ny * 6, 3) - 0.5) * 6);
                const polar = Math.max(0, (Math.abs(ny - 0.5) - 0.38) * 8);
                cr = r + (terrain - 0.5) * 55 - canyon * 35;
                cg = g + (terrain - 0.5) * 30 - canyon * 20 + polar * 100;
                cb = b + (terrain - 0.5) * 15 + polar * 80;
            } else if (planetType === 'jupiter') {
                // Distinct colored bands with Great Red Spot
                const bandY = Math.sin(ny * Math.PI * 12) * 0.5 + 0.5;
                const turbulence = fbmNoise(nx * 20 + bandY * 2, ny * 30, 4) * 0.3;
                const drift = fbmNoise(nx * 6, ny * 15, 3) * 0.15;
                const val = bandY + turbulence + drift;
                cr = r + (val - 0.5) * 70 + Math.sin(ny * 25) * 15;
                cg = g + (val - 0.5) * 50 + Math.sin(ny * 20) * 10;
                cb = b + (val - 0.5) * 20;
                // Great Red Spot approximation
                const spotX = nx - 0.35, spotY = ny - 0.55;
                const spotDist = Math.sqrt(spotX * spotX * 4 + spotY * spotY * 16);
                if (spotDist < 0.12) {
                    const spotBlend = 1 - spotDist / 0.12;
                    cr += spotBlend * 60;
                    cg -= spotBlend * 30;
                    cb -= spotBlend * 25;
                }
            } else if (planetType === 'saturn') {
                // Banded, softer than Jupiter
                const bandY = Math.sin(ny * Math.PI * 8) * 0.5 + 0.5;
                const soft = fbmNoise(nx * 12, ny * 20, 3) * 0.25;
                const val = bandY * 0.7 + soft + fbmNoise(nx * 5, ny * 8, 2) * 0.15;
                cr = r + (val - 0.5) * 50;
                cg = g + (val - 0.5) * 40;
                cb = b + (val - 0.5) * 25;
            } else if (planetType === 'uranus') {
                // Smooth blue-green with subtle bands
                const subtle = fbmNoise(nx * 6, ny * 4, 3) * 0.2;
                const band = Math.sin(ny * Math.PI * 4) * 0.08;
                cr = r + (subtle + band) * 35;
                cg = g + (subtle + band) * 30;
                cb = b + subtle * 20;
            } else if (planetType === 'neptune') {
                // Deep blue with storm features
                const storms = fbmNoise(nx * 10, ny * 8, 4);
                const darkSpot = Math.max(0, 1 - Math.sqrt((nx - 0.4) ** 2 * 8 + (ny - 0.45) ** 2 * 20) * 5);
                const band = Math.sin(ny * Math.PI * 6) * 0.1;
                cr = r + storms * 25 - darkSpot * 30;
                cg = g + storms * 20 + band * 15;
                cb = b + storms * 35 + band * 10;
            } else {
                // Generic fallback
                const n = fbmNoise(nx * 12, ny * 8, 4);
                const bandNoise = bands ? Math.sin(ny * Math.PI * 10) * 20 : 0;
                cr = r + (n - 0.5) * 60 + bandNoise;
                cg = g + (n - 0.5) * 45 + bandNoise * 0.5;
                cb = b + (n - 0.5) * 30;
            }

            data[idx] = Math.min(255, Math.max(0, cr));
            data[idx + 1] = Math.min(255, Math.max(0, cg));
            data[idx + 2] = Math.min(255, Math.max(0, cb));
            data[idx + 3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);

    // Add craters for rocky planets
    if (planetType === 'mercury' || planetType === 'mars') {
        const craterCount = planetType === 'mercury' ? 80 : 40;
        for (let i = 0; i < craterCount; i++) {
            const cx = rng() * canvas.width;
            const cy = rng() * canvas.height;
            const cr = rng() * (planetType === 'mercury' ? 18 : 12) + 3;
            // Dark rim
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0,0,0,${0.15 + rng() * 0.15})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Lighter center
            ctx.beginPath();
            ctx.arc(cx, cy, cr * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${0.03 + rng() * 0.06})`;
            ctx.fill();
            // Shadow
            ctx.beginPath();
            ctx.arc(cx + 1, cy + 1, cr * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0,0,0,${0.04 + rng() * 0.04})`;
            ctx.fill();
        }
    }

    return canvas;
}

// Generate procedural bump map
function generateBumpMap(baseColor, planetType) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const data = imgData.data;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const nx = x / canvas.width;
            const ny = y / canvas.height;
            let height;

            if (planetType === 'mercury' || planetType === 'mars') {
                height = fbmNoise(nx * 20, ny * 14, 5) * 200 + fbmNoise(nx * 40, ny * 25, 3) * 55;
            } else if (planetType === 'venus') {
                height = fbmNoise(nx * 10, ny * 8, 4) * 120 + 60;
            } else {
                height = fbmNoise(nx * 12, ny * 8, 4) * 180 + 40;
            }

            const v = Math.min(255, Math.max(0, height));
            data[idx] = v; data[idx + 1] = v; data[idx + 2] = v; data[idx + 3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
}

// Generate procedural cloud texture
function generateCloudTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const data = imgData.data;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const nx = x / canvas.width;
            const ny = y / canvas.height;
            let alpha, brightness;

            if (type === 'venus') {
                // Dense, swirling yellowish clouds
                const swirl = fbmNoise(nx * 10 + ny * 3, ny * 8 + nx * 1.5, 5);
                alpha = swirl * 200 + 30;
                brightness = 220 + swirl * 35;
                data[idx] = Math.min(255, brightness);
                data[idx + 1] = Math.min(255, brightness - 15);
                data[idx + 2] = Math.min(255, brightness - 50);
            } else if (type === 'jupiter' || type === 'saturn') {
                // Thin wispy bands
                const band = Math.sin(ny * Math.PI * (type === 'jupiter' ? 14 : 10));
                const wisp = fbmNoise(nx * 18 + band * 2, ny * 25, 4);
                alpha = Math.max(0, wisp * 120 - 30) * (0.3 + Math.abs(band) * 0.7);
                data[idx] = 255; data[idx + 1] = 248; data[idx + 2] = 230;
            } else {
                // Generic wispy clouds
                const cloud = fbmNoise(nx * 12, ny * 8, 5);
                alpha = Math.max(0, (cloud - 0.35) * 250);
                data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255;
            }

            data[idx + 3] = Math.min(255, Math.max(0, alpha));
        }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
}

// Generate Saturn ring texture
function generateRingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 64;
    const ctx = canvas.getContext('2d');

    for (let x = 0; x < canvas.width; x++) {
        const t = x / canvas.width;
        // Multiple ring bands with gaps
        const band1 = Math.max(0, Math.sin(t * Math.PI * 40) * 0.5 + 0.3);
        const band2 = Math.max(0, Math.sin(t * Math.PI * 23) * 0.4 + 0.2);
        const gap1 = t > 0.35 && t < 0.38 ? 0 : 1; // Cassini division
        const gap2 = t > 0.62 && t < 0.64 ? 0 : 1;
        const density = (band1 + band2) * 0.5 * gap1 * gap2;
        const brightness = 180 + fbmNoise(t * 50, 0.5, 2) * 60;

        for (let y = 0; y < canvas.height; y++) {
            ctx.fillStyle = `rgba(${brightness},${brightness - 15},${brightness - 40},${density * 0.7})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    return canvas;
}

const PLANETS_DATA = [
    {
        name: 'Sol', nameEN: 'Sun', radius: 3.0, distance: 0, speed: 0, isStar: true,
        color: 0xffaa00, planetType: 'sun',
        atmosphereColor: 0xff6600, atmosphereScale: 1.15, atmosphereOpacity: 0.08,
        desc: 'O Sol é a estrela no centro do Sistema Solar. Contém 99.86% de toda a massa do sistema. Temperatura superficial: ~5,500°C.'
    },
    {
        name: 'Mercúrio', nameEN: 'Mercury', radius: 0.25, distance: 7, speed: 0.008, orbitOffset: Math.random() * Math.PI * 2,
        color: 0x8c7e6d, planetType: 'mercury',
        hasBumpMap: true,
        desc: 'Menor planeta do Sistema Solar e mais próximo do Sol. Sem atmosfera significativa. Temperatura varia de -180°C a 430°C.'
    },
    {
        name: 'Vênus', nameEN: 'Venus', radius: 0.5, distance: 10, speed: 0.006, orbitOffset: Math.random() * Math.PI * 2,
        color: 0xe8cda0, planetType: 'venus',
        hasClouds: true, cloudType: 'venus',
        atmosphereColor: 0xffcc88, atmosphereScale: 1.08, atmosphereOpacity: 0.12,
        hasBumpMap: true,
        desc: 'Segundo planeta do Sol. Atmosfera densa de CO₂ cria efeito estufa extremo. Superfície mais quente que Mercúrio: ~465°C.'
    },
    {
        name: 'Terra', nameEN: 'Earth', radius: 0.55, distance: 14, speed: 0.005, orbitOffset: Math.random() * Math.PI * 2,
        texture: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg',
        bumpMap: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png',
        cloudMap: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-clouds.png',
        color: 0x4488ff, planetType: 'earth',
        atmosphereColor: 0x4488ff, atmosphereScale: 1.06, atmosphereOpacity: 0.1,
        desc: 'Único planeta conhecido a abrigar vida. 71% de superfície coberta por oceanos. Atmosfera protetora de N₂ e O₂.',
        hasLandmarks: true
    },
    {
        name: 'Marte', nameEN: 'Mars', radius: 0.35, distance: 19, speed: 0.004, orbitOffset: Math.random() * Math.PI * 2,
        color: 0xcc4422, planetType: 'mars',
        atmosphereColor: 0xcc6644, atmosphereScale: 1.04, atmosphereOpacity: 0.05,
        hasBumpMap: true,
        desc: 'Planeta vermelho. Possui o maior vulcão do sistema solar (Olympus Mons, 21km). Rover Perseverance ativo desde 2021.'
    },
    {
        name: 'Júpiter', nameEN: 'Jupiter', radius: 1.6, distance: 28, speed: 0.002, orbitOffset: Math.random() * Math.PI * 2,
        color: 0xc8a050, bands: true, planetType: 'jupiter',
        hasClouds: true, cloudType: 'jupiter',
        atmosphereColor: 0xddaa55, atmosphereScale: 1.05, atmosphereOpacity: 0.06,
        desc: 'Maior planeta do Sistema Solar — 1,300 Terras caberiam dentro. Grande Mancha Vermelha é uma tempestade ativa há séculos.'
    },
    {
        name: 'Saturno', nameEN: 'Saturn', radius: 1.3, distance: 38, speed: 0.0015, orbitOffset: Math.random() * Math.PI * 2,
        color: 0xd4b86a, bands: true, planetType: 'saturn',
        hasRing: true,
        hasClouds: true, cloudType: 'saturn',
        atmosphereColor: 0xddcc88, atmosphereScale: 1.05, atmosphereOpacity: 0.05,
        desc: 'Famoso por seus anéis de gelo e rocha. Menos denso que a água. 146 luas confirmadas, incluindo Titã com atmosfera.'
    },
    {
        name: 'Urano', nameEN: 'Uranus', radius: 0.85, distance: 48, speed: 0.001, orbitOffset: Math.random() * Math.PI * 2,
        color: 0x66cccc, planetType: 'uranus',
        atmosphereColor: 0x88dddd, atmosphereScale: 1.06, atmosphereOpacity: 0.08,
        tilt: Math.PI * 98 / 180,
        desc: 'Gigante de gelo com eixo rotacional inclinado a 98°. Orbita o Sol "de lado". Visitado apenas pela Voyager 2 em 1986.'
    },
    {
        name: 'Netuno', nameEN: 'Neptune', radius: 0.8, distance: 56, speed: 0.0008, orbitOffset: Math.random() * Math.PI * 2,
        color: 0x3366ff, planetType: 'neptune',
        atmosphereColor: 0x4477ff, atmosphereScale: 1.06, atmosphereOpacity: 0.09,
        desc: 'Planeta mais distante do Sol. Ventos mais rápidos do sistema solar (2,100 km/h). 14 luas conhecidas, incluindo Tritão.'
    }
];

// --- PLANET DETAILS DATA (for detail modal) ---
const PLANET_DETAILS_DATA = {
    'Sun': {
        subtitle: 'A estrela que sustenta toda a vida no Sistema Solar',
        description: 'O Sol é uma estrela de tipo espectral G2V, uma anã amarela, localizada no braço de Órion da Via Láctea. Ele é responsável por 99,86% de toda a massa do Sistema Solar. Através de reações de fusão nuclear, converte cerca de 600 milhões de toneladas de hidrogênio em hélio a cada segundo, liberando uma quantidade enorme de energia. A luz do Sol leva aproximadamente 8 minutos e 20 segundos para chegar à Terra. Sua atividade magnética gera fenômenos como manchas solares, proeminências e ejeções de massa coronal que podem afetar sistemas de comunicação na Terra.',
        stats: [
            { label: 'Tipo', value: 'G2V', unit: 'Anã Amarela' },
            { label: 'Diâmetro', value: '1.392.700', unit: 'km' },
            { label: 'Massa', value: '1,989 × 10³⁰', unit: 'kg' },
            { label: 'Temp. Superfície', value: '5.500', unit: '°C' },
            { label: 'Temp. Núcleo', value: '15.000.000', unit: '°C' },
            { label: 'Idade', value: '4,6', unit: 'bilhões de anos' },
            { label: 'Composição', value: '73% H, 25% He', unit: '' },
            { label: 'Luminosidade', value: '3,828 × 10²⁶', unit: 'watts' }
        ],
        curiosities: [
            { icon: '🌡️', text: 'A temperatura no núcleo do Sol é de 15 milhões de °C — quente o suficiente para fundir hidrogênio em hélio.' },
            { icon: '⚡', text: 'A cada segundo, o Sol converte 4 milhões de toneladas de matéria em energia pura (E=mc²).' },
            { icon: '🔄', text: 'O Sol completa uma rotação a cada 25 dias no equador e 35 dias nos polos — rotação diferencial!' },
            { icon: '💨', text: 'O vento solar viaja a 400-750 km/s e cria a heliosfera, uma bolha que envolve todo o sistema solar.' },
            { icon: '📏', text: 'Cerca de 1,3 milhão de Terras caberiam dentro do Sol.' }
        ],
        missions: [
            { year: '1990', name: 'Ulysses', desc: 'Missão conjunta ESA/NASA para estudar os polos do Sol.' },
            { year: '1995', name: 'SOHO', desc: 'Observatório Solar e Heliosférico — monitoramento contínuo do Sol.' },
            { year: '2006', name: 'STEREO', desc: 'Duas sondas para observar o Sol em estéreo 3D.' },
            { year: '2018', name: 'Parker Solar Probe', desc: 'A nave mais rápida já construída, voando pela atmosfera do Sol.' },
            { year: '2020', name: 'Solar Orbiter', desc: 'Missão da ESA para observar os polos do Sol de perto.' }
        ]
    },
    'Mercury': {
        subtitle: 'O mensageiro dos deuses — o planeta mais rápido',
        description: 'Mercúrio é o menor planeta do Sistema Solar e o mais próximo do Sol. Sua superfície é marcada por crateras, semelhante à Lua, resultado de bilhões de anos de impactos. Apesar de ser o planeta mais próximo do Sol, não é o mais quente — esse título pertence a Vênus. Mercúrio praticamente não possui atmosfera, o que resulta em variações extremas de temperatura: de -180°C no lado noturno a 430°C no lado diurno. Um ano em Mercúrio dura apenas 88 dias terrestres.',
        stats: [
            { label: 'Diâmetro', value: '4.879', unit: 'km' },
            { label: 'Massa', value: '3,301 × 10²³', unit: 'kg' },
            { label: 'Gravidade', value: '3,7', unit: 'm/s²' },
            { label: 'Temp. Máx', value: '430', unit: '°C' },
            { label: 'Temp. Mín', value: '-180', unit: '°C' },
            { label: 'Órbita', value: '88', unit: 'dias' },
            { label: 'Distância do Sol', value: '57,9', unit: 'milhões km' },
            { label: 'Luas', value: '0', unit: '' }
        ],
        curiosities: [
            { icon: '🏃', text: 'Mercúrio orbita o Sol a 170.500 km/h — o planeta mais rápido do sistema solar.' },
            { icon: '🌡️', text: 'A variação de temperatura entre dia e noite é de mais de 600°C.' },
            { icon: '🔍', text: 'Mercúrio é tão denso que seu núcleo de ferro ocupa 85% do raio do planeta.' },
            { icon: '🎵', text: 'Crateras em Mercúrio são nomeadas com artistas: Beethoven, Shakespeare, Tolkien.' },
            { icon: '📐', text: 'Um dia solar em Mercúrio (nascer ao nascer do sol) dura 176 dias terrestres.' }
        ],
        missions: [
            { year: '1974', name: 'Mariner 10', desc: 'Primeira nave a visitar Mercúrio — mapeou 45% da superfície.' },
            { year: '2004', name: 'MESSENGER', desc: 'Orbitou Mercúrio por 4 anos, mapeando toda a superfície.' },
            { year: '2018', name: 'BepiColombo', desc: 'Missão conjunta ESA/JAXA a caminho de Mercúrio.' }
        ]
    },
    'Venus': {
        subtitle: 'O gêmeo maligno da Terra — um inferno de efeito estufa',
        description: 'Vênus é frequentemente chamado de planeta irmão da Terra por seu tamanho similar, mas as semelhanças param por aí. Sua atmosfera densa de dióxido de carbono cria o efeito estufa mais extremo do sistema solar, com temperatura superficial de 465°C — quente o suficiente para derreter chumbo. Chuvas de ácido sulfúrico nunca chegam ao solo, evaporando antes. Vênus gira ao contrário dos outros planetas (rotação retrógrada), e um dia em Vênus dura mais que um ano venusiano.',
        stats: [
            { label: 'Diâmetro', value: '12.104', unit: 'km' },
            { label: 'Massa', value: '4,867 × 10²⁴', unit: 'kg' },
            { label: 'Gravidade', value: '8,87', unit: 'm/s²' },
            { label: 'Temp. Superfície', value: '465', unit: '°C' },
            { label: 'Pressão Atm.', value: '92', unit: 'atm' },
            { label: 'Órbita', value: '225', unit: 'dias' },
            { label: 'Distância do Sol', value: '108,2', unit: 'milhões km' },
            { label: 'Luas', value: '0', unit: '' }
        ],
        curiosities: [
            { icon: '🔄', text: 'Vênus gira ao contrário — o Sol nasce no oeste e se põe no leste.' },
            { icon: '⏰', text: 'Um dia em Vênus (243 dias terrestres) é mais longo que seu ano (225 dias).' },
            { icon: '🌧️', text: 'Chove ácido sulfúrico em Vênus, mas as gotas evaporam antes de tocar o solo.' },
            { icon: '💪', text: 'A pressão na superfície é equivalente a estar a 900m de profundidade no oceano.' },
            { icon: '⭐', text: 'Vênus é o objeto mais brilhante no céu depois do Sol e da Lua.' }
        ],
        missions: [
            { year: '1970', name: 'Venera 7', desc: 'Primeira nave a pousar em outro planeta e transmitir dados.' },
            { year: '1982', name: 'Venera 13', desc: 'Primeiras fotos coloridas da superfície de Vênus.' },
            { year: '1990', name: 'Magellan', desc: 'Mapeou 98% da superfície com radar.' },
            { year: '2006', name: 'Venus Express', desc: 'Missão da ESA que estudou a atmosfera por 8 anos.' },
            { year: '2031', name: 'VERITAS & DAVINCI', desc: 'Missões futuras da NASA para estudar Vênus em detalhe.' }
        ]
    },
    'Earth': {
        subtitle: 'O pálido ponto azul — nosso lar no cosmos',
        description: 'A Terra é o terceiro planeta do Sistema Solar e o único conhecido por abrigar vida. Com 71% de sua superfície coberta por oceanos, é um mundo dominado por água líquida. Sua atmosfera de nitrogênio e oxigênio, combinada com o campo magnético gerado pelo núcleo de ferro líquido, protege a vida da radiação solar e cósmica. A Terra possui uma lua natural que estabiliza sua inclinação axial, criando as estações do ano. Nosso planeta é geologicamente ativo, com placas tectônicas que constantemente redesenham continentes.',
        stats: [
            { label: 'Diâmetro', value: '12.742', unit: 'km' },
            { label: 'Massa', value: '5,972 × 10²⁴', unit: 'kg' },
            { label: 'Gravidade', value: '9,81', unit: 'm/s²' },
            { label: 'Temp. Média', value: '15', unit: '°C' },
            { label: 'Atmosfera', value: '78% N₂, 21% O₂', unit: '' },
            { label: 'Órbita', value: '365,25', unit: 'dias' },
            { label: 'Distância do Sol', value: '149,6', unit: 'milhões km' },
            { label: 'Luas', value: '1', unit: '(Lua)' }
        ],
        curiosities: [
            { icon: '🌊', text: '97% da água da Terra é salgada. Apenas 3% é doce, e 2/3 disso está em geleiras.' },
            { icon: '🌋', text: 'Existem cerca de 1.500 vulcões ativos. A placa do Pacífico tem o "Anel de Fogo".' },
            { icon: '⚡', text: 'Cerca de 8 milhões de raios atingem a Terra todos os dias.' },
            { icon: '🧲', text: 'O campo magnético da Terra inverte seus polos a cada 200-300 mil anos.' },
            { icon: '🏔️', text: 'O ponto mais alto é o Everest (8.849m), mas da base ao topo, o Mauna Kea tem 10.210m.' }
        ],
        missions: [
            { year: '1957', name: 'Sputnik 1', desc: 'Primeiro satélite artificial em órbita da Terra.' },
            { year: '1961', name: 'Vostok 1 (Gagarin)', desc: 'Primeiro ser humano no espaço.' },
            { year: '1969', name: 'Apollo 11', desc: 'Primeiro pouso humano na Lua — "Um pequeno passo..."' },
            { year: '1998', name: 'ISS', desc: 'Início da construção da Estação Espacial Internacional.' },
            { year: '2020', name: 'Crew Dragon', desc: 'SpaceX leva astronautas da NASA à ISS — nova era comercial.' }
        ]
    },
    'Mars': {
        subtitle: 'O planeta vermelho — próximo destino da humanidade',
        description: 'Marte é o quarto planeta do Sistema Solar, conhecido como o Planeta Vermelho devido ao óxido de ferro (ferrugem) em sua superfície. Possui o maior vulcão do sistema solar, Olympus Mons (21,9 km de altura), e o maior cânion, Valles Marineris (4.000 km de comprimento). Evidências sugerem que Marte já teve oceanos de água líquida bilhões de anos atrás. Atualmente, vários rovers, incluindo Perseverance e Curiosity, exploram sua superfície em busca de sinais de vida passada.',
        stats: [
            { label: 'Diâmetro', value: '6.779', unit: 'km' },
            { label: 'Massa', value: '6,417 × 10²³', unit: 'kg' },
            { label: 'Gravidade', value: '3,72', unit: 'm/s²' },
            { label: 'Temp. Média', value: '-63', unit: '°C' },
            { label: 'Atmosfera', value: '95% CO₂', unit: '' },
            { label: 'Órbita', value: '687', unit: 'dias' },
            { label: 'Distância do Sol', value: '227,9', unit: 'milhões km' },
            { label: 'Luas', value: '2', unit: '(Fobos, Deimos)' }
        ],
        curiosities: [
            { icon: '🌋', text: 'Olympus Mons tem 21,9 km de altura — quase 3x o Everest. Base do tamanho da França.' },
            { icon: '🏜️', text: 'Valles Marineris tem 4.000 km — tão longo quanto os EUA de costa a costa.' },
            { icon: '🤖', text: 'O rover Perseverance tem um helicóptero chamado Ingenuity — primeiro voo em outro planeta.' },
            { icon: '💎', text: 'Existem tempestades de poeira em Marte que cobrem o planeta inteiro por meses.' },
            { icon: '🔴', text: 'Marte é vermelho porque seu solo é rico em óxido de ferro — basicamente ferrugem.' }
        ],
        missions: [
            { year: '1965', name: 'Mariner 4', desc: 'Primeira nave a fotografar Marte de perto.' },
            { year: '1976', name: 'Viking 1 & 2', desc: 'Primeiros pousos bem-sucedidos em Marte.' },
            { year: '2004', name: 'Spirit & Opportunity', desc: 'Rovers gêmeos — Opportunity operou por 15 anos!' },
            { year: '2012', name: 'Curiosity', desc: 'Rover de 1 tonelada no Crater Gale — ainda ativo.' },
            { year: '2021', name: 'Perseverance + Ingenuity', desc: 'Rover com drone. Coletando amostras para retorno à Terra.' }
        ]
    },
    'Jupiter': {
        subtitle: 'O gigante gasoso — protetor do Sistema Solar',
        description: 'Júpiter é o maior planeta do Sistema Solar, com massa 2,5 vezes maior que todos os outros planetas combinados. Sua famosa Grande Mancha Vermelha é uma tempestade anticiclônica ativa há pelo menos 400 anos, maior que a Terra inteira. Júpiter possui pelo menos 95 luas conhecidas, incluindo as 4 luas galileanas: Io (a mais vulcânica), Europa (oceano subterrâneo), Ganimedes (maior lua do sistema solar) e Calisto. Sua forte gravidade ajuda a desviar asteroides, protegendo os planetas internos.',
        stats: [
            { label: 'Diâmetro', value: '139.820', unit: 'km' },
            { label: 'Massa', value: '1,898 × 10²⁷', unit: 'kg' },
            { label: 'Gravidade', value: '24,79', unit: 'm/s²' },
            { label: 'Temp. Nuvens', value: '-108', unit: '°C' },
            { label: 'Composição', value: '90% H₂, 10% He', unit: '' },
            { label: 'Órbita', value: '12', unit: 'anos' },
            { label: 'Distância do Sol', value: '778,5', unit: 'milhões km' },
            { label: 'Luas', value: '95+', unit: '' }
        ],
        curiosities: [
            { icon: '🌀', text: 'A Grande Mancha Vermelha é uma tempestade maior que a Terra, ativa há 400+ anos.' },
            { icon: '🛡️', text: 'Júpiter é o "aspirador cósmico" — sua gravidade desvia asteroides que ameaçariam a Terra.' },
            { icon: '🌊', text: 'A lua Europa pode ter um oceano de água líquida sob sua crosta de gelo — candidata a vida.' },
            { icon: '⚡', text: 'Os raios de Júpiter são 1.000x mais poderosos que os da Terra.' },
            { icon: '🔄', text: 'Júpiter gira tão rápido (10h) que é visivelmente achatado nos polos.' }
        ],
        missions: [
            { year: '1973', name: 'Pioneer 10', desc: 'Primeira nave a atravessar o cinturão de asteroides e sobrevoar Júpiter.' },
            { year: '1979', name: 'Voyager 1 & 2', desc: 'Descobriram os anéis de Júpiter e vulcões em Io.' },
            { year: '1995', name: 'Galileo', desc: 'Primeira sonda a orbitar Júpiter — 8 anos de dados.' },
            { year: '2016', name: 'Juno', desc: 'Em órbita polar, estudando o interior e magnetosfera.' },
            { year: '2024', name: 'Europa Clipper', desc: 'Missão para investigar a habitabilidade de Europa.' }
        ]
    },
    'Saturn': {
        subtitle: 'O senhor dos anéis — a joia do Sistema Solar',
        description: 'Saturno é o sexto planeta do Sistema Solar e famoso por seu espetacular sistema de anéis, composto principalmente de partículas de gelo e rocha. Apesar de ser o segundo maior planeta, é tão pouco denso que flutuaria na água (se houvesse uma banheira grande o suficiente). Sua lua Titã é a única lua do sistema solar com atmosfera densa e lagos de metano líquido na superfície. Encélado, outra lua, possui jatos de água que indicam um oceano subterrâneo — outro candidato a vida.',
        stats: [
            { label: 'Diâmetro', value: '116.460', unit: 'km' },
            { label: 'Massa', value: '5,683 × 10²⁶', unit: 'kg' },
            { label: 'Gravidade', value: '10,44', unit: 'm/s²' },
            { label: 'Temp. Nuvens', value: '-139', unit: '°C' },
            { label: 'Composição', value: '96% H₂, 3% He', unit: '' },
            { label: 'Órbita', value: '29,4', unit: 'anos' },
            { label: 'Distância do Sol', value: '1.434', unit: 'milhões km' },
            { label: 'Luas', value: '146+', unit: '' }
        ],
        curiosities: [
            { icon: '💍', text: 'Os anéis de Saturno se estendem por 282.000 km, mas têm apenas ~10m de espessura.' },
            { icon: '🏊', text: 'Saturno flutuaria na água — sua densidade (0,687 g/cm³) é menor que a da água.' },
            { icon: '🌊', text: 'Encélado ejeta jatos de água que contêm compostos orgânicos — possível vida!' },
            { icon: '🌫️', text: 'Titã tem lagos de metano e etano — são os únicos lagos estáveis fora da Terra.' },
            { icon: '💨', text: 'Ventos em Saturno podem chegar a 1.800 km/h — 5x furacões terrestres.' }
        ],
        missions: [
            { year: '1979', name: 'Pioneer 11', desc: 'Primeira nave a sobrevoar Saturno — descobriu o anel F.' },
            { year: '1981', name: 'Voyager 2', desc: 'Revelou detalhes dos anéis e luas de Saturno.' },
            { year: '2004', name: 'Cassini-Huygens', desc: '13 anos orbitando Saturno — Huygens pousou em Titã.' },
            { year: '2017', name: 'Grand Finale', desc: 'Cassini mergulhou nos anéis de Saturno em sacrifício final.' },
            { year: '2027', name: 'Dragonfly', desc: 'Drone que voará sobre a superfície de Titã — lançamento previsto.' }
        ]
    },
    'Uranus': {
        subtitle: 'O gigante de gelo deitado — o planeta que rola',
        description: 'Urano é o sétimo planeta do Sistema Solar e um dos dois "gigantes de gelo". Sua característica mais notável é sua inclinação axial extrema de 98°, fazendo com que ele essencialmente "role" ao redor do Sol de lado. Isso significa que seus polos recebem mais luz solar do que o equador. Urano tem 27 luas conhecidas, todas nomeadas com personagens de Shakespeare e Alexander Pope. Foi visitado apenas uma vez, pela Voyager 2 em 1986. Sua cor azul-esverdeada vem do metano em sua atmosfera.',
        stats: [
            { label: 'Diâmetro', value: '50.724', unit: 'km' },
            { label: 'Massa', value: '8,681 × 10²⁵', unit: 'kg' },
            { label: 'Gravidade', value: '8,87', unit: 'm/s²' },
            { label: 'Temp. Mín', value: '-224', unit: '°C' },
            { label: 'Composição', value: 'H₂, He, CH₄', unit: '' },
            { label: 'Órbita', value: '84', unit: 'anos' },
            { label: 'Distância do Sol', value: '2.871', unit: 'milhões km' },
            { label: 'Luas', value: '27', unit: '' }
        ],
        curiosities: [
            { icon: '🔄', text: 'Urano é o único planeta que gira "deitado" — inclinação axial de 98°.' },
            { icon: '🥶', text: 'É o planeta mais frio do sistema solar (-224°C), mais frio que Netuno.' },
            { icon: '📚', text: 'Todas as luas de Urano são nomeadas com personagens de Shakespeare e Pope.' },
            { icon: '💎', text: 'Pode chover diamantes dentro de Urano, devido à pressão extrema sobre o metano.' },
            { icon: '🔭', text: 'Urano foi o primeiro planeta descoberto com telescópio (William Herschel, 1781).' }
        ],
        missions: [
            { year: '1986', name: 'Voyager 2', desc: 'Única nave a visitar Urano — descobriu 10 luas e 2 anéis.' },
            { year: '2030s', name: 'Uranus Orbiter (proposta)', desc: 'Missão prioritária recomendada pela NASA para a década de 2030.' }
        ]
    },
    'Neptune': {
        subtitle: 'O planeta do vento furioso — fronteira do sistema solar',
        description: 'Netuno é o planeta mais distante do Sol e o mais ventoso do Sistema Solar, com ventos que ultrapassam 2.100 km/h. Sua cor azul intensa vem do metano em sua atmosfera, que absorve luz vermelha. Netuno foi o primeiro planeta descoberto por cálculos matemáticos antes de ser observado. Sua lua principal, Tritão, é um dos objetos mais frios do sistema solar (-235°C) e orbita na direção oposta ao giro de Netuno, sugerindo que foi capturada do Cinturão de Kuiper.',
        stats: [
            { label: 'Diâmetro', value: '49.244', unit: 'km' },
            { label: 'Massa', value: '1,024 × 10²⁶', unit: 'kg' },
            { label: 'Gravidade', value: '11,15', unit: 'm/s²' },
            { label: 'Temp. Nuvens', value: '-214', unit: '°C' },
            { label: 'Composição', value: 'H₂, He, CH₄', unit: '' },
            { label: 'Órbita', value: '165', unit: 'anos' },
            { label: 'Distância do Sol', value: '4.495', unit: 'milhões km' },
            { label: 'Luas', value: '16', unit: '' }
        ],
        curiosities: [
            { icon: '💨', text: 'Netuno tem os ventos mais rápidos do sistema solar — até 2.100 km/h.' },
            { icon: '🧮', text: 'Foi o primeiro planeta previsto matematicamente antes de ser visto (Adams & Le Verrier, 1846).' },
            { icon: '🌀', text: 'A Grande Mancha Escura de Netuno apareceu e desapareceu — tempestades transitórias.' },
            { icon: '❄️', text: 'Tritão é tão frio que sua superfície é de nitrogênio congelado, com gêiseres ativos.' },
            { icon: '💎', text: 'Assim como Urano, dentro de Netuno provavelmente chove diamantes.' }
        ],
        missions: [
            { year: '1989', name: 'Voyager 2', desc: 'Única nave a visitar Netuno — fotografou a Grande Mancha Escura e Tritão.' },
            { year: '2030s', name: 'Neptune Odyssey (proposta)', desc: 'Proposta de orbitador e sonda atmosférica para Netuno e Tritão.' }
        ]
    }
};

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

// --- COMETS ---
const comets = [];
const COMET_COUNT = 5;

function createComet() {
    const group = new THREE.Group();

    // Comet head (bright nucleus)
    const headGeo = new THREE.SphereGeometry(0.3, 12, 12);
    const headMat = new THREE.MeshBasicMaterial({
        color: 0xccddff,
        transparent: true,
        opacity: 0.95
    });
    const head = new THREE.Mesh(headGeo, headMat);
    group.add(head);

    // Inner glow (coma)
    const comaGeo = new THREE.SphereGeometry(0.6, 12, 12);
    const comaMat = new THREE.MeshBasicMaterial({
        color: 0x88bbff,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide
    });
    const coma = new THREE.Mesh(comaGeo, comaMat);
    group.add(coma);

    // Dust tail (particle trail)
    const tailParticleCount = 200;
    const tailPositions = new Float32Array(tailParticleCount * 3);
    const tailColors = new Float32Array(tailParticleCount * 3);
    const tailSizes = new Float32Array(tailParticleCount);

    for (let i = 0; i < tailParticleCount; i++) {
        const t = i / tailParticleCount;
        tailPositions[i * 3] = t * 25 + Math.random() * 1.5 * t;
        tailPositions[i * 3 + 1] = (Math.random() - 0.5) * 1.5 * t;
        tailPositions[i * 3 + 2] = (Math.random() - 0.5) * 1.5 * t;
        tailSizes[i] = (1 - t) * 1.5 + 0.2;
        // Bluish-white to dim
        tailColors[i * 3] = 0.7 + (1 - t) * 0.3;
        tailColors[i * 3 + 1] = 0.8 + (1 - t) * 0.2;
        tailColors[i * 3 + 2] = 1.0;
    }

    const tailGeo = new THREE.BufferGeometry();
    tailGeo.setAttribute('position', new THREE.Float32BufferAttribute(tailPositions, 3));
    tailGeo.setAttribute('color', new THREE.Float32BufferAttribute(tailColors, 3));
    tailGeo.setAttribute('size', new THREE.Float32BufferAttribute(tailSizes, 1));

    const tailMat = new THREE.PointsMaterial({
        size: 0.6,
        transparent: true,
        opacity: 0.4,
        vertexColors: true,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const tail = new THREE.Points(tailGeo, tailMat);
    group.add(tail);

    // Ion tail (thinner, bluer line)
    const ionCount = 60;
    const ionPositions = new Float32Array(ionCount * 3);
    for (let i = 0; i < ionCount; i++) {
        const t = i / ionCount;
        ionPositions[i * 3] = t * 30;
        ionPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.3 * t;
        ionPositions[i * 3 + 2] = t * 5 + (Math.random() - 0.5) * 0.3 * t;
    }
    const ionGeo = new THREE.BufferGeometry();
    ionGeo.setAttribute('position', new THREE.Float32BufferAttribute(ionPositions, 3));
    const ionMat = new THREE.PointsMaterial({
        color: 0x4488ff,
        size: 0.3,
        transparent: true,
        opacity: 0.25,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const ionTail = new THREE.Points(ionGeo, ionMat);
    group.add(ionTail);

    // Orbit parameters — random elliptical path
    const rng = Math.random;
    const orbitData = {
        semiMajor: 70 + rng() * 80,
        semiMinor: 30 + rng() * 50,
        inclination: (rng() - 0.5) * Math.PI * 0.5,
        rotationY: rng() * Math.PI * 2,
        speed: 0.0003 + rng() * 0.0006,
        phase: rng() * Math.PI * 2
    };

    solarSystemGroup.add(group);
    comets.push({ group, head, coma, tail, tailMat, orbitData });
}

function createAllComets() {
    for (let i = 0; i < COMET_COUNT; i++) {
        createComet();
    }
}

function animateComets(time) {
    comets.forEach(comet => {
        const od = comet.orbitData;
        const angle = time * od.speed + od.phase;

        // Elliptical orbit position
        const x = Math.cos(angle) * od.semiMajor;
        const z = Math.sin(angle) * od.semiMinor;
        const y = Math.sin(angle) * Math.sin(od.inclination) * od.semiMinor * 0.3;

        // Rotate orbit
        const cosR = Math.cos(od.rotationY);
        const sinR = Math.sin(od.rotationY);
        comet.group.position.set(
            x * cosR - z * sinR,
            y,
            x * sinR + z * cosR
        );

        // Point tail away from sun (anti-solar direction)
        const dir = comet.group.position.clone().normalize();
        comet.group.lookAt(
            comet.group.position.x + dir.x,
            comet.group.position.y + dir.y,
            comet.group.position.z + dir.z
        );

        // Brightness based on distance from sun
        const dist = comet.group.position.length();
        const brightness = Math.min(1, 50 / dist);
        comet.tailMat.opacity = brightness * 0.4;
        comet.coma.material.opacity = brightness * 0.3;
        comet.head.material.opacity = 0.6 + brightness * 0.4;

        // Pulse coma
        const pulse = 1 + Math.sin(time * 3 + od.phase) * 0.15;
        comet.coma.scale.set(pulse, pulse, pulse);
    });
}

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
            // Sol — enhanced with multiple glow layers
            const sunCanvas = document.createElement('canvas');
            sunCanvas.width = 1024; sunCanvas.height = 512;
            const sCtx = sunCanvas.getContext('2d');
            const sImgData = sCtx.createImageData(1024, 512);
            const sData = sImgData.data;
            for (let sy = 0; sy < 512; sy++) {
                for (let sx = 0; sx < 1024; sx++) {
                    const si = (sy * 1024 + sx) * 4;
                    const snx = sx / 1024, sny = sy / 512;
                    const turb = fbmNoise(snx * 20 + performance.now() * 0.00001, sny * 15, 5);
                    const granule = fbmNoise(snx * 60, sny * 40, 3) * 0.3;
                    const val = turb + granule;
                    sData[si] = Math.min(255, 200 + val * 55);
                    sData[si + 1] = Math.min(255, 140 + val * 80);
                    sData[si + 2] = Math.min(255, 20 + val * 50);
                    sData[si + 3] = 255;
                }
            }
            sCtx.putImageData(sImgData, 0, 0);
            const sunTex = new THREE.CanvasTexture(sunCanvas);

            material = new THREE.MeshBasicMaterial({
                map: sunTex,
                transparent: true,
                opacity: 0.98
            });
            mesh.material = material;

            // Multi-layer glow
            const glowLayers = [
                { scale: 1.15, color: 0xffcc44, opacity: 0.12 },
                { scale: 1.35, color: 0xff8800, opacity: 0.06 },
                { scale: 1.6, color: 0xff4400, opacity: 0.03 }
            ];
            const glows = [];
            glowLayers.forEach(gl => {
                const glowMesh = new THREE.Mesh(
                    new THREE.SphereGeometry(1, 32, 32),
                    new THREE.MeshBasicMaterial({
                        color: gl.color,
                        transparent: true,
                        opacity: gl.opacity,
                        side: THREE.BackSide
                    })
                );
                glowMesh.scale.set(pData.radius * gl.scale, pData.radius * gl.scale, pData.radius * gl.scale);
                solarSystemGroup.add(glowMesh);
                glows.push(glowMesh);
            });
            mesh.userData.glows = glows;
            mesh.userData.glow = glows[0];

        } else {
            // --- PLANET MATERIAL ---
            if (pData.texture) {
                // Textured planet (Earth)
                try {
                    const tex = texLoader.load(pData.texture,
                        undefined,
                        undefined,
                        () => {
                            const procCanvas = generatePlanetTexture(pData.color, 0.8, pData.bands || false, pData.planetType);
                            const procTex = new THREE.CanvasTexture(procCanvas);
                            mesh.material = new THREE.MeshPhongMaterial({ map: procTex, shininess: 10 });
                        }
                    );
                    material = new THREE.MeshPhongMaterial({
                        map: tex,
                        shininess: 15,
                        specular: new THREE.Color(0x111111)
                    });
                    if (pData.bumpMap) {
                        material.bumpMap = texLoader.load(pData.bumpMap);
                        material.bumpScale = 0.04;
                    }
                } catch (e) {
                    const procCanvas = generatePlanetTexture(pData.color, 0.8, pData.bands || false, pData.planetType);
                    const procTex = new THREE.CanvasTexture(procCanvas);
                    material = new THREE.MeshPhongMaterial({ map: procTex, shininess: 10 });
                }
            } else {
                // Procedural textured planet (all others)
                const procCanvas = generatePlanetTexture(pData.color, 0.8, pData.bands || false, pData.planetType);
                const procTex = new THREE.CanvasTexture(procCanvas);
                material = new THREE.MeshPhongMaterial({
                    map: procTex,
                    shininess: 15,
                    specular: new THREE.Color(0x222222)
                });

                // Procedural bump map for rocky planets
                if (pData.hasBumpMap) {
                    const bumpCanvas = generateBumpMap(pData.color, pData.planetType);
                    material.bumpMap = new THREE.CanvasTexture(bumpCanvas);
                    material.bumpScale = 0.03;
                }
            }
            mesh.material = material;

            // --- ATMOSPHERE GLOW ---
            if (pData.atmosphereColor) {
                const atmoScale = pData.atmosphereScale || 1.06;
                const atmoGeo = new THREE.SphereGeometry(1, 32, 32);
                const atmoMat = new THREE.MeshBasicMaterial({
                    color: pData.atmosphereColor,
                    transparent: true,
                    opacity: pData.atmosphereOpacity || 0.08,
                    side: THREE.BackSide
                });
                const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
                atmosphere.scale.set(
                    pData.radius * atmoScale,
                    pData.radius * atmoScale,
                    pData.radius * atmoScale
                );
                mesh.add(atmosphere);
                mesh.userData.atmosphere = atmosphere;
            }

            // --- CLOUDS ---
            if (pData.cloudMap) {
                // Earth — load cloud texture from CDN
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
            } else if (pData.hasClouds) {
                // Procedural cloud layer
                const cloudCanvas = generateCloudTexture(pData.cloudType || 'default');
                const cloudTex = new THREE.CanvasTexture(cloudCanvas);
                const cloudMesh = new THREE.Mesh(
                    sharedSphereGeo.clone(),
                    new THREE.MeshPhongMaterial({
                        map: cloudTex,
                        transparent: true,
                        opacity: pData.cloudType === 'venus' ? 0.7 : 0.3,
                        blending: THREE.AdditiveBlending,
                        side: THREE.DoubleSide,
                        depthWrite: false
                    })
                );
                const cloudScale = pData.radius * (pData.cloudType === 'venus' ? 1.04 : 1.02);
                cloudMesh.scale.set(cloudScale, cloudScale, cloudScale);
                mesh.add(cloudMesh);
                mesh.userData.clouds = cloudMesh;
            }

            // --- SATURN RING (ENHANCED) ---
            if (pData.hasRing) {
                const ringCanvas = generateRingTexture();
                const ringTex = new THREE.CanvasTexture(ringCanvas);
                const ringGeo = new THREE.RingGeometry(pData.radius * 1.3, pData.radius * 2.3, 128);
                // UV mapping for ring texture
                const pos = ringGeo.attributes.position;
                const uv = ringGeo.attributes.uv;
                for (let i = 0; i < pos.count; i++) {
                    const px = pos.getX(i);
                    const py = pos.getY(i);
                    const dist = Math.sqrt(px * px + py * py);
                    const t = (dist - pData.radius * 1.3) / (pData.radius * 2.3 - pData.radius * 1.3);
                    uv.setXY(i, t, 0.5);
                }
                const ringMat = new THREE.MeshBasicMaterial({
                    map: ringTex,
                    transparent: true,
                    opacity: 0.65,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.rotation.x = Math.PI / 2.5;
                mesh.add(ring);

                // Ring shadow hint (dark ring underneath)
                const shadowRingGeo = new THREE.RingGeometry(pData.radius * 1.3, pData.radius * 2.3, 64);
                const shadowRingMat = new THREE.MeshBasicMaterial({
                    color: 0x000000,
                    transparent: true,
                    opacity: 0.15,
                    side: THREE.DoubleSide
                });
                const shadowRing = new THREE.Mesh(shadowRingGeo, shadowRingMat);
                shadowRing.rotation.x = Math.PI / 2.5;
                shadowRing.position.y = -0.05;
                mesh.add(shadowRing);
            }

            // --- AXIAL TILT ---
            if (pData.tilt) {
                mesh.rotation.z = pData.tilt;
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

    // Create comets
    createAllComets();
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
        // Sun surface view — procedural solar texture
        const sunCanvas = document.createElement('canvas');
        sunCanvas.width = 1024; sunCanvas.height = 512;
        const sCtx = sunCanvas.getContext('2d');
        const sImgData = sCtx.createImageData(1024, 512);
        const sData = sImgData.data;
        for (let sy = 0; sy < 512; sy++) {
            for (let sx = 0; sx < 1024; sx++) {
                const si = (sy * 1024 + sx) * 4;
                const snx = sx / 1024, sny = sy / 512;
                const turb = fbmNoise(snx * 20, sny * 15, 5);
                const granule = fbmNoise(snx * 60, sny * 40, 3) * 0.3;
                const val = turb + granule;
                sData[si] = Math.min(255, 200 + val * 55);
                sData[si + 1] = Math.min(255, 140 + val * 80);
                sData[si + 2] = Math.min(255, 20 + val * 50);
                sData[si + 3] = 255;
            }
        }
        sCtx.putImageData(sImgData, 0, 0);
        material = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sunCanvas) });
    } else if (pData.texture) {
        try {
            material = new THREE.MeshPhongMaterial({
                map: texLoader.load(pData.texture),
                shininess: 15,
                specular: new THREE.Color(0x111111)
            });
        } catch (e) {
            const procCanvas = generatePlanetTexture(pData.color, 0.8, pData.bands || false, pData.planetType);
            material = new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(procCanvas), shininess: 10 });
        }
    } else {
        // Procedural texture for non-Earth planets
        const procCanvas = generatePlanetTexture(pData.color, 0.8, pData.bands || false, pData.planetType);
        material = new THREE.MeshPhongMaterial({
            map: new THREE.CanvasTexture(procCanvas),
            shininess: 15,
            specular: new THREE.Color(0x222222)
        });
        // Add bump map for rocky planets
        if (pData.hasBumpMap) {
            const bumpCanvas = generateBumpMap(pData.color, pData.planetType);
            material.bumpMap = new THREE.CanvasTexture(bumpCanvas);
            material.bumpScale = 0.04;
        }
    }

    surfaceEarth = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS, GLOBE_SEGMENTS, GLOBE_SEGMENTS),
        material
    );
    surfaceGroup.add(surfaceEarth);

    // Clouds for Earth (CDN texture)
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
    } else if (pData.hasClouds) {
        // Procedural cloud layer for surface view
        const cloudCanvas = generateCloudTexture(pData.cloudType || 'default');
        const cloudTex = new THREE.CanvasTexture(cloudCanvas);
        const clouds = new THREE.Mesh(
            new THREE.SphereGeometry(GLOBE_RADIUS + 0.04, GLOBE_SEGMENTS, GLOBE_SEGMENTS),
            new THREE.MeshPhongMaterial({
                map: cloudTex,
                transparent: true,
                opacity: pData.cloudType === 'venus' ? 0.7 : 0.35,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        surfaceGroup.add(clouds);
        surfaceGroup.userData.clouds = clouds;
    }

    // Atmosphere glow for surface view
    if (pData.atmosphereColor && !pData.isStar) {
        const atmoScale = pData.atmosphereScale || 1.06;
        const atmoGeo = new THREE.SphereGeometry(GLOBE_RADIUS * atmoScale, 48, 48);
        const atmoMat = new THREE.MeshBasicMaterial({
            color: pData.atmosphereColor,
            transparent: true,
            opacity: (pData.atmosphereOpacity || 0.08) * 1.5,
            side: THREE.BackSide
        });
        const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
        surfaceGroup.add(atmosphere);
    }

    // Country borders (only for Earth)
    if (pData.name === 'Terra') {
        loadEarthBorders(surfaceGroup);
    }

    // Landmarks (only for Earth)
    if (pData.hasLandmarks) {
        createLandmarks(surfaceGroup);
    }

    // Saturn ring on surface view (enhanced with texture)
    if (pData.hasRing) {
        const ringCanvas = generateRingTexture();
        const ringTex = new THREE.CanvasTexture(ringCanvas);
        const ringGeo = new THREE.RingGeometry(GLOBE_RADIUS * 1.3, GLOBE_RADIUS * 2.3, 128);
        // UV mapping for ring texture
        const pos = ringGeo.attributes.position;
        const uv = ringGeo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
            const px = pos.getX(i);
            const py = pos.getY(i);
            const dist = Math.sqrt(px * px + py * py);
            const t = (dist - GLOBE_RADIUS * 1.3) / (GLOBE_RADIUS * 2.3 - GLOBE_RADIUS * 1.3);
            uv.setXY(i, t, 0.5);
        }
        const ringMat = new THREE.MeshBasicMaterial({
            map: ringTex,
            transparent: true,
            opacity: 0.65,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2.5;
        surfaceGroup.add(ring);
    }

    // Axial tilt for surface view
    if (pData.tilt) {
        surfaceGroup.rotation.z = pData.tilt;
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
let countryLabelSprites = [];

function createCountryLabelSprite(name, scale = 0.04, color = '#88ccff') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 96;
    ctx.font = 'bold 28px "Inter", "Segoe UI", sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 6;
    ctx.fillText(name.substring(0, 20), canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        sizeAttenuation: true
    }));
    sprite.scale.set(scale * 6, scale * 1.2, 1);
    return sprite;
}

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

        countryLabelSprites = [];

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

                // Create country name label on globe surface
                const labelPos = latLonToVector3(centerLat, centerLon, GLOBE_RADIUS + 0.08);
                const label = createCountryLabelSprite(originalName, 0.04, '#88ddff');
                label.position.copy(labelPos);
                label.visible = false; // Hidden by default, shown on zoom
                group.add(label);
                countryLabelSprites.push(label);
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

    // Reset NASA image container to prevent overlap
    const nasaContainer = document.getElementById('nasa-image-container');
    nasaContainer.style.display = 'none';
    document.getElementById('landmark-info').style.display = 'none';

    // Show/hide detail button
    const detailBtn = document.getElementById('detail-btn');
    const detailDivider = document.getElementById('detail-btn-divider');
    if (PLANET_DETAILS_DATA[pData.nameEN]) {
        detailBtn.style.display = 'block';
        detailDivider.style.display = 'block';
        detailBtn.onclick = () => openPlanetDetail(pData);
    } else {
        detailBtn.style.display = 'none';
        detailDivider.style.display = 'none';
    }

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
        container.style.display = 'none'; // Reset first
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

async function fetchNASAGallery(query, count = 8) {
    try {
        const res = await fetch(`${NASA_IMAGE_API}?q=${encodeURIComponent(query)}&media_type=image&page_size=${count}`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.collection?.items || []).map(item => ({
            url: item.links?.[0]?.href || '',
            title: item.data?.[0]?.title || '',
            description: item.data?.[0]?.description || ''
        })).filter(i => i.url);
    } catch (e) {
        console.error('NASA Gallery error:', e);
        return [];
    }
}

// --- PLANET DETAIL MODAL ---
function openPlanetDetail(pData) {
    const modal = document.getElementById('planet-detail-modal');
    const details = PLANET_DETAILS_DATA[pData.nameEN];
    if (!details) return;

    // Header
    document.getElementById('pdm-badge').textContent = pData.isStar ? 'ESTRELA' : 'PLANETA';
    document.getElementById('pdm-title').textContent = pData.name;
    document.getElementById('pdm-subtitle').textContent = details.subtitle;

    // Stats
    const statsGrid = document.getElementById('pdm-stats-grid');
    statsGrid.innerHTML = '';
    details.stats.forEach(stat => {
        const card = document.createElement('div');
        card.className = 'pdm-stat-card';
        card.innerHTML = `
            <div class="pdm-stat-label">${stat.label}</div>
            <div class="pdm-stat-value">${stat.value}<span class="pdm-stat-unit">${stat.unit}</span></div>
        `;
        statsGrid.appendChild(card);
    });

    // Description
    document.getElementById('pdm-description').textContent = details.description;

    // Curiosities
    const curiosList = document.getElementById('pdm-curiosities');
    curiosList.innerHTML = '';
    details.curiosities.forEach(c => {
        const li = document.createElement('li');
        li.className = 'pdm-curiosity-item';
        li.innerHTML = `<span class="pdm-curiosity-icon">${c.icon}</span><span>${c.text}</span>`;
        curiosList.appendChild(li);
    });

    // Timeline
    const timeline = document.getElementById('pdm-timeline');
    timeline.innerHTML = '';
    details.missions.forEach(m => {
        const item = document.createElement('div');
        item.className = 'pdm-timeline-item';
        item.innerHTML = `
            <div class="pdm-timeline-year">${m.year}</div>
            <div class="pdm-timeline-name">${m.name}</div>
            <div class="pdm-timeline-desc">${m.desc}</div>
        `;
        timeline.appendChild(item);
    });

    // Gallery — loading state
    const gallery = document.getElementById('pdm-gallery');
    gallery.innerHTML = '<div class="pdm-gallery-loading">Carregando imagens da NASA...</div>';

    // Show modal
    modal.classList.add('active');

    // Fetch NASA images
    const searchQuery = pData.isStar ? 'Sun solar' : `planet ${pData.nameEN}`;
    fetchNASAGallery(searchQuery, 8).then(images => {
        gallery.innerHTML = '';
        if (images.length === 0) {
            gallery.innerHTML = '<div class="pdm-gallery-loading" style="animation:none;opacity:0.5;">Nenhuma imagem encontrada</div>';
            return;
        }
        images.forEach(img => {
            const item = document.createElement('div');
            item.className = 'pdm-gallery-item';
            item.innerHTML = `
                <img src="${img.url}" alt="${img.title}" loading="lazy" />
                <div class="pdm-gallery-caption">${img.title}</div>
            `;
            item.onclick = () => window.open(img.url, '_blank');
            gallery.appendChild(item);
        });
    });
}

function closePlanetDetail() {
    document.getElementById('planet-detail-modal').classList.remove('active');
}

// Wire up close events
document.getElementById('pdm-close').addEventListener('click', closePlanetDetail);
document.querySelector('.pdm-backdrop').addEventListener('click', closePlanetDetail);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('planet-detail-modal').classList.contains('active')) {
        closePlanetDetail();
    }
});

async function fetchAPOD() {
    const loadingEl = document.getElementById('apod-loading');
    const widget = document.getElementById('apod-widget');

    // Show widget immediately with loading state
    widget.classList.add('visible');

    try {
        const res = await fetch(NASA_APOD_API);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Date
        const dateEl = document.getElementById('apod-date');
        if (data.date) {
            const [y, m, d] = data.date.split('-');
            const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
            dateEl.textContent = `${d} ${months[parseInt(m) - 1]} ${y}`;
        }

        if (data.media_type === 'image' && data.url) {
            const img = document.getElementById('apod-image');
            img.onload = () => {
                if (loadingEl) loadingEl.style.display = 'none';
                img.classList.add('loaded');
            };
            img.onerror = () => {
                if (loadingEl) loadingEl.innerHTML = '<span style="color:#ff9944;">Erro ao carregar imagem</span>';
            };
            img.src = data.hdurl || data.url;
            document.getElementById('apod-title').textContent = data.title || '';

            // Description (truncated)
            const desc = data.explanation || '';
            const descEl = document.getElementById('apod-description');
            descEl.textContent = desc.length > 200 ? desc.substring(0, 200) + '...' : desc;
            descEl.dataset.full = desc;
            descEl.dataset.truncated = descEl.textContent;

            // Copyright
            if (data.copyright) {
                document.getElementById('apod-copyright').textContent = `© ${data.copyright.trim()}`;
            }
        } else if (data.media_type === 'video') {
            // If it's a video day, show thumbnail with a play icon
            if (loadingEl) loadingEl.style.display = 'none';
            const wrapper = document.getElementById('apod-image-wrapper');
            wrapper.innerHTML = `<a href="${data.url}" target="_blank" class="apod-video-link">▶ Assistir Vídeo</a>`;
            document.getElementById('apod-title').textContent = data.title || '';
            const desc = data.explanation || '';
            const descEl = document.getElementById('apod-description');
            descEl.textContent = desc.length > 200 ? desc.substring(0, 200) + '...' : desc;
        }
    } catch (e) {
        console.error('APOD error:', e);
        if (loadingEl) {
            loadingEl.innerHTML = `
                <span style="color:#ff9944; font-family: var(--font-display); font-size: 8px; letter-spacing: 1px;">API INDISPONÍVEL</span>
                <span style="color:#666; font-size: 10px; margin-top: 4px;">Tente novamente mais tarde</span>
            `;
        }
        document.getElementById('apod-title').textContent = 'Astronomy Picture of the Day';
        document.getElementById('apod-description').textContent = 'A imagem astronômica do dia da NASA não pôde ser carregada. A API pode estar temporariamente fora do ar.';
    }
}

// --- APOD WIDGET INTERACTIVITY ---
(function initAPODWidget() {
    // Toggle expand/collapse
    const toggle = document.getElementById('apod-toggle');
    const widget = document.getElementById('apod-widget');
    if (toggle && widget) {
        toggle.addEventListener('click', () => {
            widget.classList.toggle('expanded');
            toggle.textContent = widget.classList.contains('expanded') ? '▼' : '▲';

            // If expanded, show full description
            const descEl = document.getElementById('apod-description');
            if (widget.classList.contains('expanded') && descEl.dataset.full) {
                descEl.textContent = descEl.dataset.full;
            } else if (descEl.dataset.truncated) {
                descEl.textContent = descEl.dataset.truncated;
            }
        });
    }

    // Parallax on image hover
    const imgWrapper = document.getElementById('apod-image-wrapper');
    if (imgWrapper) {
        imgWrapper.addEventListener('mousemove', (e) => {
            const rect = imgWrapper.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
            const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
            const img = document.getElementById('apod-image');
            if (img) {
                img.style.transform = `scale(1.08) translate(${x * -8}px, ${y * -8}px)`;
            }
        });
        imgWrapper.addEventListener('mouseleave', () => {
            const img = document.getElementById('apod-image');
            if (img) {
                img.style.transform = 'scale(1.03) translate(0, 0)';
            }
        });
    }
})();

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
            // Multi-layer glow pulsing
            if (mesh.userData.glows) {
                mesh.userData.glows.forEach((glow, i) => {
                    const layerSpeed = 1.5 + i * 0.7;
                    const layerAmp = 0.04 + i * 0.02;
                    const pulse = 1 + Math.sin(time * layerSpeed + i) * layerAmp;
                    const baseScale = [1.15, 1.35, 1.6][i] || 1.2;
                    glow.scale.set(pData.radius * baseScale * pulse, pData.radius * baseScale * pulse, pData.radius * baseScale * pulse);
                });
            }
        } else {
            // Orbit
            const angle = time * pData.speed + (pData.orbitOffset || 0);
            mesh.position.x = Math.cos(angle) * pData.distance;
            mesh.position.z = Math.sin(angle) * pData.distance;

            // Self rotation (preserve tilt)
            if (pData.tilt) {
                mesh.rotation.z = pData.tilt;
            }
            mesh.rotation.y += 0.005;

            // Cloud rotation
            if (mesh.userData.clouds) {
                mesh.userData.clouds.rotation.y += 0.002;
            }

            // Atmosphere shimmer
            if (mesh.userData.atmosphere) {
                const shimmer = 1 + Math.sin(time * 1.5 + pData.distance) * 0.015;
                const atmoScale = (pData.atmosphereScale || 1.06) * shimmer;
                mesh.userData.atmosphere.scale.set(
                    pData.radius * atmoScale,
                    pData.radius * atmoScale,
                    pData.radius * atmoScale
                );
            }
        }
    });

    // Animate comets
    animateComets(time);

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

    // Country labels visibility based on zoom
    if (selectedPlanet?.name === 'Terra' && countryLabelSprites.length > 0) {
        const showLabels = surfaceScale >= 0.8;
        countryLabelSprites.forEach(label => {
            label.visible = showLabels;
        });
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