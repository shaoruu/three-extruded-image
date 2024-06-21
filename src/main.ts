import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ExtruderOptions, ImageExtruder } from './extruder';

function main() {
  const container = createContainer();
  const controlsContainer = createControlsContainer(container);
  const canvasContainer = createCanvasContainer(container);

  const fileInput = createFileInput(controlsContainer);
  const thicknessSlider = createThicknessSlider(controlsContainer);
  const [canvasOriginal, canvas2D, canvas3D] = createCanvases(canvasContainer);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    canvas3D.width / canvas3D.height,
    0.1,
    1000,
  );
  const renderer = new THREE.WebGLRenderer({ canvas: canvas3D });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(canvas3D.width, canvas3D.height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1;
  camera.position.z = 5;

  const light = new THREE.PointLight(0xffffff, 1, 100);
  light.position.set(0, 0, 10);
  scene.add(light);

  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(ambientLight);

  let currentMesh: THREE.Mesh | null = null;
  let currentOutline: [number, number][] | null = null;

  function updateMesh(img: HTMLImageElement) {
    const options: ExtruderOptions = {
      thickness: parseFloat(thicknessSlider.value),
      size: 3,
      bevelEnabled: false,
      alphaThreshold: 128,
    };

    const imageExtruder = new ImageExtruder(options);
    const { outline, bounds } = imageExtruder.traceOutline(img);
    currentOutline = outline;
    const newMesh = imageExtruder.generateMesh(img);

    if (currentMesh) {
      scene.remove(currentMesh);
    }
    scene.add(newMesh);
    currentMesh = newMesh;

    // Draw the outline on the 2D canvas
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

function createFileInput(parent: HTMLElement): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png';
  parent.appendChild(input);
  return input;
}

function createThicknessSlider(parent: HTMLElement): HTMLInputElement {
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0.01';
  slider.max = '0.5';
  slider.step = '0.01';
  slider.value = '0.1';
  parent.appendChild(slider);
  return slider;
}

function createCanvasContainer(parent: HTMLElement): HTMLDivElement {
  const canvasContainer = document.createElement('div');
  canvasContainer.style.display = 'flex';
  canvasContainer.style.gap = '20px';
  parent.appendChild(canvasContainer);
  return canvasContainer;
}

function createCanvases(
  parent: HTMLElement,
): [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement] {
  return ['original', '2d', '3d'].map((id) => {
    const canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.width = canvas.height = 500;
    parent.appendChild(canvas);
    return canvas;
  }) as [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
}

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
