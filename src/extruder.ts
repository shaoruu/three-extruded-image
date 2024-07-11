import * as THREE from 'three';

export interface ExtrudedImageOptions {
  thickness: number;
  size: number;
  alphaThreshold: number;
  materialParams?: {
    color?: THREE.ColorRepresentation;
  };
  customMaterial?: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
  legacy?: boolean;
}

export class ExtrudedImage extends THREE.Object3D {
  private options: ExtrudedImageOptions;

  public mesh: THREE.Mesh | null = null;
  public geometry: THREE.BufferGeometry | null = null;
  public material: THREE.Material | null = null;

  constructor(img: HTMLImageElement, options: ExtrudedImageOptions) {
    super();
    this.options = options;
    if (options.legacy) {
      this.generateMeshLegacy(img);
    } else {
      this.generateMesh(img);
    }
  }

  private generateMesh(img: HTMLImageElement): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      console.error('Could not get 2D context');
      return;
    }

    const width = img.width;
    const height = img.height;

    canvas.width = width;
    canvas.height = height;

    context.drawImage(img, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);

    const pixel = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      return imageData.data.slice(i, i + 4);
    };
    const isSolid = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      return pixel(x, y)[3] >= this.options.alphaThreshold;
    };

    const vts = [];
    const uvs = [];
    const indices = [];
    const d2 = this.options.thickness / 2;
    const w = width;
    const h = height;
    const sx = 1 / w;
    const sy = 1 / h;

    // single front and back face
    let vt = 0;
    vts.push(0, 0, d2, w, 0, d2, w, h, d2, 0, h, d2);
    vts.push(0, 0, -d2, w, 0, -d2, w, h, -d2, 0, h, -d2);
    uvs.push(0, 0, w, 0, w, h, 0, h, 0, 0, w, 0, w, h, 0, h);
    indices.push(0, 1, 2, 2, 3, 0, 4, 7, 6, 6, 5, 4);
    vt += 8;

    const pushFace = (x1: number, y1: number, x2: number, y2: number) => {
      vts.push(x1, y1, -d2, x2, y2, -d2, x2, y2, d2, x1, y1, d2);

      let ux = Math.min(x1, x2);
      let uy = Math.min(y1, y2);

      ux += y1 < y2 ? -0.5 : 0.5;
      uy += x2 < x1 ? -0.5 : 0.5;

      uvs.push(ux, uy, ux, uy, ux, uy, ux, uy);
      indices.push(vt + 0, vt + 1, vt + 2, vt + 2, vt + 3, vt + 0);
      vt += 4;
    };

    for (let y = -1; y <= h; y++)
      for (let x = -1; x <= w; x++) {
        let left = isSolid(x, y);
        let right = isSolid(x - 1, y);
        let top = isSolid(x, y - 1);
        let bottom = isSolid(x, y);
        if (!left && right) pushFace(x, y, x, y + 1);
        if (left && !right) pushFace(x, y + 1, x, y);
        if (top && !bottom) pushFace(x + 1, y, x, y);
        if (!top && bottom) pushFace(x, y, x + 1, y);
      }

    let g = new THREE.BufferGeometry();
    for (let i = 0; i < uvs.length; i += 2) {
      uvs[i] *= sx;
      uvs[i + 1] *= sy;
    }
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(vts), 3),
    );
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    g.setIndex(indices);
    g.computeVertexNormals();

    let s = Math.max(sx, sy);
    g.center();
    g.scale(s, s, 1);
    g.rotateX(-Math.PI);

    const texture = new THREE.TextureLoader().load(img.src);
    texture.flipY = false;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;

    if (this.options.customMaterial) {
      this.material = this.options.customMaterial;
      // @ts-ignore
      this.material.map = texture;
    } else {
      this.material = new THREE.MeshStandardMaterial({
        map: texture,
        // transparent: true,
        alphaTest: this.options.alphaThreshold / 255,
      });
    }

    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.scale.set(this.options.size, this.options.size, 1);
    this.add(this.mesh);
  }

  getMaterial(): THREE.Material | null {
    return this.material;
  }

  private generateMeshLegacy(img: HTMLImageElement): void {
    const outlineData = this.traceOutline(img);
    const geometry = this.createGeometry(img, outlineData);
    const texture = this.createTexture(img);

    this.geometry = geometry;
    if (this.material instanceof THREE.Material) {
      (this.material as any).map = texture;
    }

    if (this.options.customMaterial) {
      this.material = this.options.customMaterial;
      // @ts-ignore
      this.material.map = texture;
    } else {
      this.material = new THREE.MeshStandardMaterial({
        map: texture,
      });
    }

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.add(this.mesh);
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

    tempCtx.imageSmoothingEnabled = false;
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
          data[((y - 1) * img.width + x) * 4 + 3] < threshold ||
          data[((y + 1) * img.width + x) * 4 + 3] < threshold ||
          data[(y * img.width + x - 1) * 4 + 3] < threshold ||
          data[(y * img.width + x + 1) * 4 + 3] < threshold)
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
        for (let i = 0; i < directions.length; i++) {
          const newDir = (dir + i) % directions.length;
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
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    outline.forEach(([x, y], i) => {
      const method = i === 0 ? 'moveTo' : 'lineTo';
      const normalizedX = (x - bounds.minX) / width;
      const normalizedY = (y - bounds.minY) / height;
      shape[method](
        (normalizedX - 0.5) * this.options.size,
        (0.5 - normalizedY) * this.options.size,
      );
    });

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: this.options.thickness,
      bevelEnabled: false,
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
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);

      let u, v;

      if (Math.abs(z) < 0.001 || Math.abs(z - this.options.thickness) < 0.001) {
        // Front and back faces
        u = (x - bbox.min.x) / (bbox.max.x - bbox.min.x);
        v = 1 - (y - bbox.min.y) / (bbox.max.y - bbox.min.y);
      } else {
        // Side faces
        const angle = Math.atan2(y, x);
        u = (angle + Math.PI) / (2 * Math.PI);
        v = z / this.options.thickness;
      }

      // map u and v to the actual image content
      const mappedU = bounds.minX / img.width + (u * imgWidth) / img.width;
      const mappedV = bounds.minY / img.height + (v * imgHeight) / img.height;

      uvs.setXY(i, mappedU, mappedV);
    }

    geometry.attributes.uv.needsUpdate = true;
  }

  private createTexture(img: HTMLImageElement): THREE.Texture {
    const texture = new THREE.TextureLoader().load(img.src);
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    return texture;
  }
}
