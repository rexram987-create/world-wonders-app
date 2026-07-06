export default async function handler(request, response) {
  try {
    const lat = Number(request.query.lat);
    const lon = Number(request.query.lon);
    const lang = String(request.query.lang || 'he');

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return response.status(400).json({ error: 'Missing coordinates' });
    }

    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?format=jsonv2` +
      `&lat=${encodeURIComponent(lat)}` +
      `&lon=${encodeURIComponent(lon)}` +
      `&zoom=18` +
      `&addressdetails=1` +
      `&accept-language=${encodeURIComponent(lang)}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'UniversalKnowledgeAtlas/1.0 (Vercel Address Lookup)'
      }
    });

    if (!res.ok) return response.status(502).json({ error: 'Address lookup failed' });

    const data = await res.json();
    return response.status(200).json({
      displayName: data.display_name || '',
      address: data.address || {},
      osmType: data.osm_type || '',
      osmId: data.osm_id || '',
      source: 'OpenStreetMap / Nominatim'
    });
  } catch (error) {
    return response.status(500).json({ error: 'Address server error' });
  }
}
