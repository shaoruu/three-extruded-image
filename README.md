
<div align="center">

# `three-extruded-image`

Given a transparent background `*.png`, construct a [ThreeJS](https://threejs.org) mesh of that image, extruded. 

![NPM Version](https://img.shields.io/npm/v/three-extruded-image)

![](/assets/demo.png)

</div>

> [!NOTE]
> This library is in serving of [Voxelize](https://github.com/voxelize/voxelize), a fullstack voxel engine. Although basic needs is met, there is still some work needed to make it perfect, any PRs are welcomed! 

# Installation

```bash
pnpm install three-extruded-image
```


# Usage

```typescript
import { ExtrudedImage, type ExtrudedImageOptions } from 'three-extruded-image';

const options: ExtrudedImageOptions = {
  thickness: 0.3,
  size: 3,
};
const extrudedImage = new ExtrudedImage(image, options);

scene.add(extrudedImage);
```

| Option | Type | Description |
|--------|------|-------------|
| thickness | number | The depth of the extrusion |
| size | number | The overall size of the extruded image |
| bevelEnabled | boolean | Whether to apply beveling to the edges |
| bevelThickness? | number | The depth of the bevel |
| bevelSize? | number | The distance from the edge that the bevel extends |
| bevelSegments? | number | The number of bevel layers |
| alphaThreshold | number | The alpha value threshold for determining transparency |
| materialType? | MaterialType | The type of material to use ('basic', 'standard', 'lambert', or 'phong') |
| materialParams? | object | Additional material parameters |
| materialParams.color? | THREE.ColorRepresentation | The color of the material |
| materialParams.metalness? | number | The metalness of the material (for standard material) |
| materialParams.roughness? | number | The roughness of the material (for standard material) |
| materialParams.emissive? | THREE.ColorRepresentation | The emissive color of the material |
| materialParams.emissiveIntensity? | number | The intensity of the emissive color |
| materialParams.specular? | THREE.ColorRepresentation | The specular color (for phong material) |
| materialParams.shininess? | number | The shininess of the material (for phong material) |

# Development

```bash
git clone git@github.com:shaoruu/three-extruded-image.git

cd three-extruded-image
pnpm install

pnpm dev

# visit http://localhost:5173
```

# Known Issues

1. Either the outline tracing is off, or UV is off, but texture leak a bit on the edges.

![](/assets/bug1.png)

2. Doesn't work on images that are split into multiple parts. I am currently using an algorithm similar to marching squares to detect the outline, which only works if the image is connected.

![](/assets/bug2.png)

# Todos

- [ ] Fix the above issues
- [ ] Add more controls to demonstrate the library (such as bevel, which is already supported)
- [ ] Add tests (?)
