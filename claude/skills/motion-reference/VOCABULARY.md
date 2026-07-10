# Motion Vocabulary

A reverse-lookup glossary: turn a loose description of a motion effect into its precise name, so requests to designers, teammates, or AI land on the first try. Use it when someone asks "what's it called when..." or describes an effect by feel ("the springy thing", "it draws itself in", "the iOS pull-past-the-end resistance").

## How to answer a naming question

1. Read for the sensation, not keywords - people describe what they see and feel, not the term.
2. Lead with the best-matching term in bold with its one-line definition. If two terms compete, give the best match first and contrast 1-2 alternates in a line each.
3. If nothing here matches exactly, name the closest term and say it is an approximation, or compose the effect from these words ("a stagger of scale-in entrances").
4. A naming question wants a name, not an essay.

Example: "the popover grows out of the button instead of its middle" -> **Origin-aware animation** - the element scales from its trigger via transform-origin rather than from its own center. Contrast case: "one image turns into another" -> **Morph** if the shape itself transforms; **Crossfade** if they only fade over each other in place; **Shared element transition** if the element travels to a new position while transforming.

## Entrances and exits

- **Fade** - appears or disappears through opacity alone.
- **Slide in** - enters from off-screen along one axis.
- **Scale in** - grows from slightly small to full size, usually with a fade.
- **Pop in** - scale-in with a slight overshoot before settling.
- **Reveal** - content uncovered progressively, typically by animating a clip-path or mask.
- **Enter/exit** - the paired animations an element plays when mounted and unmounted.

## Sequencing and timing

- **Keyframes** - fixed waypoints (0%, 50%, 100%) the browser interpolates between.
- **Tween/interpolation** - the generated in-between frames from one value to another.
- **Stagger** - a cascade: items animate one after another with a small delay between each.
- **Orchestration** - timing multiple animations so they read as one coordinated motion.
- **Delay / duration / fill mode** - when it starts, how long it runs, and which frame's styles persist outside the run (e.g. `forwards`).
- **Stepped animation** - discrete jumps instead of smooth interpolation (countdowns, ticks).

## Movement and transforms

- **Translate / scale / rotate / skew** - move, resize, spin, shear.
- **3D tilt / flip** - rotateX/rotateY depth; **perspective** controls how exaggerated the depth reads.
- **Transform origin** - the anchor a scale or rotation grows from.
- **Origin-aware animation** - animating from the trigger (a popover growing out of its button) instead of the CSS default center.

## Transitions between states

- **Crossfade** - one element fades out while its replacement fades in, in place.
- **Continuity transition** - the before and after stay visually connected so the user never loses orientation.
- **Morph** - one shape smoothly becomes another.
- **Shared element transition** - an element travels and transforms from one position/size into another (thumbnail expanding into a detail card).
- **Layout animation** - size/position changes animate to their new values instead of snapping (the FLIP technique below is how it is usually implemented).
- **Accordion/collapse** - height expands and collapses to show or hide content.
- **Direction-aware transition** - forward navigation slides one way, back slides the other, giving navigation a sense of direction.
- **View transition** - the browser-native morph between two DOM states or pages, connecting shared elements.

## Scroll mechanics

- **Scroll reveal** - elements fade or slide in as they enter the viewport.
- **Scroll-driven animation** - progress bound directly to scroll position rather than time.
- **Scrub** - the scroll-driven case where scrolling backward rewinds the animation; the scrollbar is the playhead.
- **Pin** - a section holds fixed while the page scrolls past, usually while a scrubbed animation plays out.
- **Snap** - scroll settles to defined stops (sections, carousel items) instead of resting anywhere.
- **Parallax** - layers move at different speeds under scroll, creating depth.
- **Smooth scroll** - easing applied to the scroll position itself, replacing the browser's raw wheel steps.
- **Page transition** - the animation between routes.

## Feedback and interaction

- **Hover effect** - visual response to the pointer resting on an element.
- **Press feedback** - the subtle scale-down on click that makes an element feel physical.
- **Hold to confirm** - a fill that progresses while the user keeps pressing.
- **Drag / drag to reorder / swipe to dismiss** - grab-and-move, list rearrangement with items shifting to make room, and dragging off-screen to close.
- **Rubber-banding** - resistance and snap-back when dragging past a boundary.
- **Shake/wiggle** - a quick jitter signaling rejection or error.
- **Ripple** - a circle expanding from the tap point.

## Easing

- **Easing** - how speed changes across the run.
- **Ease-out** - fast start, slow settle; the default for UI and anything responding to the user.
- **Ease-in** - slow start; almost always wrong for UI (it is slowest at the moment the user watches).
- **Ease-in-out** - for elements already on screen moving between positions.
- **Linear** - constant speed; reserve for spinners and marquees.
- **Cubic-bezier** - a custom curve; **asymmetric easing** accelerates and decelerates at different rates and feels more alive than symmetric curves.

## Springs

- **Spring** - physics-driven motion (no fixed duration; it settles).
- **Stiffness/tension, damping, mass** - pull strength toward the target, how fast oscillation dies, how heavy it feels.
- **Bounce** - overshoot-and-settle playfulness.
- **Momentum/velocity** - carried speed, especially out of a drag; a spring inherits it when interrupted.
- **Perceptual duration** - when a spring feels finished, though it micro-settles after.
- **Interruptible animation** - motion that redirects smoothly mid-flight instead of finishing first.

## Looping and ambient motion

- **Marquee** - continuously scrolling content.
- **Loop / alternate (yoyo)** - repeats; yoyo plays forward then reverses each cycle.
- **Orbit / pulse / float** - circling another element; gentle repeating scale/opacity to draw attention; a slow continuous drift that makes a static element feel alive.
- **Idle animation** - subtle motion while an element waits to be used.

## Polish and effects

- **Blur** - softening, or masking a rough crossfade with a small transitional blur.
- **Clip-path / mask** - hard-edged vs soft-edged shape clipping for reveals and wipes.
- **Before/after slider** - a draggable divider wiping between two overlaid images.
- **Line drawing** - an SVG path tracing itself in.
- **Split-text reveal** - text animated per character, word, or line (the usual mechanism behind dramatic headline entrances).
- **Text morph** - text animating character-by-character as its value changes.
- **Number ticker** - digits rolling to a value; pair with **tabular numbers** (fixed-width digits) so nothing shifts.
- **Skeleton/shimmer** - loading placeholder with a moving sheen.
- **Typewriter** - characters appearing as if typed.

## Performance words

- **FPS / dropped frame / jank** - the frame budget, a missed frame, and the visible stutter missed frames cause.
- **Compositing / hardware acceleration** - the GPU moving or fading a layer without re-running layout or paint; why transform and opacity are the safe properties.
- **will-change** - a hint to promote an element to its own layer before it animates.
- **Layout thrashing** - animating width/height/top/left so layout recalculates every frame.

## Principles

- **Purposeful animation** - motion serves orientation, feedback, or relationships, not decoration.
- **Frequency of use** - the more often motion is seen, the shorter and subtler it must be.
- **Anticipation / follow-through / squash and stretch** - the wind-up before a move, the settle after it, and the deformation that conveys weight.
- **Spatial consistency** - elements keep their identity across states so users track where things went.
- **Perceived performance** - the right motion makes an interface feel faster at identical actual speed.
- **Reduced motion** - honoring prefers-reduced-motion by toning down rather than deleting comprehension-aiding transitions.
- **FLIP** - First, Last, Invert, Play: measure the before and after, transform the element back to its old position, then animate the transform away - layout animation at GPU cost.
