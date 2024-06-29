import * as THREE from 'three';

let ExtrudedImageOptions =  {
  thickness: 1,
  size: 1,
  alphaThreshold: .5,
  materialParams: {
    color:'red'
  },
  customMaterial:THREE.MeshStandardMaterial
}



class ExtrudedImage extends THREE.Object3D {
  options;
  mesh//: THREE.Mesh;
  material//: THREE.Material;

  constructor(img, options) {
    super();
    this.options = options;
    this.generateMesh(img);
  }

   generateMesh(img) {
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

    const pixel = (x, y) => {
      const i = (y * width + x) * 4;
      return imageData.data.slice(i, i + 4);
    };
    const isSolid = (x, y) => {
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

    const pushFace = (x1, y1, x2, y2) => {
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

}


export {ExtrudedImageOptions , ExtrudedImage};