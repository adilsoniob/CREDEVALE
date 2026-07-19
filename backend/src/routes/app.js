const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { get, run, all } = require('../database');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = 'app_' + Date.now() + ext;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.apk', '.aab', '.ipa'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) return cb(null, true);
  cb(new Error('Tipo de arquivo não permitido. Use .apk, .aab ou .ipa'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 300 * 1024 * 1024 }
});

// Public: get active version
router.get('/active', (req, res) => {
  try {
    const row = get("SELECT * FROM app_versions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1");
    if (!row) return res.json({ active: false });
    res.json({
      active: true,
      id: row.id,
      file_name: row.file_name,
      original_name: row.original_name,
      version: row.version || '',
      file_type: row.file_type,
      file_size: row.file_size,
      external_link: row.external_link || '',
      created_at: row.created_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: register download click (tracking)
router.post('/register-download', (req, res) => {
  try {
    const { v4: uuidv4 } = require('uuid');
    const { client_id, client_cpf, client_nome, device_info } = req.body;
    const id = uuidv4();
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '';
    const userAgent = (req.headers['user-agent'] || '').slice(0, 500);

    run(`INSERT INTO app_downloads (id, client_id, client_cpf, client_nome, status, apk_available, device_info, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, client_id || null, client_cpf || null, client_nome || null, 'iniciado', 1, device_info || null, ip, userAgent]);

    // Also update client's download_clicked_at (timestamp da tentativa)
    if (client_id) {
      run("UPDATE clients SET download_clicked_at = datetime('now') WHERE id = ?", [client_id]);
    }

    res.json({ success: true, download_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: download active APK
router.get('/download-active', (req, res) => {
  try {
    const row = get("SELECT * FROM app_versions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1");
    if (!row || !row.file_path || !fs.existsSync(row.file_path)) {
      return res.status(404).json({ error: 'Nenhum aplicativo disponível para download no momento.' });
    }
    if (row.external_link) return res.redirect(row.external_link);
    res.download(row.file_path, row.original_name);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: upload new version
router.post('/upload', authMiddleware, requireAdmin, (req, res) => {
  upload.single('app_file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Arquivo muito grande. Máximo: 300MB' });
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    try {
      if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

      const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
      const id = uuidv4();
      const version = req.body.version || '1.0.0';

      // Archive previous active versions
      run("UPDATE app_versions SET status = 'archived' WHERE status = 'active'");

      run(`INSERT INTO app_versions (id, file_name, original_name, version, file_path, file_size, file_type, status, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        [id, req.file.filename, req.file.originalname, version, req.file.path, req.file.size, ext, req.user.id]);

      // Log
      run(`INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, 'app_upload', 'app_versions', id, 'Upload: ' + req.file.originalname + ' v' + version]);

      res.json({ success: true, id, file_name: req.file.filename, version });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// Admin: list all versions
router.get('/versions', authMiddleware, requireAdmin, (req, res) => {
  try {
    const rows = all('SELECT * FROM app_versions ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: set external link
router.put('/external-link', authMiddleware, requireAdmin, (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL é obrigatória' });

    // Store external_link on the active version, or create a placeholder
    let active = get("SELECT id FROM app_versions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1");
    if (active) {
      run('UPDATE app_versions SET external_link = ?, updated_at = datetime(\'now\') WHERE id = ?', [url, active.id]);
    } else {
      const id = uuidv4();
      run(`INSERT INTO app_versions (id, file_name, original_name, version, file_path, file_size, file_type, external_link, status, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        [id, '', 'Link Externo', '', '', 0, 'apk', url, req.user.id]);
    }

    run(`INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'app_external_link', 'app_versions', active?.id || '', 'Link externo atualizado: ' + url]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: activate a version
router.put('/versions/:id/activate', authMiddleware, requireAdmin, (req, res) => {
  try {
    const existing = get('SELECT * FROM app_versions WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Versão não encontrada' });

    run("UPDATE app_versions SET status = 'archived' WHERE status = 'active'");
    run('UPDATE app_versions SET status = ? WHERE id = ?', ['active', req.params.id]);

    run(`INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'app_activate', 'app_versions', req.params.id, 'Versão ativada: ' + (existing.original_name || existing.version)]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: delete a version
router.delete('/versions/:id', authMiddleware, requireAdmin, (req, res) => {
  try {
    const existing = get('SELECT * FROM app_versions WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Versão não encontrada' });

    run('DELETE FROM app_versions WHERE id = ?', [req.params.id]);

    if (existing.file_path && fs.existsSync(existing.file_path)) {
      try { fs.unlinkSync(existing.file_path); } catch (e) {}
    }

    run(`INSERT INTO logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'app_delete', 'app_versions', req.params.id, 'Versão excluída: ' + (existing.original_name || existing.version)]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: download a version file
router.get('/download/:id', authMiddleware, requireAdmin, (req, res) => {
  try {
    const row = get('SELECT * FROM app_versions WHERE id = ?', [req.params.id]);
    if (!row || !row.file_path || !fs.existsSync(row.file_path)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    res.download(row.file_path, row.original_name);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
