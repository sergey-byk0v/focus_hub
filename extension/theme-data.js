const BASE_PALETTES = {
  dark: {
    '--bg': '#2a2a2a', '--text-on-accent': '#2a2a2a',
    '--surface': '#333', '--surface-alt': '#383838', '--surface-hover': '#4a4a4a',
    '--text': '#e0e0e0', '--text-secondary': '#b0b0b0', '--text-muted': '#939393',
    '--text-label': '#bbb', '--text-subtle': '#9f9f9f', '--text-site': '#ccc',
    '--border': '#555', '--border-light': '#444', '--border-subtle': '#3a3a3a',
    '--accent': '#b0b0b0', '--accent-hover': '#909090',
    '--danger': '#ff4757', '--danger-hover': '#e63946', '--danger-text': '#ff8a8a', '--success': '#90ee90', '--white': '#fff',
  },
  slate: {
    '--bg': '#1e1e2e', '--text-on-accent': '#cdd6f4',
    '--surface': '#2a2a3e', '--surface-alt': '#32324a', '--surface-hover': '#3d3d55',
    '--text': '#cdd6f4', '--text-secondary': '#a6adc8', '--text-muted': '#8e94ac',
    '--text-label': '#bac2de', '--text-subtle': '#8e94ac', '--text-site': '#a6adc8',
    '--border': '#45475a', '--border-light': '#38384e', '--border-subtle': '#313244',
    '--accent': '#b4befe', '--accent-hover': '#9ca3f0',
    '--danger': '#f38ba8', '--danger-hover': '#e06c90', '--danger-text': '#f38ba8', '--success': '#a6e3a1', '--white': '#cdd6f4',
  },
  medium: {
    '--bg': '#3a3a3a', '--text-on-accent': '#2a2a2a',
    '--surface': '#444', '--surface-alt': '#4a4a4a', '--surface-hover': '#555',
    '--text': '#ddd', '--text-secondary': '#aaa', '--text-muted': '#a6a6a6',
    '--text-label': '#bbb', '--text-subtle': '#a6a6a6', '--text-site': '#b0b0b0',
    '--border': '#666', '--border-light': '#555', '--border-subtle': '#4a4a4a',
    '--accent': '#ff8a65', '--accent-hover': '#ff7043',
    '--danger': '#ef5350', '--danger-hover': '#d32f2f', '--danger-text': '#ff9a8c', '--success': '#81c784', '--white': '#fff',
  },
  light: {
    '--bg': '#f5f5f5', '--text-on-accent': '#222',
    '--surface': '#fff', '--surface-alt': '#eee', '--surface-hover': '#ddd',
    '--text': '#222', '--text-secondary': '#666', '--text-muted': '#707070',
    '--text-label': '#555', '--text-subtle': '#707070', '--text-site': '#444',
    '--border': '#ccc', '--border-light': '#ddd', '--border-subtle': '#e0e0e0',
    '--accent': '#d0d0d0', '--accent-hover': '#bbb',
    '--danger': '#e0393f', '--danger-hover': '#c53036', '--danger-text': '#c62828', '--success': '#4caf50', '--white': '#fff',
  },
  pastel: {
    '--bg': '#fce4ec', '--text-on-accent': '#5a3d4a',
    '--surface': '#fff0f3', '--surface-alt': '#f8e8ec', '--surface-hover': '#f0dce4',
    '--text': '#5a3d4a', '--text-secondary': '#7f5c6e', '--text-muted': '#7a5466',
    '--text-label': '#7a5a6a', '--text-subtle': '#8a5f6e', '--text-site': '#6a4a5a',
    '--border': '#e8c8d4', '--border-light': '#f0d4dc', '--border-subtle': '#f4dce4',
    '--accent': '#f8bbd0', '--accent-hover': '#f48fb1',
    '--danger': '#e57373', '--danger-hover': '#d32f2f', '--danger-text': '#9d4a52', '--success': '#81c784', '--white': '#fff',
  },
  vibrant: {
    '--bg': '#1a1a2e', '--text-on-accent': '#1a1a2e',
    '--surface': '#252540', '--surface-alt': '#2d2d50', '--surface-hover': '#3a3a5a',
    '--text': '#e0e0e0', '--text-secondary': '#b0b0b0', '--text-muted': '#8d8db2',
    '--text-label': '#ccc', '--text-subtle': '#8d8db2', '--text-site': '#aaaacc',
    '--border': '#3a3a5a', '--border-light': '#2d2d50', '--border-subtle': '#252540',
    '--accent': '#00e5ff', '--accent-hover': '#00b8d4',
    '--danger': '#ff4081', '--danger-hover': '#f50057', '--danger-text': '#ff7aa8', '--success': '#69f0ae', '--white': '#fff',
  },
  golden: {
    '--bg': '#1a0e00', '--text-on-accent': '#1a0e00',
    '--surface': '#2a1800', '--surface-alt': '#3a2200', '--surface-hover': '#4a2c00',
    '--text': '#ffcc00', '--text-secondary': '#dba500', '--text-muted': '#b88000',
    '--text-label': '#ffcc00', '--text-subtle': '#b88000', '--text-site': '#dba500',
    '--border': '#5a3e00', '--border-light': '#4a2c00', '--border-subtle': '#3a2200',
    '--accent': '#f0a500', '--accent-hover': '#d49000',
    '--danger': '#ff6347', '--danger-hover': '#e5533a', '--danger-text': '#ff8c66', '--success': '#7cfc00', '--white': '#fff',
  },
};

const THEMES = [
  { id: 'dark',       name: 'Dark',       color: '#888',     base: 'dark',    accent: '#888',     accentHover: '#777' },
  { id: 'dark-blue',  name: 'Blue',       color: '#4a7dff',  base: 'dark',    accent: '#4a7dff',  accentHover: '#3a6df0' },
  { id: 'dark-green', name: 'Green',      color: '#4caf50',  base: 'dark',    accent: '#4caf50',  accentHover: '#3d9142' },
  { id: 'dark-purple',name: 'Purple',     color: '#ab47bc',  base: 'dark',    accent: '#ab47bc',  accentHover: '#8e24aa' },
  { id: 'dark-red',   name: 'Red',        color: '#ef5350',  base: 'dark',    accent: '#ef5350',  accentHover: '#d32f2f' },

  { id: 'slate-teal',     name: 'Teal',      color: '#4db6ac', base: 'slate',   accent: '#4db6ac', accentHover: '#3b9e94' },
  { id: 'slate-lavender', name: 'Lav',  color: '#b39ddb', base: 'slate',   accent: '#b39ddb', accentHover: '#9575cd' },
  { id: 'slate-rose',     name: 'Rose',      color: '#e57373', base: 'slate',   accent: '#e57373', accentHover: '#d32f2f' },
  { id: 'slate-amber',    name: 'Amber',     color: '#ffb74d', base: 'slate',   accent: '#ffb74d', accentHover: '#ff9800' },
  { id: 'slate-cyan',     name: 'Cyan',      color: '#4dd0e1', base: 'slate',   accent: '#4dd0e1', accentHover: '#00bcd4' },

  { id: 'med-orange', name: 'Orange',   color: '#ff8a65', base: 'medium', accent: '#ff8a65', accentHover: '#ff7043' },
  { id: 'med-pink',   name: 'Pink',     color: '#f06292', base: 'medium', accent: '#f06292', accentHover: '#e91e63' },
  { id: 'med-mint',   name: 'Mint',     color: '#81c784', base: 'medium', accent: '#81c784', accentHover: '#66bb6a' },
  { id: 'med-indigo', name: 'Indigo',   color: '#7986cb', base: 'medium', accent: '#7986cb', accentHover: '#5c6bc0' },
  { id: 'med-coral',  name: 'Coral',    color: '#ff8a80', base: 'medium', accent: '#ff8a80', accentHover: '#ff6f60' },

  { id: 'light',       name: 'Light',      color: '#ddd',    base: 'light',   accent: '#d0d0d0', accentHover: '#bbb' },
  { id: 'light-blue',  name: 'Sky',        color: '#42a5f5', base: 'light',   accent: '#42a5f5', accentHover: '#1e88e5' },
  { id: 'light-green', name: 'Sage',       color: '#66bb6a', base: 'light',   accent: '#66bb6a', accentHover: '#43a047' },
  { id: 'light-pink',  name: 'Blush',      color: '#ef9a9a', base: 'light',   accent: '#ef9a9a', accentHover: '#e57373' },
  { id: 'light-warm',  name: 'Warm',       color: '#ffab91', base: 'light',   accent: '#ffab91', accentHover: '#ff8a65' },

  { id: 'pastel-pink',     name: 'Pink',     color: '#f8bbd0', base: 'pastel', accent: '#f8bbd0', accentHover: '#f48fb1' },
  { id: 'pastel-lavender', name: 'Lav', color: '#e1bee7', base: 'pastel', accent: '#e1bee7', accentHover: '#ce93d8' },
  { id: 'pastel-mint',     name: 'Mint',     color: '#c8e6c9', base: 'pastel', accent: '#c8e6c9', accentHover: '#a5d6a7' },
  { id: 'pastel-peach',    name: 'Peach',    color: '#ffccbc', base: 'pastel', accent: '#ffccbc', accentHover: '#ffab91' },
  { id: 'pastel-sky',      name: 'Sky',      color: '#bbdefb', base: 'pastel', accent: '#bbdefb', accentHover: '#90caf9' },

  { id: 'vib-cyan',    name: 'Cyan',      color: '#00e5ff', base: 'vibrant', accent: '#00e5ff', accentHover: '#00b8d4' },
  { id: 'vib-pink',    name: 'Pink',      color: '#ff4081', base: 'vibrant', accent: '#ff4081', accentHover: '#f50057' },
  { id: 'vib-green',   name: 'Green',     color: '#69f0ae', base: 'vibrant', accent: '#69f0ae', accentHover: '#00e676' },
  { id: 'vib-yellow',    name: 'Yellow',    color: '#ffd740', base: 'vibrant', accent: '#ffd740', accentHover: '#ffab00' },
  { id: 'vib-magenta', name: 'Magenta',   color: '#e040fb', base: 'vibrant', accent: '#e040fb', accentHover: '#d500f9' },
  { id: 'secret-master', name: '👑 Master', color: '#f0a500', base: 'golden', accent: '#f0a500', accentHover: '#d49000', secret: true },
];

function hexToRgbLuminance(hex) {
  let h = (hex || '').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function applyThemeById(themeId) {
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
  const base = BASE_PALETTES[theme.base];
  const vars = { ...base, '--accent': theme.accent, '--accent-hover': theme.accentHover };
  Object.entries(vars).forEach(([k, v]) => document.body.style.setProperty(k, v));

  // Fix 3: pick a label color for accent fills that passes WCAG AA 4.5:1.
  // Black on the accent when it is light enough (rel. luminance >= 0.18), white otherwise.
  const accentLum = hexToRgbLuminance(theme.accent);
  if (accentLum !== null) {
    const labelColor = accentLum >= 0.18 ? '#111111' : '#ffffff';
    document.body.style.setProperty('--text-on-accent', labelColor);
  }
}
