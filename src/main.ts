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
  const { fileInput, thicknessSlider } = createControls(controlsContainer);
  const { canvasOriginal, canvas3D } = createCanvases(canvasContainer);

  const { scene, camera, renderer, controls } = setupThreeJS(canvas3D);
  setupLighting(scene);
  addGround(scene);

  let currentMesh: ExtrudedImage | null = null;
  let currentImage: HTMLImageElement | null = null;

  let panPosition = { x: 0, y: 0 };
  let isPanning = false;
  let startPanPosition = { x: 0, y: 0 };
  let zoomLevel = 1;

  function drawOriginalImage(img: HTMLImageElement, canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Original canvas context is null');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.save();

    // calculate the centered position
    const centerX = (canvas.width - img.width * zoomLevel) / 2;
    const centerY = (canvas.height - img.height * zoomLevel) / 2;

    // apply pan and zoom
    ctx.translate(panPosition.x + centerX, panPosition.y + centerY);
    ctx.scale(zoomLevel, zoomLevel);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  function setupPanAndZoom(canvas: HTMLCanvasElement, img: HTMLImageElement) {
    canvas.addEventListener('mousedown', (e) => {
      isPanning = true;
      startPanPosition = {
        x: e.clientX - panPosition.x,
        y: e.clientY - panPosition.y,
      };
    });

    canvas.addEventListener('mousemove', (e) => {
      if (isPanning) {
        panPosition.x = e.clientX - startPanPosition.x;
        panPosition.y = e.clientY - startPanPosition.y;
        drawOriginalImage(img, canvas);
      }
    });

    canvas.addEventListener('mouseup', () => {
      isPanning = false;
    });

    canvas.addEventListener('mouseleave', () => {
      isPanning = false;
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
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

      drawOriginalImage(img, canvas);
    });
  }

  function updateMesh(img: HTMLImageElement, thickness?: number) {
    const options: ExtrudedImageOptions = {
      thickness: thickness ?? parseFloat(thicknessSlider.value),
      size: 3,
      alphaThreshold: 128,
      // customMaterial: new THREE.MeshStandardMaterial({
      //   color: 0xffffff,
      //   metalness: 0.3,
      //   roughness: 0.4,
      //   flatShading: false,
      //   transparent: true,
      //   alphaTest: 0.5,
      // }),
    };

    const extrudedImage = new ExtrudedImage(img, options);
    extrudedImage.castShadow = true;
    extrudedImage.receiveShadow = true;

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
        drawOriginalImage(img, canvasOriginal);
        setupPanAndZoom(canvasOriginal, img);
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

  setupEventListeners(
    fileInput,
    thicknessSlider,
    canvasOriginal,
    canvas3D,
    handleFileUpload,
    handleThicknessChange,
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
  return { fileInput, thicknessSlider };
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
    min: '0.01',
    max: '0.5',
    step: '0.01',
    value: '0.1',
  });
  parent.appendChild(slider);
  return slider;
}

// Canvas creation function
function createCanvases(parent: HTMLElement) {
  const [canvasOriginal, canvas3D] = ['original', '3d'].map((id) => {
    const canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.width = canvas.height = 500;
    const container = document.createElement('div');
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.outline = '1px solid #030303';
    container.style.overflow = 'hidden';
    container.appendChild(canvas);
    parent.appendChild(container);
    return canvas;
  });
  return { canvasOriginal, canvas3D };
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
  renderer.setClearColor(0x303030);
  renderer.setSize(canvas.width, canvas.height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1;
  camera.position.set(3, 3, 5);
  controls.update();

  return { scene, camera, renderer, controls };
}

// Lighting setup function
function setupLighting(scene: THREE.Scene) {
  // Brighter hemisphere light
  const hemiLight = new HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(hemiLight);

  // Brighter main directional light
  const mainLight = new DirectionalLight(0xffffff, 1.5);
  mainLight.position.set(5, 5, 5);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  scene.add(mainLight);

  // Brighter accent lights
  const colors = [0xff9999, 0x99ff99, 0x9999ff];
  colors.forEach((color, index) => {
    const light = new PointLight(color, 0.8);
    light.position.set(
      Math.cos(index * 2.1) * 3,
      Math.sin(index * 2.1) * 3,
      Math.sin(index * 1.5) * 3,
    );
    scene.add(light);
  });
}

function addGround(scene: THREE.Scene) {
  const groundGeometry = new PlaneGeometry(10, 10);
  const groundMaterial = new MeshStandardMaterial({
    color: 0x808080, // Lighter gray
    roughness: 0.8,
    metalness: 0.2,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.5;
  ground.receiveShadow = true;
  scene.add(ground);
}

// Event listener setup function
function setupEventListeners(
  fileInput: HTMLInputElement,
  thicknessSlider: HTMLInputElement,
  canvasOriginal: HTMLCanvasElement,
  canvas3D: HTMLCanvasElement,
  handleFileUpload: (file: File) => void,
  handleThicknessChange: () => void,
) {
  fileInput.addEventListener('change', (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  });

  thicknessSlider.addEventListener('input', handleThicknessChange);

  [canvasOriginal, canvas3D].forEach((canvas) => {
    canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer!.dropEffect = 'copy';
    });

    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer!.files[0];
      if (file && file.type.startsWith('image/')) {
        handleFileUpload(file);
      }
    });
  });
}

main();
