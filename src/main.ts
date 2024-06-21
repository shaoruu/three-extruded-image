import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface ExtruderOptions {
  thickness: number;
  size: number;
  bevelEnabled: boolean;
  bevelThickness?: number;
  bevelSize?: number;
  bevelSegments?: number;
  alphaThreshold: number;
  colorFilter?: (r: number, g: number, b: number, a: number) => boolean;
}

class ImageExtruder {
  private options: ExtruderOptions;

  constructor(options: ExtruderOptions) {
    this.options = options;
  }

  public traceOutline(img: HTMLImageElement): {
    outline: [number, number][];
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
  } {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      console.error('Could not get temp 2D context');
      return { outline: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
    }

    tempCtx.drawImage(img, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;

    // Apply threshold
    const threshold = this.options.alphaThreshold;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < threshold) {
        data[i + 3] = 0; // Fully transparent
      } else {
        data[i + 3] = 255; // Fully opaque
      }
    }
    tempCtx.putImageData(imageData, 0, 0);

    const outline: [number, number][] = [];
    const visited = new Set<string>();

    const bounds = {
      minX: img.width,
      minY: img.height,
      maxX: 0,
      maxY: 0,
    };

    function updateBounds(x: number, y: number) {
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
    }

    function isEdge(x: number, y: number): boolean {
      if (x < 0 || x >= img.width || y < 0 || y >= img.height) return false;
      const index = (y * img.width + x) * 4;
      return (
        data[index + 3] > threshold && // Check if pixel is not mostly transparent
        (x === 0 ||
          y === 0 ||
          x === img.width - 1 ||
          y === img.height - 1 ||
          data[((y - 1) * img.width + x) * 4 + 3] <= threshold ||
          data[((y + 1) * img.width + x) * 4 + 3] <= threshold ||
          data[(y * img.width + x - 1) * 4 + 3] <= threshold ||
          data[(y * img.width + x + 1) * 4 + 3] <= threshold)
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
        updateBounds(x, y);

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

    return { outline, bounds };
  }

  private createGeometry(
    img: HTMLImageElement,
    outlineData: {
      outline: [number, number][];
      bounds: { minX: number; minY: number; maxX: number; maxY: number };
    },
  ): THREE.ExtrudeGeometry {
    const { outline, bounds } = outlineData;
    const shape = new THREE.Shape();
    outline.forEach(([x, y], i) => {
      const method = i === 0 ? 'moveTo' : 'lineTo';
      const normalizedX = (x - bounds.minX) / (bounds.maxX - bounds.minX);
      const normalizedY = (y - bounds.minY) / (bounds.maxY - bounds.minY);
      shape[method](
        (normalizedX - 0.5) * this.options.size,
        (-normalizedY + 0.5) * this.options.size,
      );
    });

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: this.options.thickness,
      bevelEnabled: this.options.bevelEnabled,
      bevelThickness: this.options.bevelThickness,
      bevelSize: this.options.bevelSize,
      bevelSegments: this.options.bevelSegments,
    });

    this.setUVs(geometry, img, bounds);
    return geometry;
  }

  private setUVs(
    geometry: THREE.ExtrudeGeometry,
    img: HTMLImageElement,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
  ) {
    const imgWidth = bounds.maxX - bounds.minX;
    const imgHeight = bounds.maxY - bounds.minY;

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

      // map u and v to the actual image content
      const mappedU = bounds.minX / img.width + (u * imgWidth) / img.width;
      const mappedV = bounds.minY / img.height + (v * imgHeight) / img.height;

      uvs.setXY(i, mappedU, mappedV);
    }
  }

  private createTexture(img: HTMLImageElement): THREE.Texture {
    const texture = new THREE.TextureLoader().load(img.src);
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  public generateMesh(img: HTMLImageElement): THREE.Mesh {
    const outlineData = this.traceOutline(img);
    const geometry = this.createGeometry(img, outlineData);
    const texture = this.createTexture(img);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
    });
    return new THREE.Mesh(geometry, material);
  }
}

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
      size: 1,
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
    drawOutline(currentOutline, canvas2D, img.width, img.height, bounds);
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
