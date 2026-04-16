// ============================================
// ASTROPOSE — PLANET SURFACE VIEW (8K HQ)
// ============================================
import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { GLOBE_RADIUS, GLOBE_SEGMENTS } from '../config.js';
import { planetSurfaceGroup } from '../scene/setup.js';
import { createPlanetMaterial, createRingMesh, loadTexture } from './textures.js';
import { loadEarthBorders, createLandmarks } from './earthFeatures.js';

export let surfaceEarth = null;
export let surfaceGroup = null;

export function createPlanetSurface(pData) {
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

    surfaceGroup = new THREE.Group();

    // === USAR TEXTURAS 8K HQ NA SUPERFÍCIE ===
    const material = createPlanetMaterial(pData, true); // useHQ = true

    surfaceEarth = new THREE.Mesh(
        new THREE.SphereGeometry(GLOBE_RADIUS, GLOBE_SEGMENTS, GLOBE_SEGMENTS),
        material
    );
    surfaceGroup.add(surfaceEarth);

    // Cloud layer (8K HQ)
    const cloudUrl = pData.cloudTextureHQ || pData.cloudTexture;
    if (cloudUrl) {
        const cloudTex = loadTexture(cloudUrl);
        const clouds = new THREE.Mesh(
            new THREE.SphereGeometry(GLOBE_RADIUS + 0.04, GLOBE_SEGMENTS, GLOBE_SEGMENTS),
            new THREE.MeshPhongMaterial({
                map: cloudTex,
                transparent: true,
                opacity: pData.planetType === 'venus' ? 0.7 : 0.5,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        surfaceGroup.add(clouds);
        surfaceGroup.userData.clouds = clouds;
    }

    // Atmosphere glow
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

    // Earth-specific features
    if (pData.planetType === 'earth') {
        loadEarthBorders(surfaceGroup);
    }
    if (pData.hasLandmarks) {
        createLandmarks(surfaceGroup);
    }

    // Saturn ring (8K HQ)
    if (pData.hasRing) {
        const ring = createRingMesh(pData, GLOBE_RADIUS, true); // useHQ = true
        if (ring) surfaceGroup.add(ring);
    }

    // Axial tilt
    if (pData.tilt) {
        surfaceGroup.rotation.z = pData.tilt;
    }

    // Surface lighting
    const surfaceLight = new THREE.DirectionalLight(0xffffff, 1.5);
    surfaceLight.position.set(5, 3, 8);
    surfaceGroup.add(surfaceLight);
    surfaceGroup.add(new THREE.AmbientLight(0x222233, 0.5));

    planetSurfaceGroup.add(surfaceGroup);
}
