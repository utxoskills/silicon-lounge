module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'sl-bg': {
          primary: '#0a0a0f',
          secondary: '#12121a',
          tertiary: '#1a1a25',
        },
        'sl-accent': {
          primary: '#00ff88',
          secondary: '#00d4ff',
          tertiary: '#ff00ff',
        },
        'sl-text': {
          primary: '#e0e0e0',
          secondary: '#888888',
          muted: '#555555',
        },
        'sl-border': '#2a2a3a',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'typing': 'typing 1s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px #00ff88' },
          '50%': { boxShadow: '0 0 20px #00ff88, 0 0 40px #00ff88' },
        },
        'typing': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}