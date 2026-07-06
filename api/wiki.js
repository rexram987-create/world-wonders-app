export default async function handler(request, response) {
  try {
    const { q = '', lang = 'he' } = request.query;
    const safeLang = /^[a-z-]{2,12}$/i.test(lang) ? lang : 'he';
    const query = String(q || '').trim();

    if (!query) return response.status(400).json({ error: 'Missing search query' });

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

    const wikiResponse = await fetch(wikiUrl, { headers: { 'User-Agent': 'UniversalKnowledgeAtlas/1.0' } });
    if (!wikiResponse.ok) return response.status(502).json({ error: 'Wikipedia request failed' });

    const data = await wikiResponse.json();
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
    const page = pages[0];

    if (page) {
      let imageUrl = page.original?.source || page.thumbnail?.source || null;
      const itemId = page.pageprops?.wikibase_item || null;

      if (itemId) {
        const wd = await getWikidataFacts(itemId, safeLang);
        page.wikidataId = itemId;
        page.facts = wd.facts;
        page.entityType = wd.entityType;
        if (!imageUrl && wd.imageUrl) imageUrl = wd.imageUrl;
      }

      if (!imageUrl) imageUrl = await getCommonsSearchImage(page.title);
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

async function getWikidataFacts(itemId, lang) {
  const url =
    `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(itemId)}.json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'UniversalKnowledgeAtlas/1.0' } });
  if (!res.ok) return { facts: [], entityType: '', imageUrl: null };
  const data = await res.json();
  const entity = data?.entities?.[itemId];
  if (!entity) return { facts: [], entityType: '', imageUrl: null };

  const claims = entity.claims || {};
  const facts = [];
  let entityType = '';
  let imageUrl = null;

  const getValue = (pid) => claims[pid]?.[0]?.mainsnak?.datavalue?.value;
  const getId = (pid) => getValue(pid)?.id;
  const labelOf = (id) => data?.entities?.[id]?.labels?.[lang]?.value || data?.entities?.[id]?.labels?.he?.value || data?.entities?.[id]?.labels?.en?.value || id;
  const add = (labelHe, labelEn, value) => { if (value) facts.push({ label: lang === 'en' ? labelEn : labelHe, value }); };

  const imageName = getValue('P18');
  if (imageName) imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageName)}?width=900`;

  const instance = getId('P31');
  if (instance) {
    entityType = labelOf(instance);
    add('סוג הערך', 'Type', entityType);
  }

  const scientificName = getValue('P225');
  add('שם מדעי', 'Scientific name', scientificName);

  const taxonRank = getId('P105');
  if (taxonRank) add('דרגה טקסונומית', 'Taxon rank', labelOf(taxonRank));

  const country = getId('P17');
  if (country) add('מדינה', 'Country', labelOf(country));

  const capital = getId('P36');
  if (capital) add('בירה', 'Capital', labelOf(capital));

  const population = getValue('P1082')?.amount;
  if (population) add('אוכלוסייה', 'Population', formatNumber(population));

  const height = getValue('P2044')?.amount;
  if (height) add('גובה', 'Elevation', `${formatNumber(height)} מ׳`);

  const inception = getValue('P571')?.time;
  if (inception) add('תאריך יסוד/הקמה', 'Inception', cleanTime(inception));

  const birth = getValue('P569')?.time;
  if (birth) add('תאריך לידה', 'Date of birth', cleanTime(birth));

  const death = getValue('P570')?.time;
  if (death) add('תאריך פטירה', 'Date of death', cleanTime(death));

  const occupation = getId('P106');
  if (occupation) add('מקצוע', 'Occupation', labelOf(occupation));

  add('מזהה Wikidata', 'Wikidata ID', itemId);
  return { facts, entityType, imageUrl };
}

function formatNumber(value) {
  const n = Number(String(value).replace('+', ''));
  return Number.isFinite(n) ? n.toLocaleString('he-IL') : String(value);
}

function cleanTime(time) {
  return String(time || '').replace('+', '').replace('T00:00:00Z', '');
}

async function getCommonsSearchImage(title) {
  try {
    const url =
      `https://commons.wikimedia.org/w/api.php` +
      `?action=query&generator=search&gsrnamespace=6` +
      `&gsrsearch=${encodeURIComponent(title)}` +
      `&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=900&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'UniversalKnowledgeAtlas/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
    return pages[0]?.imageinfo?.[0]?.thumburl || pages[0]?.imageinfo?.[0]?.url || null;
  } catch { return null; }
}
