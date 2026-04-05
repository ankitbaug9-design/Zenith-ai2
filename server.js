// ═══════════════════════════════════════════════
//  Zenith AI — Backend Server
//  1. npm install
//  2. node server.js
//  3. Open http://localhost:3000
// ═══════════════════════════════════════════════

const express  = require('express');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');

const app       = express();
const PORT      = process.env.PORT || 3000;
const KEYS_FILE = path.join(__dirname, 'keys.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Key storage helpers ──────────────────────────────────────────────────────
function loadKeys() {
  try { return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8')); }
  catch { return { kClaude:'', kOpenai:'', kGemini:'', kOpenrouter:'' }; }
}
function writeKeys(k) { fs.writeFileSync(KEYS_FILE, JSON.stringify(k, null, 2)); }

// ── GET /api/keys ────────────────────────────────────────────────────────────
app.get('/api/keys', (req, res) => res.json(loadKeys()));

// ── POST /api/keys ───────────────────────────────────────────────────────────
app.post('/api/keys', (req, res) => {
  const { kClaude='', kOpenai='', kGemini='', kOpenrouter='' } = req.body;
  writeKeys({ kClaude, kOpenai, kGemini, kOpenrouter });
  res.json({ ok: true });
});

// ── POST /api/claude ─────────────────────────────────────────────────────────
app.post('/api/claude', async (req, res) => {
  const key = loadKeys().kClaude;
  if (!key) return res.status(400).json({ error:{ message:'No Claude key saved — open ⚙ Settings.' }});
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify(req.body)
    });
    res.status(r.status).json(await r.json());
  } catch(e) { res.status(500).json({ error:{ message:e.message }}); }
});

// ── POST /api/gemini ─────────────────────────────────────────────────────────
app.post('/api/gemini', async (req, res) => {
  const key = loadKeys().kGemini;
  if (!key) return res.status(400).json({ error:{ message:'No Gemini key saved — open ⚙ Settings.' }});
  try {
    const { model='gemini-2.0-flash', ...body } = req.body;
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }
    );
    res.status(r.status).json(await r.json());
  } catch(e) { res.status(500).json({ error:{ message:e.message }}); }
});

// ── POST /api/openai ─────────────────────────────────────────────────────────
app.post('/api/openai', async (req, res) => {
  const key = loadKeys().kOpenai;
  if (!key) return res.status(400).json({ error:{ message:'No OpenAI key saved — open ⚙ Settings.' }});
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+key },
      body: JSON.stringify(req.body)
    });
    res.status(r.status).json(await r.json());
  } catch(e) { res.status(500).json({ error:{ message:e.message }}); }
});

// ── POST /api/openrouter ──────────────────────────────────────────────────────
// Accepts key + model from the frontend body (so user's saved key is used)
// Falls back to key stored in keys.json if not provided
app.post('/api/openrouter', async (req, res) => {
  const { orKey, model, messages } = req.body;
  const key = orKey || loadKeys().kOpenrouter;
  if (!key) return res.status(400).json({ error:{ message:'No OpenRouter key — add it in ⚙ Settings.' }});
  const selectedModel = model || 'meta-llama/llama-3.3-70b-instruct:free';
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer ' + key,
        'X-Title':'Zenith AI'
      },
      body: JSON.stringify({ model: selectedModel, messages })
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch(e) {
    res.status(500).json({ error:{ message: e.message || 'OpenRouter request failed' }});
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n  ✅  Zenith AI server running!\n');
  console.log('  Local:   http://localhost:' + PORT);
  console.log('  Network: http://<your-ip>:' + PORT + '\n');
});
