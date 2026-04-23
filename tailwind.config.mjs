/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'tp-ink': '#0B0F14',
        'tp-paper': '#F6F7F9',
        'tp-charcoal': '#1A1F26',
        'tp-accent': '#00C389',
        'tp-signal-value': '#EDE085',
        'tp-warn': '#F5A623',
        'tp-danger': '#E5484D',
        'tp-mute': '#6B7280',
        'tp-rule': '#E4E7EB',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          '"SF Mono"',
          'Menlo',
          'Consolas',
          '"Liberation Mono"',
          'monospace',
        ],
      },
      fontSize: {
        display: ['2.5rem', { lineHeight: '1.2', fontWeight: '700' }],
        h1: ['1.875rem', { lineHeight: '1.2', fontWeight: '700' }],
        h2: ['1.5rem', { lineHeight: '1.2', fontWeight: '700' }],
        h3: ['1.25rem', { lineHeight: '1.2', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.5' }],
        small: ['0.875rem', { lineHeight: '1.5' }],
        caption: ['0.75rem', { lineHeight: '1.5' }],
      },
      borderRadius: {
        card: '8px',
        input: '4px',
      },
      maxWidth: {
        prose: '720px',
        'prose-wide': '960px',
      },
    },
  },
  plugins: [],
};
