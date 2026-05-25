---
name: social-media
description: Platform-specific sizing, safe zones, typography rules, and content best practices for 13 social media platforms. Auto-triggers on platform names (Instagram, YouTube, TikTok, Twitter, X, LinkedIn, Threads, Bluesky, Discord, GitHub, Dribbble, Behance, Product Hunt, Substack) and social content keywords (social post, thumbnail, story, reel, carousel, banner, cover image, OG image, open graph, social preview, profile picture, avatar, header image). Provides constraints and validation - the spec sheet, not the paintbrush.
---

# Social Media Design

Platform-specific specifications for 13 platforms. This skill provides the constraints and validation layer. It does not create the visual design itself - that is the job of Sidecoach (for web-based output), the design-team skill (for complex multi-asset sprints), or the agent's own judgment for simple tasks.

## Workflow

1. Detect platform + content type from the user's request
2. Load the spec below (dimensions, safe zones, typography rules)
3. Read PRODUCT.md for brand context + DESIGN.md for tokens (if they exist at the project root)
4. If building with code (React/HTML/CSS): generate at exact pixel dimensions with safe-zone awareness
5. If building for export (static image via Figma or canvas): guide creation at spec dimensions
6. Before reporting done, validate: text within safe zones, minimum font sizes met, brand tokens applied (not hardcoded colors)

## Platform Specifications

### Instagram

| Content Type | Dimensions | Aspect Ratio |
|---|---|---|
| Post (square) | 1080 x 1080 | 1:1 |
| Post (portrait) | 1080 x 1350 | 4:5 |
| Post (landscape) | 1080 x 566 | 1.91:1 |
| Story / Reel | 1080 x 1920 | 9:16 |
| Carousel slide | 1080 x 1350 | 4:5 |
| Profile picture | 320 x 320 | 1:1 |

**Safe zones:** Stories/Reels: keep text/logos outside the top 250px and bottom 250px (UI overlays). Carousel: first slide is the hook - bold headline, minimal text, high contrast.

**Typography minimums:** Body text: 24px minimum at 1080w. Headlines: 48px+ for readability on mobile. Story text: 32px minimum.

**Content patterns:** Carousel hook formula: slide 1 = bold question or statement, slides 2-8 = one idea per slide, last slide = CTA. High-contrast text overlays on photos.

### YouTube

| Content Type | Dimensions | Notes |
|---|---|---|
| Thumbnail | 1280 x 720 | 16:9, max 2MB |
| Channel banner | 2560 x 1440 | Safe area: center 1546 x 423 |
| Shorts cover | 1080 x 1920 | 9:16 |
| Video watermark | 150 x 150 | Transparent PNG |

**Safe zones:** Banner: only the center 1546x423px is visible on all devices. TV shows full 2560x1440. Mobile crops aggressively to ~1546x423. Keep all text/logos in the safe area.

**Typography minimums:** Thumbnail text: 60px+ bold. Must be readable at 160x90px (search results size). Two-three words maximum.

**Content patterns:** Thumbnail formula: expressive face + 2-3 word text + high contrast background. Avoid clutter. Test readability at small size.

### TikTok

| Content Type | Dimensions | Notes |
|---|---|---|
| Video cover | 1080 x 1920 | 9:16 |
| Profile picture | 200 x 200 | 1:1 |

**Safe zones:** Bottom third is obscured by caption/UI. Top 150px has username overlay. Keep key visuals in the center 60% vertically.

**Typography minimums:** 36px minimum for any text overlay at 1080w.

### Twitter / X

| Content Type | Dimensions | Notes |
|---|---|---|
| Post image (single) | 1600 x 900 | 16:9 |
| Post image (two) | 700 x 800 each | 7:8 |
| Header/banner | 1500 x 500 | 3:1 |
| Profile picture | 400 x 400 | 1:1, displayed as circle |
| Card image | 800 x 418 | 1.91:1 (link preview) |

**Safe zones:** Profile picture is circular - keep content away from corners. Header: bottom-left 100px is obscured by profile picture on desktop.

**Typography minimums:** Card images: 36px+ for text. Timeline images: 28px+ at 1600w.

### LinkedIn

| Content Type | Dimensions | Notes |
|---|---|---|
| Post image | 1200 x 627 | 1.91:1 |
| Article cover | 1200 x 644 | ~1.86:1 |
| Company banner | 1584 x 396 | 4:1 |
| Profile picture | 400 x 400 | 1:1 |
| Event cover | 1776 x 444 | 4:1 |

**Safe zones:** Company banner: logo/text centered, as sidebars vary by screen size.

**Typography minimums:** Post images: 28px+ at 1200w. Clean, professional. Avoid meme-style typography.

**Content patterns:** LinkedIn favors clean, professional visuals. Data visualizations, charts, and quote cards perform well. Avoid heavy design - simplicity reads as authority.

### Threads

| Content Type | Dimensions | Notes |
|---|---|---|
| Post image | 1080 x 1080 | 1:1 (square preferred) |
| Carousel slide | 1080 x 1350 | 4:5 |

**Typography minimums:** Same as Instagram (shared Meta platform).

### Bluesky

| Content Type | Dimensions | Notes |
|---|---|---|
| Post card | 1200 x 630 | ~1.91:1 |
| Profile banner | 3000 x 1000 | 3:1 |
| Profile picture | 1000 x 1000 | 1:1 |

**Safe zones:** Banner: center content, similar variability to Twitter header.

### Discord

| Content Type | Dimensions | Notes |
|---|---|---|
| Server icon | 512 x 512 | 1:1, displayed as circle |
| Server banner | 960 x 540 | 16:9 |
| Role icon | 64 x 64 | 1:1, very small |
| Embed thumbnail | 80 x 80 | 1:1 |
| Server splash | 1920 x 1080 | 16:9 (Nitro only) |

**Safe zones:** Server icon: circular crop, keep content in center 70%.

**Typography minimums:** Role icons: no text (too small). Server icons: single letter or simple glyph only.

### GitHub

| Content Type | Dimensions | Notes |
|---|---|---|
| Social preview (OG) | 1280 x 640 | 2:1 |
| Repo avatar | 500 x 500 | 1:1 |
| Profile picture | 500 x 500 | 1:1 |

**Content patterns:** Social preview: project name, one-line description, key visual or logo. Dark backgrounds perform well. Avoid screenshots (too small to read at OG card size).

### Dribbble

| Content Type | Dimensions | Notes |
|---|---|---|
| Shot (standard) | 800 x 600 | 4:3 |
| Shot (retina) | 1600 x 1200 | 4:3 |
| Profile picture | 400 x 300 | 4:3 |

**Content patterns:** First frame is the thumbnail - make it count. Show the best part of the design, not a wide overview.

### Behance

| Content Type | Dimensions | Notes |
|---|---|---|
| Project cover | 808 x 632 | ~1.28:1 |
| Module width | 1400 max | Height flexible |
| Profile cover | 3840 x 2160 | 16:9 |

**Content patterns:** Modules scroll vertically. Design for 1400px wide, any height. Break projects into clear sections.

### Product Hunt

| Content Type | Dimensions | Notes |
|---|---|---|
| Gallery image | 1270 x 760 | ~1.67:1 |
| Logo | 240 x 240 | 1:1 |
| OG card | 1200 x 630 | 1.91:1 |
| Thumbnail | 80 x 80 | 1:1 |

**Content patterns:** Gallery images: show the product in action. First image is the hero. Logo must work at 80x80 thumbnail size.

### Substack

| Content Type | Dimensions | Notes |
|---|---|---|
| Header image | 1100 x 220 | 5:1 |
| Inline graphic | 1100 max width | Height flexible |
| OG card | 1200 x 630 | 1.91:1 |

**Content patterns:** Header images are thin banners. Keep simple - blog name, subtle pattern, or gradient. Inline graphics should be self-contained (readable without surrounding text context).

## Cross-Platform Guidelines

### Color and Contrast
- Design for small screens first. If text isn't readable on a phone, it won't work.
- Test contrast on both light and dark backgrounds (some platforms have dark mode).
- Avoid thin fonts on busy backgrounds.

### Text Overlay Best Practices
- Maximum 20% of the image area should be text (Facebook/Meta enforced this historically; it remains a good heuristic).
- High contrast: dark text on light background or light text on dark background. Never medium-on-medium.
- Text shadow or semi-transparent overlay behind text on photo backgrounds.

### Brand Consistency
- Read PRODUCT.md for voice and register (brand vs product).
- Read DESIGN.md for color tokens, typography, and spacing.
- Use design system tokens, not hardcoded hex values.
- If neither file exists, flag it - social content without brand guidelines leads to inconsistency.

### Export Checklist (before reporting done)
1. Dimensions match the platform spec exactly (not "close enough")
2. Text is within safe zones
3. Text meets minimum font size for the platform
4. Brand tokens applied (not hardcoded colors)
5. Tested at the thumbnail/preview size the platform will display (not just full size)
