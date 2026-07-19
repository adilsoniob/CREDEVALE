const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const ssh = new NodeSSH();

const LOCAL_ROOT = __dirname;
const REMOTE_ROOT = '/root/credvale';
const WEB_ROOT = '/var/www/credvale';

(async () => {
  try {
    await ssh.connect({
      host: '163.245.222.96',
      port: 22,
      username: 'root',
      password: 'Diih1904198**',
      readyTimeout: 15000
    });

    console.log('=== CLEAN DEPLOY - VPS ===');

    // Step 1: Create remote directory structure
    console.log('\n1. Criando estrutura de diretorios...');
    let r = await ssh.execCommand(`
      mkdir -p ${REMOTE_ROOT}/backend/src/routes
      mkdir -p ${REMOTE_ROOT}/backend/src/middleware
      mkdir -p ${REMOTE_ROOT}/backend/data
      mkdir -p ${REMOTE_ROOT}/backend/uploads
      mkdir -p ${REMOTE_ROOT}/admin-panel
      mkdir -p ${REMOTE_ROOT}/frontend/js
      mkdir -p ${REMOTE_ROOT}/src/components
      mkdir -p ${REMOTE_ROOT}/dist
      mkdir -p ${REMOTE_ROOT}/scripts
      echo DIRS_OK
    `, { timeout: 15000 });
    console.log('   ' + r.stdout.trim());

    // Step 2: Upload root files
    console.log('\n2. Enviando arquivos raiz...');
    const rootFiles = [
      'package.json', 'railway.json', '.railwayignore',
      'vite.config.ts', 'tsconfig.json',
      'index.html', 'app.html', 'admin.html',
      'cadastro.html', 'cadastro.js', 'cadastro.css',
      'cadastro-chat.css', 'cliente.html', 'styles.css', 'deploy.js',
      'deploy.cjs', 'deploy-vps2.cjs'
    ];
    for (const f of rootFiles) {
      const local = path.join(LOCAL_ROOT, f);
      if (fs.existsSync(local)) {
        await ssh.putFile(local, `${REMOTE_ROOT}/${f}`);
        console.log('   [+] ' + f);
      }
    }

    // Step 3: Upload backend
    console.log('\n3. Enviando backend...');
    await ssh.putDirectory(
      path.join(LOCAL_ROOT, 'backend', 'src'),
      REMOTE_ROOT + '/backend/src',
      { recursive: true, concurrency: 5 }
    );
    await ssh.putFile(
      path.join(LOCAL_ROOT, 'backend', 'server.js'),
      REMOTE_ROOT + '/backend/server.js'
    );
    await ssh.putFile(
      path.join(LOCAL_ROOT, 'backend', 'package.json'),
      REMOTE_ROOT + '/backend/package.json'
    );
    console.log('   Backend enviado');

    // Step 4: Upload frontend
    console.log('\n4. Enviando frontend...');
    await ssh.putDirectory(
      path.join(LOCAL_ROOT, 'admin-panel'),
      REMOTE_ROOT + '/admin-panel',
      { recursive: true, concurrency: 5 }
    );
    await ssh.putDirectory(
      path.join(LOCAL_ROOT, 'frontend', 'js'),
      REMOTE_ROOT + '/frontend/js',
      { recursive: true, concurrency: 5 }
    );
    console.log('   Frontend enviado');

    // Step 5: Upload React app source
    console.log('\n5. Enviando src/ (React)...');
    const srcFiles = fs.readdirSync(path.join(LOCAL_ROOT, 'src'));
    for (const sf of srcFiles) {
      const localPath = path.join(LOCAL_ROOT, 'src', sf);
      const stat = fs.statSync(localPath);
      if (stat.isDirectory()) {
        await ssh.putDirectory(
          localPath,
          REMOTE_ROOT + '/src/' + sf,
          { recursive: true, concurrency: 5 }
        );
      } else {
        await ssh.putFile(localPath, REMOTE_ROOT + '/src/' + sf);
      }
    }
    console.log('   src/ enviado');

    // Step 6: Upload assets
    console.log('\n6. Enviando assets...');
    const assetsDir = path.join(LOCAL_ROOT, 'assets');
    if (fs.existsSync(assetsDir)) {
      await ssh.execCommand(`mkdir -p ${REMOTE_ROOT}/assets`);
      await ssh.putDirectory(
        assetsDir,
        REMOTE_ROOT + '/assets',
        { recursive: true, concurrency: 5 }
      );
      console.log('   assets enviados');
    }

    // Step 7: Upload dist (fresh build)
    console.log('\n7. Enviando dist/ (build)...');
    await ssh.execCommand(`rm -rf ${REMOTE_ROOT}/dist && mkdir -p ${REMOTE_ROOT}/dist`);
    await ssh.putDirectory(
      path.join(LOCAL_ROOT, 'dist'),
      REMOTE_ROOT + '/dist',
      { recursive: true, concurrency: 5 }
    );
    console.log('   dist/ enviado');

    // Step 8: Install dependencies
    console.log('\n8. Instalando dependencias...');
    r = await ssh.execCommand(
      `cd ${REMOTE_ROOT} && rm -rf node_modules package-lock.json && npm install 2>&1 | tail -5`,
      { timeout: 180000 }
    );
    console.log('   ' + (r.stdout.slice(-100) || 'npm install concluido'));

    r = await ssh.execCommand(
      `cd ${REMOTE_ROOT}/backend && rm -rf node_modules package-lock.json && npm install 2>&1 | tail -5`,
      { timeout: 180000 }
    );
    console.log('   ' + (r.stdout.slice(-100) || 'backend npm install concluido'));

    // Step 9: Copy to web server
    console.log('\n9. Copiando para servidor web...');
    r = await ssh.execCommand(`
      # Remove old web files (preserve data/ and uploads/)
      rm -rf ${WEB_ROOT}/dist
      rm -f ${WEB_ROOT}/index.html ${WEB_ROOT}/app.html ${WEB_ROOT}/admin.html ${WEB_ROOT}/cliente.html
      rm -f ${WEB_ROOT}/cadastro.html ${WEB_ROOT}/cadastro.js
      rm -f ${WEB_ROOT}/cadastro.css ${WEB_ROOT}/cadastro-chat.css
      rm -f ${WEB_ROOT}/styles.css ${WEB_ROOT}/deploy.js
      rm -f ${WEB_ROOT}/package.json ${WEB_ROOT}/railway.json
      rm -f ${WEB_ROOT}/vite.config.ts ${WEB_ROOT}/tsconfig.json
      rm -f ${WEB_ROOT}/deploy.cjs ${WEB_ROOT}/deploy-vps2.cjs
      rm -rf ${WEB_ROOT}/assets ${WEB_ROOT}/admin-panel ${WEB_ROOT}/frontend
      rm -rf ${WEB_ROOT}/src ${WEB_ROOT}/scripts

      # Copy fresh files from repo
      cp -a ${REMOTE_ROOT}/dist ${WEB_ROOT}/dist
      cp ${REMOTE_ROOT}/index.html ${WEB_ROOT}/
      cp ${REMOTE_ROOT}/app.html ${WEB_ROOT}/
      cp ${REMOTE_ROOT}/admin.html ${WEB_ROOT}/
      cp ${REMOTE_ROOT}/cliente.html ${WEB_ROOT}/
      cp ${REMOTE_ROOT}/cadastro.html ${WEB_ROOT}/
      cp ${REMOTE_ROOT}/cadastro.js ${WEB_ROOT}/
      cp ${REMOTE_ROOT}/cadastro.css ${WEB_ROOT}/
      cp ${REMOTE_ROOT}/cadastro-chat.css ${WEB_ROOT}/
      cp ${REMOTE_ROOT}/styles.css ${WEB_ROOT}/
      cp ${REMOTE_ROOT}/deploy.js ${WEB_ROOT}/
      cp -a ${REMOTE_ROOT}/assets ${WEB_ROOT}/assets
      cp -a ${REMOTE_ROOT}/admin-panel ${WEB_ROOT}/admin-panel
      cp -a ${REMOTE_ROOT}/frontend ${WEB_ROOT}/frontend
      cp -a ${REMOTE_ROOT}/src ${WEB_ROOT}/src
      cp ${REMOTE_ROOT}/package.json ${WEB_ROOT}/
      cp ${REMOTE_ROOT}/package-lock.json ${WEB_ROOT}/
      cp -a ${REMOTE_ROOT}/backend ${WEB_ROOT}/backend
      chown -R www-data:www-data ${WEB_ROOT}
      echo COPY_OK
    `, { timeout: 60000 });
    console.log('   ' + r.stdout.trim());

    // Step 10: Restart PM2
    console.log('\n10. Reiniciando PM2...');
    r = await ssh.execCommand('pm2 restart credvale 2>&1 | tail -5', { timeout: 15000 });
    console.log('   ' + r.stdout.trim());

    // Step 11: Health check
    console.log('\n11. Verificando saude...');
    await new Promise(res => setTimeout(res, 5000));
    r = await ssh.execCommand(
      'curl -s -o /dev/null -w "%{http_code}" https://cred-vale.online/api/health',
      { timeout: 15000 }
    );
    const healthCode = r.stdout.trim();
    console.log('   Health API: HTTP ' + healthCode);

    r = await ssh.execCommand(
      'curl -s -o /dev/null -w "%{http_code}" https://cred-vale.online',
      { timeout: 15000 }
    );
    const siteCode = r.stdout.trim();
    console.log('   Site: HTTP ' + siteCode);

    r = await ssh.execCommand(
      'curl -s -o /dev/null -w "%{http_code}" https://cred-vale.online/admin.html',
      { timeout: 15000 }
    );
    const adminCode = r.stdout.trim();
    console.log('   Admin: HTTP ' + adminCode);

    ssh.dispose();
    console.log('\n=== ✅ CLEAN DEPLOY VPS CONCLUIDO ===');
    console.log(`   Health: ${healthCode}, Site: ${siteCode}, Admin: ${adminCode}`);

    // Step 12: Commit and push to git (triggers Railway auto-deploy)
    console.log('\n12. Enviando para GitHub (Railway)...');
    const { execSync } = require('child_process');
    try {
      execSync('git add -A', { cwd: LOCAL_ROOT, stdio: 'inherit', timeout: 30000 });
      execSync('git diff --cached --quiet || git commit -m "deploy: vps ' + new Date().toISOString().slice(0,10) + ' + cache bust"', { cwd: LOCAL_ROOT, stdio: 'inherit', timeout: 30000 });
      execSync('git push origin main', { cwd: LOCAL_ROOT, stdio: 'inherit', timeout: 60000 });
      console.log('   ✅ GitHub push concluído — Railway fará auto-deploy');
    } catch (gitErr) {
      console.log('   ⚠️  Git push: ' + (gitErr.message || 'sem alterações'));
    }

  } catch (e) {
    console.log('ERRO:', e.message);
    ssh.dispose();
    process.exit(1);
  }
})();
