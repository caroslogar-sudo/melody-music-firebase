import { useState, useEffect, useRef } from 'react';
import { getTrackCover } from '../services/coverService';
import { Track } from '../types';

/**
 * Hook that manages cover art fetching for a list of tracks.
 * Returns a Record<trackId, coverUrl> that updates as covers load.
 * Covers are saved to Firestore, so on next app load they're instant.
 */
export const useCovers = (tracks: Track[]): Record<string, string> => {
  const [covers, setCovers] = useState<Record<string, string>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const fetchCovers = async () => {
      for (const track of tracks) {
        if (cancelled) break;
        if (track.title === '.keep') continue;
        if (fetchedRef.current.has(track.id)) continue;

        // If track already has coverUrl from Firestore, use immediately
        if (track.coverUrl && track.coverUrl.startsWith('http') && !track.coverUrl.includes('scdn.co')) {
          fetchedRef.current.add(track.id);
          setCovers(prev => ({ ...prev, [track.id]: track.coverUrl }));
          continue;
        }

        fetchedRef.current.add(track.id);

        try {
          const url = await getTrackCover(track);
          if (!cancelled && url) {
            setCovers(prev => ({ ...prev, [track.id]: url }));
          }
          // Small delay to not spam iTunes API
          await new Promise(r => setTimeout(r, 250));
        } catch { /* ignore */ }
      }
    };

    if (tracks.length > 0) fetchCovers();
    return () => { cancelled = true; };
  }, [tracks.map(t => t.id).join(',')]);

  return covers;
};

/** Get fallback image URL for a track */
export const getCoverFallback = (artist: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(artist || 'M')}&background=D4AF37&color=fff&size=200&bold=true`;