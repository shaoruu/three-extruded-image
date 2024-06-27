
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
| alphaThreshold | number | The alpha value threshold for determining transparency |
| materialParams? | object | Additional material parameters |
| materialParams.color? | THREE.ColorRepresentation | The color of the material |

# Development

```bash
git clone git@github.com:shaoruu/three-extruded-image.git

cd three-extruded-image
pnpm install

pnpm dev

# visit http://localhost:5173
```
