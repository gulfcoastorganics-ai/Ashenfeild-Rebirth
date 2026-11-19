# Ashford asset manifest

All Poly Haven resources below use [CC0 1.0](https://polyhaven.com/license). Attribution is optional and recorded here for provenance.

Sizes are in bytes. Source sizes refer to the 1K downloads, before resizing and encoding.

## Worn pine

[Poly Haven asset](https://polyhaven.com/a/wood_floor_worn) · Dimitrios Savva · Safehouse floor and millwork

| Component | Source download | Original | Runtime file | Runtime |
| --- | --- | ---: | --- | ---: |
| color | [Download](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_floor_worn/wood_floor_worn_diff_1k.jpg) | 629,271 | `assets/surfaces/wood_floor_worn-color.webp` | 17,826 |
| normal | [Download](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_floor_worn/wood_floor_worn_nor_gl_1k.jpg) | 636,603 | `assets/surfaces/wood_floor_worn-normal.webp` | 10,944 |
| rough | [Download](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_floor_worn/wood_floor_worn_rough_1k.jpg) | 290,570 | `assets/surfaces/wood_floor_worn-rough.webp` | 716 |

## Asphalt 02

[Poly Haven asset](https://polyhaven.com/a/asphalt_02) · Rob Tuytel · Patrol road and main street

| Component | Source download | Original | Runtime file | Runtime |
| --- | --- | ---: | --- | ---: |
| color | [Download](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt_02/asphalt_02_diff_1k.jpg) | 731,707 | `assets/surfaces/asphalt_02-color.webp` | 86,546 |
| normal | [Download](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt_02/asphalt_02_nor_gl_1k.jpg) | 1,240,122 | `assets/surfaces/asphalt_02-normal.webp` | 82,720 |
| rough | [Download](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt_02/asphalt_02_rough_1k.jpg) | 544,032 | `assets/surfaces/asphalt_02-rough.webp` | 10,514 |

## Interior Tiles

[Poly Haven asset](https://polyhaven.com/a/interior_tiles) · Charlotte Baglioni · Market and clinic floors

| Component | Source download | Original | Runtime file | Runtime |
| --- | --- | ---: | --- | ---: |
| color | [Download](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/interior_tiles/interior_tiles_diff_1k.jpg) | 694,562 | `assets/surfaces/interior_tiles-color.webp` | 18,800 |
| normal | [Download](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/interior_tiles/interior_tiles_nor_gl_1k.jpg) | 414,639 | `assets/surfaces/interior_tiles-normal.webp` | 7,412 |
| rough | [Download](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/interior_tiles/interior_tiles_rough_1k.jpg) | 521,038 | `assets/surfaces/interior_tiles-rough.webp` | 3,268 |

## Painted Plaster Wall

[Poly Haven asset](https://polyhaven.com/a/painted_plaster_wall) · Amal Kumar · Safehouse, market and clinic walls

| Component | Source download | Original | Runtime file | Runtime |
| --- | --- | ---: | --- | ---: |
| color | [Download](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/painted_plaster_wall/painted_plaster_wall_diff_1k.jpg) | 686,726 | `assets/surfaces/painted_plaster_wall-color.webp` | 12,726 |
| normal | [Download](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/painted_plaster_wall/painted_plaster_wall_nor_gl_1k.jpg) | 900,461 | `assets/surfaces/painted_plaster_wall-normal.webp` | 22,188 |
| rough | [Download](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/painted_plaster_wall/painted_plaster_wall_rough_1k.jpg) | 354,762 | `assets/surfaces/painted_plaster_wall-rough.webp` | 288 |

## Shelf 01

[Poly Haven asset](https://polyhaven.com/a/Shelf_01) · Gabriel Radić · Market rear display

| Component | Source download | Original | Runtime file | Runtime |
| --- | --- | ---: | --- | ---: |
| GLB component | [Download](https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/Shelf_01/Shelf_01_1k.gltf) | 2,617 | `assets/market-shelf.glb` | 83,592 |
| GLB component | [Download](https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/Shelf_01/Shelf_01_diff_1k.jpg) | 153,220 | `assets/market-shelf.glb` | 83,592 |
| GLB component | [Download](https://dl.polyhaven.org/file/ph-assets/Models/gltf/4k/Shelf_01/Shelf_01.bin) | 12,676 | `assets/market-shelf.glb` | 83,592 |
| GLB component | [Download](https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/Shelf_01/Shelf_01_nor_gl_1k.jpg) | 231,393 | `assets/market-shelf.glb` | 83,592 |
| GLB component | [Download](https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/Shelf_01/Shelf_01_arm_1k.jpg) | 205,542 | `assets/market-shelf.glb` | 83,592 |

Shelf geometry and UVs are unchanged. Its compressed JPEG materials are embedded in one GLB. The table repeats the total output size for each upstream component.

## Loading code

`src/vendor/loaders/GLTFLoader.js` and `src/vendor/utils/BufferGeometryUtils.js` are unmodified [Three.js r160.1](https://github.com/mrdoob/three.js/tree/r160.1/examples/jsm) add-ons. The three.js authors’ MIT notice is in `src/vendor/THREE-LICENSE.txt`.
