export default async function handler(request, response) {
  try {
    const rawUrl = String(request.query.url || '');
    if (!rawUrl) {
      return response.status(400).send('Missing image URL');
    }

    const imageUrl = new URL(rawUrl);
    const allowedHosts = [
      'commons.wikimedia.org',
      'upload.wikimedia.org',
      'he.wikipedia.org',
      'en.wikipedia.org'
    ];

    if (!allowedHosts.some(host => imageUrl.hostname === host || imageUrl.hostname.endsWith('.' + host))) {
      return response.status(400).send('Image host is not allowed');
    }

    const upstream = await fetch(imageUrl.toString(), {
      headers: {
        'User-Agent': 'UniversalKnowledgeAtlas/1.0 (Vercel Image Proxy)',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    if (!upstream.ok) {
      return response.status(502).send('Image request failed');
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const buffer = await upstream.arrayBuffer();

    response.setHeader('Content-Type', contentType);
    response.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    response.status(200).send(Buffer.from(buffer));
  } catch (error) {
    response.status(500).send('Image proxy error');
  }
}
