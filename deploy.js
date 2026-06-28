const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const version = Date.now().toString(36);

// Cache-bust cadastro.html
const cadastroFile = path.join(__dirname, 'cadastro.html');
const cadastroHtml = fs.readFileSync(cadastroFile, 'utf8');
const cadastroUpdated = cadastroHtml.replace(
  /(cadastro\.js\?v=)[a-z0-9]+/,
  '$1' + version
);
fs.writeFileSync(cadastroFile, cadastroUpdated);

// Cache-bust index.html
const indexFile = path.join(__dirname, 'index.html');
const indexHtml = fs.readFileSync(indexFile, 'utf8');
const indexUpdated = indexHtml.replace(
  /(\?v=)[a-z0-9]+/g,
  '$1' + version
);
fs.writeFileSync(indexFile, indexUpdated);

console.log('🔖 Version:', version);

try {
  execSync('edgeone makers deploy --name credvale', {
    cwd: __dirname,
    stdio: 'inherit',
    timeout: 120000
  });
} catch (e) {
  process.exit(1);
}
