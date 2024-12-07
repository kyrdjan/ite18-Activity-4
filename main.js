import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/GLTFLoader.js";

// === Basic Scene Setup ni ===
const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 15);
scene.add(camera);

// === Controls sa camera ===
new OrbitControls(camera, renderer.domElement);

// === Lighting ni ===
const dynamicLight = new THREE.PointLight(0xff4500, 8, 50); // Lava light
dynamicLight.position.set(0, 10, 0);
scene.add(dynamicLight);

// === Lava Waves ni para mwa ===
const lava = (() => {
    const geometry = new THREE.PlaneGeometry(75, 75, 300, 300);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            waveHeight: { value: 0.3 },
            waveFrequency: { value: 0.8 },
            deepColor: { value: new THREE.Color(0x8b0000) }, // Dark red
            glowColor: { value: new THREE.Color(0xff4500) }, // Bright orange
        },
        vertexShader: `
            uniform float time;
            uniform float waveHeight;
            uniform float waveFrequency;
            varying vec2 vUv;

            void main() {
                vUv = uv;
                vec3 pos = position;
                pos.y += sin(pos.x * waveFrequency + time) * waveHeight * 0.8;
                pos.y += cos(pos.z * waveFrequency + time * 1.5) * waveHeight * 0.6;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 deepColor;
            uniform vec3 glowColor;
            varying vec2 vUv;

            void main() {
                float flow = sin(vUv.y * 10.0 + vUv.x * 5.0) * 0.5 + 0.5; // Flow pattern
                vec3 color = mix(deepColor, glowColor, flow);
                gl_FragColor = vec4(color, 1.0);
            }
        `,
    });

    return new THREE.Mesh(geometry, material);
})();
scene.add(lava);

// === Si bb sam with animations ===
let lavaCreature = null;
let mixer = null; // Animation mixer para sa monster

new GLTFLoader().load(
    'https://trystan211.github.io/ite18_fitz_act4/metroid_primecreaturesmagmoor.glb', 
    (gltf) => {
        lavaCreature = gltf.scene;
        lavaCreature.position.set(0, 1, 0);
        lavaCreature.scale.set(7, 7, 7); // Kadak on niya
        scene.add(lavaCreature);

        console.log("GLTF Loaded Scene:", gltf.scene);
        console.log("GLTF Animations:", gltf.animations);

        // Set up sa animation mixer
        if (gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(lavaCreature);
            gltf.animations.forEach((clip) => {
                const action = mixer.clipAction(clip);
                action.setLoop(THREE.LoopRepeat);
                action.play();
                console.log("Playing Animation Clip:", clip.name);
            });
        } else {
            console.warn("No animations found in GLTF model.");
        }
    },
    undefined,
    (error) => console.error("Failed to load lava creature model:", error)
);

// === Lava Rain ni ===
const lavaRain = (() => {
    const count = 10000;
    const positions = [];
    const velocities = [];

    for (let i = 0; i < count; i++) {
        positions.push(
            (Math.random() - 0.5) * 100,
            Math.random() * 50,
            (Math.random() - 0.5) * 100
        );
        velocities.push(-0.2 - Math.random() * 0.5);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xff4500,
        size: 0.5,
        transparent: true,
        opacity: 0.8,
    });

    const points = new THREE.Points(geometry, material);
    points.userData.velocities = velocities;

    return points;
})();
scene.add(lavaRain);

// === Skybox ni ===
const skyboxMaterial = new THREE.ShaderMaterial({
    uniforms: {
        topColor: { value: new THREE.Color(0x4b0082) }, 
        bottomColor: { value: new THREE.Color(0xff4500) }, // Bright lava
    },
    vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
            vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
            float height = normalize(vWorldPosition).y;
            gl_FragColor = vec4(mix(bottomColor, topColor, max(height, 0.0)), 1.0);
        }
    `,
    side: THREE.BackSide,
});

const skybox = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 32), skyboxMaterial);
scene.add(skybox);

// === Animation ni diri ===
const clock = new THREE.Clock();

function animate() {
    const delta = clock.getDelta(); // By frame ni siya na calculation
    const time = clock.getElapsedTime();

    // Update sa lava waves para mugana 
    lava.material.uniforms.time.value = time;

    // Update sa rain
    const rainPositions = lavaRain.geometry.attributes.position.array;
    const rainVelocities = lavaRain.userData.velocities;

    for (let i = 0; i < rainPositions.length / 3; i++) {
        const idx = i * 3 + 1; // Y coordinates ni
        rainPositions[idx] += rainVelocities[i];
        if (rainPositions[idx] < 0) rainPositions[idx] = 50;
    }
    lavaRain.geometry.attributes.position.needsUpdate = true;

    // Update sa dynamic light para mugana
    dynamicLight.position.set(
        10 * Math.sin(time * 0.5),
        10,
        10 * Math.cos(time * 0.5)
    );

    // Update lava monsster animations para mugana
    if (mixer) {
        mixer.update(delta);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();

// === Responsive Resizing nis page ===
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

