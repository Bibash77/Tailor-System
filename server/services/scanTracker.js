/**
 * Scan usage tracker — persists to MongoDB, auto-switches models on 429.
 */

const MODELS = [
  'google/gemini-2.0-flash-001',
  'google/gemini-2.5-flash-preview',
  'meta-llama/llama-4-maverick',
  'google/gemini-flash-1.5',
];

let _db = null;
let _state = {
  date:          '',
  modelIndex:    0,
  failedToday:   [],
  requestsToday: 0,
  costToday:     0,
  totalRequests: 0,
  totalCost:     0,
  lastSwitch:    null,
};

function today() {
  return new Date().toISOString().split('T')[0];
}

function resetIfNewDay() {
  const d = today();
  if (_state.date !== d) {
    _state.date          = d;
    _state.requestsToday = 0;
    _state.costToday     = 0;
    _state.failedToday   = [];
    _state.modelIndex    = 0;
  }
}

async function persist() {
  if (!_db) return;
  try {
    await _db.collection('settings').replaceOne(
      { _id: 'scanUsage' },
      { _id: 'scanUsage', value: _state },
      { upsert: true },
    );
  } catch {}
}

async function init(db) {
  _db = db;
  try {
    const doc = await db.collection('settings').findOne({ _id: 'scanUsage' });
    if (doc?.value) {
      _state = { ..._state, ...doc.value };
    }
  } catch {}
  resetIfNewDay();
}

function getCurrentModel() {
  resetIfNewDay();
  // Find first non-failed model starting from modelIndex
  for (let i = 0; i < MODELS.length; i++) {
    const idx = (_state.modelIndex + i) % MODELS.length;
    if (!_state.failedToday.includes(MODELS[idx])) {
      return MODELS[idx];
    }
  }
  return MODELS[0]; // all failed, try first anyway
}

function recordSuccess(model, cost = 0) {
  resetIfNewDay();
  _state.requestsToday++;
  _state.totalRequests++;
  _state.costToday  = +(_state.costToday  + cost).toFixed(6);
  _state.totalCost  = +(_state.totalCost  + cost).toFixed(6);
  persist();
}

function recordRateLimit(model) {
  resetIfNewDay();
  if (!_state.failedToday.includes(model)) {
    _state.failedToday.push(model);
    // Advance to next non-failed model
    for (let i = 1; i <= MODELS.length; i++) {
      const idx = (MODELS.indexOf(model) + i) % MODELS.length;
      if (!_state.failedToday.includes(MODELS[idx])) {
        _state.modelIndex = idx;
        _state.lastSwitch = { from: model, to: MODELS[idx], at: new Date().toISOString() };
        break;
      }
    }
    persist();
  }
}

async function fetchKeyInfo() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${key}` },
    });
    const d = await r.json();
    return d.data || null;
  } catch {
    return null;
  }
}

function getStats() {
  resetIfNewDay();
  return {
    currentModel:    getCurrentModel(),
    allModels:       MODELS,
    failedToday:     _state.failedToday,
    requestsToday:   _state.requestsToday,
    costToday:       _state.costToday,
    totalRequests:   _state.totalRequests,
    totalCost:       _state.totalCost,
    lastSwitch:      _state.lastSwitch,
    date:            _state.date,
  };
}

module.exports = { init, getCurrentModel, recordSuccess, recordRateLimit, getStats, fetchKeyInfo, MODELS };
