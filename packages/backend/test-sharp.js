// Test sharp from backend context
const s = require('sharp');
console.log('sharp version:', s.sharp_version || s.versions?.sharp || 'unknown');
console.log('formats:', Object.keys(s.format || {}).join(', '));
