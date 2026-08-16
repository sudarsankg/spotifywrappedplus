const DEMO_TRACKS = [
  { name: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', duration: 200040 },
  { name: 'Shape of You', artist: 'Ed Sheeran', album: '÷ (Deluxe)', duration: 233713 },
  { name: 'As It Was', artist: 'Harry Styles', album: "Harry's House", duration: 167303 },
  { name: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia', duration: 203064 },
  { name: 'bad guy', artist: 'Billie Eilish', album: 'WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?', duration: 194088 },
  { name: 'Circles', artist: 'Post Malone', album: "Hollywood's Bleeding", duration: 215280 },
  { name: 'Heat Waves', artist: 'Glass Animals', album: 'Dreamland', duration: 238805 },
  { name: 'Watermelon Sugar', artist: 'Harry Styles', album: 'Fine Line', duration: 174000 },
  { name: 'Save Your Tears', artist: 'The Weeknd', album: 'After Hours', duration: 215627 },
  { name: "Don't Start Now", artist: 'Dua Lipa', album: 'Future Nostalgia', duration: 183290 },
  { name: 'Mr. Brightside', artist: 'The Killers', album: 'Hot Fuss', duration: 222973 },
  { name: 'Yellow', artist: 'Coldplay', album: 'Parachutes', duration: 266773 },
  { name: 'Take on Me', artist: 'a-ha', album: 'Hunting High and Low', duration: 225280 },
  { name: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', duration: 354320 },
  { name: 'Smells Like Teen Spirit', artist: 'Nirvana', album: 'Nevermind', duration: 301920 },
  { name: 'Dreams', artist: 'Fleetwood Mac', album: 'Rumours', duration: 257800 },
]

const PLATFORMS = ['iOS 17.4 (iPhone)', 'OS X 14.4', 'Web Player (Chrome)', 'Android 14']

function seededRandom(seed) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

export function createDemoHistory() {
  const random = seededRandom(202603)
  const history = []

  for (let year = 2022; year <= 2025; year++) {
    for (let month = 0; month < 12; month++) {
      const playsThisMonth = 24 + Math.floor(random() * 20)

      for (let play = 0; play < playsThisMonth; play++) {
        const trackIndex = Math.min(
          DEMO_TRACKS.length - 1,
          Math.floor(Math.pow(random(), 1.7) * DEMO_TRACKS.length),
        )
        const track = DEMO_TRACKS[trackIndex]
        const skipped = random() < 0.08
        const playedFraction = skipped
          ? 0.08 + random() * 0.3
          : 0.78 + random() * 0.22
        const day = 1 + Math.floor(random() * 27)
        const hour = random() < 0.62
          ? 16 + Math.floor(random() * 7)
          : 7 + Math.floor(random() * 9)
        const minute = Math.floor(random() * 60)
        const timestamp = new Date(Date.UTC(year, month, day, hour, minute))

        history.push({
          ts: timestamp.toISOString(),
          platform: PLATFORMS[Math.floor(random() * PLATFORMS.length)],
          ms_played: Math.round(track.duration * playedFraction),
          master_metadata_track_name: track.name,
          master_metadata_album_artist_name: track.artist,
          master_metadata_album_album_name: track.album,
          spotify_track_uri: `spotify:track:demo-${trackIndex}`,
          reason_start: random() < 0.7 ? 'trackdone' : 'clickrow',
          reason_end: skipped ? 'fwdbtn' : 'trackdone',
          shuffle: random() < 0.55,
          skipped,
          offline: random() < 0.2,
          incognito_mode: random() < 0.01,
        })
      }
    }
  }

  return history.sort((a, b) => a.ts.localeCompare(b.ts))
}
