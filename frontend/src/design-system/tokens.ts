/**
 * BRAND BRIDGE Design Tokens
 * Central source of truth for semantic colors, spacing, typography, radii, and elevations.
 * Aligns with the Master Design System:
 * - Deep Ink: #17243A
 * - Warm Ivory: #F7F5F0
 * - Cobalt Blue: #4169E1
 * - Pale Blue: #DCE5FA
 * - Slate Text: #697386
 * - White Surface: #FFFFFF
 * - Soft Border: #E5E7EB
 * - Success: #21865B
 * - Warning: #B7791F
 * - Error: #C24141
 */

export const tokens = {
  colors: {
    // Deep Ink neutral hierarchy
    ink: {
      950: '#0D1522',
      900: '#17243A', // Deep ink primary text / headers
      800: '#21324E', // High emphasis surfaces & dark headers
      700: '#2F4468', // Subheadings & active icons
      600: '#475569', // Secondary body text
      500: '#697386', // Slate text & secondary labels
      400: '#94A3B8', // Muted borders & placeholders
      300: '#CBD5E1', // Subtle divider lines
      200: '#E5E7EB', // Soft crisp borders
      100: '#F0EFEA', // Slightly muted ivory fill
      50: '#F7F5F0',  // Warm ivory canvas background
      white: '#FFFFFF', // Clean surface background
    },
    // Distinctive Cobalt Blue Primary Accent
    brand: {
      900: '#1E3A8A',
      800: '#1D4ED8',
      700: '#2563EB', // Cobalt active / hover
      600: '#4169E1', // Primary cobalt blue action
      500: '#5C82F2', // Cobalt bright
      400: '#819EF6',
      200: '#BFDBFE',
      100: '#DCE5FA', // Pale blue tint
      50: '#F0F4FE',  // Ultra subtle blue surface
    },
    // Semantic Functional Colors
    success: {
      700: '#186443',
      600: '#21865B', // Standard success
      100: '#D1EAD9',
      50: '#E8F5EE',
    },
    warning: {
      700: '#915F15',
      600: '#B7791F', // Standard warning
      100: '#FCE7C5',
      50: '#FEF7EC',
    },
    danger: {
      700: '#9E3232',
      600: '#C24141', // Standard error / danger
      100: '#F8D4D4',
      50: '#FDF2F2',
    },
  },
  typography: {
    fontHeading:
      "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSans:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    sizes: {
      xs: '0.75rem',     // 12px
      sm: '0.875rem',    // 14px
      base: '1rem',       // 16px
      lg: '1.125rem',    // 18px
      xl: '1.25rem',     // 20px
      '2xl': '1.5rem',    // 24px
      '3xl': '1.875rem',  // 30px
      '4xl': '2.25rem',   // 36px
      '5xl': '3rem',      // 48px
    },
    weights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },
  },
  radii: {
    xs: '4px',
    sm: '6px',
    md: '8px',   // Buttons, inputs, small tags
    lg: '12px',  // Standard cards
    xl: '16px',  // Large surface cards, modals
    '2xl': '20px',
    full: '9999px',
  },
  shadows: {
    subtle: '0 1px 2px 0 rgba(23, 36, 58, 0.05)',
    card: '0 1px 3px 0 rgba(23, 36, 58, 0.06), 0 1px 2px -1px rgba(23, 36, 58, 0.04)',
    elevated: '0 4px 6px -1px rgba(23, 36, 58, 0.07), 0 2px 4px -2px rgba(23, 36, 58, 0.05)',
    floating: '0 10px 15px -3px rgba(23, 36, 58, 0.08), 0 4px 6px -4px rgba(23, 36, 58, 0.03)',
    modal: '0 20px 25px -5px rgba(23, 36, 58, 0.12), 0 8px 10px -6px rgba(23, 36, 58, 0.06)',
  },
} as const;

export type DesignTokens = typeof tokens;
