# Cluster six-state thumbnail production report

Status: **DONE**  
Completed states: **6/6** — Pre-dawn, Sunrise, Daytime, Dusk, Sunset, Night  
Optimized outputs: **12/12**

## Outcome

The complete responsive Cluster time-of-day set was produced non-destructively under `images/cs/variants/time/cluster/`. The built-in image-generation tool was used only for phone-free environmental background plates. The supplied transparent master was never passed to image generation and was never regenerated, repainted, graded, relit, filtered, sharpened, or retouched. It received one required deterministic geometric downscale before alpha compositing.

All desktop exports are below the 700 KiB target. Desktop RGB PSNR is 40.173–42.215 dB and mobile RGB PSNR is 37.355–39.564 dB versus each corresponding lossless composite. Every encoded file is metadata-free sharp-YUV WebP.

## Output manifest and QA metrics

All files were encoded with `cwebp -m 6 -pass 10 -sharp_yuv -metadata none`. `webpmux -info` reports `No features present` for all 12 files, confirming no EXIF, XMP, ICC, alpha, or animation feature chunks.

| State | Desktop output | Bytes | Quality | RGB PSNR | Mobile output | Bytes | Quality | RGB PSNR |
|---|---|---:|---:|---:|---|---:|---:|---:|
| Pre-dawn | `images/cs/variants/time/cluster/pre-dawn-2400.webp` (2400×1784) | 468,678 | 90 | 41.936 dB | `images/cs/variants/time/cluster/pre-dawn-1200.webp` (1200×892) | 161,038 | 88 | 39.222 dB |
| Sunrise | `images/cs/variants/time/cluster/sunrise-2400.webp` (2400×1784) | 646,276 | 90 | 41.269 dB | `images/cs/variants/time/cluster/sunrise-1200.webp` (1200×892) | 224,900 | 88 | 38.141 dB |
| Daytime | `images/cs/variants/time/cluster/daytime-2400.webp` (2400×1784) | 694,980 | 89 | 40.173 dB | `images/cs/variants/time/cluster/daytime-1200.webp` (1200×892) | 249,594 | 88 | 37.355 dB |
| Dusk | `images/cs/variants/time/cluster/dusk-2400.webp` (2400×1784) | 581,904 | 90 | 41.505 dB | `images/cs/variants/time/cluster/dusk-1200.webp` (1200×892) | 196,284 | 88 | 38.443 dB |
| Sunset | `images/cs/variants/time/cluster/sunset-2400.webp` (2400×1784) | 595,492 | 90 | 41.432 dB | `images/cs/variants/time/cluster/sunset-1200.webp` (1200×892) | 204,804 | 88 | 38.230 dB |
| Night | `images/cs/variants/time/cluster/night-2400.webp` (2400×1784) | 378,136 | 90 | 42.215 dB | `images/cs/variants/time/cluster/night-1200.webp` (1200×892) | 116,886 | 88 | 39.564 dB |

The source plates, reproducible build script, single resized mockup buffer, and machine-readable SHA-256/QA metrics are retained under `images/cs/variants/time/cluster/sources/`. Temporary lossless composites were deleted after encoding, PSNR measurement, and invariant validation.

## Pixel-preservation and placement method

- Source mockup: `images/cs/masters/cluster-mockups.png`, 2454×1704 RGBA.
- Source master SHA-256: `007189c68f71169101dbec642e75bcb5d7d57723306f39eefda818e4965abdd3`.
- The established centered placement was recovered from the supplied 1600×1189 Cluster reference: resize once to 1313×912 with Pillow Lanczos, then place at `(543, 436)` on the 2400×1784 canvas.
- The exact same decoded/resized RGBA buffer was reused for every state. Each phone-free plate was center cover-fitted to 2400×1784, then the mockup was alpha-composited above it.
- No foreground color transform, environmental grade, light overlay, shadow overlay, contrast operation, denoise, sharpening, generative edit, or paint operation was applied. Environmental lighting exists only in the plate below the master alpha layer.
- Mobile lossless references were downscaled directly from each lossless 2400×1784 composite with Lanczos, then encoded independently at q88. They were not transcoded from desktop WebP.
- The automated invariant checked all 1,141,778 fully opaque pixels in the resized master against all six lossless composites. Every opaque RGB pixel matched the resized master byte-for-byte and therefore matched across all six states. Semi-transparent antialiased edge pixels blend naturally with the underlying plate through standard alpha compositing.

## Visual QA

- Inspected all six 2400×1784 outputs as a full-set contact sheet and inspected representative Daytime and Night exports at full native resolution.
- Inspected a close UI-detail sheet across all three mockups in all six states and inspected Sunrise at native 1200×892.
- Cluster wordmarks, status-bar strokes, search and navigation controls, fine category chips, small article labels, body copy, card borders, reaction icons, photo tiles, and rounded mockup edges remain intact without visible ringing or color bleed.
- Mockup dimensions, spacing, baseline, UI content, screen whites, and embedded photography are visually identical across states.
- The campus-nature scene remains recognizably consistent across all states: matching horizon height, left and right ridge profiles, central low saddle, wooded ravine, foreground grass flow, camera position, and perspective.
- Palette direction is distinct and legible: blue/lavender Pre-dawn; lilac/pink/peach Sunrise; clear blue/white Daytime; powder-blue/amber Dusk; coral/rose/lilac Sunset; indigo/violet Night over near-black.
- No phone, screen, device silhouette, person, building, road, sign, text, logo, or watermark appears in any environmental source plate.

## Visual concerns

- Generative relighting changes cloud shapes and introduces minor grass/foliage microtexture differences between states. The primary land contours, camera, horizon, ravine, and scene identity remain consistent.
- The Dusk plate was generated at 1455×1081 while the other five plates are 1454×1082. Its centered cover fit trims only a small number of source-edge pixels; the ridge profiles and mockup-safe region are unaffected.
- Daytime’s bright cloud and dense grass/UI detail required q89 rather than q90 to meet the desktop target. At 694,980 bytes and 40.173 dB PSNR it remains visually clean and below 700 KiB.
- The bright white mockup screens at Night are part of the untouched supplied master. They were intentionally not darkened or relit.
- No blocking visual concern was found.

## Full image-generation prompt list

Built-in image-generation mode was used for all six plates. The transparent mockup master was never supplied to the model.

### Daytime

`Image 1` was `images/cs/cluster/cluster-cover.webp`, used only as the current composition/edit reference from which all three phones were removed.

```text
Use case: precise-object-edit
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the current Cluster thumbnail composition reference and the edit target. It contains three smartphone mockups that must be removed completely.
Primary request: remove all three smartphone mockups and every device edge, shadow, screen, reflection, and UI fragment; reconstruct the occluded environment as one seamless phone-free clear DAYTIME photographic scene. Preserve the exact visible scene identity and composition: the sunlit spring-green campus nature preserve, open grassy slopes, dark wooded ravine in the foreground and center, left and right ridge profiles, sparse shrubs, white cloud bank along the horizon, camera position, lens, perspective, and crop.
Scene/backdrop: broad grassy upland campus preserve with a shallow forested ravine and low rounded ridges under open sky; entirely phone-free.
Style/medium: premium photorealistic landscape photography; crisp natural grass and foliage texture; restrained editorial realism.
Composition/framing: preserve Image 1’s full 1600:1189 landscape aspect ratio, exact horizon height, ridge silhouettes, foreground valley flow, and object layout; plausibly continue the grass, ravine vegetation, and clouds behind the removed phones. Keep the central region naturally calm enough for later mockup placement.
Lighting/mood: clean mid-morning daylight, bright airy blue sky, soft white cumulus clouds clustered near the horizon, natural directional sunlight, readable open shadows.
Color palette: #0071C1, #60A8E2, #B4D8FF, #F8FAFD, balanced with realistic spring greens and deep natural forest foliage.
Constraints: change only by removing the phones and reconstructing the occluded natural environment; no phones, no screens, no devices, no device-shaped rectangles, no people, no buildings, no roads, no signs, no text, no logos, no watermark.
Avoid: fantasy illustration, neon saturation, artificial smooth gradients, fake HDR, harsh contrast, altered visible ridge shape, new mountains, new large objects, smeared inpainting.
```

For the five relit states below, `Image 1` was the clean phone-free Daytime plate `images/cs/variants/time/cluster/sources/daytime-generated.png`.

### Pre-dawn

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved phone-free Cluster campus-preserve background and the edit target.
Primary request: transform only the time-of-day lighting into PRE-DAWN while preserving the exact same open grassy slopes, dark wooded ravine, left and right ridge profiles, sparse shrubs, camera position, lens, horizon, crop, and perspective as Image 1.
Scene/backdrop: broad grassy upland campus nature preserve with a shallow forested ravine and low rounded ridges; phone-free landscape plate.
Style/medium: premium photorealistic landscape photography; crisp natural grass and foliage microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1454:1082 landscape aspect ratio, horizon height, ridge silhouettes, foreground valley flow, and object layout; no crop changes.
Lighting/mood: blue-hour pre-dawn before sunrise, cool violet-blue ambient sky, faint soft lavender glow along the ridge horizon, sparse subtle fading stars if natural; grass and ravine remain readable but naturally dim with no artificial illumination.
Color palette: #486FFD, #7F81F3, #C489FF, #EADCFF, balanced with realistic dark meadow and forest greens.
Constraints: change only environmental light, sky, and color grade; keep land geometry, vegetation layout, and scene contents unchanged; no phones, screens, devices, people, buildings, roads, signs, added objects, text, logos, or watermark.
Avoid: fantasy illustration, neon glow, oversaturation, heavy fog, dramatic new clouds, altered ridge shapes, changed vegetation placement, fake HDR, device-shaped rectangles.
```

### Sunrise

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved phone-free Cluster campus-preserve background and the edit target.
Primary request: transform only the time-of-day lighting into SUNRISE while preserving the exact same open grassy slopes, dark wooded ravine, left and right ridge profiles, sparse shrubs, camera position, lens, horizon, crop, and perspective as Image 1.
Scene/backdrop: broad grassy upland campus nature preserve with a shallow forested ravine and low rounded ridges; phone-free landscape plate.
Style/medium: premium photorealistic landscape photography; crisp natural grass and foliage microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1454:1082 landscape aspect ratio, horizon height, ridge silhouettes, foreground valley flow, and object layout; no crop changes.
Lighting/mood: first sun just below or barely at the far left horizon, soft lilac-pink and peach sky, gentle warm rim light across the grass and ravine foliage, open shadows, fresh luminous morning air; no oversized sun disk.
Color palette: #CB83FF, #FF90B9, #FFC977, #FFF1DC, balanced with realistic spring greens and forest foliage.
Constraints: change only environmental light, sky, and color grade; keep land geometry, vegetation layout, and scene contents unchanged; no phones, screens, devices, people, buildings, roads, signs, added objects, text, logos, or watermark.
Avoid: fantasy illustration, neon glow, oversaturation, heavy fog, altered ridge shapes, changed vegetation placement, fake HDR, orange cast over the whole image, device-shaped rectangles.
```

### Dusk

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved phone-free Cluster campus-preserve background and the edit target.
Primary request: transform only the time-of-day lighting into DUSK, the calm early evening immediately after daylight, while preserving the exact same open grassy slopes, dark wooded ravine, left and right ridge profiles, sparse shrubs, camera position, lens, horizon, crop, and perspective as Image 1.
Scene/backdrop: broad grassy upland campus nature preserve with a shallow forested ravine and low rounded ridges; phone-free landscape plate.
Style/medium: premium photorealistic landscape photography; crisp natural grass and foliage microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1454:1082 landscape aspect ratio, horizon height, ridge silhouettes, foreground valley flow, and object layout; no crop changes.
Lighting/mood: serene early-evening dusk, warm residual amber light grazing the ridges and grass from the left, pale powder-blue upper sky fading toward creamy near-white at the horizon, long soft shadows, ravine still clearly readable; no stars and no visible sun disk.
Color palette: #FFB451, #EFC680, #B4D8FF, #FAFDFF, balanced with realistic meadow and forest greens.
Constraints: change only environmental light, sky, and color grade; keep land geometry, vegetation layout, and scene contents unchanged; no phones, screens, devices, people, buildings, roads, signs, added objects, text, logos, or watermark.
Avoid: sunset-magenta dominance, fantasy illustration, neon glow, oversaturation, heavy fog, altered ridge shapes, changed vegetation placement, fake HDR, device-shaped rectangles.
```

### Sunset

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved phone-free Cluster campus-preserve background and the edit target.
Primary request: transform only the time-of-day lighting into SUNSET while preserving the exact same open grassy slopes, dark wooded ravine, left and right ridge profiles, sparse shrubs, camera position, lens, horizon, crop, and perspective as Image 1.
Scene/backdrop: broad grassy upland campus nature preserve with a shallow forested ravine and low rounded ridges; phone-free landscape plate.
Style/medium: premium photorealistic landscape photography; crisp natural grass and foliage microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1454:1082 landscape aspect ratio, horizon height, ridge silhouettes, foreground valley flow, and object layout; no crop changes.
Lighting/mood: vivid but natural sunset after the sun has slipped below the far left horizon, coral and rose near the horizon blending into soft lilac above, warm pink edge light across the grass and foliage, gentle open shadows, luminous quiet atmosphere; no visible oversized sun disk.
Color palette: #FFA577, #FF90A1, #DDADFF, #F5EAFF, balanced with realistic meadow and forest greens.
Constraints: change only environmental light, sky, and color grade; keep land geometry, vegetation layout, and scene contents unchanged; no phones, screens, devices, people, buildings, roads, signs, added objects, text, logos, or watermark.
Avoid: fiery orange dominance, fantasy illustration, neon glow, oversaturation, heavy fog, altered ridge shapes, changed vegetation placement, fake HDR, device-shaped rectangles.
```

### Night

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved phone-free Cluster campus-preserve background and the edit target.
Primary request: transform only the time-of-day lighting into deep NIGHT while preserving the exact same open grassy slopes, dark wooded ravine, left and right ridge profiles, sparse shrubs, camera position, lens, horizon, crop, and perspective as Image 1.
Scene/backdrop: broad grassy upland campus nature preserve with a shallow forested ravine and low rounded ridges; phone-free landscape plate.
Style/medium: premium photorealistic night landscape photography; crisp but naturally subdued grass and foliage microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1454:1082 landscape aspect ratio, horizon height, ridge silhouettes, foreground valley flow, and object layout; no crop changes.
Lighting/mood: deep indigo-violet night under a clear dark sky, faint cool horizon glow and sparse subtle stars, no moon disk and no artificial lights; ridges and forested ravine remain softly readable as deep navy and near-black forms with slight natural blue ambient separation.
Color palette: #6763E4, #453BB3, #29227D, #141E4B over #0B0C0F.
Constraints: change only environmental light, sky, and color grade; keep land geometry, vegetation layout, and scene contents unchanged; no phones, screens, devices, people, buildings, roads, signs, added objects, text, logos, or watermark.
Avoid: fantasy illustration, neon glow, oversaturation, Milky Way spectacle, large moon, heavy fog, altered ridge shapes, changed vegetation placement, fake HDR, bright green grass, device-shaped rectangles.
```
