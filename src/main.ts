import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const canvas2D = document.createElement('canvas');
canvas2D.width = 500;
canvas2D.height = 500;
document.body.appendChild(canvas2D);

const ctx2D = canvas2D.getContext('2d');
if (!ctx2D) {
  console.error('Could not get 2D context');
  throw new Error('Canvas context is null');
}

const canvas3D = document.createElement('canvas');
canvas3D.width = 500;
canvas3D.height = 500;
document.body.appendChild(canvas3D);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  canvas3D.width / canvas3D.height,
  0.1,
  1000,
);
const renderer = new THREE.WebGLRenderer({ canvas: canvas3D });
renderer.setSize(canvas3D.width, canvas3D.height);

const controls = new OrbitControls(camera, renderer.domElement);
camera.position.z = 5;

function traceBorders(imageSrc: string) {
  const img = new Image();
  img.onload = () => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      console.error('Could not get temp 2D context');
      return;
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

    const scaleFactor = 500 / Math.max(img.width, img.height);

    function animate2D() {
      if (!ctx2D) return;
      ctx2D.clearRect(0, 0, canvas2D.width, canvas2D.height);
      ctx2D.beginPath();
      outline.forEach(([x, y], i) => {
        if (i === 0) ctx2D.moveTo(x * scaleFactor, y * scaleFactor);
        else ctx2D.lineTo(x * scaleFactor, y * scaleFactor);
      });
      ctx2D.closePath();
      ctx2D.strokeStyle = 'black';
      ctx2D.lineWidth = 2;
      ctx2D.stroke();

      requestAnimationFrame(animate2D);
    }

    animate2D();

    // Create 3D geometry
    const shape = new THREE.Shape();
    outline.forEach(([x, y], i) => {
      if (i === 0) shape.moveTo(x / img.width - 0.5, -y / img.height + 0.5);
      else shape.lineTo(x / img.width - 0.5, -y / img.height + 0.5);
    });

    const extrudeSettings = {
      steps: 1,
      depth: 0.1,
      bevelEnabled: false,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Calculate and set UV coordinates
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

    // Create texture from the original image
    const texture = new THREE.TextureLoader().load(
      imageSrc,
      (loadedTexture) => {
        loadedTexture.minFilter = THREE.LinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        loadedTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        loadedTexture.needsUpdate = true;
      },
    );
    texture.flipY = false; // Flip the texture vertically
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide, // Render both sides of the geometry
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Increase renderer pixel ratio
    renderer.setPixelRatio(window.devicePixelRatio);

    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(0, 0, 10);
    scene.add(light);

    function animate3D() {
      requestAnimationFrame(animate3D);
      controls.update();
      renderer.render(scene, camera);
    }

    animate3D();
  };
  img.src = imageSrc;
}

// Usage
traceBorders('/sword.png');
