import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY || '';

export const generateLevelTheme = async (level: number): Promise<{ title: string; curse: string }> => {
  if (!API_KEY) {
    return { title: `BASEMENT ${level}`, curse: "No API Key - No Curse" };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a short, creepy title for a dungeon level (e.g., "The Cellar", "Burning Basement", "Dank Depths") and a cryptic "curse" or subtitle (e.g., "Darkness falls...", "You feel watched", "Lost forever"). Level number is ${level}. Format: JSON { "title": "...", "curse": "..." }`,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (text) {
        return JSON.parse(text);
    }
    throw new Error("Empty response");
  } catch (e) {
    console.error("Gemini Error:", e);
    return { title: `FLOOR ${level}`, curse: "The connection is severed..." };
  }
};

export const generateBossIntro = async (): Promise<{ name: string; description: string }> => {
  if (!API_KEY) return { name: "MONSTRO", description: "A giant blob of flesh." };

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a name and short one-sentence description for a gross, terrifying roguelike boss monster. Format: JSON { "name": "...", "description": "..." }`,
      config: {
        responseMimeType: "application/json"
      }
    });
     const text = response.text;
    if (text) {
        return JSON.parse(text);
    }
    return { name: "UNKNOWN", description: "Something terrifying." };
  } catch (e) {
    return { name: "GEMINI_ERROR", description: "The API failed to spawn a boss." };
  }
};
