import { GIPHY_API_KEY, GIPHY_RESULT_LIMIT } from './config';

export interface GiphyGif {
  id: string;
  title: string;
  previewUrl: string;
  originalUrl: string;
}

export interface GiphySearchResult {
  gifs: GiphyGif[];
  error?: string;
}

export async function searchGiphy(searchTerm: string): Promise<GiphySearchResult> {
  if (!searchTerm.trim()) {
    return { gifs: [] };
  }

  try {
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(
      searchTerm
    )}&limit=${GIPHY_RESULT_LIMIT}&rating=g`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Giphy API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return { gifs: [], error: 'No GIFs found for your search' };
    }

    const gifs: GiphyGif[] = data.data.map((gif: any) => ({
      id: gif.id,
      title: gif.title || 'Untitled',
      previewUrl: gif.images.fixed_height_small.url,
      originalUrl: gif.images.original.url,
    }));

    return { gifs };
  } catch (error) {
    console.error('Giphy search error:', error);
    return {
      gifs: [],
      error: 'Failed to search Giphy. Please try again.',
    };
  }
}

export async function fetchTrendingGiphy(): Promise<GiphySearchResult> {
  try {
    const url = `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=${GIPHY_RESULT_LIMIT}&rating=g`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Giphy API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return { gifs: [], error: 'No trending GIFs available' };
    }

    const gifs: GiphyGif[] = data.data.map((gif: any) => ({
      id: gif.id,
      title: gif.title || 'Untitled',
      previewUrl: gif.images.fixed_height_small.url,
      originalUrl: gif.images.original.url,
    }));

    return { gifs };
  } catch (error) {
    console.error('Giphy trending fetch error:', error);
    return {
      gifs: [],
      error: 'Failed to load trending GIFs. Please try again.',
    };
  }
}
