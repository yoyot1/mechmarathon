# SVG Tile Assets

Vector tile graphics for the board renderer. Each SVG file is processed by
`pnpm extract-tiles` into path data that PixiJS renders as scalable vectors.

## Quick Start

1. Design a tile in Figma, Inkscape, or any SVG editor
2. Export as Plain SVG to this directory
3. Name the file `<tile_type>.svg` (see table below)
4. Run `pnpm extract-tiles`
5. Reload the app — the tile now renders as a vector graphic

## SVG Design Guidelines

| Property       | Guideline                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| **ViewBox**    | Any size; 300x300 is the reference "full tile" size. Smaller viewBoxes are auto-centered.                      |
| **Background** | Transparent. The compositing system draws a floor tile underneath most types.                                  |
| **Direction**  | Draw the **north-facing** version only. The app rotates for east/south/west.                                   |
| **Colors**     | Solid fills recommended. Gradients (`linearGradient`, `radialGradient`) are supported.                         |
| **Shapes**     | `<path>`, `<rect>`, `<circle>`, `<ellipse>`, `<polygon>`, `<polyline>`, `<line>` are all extracted.            |
| **Groups**     | `<g>` transforms (`translate`, `rotate`, `scale`, `matrix`) are resolved and baked into paths.                 |
| **Export**     | Plain SVG. Avoid embedded images or CSS `<style>` blocks. See export instructions per tool below.              |

### Export Settings by Tool

**Affinity Designer:** File > Export > SVG. Set Rasterize to "Nothing", check
"Flatten transforms" and "Set viewBox". Use hex colors. Don't embed images.

**Figma:** Default SVG export works. Use "Outline text" if you have text elements.

**Inkscape:** File > Save As > Plain SVG (not Inkscape SVG, which adds editor metadata).

## File Naming

The filename (minus `.svg`) becomes the key in the generated `tile-paths.js`.
The key must match the tile type used in the game engine.

### Static Tiles (non-directional)

| Filename                | Tile Type           | Notes                                                   |
| ----------------------- | ------------------- | ------------------------------------------------------- |
| `floor.svg`             | `floor`             | Base tile. No floor drawn underneath (it IS the floor). |
| `pit.svg`               | `pit`               | No floor underneath.                                    |
| `trap_pit.svg`          | `trap_pit`          | No floor underneath. Phase-activated pit.               |
| `drain.svg`             | `drain`             | No floor underneath.                                    |
| `radioactive_drain.svg` | `radioactive_drain` | No floor underneath.                                    |
| `gear_cw.svg`           | `gear` (variant: cw) | Clockwise gear.                                        |
| `gear_ccw.svg`          | `gear` (variant: ccw)| Counter-clockwise gear.                                |
| `repair.svg`            | `repair`            | Repair/archive site.                                    |
| `spawn.svg`             | `spawn`             | Robot spawn point.                                      |
| `oil_slick.svg`         | `oil_slick`         | Slippery tile.                                          |
| `water.svg`             | `water`             | Water tile (slows movement).                            |
| `portal.svg`            | `portal`            | Teleport between paired portals.                        |
| `teleporter.svg`        | `teleporter`        | Movement bonus tile.                                    |
| `randomizer.svg`        | `randomizer`        | Random direction tile.                                  |
| `radiation.svg`         | `radiation`         | Radiation zone.                                         |
| `radioactive_waste.svg` | `radioactive_waste` | Draws option card.                                      |
| `chop_shop.svg`         | `chop_shop`         | Upgrade shop tile.                                      |

### Directional Tiles (rotated by `tile.direction`)

Draw these facing **north**. The renderer rotates for other directions.

| Filename      | Tile Type | Notes                             |
| ------------- | --------- | --------------------------------- |
| `current.svg` | `current` | Water current (directional push). |
| `ramp.svg`    | `ramp`    | Elevation ramp.                   |
| `ledge.svg`   | `ledge`   | Elevation ledge/drop-off.         |

### Conveyor Tiles

Conveyors are more complex because they have multiple visual variants
(straight, curve, merge) derived from the tile's `entry` and `direction` properties.

#### Straight Conveyors

Draw these facing **north** (arrows pointing up). The renderer rotates for other directions.

| Filename                | Description                     |
| ----------------------- | ------------------------------- |
| `conveyor_straight.svg` | Regular conveyor, single arrow  |
| `express_straight.svg`  | Express conveyor, double arrows |

#### Curved Conveyors

A curve SVG depicts a 90-degree turn. Draw the **canonical direction**
(default: entry from south, exit to west — a right turn). The renderer
handles all 8 curve orientations via rotation (4) and mirroring (4).

| Filename             | Description             |
| -------------------- | ----------------------- |
| `conveyor_curve.svg` | Regular curved conveyor |
| `express_curve.svg`  | Express curved conveyor |

**Canonical curve direction:** Regular and express curves have separate
canonical settings. The defaults assume entry=south, exit=west for both.
If you draw a different orientation, update the constants at the top
of `conveyor-paths.js`:

```js
const CONVEYOR_CURVE_CANONICAL = { entry: "south", exit: "west" };
const EXPRESS_CURVE_CANONICAL = { entry: "south", exit: "west" };
```

**How mirroring works:** Your SVG covers one turn chirality (e.g., all
"right turns"). The renderer automatically mirrors it horizontally to
produce the opposite chirality (all "left turns"), then rotates both
to cover all 8 possible entry→exit combinations.

#### Merge Conveyors

Merges have multiple entry directions converging to one exit.

**`2curve` merges** are symmetric (curves from both perpendicular sides).
Draw with **exit facing north**. The renderer rotates for other exits (4 orientations).

**`curve_straight` merges** have a curve from one side and a straight-through
from the opposite side. Draw with **exit facing north** and **curve entering
from east** (default). The renderer handles all 8 orientations via rotation
(4) and mirroring (4, for when the curve enters from the other side).

**Canonical merge settings:** Update in `conveyor-paths.js` if your SVGs
use different directions:

```js
const CONVEYOR_MERGE_CANONICAL = {
  curve_straight: { exit: "north", curveEntry: "east" },
  "2curve": { exit: "north" },
};
const EXPRESS_MERGE_CANONICAL = {
  curve_straight: { exit: "north", curveEntry: "east" },
  "2curve": { exit: "north" },
};
```

| Filename                            | Description                                                      |
| ----------------------------------- | ---------------------------------------------------------------- |
| `conveyor_merge_curve_straight.svg` | Curve from east + straight from south, exit north                |
| `conveyor_merge_2curve.svg`         | Two curve entries (from east and west), exit north               |
| `conveyor_merge.svg`                | Generic fallback merge (used if specific variant missing)        |
| `express_merge_curve_straight.svg`  | Express version of curve+straight merge                          |
| `express_merge_2curve.svg`          | Express version of 2-curve merge                                 |
| `express_merge.svg`                 | Express generic fallback merge                                   |

**How `curve_straight` mirroring works:** Your SVG shows the curve entering
from one side (e.g. east). When the actual tile has the curve entering from
the opposite side (west), the renderer mirrors the SVG horizontally, then
rotates to the correct exit direction — just like how curve tiles work.

**Note:** 3-entry merges (entries from south, east, and west with exit north)
are not currently planned. If encountered, they fall back to the procedural renderer.

## Base Tiles vs. Overlay Tiles

Most tiles are drawn on top of a floor base. The following tile types are
**base tiles** — no floor is drawn underneath them:

- `floor`, `pit`, `trap_pit`, `drain`, `radioactive_drain`

All other tiles get a floor rendered first, then the tile on top. Design
your SVGs with a transparent background (the floor will show through any
gaps).

## Extraction Script Details

`pnpm extract-tiles` runs `scripts/extract-svg-paths.js`, which:

1. Reads all `.svg` files from this directory
2. Parses XML, extracts shapes in document order (back-to-front)
3. Resolves `<g>` group transforms into absolute coordinates
4. Converts non-path shapes (`<rect>`, `<circle>`, etc.) to path `d` strings
5. Extracts `fill`, `stroke`, `stroke-width`, `opacity`, `fill-opacity`
6. Resolves gradient references (`fill="url(#id)"`)
7. Writes `packages/client/src/lib/board-renderer/tile-paths.js`

The generated file should not be edited manually — rerun the script after
changing any SVG.

## Tiles Without SVGs

Any tile type that doesn't have an SVG file continues to use the fallback
renderer (colored rectangle + unicode symbol). You can add SVGs incrementally.
