import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ExtrudedImage, ExtrudedImageOptions } from './extruder';

// Main function
function main() {
  const { controlsContainer, canvasContainer } = createLayout();
  const { fileInput, thicknessSlider } = createControls(controlsContainer);
  const { canvasOriginal, canvas2D, canvas3D } =
    createCanvases(canvasContainer);

  const { scene, camera, renderer, controls } = setupThreeJS(canvas3D);
  setupLighting(scene);

  let currentMesh: THREE.Mesh | null = null;
  let currentOutline: [number, number][] | null = null;

  function updateMesh(img: HTMLImageElement) {
    const options: ExtrudedImageOptions = {
      thickness: parseFloat(thicknessSlider.value),
      size: 3,
      bevelEnabled: false,
      alphaThreshold: 128,
    };

    const extrudedImage = new ExtrudedImage(img, options);
    const { outline, bounds } = extrudedImage.traceOutline(img);
    currentOutline = outline;

    if (currentMesh) {
      scene.remove(currentMesh);
    }
    scene.add(extrudedImage);
    currentMesh = extrudedImage;

    drawOutline(currentOutline, canvas2D, bounds);
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
        drawOriginalImage(img, canvasOriginal);
        updateMesh(img);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function handleThicknessChange() {
    if (currentMesh) {
      updateMesh((currentMesh.material as THREE.MeshBasicMaterial).map!.image);
    }
  }

  setupEventListeners(
    fileInput,
    thicknessSlider,
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
  input.accept = 'image/png, image/webp';
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
  const [canvasOriginal, canvas2D, canvas3D] = ['original', '2d', '3d'].map(
    (id) => {
      const canvas = document.createElement('canvas');
      canvas.id = id;
      canvas.width = canvas.height = 500;
      parent.appendChild(canvas);
      return canvas;
    },
  );
  return { canvasOriginal, canvas2D, canvas3D };
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
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setClearColor(0x151515);
  renderer.setSize(canvas.width, canvas.height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1;
  camera.position.z = 5;

  return { scene, camera, renderer, controls };
}

// Lighting setup function
function setupLighting(scene: THREE.Scene) {
  const light = new THREE.PointLight(0xffffff, 1, 100);
  light.position.set(0, 0, 10);
  scene.add(light);

  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(ambientLight);
}

// Event listener setup function
function setupEventListeners(
  fileInput: HTMLInputElement,
  thicknessSlider: HTMLInputElement,
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
}

// Drawing functions
function drawOriginalImage(img: HTMLImageElement, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Original canvas context is null');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
  const x = canvas.width / 2 - (img.width / 2) * scale;
  const y = canvas.height / 2 - (img.height / 2) * scale;
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
}

function drawOutline(
  outline: [number, number][],
  canvas: HTMLCanvasElement,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context is null');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 2;

  const scaleX = canvas.width / (bounds.maxX - bounds.minX);
  const scaleY = canvas.height / (bounds.maxY - bounds.minY);

  ctx.beginPath();
  outline.forEach(([x, y], i) => {
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method]((x - bounds.minX) * scaleX, (y - bounds.minY) * scaleY);
  });
  ctx.closePath();
  ctx.stroke();
}

main();
