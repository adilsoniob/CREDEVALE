const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const version = Date.now().toString(36);
const rootDir = __dirname;
const edgeAssets = path.join(rootDir, '.edgeone', 'assets');

// ============================================================
// 0. Clean stale build artifacts from assets/
// ============================================================
console.log('\n🧹 Cleaning stale build artifacts...');
function cleanOldBuilds(dir) {
  if (!fs.existsSync(dir)) return;
  var files = fs.readdirSync(dir);
  var removed = 0;
  files.forEach(function(f) {
    var fp = path.join(dir, f);
    if (fs.statSync(fp).isFile() && (f.startsWith('index-') && (f.endsWith('.js') || f.endsWith('.css')))) {
      fs.unlinkSync(fp);
      removed++;
    }
  });
  if (removed > 0) console.log('  Removed ' + removed + ' stale build files from ' + dir);
}
// Clean old builds from root assets/ (will be replaced by fresh dist build)
cleanOldBuilds(path.join(rootDir, 'assets'));
// Clean old builds from .edgeone/assets/assets/ (fresh ones come from dist)
cleanOldBuilds(path.join(edgeAssets, 'assets'));

// ============================================================
// 1. Clean build from scratch
// ============================================================
console.log('\n🔨 Building from scratch...');
try {
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit', timeout: 120000 });
  console.log('  ✅ Build concluído');
} catch (e) {
  console.error('  ❌ Build falhou:', e.message);
  process.exit(1);
}

// ============================================================
// 2. Ensure .edgeone/assets directories exist
// ============================================================
var dirs = [
  edgeAssets,
  path.join(edgeAssets, 'admin-panel'),
  path.join(edgeAssets, 'frontend', 'js'),
  path.join(edgeAssets, 'assets'),
];
dirs.forEach(function(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ============================================================
// 3. Cache-bust ALL ?v= params in HTML files
// ============================================================
console.log('\n🔖 Cache-busting version:', version);
['cadastro.html', 'index.html', 'app.html', 'admin.html', 'cliente.html'].forEach(function(htmlFile) {
  var fpath = path.join(rootDir, htmlFile);
  try {
    var html = fs.readFileSync(fpath, 'utf8');
    var updated = html.replace(/(\?v=)[a-z0-9.]+/g, '$1' + version);
    fs.writeFileSync(fpath, updated);
    console.log('  ✏️  ' + htmlFile);
  } catch(e) {
    console.log('  ⏭️  Skip (not found): ' + htmlFile);
  }
});

// ============================================================
// 4. Sync root static files to .edgeone/assets
// ============================================================
console.log('\n📂 Syncing root files to .edgeone/assets...');
var rootFiles = [
  'index.html', 'admin.html', 'app.html', 'cliente.html',
  'cadastro.html', 'cadastro.js', 'cadastro.css', 'cadastro-chat.css',
  'styles.css'
];
rootFiles.forEach(function(f) {
  var src = path.join(rootDir, f);
  var dest = path.join(edgeAssets, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log('  ✅ ' + f);
  }
});

// ============================================================
// 5. Sync admin-panel/
// ============================================================
console.log('\n📂 Syncing admin-panel/...');
['admin.css', 'admin.js'].forEach(function(f) {
  var src = path.join(rootDir, 'admin-panel', f);
  var dest = path.join(edgeAssets, 'admin-panel', f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log('  ✅ admin-panel/' + f);
  }
});

// ============================================================
// 6. Sync frontend/js/
// ============================================================
console.log('\n📂 Syncing frontend/js/...');
['api.js'].forEach(function(f) {
  var src = path.join(rootDir, 'frontend', 'js', f);
  var dest = path.join(edgeAssets, 'frontend', 'js', f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log('  ✅ frontend/js/' + f);
  }
});

// ============================================================
// 7. Sync root assets/ images to .edgeone/assets/assets/
// ============================================================
console.log('\n📂 Syncing assets/...');
var assetsDir = path.join(rootDir, 'assets');
if (fs.existsSync(assetsDir)) {
  var assetFiles = fs.readdirSync(assetsDir);
  assetFiles.forEach(function(f) {
    var src = path.join(assetsDir, f);
    var dest = path.join(edgeAssets, 'assets', f);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, dest);
    }
  });
  console.log('  ✅ ' + assetFiles.length + ' assets copied');
}

// ============================================================
// 8. Sync dist/ build assets to .edgeone/assets/assets/
// ============================================================
console.log('\n📂 Syncing dist/ build assets...');
var distDir = path.join(rootDir, 'dist');
if (fs.existsSync(distDir)) {
  var distAssetsDir = path.join(distDir, 'assets');
  if (fs.existsSync(distAssetsDir)) {
    var distFiles = fs.readdirSync(distAssetsDir);
    distFiles.forEach(function(f) {
      var src = path.join(distAssetsDir, f);
      var dest = path.join(edgeAssets, 'assets', f);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, dest);
      }
    });
    console.log('  ✅ ' + distFiles.length + ' dist assets copied');
  }
  // Copy dist/index.html (has correct asset hashes)
  var distIndex = path.join(distDir, 'index.html');
  var destIndex = path.join(edgeAssets, 'index.html');
  if (fs.existsSync(distIndex)) {
    fs.copyFileSync(distIndex, destIndex);
    console.log('  ✅ dist/index.html copied (with hashed assets)');
  }
}

// ============================================================
// 9. Deploy to EdgeOne
// ============================================================
console.log('\n📦 Deploying to EdgeOne...');
try {
  execSync('edgeone makers deploy --name credvale', {
    cwd: rootDir,
    stdio: 'inherit',
    timeout: 180000
  });
  console.log('\n✅ EdgeOne deploy concluído com sucesso!');
} catch (e) {
  console.error('\n❌ EdgeOne deploy falhou:', e.message);
  process.exit(1);
}

// ============================================================
// 10. Deploy to VPS
// ============================================================
console.log('\n📦 Deploying to VPS...');
try {
  execSync('node deploy-clean-full.cjs', {
    cwd: rootDir,
    stdio: 'inherit',
    timeout: 600000
  });
  console.log('✅ VPS deploy concluído com sucesso!');
} catch (e) {
  console.error('❌ VPS deploy falhou:', e.message);
  // Don't exit — try git push anyway
}

// ============================================================
// 11. Commit and push to git (triggers Railway auto-deploy)
// ============================================================
console.log('\n📤 Committing and pushing to GitHub...');
try {
  execSync('git add -A', { cwd: rootDir, stdio: 'inherit', timeout: 30000 });
  execSync('git commit -m "deploy: build ' + version + ' + cache bust"', { cwd: rootDir, stdio: 'inherit', timeout: 30000 });
  execSync('git push origin main', { cwd: rootDir, stdio: 'inherit', timeout: 60000 });
  console.log('✅ GitHub push concluído — Railway fará auto-deploy');
} catch (e) {
  console.error('⚠️  Git push falhou (pode não haver mudanças a commitar):', e.message);
}

console.log('\n========================================');
console.log('✅ DEPLOY COMPLETO: EdgeOne + VPS + Git');
console.log('   Versão: ' + version);
console.log('========================================');
