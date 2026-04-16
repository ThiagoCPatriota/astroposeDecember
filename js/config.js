// ============================================
// ASTROPOSE — CONFIGURAÇÃO GLOBAL
// ============================================

// --- API KEY ---
let apiKey = 'DEMO_KEY';
if (typeof NASA_API_KEY !== 'undefined') {
    apiKey = NASA_API_KEY;
} else if (import.meta.env && import.meta.env.VITE_NASA_KEY) {
    apiKey = import.meta.env.VITE_NASA_KEY;
}

// --- CONSTANTES ---
export const GLOBE_RADIUS = 2.5;
export const GLOBE_SEGMENTS = 64;
export const ROTATION_SPEED = 0.004;

// --- APIs ---
export const NASA_IMAGE_API = 'https://images-api.nasa.gov/search';
export const NASA_APOD_API = `https://api.nasa.gov/planetary/apod?api_key=${apiKey}`;

// --- TEXTURAS — Solar System Scope ---
// images.weserv.nl é um proxy de imagens gratuito com suporte CORS
export const TEXTURE_BASE = 'https://images.weserv.nl/?url=www.solarsystemscope.com/textures/download/';

// 2K — Carregamento rápido para visão do Sistema Solar (planetas pequenos)
export const TEXTURES = {
    sun:             `${TEXTURE_BASE}2k_sun.jpg`,
    mercury:         `${TEXTURE_BASE}2k_mercury.jpg`,
    venus_surface:   `${TEXTURE_BASE}2k_venus_surface.jpg`,
    venus_atmosphere:`${TEXTURE_BASE}2k_venus_atmosphere.jpg`,
    earth_daymap:    `${TEXTURE_BASE}2k_earth_daymap.jpg`,
    earth_clouds:    `${TEXTURE_BASE}2k_earth_clouds.jpg`,
    earth_nightmap:  `${TEXTURE_BASE}2k_earth_nightmap.jpg`,
    mars:            `${TEXTURE_BASE}2k_mars.jpg`,
    jupiter:         `${TEXTURE_BASE}2k_jupiter.jpg`,
    saturn:          `${TEXTURE_BASE}2k_saturn.jpg`,
    saturn_ring:     `${TEXTURE_BASE}2k_saturn_ring_alpha.png`,
    uranus:          `${TEXTURE_BASE}2k_uranus.jpg`,
    neptune:         `${TEXTURE_BASE}2k_neptune.jpg`,
    stars_milky_way: `${TEXTURE_BASE}2k_stars_milky_way.jpg`,
};

// 8K — Alta resolução para visão de Superfície (carregado sob demanda)
export const TEXTURES_HQ = {
    sun:             `${TEXTURE_BASE}8k_sun.jpg`,
    mercury:         `${TEXTURE_BASE}8k_mercury.jpg`,
    venus_surface:   `${TEXTURE_BASE}8k_venus_surface.jpg`,
    venus_atmosphere:`${TEXTURE_BASE}8k_venus_atmosphere.jpg`,
    earth_daymap:    `${TEXTURE_BASE}8k_earth_daymap.jpg`,
    earth_clouds:    `${TEXTURE_BASE}8k_earth_clouds.jpg`,
    earth_nightmap:  `${TEXTURE_BASE}8k_earth_nightmap.jpg`,
    mars:            `${TEXTURE_BASE}8k_mars.jpg`,
    jupiter:         `${TEXTURE_BASE}8k_jupiter.jpg`,
    saturn:          `${TEXTURE_BASE}8k_saturn.jpg`,
    saturn_ring:     `${TEXTURE_BASE}8k_saturn_ring_alpha.png`,
    uranus:          `${TEXTURE_BASE}2k_uranus.jpg`,
    neptune:         `${TEXTURE_BASE}2k_neptune.jpg`,
    stars_milky_way: `${TEXTURE_BASE}8k_stars_milky_way.jpg`,
};

// --- SCENE STATES ---
export const SceneState = {
    SOLAR_SYSTEM: 'SOLAR_SYSTEM',
    PLANET_SURFACE: 'PLANET_SURFACE'
};
