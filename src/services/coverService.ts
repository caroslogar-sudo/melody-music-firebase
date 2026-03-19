// Cover Art Service v4 - iTunes API + Firestore persistence + localStorage cache

import { updateTrackInFirestore } from './trackService';

const COVER_CACHE_KEY = 'melodi_cover_cache_v4';

// Clean old caches
try {
  localStorage.removeItem('melodi_cover_cache');
  localStorage.removeItem('melodi_cover_cache_v2');
  localStorage.removeItem('melodi_cover_cache_v3');
} catch { /* ignore */ }

const getCoverCache = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(COVER_CACHE_KEY) || '{}'); } catch { return {}; }
};

const setCoverCache = (key: string, url: string) => {
  try {
    const c = getCoverCache();
    c[key] = url;
    localStorage.setItem(COVER_CACHE_KEY, JSON.stringify(c));
  } catch { /* full */ }
};

const searchiTunes = async (query: string): Promise<string> => {
  try {
    const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=5`);
    if (!r.ok) return '';
    const data = await r.json();
    if (data.results?.length > 0) {
      const art = data.results[0].artworkUrl100;
      if (art) return art.replace('100x100bb', '600x600bb');
    }
    return '';
  } catch { return ''; }
};

/**
 * Fetch album cover and save to Firestore + localStorage
 * If track already has coverUrl in Firestore, returns it immediately.
 */
export const fetchAlbumCover = async (artist: string, title: string, trackId?: string): Promise<string> => {
  const cacheKey = `${artist}_${title}`.toLowerCase().replace(/[^a-z0-9]/g, '_');

  // Check localStorage cache
  const cached = getCoverCache()[cacheKey];
  if (cached) {
    if (cached === 'NONE') return '';
    if (cached.includes('scdn.co') || cached.includes('spotify')) {
      setCoverCache(cacheKey, 'NONE');
    } else {
      return cached;
    }
  }

  const cleanTitle = title
    .replace(/\.(mp3|wav|flac|m4a|ogg|aac|mp4|webm|mkv)$/i, '')
    .replace(/^\d+[\s._-]+/, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s*\[.*?\]\s*/g, ' ')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/youtube|official\s*video|video\s*oficial|lyrics?|letra|audio|hd|hq|4k|1080p|720p|feat\.?|ft\.?/gi, '')
    .replace(/[\|_\-]{2,}/g, ' ')
    .replace(/[_]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const songParts = cleanTitle.split(/[\-–—|\/\\]/).map(p => p.trim()).filter(p => p.length > 2);
  const bestTitle = songParts[0] || cleanTitle;
  const altTitle = songParts.length > 1 ? songParts[1] : '';
  const isGenericArtist = !artist || artist === 'Artista Local' || artist === 'Video Local' || artist === 'Unknown' || artist.trim() === '';
  const cleanArtist = isGenericArtist ? '' : artist.trim();

  let foundUrl = '';

  // Strategy 1: first part of title
  if (bestTitle.length > 2) foundUrl = await searchiTunes(bestTitle);
  // Strategy 2: second part
  if (!foundUrl && altTitle.length > 2) foundUrl = await searchiTunes(altTitle);
  // Strategy 3: combined
  if (!foundUrl && bestTitle && altTitle) foundUrl = await searchiTunes(`${bestTitle} ${altTitle}`);
  // Strategy 4: artist + title
  if (!foundUrl && cleanArtist && bestTitle) foundUrl = await searchiTunes(`${cleanArtist} ${bestTitle}`);
  // Strategy 5: just artist
  if (!foundUrl && cleanArtist) foundUrl = await searchiTunes(cleanArtist);

  if (foundUrl) {
    setCoverCache(cacheKey, foundUrl);
    // Save to Firestore so it persists across sessions
    if (trackId) {
      try {
        await updateTrackInFirestore(trackId, { coverUrl: foundUrl });
      } catch (e) {
        console.error('Error saving cover to Firestore:', e);
      }
    }
    return foundUrl;
  }

  setCoverCache(cacheKey, 'NONE');
  return '';
};

/**
 * Get cover URL for a track - checks coverUrl field first, then fetches
 * This is the primary function all components should use
 */
export const getTrackCover = async (track: { id: string; artist: string; title: string; coverUrl?: string }): Promise<string> => {
  // If track already has a valid cover URL saved in Firestore, use it
  if (track.coverUrl && track.coverUrl.startsWith('http') && !track.coverUrl.includes('scdn.co')) {
    return track.coverUrl;
  }
  // Otherwise fetch and save
  return fetchAlbumCover(track.artist, track.title, track.id);
};