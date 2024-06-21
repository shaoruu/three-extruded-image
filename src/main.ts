import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// DOM elements
const fileInput = createFileInput();
const thicknessSlider = createThicknessSlider();
const [canvasOriginal, canvas2D, canvas3D] = createCanvases();

// Three.js setup
const { scene, camera, renderer, controls } = setupThreeJS(canvas3D);

// State
let currentImageSrc: string | null = null;

// Event listeners
fileInput.addEventListener('change', handleFileUpload);
thicknessSlider.addEventListener('input', handleThicknessChange);

function createFileInput(): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png';
  document.body.appendChild(input);
  return input;
}

function createThicknessSlider(): HTMLInputElement {
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0.01';
  slider.max = '0.5';
  slider.step = '0.01';
  slider.value = '0.1';
  document.body.appendChild(slider);
  return slider;
}

function createCanvases(): [
  HTMLCanvasElement,
  HTMLCanvasElement,
  HTMLCanvasElement,
] {
  return ['original', '2d', '3d'].map((id) => {
    const canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.width = canvas.height = 500;
    document.body.appendChild(canvas);
    return canvas;
  }) as [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
}

function setupThreeJS(canvas: HTMLCanvasElement) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    canvas.width / canvas.height,
    0.1,
    1000,
  );
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(canvas.width, canvas.height);
  renderer.setPixelRatio(window.devicePixelRatio);
  const controls = new OrbitControls(camera, renderer.domElement);
  camera.position.z = 5;
  return { scene, camera, renderer, controls };
}

function handleFileUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      currentImageSrc = e.target?.result as string;
      processImage(currentImageSrc);
    };
    reader.readAsDataURL(file);
  }
}

function handleThicknessChange() {
  if (currentImageSrc) {
    processImage(currentImageSrc);
  }
}

function processImage(imageSrc: string) {
  const img = new Image();
  img.onload = () => {
    drawOriginalImage(img);
    const outline = traceOutline(img);
    drawOutline(outline);
    generateGeometry(img, outline);
  };
  img.src = imageSrc;
}

function drawOriginalImage(img: HTMLImageElement) {
  const ctx = canvasOriginal.getContext('2d');
  if (!ctx) throw new Error('Original canvas context is null');
  ctx.clearRect(0, 0, canvasOriginal.width, canvasOriginal.height);
  const scale = Math.min(
    canvasOriginal.width / img.width,
    canvasOriginal.height / img.height,
  );
  const x = canvasOriginal.width / 2 - (img.width / 2) * scale;
  const y = canvasOriginal.height / 2 - (img.height / 2) * scale;
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
}

function traceOutline(img: HTMLImageElement): [number, number][] {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = img.width;
  tempCanvas.height = img.height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) {
    console.error('Could not get temp 2D context');
    return [];
  }

  tempCtx.drawImage(img, 0, 0);
  const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
  const data = imageData.data;

  const outline: [number, number][] = [];
  const visited = new Set<string>();

  function isEdge(x: number, y: number): boolean {
    if (x < 0 || x >= img.width || y < 0 || y >= img.height) return false;
    const index = (y * img.width + x) * 4;
    return (
      data[index + 3] > 128 && // Check if pixel is not mostly transparent
      (x === 0 ||
        y === 0 ||
        x === img.width - 1 ||
        y === img.height - 1 ||
        data[((y - 1) * img.width + x) * 4 + 3] <= 128 ||
        data[((y + 1) * img.width + x) * 4 + 3] <= 128 ||
        data[(y * img.width + x - 1) * 4 + 3] <= 128 ||
        data[(y * img.width + x + 1) * 4 + 3] <= 128)
    );
  }

  function traceOutline(startX: number, startY: number) {
    const directions = [
      [0, -1],
      [1, -1],
      [1, 0],
      [1, 1],
      [0, 1],
      [-1, 1],
      [-1, 0],
      [-1, -1],
    ];
    let x = startX,
      y = startY;
    let dir = 0;

    do {
      outline.push([x, y]);
      visited.add(`${x},${y}`);

      let found = false;
      for (let i = 0; i < 8; i++) {
        const newDir = (dir + i) % 8;
        const [dx, dy] = directions[newDir];
        const newX = x + dx,
          newY = y + dy;

        if (isEdge(newX, newY) && !visited.has(`${newX},${newY}`)) {
          x = newX;
          y = newY;
          dir = newDir;
          found = true;
          break;
        }
      }

      if (!found) break;
    } while (!(x === startX && y === startY));
  }

  let startX = -1,
    startY = -1;
  outerLoop: for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (isEdge(x, y)) {
        startX = x;
        startY = y;
        break outerLoop;
      }
    }
  }

  if (startX !== -1 && startY !== -1) {
    traceOutline(startX, startY);
  }

  return outline;
}

function drawOutline(outline: [number, number][]) {
  const ctx = canvas2D.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas2D.width, canvas2D.height);
  ctx.beginPath();
  outline.forEach(([x, y], i) => {
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function generateGeometry(img: HTMLImageElement, outline: [number, number][]) {
  scene.clear();

  const shape = new THREE.Shape();
  outline.forEach(([x, y], i) => {
    const method = i === 0 ? 'moveTo' : 'lineTo';
    shape[method](x / img.width - 0.5, -y / img.height + 0.5);
  });

  const geometry = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: parseFloat(thicknessSlider.value),
    bevelEnabled: false,
  });

  setUVs(geometry);

  const texture = createTexture(img);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const light = new THREE.PointLight(0xffffff, 1, 100);
  light.position.set(0, 0, 10);
  scene.add(light);

  animate();
}

function setUVs(geometry: THREE.ExtrudeGeometry) {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  if (!bbox) throw new Error('Bounding box is null');

  const uvs = geometry.attributes.uv;
  const positions = geometry.attributes.position;
  for (let i = 0; i < uvs.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const u = (x - bbox.min.x) / (bbox.max.x - bbox.min.x);
    const v = 1 - (y - bbox.min.y) / (bbox.max.y - bbox.min.y);
    uvs.setXY(i, u, v);
  }
}

function createTexture(img: HTMLImageElement) {
  const texture = new THREE.TextureLoader().load(img.src, (loadedTexture) => {
    loadedTexture.minFilter = THREE.LinearFilter;
    loadedTexture.magFilter = THREE.LinearFilter;
    loadedTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    loadedTexture.needsUpdate = true;
  });
  texture.flipY = false; // Flip the texture vertically
  return texture;
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
