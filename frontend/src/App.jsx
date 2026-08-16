import React, { useState, useEffect, useMemo } from 'react'
import Header from './components/Header'
import DropZone from './components/DropZone'
import GlobalFilter from './components/GlobalFilter'
import HeroStats from './components/HeroStats'
import FunFacts from './components/FunFacts'
import RankedList from './components/RankedList'
import TimelineChart from './components/TimelineChart'
import Heatmap from './components/Heatmap'
import { Platforms } from './components/PlatformStats'
import ListeningInsights from './components/ListeningInsights'
import Recommendations from './components/Recommendations'
import CompareView from './components/CompareView'
import { useListeningData } from './hooks/useListeningData'
import { computeExtendedStats, computeTimeline } from './utils/dataProcessing'
import { createDemoHistory } from './utils/demoHistory'

export default function App() {
  const {
    allTracks, loadTracks, reset,
    year, month, setMonth, handleYearChange,
    years, monthsByYear, stats, timeline, periodLabel,
  } = useListeningData()

  // AI State
  const [aiStatus, setAiStatus] = useState('')
  const [hitsRecs, setHitsRecs] = useState([])
  const [diverseRecs, setDiverseRecs] = useState([])
  const [deepRecs, setDeepRecs] = useState([])
  const [clusterViz, setClusterViz] = useState(null)
  const [tasteDna, setTasteDna] = useState(null)
  const [isDeepLoading, setIsDeepLoading] = useState(false)
  const [currentSeed, setCurrentSeed] = useState(42)
  const [recMethod, setRecMethod] = useState('autoencoder') // 'autoencoder' or 'clustering'

  // Sharing State
  const [sharedStats, setSharedStats] = useState(null)
  const [sharedName, setSharedName] = useState('')
  const [shareLink, setShareLink] = useState('')
  const [isSharing, setIsSharing] = useState(null) // null, 'share', or 'compare'
  const [showCompare, setShowCompare] = useState(false)
  const [isCompareLink, setIsCompareLink] = useState(false)
  const [toast, setToast] = useState(null)
  const [showNameModal, setShowNameModal] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [isCompareMode, setIsCompareMode] = useState(false)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // AI Period State (Separate from the dashboard filter)
  const [recYear, setRecYear] = useState('all')
  const [recMonth, setRecMonth] = useState('all')

  const hasData = allTracks.length > 0
  const userExtendedStats = useMemo(() => {
    if (allTracks.length === 0) return null
    const base = computeExtendedStats(allTracks)
    if (tasteDna) base.taste_dna = tasteDna
    base.yearly_timeline = computeTimeline(allTracks, 'all', 'all')
    return base
  }, [allTracks, tasteDna])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shareId = params.get('share')
    const shouldCompare = params.get('compare') === 'true'
    if (shareId) {
      setIsCompareLink(shouldCompare)
      const API_URL = import.meta.env.VITE_API_URL || ''
      fetch(`${API_URL}/share/${shareId}`)
        .then(res => res.json())
        .then(json => {
          if (json.status === 'success') {
            setSharedStats(json.data.stats)
            setSharedName(json.data.display_name)
            if (shouldCompare) setShowCompare(true)
          }
        })
        .catch(e => console.error("Failed to fetch shared stats", e))
    }
  }, [])

  const handleShare = (isCompare = false) => {
    setIsCompareMode(isCompare)
    setShowNameModal(true)
  }

  const executeShare = async () => {
    const displayName = nameInput.trim() || 'User'
    setShowNameModal(false)
    setIsSharing(isCompareMode ? 'compare' : 'share')
    
    const extendedStats = computeExtendedStats(allTracks)
    if (tasteDna) extendedStats.taste_dna = tasteDna
    extendedStats.yearly_timeline = computeTimeline(allTracks, 'all', 'all')
    
    const API_URL = import.meta.env.VITE_API_URL || ''
    
    try {
      const res = await fetch(`${API_URL}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName, stats: extendedStats })
      })
      const data = await res.json()
      if (data.status === 'success') {
        const link = `${window.location.origin}${window.location.pathname}?share=${data.share_id}${isCompareMode ? '&compare=true' : ''}`
        setShareLink(link)
        navigator.clipboard.writeText(link)
        showToast("LINK COPIED TO CLIPBOARD")
      }
    } catch (e) {
      showToast("FAILED TO GENERATE LINK")
    } finally {
      setIsSharing(null)
    }
  }

  const getWeightedTopTracks = (data, filterYear, filterMonth) => {
    const trackStats = {}
    data.forEach(song => {
      const ts = song.ts || song.endTime
      if (!ts) return
      if (filterYear !== 'all' && ts.slice(0, 4) !== filterYear) return
      if (filterMonth !== 'all' && ts.slice(5, 7) !== filterMonth) return
      const name = song.master_metadata_track_name || song.trackName
      if (name) {
        if (!trackStats[name]) trackStats[name] = { totalMs: 0, count: 0 }
        trackStats[name].totalMs += (song.ms_played || song.msPlayed || 0)
        trackStats[name].count += 1
      }
    })
    return Object.entries(trackStats)
      .sort((a, b) => b[1].totalMs - a[1].totalMs)
      .slice(0, 2000)
      .map(([name, stats]) => ({ name, count: stats.count }))
  }

  const runAnalysis = async (weightedTracks, seed, method) => {
    if (weightedTracks.length === 0) {
      setAiStatus('No listening history found for this period.')
      return
    }
    const methodLabel = method === 'clustering' ? 'Clustering + Cosine' : 'Autoencoder'
    setAiStatus(`Training weighted ${methodLabel} on ${weightedTracks.length} tracks...`)
    setHitsRecs([])
    setDiverseRecs([])
    setDeepRecs([])
    setClusterViz(null)
    
    const API_URL = import.meta.env.VITE_API_URL || ''
    
    try {
      const resHits = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ top_tracks: weightedTracks, seed, mode: 'hits', method })
      })
      const dataHits = await resHits.json()
      setHitsRecs(dataHits.recommendations || [])
      if (dataHits.cluster_viz) setClusterViz(dataHits.cluster_viz)
      if (dataHits.taste_dna) setTasteDna(dataHits.taste_dna)

      const resDiv = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ top_tracks: weightedTracks, seed, mode: 'diverse', method })
      })
      const dataDiv = await resDiv.json()
      setDiverseRecs(dataDiv.recommendations || [])

      setIsDeepLoading(true)
      const resDeep = await fetch(`${API_URL}/deep_analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ top_tracks: weightedTracks, seed, method })
      })
      const dataDeep = await resDeep.json()
      setDeepRecs(dataDeep.recommendations || [])
      setAiStatus(`Analysis complete using ${methodLabel}!`)
    } catch (e) {
      setAiStatus('Analysis failed.')
    } finally {
      setIsDeepLoading(false)
    }
  }

  useEffect(() => {
    if (hasData) {
      const weighted = getWeightedTopTracks(allTracks, recYear, recMonth)
      runAnalysis(weighted, currentSeed, recMethod)
    }
  }, [recYear, recMonth, recMethod])

  const handleRefreshAI = () => {
    const newSeed = Math.floor(Math.random() * 1000000)
    setCurrentSeed(newSeed)
    const weighted = getWeightedTopTracks(allTracks, recYear, recMonth)
    runAnalysis(weighted, newSeed, recMethod)
  }

  const handleDataLoaded = async (allData) => {
    loadTracks(allData)
    const weighted = getWeightedTopTracks(allData, recYear, recMonth)
    runAnalysis(weighted, currentSeed, recMethod)
  }

  const handleDemo = () => {
    handleDataLoaded(createDemoHistory())
    showToast('SAMPLE LISTENING HISTORY LOADED')
  }

  return (
    <div>
      <Header />
      {!hasData ? (
        <div style={{ padding: '2rem 4rem 0' }}>
          {sharedStats ? (
            <>
              {isCompareLink ? (
                /* INVITATION TO COMPARE SCREEN */
                <div style={{ 
                  marginBottom: '2rem', 
                  background: 'var(--surface)', 
                  border: '1px solid var(--accent)', 
                  padding: '4rem 2rem', 
                  borderRadius: 4,
                  textAlign: 'center',
                  animation: 'fadeUp 0.5s ease'
                }}>
                  <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--accent)', fontSize: '3rem', margin: '0 0 1rem 0' }}>
                    {(sharedName || 'Someone').toUpperCase()} INVITED YOU TO COMPARE STATS!
                  </h3>
                  <p style={{ color: 'var(--text)', fontSize: '1rem', maxWidth: '600px', margin: '0 auto 2.5rem', fontFamily: "'Space Mono', monospace", lineHeight: 1.6 }}>
                    Upload your Spotify extended history below to see how your musical taste matches up with theirs.
                  </p>
                  <div style={{ width: 100, height: 2, background: 'var(--accent)', margin: '0 auto', opacity: 0.3 }} />
                </div>
              ) : (
                /* SHARED STATS REPLICA */
                <>
                  <div style={{ 
                    marginBottom: '2rem', 
                    background: 'var(--surface)', 
                    border: '1px solid var(--green)', 
                    padding: '1.5rem', 
                    borderRadius: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--green)', fontSize: '1.5rem', margin: 0 }}>
                        VIEWING {(sharedName || 'USER').toUpperCase()}'S STATS
                      </h3>
                      <p style={{ color: 'var(--muted)', fontSize: '0.7rem', fontFamily: "'Space Mono', monospace", marginTop: '0.2rem' }}>
                        This is a shared snapshot. Upload your own data below to see your own analysis.
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        const el = document.getElementById('upload-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      style={{
                        background: 'var(--green)',
                        color: 'black',
                        border: 'none',
                        padding: '0.6rem 1.2rem',
                        borderRadius: 4,
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                      }}
                    >
                      UPLOAD MY DATA
                    </button>
                  </div>

                  <div className="section-label">Overview</div>
                  <HeroStats stats={sharedStats} />

                  <div className="section-label">Fun Facts</div>
                  <FunFacts stats={sharedStats} />

                  <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                    <RankedList title="Top Tracks" items={sharedStats.topTracks} getName={d => d.name} getSub={d => `${d.artist} · ${d.plays.toLocaleString()} plays`} maxMs={sharedStats.topTracks[0]?.ms} />
                    <RankedList title="Top Artists" items={sharedStats.topArtists} getName={d => d.key} getSub={d => `${d.plays.toLocaleString()} plays`} maxMs={sharedStats.topArtists[0]?.ms} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '4rem', alignItems: 'stretch' }}>
                    <RankedList title="Top Albums" items={sharedStats.topAlbums} getName={d => d.album} getSub={d => `${d.artist} · ${d.plays.toLocaleString()} plays`} maxMs={sharedStats.topAlbums[0]?.ms} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <Heatmap heatmap={sharedStats.heatmap} />
                      <ListeningInsights stats={sharedStats} />
                      <Platforms topPlatforms={sharedStats.topPlatforms} />
                    </div>
                  </div>
                </>
              )}

              <div id="upload-section" style={{ borderTop: '1px solid var(--border)', paddingTop: '4rem', marginBottom: '2rem' }}>
                <div className="section-label">{isCompareLink ? 'Step 1: Upload Your Data' : 'Analyze Your Own History'}</div>
                <DropZone onData={handleDataLoaded} onDemo={handleDemo} />
              </div>

              <Recommendations 
                allTracks={[]} // No local tracks yet
                years={[]}
                monthsByYear={{}}
                recYear="all"
                recMonth="all"
                setRecYear={() => {}}
                setRecMonth={() => {}}
                hitsRecs={[]} 
                diverseRecs={[]} 
                deepRecs={[]} 
                onRefresh={() => {}} 
                isDeepLoading={false}
                recMethod="autoencoder"
                setRecMethod={() => {}}
                clusterViz={null}
                isSharedView={true} // New prop to hide AI grid
              />
            </>
          ) : (
            <DropZone onData={handleDataLoaded} onDemo={handleDemo} />
          )}
        </div>
      ) : (
        <>
          <div style={{ padding: '2rem 4rem 0' }}>
            {aiStatus && (
               <div style={{ padding: '1rem', background: 'var(--surface3)', color: 'var(--green)', fontFamily: "'Space Mono', monospace", fontSize: '0.8rem', marginBottom: '1rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                 ⚙️ AI Status: {aiStatus}
               </div>
            )}
            
            {sharedStats && isCompareLink && (
               <div style={{ marginBottom: '2rem' }}>
                 <button 
                   onClick={() => setShowCompare(!showCompare)}
                   style={{ 
                     width: '100%', 
                     padding: '1.2rem', 
                     background: 'var(--surface)', 
                     border: `2px solid ${showCompare ? 'var(--green)' : 'var(--border)'}`, 
                     color: showCompare ? 'var(--green)' : 'var(--muted)', 
                     fontFamily: "'Space Mono', monospace", 
                     cursor: 'pointer',
                     borderRadius: 4,
                     fontSize: '0.9rem',
                     letterSpacing: '0.15em',
                     transition: 'all 0.2s',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     gap: '1rem'
                   }}
                 >
                   {showCompare ? '↑ BACK TO MY PERSONAL STATS' : `↓ COMPARE WITH ${(sharedName || 'FRIEND').toUpperCase()}'S TASTE`}
                 </button>
               </div>
            )}

            {!showCompare ? (
              <>
                <GlobalFilter 
                  years={years} 
                  year={year} 
                  month={month} 
                  onYearChange={handleYearChange} 
                  onMonthChange={setMonth} 
                  periodLabel={periodLabel} 
                  onReset={reset}
                  onShare={handleShare}
                  isSharing={isSharing}
                />
                
                {stats && (
                  <>
                    <div className="section-label">Overview</div>
                    <HeroStats stats={stats} />

                    <div className="section-label">Fun Facts</div>
                    <FunFacts stats={stats} />

                    <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                      <RankedList title="Top Tracks" items={stats.topTracks} getName={d => d.name} getSub={d => `${d.artist} · ${d.plays.toLocaleString()} plays`} maxMs={stats.topTracks[0]?.ms} />
                      <RankedList title="Top Artists" items={stats.topArtists} getName={d => d.key} getSub={d => `${d.plays.toLocaleString()} plays`} maxMs={stats.topArtists[0]?.ms} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem', alignItems: 'stretch' }}>
                      <RankedList title="Top Albums" items={stats.topAlbums} getName={d => d.album} getSub={d => `${d.artist} · ${d.plays.toLocaleString()} plays`} maxMs={stats.topAlbums[0]?.ms} />
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <TimelineChart timeline={timeline} />
                        <Heatmap heatmap={stats.heatmap} />
                        <ListeningInsights stats={stats} />
                        <Platforms topPlatforms={stats.topPlatforms} />
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <CompareView 
                userStats={userExtendedStats} 
                sharedStats={sharedStats} 
                sharedName={sharedName} 
              />
            )}
          </div>
          
          {!showCompare && (
            <Recommendations 
              allTracks={allTracks}
              years={years}
              monthsByYear={monthsByYear}
              recYear={recYear}
              recMonth={recMonth}
              setRecYear={setRecYear}
              setRecMonth={setRecMonth}
              hitsRecs={hitsRecs} 
              diverseRecs={diverseRecs} 
              deepRecs={deepRecs} 
              onRefresh={handleRefreshAI} 
              isDeepLoading={isDeepLoading}
              recMethod={recMethod}
              setRecMethod={setRecMethod}
              clusterViz={clusterViz}
            />
          )}
        </>
      )}
      <style>{`
        @keyframes toastFade {
          0% { opacity: 0; transform: translate(-50%, 20px); }
          10% { opacity: 1; transform: translate(-50%, 0); }
          90% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -10px); }
        }
      `}</style>
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '3rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--green)',
          color: 'black',
          padding: '0.8rem 1.5rem',
          borderRadius: 4,
          fontFamily: "'Space Mono', monospace",
          fontSize: '0.75rem',
          fontWeight: 'bold',
          letterSpacing: '0.1em',
          zIndex: 99999,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          animation: 'toastFade 3s ease forwards',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>✓</span> {toast}
        </div>
      )}

      {showNameModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '2rem'
        }}>
          <div className="card fade-up" style={{ 
            width: '100%', 
            maxWidth: '400px', 
            border: '1px solid var(--green)', 
            padding: '2.5rem',
            background: 'var(--surface)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ 
              fontFamily: "'Bebas Neue', sans-serif", 
              fontSize: '2rem', 
              color: 'var(--green)', 
              marginBottom: '0.5rem',
              letterSpacing: '0.05em'
            }}>
              DISPLAY NAME
            </h3>
            <p style={{ 
              fontFamily: "'Space Mono', monospace", 
              fontSize: '0.7rem', 
              color: 'var(--muted)', 
              marginBottom: '1.5rem',
              lineHeight: 1.4
            }}>
              Enter the name you want others to see when viewing your snapshot.
            </p>
            
            <input 
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="e.g. John"
              onKeyDown={e => e.key === 'Enter' && executeShare()}
              style={{
                width: '100%',
                background: 'var(--surface3)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                padding: '1rem',
                borderRadius: 4,
                fontFamily: "'Space Mono', monospace",
                fontSize: '0.9rem',
                outline: 'none',
                marginBottom: '2rem',
                transition: 'border-color 0.2s'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--green)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => setShowNameModal(false)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--muted)',
                  padding: '1rem',
                  borderRadius: 4,
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  letterSpacing: '0.1em'
                }}
              >
                CANCEL
              </button>
              <button 
                onClick={executeShare}
                style={{
                  flex: 2,
                  background: 'var(--green)',
                  border: 'none',
                  color: 'black',
                  padding: '1rem',
                  borderRadius: 4,
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  letterSpacing: '0.1em'
                }}
              >
                CONTINUE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
