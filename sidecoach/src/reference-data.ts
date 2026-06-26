// Reference Data Service
// Provides centralized access to embedded design system references:
// - Component.gallery index (60 types, 95 systems)
// - Fontshare catalog (type families + licensing)
// - GSAP/Lenis motion patterns
// - Design references from ~/.claude/design-references/
// - Design tokens from DESIGN.md (google-labs-code spec)

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ComponentPattern {
  name: string;
  type: string;
  systems: string[];
  description: string;
  accessibility: string;
  implementation: string;
  variants: string[];
  constraints?: string[];
}

export interface ComponentLibrary {
  [key: string]: ComponentPattern;
}

export interface Typeface {
  name: string;
  styles: string[];
  weights: string[];
  personality: string[];
  pairing?: string;
  licensing: string;
  source: string;
}

export interface FontCatalog {
  [key: string]: Typeface;
}

export interface MotionPattern {
  name: string;
  category: string;
  description: string;
  code: string;
  dependencies: string[];
  performance: string;
  interruption: string;
}

export interface MotionLibrary {
  [key: string]: MotionPattern;
}

export interface DesignReference {
  id: string;
  title: string;
  category: string;
  patterns: string[];
  feel: string[];
  source: string;
  url: string;
  saved: string;
  description: string;
}

export interface DesignTokens {
  colors?: { [key: string]: any };
  typography?: { [key: string]: any };
  spacing?: { [key: string]: any };
  rounded?: { [key: string]: any };
  shadow?: { [key: string]: any };
  motion?: { [key: string]: any };
  components?: { [key: string]: any };
}

export interface DesignReferenceIndex {
  [key: string]: DesignReference;
}

export class ReferenceDataService {
  private componentIndex: ComponentLibrary;
  private fontCatalog: FontCatalog;
  private motionPatterns: MotionLibrary;
  private designReferences: DesignReferenceIndex;
  private designTokens: DesignTokens;

  constructor() {
    this.componentIndex = this.loadComponentIndex();
    this.fontCatalog = this.loadFontCatalog();
    this.motionPatterns = this.loadMotionPatterns();
    this.designReferences = this.loadDesignReferences();
    this.designTokens = this.loadDesignTokens();
  }

  // COMPONENT.GALLERY INDEX (60+ types across 95+ systems)
  private loadComponentIndex(): ComponentLibrary {
    return {
      // ACTION COMPONENTS
      button: {
        name: 'Button',
        type: 'action_component',
        systems: ['Material Design', 'Apple HIG', 'Bootstrap', 'Ant Design', 'Fluent UI', 'Carbon', 'Chakra', 'shadcn'],
        description: 'Primary interactive element for user actions',
        accessibility: 'Keyboard accessible, focus management, semantic HTML <button>',
        implementation: 'Primary, secondary, danger, ghost states with hover/active/disabled',
        variants: ['primary', 'secondary', 'danger', 'ghost', 'outline'],
        constraints: ['40x40px minimum hit area', 'No transition: all', 'Scale 0.96 on press'],
      },
      button_group: {
        name: 'Button Group',
        type: 'action_component',
        systems: ['Material Design', 'Bootstrap', 'Ant Design', 'Chakra'],
        description: 'Multiple buttons grouped together',
        accessibility: 'Grouped button semantics, keyboard navigation',
        implementation: 'Buttons arranged horizontally or vertically with visual grouping',
        variants: ['horizontal', 'vertical', 'segmented'],
        constraints: ['Remove border radius between adjacent buttons', 'Maintain 40x40px minimum'],
      },
      fab: {
        name: 'FAB (Floating Action Button)',
        type: 'action_component',
        systems: ['Material Design', 'Ant Design'],
        description: 'Primary action button that floats above content',
        accessibility: 'Focus visible, accessible labels, avoid blocking content',
        implementation: 'Circular or rounded button with icon, positioned fixed/absolute',
        variants: ['primary', 'secondary', 'extended'],
        constraints: ['64x64px minimum (Android), circular, elevation shadow'],
      },
      icon_button: {
        name: 'Icon Button',
        type: 'action_component',
        systems: ['Material Design', 'Apple HIG', 'Bootstrap', 'Chakra'],
        description: 'Button containing only an icon without text',
        accessibility: 'aria-label required, minimum 44x44px hit area',
        implementation: 'Icon-only button with hover/active states',
        variants: ['standard', 'outlined', 'filled'],
        constraints: ['Minimum 44x44px', 'aria-label or sr-only text required'],
      },
      link: {
        name: 'Link',
        type: 'action_component',
        systems: ['Material Design', 'Apple HIG', 'Bootstrap', 'Chakra', 'shadcn'],
        description: 'Navigational element for URLs',
        accessibility: 'Semantic <a> tag, visible focus state, descriptive link text',
        implementation: 'Text link with underline and hover state',
        variants: ['primary', 'secondary', 'external', 'disabled'],
        constraints: ['Underline on hover', 'Distinguishable from body text', 'Avoid "click here"'],
      },

      // FORM COMPONENTS
      input_field: {
        name: 'Input Field',
        type: 'form_component',
        systems: ['Material Design', 'Apple HIG', 'Bootstrap', 'Ant Design', 'Chakra', 'shadcn'],
        description: 'Text input for user data entry',
        accessibility: 'Associated label, error messages, disabled state, aria-invalid',
        implementation: 'Field + label + optional help text and error state',
        variants: ['text', 'email', 'password', 'search', 'number', 'disabled', 'error'],
        constraints: ['Focus outline', 'Placeholder guidance', 'Autocomplete support'],
      },
      textarea: {
        name: 'Textarea',
        type: 'form_component',
        systems: ['Material Design', 'Bootstrap', 'Chakra', 'shadcn'],
        description: 'Multi-line text input for longer content',
        accessibility: 'Associated label, character count (if limited), resize handling',
        implementation: 'Resizable text area with label and optional counter',
        variants: ['fixed', 'auto_expand', 'resizable'],
        constraints: ['Min 4 rows, max-height limit', 'Keyboard resize support'],
      },
      checkbox: {
        name: 'Checkbox',
        type: 'form_component',
        systems: ['Material Design', 'Apple HIG', 'Bootstrap', 'Chakra', 'shadcn'],
        description: 'Multiple selection input',
        accessibility: 'Semantic <input type="checkbox">, label association, focus outline',
        implementation: 'Checkbox + label, supports indeterminate state',
        variants: ['checked', 'unchecked', 'indeterminate', 'disabled'],
        constraints: ['44x44px minimum hit area', 'Label adjacent or clickable'],
      },
      radio_button: {
        name: 'Radio Button',
        type: 'form_component',
        systems: ['Material Design', 'Apple HIG', 'Bootstrap', 'Chakra', 'shadcn'],
        description: 'Single selection from mutually exclusive options',
        accessibility: 'Semantic <input type="radio">, grouping with fieldset, keyboard support',
        implementation: 'Radio button + label, grouped by name attribute',
        variants: ['selected', 'unselected', 'disabled'],
        constraints: ['44x44px minimum', 'Arrow keys for navigation', 'Group semantics'],
      },
      toggle_switch: {
        name: 'Toggle Switch',
        type: 'form_component',
        systems: ['Material Design', 'Apple HIG', 'Chakra', 'shadcn'],
        description: 'Binary on/off control',
        accessibility: 'ARIA switch role, keyboard accessible, animated transition',
        implementation: 'Animated toggle with label',
        variants: ['on', 'off', 'disabled'],
        constraints: ['Animate state change', 'Keyboard support', 'Clear on/off indication'],
      },
      select_dropdown: {
        name: 'Select / Dropdown',
        type: 'form_component',
        systems: ['Material Design', 'Bootstrap', 'Ant Design', 'Chakra'],
        description: 'Choose from predefined list of options',
        accessibility: 'Native <select> or ARIA listbox, keyboard navigation',
        implementation: 'Dropdown trigger + option list with keyboard support',
        variants: ['single_select', 'multi_select', 'searchable', 'native'],
        constraints: ['Keyboard arrow key support', 'Search in multi-select', '40x40px minimum'],
      },
      date_picker: {
        name: 'Date Picker',
        type: 'form_component',
        systems: ['Material Design', 'Apple HIG', 'Bootstrap', 'Ant Design'],
        description: 'Select a date from calendar interface',
        accessibility: 'ARIA roles (dialog, button), keyboard navigation, screen reader support',
        implementation: 'Input + calendar popup or native date input',
        variants: ['single_date', 'date_range', 'native'],
        constraints: ['Keyboard navigation', 'Today button', 'Clear button for mobile'],
      },
      time_picker: {
        name: 'Time Picker',
        type: 'form_component',
        systems: ['Material Design', 'Apple HIG', 'Ant Design'],
        description: 'Select time from picker interface',
        accessibility: 'ARIA dialog role, keyboard navigation',
        implementation: 'Input + time picker (analog clock or spinners)',
        variants: ['12hour', '24hour', 'native'],
        constraints: ['Keyboard support', 'Minute increments configurable'],
      },
      file_upload: {
        name: 'File Upload',
        type: 'form_component',
        systems: ['Material Design', 'Bootstrap', 'Chakra'],
        description: 'Allow users to upload files',
        accessibility: 'Native input type="file" or drag-drop area, clear instructions',
        implementation: 'File input + optional drag-drop zone',
        variants: ['native', 'drag_drop', 'with_preview'],
        constraints: ['Accept attribute for file types', 'File size validation', 'Drag-drop feedback'],
      },
      slider: {
        name: 'Slider',
        type: 'form_component',
        systems: ['Material Design', 'Chakra', 'shadcn'],
        description: 'Select value from continuous range',
        accessibility: 'ARIA slider role, keyboard arrow keys, value indicator',
        implementation: 'Draggable handle on track with value display',
        variants: ['single', 'range', 'vertical'],
        constraints: ['Keyboard step support', 'Touch-friendly', 'Value label on drag'],
      },

      // NAVIGATION COMPONENTS
      dropdown_menu: {
        name: 'Dropdown Menu',
        type: 'navigation_component',
        systems: ['Material Design', 'Apple HIG', 'Bootstrap', 'Ant Design', 'Chakra'],
        description: 'Expandable menu for multiple options',
        accessibility: 'Keyboard navigation, ARIA roles, focus management, Escape to close',
        implementation: 'Trigger button + list with keyboard support',
        variants: ['simple', 'with_icons', 'with_descriptions', 'nested'],
        constraints: ['Min 40x40px items', 'Position relative to viewport', 'Max 400px height'],
      },
      sidebar: {
        name: 'Sidebar / Navigation Drawer',
        type: 'navigation_component',
        systems: ['Material Design', 'Apple HIG', 'Bootstrap'],
        description: 'Fixed or collapsible side navigation panel',
        accessibility: 'ARIA navigation role, skip links, keyboard focus trap when modal',
        implementation: 'Vertical nav panel with collapsible state',
        variants: ['persistent', 'temporary', 'collapsible'],
        constraints: ['Scrim overlay when temporary', 'Smooth transitions', 'Keyboard close (Escape)'],
      },
      tabs: {
        name: 'Tabs',
        type: 'navigation_component',
        systems: ['Material Design', 'Apple HIG', 'Bootstrap', 'Chakra', 'shadcn'],
        description: 'Switch between grouped content sections',
        accessibility: 'ARIA tablist/tab/tabpanel roles, keyboard navigation (arrow keys), focus management',
        implementation: 'Tab buttons + content panels with active indicator',
        variants: ['simple', 'scrollable', 'underlined'],
        constraints: ['Keyboard arrow key support', 'Clear active indicator', 'Panel auto-focus'],
      },
      breadcrumbs: {
        name: 'Breadcrumbs',
        type: 'navigation_component',
        systems: ['Material Design', 'Bootstrap', 'Chakra'],
        description: 'Show current location in site hierarchy',
        accessibility: 'Semantic nav element, aria-current="page", slash separator',
        implementation: 'List of links with separator icons',
        variants: ['standard', 'with_icons'],
        constraints: ['Current page not clickable', 'Use aria-current="page"'],
      },
      pagination: {
        name: 'Pagination',
        type: 'navigation_component',
        systems: ['Material Design', 'Ant Design', 'Bootstrap', 'Chakra'],
        description: 'Navigate between pages of content',
        accessibility: 'ARIA labels, semantic links/buttons, current page indicator, disabled state',
        implementation: 'Previous, page numbers, next with disabled states',
        variants: ['numbered', 'simplified', 'with_size_selector'],
        constraints: ['Minimum 44x44px buttons', 'Clear current page indication'],
      },
      stepper: {
        name: 'Stepper / Step Indicator',
        type: 'navigation_component',
        systems: ['Material Design', 'Ant Design'],
        description: 'Show progress through multi-step process',
        accessibility: 'ARIA progressbar, step labels, current step indication',
        implementation: 'Connected steps with labels and optional descriptions',
        variants: ['horizontal', 'vertical', 'editable'],
        constraints: ['Clear step titles', 'Visual connection between steps', 'Disabled future steps'],
      },

      // CONTAINER COMPONENTS
      card: {
        name: 'Card',
        type: 'container_component',
        systems: ['Material Design', 'Apple HIG', 'Bootstrap', 'Ant Design', 'Chakra', 'shadcn'],
        description: 'Container for grouped related content',
        accessibility: 'Semantic structure (section or article), heading hierarchy',
        implementation: 'Border, shadow, padding with optional action buttons',
        variants: ['elevated', 'outlined', 'filled'],
        constraints: ['Concentric radius', 'Shadows over borders', 'Responsive padding'],
      },
      panel: {
        name: 'Panel / Box',
        type: 'container_component',
        systems: ['Bootstrap', 'Chakra', 'shadcn'],
        description: 'Basic container with padding and optional styling',
        accessibility: 'Use semantic elements inside (section, article, div)',
        implementation: 'Div with padding, border, and background',
        variants: ['default', 'outlined', 'elevated'],
        constraints: ['No forced aspect ratio', 'Flexible content'],
      },
      well: {
        name: 'Well / Alert',
        type: 'container_component',
        systems: ['Bootstrap'],
        description: 'Highlighted section with distinct background',
        accessibility: 'Use role="alert" if time-sensitive, aria-live for updates',
        implementation: 'Container with background color and border',
        variants: ['success', 'warning', 'danger', 'info'],
        constraints: ['Sufficient color contrast', 'Not color-only indication'],
      },
      accordion: {
        name: 'Accordion',
        type: 'container_component',
        systems: ['Material Design', 'Bootstrap', 'Chakra'],
        description: 'Collapsible sections for organizing content',
        accessibility: 'ARIA button roles, aria-expanded, keyboard support',
        implementation: 'Headers with toggle buttons + content panels',
        variants: ['single_expand', 'multi_expand'],
        constraints: ['Keyboard support (Enter/Space)', 'Smooth expand/collapse animation'],
      },
      tabs_content: {
        name: 'Tab Panels',
        type: 'container_component',
        systems: ['Material Design', 'Bootstrap', 'Chakra'],
        description: 'Content container paired with tab navigation',
        accessibility: 'ARIA tabpanel role, aria-labelledby for association',
        implementation: 'Hidden by default, shown when tab active',
        variants: ['fade', 'slide', 'instant'],
        constraints: ['Hidden tabs not in tab order', 'aria-labelledby to tab button'],
      },

      // FEEDBACK COMPONENTS
      toast_notification: {
        name: 'Toast',
        type: 'feedback_component',
        systems: ['Material Design', 'Apple HIG', 'Chakra', 'shadcn'],
        description: 'Non-blocking notification message',
        accessibility: 'aria-live="polite", auto-dismiss timing accessible',
        implementation: 'Message + optional action button, auto-dismiss after 4-6s',
        variants: ['success', 'error', 'warning', 'info'],
        constraints: ['Fixed position', 'Stack vertically', 'Auto-dismiss without user input'],
      },
      snackbar: {
        name: 'Snackbar',
        type: 'feedback_component',
        systems: ['Material Design'],
        description: 'Brief feedback message at bottom of screen',
        accessibility: 'aria-live region, accessible dismiss',
        implementation: 'Temporary message with optional action',
        variants: ['simple', 'with_action'],
        constraints: ['Bottom placement', 'Auto-dismiss in 3-6 seconds'],
      },
      alert: {
        name: 'Alert',
        type: 'feedback_component',
        systems: ['Bootstrap', 'Chakra', 'shadcn'],
        description: 'Important message requiring user attention',
        accessibility: 'role="alert" for critical alerts, sufficient color contrast',
        implementation: 'Message box with icon and optional close button',
        variants: ['success', 'error', 'warning', 'info'],
        constraints: ['Semantic role', 'Icon + text (not color-only)', 'Accessible close button'],
      },
      progress_bar: {
        name: 'Progress Bar',
        type: 'feedback_component',
        systems: ['Material Design', 'Apple HIG', 'Bootstrap', 'Chakra'],
        description: 'Visual indicator of operation progress',
        accessibility: 'aria-valuenow, aria-valuemin, aria-valuemax, aria-label',
        implementation: 'Animated bar with percentage or indeterminate state',
        variants: ['determinate', 'indeterminate', 'buffered'],
        constraints: ['Smooth animation', 'Accessible color contrast', 'No animation on load'],
      },
      skeleton: {
        name: 'Skeleton Loader',
        type: 'feedback_component',
        systems: ['Material Design', 'Chakra'],
        description: 'Placeholder while content loads',
        accessibility: 'aria-busy="true", optional loading text alternative',
        implementation: 'Gray placeholder matching content shape',
        variants: ['circular', 'rectangular', 'text'],
        constraints: ['Smooth pulse animation', 'aria-busy attribute'],
      },
      tooltip: {
        name: 'Tooltip',
        type: 'feedback_component',
        systems: ['Material Design', 'Apple HIG', 'Chakra', 'shadcn'],
        description: 'Contextual hint on hover/focus',
        accessibility: 'aria-describedby, only shown on hover/focus, dismissible with Escape',
        implementation: 'Trigger element + positioned overlay with arrow',
        variants: ['top', 'bottom', 'left', 'right'],
        constraints: ['Portal/teleport to avoid overflow', 'Max 200px width', 'No interactive content'],
      },
      popover: {
        name: 'Popover',
        type: 'feedback_component',
        systems: ['Bootstrap', 'Chakra'],
        description: 'Rich content overlay with more info than tooltip',
        accessibility: 'Focus management, Escape to close, dialog semantics optional',
        implementation: 'Trigger + positioned content with arrow',
        variants: ['click', 'hover', 'focus'],
        constraints: ['Can contain interactive elements', 'Portal to avoid overflow'],
      },

      // OVERLAY COMPONENTS
      modal_dialog: {
        name: 'Modal Dialog',
        type: 'overlay_component',
        systems: ['Material Design', 'Apple HIG', 'Bootstrap', 'Fluent UI', 'Carbon', 'Chakra'],
        description: 'Overlay container for critical information or user input',
        accessibility: 'Focus trap, ARIA roles (dialog, alertdialog), keyboard escape to close',
        implementation: 'Header, body, footer with optional backdrop and animations',
        variants: ['standard', 'alert', 'full_screen'],
        constraints: ['Scrollable content for long dialogs', 'Backdrop blur or fade'],
      },
      drawer: {
        name: 'Drawer / Slide-Out Panel',
        type: 'overlay_component',
        systems: ['Material Design', 'Chakra'],
        description: 'Side panel that slides in from edge',
        accessibility: 'Focus trap when open, ARIA roles, Escape to close',
        implementation: 'Positioned panel with scrim, slides in from edge',
        variants: ['left', 'right', 'top', 'bottom'],
        constraints: ['Smooth slide animation', 'Keyboard close support'],
      },

      // DATA DISPLAY COMPONENTS
      table: {
        name: 'Table / Data Grid',
        type: 'data_display_component',
        systems: ['Material Design', 'Bootstrap', 'Ant Design'],
        description: 'Display tabular data in rows and columns',
        accessibility: 'Semantic <table> element, header scope, sortable column announcements',
        implementation: 'Table with headers, rows, optional sorting/filtering',
        variants: ['basic', 'striped', 'bordered', 'hover', 'dense'],
        constraints: ['Semantic table markup', 'Sortable column announcements', 'Responsive handling'],
      },
      list: {
        name: 'List',
        type: 'data_display_component',
        systems: ['Material Design', 'Apple HIG', 'Bootstrap'],
        description: 'Display series of items in order',
        accessibility: 'Semantic <ul>/<ol>, ARIA listbox for interactive lists',
        implementation: 'Ordered/unordered list with items',
        variants: ['ordered', 'unordered', 'interactive_listbox'],
        constraints: ['Semantic markup', 'Keyboard navigation for interactive lists'],
      },
      badge: {
        name: 'Badge / Label',
        type: 'data_display_component',
        systems: ['Material Design', 'Bootstrap', 'Chakra'],
        description: 'Small indicator for status or count',
        accessibility: 'Contextual content, not for color-only indication',
        implementation: 'Small colored container with text',
        variants: ['neutral', 'success', 'warning', 'error', 'info'],
        constraints: ['Sufficient color contrast', 'Accessible labels'],
      },
      avatar: {
        name: 'Avatar',
        type: 'data_display_component',
        systems: ['Material Design', 'Bootstrap', 'Chakra'],
        description: 'Profile image or initials representation',
        accessibility: 'alt text for images, aria-label for initials',
        implementation: 'Circular image or text placeholder',
        variants: ['image', 'initials', 'icon'],
        constraints: ['Square crop', 'Fallback to initials or icon'],
      },
      tag: {
        name: 'Tag / Chip',
        type: 'data_display_component',
        systems: ['Material Design', 'Ant Design', 'Chakra'],
        description: 'Removable label or category indicator',
        accessibility: 'Delete button accessible, aria-label for remove',
        implementation: 'Container with text + optional delete button',
        variants: ['closeable', 'non_closeable', 'input_chip'],
        constraints: ['40x40px minimum delete button', 'Keyboard delete support'],
      },

      // APPENDED 2026-06-23 (Jonah Cohen): real component.gallery types from the
      // component-gallery-reference skill's Step-1 type table. PROVENANCE (self-documenting):
      //  - name + "user says" synonyms + gallery slug: VERBATIM from the component-gallery skill.
      //  - systems: the single honest provenance 'component.gallery' (no unverified systems claimed).
      //  - accessibility / variants / constraints: follow the W3C ARIA Authoring Practices
      //    Guide (APG) conventions for each pattern (an authoritative source) - not invented.
      // Purely additive: no existing entry was modified.
      combobox: {
        name: 'Combobox',
        type: 'form_component',
        systems: ['component.gallery'],
        description: 'Text input combined with a filtered list of suggestions (autocomplete / autosuggest)',
        accessibility: 'ARIA combobox pattern: role="combobox", aria-expanded, aria-controls, aria-activedescendant; arrow-key navigation of options',
        implementation: 'Input + popup listbox, filters options as the user types; gallery slug /components/combobox/',
        variants: ['single_select', 'multi_select', 'async_loaded'],
        constraints: ['Keyboard arrow + Enter selection', 'Announce result count to screen readers', 'Visible focus on active option'],
      },
      spinner: {
        name: 'Spinner',
        type: 'feedback_component',
        systems: ['component.gallery'],
        description: 'Indeterminate loading indicator (loading / loader)',
        accessibility: 'role="status" with aria-live="polite" and an accessible label; respect prefers-reduced-motion',
        implementation: 'Animated indicator shown while content loads; gallery slug /components/spinner/',
        variants: ['indeterminate', 'determinate', 'inline', 'overlay'],
        constraints: ['Accessible loading label', 'Honor prefers-reduced-motion', 'Avoid layout shift when content arrives'],
      },
      separator: {
        name: 'Separator',
        type: 'data_display_component',
        systems: ['component.gallery'],
        description: 'Visual divider between content groups (divider / horizontal rule)',
        accessibility: 'Semantic <hr> or role="separator" with aria-orientation; decorative separators marked aria-hidden',
        implementation: 'Thin rule or spacing between sections; gallery slug /components/separator/',
        variants: ['horizontal', 'vertical', 'with_label'],
        constraints: ['1px hairline, not heavier', 'Do not overuse - whitespace often suffices'],
      },
      hero: {
        name: 'Hero',
        type: 'container_component',
        systems: ['component.gallery'],
        description: 'Prominent above-the-fold introductory section (jumbotron)',
        accessibility: 'Semantic landmark/section with a single h1, sufficient contrast over any background media',
        implementation: 'Headline + supporting copy + primary CTA, optionally over media or a background; gallery slug /components/hero/',
        variants: ['centered', 'split', 'with_media', 'with_background'],
        constraints: ['One primary CTA', 'Maintain contrast over imagery', 'text-wrap: balance on the headline'],
      },
      carousel: {
        name: 'Carousel',
        type: 'data_display_component',
        systems: ['component.gallery'],
        description: 'Rotating set of slides or cards (content slider)',
        accessibility: 'ARIA carousel: role="group"/region, tablist for dot controls, keyboard navigation, pause control, respect prefers-reduced-motion',
        implementation: 'Horizontally paged slides with prev/next + indicators; gallery slug /components/carousel/',
        variants: ['slides', 'cards', 'autoplay'],
        constraints: ['Provide pause/stop for autoplay', 'Keyboard reachable controls', 'Honor prefers-reduced-motion'],
      },
      segmented_control: {
        name: 'Segmented Control',
        type: 'action_component',
        systems: ['component.gallery'],
        description: 'Compact set of mutually-exclusive options shown inline (toggle button group)',
        accessibility: 'role="radiogroup" with role="radio" segments (or a styled radio set); arrow-key navigation between segments',
        implementation: 'Inline segments where exactly one is selected; gallery slug /components/segmented-control/',
        variants: ['two_segment', 'multi_segment', 'icon', 'with_label'],
        constraints: ['44x44px minimum per segment', 'Single selection enforced', 'Clear selected-state contrast'],
      },
    };
  }

  // FONTSHARE CATALOG
  private loadFontCatalog(): FontCatalog {
    return {
      inter: {
        name: 'Inter',
        styles: ['regular', 'italic'],
        weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
        personality: ['professional', 'modern', 'geometric', 'neutral'],
        pairing: 'JetBrains Mono (mono)',
        licensing: 'Open Font License',
        source: 'fontshare.com',
      },
      poppins: {
        name: 'Poppins',
        styles: ['regular', 'italic'],
        weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
        personality: ['friendly', 'playful', 'modern', 'rounded'],
        pairing: 'IBM Plex Mono (mono)',
        licensing: 'Open Font License',
        source: 'fontshare.com',
      },
      crimson_text: {
        name: 'Crimson Text',
        styles: ['regular', 'italic'],
        weights: ['400', '600'],
        personality: ['elegant', 'serif', 'editorial', 'classic'],
        pairing: 'Source Code Pro (mono)',
        licensing: 'Open Font License',
        source: 'fontshare.com',
      },
      space_mono: {
        name: 'Space Mono',
        styles: ['regular', 'bold'],
        weights: ['400', '700'],
        personality: ['monospace', 'technical', 'code', 'minimal'],
        pairing: 'Open Sans (sans)',
        licensing: 'Open Font License',
        source: 'fontshare.com',
      },
      system_fonts: {
        name: 'System Stack',
        styles: ['regular', 'italic'],
        weights: ['400', '500', '600', '700'],
        personality: ['native', 'fast', 'system', 'performant'],
        pairing: 'System monospace',
        licensing: 'System license',
        source: 'system',
      },
    };
  }

  // GSAP + LENIS MOTION PATTERNS (20+ patterns)
  private loadMotionPatterns(): MotionLibrary {
    return {
      // ENTRANCE ANIMATIONS
      tween_fade_in: {
        name: 'Fade In',
        category: 'entrance',
        description: 'Simple opacity transition on element entry',
        code: `gsap.from(element, {
  opacity: 0,
  duration: 0.6,
  ease: "power2.out",
})`,
        dependencies: ['gsap'],
        performance: 'minimal',
        interruption: 'interruptible',
      },
      tween_scale_pop: {
        name: 'Scale Pop',
        category: 'entrance',
        description: 'Entrance with scale + opacity for emphasis',
        code: `gsap.from(element, {
  opacity: 0,
  scale: 0.8,
  duration: 0.5,
  ease: "back.out",
})`,
        dependencies: ['gsap'],
        performance: 'minimal',
        interruption: 'interruptible',
      },
      slide_in_left: {
        name: 'Slide In Left',
        category: 'entrance',
        description: 'Element slides in from left side',
        code: `gsap.from(element, {
  x: -100,
  opacity: 0,
  duration: 0.6,
  ease: "power3.out",
})`,
        dependencies: ['gsap'],
        performance: 'minimal',
        interruption: 'interruptible',
      },
      slide_in_top: {
        name: 'Slide In Top',
        category: 'entrance',
        description: 'Element slides down from top',
        code: `gsap.from(element, {
  y: -50,
  opacity: 0,
  duration: 0.5,
  ease: "power2.out",
})`,
        dependencies: ['gsap'],
        performance: 'minimal',
        interruption: 'interruptible',
      },
      stagger_children: {
        name: 'Stagger Children',
        category: 'entrance',
        description: 'Staggered animation of child elements',
        code: `gsap.from(children, {
  opacity: 0,
  y: 20,
  duration: 0.5,
  stagger: 0.1,
  ease: "power2.out",
})`,
        dependencies: ['gsap'],
        performance: 'minimal',
        interruption: 'interruptible',
      },
      rotate_in: {
        name: 'Rotate In',
        category: 'entrance',
        description: 'Element rotates in with opacity',
        code: `gsap.from(element, {
  rotation: -15,
  opacity: 0,
  duration: 0.6,
  ease: "back.out",
})`,
        dependencies: ['gsap'],
        performance: 'minimal',
        interruption: 'interruptible',
      },

      // SCROLL ANIMATIONS
      scroll_trigger_pin: {
        name: 'Scroll Pin',
        category: 'scroll',
        description: 'Pin element during scroll through section',
        code: `gsap.registerPlugin(ScrollTrigger);
gsap.to(element, {
  scrollTrigger: {
    trigger: trigger,
    pin: true,
    pinSpacing: false,
  },
})`,
        dependencies: ['gsap', 'scrolltrigger'],
        performance: 'medium',
        interruption: 'interruptible',
      },
      scroll_reveal: {
        name: 'Scroll Reveal',
        category: 'scroll',
        description: 'Element reveals when scrolled into view',
        code: `gsap.registerPlugin(ScrollTrigger);
gsap.from(element, {
  scrollTrigger: {
    trigger: element,
    start: "top 80%",
    end: "top 50%",
    scrub: false,
  },
  opacity: 0,
  y: 100,
  ease: "power2.out",
})`,
        dependencies: ['gsap', 'scrolltrigger'],
        performance: 'medium',
        interruption: 'interruptible',
      },
      parallax: {
        name: 'Parallax Scroll',
        category: 'scroll',
        description: 'Element moves at different speed than scroll',
        code: `gsap.registerPlugin(ScrollTrigger);
gsap.to(element, {
  y: 100,
  scrollTrigger: {
    trigger: element,
    start: "top bottom",
    end: "bottom top",
    scrub: 1,
  },
})`,
        dependencies: ['gsap', 'scrolltrigger'],
        performance: 'medium',
        interruption: 'interruptible',
      },
      lenis_smooth_scroll: {
        name: 'Smooth Scroll',
        category: 'scroll',
        description: 'Smooth scroll with Lenis integration',
        code: `import Lenis from "@studio-freight/lenis";
const lenis = new Lenis({
  lerp: 0.1,
  wheelMultiplier: 1,
});
function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);`,
        dependencies: ['lenis'],
        performance: 'high',
        interruption: 'always_smooth',
      },

      // LAYOUT ANIMATIONS
      flip_animation: {
        name: 'Flip',
        category: 'layout',
        description: 'Smooth layout shift animation using GSAP Flip',
        code: `gsap.registerPlugin(Flip);
const state = Flip.getState(element);
// [update DOM]
Flip.from(state, {
  duration: 0.6,
  ease: "power2.inOut",
})`,
        dependencies: ['gsap', 'flip'],
        performance: 'medium',
        interruption: 'interruptible',
      },
      morphing: {
        name: 'Morphing',
        category: 'layout',
        description: 'SVG path morphing animation',
        code: `gsap.to(svgPath, {
  attr: { d: targetPathData },
  duration: 0.8,
  ease: "sine.inOut",
})`,
        dependencies: ['gsap'],
        performance: 'low',
        interruption: 'interruptible',
      },
      page_transition: {
        name: 'Page Transition',
        category: 'layout',
        description: 'Fade + scale transition between pages',
        code: `gsap.to(currentPage, {
  opacity: 0,
  scale: 0.95,
  duration: 0.5,
  onComplete: () => showNextPage(),
})`,
        dependencies: ['gsap'],
        performance: 'medium',
        interruption: 'interruptible',
      },

      // TEXT ANIMATIONS
      split_text_animation: {
        name: 'Split Text',
        category: 'text',
        description: 'Animate individual characters or words',
        code: `gsap.registerPlugin(SplitText);
const split = new SplitText(element, { type: "chars" });
gsap.from(split.chars, {
  opacity: 0,
  y: 10,
  duration: 0.5,
  stagger: 0.05,
  ease: "power2.out",
})`,
        dependencies: ['gsap', 'splittext'],
        performance: 'medium',
        interruption: 'interruptible',
      },
      typewriter: {
        name: 'Typewriter',
        category: 'text',
        description: 'Text appears character by character',
        code: `gsap.registerPlugin(SplitText);
const split = new SplitText(element, { type: "chars" });
gsap.fromTo(split.chars, { opacity: 0 }, {
  opacity: 1,
  stagger: 0.05,
  duration: 0.5,
})`,
        dependencies: ['gsap', 'splittext'],
        performance: 'medium',
        interruption: 'interruptible',
      },

      // PATH ANIMATIONS
      draw_svg: {
        name: 'Draw SVG',
        category: 'path',
        description: 'Animate SVG path stroke to appear drawn',
        code: `gsap.registerPlugin(DrawSVGPlugin);
gsap.from(svgPath, {
  strokeDasharray: "100%",
  strokeDashoffset: "100%",
  duration: 1.5,
  ease: "sine.inOut",
})`,
        dependencies: ['gsap', 'drawsvg'],
        performance: 'low',
        interruption: 'interruptible',
      },
      dash_animation: {
        name: 'SVG Dash',
        category: 'path',
        description: 'Animate SVG stroke-dashoffset',
        code: `gsap.to(svgPath, {
  strokeDashoffset: 0,
  duration: 2,
  ease: "sine.inOut",
})`,
        dependencies: ['gsap'],
        performance: 'low',
        interruption: 'interruptible',
      },

      // INTERACTIVE ANIMATIONS
      hover_scale: {
        name: 'Hover Scale',
        category: 'interactive',
        description: 'Scale element on hover with smooth easing',
        code: `element.addEventListener("mouseenter", () => {
  gsap.to(element, { scale: 1.05, duration: 0.3 });
});
element.addEventListener("mouseleave", () => {
  gsap.to(element, { scale: 1, duration: 0.3 });
});`,
        dependencies: ['gsap'],
        performance: 'minimal',
        interruption: 'interruptible',
      },
      press_feedback: {
        name: 'Press Feedback',
        category: 'interactive',
        description: 'Visual feedback when element is pressed',
        code: `gsap.to(element, {
  scale: 0.96,
  duration: 0.1,
  onMouseDown: true,
});`,
        dependencies: ['gsap'],
        performance: 'minimal',
        interruption: 'interruptible',
      },
    };
  }

  // DESIGN REFERENCES (from ~/.claude/design-references/)
  private loadDesignReferences(): DesignReferenceIndex {
    const references: DesignReferenceIndex = {};
    const refDir = path.join(os.homedir(), '.claude', 'design-references');

    if (!fs.existsSync(refDir)) {
      return references;
    }

    try {
      const folders = fs.readdirSync(refDir).filter((f) => {
        const stat = fs.statSync(path.join(refDir, f));
        return stat.isDirectory() && !f.startsWith('.');
      });

      for (const folder of folders) {
        const refPath = path.join(refDir, folder, 'ref.md');
        if (fs.existsSync(refPath)) {
          try {
            const content = fs.readFileSync(refPath, 'utf-8');
            const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)/);

            if (match) {
              const [, frontmatter, description] = match;
              const lines = frontmatter.split('\n');
              const meta: { [key: string]: any } = {};

              for (const line of lines) {
                const [key, ...valueParts] = line.split(':').map((s) => s.trim());
                const value = valueParts.join(':').trim();

                if (key === 'patterns') {
                  meta.patterns = value
                    .replace(/[\[\]]/g, '')
                    .split(',')
                    .map((p) => p.trim());
                } else if (key === 'feel') {
                  meta.feel = value
                    .replace(/[\[\]]/g, '')
                    .split(',')
                    .map((f) => f.trim());
                } else if (value.startsWith('"')) {
                  meta[key] = value.replace(/^"(.*)"$/, '$1');
                } else {
                  meta[key] = value;
                }
              }

              references[folder] = {
                id: folder,
                title: meta.title || 'Untitled',
                category: meta.category || 'reference',
                patterns: meta.patterns || [],
                feel: meta.feel || [],
                source: meta.source || '',
                url: meta.url || '',
                saved: meta.saved || '',
                description: description.trim(),
              };
            }
          } catch (e) {
            // Skip malformed reference files
          }
        }
      }
    } catch (e) {
      // Skip if directory read fails
    }

    return references;
  }

  // DESIGN TOKENS (from DESIGN.md - google-labs-code spec)
  private loadDesignTokens(): DesignTokens {
    const tokens: DesignTokens = {};
    const designPath = path.join(process.cwd(), 'DESIGN.md');

    if (!fs.existsSync(designPath)) {
      return tokens;
    }

    try {
      const content = fs.readFileSync(designPath, 'utf-8');
      const match = content.match(/^---\n([\s\S]*?)\n---/);

      if (match) {
        const frontmatter = match[1];
        const lines = frontmatter.split('\n');
        let currentSection = '';
        let currentNested: { [key: string]: any } = {};

        for (const line of lines) {
          if (!line.trim() || line.startsWith('#')) continue;

          // Top-level section (colors, typography, spacing, etc.)
          if (!line.startsWith(' ') && line.includes(':')) {
            if (currentSection && Object.keys(currentNested).length > 0) {
              (tokens as any)[currentSection] = currentNested;
            }
            currentSection = line.split(':')[0].trim();
            currentNested = {};
          } else if (line.startsWith('  ') && currentSection) {
            // Nested properties
            const trimmed = line.trim();
            if (trimmed.includes(':')) {
              const [key, ...valueParts] = trimmed.split(':');
              const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
              currentNested[key.trim()] = value.startsWith('#') || value.includes('(') || value.includes('-')
                ? value
                : value;
            }
          }
        }

        // Flush last section
        if (currentSection && Object.keys(currentNested).length > 0) {
          (tokens as any)[currentSection] = currentNested;
        }
      }
    } catch (e) {
      // Skip if file read fails
    }

    return tokens;
  }

  // PUBLIC API

  searchComponents(query: string, personality?: string): ComponentPattern[] {
    const results: ComponentPattern[] = [];
    const lowerQuery = query.toLowerCase();

    for (const [key, pattern] of Object.entries(this.componentIndex)) {
      if (
        key.includes(lowerQuery) ||
        pattern.name.toLowerCase().includes(lowerQuery) ||
        pattern.description.toLowerCase().includes(lowerQuery)
      ) {
        results.push(pattern);
      }
    }

    return results.slice(0, 5);
  }

  getComponent(name: string): ComponentPattern | undefined {
    return this.componentIndex[name.toLowerCase().replace(/\s+/g, '_')];
  }

  searchFonts(personality: string): Typeface[] {
    const results: Typeface[] = [];

    for (const font of Object.values(this.fontCatalog)) {
      if (
        font.personality.some((p) =>
          p.toLowerCase().includes(personality.toLowerCase())
        )
      ) {
        results.push(font);
      }
    }

    return results.slice(0, 5);
  }

  getFont(name: string): Typeface | undefined {
    return this.fontCatalog[name.toLowerCase().replace(/\s+/g, '_')];
  }

  getFontPairing(name: string): string | undefined {
    const font = this.getFont(name);
    return font?.pairing;
  }

  searchMotionPatterns(category: string): MotionPattern[] {
    return Object.values(this.motionPatterns).filter(
      (pattern) =>
        pattern.category.toLowerCase().includes(category.toLowerCase()) ||
        pattern.name.toLowerCase().includes(category.toLowerCase())
    );
  }

  getMotionPattern(name: string): MotionPattern | undefined {
    return this.motionPatterns[name.toLowerCase().replace(/\s+/g, '_')];
  }

  getAllMotionPatterns(): MotionPattern[] {
    return Object.values(this.motionPatterns);
  }

  getComponentTypes(): string[] {
    return Object.keys(this.componentIndex);
  }

  getFontNames(): string[] {
    return Object.values(this.fontCatalog).map((f) => f.name);
  }

  searchDesignReferences(query: string): DesignReference[] {
    const results: DesignReference[] = [];
    const lowerQuery = query.toLowerCase();

    for (const ref of Object.values(this.designReferences)) {
      if (
        ref.id.includes(lowerQuery) ||
        ref.title.toLowerCase().includes(lowerQuery) ||
        ref.category.toLowerCase().includes(lowerQuery) ||
        ref.patterns.some((p) => p.toLowerCase().includes(lowerQuery)) ||
        ref.feel.some((f) => f.toLowerCase().includes(lowerQuery)) ||
        ref.description.toLowerCase().includes(lowerQuery)
      ) {
        results.push(ref);
      }
    }

    return results.slice(0, 5);
  }

  getDesignReference(id: string): DesignReference | undefined {
    return this.designReferences[id];
  }

  getDesignReferencesByCategory(category: string): DesignReference[] {
    return Object.values(this.designReferences).filter((ref) =>
      ref.category.toLowerCase().includes(category.toLowerCase())
    );
  }

  getDesignReferencesByFeel(feel: string): DesignReference[] {
    return Object.values(this.designReferences).filter((ref) =>
      ref.feel.some((f) => f.toLowerCase().includes(feel.toLowerCase()))
    );
  }

  getAllDesignReferences(): DesignReference[] {
    return Object.values(this.designReferences);
  }

  getDesignTokens(): DesignTokens {
    return this.designTokens;
  }

  getDesignTokensBySection(section: string): any {
    return (this.designTokens as any)[section] || {};
  }

  getDesignTokenValue(path: string): any {
    const parts = path.split('.');
    let current: any = this.designTokens;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  generateComponentTemplate(componentName: string): { html: string; css: string } | undefined {
    const component = this.getComponent(componentName);
    if (!component) return undefined;

    const html = `<!-- ${component.name} -->
<div class="${componentName}">
  <div class="${componentName}__content">
    <!-- Content goes here -->
  </div>
</div>`;

    const css = `.${componentName} {
  /* Base styles */
}

.${componentName}__content {
  /* Content styles */
}

/* Variants */
.${componentName}--primary {
  /* Primary variant */
}

.${componentName}--secondary {
  /* Secondary variant */
}

/* States */
.${componentName}:hover {
  /* Hover state */
}

.${componentName}:active {
  /* Active state */
}

.${componentName}:disabled {
  /* Disabled state */
}

/* Accessibility */
.${componentName}:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}`;

    return { html, css };
  }

  generateMotionTemplate(patternName: string): { code: string; html: string } | undefined {
    const pattern = this.getMotionPattern(patternName);
    if (!pattern) return undefined;

    const html = `<!-- ${pattern.name} motion pattern -->
<div class="motion-target">
  <p>Animate this element</p>
</div>`;

    const code = `import gsap from 'gsap';

const element = document.querySelector('.motion-target');

// ${pattern.name}
${pattern.code}`;

    return { code, html };
  }

  generateTokenTemplate(section: string): string {
    const tokens = this.getDesignTokensBySection(section);
    if (!tokens || Object.keys(tokens).length === 0) {
      return `/* No tokens found for section: ${section} */`;
    }

    const tokenEntries = Object.entries(tokens).slice(0, 5);
    const tokenLines = tokenEntries
      .map(([key, value]) => `  --${section}-${key}: ${value};`)
      .join('\n');

    return `:root {
/* ${section} tokens */
${tokenLines}
  /* ... more tokens ... */
}`;
  }
}

export function createReferenceDataService(): ReferenceDataService {
  return new ReferenceDataService();
}
