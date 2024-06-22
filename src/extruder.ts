import * as THREE from 'three';

export type MaterialType = 'basic' | 'standard' | 'lambert' | 'phong';

export interface ExtrudedImageOptions {
  thickness: number;
  size: number;
  bevelEnabled: boolean;
  bevelThickness?: number;
  bevelSize?: number;
  bevelSegments?: number;
  alphaThreshold: number;
  materialType?: MaterialType;
  materialParams?: {
    color?: THREE.ColorRepresentation;
    metalness?: number;
    roughness?: number;
    emissive?: THREE.ColorRepresentation;
    emissiveIntensity?: number;
    specular?: THREE.ColorRepresentation;
    shininess?: number;
  };
}

export class ExtrudedImage extends THREE.Mesh {
  private options: ExtrudedImageOptions;

  constructor(img: HTMLImageElement, options: ExtrudedImageOptions) {
    const material = ExtrudedImage.createMaterial(options);
    super(new THREE.BufferGeometry(), material);
    this.options = options;
    this.generateMesh(img);
  }

  private generateMesh(img: HTMLImageElement): void {
    const outlineData = this.traceOutline(img);
    const geometry = this.createGeometry(img, outlineData);
    const texture = this.createTexture(img);

    this.geometry = geometry;
    if (this.material instanceof THREE.Material) {
      (this.material as any).map = texture;
    }
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

  private static createMaterial(options: ExtrudedImageOptions): THREE.Material {
    const { materialType = 'basic', materialParams = {} } = options;
    const baseParams = {
      side: THREE.DoubleSide,
      ...materialParams,
    };

    switch (materialType) {
      case 'standard':
        return new THREE.MeshStandardMaterial(baseParams);
      case 'lambert':
        return new THREE.MeshLambertMaterial(baseParams);
      case 'phong':
        return new THREE.MeshPhongMaterial(baseParams);
      case 'basic':
      default:
        return new THREE.MeshBasicMaterial(baseParams);
    }
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
