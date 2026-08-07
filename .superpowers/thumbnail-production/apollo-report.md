# Apollo six-state thumbnail production report

Status: **DONE**  
Completed states: **6/6** — Pre-dawn, Sunrise, Daytime, Dusk, Sunset, Night  
Optimized outputs: **12/12**

## Outcome

The complete responsive Apollo time-of-day set was produced non-destructively under `images/cs/variants/time/apollo/`. The built-in image-generation tool was used only for phone-free environmental background plates. The supplied transparent master was never passed to image generation and was never regenerated, repainted, graded, relit, filtered, sharpened, or retouched. It received one required deterministic geometric downscale before alpha compositing.

All desktop exports are below the 700 KiB target. Desktop RGB PSNR is 41.289–42.194 dB and mobile RGB PSNR is 38.759–39.933 dB versus each corresponding lossless composite. Every encoded file is metadata-free sharp-YUV WebP.

## Output manifest and QA metrics

All files were encoded with `cwebp -m 6 -pass 10 -sharp_yuv -metadata none`. `webpmux -info` reports `No features present` for all 12 files, confirming no EXIF, XMP, ICC, alpha, or animation feature chunks.

| State | Desktop output | Bytes | Quality | RGB PSNR | Mobile output | Bytes | Quality | RGB PSNR |
|---|---|---:|---:|---:|---|---:|---:|---:|
| Pre-dawn | `images/cs/variants/time/apollo/pre-dawn-2400.webp` (2400×1784) | 394,830 | 90 | 41.289 dB | `images/cs/variants/time/apollo/pre-dawn-1200.webp` (1200×892) | 126,746 | 88 | 39.517 dB |
| Sunrise | `images/cs/variants/time/apollo/sunrise-2400.webp` (2400×1784) | 466,742 | 90 | 41.837 dB | `images/cs/variants/time/apollo/sunrise-1200.webp` (1200×892) | 160,292 | 88 | 39.227 dB |
| Daytime | `images/cs/variants/time/apollo/daytime-2400.webp` (2400×1784) | 514,466 | 90 | 41.745 dB | `images/cs/variants/time/apollo/daytime-1200.webp` (1200×892) | 168,392 | 88 | 38.759 dB |
| Dusk | `images/cs/variants/time/apollo/dusk-2400.webp` (2400×1784) | 436,312 | 90 | 42.194 dB | `images/cs/variants/time/apollo/dusk-1200.webp` (1200×892) | 142,608 | 88 | 39.654 dB |
| Sunset | `images/cs/variants/time/apollo/sunset-2400.webp` (2400×1784) | 483,528 | 90 | 41.691 dB | `images/cs/variants/time/apollo/sunset-1200.webp` (1200×892) | 162,006 | 88 | 39.088 dB |
| Night | `images/cs/variants/time/apollo/night-2400.webp` (2400×1784) | 367,014 | 90 | 42.087 dB | `images/cs/variants/time/apollo/night-1200.webp` (1200×892) | 114,488 | 88 | 39.933 dB |

The source plates, one reproducible build script, the single resized mockup buffer, and machine-readable SHA-256/QA metrics are retained under `images/cs/variants/time/apollo/sources/`. Temporary lossless composites were deleted after encoding, PSNR measurement, and invariant validation.

## Pixel-preservation and placement method

- Source mockup: `images/cs/masters/apollo-mockups.png`, 3360×1752 RGBA.
- Source master SHA-256: `ac26c31df8e5058e54c91e51659d817fe44b1359a46e11be858ce145a09a27e9`.
- The established placement was recovered from the supplied 1600×1189 Apollo composition reference: resize once to 1800×939 with Pillow Lanczos, then place at `(300, 423)` on the 2400×1784 canvas.
- The exact same decoded/resized RGBA buffer was reused for every state. Each phone-free plate was center cover-fitted to 2400×1784, then the mockup was alpha-composited above it.
- No foreground color transform, environmental grade, light overlay, shadow overlay, contrast operation, denoise, sharpening, generative edit, or paint operation was applied. Environmental lighting exists only in the plate below the master alpha layer.
- Mobile lossless references were downscaled directly from each lossless 2400×1784 composite with Lanczos, then encoded independently at q88. They were not transcoded from desktop WebP.
- The automated invariant checked all 1,598,907 fully opaque pixels in the resized master against all six lossless composites. Every opaque RGB pixel matched the resized master byte-for-byte, and therefore matched across all six states. Semi-transparent antialiased edge pixels blend naturally with the underlying plate through standard alpha compositing.

## Visual QA

- Inspected all six 2400×1784 outputs as a full-set contact sheet and inspected representative Daytime and Night exports at full native resolution.
- Inspected a close UI-detail sheet across all four mockups in all six states and inspected Sunrise at native 1200×892.
- Apollo wordmarks, status-bar strokes, profile labels, camera grid lines, small reaction controls, fine card borders, photo tiles, and rounded mockup edges remain intact without visible ringing or color bleed.
- Mockup dimensions, spacing, baseline, UI content, device blacks, and embedded photography are visually identical across states.
- The rolling-hill scene remains recognizably consistent across all states: matching ridge profile, horizon height, central summit, foreground valley, oak/shrub distribution, camera position, and perspective.
- Palette direction is distinct and legible: blue/lavender Pre-dawn; lilac/pink/peach Sunrise; clear blue/white Daytime; powder-blue/amber Dusk; coral/rose/lilac Sunset; indigo/violet Night over near-black.
- No phone, screen, device silhouette, person, building, road, sign, text, logo, or watermark appears in any environmental source plate.

## Visual concerns

- Generative relighting changes cloud shapes and introduces minor hill microtexture differences between states. The primary land contours, camera, horizon, vegetation landmarks, and scene identity remain consistent.
- The Dusk plate was generated at 1456×1080 while the other five plates are 1455×1081. Its centered cover fit trims only a few source-edge pixels; the hill contours and mockup-safe region are unaffected.
- The bright embedded content inside the third mockup remains identical at Night by design. It is part of the untouched supplied master, not environmental light painted over the device.
- No blocking visual concern was found.

## Full image-generation prompt list

Built-in image-generation mode was used for all six plates. The transparent mockup master was never supplied to the model.

### Daytime

`Image 1` was `images/cs/apollo-cover.webp`, used only as the current composition/edit reference from which all four phones were removed.

```text
Use case: precise-object-edit
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the current Apollo thumbnail composition reference and the edit target. It contains four smartphone mockups that must be removed completely.
Primary request: remove all four smartphone mockups and every device edge, shadow, reflection, screen, and UI fragment; reconstruct the occluded landscape as one seamless phone-free clear DAYTIME photographic scene. Preserve the visible environment’s exact identity and composition: the rolling bright-green California hills, ridge profiles, scattered dark green oak shrubs and trees, foreground slope, distant right-hand ridge, horizon height, camera position, lens, perspective, and crop.
Scene/backdrop: broad spring-green rolling hills under open sky, no human-made elements.
Style/medium: premium photorealistic landscape photography; crisp natural grass texture; restrained editorial realism.
Composition/framing: preserve Image 1’s full 1600:1189 landscape aspect ratio and its exact hillside contours and horizon; plausibly continue the terrain and sky behind the removed phones. Keep the central area visually calm enough for later mockup placement.
Lighting/mood: clean mid-morning daylight, bright airy blue sky with soft pale cloud texture, sun outside frame, natural open shadows.
Color palette: #0071C1, #60A8E2, #B4D8FF, #F8FAFD, balanced with realistic green grass and oak foliage.
Constraints: change only by removing the phones and reconstructing the occluded natural environment; no phones, no screens, no devices, no device-shaped rectangles, no people, no buildings, no roads, no signs, no text, no logos, no watermark.
Avoid: fantasy illustration, neon saturation, artificial smooth gradients, fake HDR, harsh noon contrast, altered visible ridge shape, new mountains, new large objects, smeared inpainting.
```

For the five relit states below, `Image 1` was the clean phone-free Daytime plate `images/cs/variants/time/apollo/sources/daytime-generated.png`.

### Pre-dawn

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved phone-free Apollo rolling-hills background and the edit target.
Primary request: transform only the time-of-day lighting into PRE-DAWN while preserving the same rolling green hills, every ridge profile, scattered oak/shrub distribution, foreground slope, camera position, lens, horizon, crop, and perspective as Image 1.
Scene/backdrop: broad spring-green California hills with scattered dark oak shrubs; phone-free natural landscape plate.
Style/medium: premium photorealistic landscape photography; crisp natural microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1455:1081 landscape aspect ratio, hillside contours, horizon height, and negative space; no crop changes.
Lighting/mood: blue-hour pre-dawn before sunrise, cool violet-blue ambient sky, faint soft lavender glow near the horizon, subtle fading stars only if natural; hills readable but naturally dim with no artificial illumination.
Color palette: #486FFD, #7F81F3, #C489FF, #EADCFF, balanced with realistic dark meadow greens.
Constraints: change only environmental light, sky, and color grade; keep all land geometry and scene contents unchanged; no phones, no screens, no devices, no people, no buildings, no roads, no added objects, no text, no logos, no watermark.
Avoid: fantasy illustration, neon glow, oversaturation, heavy fog, dramatic new clouds, altered ridge shape, changed vegetation placement, fake HDR, device-shaped rectangles.
```

### Sunrise

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved phone-free Apollo rolling-hills background and the edit target.
Primary request: transform only the time-of-day lighting into SUNRISE while preserving the same rolling green hills, every ridge profile, scattered oak/shrub distribution, foreground slope, camera position, lens, horizon, crop, and perspective as Image 1.
Scene/backdrop: broad spring-green California hills with scattered dark oak shrubs; phone-free natural landscape plate.
Style/medium: premium photorealistic landscape photography; crisp natural microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1455:1081 landscape aspect ratio, hillside contours, horizon height, and negative space; no crop changes.
Lighting/mood: first sun just below or barely at the far left horizon, soft lilac-pink and peach sky, gentle warm rim light across the hills, open shadows, fresh luminous morning air; no oversized sun disk.
Color palette: #CB83FF, #FF90B9, #FFC977, #FFF1DC, balanced with realistic meadow greens.
Constraints: change only environmental light, sky, and color grade; keep all land geometry and scene contents unchanged; no phones, no screens, no devices, no people, no buildings, no roads, no added objects, no text, no logos, no watermark.
Avoid: fantasy illustration, neon glow, oversaturation, heavy fog, altered ridge shape, changed vegetation placement, fake HDR, orange cast over the whole image, device-shaped rectangles.
```

### Dusk

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved phone-free Apollo rolling-hills background and the edit target.
Primary request: transform only the time-of-day lighting into DUSK, the calm early evening immediately after daylight, while preserving the same rolling green hills, every ridge profile, scattered oak/shrub distribution, foreground slope, camera position, lens, horizon, crop, and perspective as Image 1.
Scene/backdrop: broad spring-green California hills with scattered dark oak shrubs; phone-free natural landscape plate.
Style/medium: premium photorealistic landscape photography; crisp natural microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1455:1081 landscape aspect ratio, hillside contours, horizon height, and negative space; no crop changes.
Lighting/mood: serene early-evening dusk, warm residual amber light grazing the hilltops from the left, pale powder-blue upper sky fading toward creamy near-white at the horizon, long soft shadows, landscape still clearly readable; no stars and no visible sun disk.
Color palette: #FFB451, #EFC680, #B4D8FF, #FAFDFF, balanced with realistic meadow greens.
Constraints: change only environmental light, sky, and color grade; keep all land geometry and scene contents unchanged; no phones, no screens, no devices, no people, no buildings, no roads, no added objects, no text, no logos, no watermark.
Avoid: sunset-magenta dominance, fantasy illustration, neon glow, oversaturation, heavy fog, altered ridge shape, changed vegetation placement, fake HDR, device-shaped rectangles.
```

### Sunset

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved phone-free Apollo rolling-hills background and the edit target.
Primary request: transform only the time-of-day lighting into SUNSET while preserving the same rolling green hills, every ridge profile, scattered oak/shrub distribution, foreground slope, camera position, lens, horizon, crop, and perspective as Image 1.
Scene/backdrop: broad spring-green California hills with scattered dark oak shrubs; phone-free natural landscape plate.
Style/medium: premium photorealistic landscape photography; crisp natural microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1455:1081 landscape aspect ratio, hillside contours, horizon height, and negative space; no crop changes.
Lighting/mood: vivid but natural sunset after the sun has slipped below the far left horizon, coral and rose near the horizon blending into soft lilac above, warm pink edge light on grass, gentle open shadows, luminous quiet atmosphere; no visible oversized sun disk.
Color palette: #FFA577, #FF90A1, #DDADFF, #F5EAFF, balanced with realistic meadow greens.
Constraints: change only environmental light, sky, and color grade; keep all land geometry and scene contents unchanged; no phones, no screens, no devices, no people, no buildings, no roads, no added objects, no text, no logos, no watermark.
Avoid: fiery orange dominance, fantasy illustration, neon glow, oversaturation, heavy fog, altered ridge shape, changed vegetation placement, fake HDR, device-shaped rectangles.
```

### Night

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved phone-free Apollo rolling-hills background and the edit target.
Primary request: transform only the time-of-day lighting into deep NIGHT while preserving the same rolling hills, every ridge profile, scattered oak/shrub distribution, foreground slope, camera position, lens, horizon, crop, and perspective as Image 1.
Scene/backdrop: broad California rolling hills with scattered dark oak shrubs; phone-free natural landscape plate.
Style/medium: premium photorealistic night landscape photography; crisp but naturally subdued microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1455:1081 landscape aspect ratio, hillside contours, horizon height, and negative space; no crop changes.
Lighting/mood: deep indigo-violet night under a clear dark sky, faint cool horizon glow and sparse subtle stars, no moon disk, no artificial lights; hills remain softly readable as deep navy and near-black silhouettes with slight natural blue ambient separation.
Color palette: #6763E4, #453BB3, #29227D, #141E4B over #0B0C0F.
Constraints: change only environmental light, sky, and color grade; keep all land geometry and scene contents unchanged; no phones, no screens, no devices, no people, no buildings, no roads, no added objects, no text, no logos, no watermark.
Avoid: fantasy illustration, neon glow, oversaturation, Milky Way spectacle, large moon, heavy fog, altered ridge shape, changed vegetation placement, fake HDR, bright green hills, device-shaped rectangles.
```
