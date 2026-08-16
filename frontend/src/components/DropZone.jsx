import React, { useState, useRef } from 'react'

export default function DropZone({ onData, onDemo }) {
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef()

  function handleFiles(newFiles) {
    const jsons = [...newFiles].filter(f => f.name.endsWith('.json'))
    if (!jsons.length) return
    setFiles(prev => {
      const seen = new Set(prev.map(f => f.name))
      return [...prev, ...jsons.filter(f => !seen.has(f.name))]
    })
  }

  async function analyze() {
    setLoading(true)
    const allData = []
    for (const file of files) {
      try {
        const text = await file.text()
        const json = JSON.parse(text)
        if (Array.isArray(json)) allData.push(...json)
      } catch (e) { console.warn('Failed to parse', file.name) }
    }
    setTimeout(() => {
      setLoading(false)
      onData(allData)
    }, 400)
  }

  return (
    <div style={{ padding: '3rem 4rem 0' }}>
      <div
        onClick={() => inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        style={{
          border: `2px dashed ${dragging ? 'var(--green)' : 'var(--border)'}`,
          borderRadius: 4,
          padding: '4rem 2rem',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'rgba(29,185,84,0.05)' : 'var(--surface)',
          transition: 'all 0.2s',
          marginBottom: '1.5rem',
        }}
      >
        <input ref={inputRef} type="file" accept=".json" multiple style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)} />

        <div style={{
          width: 64, height: 64, margin: '0 auto 1.5rem',
          background: 'var(--surface3)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>

        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
          Drop Your JSON Files Here
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', fontFamily: "'Space Mono', monospace" }}>
          Drag & drop one or more Spotify extended history files<br />
          or <span style={{ color: 'var(--green)' }}>click to browse</span>
        </div>

        {files.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            {files.map(f => (
              <div key={f.name} style={{
                background: 'var(--surface3)',
                border: '1px solid var(--border)',
                borderRadius: 100,
                padding: '0.25rem 0.75rem',
                fontSize: '0.75rem',
                fontFamily: "'Space Mono', monospace",
                color: 'var(--green)',
              }}>📄 {f.name}</div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '1.5rem', fontFamily: "'Space Mono', monospace", fontSize: '0.75rem', color: 'var(--muted)' }}>
          <div style={{ width: 200, height: 3, background: 'var(--surface3)', borderRadius: 2, margin: '0 auto 0.75rem', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--green)', borderRadius: 2, animation: 'load 1.5s ease-in-out infinite' }} />
          </div>
          Crunching your data...
        </div>
      ) : (
        <button
          disabled={files.length === 0}
          onClick={analyze}
          style={{
            display: 'block',
            width: '100%',
            padding: '1rem',
            background: files.length > 0 ? 'var(--green)' : 'var(--surface3)',
            color: files.length > 0 ? 'black' : 'var(--muted)',
            border: 'none',
            borderRadius: 4,
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '1.3rem',
            letterSpacing: '0.1em',
            cursor: files.length > 0 ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            marginBottom: '2rem',
          }}
        >
          ANALYZE MY LISTENING HISTORY
        </button>
      )}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        margin: '0 0 1rem',
      }}>
        <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
        <span style={{
          color: 'var(--muted)',
          fontFamily: "'Space Mono', monospace",
          fontSize: '0.65rem',
          letterSpacing: '0.12em',
        }}>
          NO SPOTIFY EXPORT YET?
        </span>
        <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
      </div>

      <button
        onClick={onDemo}
        style={{
          display: 'block',
          width: '100%',
          padding: '1rem',
          background: 'transparent',
          color: 'var(--green)',
          border: '1px solid var(--green)',
          borderRadius: 4,
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '1.2rem',
          letterSpacing: '0.1em',
          cursor: 'pointer',
          transition: 'all 0.2s',
          marginBottom: '2rem',
        }}
      >
        VIEW DEMO WITH SAMPLE DATA
      </button>
    </div>
  )
}
