import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Initialize Gemini Client
const getClient = () => {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.VITE_API_KEY || '';
  if (!apiKey) {
    console.warn("Gemini API Key is missing. Set VITE_GEMINI_API_KEY in .env");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const getMusicInsights = async (artist: string, song: string): Promise<string> => {
  const ai = getClient();
  if (!ai) return "IA no configurada (Falta API Key).";

  try {
    const prompt = `
      Actúa como un experto musical y coreógrafo. 
      La canción es "${song}" de "${artist}".
      Provee un JSON con el siguiente formato (sin markdown):
      {
        "mood": "Breve descripción emocional (3 palabras)",
        "danceability": "Sugerencia de paso de baile o ritmo (1 frase corta)",
        "trivia": "Un dato curioso muy breve sobre la canción o artista."
      }
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "{}";
  } catch (error) {
    console.error("Error fetching Gemini insights:", error);
    return "{}";
  }
};

export const getWelcomeMessage = async (username: string): Promise<string> => {
  const ai = getClient();
  if (!ai) return `Bienvenido, ${username}.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Escribe un saludo muy corto, elegante y poético para una app de música relajante para el usuario ${username}. Máximo 15 palabras.`,
    });
    return response.text || `Bienvenido a tu espacio, ${username}.`;
  } catch (e) {
    return `Bienvenido, ${username}.`;
  }
};

export const getGlobalTrends = async (): Promise<any[]> => {
  const ai = getClient();
  if (!ai) return [];

  try {
    const prompt = `
      Genera una lista JSON de las 4 canciones que son tendencia VIRAL y NOVEDADES en el mundo de la música hoy. Prioriza lo último que está sonando.
      Formato JSON array sin markdown:
      [
        { "title": "Titulo Canción", "artist": "Artista" }
      ]
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    const text = response.text || "[]";
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("Error fetching trends", e);
    return [
      { title: "Error al cargar tendencias", artist: "Intente más tarde" }
    ];
  }
};

export const searchYouTubeVideos = async (query: string): Promise<any[]> => {
  const ai = getClient();
  if (!ai) return [];
  
  try {
    const prompt = `
      Actua como un experto en musica. El usuario busca: "${query}".
      Devuelve EXACTAMENTE 6 resultados de canciones o videos musicales REALES y POPULARES que existan en YouTube.
      Formato JSON array sin markdown ni backticks:
      [{"title": "Titulo exacto del video en YouTube", "channel": "Nombre del canal/artista"}]
      Solo devuelve el JSON array, nada mas.
    `;
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    const text = response.text || "[]";
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error('YouTube search error:', e);
    return [];
  }
}

// Clean up file-based titles: remove extensions, underscores, brackets, quality tags etc.
const cleanTitle = (raw: string): string => {
  let t = raw;
  // Remove file extension
  t = t.replace(/\.[^/.]+$/, '');
  // Replace underscores and dashes with spaces
  t = t.replace(/[_]/g, ' ').replace(/\s*-\s*/g, ' - ');
  // Remove common tags in brackets/parentheses
  t = t.replace(/[\(\[].*?(remix|edit|version|cover|official|video|audio|lyric|hd|hq|320|128|mp3|flac|wav).*?[\)\]]/gi, '');
  // Remove leading track numbers like "01 " or "01. "
  t = t.replace(/^\d{1,3}[\.\-\s]+/, '');
  // Remove extra spaces
  t = t.replace(/\s+/g, ' ').trim();
  return t;
};

// Try to split "Artist - Title" format common in filenames
const parseArtistTitle = (artist: string, title: string): { artist: string; title: string } => {
  const cleanedTitle = cleanTitle(title);
  const cleanedArtist = cleanTitle(artist);

  // If title contains " - ", it likely has artist and title together
  if (cleanedTitle.includes(' - ')) {
    const parts = cleanedTitle.split(' - ');
    if (parts.length === 2) {
      return { artist: parts[0].trim(), title: parts[1].trim() };
    }
  }

  // If artist is generic like "Artista Local" or "Unknown", try to extract from title
  if (/artista|local|unknown|desconocido/i.test(cleanedArtist) && cleanedTitle.includes(' - ')) {
    const parts = cleanedTitle.split(' - ');
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }

  return { artist: cleanedArtist, title: cleanedTitle };
};

export const getLyrics = async (rawArtist: string, rawTitle: string): Promise<string> => {
  const { artist, title } = parseArtistTitle(rawArtist, rawTitle);
  console.log(`[Lyrics] Searching for: "${title}" by "${artist}"`);

  // Step 1: Try lyrics.ovh API
  try {
    const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.lyrics && data.lyrics.trim().length > 50) {
        console.log('[Lyrics] Found via lyrics.ovh');
        return `${title} — ${artist}\n\n${data.lyrics.trim()}`;
      }
    }
  } catch {}

  // Step 2: Try with simplified artist name (remove "feat.", "ft.", "y", "&" etc.)
  const simpleArtist = artist.split(/\s+(?:feat\.?|ft\.?|y|&|x)\s+/i)[0].trim();
  if (simpleArtist !== artist) {
    try {
      const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(simpleArtist)}/${encodeURIComponent(title)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.lyrics && data.lyrics.trim().length > 50) {
          console.log('[Lyrics] Found via lyrics.ovh (simplified artist)');
          return `${title} — ${artist}\n\n${data.lyrics.trim()}`;
        }
      }
    } catch {}
  }

  // Step 3: Try swapping artist/title (some files have them reversed)
  try {
    const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(title)}/${encodeURIComponent(artist)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.lyrics && data.lyrics.trim().length > 50) {
        console.log('[Lyrics] Found via lyrics.ovh (swapped)');
        return `${title} — ${artist}\n\n${data.lyrics.trim()}`;
      }
    }
  } catch {}

  // Step 4: Not found — provide direct search links (no Gemini to avoid invented lyrics)
  console.log('[Lyrics] Not found in any API');
  const q = encodeURIComponent(`${title} ${artist} letra`);
  return `No se encontro la letra de "${title}" de ${artist}.\n\nBuscar en:\n\n` +
    `🔍 Google: https://www.google.com/search?q=${q}\n\n` +
    `🎵 Genius: https://genius.com/search?q=${encodeURIComponent(`${artist} ${title}`)}\n\n` +
    `🎶 Musixmatch: https://www.musixmatch.com/search/${encodeURIComponent(`${artist} ${title}`)}`;
};