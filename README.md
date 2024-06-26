
<div align="center">

# `three-extruded-image`

Given a transparent background `*.png`, construct a [ThreeJS](https://threejs.org) mesh of that image, extruded. 

![NPM Version](https://img.shields.io/npm/v/three-extruded-image)

![](/assets/demo.png)

</div>

# Installation

```bash
pnpm install three-extruded-image
```

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

2. Doesn't work on images that are split into multiple parts.

![](/assets/bug2.png)

# Todos

- [ ] Fix the above issues
- [ ] Add more controls to demonstrate the library (such as bevel, which is already supported)
- [ ] Add tests (?)

> [!NOTE]
> This library is in serving of [Voxelize](https://github.com/voxelize/voxelize), a fullstack voxel engine. Although basic needs is met, there is still some work needed to make it perfect, any PRs are welcomed! 
