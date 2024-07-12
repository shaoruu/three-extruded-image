import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ExtrudedImage, ExtrudedImageOptions } from './extruder';
import {
  DirectionalLight,
  HemisphereLight,
  PointLight,
  PlaneGeometry,
  MeshStandardMaterial,
} from 'three';

// Main function
function main() {
  const { controlsContainer, canvasContainer } = createLayout();
  const { fileInput, thicknessSlider, legacyCheckbox } =
    createControls(controlsContainer);
  const { imgOriginal, canvas3D } = createImageAndCanvas(canvasContainer);

  const { scene, camera, renderer, controls } = setupThreeJS(canvas3D);
  setupLighting(scene);
  addGround(scene);

  let currentMesh: ExtrudedImage | null = null;
  let currentImage: HTMLImageElement | null = null;

  let panPosition = { x: 0, y: 0 };
  let isPanning = false;
  let startPanPosition = { x: 0, y: 0 };
  let zoomLevel = 1;

  function updateOriginalImage(img: HTMLImageElement) {
    imgOriginal.src = img.src;
    imgOriginal.style.objectFit = 'contain';
    imgOriginal.style.width = '100%';
    imgOriginal.style.height = '100%';
  }

  function setupPanAndZoom(img: HTMLImageElement) {
    imgOriginal.addEventListener('mousedown', (e) => {
      isPanning = true;
      startPanPosition = {
        x: e.clientX - panPosition.x,
        y: e.clientY - panPosition.y,
      };
    });

    imgOriginal.addEventListener('mousemove', (e) => {
      if (isPanning) {
        panPosition.x = e.clientX - startPanPosition.x;
        panPosition.y = e.clientY - startPanPosition.y;
        updateOriginalImage(img);
      }
    });

    imgOriginal.addEventListener('mouseup', () => {
      isPanning = false;
    });

    imgOriginal.addEventListener('mouseleave', () => {
      isPanning = false;
    });

    imgOriginal.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = imgOriginal.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate mouse position relative to image
      const imageX = (mouseX - panPosition.x) / zoomLevel;
      const imageY = (mouseY - panPosition.y) / zoomLevel;

      // Determine zoom direction
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoomLevel = zoomLevel * zoomFactor;

      // Calculate new pan position
      panPosition.x = mouseX - imageX * newZoomLevel;
      panPosition.y = mouseY - imageY * newZoomLevel;

      // Update zoom level
      zoomLevel = newZoomLevel;

      updateOriginalImage(img);
    });
  }

  function updateMesh(img: HTMLImageElement, thickness?: number) {
    const options: ExtrudedImageOptions = {
      thickness: thickness ?? parseFloat(thicknessSlider.value),
      size: 0.75,
      alphaThreshold: 128,
      legacy: legacyCheckbox.checked,
    };

    const extrudedImage = new ExtrudedImage(img, options);
    extrudedImage.castShadow = true;
    extrudedImage.receiveShadow = true;

    // Add rotation and bobbing animation
    const animate = () => {
      extrudedImage.rotation.y += 0.01;
      extrudedImage.position.y = Math.sin(Date.now() * 0.002) * 0.025;
      requestAnimationFrame(animate);
    };
    animate();

    if (currentMesh) {
      scene.remove(currentMesh);
    }
    scene.add(extrudedImage);

    currentImage = img;
    currentMesh = extrudedImage;
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  animate();

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        zoomLevel = 1;
        panPosition = { x: 0, y: 0 };
        updateOriginalImage(img);
        setupPanAndZoom(img);
        updateMesh(img);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function handleThicknessChange() {
    if (currentImage) {
      updateMesh(currentImage, parseFloat(thicknessSlider.value));
    }
  }

  function handleLegacyChange() {
    if (currentImage) {
      updateMesh(currentImage, parseFloat(thicknessSlider.value));
    }
  }

  setupEventListeners(
    fileInput,
    thicknessSlider,
    legacyCheckbox,
    handleFileUpload,
    handleThicknessChange,
    handleLegacyChange,
  );
}

// Layout creation functions
function createLayout() {
  const container = createContainer();
  const controlsContainer = createControlsContainer(container);
  const canvasContainer = createCanvasContainer(container);
  return { container, controlsContainer, canvasContainer };
}

function createContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.gap = '20px';
  document.body.appendChild(container);
  return container;
}

function createControlsContainer(parent: HTMLElement): HTMLDivElement {
  const controlsContainer = document.createElement('div');
  controlsContainer.style.display = 'flex';
  controlsContainer.style.gap = '10px';
  controlsContainer.style.marginBottom = '20px';
  controlsContainer.className = 'controls';
  parent.appendChild(controlsContainer);
  return controlsContainer;
}

function createCanvasContainer(parent: HTMLElement): HTMLDivElement {
  const canvasContainer = document.createElement('div');
  canvasContainer.style.display = 'flex';
  canvasContainer.style.gap = '20px';
  parent.appendChild(canvasContainer);
  return canvasContainer;
}

// Control creation functions
function createControls(parent: HTMLElement) {
  const fileInput = createFileInput(parent);
  const thicknessSlider = createThicknessSlider(parent);
  const legacyCheckbox = createLegacyCheckbox(parent);
  return { fileInput, thicknessSlider, legacyCheckbox };
}

function createFileInput(parent: HTMLElement): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  parent.appendChild(input);
  return input;
}

function createSlider(options: {
  min: string;
  max: string;
  step: string;
  value: string;
}): HTMLInputElement {
  const slider = document.createElement('input');
  slider.type = 'range';
  Object.assign(slider, options);
  return slider;
}

function createThicknessSlider(parent: HTMLElement): HTMLInputElement {
  const slider = createSlider({
    min: '0.001',
    max: '0.5',
    step: '0.01',
    value: '0.05',
  });
  parent.appendChild(slider);
  return slider;
}

function createLegacyCheckbox(parent: HTMLElement): HTMLInputElement {
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '5px';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'legacyCheckbox';

  const label = document.createElement('label');
  label.htmlFor = 'legacyCheckbox';
  label.textContent = 'Use Legacy Mode';

  container.appendChild(checkbox);
  container.appendChild(label);
  parent.appendChild(container);

  return checkbox;
}

// Canvas creation function
function createImageAndCanvas(parent: HTMLElement) {
  const imgContainer = document.createElement('div');
  imgContainer.style.width = '500px';
  imgContainer.style.height = '500px';
  imgContainer.style.outline = '1px solid #030303';
  imgContainer.style.overflow = 'hidden';

  const imgOriginal = document.createElement('img');
  imgOriginal.id = 'original';
  imgContainer.appendChild(imgOriginal);
  parent.appendChild(imgContainer);

  const canvas3D = document.createElement('canvas');
  canvas3D.id = '3d';
  canvas3D.width = canvas3D.height = 500;
  const canvas3DContainer = document.createElement('div');
  canvas3DContainer.style.width = '500px';
  canvas3DContainer.style.height = '500px';
  canvas3DContainer.style.outline = '1px solid #030303';
  canvas3DContainer.appendChild(canvas3D);
  parent.appendChild(canvas3DContainer);

  return { imgOriginal, canvas3D };
}

// Three.js setup function
function setupThreeJS(canvas: HTMLCanvasElement) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    canvas.width / canvas.height,
    0.1,
    1000,
  );
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor(0xffffff);
  renderer.setSize(canvas.width, canvas.height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.autoRotate = false;
  camera.position.set(1.5, 1.5, 2.5);
  controls.update();

  return { scene, camera, renderer, controls };
}

// Lighting setup function
function setupLighting(scene: THREE.Scene) {
  // Ambient light for overall scene brightness
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambientLight);

  // Main directional light (simulating sun)
  const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
  mainLight.position.set(5, 5, 5);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 1024;
  mainLight.shadow.mapSize.height = 1024;
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 20;
  scene.add(mainLight);

  // Soft fill light
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-5, 3, -5);
  scene.add(fillLight);

  // Subtle rim light
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
  rimLight.position.set(0, -5, -5);
  scene.add(rimLight);
}

function addGround(scene: THREE.Scene) {
  const groundGeometry = new THREE.BoxGeometry(1, 0.5, 1);
  const groundMaterial = new MeshStandardMaterial({
    color: 0xd6efd8,
    roughness: 0.8,
    metalness: 0.2,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.y = -0.75;
  ground.receiveShadow = true;
  scene.add(ground);
}

// Event listener setup function
function setupEventListeners(
  fileInput: HTMLInputElement,
  thicknessSlider: HTMLInputElement,
  legacyCheckbox: HTMLInputElement,
  handleFileUpload: (file: File) => void,
  handleThicknessChange: () => void,
  handleLegacyChange: () => void,
) {
  fileInput.addEventListener('change', (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  });

  thicknessSlider.addEventListener('input', handleThicknessChange);
  legacyCheckbox.addEventListener('change', handleLegacyChange);
}

main();
