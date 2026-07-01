const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const version = Date.now().toString(36);

function cacheBust(filePath, pattern) {
  const file = path.join(__dirname, filePath);
  const html = fs.readFileSync(file, 'utf8');
  const updated = html.replace(pattern, (match, prefix) => prefix + version);
  fs.writeFileSync(file, updated);
  console.log('  ' + filePath);
}

console.log('🔖 Version:', version);

// Cadastro: bust JS + CSS versions
cacheBust('cadastro.html', /(\.(?:min\.)?(?:js|css)\?v=)[a-z0-9.]+/g);

// Index: bust all ?v= params
cacheBust('index.html', /(\?v=)[a-z0-9.]+/g);

try {
  execSync('edgeone makers deploy --name credvale', {
    cwd: __dirname,
    stdio: 'inherit',
    timeout: 120000
  });
} catch (e) {
  process.exit(1);
}
