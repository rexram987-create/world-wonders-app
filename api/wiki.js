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
      `&prop=extracts|pageimages|coordinates|info|pageprops` +
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
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
    const page = pages[0];

    if (page) {
      let imageUrl = page.original?.source || page.thumbnail?.source || null;

      if (!imageUrl && page.pageprops?.wikibase_item) {
        imageUrl = await getWikidataImage(page.pageprops.wikibase_item);
      }

      if (!imageUrl) {
        imageUrl = await getCommonsSearchImage(page.title);
      }

      if (imageUrl) {
        page.imageUrl = imageUrl;
        page.original = { source: imageUrl };
        page.thumbnail = { source: imageUrl };
      }
    }

    return response.status(200).json(data);
  } catch (error) {
    return response.status(500).json({ error: 'Server error', details: String(error?.message || error) });
  }
}

async function getWikidataImage(itemId) {
  try {
    const url =
      `https://www.wikidata.org/w/api.php` +
      `?action=wbgetclaims` +
      `&entity=${encodeURIComponent(itemId)}` +
      `&property=P18` +
      `&format=json`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'UniversalKnowledgeAtlas/1.0 (Vercel Serverless Function)'
      }
    });

    if (!res.ok) return null;
    const data = await res.json();
    const filename = data?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (!filename) return null;

    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=900`;
  } catch (error) {
    return null;
  }
}

async function getCommonsSearchImage(title) {
  try {
    const url =
      `https://commons.wikimedia.org/w/api.php` +
      `?action=query` +
      `&generator=search` +
      `&gsrnamespace=6` +
      `&gsrsearch=${encodeURIComponent(title)}` +
      `&gsrlimit=1` +
      `&prop=imageinfo` +
      `&iiprop=url` +
      `&iiurlwidth=900` +
      `&format=json`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'UniversalKnowledgeAtlas/1.0 (Vercel Serverless Function)'
      }
    });

    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
    const info = pages[0]?.imageinfo?.[0];
    return info?.thumburl || info?.url || null;
  } catch (error) {
    return null;
  }
}
