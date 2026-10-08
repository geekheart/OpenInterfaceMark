[简体中文](README.md) | English

<div align="center">
  <h1>OpenInterfaceMark</h1>
  <p><strong>Image region and interface annotations in your browser</strong></p>
  <p>Mark regions · Adjust leaders · Label details · Download annotated images</p>
  <p>
    <a href="https://geekheart.github.io/OpenInterfaceMark/?lang=en"><strong>Open the workspace →</strong></a>
    &nbsp; · &nbsp;
    <a href="#quick-start">Run locally</a>
    &nbsp; · &nbsp;
    <a href="#deployment-and-releases">Deployment and releases</a>
  </p>
  <p><code>Client-side</code> &nbsp; <code>Draggable leaders</code> &nbsp; <code>Local fonts</code> &nbsp; <code>PNG / JPG / SVG</code></p>
</div>

![OpenInterfaceMark workspace: regions on the left, draggable annotations in the center, and label properties on the right; screenshot shown in Chinese](docs/images/overview.png)

Import an image, draw rectangles or ellipses around the areas you want to describe, and position their identifiers and labels outside the regions. Use it for board interface diagrams, device component descriptions and general image annotations. The interface follows the light and green colors of [OpenBoxHub](https://github.com/geekheart/OpenBoxHub).

The workspace opens ready to edit, with a board image and six example annotations. Those regions were positioned approximately by hand and can be refined; the tool does not automatically identify interfaces or fill in labels.

The interface defaults to Simplified Chinese. Use the language selector to switch between **简体中文 / English**, or open the site with `?lang=en` for English. Switching changes interface text while preserving the current design, custom labels and project data. The GitHub icon opens the source repository.

Image processing, font loading and file generation run entirely in the browser. There is no upload API, account, database or online font service. Save and restore projects with JSON files. The application does not store designs in localStorage, sessionStorage or IndexedDB; refreshing returns to the example.

## Features

| Feature | Description |
| --- | --- |
| Region annotations | Draw rectangles or ellipses, move them, resize with eight handles, and duplicate or delete regions |
| Label styles | Set identifiers, names, font sizes, text and border colors, line widths, corner radii and leader styles |
| Draggable leaders | Move labels, circular anchor points and diamond bend handles, or drag a dashed leader directly; use direction presets or restore automatic leaders |
| Alignment assistance | Snap while dragging and display horizontal/vertical guides; hold Alt to temporarily disable snapping |
| Local fonts | Start with the system sans-serif font, or load your own TTF, OTF, WOFF or WOFF2 file |
| Image transforms | Scale images down proportionally and rotate to any supported angle or in 90° steps; regions follow the image while text stays horizontal |
| Canvas navigation | Pan with the right or middle mouse button, or Space + left drag; zoom with the wheel, nudge with the keyboard, and undo/redo edits |
| Image export | PNG, JPG and SVG, transparent or white backgrounds, with linked percentage/width/height controls that only scale down |
| Project files | Download and import JSON containing the original image, regions, labels, local fonts, image transforms and export settings |

## From image to annotation

1. Choose **Import image**, or drag in or paste a PNG, JPEG or WebP image.
2. Select the rectangle or ellipse tool, then hold the left mouse button and drag to draw a region.
3. Enter its identifier and label name in the properties panel and adjust the style. Load a local font when needed.
4. Move the region and its resize handles to refine the selection. Position the label, then drag the circular anchor, diamond handle or dashed line to adjust the leader.
5. Export the annotated image. Before leaving, download a JSON project file so you can continue editing later.

Annotations use original-image pixel coordinates. Preview zoom and pan do not change project coordinates or exported content. Regions stay within the image; labels can sit outside it, and the export includes those labels and their leaders.

The image size and rotation dialog at the lower left supports **5%–100%** proportional scaling, **−180°–180°** rotation and 90° shortcuts. Transforms preserve the original image rather than repeatedly resampling it. Undo a change or restore the original size and orientation as needed. When the image scales down, annotations scale with it and label text remains horizontal.

## Fonts and exports

The default font uses the system's available sans-serif fonts. After loading local fonts, choose a font for each region; missing characters fall back to system fonts. Font files are not uploaded. Project JSON includes loaded font data, which is validated and loaded before an imported project replaces the current one.

![Export dialog with PNG, JPG and SVG options, background settings and proportional output dimensions; screenshot shown in Chinese](docs/images/export.png)

| Format | Background | Content |
| --- | --- | --- |
| PNG | Transparent or white | A browser-generated raster image for documents and presentations |
| JPG | White | A browser-generated raster image encoded at 92% quality |
| SVG | Transparent or white | The original image and used local fonts are embedded; borders, leaders and text remain vectors |

Transparent mode removes only the canvas background. **It does not remove white pixels from the original photograph.** Exports exclude editing handles, alignment guides and the preview checkerboard. The original image inside an SVG remains a bitmap. Default system fonts depend on the device used to open the file; use embedded local fonts or a raster format to preserve the current text appearance.

Export percentage, width and height remain linked to the same aspect ratio, and **only scaling down is allowed**. PNG/JPG exports exceeding **32 million pixels** or **16,000 px on either side** are reduced proportionally again; the dialog shows the actual output dimensions. SVG preserves vector annotations but does not add pixel detail to the embedded image.

## Save and restore projects

Download an `.oim.json` project file to restore the original image, every annotation, local fonts, image scale and rotation, and export background and scale later. JSON is the editable project format; exported PNG, JPG and SVG files do not replace it.

When replacing an unsaved project, you can cancel, save first or replace directly. Import validates the structure, actual decoded image dimensions and fonts before replacing the current project in one operation. Failed imports leave the current design intact.

Download any project you want to keep before refreshing or leaving. Undo history exists only in the current page and is not stored in the project file.

## Keyboard and mouse shortcuts

![Shortcut help covering tools, right-button pan, undo/redo, duplication and project download; screenshot shown in Chinese](docs/images/shortcuts.png)

| Action | Shortcut |
| --- | --- |
| Select / rectangle / ellipse / pan | V / R / E / H |
| Temporary pan | Right-button or middle-button drag, or Space + left-button drag |
| Zoom / fit canvas | Wheel, + / −, or the lower-right controls / 0 |
| Nudge the selected region | Arrow keys; hold Shift to move 10 px at a time |
| Undo | Ctrl / ⌘ + Z |
| Redo | Ctrl / ⌘ + Shift + Z, or Ctrl / ⌘ + Y |
| Duplicate selected region | Ctrl / ⌘ + D |
| Download project JSON | Ctrl / ⌘ + S |
| Delete region | Delete or Backspace |
| Cancel the current drawing or drag | Escape |
| Shortcut help | ? or the shortcut button at the lower left |

Text fields retain native editing shortcuts. Click the canvas to apply shortcuts to annotations. Right-button panning preserves the current tool and selection. Canvas pan and preview zoom do not enter undo history. Undoing an ordinary annotation edit preserves the current view; undoing an image scale or rotation change fits the canvas again. During a drag, Undo first cancels that drag; press it again to undo the previous committed edit.

## Quick start

Use **Node.js 24** and **pnpm 11.19.0**. There are no runtime or development dependencies. Frozen-lockfile installation keeps local and Actions workflows consistent.

```bash
git clone https://github.com/geekheart/OpenInterfaceMark.git
cd OpenInterfaceMark
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm dev --port 5180
```

Open the [local workspace](http://127.0.0.1:5180/?lang=en) shown by the terminal. You can also start it directly with `node scripts/serve.mjs --port 5180`.

```bash
pnpm test
pnpm build
pnpm preview --port 4180
```

Use the [production-build preview](http://127.0.0.1:4180/OpenInterfaceMark/?lang=en) to verify the repository subpath as well. `dist/` contains the complete static site and can be hosted by an HTTP static server. Browser ES modules require HTTP; do not open the HTML directly through `file://`.

## Deployment and releases

Repository: [geekheart/OpenInterfaceMark](https://github.com/geekheart/OpenInterfaceMark). Online workspace: [geekheart.github.io/OpenInterfaceMark](https://geekheart.github.io/OpenInterfaceMark/?lang=en).

In repository **Settings → Pages**, set Source to **GitHub Actions**. The `github-pages` environment must permit deployments from `main` and release tags. Resources use relative URLs to support repository subpaths such as `/OpenInterfaceMark/`.

### Routine deployment

[pages.yml](.github/workflows/pages.yml) installs locked dependencies, tests, builds and deploys `dist/` when `main` receives a push. Pull requests run validation only. You can also select this workflow in Actions and run it manually from `main`.

### Versioned releases

[release.yml](.github/workflows/release.yml) handles tagged releases. For **V1.0.2**, set the `package.json` version to `1.0.2`, write the [release notes](docs/releases/1.0.2.md), and commit the intended release to `main`. In Actions, choose the **Release** workflow, run it on `main`, and enter `V1.0.2` as the `tag` input.

Alternatively, push a `v*` or `V*` tag:

```bash
git tag V1.0.2
git push origin V1.0.2
```

Choose one trigger method. The tag must be `v` or `V` followed by a three-part stable version matching `package.json`, and its commit must contain the release workflow and `docs/releases/{version}.md`. The workflow stops if the existing tag points to a different commit or a Release already exists for that version. Use a new version number for subsequent releases.

The Release workflow tests and builds first, deploys that same `dist/` to Pages, and then creates a GitHub Release after deployment succeeds. It attaches:

- `OpenInterfaceMark-V1.0.2-site.zip`: the static site, with `index.html`, `src/`, `public/` and `version.json` at the archive root.
- `SHA256SUMS.txt`: the SHA-256 checksum of the site archive.

Other versions use their respective tag names. GitHub also provides source archives for that tag. Routine deployments and versioned releases share a production concurrency group to avoid simultaneous writes to the site.

After publishing, verify the Actions result, Release attachments, live page, and the version, commit and tag in `version.json`. Creating a local tag, finishing a build or uploading an artifact alone does not establish that deployment is complete.

## Project format and limits

Project JSON uses `format: "open-interface-mark"` and `version: 1`. The image is embedded as a data URL. Regions contain stable IDs, shapes, original-image pixel rectangles, identifiers, names, label positions, leader anchors/bends and styles. Import accepts only defined fields and validates finite numbers, ranges, unique IDs and font references. Interface language does not translate custom data or change the JSON field names.

| Item | Limit |
| --- | --- |
| Input image | PNG / JPEG / WebP; up to 32 MB, 64 million pixels and 16,000 px per side |
| Project JSON | Up to 160 MB and 300 regions |
| Annotation text | Up to 40 characters per identifier and 160 per label name |
| Local fonts | Up to 8 fonts, 32 MB each, and approximately 64 MB combined |
| Undo history | The most recent 80 annotation and image-transform edits |

The browser measures label bounds using the actual font and reserves enough export space for text and leaders. Browsers supporting WebMCP can also call `list_annotations` / `update_annotation`, sharing validation, state and undo records with the visible interface. Ordinary editing works without WebMCP support.

## Structure and verification

| File | Responsibility |
| --- | --- |
| `index.html` | Workspace, property panels and dialogs |
| `src/app.js` | Interface, mouse/keyboard gestures, file import/export, fonts and undo history |
| `src/i18n.js` | Chinese/English interface messages and translation bindings |
| `src/core.js` | Coordinate transforms, region bounds, leaders, SVG and project validation |
| `src/styles.css` | Three-column desktop workspace, narrow layouts and light green colors |
| `scripts/serve.mjs` / `scripts/build.mjs` | Dependency-free HTTP server and static build |
| `tests/core.test.mjs` | Coordinates, leaders, image transforms, project round trips and SVG export regressions |
| `tests/interaction.test.mjs` | Keyboard and pointer regressions that execute the real event handlers in Node VM |

Interaction tests use lightweight DOM, pointer-capture and coordinate-matrix substitutes. They do not replace real browser interaction or inspection of downloaded files. See the [verification record](docs/verification.md) for browser coverage and limitations, and [AGENTS.md](AGENTS.md) for development and release conventions.

## License

Project code and original documentation use the [MIT License](LICENSE), Copyright (c) 2026 geekheart. Third-party licenses and the ownership of product photographs, device marks and trademarks remain with their respective owners. MIT does not grant additional image or trademark rights for those materials.
