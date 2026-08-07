# Strata six-state thumbnail production report

Status: **DONE**  
Completed states: **6/6** — Pre-dawn, Sunrise, Daytime, Dusk, Sunset, Night  
Optimized outputs: **12/12**

## Outcome

The complete responsive Strata time-of-day set was produced non-destructively under `images/cs/variants/time/strata/`. The built-in image-generation tool was used only for phone-free environmental background plates. The supplied transparent master was never passed to image generation and was never regenerated, repainted, graded, relit, filtered, sharpened, or retouched. It received one required deterministic geometric downscale before alpha compositing.

All desktop exports are below the 700 KiB target. Desktop RGB PSNR is 39.201–39.999 dB and mobile RGB PSNR is 36.405–37.497 dB versus each corresponding lossless composite. Every encoded file is metadata-free sharp-YUV WebP.

## Output manifest and QA metrics

All files were encoded with `cwebp -m 6 -pass 10 -sharp_yuv -metadata none`. `webpmux -info` reports `No features present` for all 12 files, confirming no EXIF, XMP, ICC, alpha, or animation feature chunks.

| State | Desktop output | Bytes | Quality | RGB PSNR | Mobile output | Bytes | Quality | RGB PSNR |
|---|---|---:|---:|---:|---|---:|---:|---:|
| Pre-dawn | `images/cs/variants/time/strata/pre-dawn-2400.webp` (2400×1784) | 357,822 | 90 | 39.906 dB | `images/cs/variants/time/strata/pre-dawn-1200.webp` (1200×892) | 133,514 | 88 | 37.314 dB |
| Sunrise | `images/cs/variants/time/strata/sunrise-2400.webp` (2400×1784) | 533,206 | 90 | 39.201 dB | `images/cs/variants/time/strata/sunrise-1200.webp` (1200×892) | 201,852 | 88 | 36.405 dB |
| Daytime | `images/cs/variants/time/strata/daytime-2400.webp` (2400×1784) | 504,352 | 90 | 39.363 dB | `images/cs/variants/time/strata/daytime-1200.webp` (1200×892) | 186,302 | 88 | 36.764 dB |
| Dusk | `images/cs/variants/time/strata/dusk-2400.webp` (2400×1784) | 528,924 | 90 | 39.305 dB | `images/cs/variants/time/strata/dusk-1200.webp` (1200×892) | 200,530 | 88 | 36.581 dB |
| Sunset | `images/cs/variants/time/strata/sunset-2400.webp` (2400×1784) | 508,194 | 90 | 39.406 dB | `images/cs/variants/time/strata/sunset-1200.webp` (1200×892) | 183,596 | 88 | 36.569 dB |
| Night | `images/cs/variants/time/strata/night-2400.webp` (2400×1784) | 348,446 | 90 | 39.999 dB | `images/cs/variants/time/strata/night-1200.webp` (1200×892) | 127,034 | 88 | 37.497 dB |

The source plates, reproducible build script, single resized mockup buffer, and machine-readable SHA-256/QA metrics are retained under `images/cs/variants/time/strata/sources/`. Temporary lossless composites were deleted after encoding, PSNR measurement, and invariant validation.

## Pixel-preservation and placement method

- Source mockup: `images/cs/masters/strata-mockups.png`, 3360×1770 RGBA.
- Source master SHA-256: `eed90a8d3b248130fa06b3fd51dea050c8dea4acedec12d7875c96cf68b7cbf1`.
- The established centered placement was recovered from the supplied 1600×1189 Strata reference: resize once to 1800×948 with Pillow Lanczos, then place at `(300, 420)` on the 2400×1784 canvas.
- The exact same decoded/resized RGBA buffer was reused for every state. Each phone-free plate was center cover-fitted to 2400×1784, then the mockup was alpha-composited above it.
- No foreground color transform, environmental grade, light overlay, shadow overlay, contrast operation, denoise, sharpening, generative edit, or paint operation was applied. Environmental lighting exists only in the plate below the master alpha layer.
- Mobile lossless references were downscaled directly from each lossless 2400×1784 composite with Lanczos, then encoded independently at q88. They were not transcoded from desktop WebP.
- The automated invariant checked all 1,594,070 fully opaque pixels in the resized master against all six lossless composites. Every opaque RGB pixel matched the resized master byte-for-byte and therefore matched across all six states. Semi-transparent antialiased edge pixels blend naturally with the underlying plate through standard alpha compositing.

## Visual QA

- Inspected all six 2400×1784 outputs as a full-set contact sheet and inspected representative Daytime and Night exports at full native resolution.
- Inspected a close UI-detail sheet across all four mockups in all six states and inspected Sunrise at native 1200×892.
- Status-bar strokes, small labels, calendar dates, timeline copy, chart figures, legends, card borders, icons, navigation controls, gradient tiles, and rounded mockup edges remain intact without visible ringing or color bleed.
- Mockup dimensions, spacing, baseline, UI content, screen whites, screen blacks, and embedded color treatments are visually identical across states.
- The pastoral scene remains recognizably consistent across all states: matching horizon height, foreground slope, layered field bands, dark tree clusters, distant farmland, grazing-sheep distribution, camera position, and compressed perspective.
- Palette direction is distinct and legible: blue/lavender Pre-dawn; lilac/pink/peach Sunrise; clear blue/white Daytime; powder-blue/amber Dusk; coral/rose/lilac Sunset; indigo/violet Night over near-black.
- No phone, screen, device silhouette, person, new building, road, sign, text, logo, or watermark appears in any environmental source plate.

## Visual concerns

- Generative relighting introduces minor haze, tree, grass, and wool microtexture differences between states. The primary field bands, horizon, sheep positions, camera, and scene identity remain consistent.
- Sunrise, Dusk, and Night were generated at 1456×1080; Daytime, Pre-dawn, and Sunset at 1455×1081. Their centered cover fits trim only a small number of source-edge pixels; the horizon structure and mockup-safe region are unaffected.
- Dense pastoral texture and fine UI detail yield lower PSNR than flatter thumbnail sets, but the measured 39.201–39.999 dB desktop and 36.405–37.497 dB mobile ranges remain visually clean at native size.
- The bright white mockup screens at Night are part of the untouched supplied master. They were intentionally not darkened or relit.
- No blocking visual concern was found.

## Full image-generation prompt list

Built-in image-generation mode was used for all six plates. The transparent mockup master was never supplied to the model.

### Daytime

`Image 1` was `images/cs/strata-cover.webp`, used only as the current composition/edit reference from which all four phones were removed.

```text
Use case: precise-object-edit
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the current Strata thumbnail composition reference and the edit target. It contains four smartphone mockups that must be removed completely.
Primary request: remove all four smartphone mockups and every device edge, shadow, reflection, screen, and UI fragment; reconstruct the occluded environment as one seamless phone-free clear DAYTIME photographic scene. Preserve the exact visible scene identity and composition: the gently sloping green sheep pasture, grazing sheep distribution in the foreground and right side, layered hedgerows and dark tree clusters, distant rolling fields, low hazy horizon, camera position, compressed telephoto perspective, and crop.
Scene/backdrop: broad pastoral field with scattered grazing sheep, layered wooded hedgerows, distant rounded farmland, and softly atmospheric depth; entirely phone-free.
Style/medium: premium photorealistic landscape photography; crisp natural grass and wool texture; restrained editorial realism.
Composition/framing: preserve Image 1’s full 1600:1189 landscape aspect ratio, exact horizon height, field bands, tree masses, foreground slope, sheep scale and positions, and object layout; plausibly continue pasture and distant countryside behind the removed phones. Keep the central region naturally calm enough for later mockup placement.
Lighting/mood: clean mid-morning daylight, bright airy blue sky with delicate pale haze and minimal natural cloud texture, sun outside frame, natural directional illumination, open readable shadows.
Color palette: #0071C1, #60A8E2, #B4D8FF, #F8FAFD, balanced with realistic pasture greens, dark hedgerows, and natural off-white sheep.
Constraints: change only by removing the phones and reconstructing the occluded pastoral environment; preserve visible sheep and landscape landmarks; no phones, screens, devices, device-shaped rectangles, people, new buildings, new roads, signs, text, logos, or watermark.
Avoid: fantasy illustration, neon saturation, artificial smooth gradients, fake HDR, harsh contrast, altered visible horizon, changed field geometry, oversized sheep, new large objects, smeared inpainting.
```

For the five relit states below, `Image 1` was the clean phone-free Daytime plate `images/cs/variants/time/strata/sources/daytime-generated.png`.

### Pre-dawn

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved phone-free Strata pastoral-field background and the edit target.
Primary request: transform only the time-of-day lighting into PRE-DAWN while preserving the exact same grazing sheep positions and poses, foreground green slope, layered field bands, hedgerows, dark tree clusters, distant rolling farmland, low horizon, camera position, compressed telephoto perspective, crop, and object layout as Image 1.
Scene/backdrop: broad pastoral field with scattered grazing sheep, layered wooded hedgerows, and distant rounded farmland; phone-free landscape plate.
Style/medium: premium photorealistic landscape photography; crisp natural grass, foliage, and wool microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1455:1081 landscape aspect ratio, horizon height, sheep scale and distribution, tree masses, field geometry, and foreground slope; no crop changes.
Lighting/mood: blue-hour pre-dawn before sunrise, cool violet-blue ambient sky, faint soft lavender glow near the distant horizon, sparse subtle fading stars only if natural; pasture, sheep, and hedgerows readable but naturally dim with no artificial illumination.
Color palette: #486FFD, #7F81F3, #C489FF, #EADCFF, balanced with realistic dark pasture greens, shadowed hedgerows, and subdued natural sheep tones.
Constraints: change only environmental light, sky, and color grade; keep land geometry, every sheep, vegetation layout, and scene contents unchanged; no phones, screens, devices, people, new buildings, roads, signs, added objects, text, logos, or watermark.
Avoid: fantasy illustration, neon glow, oversaturation, heavy fog, dramatic new clouds, altered horizon, changed sheep placement, changed field geometry, fake HDR, device-shaped rectangles.
```

### Sunrise

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved phone-free Strata pastoral-field background and the edit target.
Primary request: transform only the time-of-day lighting into SUNRISE while preserving the exact same grazing sheep positions and poses, foreground green slope, layered field bands, hedgerows, dark tree clusters, distant rolling farmland, low horizon, camera position, compressed telephoto perspective, crop, and object layout as Image 1.
Scene/backdrop: broad pastoral field with scattered grazing sheep, layered wooded hedgerows, and distant rounded farmland; phone-free landscape plate.
Style/medium: premium photorealistic landscape photography; crisp natural grass, foliage, and wool microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1455:1081 landscape aspect ratio, horizon height, sheep scale and distribution, tree masses, field geometry, and foreground slope; no crop changes.
Lighting/mood: first sun just below or barely at the far left horizon, soft lilac-pink and peach sky, gentle warm rim light across the pasture, sheep, and hedgerow tops, open shadows, fresh luminous morning air; no oversized sun disk.
Color palette: #CB83FF, #FF90B9, #FFC977, #FFF1DC, balanced with realistic pasture greens, dark hedgerows, and natural off-white sheep.
Constraints: change only environmental light, sky, and color grade; keep land geometry, every sheep, vegetation layout, and scene contents unchanged; no phones, screens, devices, people, new buildings, roads, signs, added objects, text, logos, or watermark.
Avoid: fantasy illustration, neon glow, oversaturation, heavy fog, altered horizon, changed sheep placement, changed field geometry, fake HDR, orange cast over the whole image, device-shaped rectangles.
```

### Dusk

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved phone-free Strata pastoral-field background and the edit target.
Primary request: transform only the time-of-day lighting into DUSK, the calm early evening immediately after daylight, while preserving the exact same grazing sheep positions and poses, foreground green slope, layered field bands, hedgerows, dark tree clusters, distant rolling farmland, low horizon, camera position, compressed telephoto perspective, crop, and object layout as Image 1.
Scene/backdrop: broad pastoral field with scattered grazing sheep, layered wooded hedgerows, and distant rounded farmland; phone-free landscape plate.
Style/medium: premium photorealistic landscape photography; crisp natural grass, foliage, and wool microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1455:1081 landscape aspect ratio, horizon height, sheep scale and distribution, tree masses, field geometry, and foreground slope; no crop changes.
Lighting/mood: serene early-evening dusk, warm residual amber light grazing the pasture and treetops from the left, pale powder-blue upper sky fading toward creamy near-white at the horizon, long soft shadows, sheep and field layers still clearly readable; no stars and no visible sun disk.
Color palette: #FFB451, #EFC680, #B4D8FF, #FAFDFF, balanced with realistic pasture greens, dark hedgerows, and natural off-white sheep.
Constraints: change only environmental light, sky, and color grade; keep land geometry, every sheep, vegetation layout, and scene contents unchanged; no phones, screens, devices, people, new buildings, roads, signs, added objects, text, logos, or watermark.
Avoid: sunset-magenta dominance, fantasy illustration, neon glow, oversaturation, heavy fog, altered horizon, changed sheep placement, changed field geometry, fake HDR, device-shaped rectangles.
```

### Sunset

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved phone-free Strata pastoral-field background and the edit target.
Primary request: transform only the time-of-day lighting into SUNSET while preserving the exact same grazing sheep positions and poses, foreground green slope, layered field bands, hedgerows, dark tree clusters, distant rolling farmland, low horizon, camera position, compressed telephoto perspective, crop, and object layout as Image 1.
Scene/backdrop: broad pastoral field with scattered grazing sheep, layered wooded hedgerows, and distant rounded farmland; phone-free landscape plate.
Style/medium: premium photorealistic landscape photography; crisp natural grass, foliage, and wool microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1455:1081 landscape aspect ratio, horizon height, sheep scale and distribution, tree masses, field geometry, and foreground slope; no crop changes.
Lighting/mood: vivid but natural sunset after the sun has slipped below the far left horizon, coral and rose near the horizon blending into soft lilac above, warm pink edge light across the pasture, sheep, and foliage, gentle open shadows, luminous quiet atmosphere; no visible oversized sun disk.
Color palette: #FFA577, #FF90A1, #DDADFF, #F5EAFF, balanced with realistic pasture greens, dark hedgerows, and natural off-white sheep.
Constraints: change only environmental light, sky, and color grade; keep land geometry, every sheep, vegetation layout, and scene contents unchanged; no phones, screens, devices, people, new buildings, roads, signs, added objects, text, logos, or watermark.
Avoid: fiery orange dominance, fantasy illustration, neon glow, oversaturation, heavy fog, altered horizon, changed sheep placement, changed field geometry, fake HDR, device-shaped rectangles.
```

### Night

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved phone-free Strata pastoral-field background and the edit target.
Primary request: transform only the time-of-day lighting into deep NIGHT while preserving the exact same grazing sheep positions and poses, foreground green slope, layered field bands, hedgerows, dark tree clusters, distant rolling farmland, low horizon, camera position, compressed telephoto perspective, crop, and object layout as Image 1.
Scene/backdrop: broad pastoral field with scattered grazing sheep, layered wooded hedgerows, and distant rounded farmland; phone-free landscape plate.
Style/medium: premium photorealistic night landscape photography; crisp but naturally subdued grass, foliage, and wool microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1455:1081 landscape aspect ratio, horizon height, sheep scale and distribution, tree masses, field geometry, and foreground slope; no crop changes.
Lighting/mood: deep indigo-violet night under a clear dark sky, faint cool horizon glow and sparse subtle stars, no moon disk and no artificial lights; pasture bands, sheep, and hedgerows remain softly readable as deep navy and near-black forms with slight natural blue ambient separation.
Color palette: #6763E4, #453BB3, #29227D, #141E4B over #0B0C0F.
Constraints: change only environmental light, sky, and color grade; keep land geometry, every sheep, vegetation layout, and scene contents unchanged; no phones, screens, devices, people, new buildings, roads, signs, added objects, text, logos, or watermark.
Avoid: fantasy illustration, neon glow, oversaturation, Milky Way spectacle, large moon, heavy fog, altered horizon, changed sheep placement, changed field geometry, fake HDR, bright green pasture, device-shaped rectangles.
```
