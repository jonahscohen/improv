# Product

## Register

tool

## Users

A single developer-designer (the person running it) plus the small circle of engineers they share effects with. The user is technical, comfortable with shader/canvas concepts, and impatient with ceremony. They open tilt-lab locally, on their own machine, to answer one question fast: "what does this visual effect look like, and what does it look like stacked with that other one?"

Context: tilt-lab is served locally, not deployed. It is a workbench, not a product surface. The user is mid-flow on some other project and drops into tilt-lab to audition a background, layer a pointer effect on top, tune the parameters until it feels right, then export a self-contained web-component package they can drop into that other project. They value speed of iteration, density of information, and getting out of the way over polish, onboarding, or hand-holding.

## Product Purpose

tilt-lab is a personal, locally-served visual-effects playground. It does four things:

1. **Browse** a catalog of roughly 25 visual effects, organized across four layer roles: background, midground, pointer, and post (post-process).
2. **Layer** compatible effects into a stack, compositing them live in a single preview canvas.
3. **Tune** each effect's parameters in real time with sliders and inputs, and upload media (image/video) as input for effects that consume it.
4. **Send** the assembled stack to a target project as a framework-agnostic web-component package.

Success means the loop from "I wonder what X looks like" to "this stack is exported and in my project" is measured in seconds, with no build step, no account, and no network round-trip. The preview is always live and always honest: what you see in the canvas is what the exported component renders.

## Brand Personality

Dark, utilitarian, fast. tilt-lab is a precision instrument, not a showpiece. It behaves like a good developer tool: dense, keyboard-friendly, unsurprising, and quiet. It does not celebrate itself, animate gratuitously, or explain what a slider does. The single accent color marks the one thing that matters in any given view (the active filter, the primary action, the selected layer) and nothing else.

Three-word personality: Dark, Utilitarian, Fast.

## Anti-references

Explicitly NOT:

- Marketing-site polish: no hero copy, no gradient meshes used decoratively (the gradients here are the product, shown in a preview, not chrome), no testimonial blocks, no onboarding carousel.
- Light, airy, generous-whitespace SaaS dashboards. tilt-lab is dark, dense, and compact by design.
- Playful or skeuomorphic toy UIs. The controls are functional sliders and lists, not knobs and dials with shadows.
- Heavy framework chrome: no nested modals-on-modals, no multi-step wizards, no settings labyrinth. One window, three columns, one preview.
- AI-slop patterns: repeating identical card grids as decoration, gradient text, side-stripe accent borders for their own sake.

## Design Principles

1. **The preview is the product.** The center canvas is the largest, most important region and must never be crowded out. Side panels serve the preview; they do not compete with it.

2. **Density over breathing room.** This is a developer tool. Pack information tightly, use small type for meta, and keep controls compact. Whitespace is a tool for grouping, not a brand statement.

3. **One accent, used sparingly.** The accent color (`{colors.accent}`) marks the single most relevant thing in a view: the active role filter, the primary Send action, the selected layer. Everywhere else stays neutral grayscale. If two things are accented, neither reads as important.

4. **Speed is a feature.** No build step, no spinner where a synchronous render will do, live parameter feedback. Latency between a slider move and the preview updating is the metric that matters most.

5. **Honest preview.** What renders in the preview canvas is exactly what the exported web component renders. No "preview mode" approximations. The tool earns trust by never lying about output.

## Accessibility & Inclusion

- WCAG 2.1 AA as the floor, even for a personal tool: text contrast against the dark surfaces stays at or above 4.5:1 for body, 3:1 for large/meta.
- Visible `:focus-visible` ring (using the accent color) on every interactive control so keyboard navigation is usable.
- Minimum 40x40px interactive hit area on all buttons, pills, and stack controls, even when the visual glyph is smaller.
- `prefers-reduced-motion` respected: hover/press transforms and transitions disable under reduce. The effect previews themselves are content, not decoration, and are governed separately.
- No color-only signaling: active/selected states pair the accent color with a second cue (text, border, position) so they do not rely on hue alone.
