export default async function handler(request, response) {
  try {
    const { q = '', lang = 'he' } = request.query;
    const safeLang = /^[a-z-]{2,12}$/i.test(lang) ? lang : 'he';
    const query = String(q || '').trim();

    if (!query) {
      return response.status(400).json({ error: 'Missing search query' });
    }

    const wikiUrl =
      `https://${safeLang}.wikipedia.org/w/api.php` +
      `?action=query` +
      `&generator=search` +
      `&gsrsearch=${encodeURIComponent(query)}` +
      `&gsrlimit=1` +
      `&prop=extracts|pageimages|coordinates|info` +
      `&exintro=1` +
      `&explaintext=1` +
      `&exchars=900` +
      `&piprop=thumbnail|original` +
      `&pithumbsize=900` +
      `&inprop=url` +
      `&format=json`;

    const wikiResponse = await fetch(wikiUrl, {
      headers: {
        'User-Agent': 'UniversalKnowledgeAtlas/1.0 (Vercel Serverless Function)'
      }
    });

    if (!wikiResponse.ok) {
      return response.status(502).json({ error: 'Wikipedia request failed' });
    }

    const data = await wikiResponse.json();
    return response.status(200).json(data);
  } catch (error) {
    return response.status(500).json({ error: 'Server error' });
  }
}
