import * as THREE from 'three';

export interface ExtrudedImageOptions {
  thickness: number;
  size: number;
  alphaThreshold: number;
  materialParams?: {
    color?: THREE.ColorRepresentation;
  };
  customMaterial?: THREE.Material;
}

export class ExtrudedImage extends THREE.Object3D {
  private options: ExtrudedImageOptions;
  private instancedMesh: THREE.InstancedMesh | null = null;
  public material: THREE.Material | null = null;

  constructor(img: HTMLImageElement, options: ExtrudedImageOptions) {
    super();
    this.options = options;
    this.generateMesh(img);
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

    const aspectRatio = width / height;
    const pixelSize = this.options.size / Math.max(width, height);
    const scaleFactor =
      this.options.size / Math.max(width * pixelSize, height * pixelSize);

    const geometry = new THREE.BoxGeometry(
      pixelSize,
      pixelSize,
      this.options.thickness,
    );
    geometry.translate(0, 0, this.options.thickness / 2); // Center the geometry

    let material: THREE.Material;
    if (this.options.customMaterial) {
      material = this.options.customMaterial;
    } else {
      material = new THREE.MeshBasicMaterial({
        ...this.options.materialParams,
        transparent: true,
      });
      if ('map' in material && material.map) {
        // @ts-ignore
        material.map.colorSpace = THREE.SRGBColorSpace;
      }
    }
    this.material = material;

    const count = width * height;
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    this.add(this.instancedMesh);

    this.instancedMesh.scale.set(scaleFactor, scaleFactor, 1);
    this.instancedMesh.position.set(
      aspectRatio >= 1 ? 0 : (-this.options.size * (1 - aspectRatio)) / 2,
      aspectRatio < 1 ? 0 : (this.options.size * (1 - 1 / aspectRatio)) / 2,
      0, // Remove z-offset
    );

    let index = 0;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const color = new THREE.Color();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];

        if (a >= this.options.alphaThreshold) {
          color.setRGB(r / 255, g / 255, b / 255);
          const srgb = color.convertSRGBToLinear();

          position.x = x * pixelSize - (width * pixelSize) / 2;
          position.y = -y * pixelSize + (height * pixelSize) / 2;
          matrix.setPosition(position);
          this.instancedMesh.setMatrixAt(index, matrix);
          this.instancedMesh.setColorAt(index, srgb);

          index++;
        }
      }
    }

    this.instancedMesh.count = index;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  getMaterial(): THREE.Material | null {
    return this.material;
  }
}
