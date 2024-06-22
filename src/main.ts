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

  function updateMesh(img: HTMLImageElement) {
    const options: ExtrudedImageOptions = {
      thickness: parseFloat(thicknessSlider.value),
      size: 3,
      bevelEnabled: false,
      alphaThreshold: 128,
    };

    const extrudedImage = new ExtrudedImage(img, options);
    const { outline } = extrudedImage.traceOutline(img);
    currentOutline = outline;

    if (currentMesh) {
      scene.remove(currentMesh);
    }
    scene.add(extrudedImage);
    currentMesh = extrudedImage;

    drawOutline(currentOutline, canvas2D, extrudedImage);
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
function drawOutline(
  outline: [number, number][],
  canvas: HTMLCanvasElement,
  mesh: THREE.Mesh,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context is null');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  const material = mesh.material as THREE.MeshBasicMaterial;
  const texture = material.map;
  if (!texture) {
    throw new Error('Texture is null');
  }

  if (!texture.source.data) {
    texture.onUpdate = () => {
      drawOutline(outline, canvas, mesh);
    };
    return;
  }

  const image = texture.source.data;
  const imageWidth = image.width;
  const imageHeight = image.height;
  const imageAspectRatio = imageWidth / imageHeight;
  const canvasAspectRatio = canvas.width / canvas.height;

  let drawWidth, drawHeight, offsetX, offsetY;

  if (imageAspectRatio > canvasAspectRatio) {
    drawWidth = canvas.width;
    drawHeight = drawWidth / imageAspectRatio;
    offsetX = 0;
    offsetY = (canvas.height - drawHeight) / 2;
  } else {
    drawHeight = canvas.height;
    drawWidth = drawHeight * imageAspectRatio;
    offsetX = (canvas.width - drawWidth) / 2;
    offsetY = 0;
  }

  const scaleX = drawWidth / imageWidth;
  const scaleY = drawHeight / imageHeight;

  // draw the texture image
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.drawImage(image, 0, 0, drawWidth, drawHeight);
  ctx.restore();

  // draw the outline
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 2;
  ctx.beginPath();
  outline.forEach(([x, y], i) => {
    const method = i === 0 ? 'moveTo' : 'lineTo';
    const scaledX = x * scaleX + offsetX;
    const scaledY = y * scaleY + offsetY;
    ctx[method](scaledX, scaledY);
  });
  ctx.closePath();
  ctx.stroke();
}

main();
