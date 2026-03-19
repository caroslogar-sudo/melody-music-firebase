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