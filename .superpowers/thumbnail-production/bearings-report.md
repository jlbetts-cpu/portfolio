# Bearings six-state thumbnail production report

Status: **DONE**  
Completed states: **6/6** — Pre-dawn, Sunrise, Daytime, Dusk, Sunset, Night

## Outcome

The full Bearings time-of-day set was produced non-destructively under `images/cs/variants/time/bearings/`. The five new phone-free background plates were created with the built-in image-generation tool, using the approved Night background as the edit target. Night was rebuilt directly from the approved proof. The supplied transparent master was never passed to image generation and was never redrawn, color-graded, relit, retouched, or filtered apart from the one required geometric downscale.

All 2400px exports are below the 700 KiB target. Desktop PSNR is 38.897–40.815 dB and mobile PSNR is 36.855–38.302 dB versus each corresponding lossless composite.

## Output manifest and QA metrics

All files are lossy sharp-YUV WebP encoded with `cwebp -m 6 -pass 10 -sharp_yuv -metadata none`. `webpmux -info` reports `No features present`, confirming no embedded EXIF/XMP/ICC/animation feature chunks.

| State | Desktop output | Bytes | Quality | PSNR | Mobile output | Bytes | Quality | PSNR |
|---|---|---:|---:|---:|---|---:|---:|---:|
| Pre-dawn | `images/cs/variants/time/bearings/pre-dawn-2400.webp` (2400×1784) | 455,678 | 90 | 40.635 dB | `images/cs/variants/time/bearings/pre-dawn-1200.webp` (1200×892) | 166,540 | 88 | 38.302 dB |
| Sunrise | `images/cs/variants/time/bearings/sunrise-2400.webp` (2400×1784) | 512,586 | 90 | 40.719 dB | `images/cs/variants/time/bearings/sunrise-1200.webp` (1200×892) | 180,580 | 88 | 37.998 dB |
| Daytime | `images/cs/variants/time/bearings/daytime-2400.webp` (2400×1784) | 612,270 | 90 | 38.897 dB | `images/cs/variants/time/bearings/daytime-1200.webp` (1200×892) | 223,524 | 88 | 36.855 dB |
| Dusk | `images/cs/variants/time/bearings/dusk-2400.webp` (2400×1784) | 494,386 | 90 | 40.815 dB | `images/cs/variants/time/bearings/dusk-1200.webp` (1200×892) | 174,774 | 88 | 38.235 dB |
| Sunset | `images/cs/variants/time/bearings/sunset-2400.webp` (2400×1784) | 523,044 | 90 | 40.653 dB | `images/cs/variants/time/bearings/sunset-1200.webp` (1200×892) | 184,238 | 88 | 37.944 dB |
| Night | `images/cs/variants/time/bearings/night-2400.webp` (2400×1784) | 527,478 | 90 | 40.722 dB | `images/cs/variants/time/bearings/night-1200.webp` (1200×892) | 180,704 | 88 | 37.960 dB |

Source plates and machine-readable build metrics are retained under `images/cs/variants/time/bearings/sources/`. Temporary lossless composites were deleted after encoding and PSNR measurement.

## Pixel-preservation method

- Source mockup: `images/cs/masters/bearings-mockups.png`, 3360×1748 RGBA.
- The established approved-Night placement was recovered exactly: resize once to 1800×936 with Pillow Lanczos, then place at `(300, 423)` on the 2400×1784 canvas.
- The same decoded/resized RGBA buffer was reused across all six states. Each phone-free plate was first cover-fitted to 2400×1784, then the mockup buffer was alpha-composited above it.
- No state-specific operation touched mockup RGB or alpha values. No foreground color transform, light overlay, sharpening, contrast, denoise, generative edit, or paint operation was applied.
- The source master’s existing translucent edge/contact shadows remain part of its alpha layer; no additional lighting was placed over the mockups. Environmental changes exist only in the plate below the alpha layer.
- An automated invariant check confirmed that every fully opaque mockup pixel is byte-identical across all six lossless composites. Semi-transparent antialiased/shadow edge pixels blend naturally with the state plate beneath them, as required by alpha compositing.
- Mobile references were downscaled directly from the lossless 2400×1784 composites with Lanczos before q88 encoding; mobile files were not transcoded from the desktop WebPs.

## Visual QA

- Inspected every 2400×1784 export at full frame and inspected an unscaled UI-detail strip covering all four phones in all six states.
- Inspected representative Daytime and Night 1200×892 exports at native size.
- Fine status-bar strokes, dotted itinerary progress lines, map routes, small labels, card dividers, serif Bearings wordmarks, and rounded phone edges remain intact without visible ringing or color bleed.
- Phone scale, spacing, baseline, and UI content are identical across states.
- The alpine ridge summit, left and right mountain silhouettes, camera position, flower meadow, and foreground flow remain recognizably consistent across all states.
- Palette direction is distinct and legible: blue/lavender Pre-dawn; lilac/pink/peach Sunrise; clear blue/white Daytime; powder-blue/amber Dusk; coral/rose/lilac Sunset; approved indigo Night over near-black.

## Visual concerns

- Generative relighting necessarily introduces small meadow microtexture and cloud-shape differences between states; the major land contours, viewpoint, horizon, and scene identity remain consistent.
- The generated Sunset plate arrived at 1437×1095, so its cover fit trims about 13 source pixels from both the top and bottom before scaling. The ridge and phone-safe focal region are unaffected.
- Daytime contains the highest-frequency grass detail and therefore has the lowest PSNR of the set, but it remains visually clean and is still below 700 KiB at q90.
- No blocking visual concern was found.

## Full image-generation prompt list

Built-in image-generation mode was used. `Image 1` in every prompt below was the local approved reference `images/cs/variants/bearings-night-background-proof.png`. The transparent mockup master was not supplied to the model.

### Pre-dawn

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved Night alpine-meadow background and the edit target.
Primary request: transform only the time-of-day lighting into PRE-DAWN, while preserving the same alpine meadow, ridge silhouette, distant mountain contours, foreground flower distribution, camera position, lens, horizon, crop, and perspective as Image 1.
Scene/backdrop: wide realistic alpine meadow with yellow wildflowers on a rising ridge and distant mountain silhouettes; phone-free background plate.
Style/medium: premium photorealistic landscape photography; crisp natural microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1455:1081 landscape aspect ratio and the central low ridge summit; no crop changes.
Lighting/mood: blue-hour pre-dawn before sunrise, cool violet-blue ambient sky, faint soft lavender glow at the horizon, stars fading but still subtly visible; grass and flowers readable but naturally dim.
Color palette: #486FFD, #7F81F3, #C489FF, #EADCFF, balanced with realistic dark meadow greens and natural yellow flowers.
Constraints: change only environmental light, sky, and color grade; keep all land geometry and scene contents unchanged; no phones, no screens, no devices, no people, no buildings, no added objects, no text, no logos, no watermark.
Avoid: fantasy illustration, neon glow, oversaturation, heavy fog, dramatic new clouds, altered ridge shape, changed flower placement, fake HDR.
```

### Sunrise

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved Night alpine-meadow background and the edit target.
Primary request: transform only the time-of-day lighting into SUNRISE, while preserving the same alpine meadow, ridge silhouette, distant mountain contours, foreground flower distribution, camera position, lens, horizon, crop, and perspective as Image 1.
Scene/backdrop: wide realistic alpine meadow with yellow wildflowers on a rising ridge and distant mountain silhouettes; phone-free background plate.
Style/medium: premium photorealistic landscape photography; crisp natural microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1455:1081 landscape aspect ratio and central low ridge summit; no crop changes.
Lighting/mood: first sun just below or barely at the horizon behind the right side of the ridge, soft pink and peach sky, gentle warm rim light across grass and flowers, open shadows, fresh luminous morning air.
Color palette: #CB83FF, #FF90B9, #FFC977, #FFF1DC, balanced with realistic meadow greens and natural yellow flowers.
Constraints: change only environmental light, sky, and color grade; keep all land geometry and scene contents unchanged; no visible oversized sun disk; no phones, no screens, no devices, no people, no buildings, no added objects, no text, no logos, no watermark.
Avoid: fantasy illustration, neon glow, oversaturation, heavy fog, altered ridge shape, changed flower placement, fake HDR, orange color cast over the whole image.
```

### Daytime

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved Night alpine-meadow background and the edit target.
Primary request: transform only the time-of-day lighting into clear DAYTIME, while preserving the same alpine meadow, ridge silhouette, distant mountain contours, foreground flower distribution, camera position, lens, horizon, crop, and perspective as Image 1.
Scene/backdrop: wide realistic alpine meadow with yellow wildflowers on a rising ridge and distant mountain silhouettes; phone-free background plate.
Style/medium: premium photorealistic landscape photography; crisp natural microtexture; restrained editorial realism.
Composition/framing: preserve Image 1 exactly, including its 1455:1081 landscape aspect ratio and central low ridge summit; no crop changes.
Lighting/mood: clean mid-morning alpine daylight, bright blue sky with only faint high natural cloud texture, sun outside frame, soft directional illumination, open readable meadow shadows, airy and optimistic.
Color palette: #0071C1, #60A8E2, #B4D8FF, #F8FAFD, balanced with realistic green grass and natural yellow flowers.
Constraints: change only environmental light, sky, and color grade; keep all land geometry and scene contents unchanged; no phones, no screens, no devices, no people, no buildings, no added objects, no text, no logos, no watermark.
Avoid: fantasy illustration, neon saturation, harsh noon contrast, heavy cloud cover, altered ridge shape, changed flower placement, fake HDR.
```

### Dusk

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved Night alpine-meadow background and the edit target.
Primary request: transform only the time-of-day lighting into DUSK, the calm early evening immediately after daylight, while preserving the same alpine meadow, ridge silhouette, distant mountain contours, foreground flower distribution, camera position, lens, horizon, crop, and perspective as Image 1.
Scene/backdrop: wide realistic alpine meadow with yellow wildflowers on a rising ridge and distant mountain silhouettes; phone-free background plate.
Style/medium: premium photorealistic landscape photography; crisp natural microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1455:1081 landscape aspect ratio and central low ridge summit; no crop changes.
Lighting/mood: serene early-evening dusk, warm residual amber light grazing the ridge, pale powder-blue upper sky fading toward creamy near-white at the horizon, long soft shadows, meadow still clearly readable; no stars yet.
Color palette: #FFB451, #EFC680, #B4D8FF, #FAFDFF, balanced with realistic meadow greens and natural yellow flowers.
Constraints: change only environmental light, sky, and color grade; keep all land geometry and scene contents unchanged; no visible sun disk; no phones, no screens, no devices, no people, no buildings, no added objects, no text, no logos, no watermark.
Avoid: sunset-magenta dominance, fantasy illustration, neon glow, oversaturation, heavy fog, altered ridge shape, changed flower placement, fake HDR.
```

### Sunset

```text
Use case: lighting-weather
Asset type: website case-study thumbnail background plate
Input images: Image 1 is the approved Night alpine-meadow background and the edit target.
Primary request: transform only the time-of-day lighting into SUNSET, while preserving the same alpine meadow, ridge silhouette, distant mountain contours, foreground flower distribution, camera position, lens, horizon, crop, and perspective as Image 1.
Scene/backdrop: wide realistic alpine meadow with yellow wildflowers on a rising ridge and distant mountain silhouettes; phone-free background plate.
Style/medium: premium photorealistic landscape photography; crisp natural microtexture; restrained cinematic color.
Composition/framing: preserve Image 1 exactly, including its 1455:1081 landscape aspect ratio and central low ridge summit; no crop changes.
Lighting/mood: vivid but natural alpine sunset after the sun has slipped behind the right horizon, coral and rose near the horizon blending into soft lilac above, warm pink edge light on grass and flowers, gentle open shadows, luminous quiet atmosphere.
Color palette: #FFA577, #FF90A1, #DDADFF, #F5EAFF, balanced with realistic meadow greens and natural yellow flowers.
Constraints: change only environmental light, sky, and color grade; keep all land geometry and scene contents unchanged; no visible oversized sun disk; no phones, no screens, no devices, no people, no buildings, no added objects, no text, no logos, no watermark.
Avoid: fiery orange dominance, fantasy illustration, neon glow, oversaturation, heavy fog, altered ridge shape, changed flower placement, fake HDR.
```

### Night

No image-generation prompt was used for Night. The approved phone-free source `images/cs/variants/bearings-night-background-proof.png` was used directly and composited with the untouched RGBA master through the same deterministic pipeline as the other states. Its approved palette direction is `#6763E4 #453BB3 #29227D #141E4B` over `#0B0C0F`.

