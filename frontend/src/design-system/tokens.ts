/**
 * BRAND BRIDGE Design Tokens
 * Central source of truth for semantic colors, spacing, typography, radii, and elevations.
 * Aligns with Tailwind CSS v4 variables and ensures strict design consistency.
 */

export const tokens = {
  colors: {
    // Deep Ink / Navy text and neutral hierarchy
    ink: {
      950: '#020617',
      900: '#0f172a', // Deep ink primary text
      800: '#1e293b', // Primary headers
      700: '#334155', // Subheadings & active icons
      600: '#475569', // Secondary body text
      500: '#64748b', // Muted text & placeholders
      400: '#94a3b8', // Subtle labels
      300: '#cbd5e1', // Divider lines
      200: '#e2e8f0', // Surface borders
      100: '#f1f5f9', // Light surface fill
      50: '#f8fafc',  // Canvas background
      white: '#ffffff',
    },
    // Distinctive Brand Accent (Ocean / Sky 600)
    brand: {
      900: '#0c4a6e',
      800: '#075985',
      700: '#0369a1', // Brand hover state
      600: '#0284c7', // Brand primary action
      500: '#0ea5e9', // Brand highlight
      400: '#38bdf8',
      100: '#e0f2fe',
      50: '#f0f9ff',  // Brand subtle background tint
    },
    // Semantic Functional Colors
    success: {
      700: '#047857',
      600: '#059669',
      100: '#d1fae5',
      50: '#ecfdf5',
    },
    warning: {
      700: '#b45309',
      600: '#d97706',
      100: '#fef3c7',
      50: '#fffbeb',
    },
    danger: {
      700: '#b91c1c',
      600: '#dc2626',
      100: '#fee2e2',
      50: '#fef2f2',
    },
  },
  typography: {
    fontSans:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    sizes: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',      // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',   // 24px
      '3xl': '1.875rem', // 30px
    },
    weights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
  radii: {
    xs: '3px',
    sm: '5px',
    md: '8px',
    lg: '12px',
    full: '9999px',
  },
  shadows: {
    subtle: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
    card: '0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
    floating: '0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.03)',
    modal: '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)',
  },
} as const;

export type DesignTokens = typeof tokens;
