/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#18342E',
    tint: '#176B56',

    // Core surfaces
    background: '#F7F8F4',
    foreground: '#18342E',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#18342E',

    // Primary action color (buttons, links, active states)
    primary: '#176B56',
    primaryForeground: '#FFFFFF',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E9F1EA',
    secondaryForeground: '#21483D',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#EEF1EC',
    mutedForeground: '#718078',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#F5E9CB',
    accentForeground: '#5A4212',

    // Destructive actions (delete, error states)
    destructive: '#C74A3A',
    destructiveForeground: '#FFFFFF',

    // Borders and input outlines
    border: '#DCE4DA',
    input: '#DCE4DA',

    // Map-specific tones for the browser diagram and native map overlays.
    mapCanvas: '#E8EFE6',
    mapPark: '#D3E5CC',
    mapRoad: '#FFFFFF',
    mapRoadEdge: '#C8D2C6',
    mapPin: '#D99827',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
