const MUSIC_SESSION_KEY = 'growdy_music_playback';

try {
  const raw = sessionStorage.getItem(MUSIC_SESSION_KEY);
  if (raw) {
    const session = JSON.parse(raw);
    if (!session?.pausedByUser && session?.trackIndex != null && session.trackIndex >= 0) {
      const src = `assets/goofy${session.trackIndex + 1}.mp3`;
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'fetch';
      link.href = src;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
  }
} catch {
  // ignore
}
