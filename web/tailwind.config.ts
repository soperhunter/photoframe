import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm Cozy Fall — default theme (Phase 5 adds Spring/Summer/Winter)
        'bg-deep':         '#241B16',
        'bg-cream':        '#F5ECDD',
        'accent-amber':    '#C8741A',
        'accent-cranberry':'#8B2E2A',
        'accent-honey':    '#E5B547',
        'text-ivory':      '#F4EAD7',
        'text-espresso':   '#3A2418',
      },
      fontFamily: {
        fraunces: ['Fraunces Variable', 'Georgia', 'serif'],
        inter:    ['Inter Variable', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
