import { useRef, useState } from 'react';
import { ScanLine, X, CheckCircle, AlertCircle, Loader, Plus } from 'lucide-react';
import { authFetch } from '../context/AuthContext';
import { generateUUID, fileToBase64 } from '../utils';

// status: 'processing' | 'ready' | 'error'

export default function ScanQueue({ itemCategories, onApply }) {
  const [jobs, setJobs]         = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const inputRef = useRef(null);

  async function handleFiles(files) {
    for (const file of Array.from(files)) {
      const id     = generateUUID();
      const image  = await fileToBase64(file);

      setJobs(prev => [...prev, { id, image, status: 'processing', result: null, error: null }]);

      // fire off independently — no await — so next file starts immediately
      authFetch('/api/scan', {
        method: 'POST',
        body: { image, itemCategories: itemCategories.map(i => i.name) },
      })
        .then(r => r.json().then(d => ({ ok: r.ok, d })))
        .then(({ ok, d }) => {
          if (!ok) throw new Error(d.error || 'Scan failed');
          setJobs(prev => prev.map(j =>
            j.id === id ? { ...j, status: 'ready', result: d.extracted } : j
          ));
        })
        .catch(err => {
          setJobs(prev => prev.map(j =>
            j.id === id ? { ...j, status: 'error', error: err.message } : j
          ));
        });
    }
  }

  function applyJob(job) {
    onApply({ ...job.result, billPhoto: job.image });
    setJobs(prev => prev.filter(j => j.id !== job.id));
  }

  function removeJob(id) {
    setJobs(prev => prev.filter(j => j.id !== id));
  }

  if (jobs.length === 0) {
    return (
      <div
        className="card card-pad mb-4"
        style={{ borderStyle: 'dashed', borderColor: 'var(--paper-3)', cursor: 'pointer', textAlign: 'center' }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)} />
        <ScanLine size={22} style={{ color: 'var(--accent)', marginBottom: 6 }} />
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Scan Bill to Auto-fill</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Click or drag &amp; drop bill photos — multiple allowed</div>
      </div>
    );
  }

  return (
    <div className="card card-pad mb-4">
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsed ? 0 : 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScanLine size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Scan Queue</span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)', background: 'var(--paper-2)', padding: '2px 8px', borderRadius: 99 }}>
            {jobs.filter(j => j.status === 'processing').length > 0
              ? `${jobs.filter(j => j.status === 'processing').length} processing…`
              : `${jobs.filter(j => j.status === 'ready').length} ready`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()}>
            <Plus size={12} /> Add
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setCollapsed(v => !v)}>
            {collapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {jobs.map(job => (
            <div key={job.id} style={{
              position: 'relative', width: 130, borderRadius: 8,
              border: `1.5px solid ${job.status === 'ready' ? 'var(--green)' : job.status === 'error' ? 'var(--red)' : 'var(--paper-3)'}`,
              overflow: 'hidden', background: 'var(--paper-2)',
            }}>
              {/* Thumbnail */}
              <img src={job.image} alt="bill" style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />

              {/* Status overlay */}
              <div style={{ padding: '6px 8px' }}>
                {job.status === 'processing' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ink-3)' }}>
                    <Loader size={12} className="spin" /> Processing…
                  </div>
                )}
                {job.status === 'ready' && (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', fontSize: 11, padding: '4px 8px' }}
                    onClick={() => applyJob(job)}
                  >
                    <CheckCircle size={11} /> Apply
                  </button>
                )}
                {job.status === 'error' && (
                  <div style={{ fontSize: 10, color: 'var(--red)', lineHeight: 1.3 }}>
                    <AlertCircle size={11} style={{ display: 'inline', marginRight: 3 }} />
                    {job.error || 'Failed'}
                  </div>
                )}
              </div>

              {/* Remove button */}
              <button
                onClick={() => removeJob(job.id)}
                style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
