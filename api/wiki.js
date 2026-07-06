export default async function handler(request, response) {
  try {
    const { q = '', lang = 'he' } = request.query;
    const safeLang = /^[a-z-]{2,12}$/i.test(lang) ? lang : 'he';
    const query = String(q || '').trim();

    if (!query) return response.status(400).json({ error: 'Missing search query' });

    const wikiUrl =
      `https://${safeLang}.wikipedia.org/w/api.php` +
      `?action=query&generator=search` +
      `&gsrsearch=${encodeURIComponent(query)}` +
      `&gsrlimit=1` +
      `&prop=extracts|pageimages|coordinates|info|pageprops` +
      `&exintro=1&explaintext=1&exchars=900` +
      `&piprop=thumbnail|original&pithumbsize=900` +
      `&inprop=url&format=json`;

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
  const entity = await fetchWikidataEntity(itemId);
  if (!entity) return { facts: [], entityType: '', imageUrl: null };

  const claims = entity.claims || {};
  const ids = collectEntityIds(claims, ['P31', 'P105', 'P17', 'P36', 'P106', 'P171', 'P141', 'P27', 'P19', 'P20']);
  const labels = await fetchLabels(ids, lang);
  const facts = [];
  let entityType = '';
  let imageUrl = null;

  const getValue = (pid) => claims[pid]?.[0]?.mainsnak?.datavalue?.value;
  const getId = (pid) => getValue(pid)?.id;
  const labelOf = (id) => labels[id] || friendlyFallback(id, lang);
  const add = (labelHe, labelEn, value) => { if (value) facts.push({ label: lang === 'en' ? labelEn : labelHe, value }); };

  const imageName = getValue('P18');
  if (imageName) imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageName)}?width=900`;

  const instance = getId('P31');
  if (instance) {
    entityType = labelOf(instance);
    add('סוג הערך', 'Type', entityType);
  }

  add('שם מדעי', 'Scientific name', getValue('P225'));

  const taxonRank = getId('P105');
  if (taxonRank) add('דרגה טקסונומית', 'Taxon rank', labelOf(taxonRank));

  const parentTaxon = getId('P171');
  if (parentTaxon) add('קבוצה/משפחה', 'Parent taxon', labelOf(parentTaxon));

  const conservation = getId('P141');
  if (conservation) add('מצב שימור', 'Conservation status', labelOf(conservation));

  const country = getId('P17');
  if (country) add('מדינה', 'Country', labelOf(country));

  const capital = getId('P36');
  if (capital) add('בירה', 'Capital', labelOf(capital));

  const citizenship = getId('P27');
  if (citizenship) add('אזרחות/לאום', 'Citizenship', labelOf(citizenship));

  const birthPlace = getId('P19');
  if (birthPlace) add('מקום לידה', 'Place of birth', labelOf(birthPlace));

  const deathPlace = getId('P20');
  if (deathPlace) add('מקום פטירה', 'Place of death', labelOf(deathPlace));

  const population = getValue('P1082')?.amount;
  if (population) add('אוכלוסייה', 'Population', formatNumber(population));

  const height = getValue('P2044')?.amount;
  if (height) add('גובה', 'Elevation', `${formatNumber(height)} מ׳`);

  const inception = getValue('P571')?.time;
  if (inception) add('תאריך יסוד/הקמה', 'Inception', formatWikidataDate(inception, lang));

  const birth = getValue('P569')?.time;
  if (birth) add('תאריך לידה', 'Date of birth', formatWikidataDate(birth, lang));

  const death = getValue('P570')?.time;
  if (death) add('תאריך פטירה', 'Date of death', formatWikidataDate(death, lang));

  const occupation = getId('P106');
  if (occupation) add('מקצוע', 'Occupation', labelOf(occupation));

  return { facts: facts.slice(0, 10), entityType, imageUrl };
}

async function fetchWikidataEntity(itemId) {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(itemId)}.json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'UniversalKnowledgeAtlas/1.0' } });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.entities?.[itemId] || null;
}

function collectEntityIds(claims, pids) {
  const ids = new Set();
  for (const pid of pids) {
    for (const claim of claims[pid] || []) {
      const id = claim?.mainsnak?.datavalue?.value?.id;
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

async function fetchLabels(ids, lang) {
  if (!ids.length) return {};
  const url =
    `https://www.wikidata.org/w/api.php?action=wbgetentities` +
    `&ids=${encodeURIComponent(ids.join('|'))}` +
    `&props=labels&languages=${encodeURIComponent(lang + '|he|en')}&format=json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'UniversalKnowledgeAtlas/1.0' } });
  if (!res.ok) return {};
  const data = await res.json();
  const out = {};
  for (const id of ids) {
    const labels = data?.entities?.[id]?.labels || {};
    out[id] = labels[lang]?.value || labels.he?.value || labels.en?.value || friendlyFallback(id, lang);
  }
  return out;
}

function friendlyFallback(id, lang) {
  const he = { Q5: 'אדם', Q515: 'עיר', Q8502: 'הר', Q4022: 'נהר', Q16521: 'טקסון', Q729: 'בעל חיים', Q12136: 'מחלה' };
  const en = { Q5: 'human', Q515: 'city', Q8502: 'mountain', Q4022: 'river', Q16521: 'taxon', Q729: 'animal', Q12136: 'disease' };
  return (lang === 'en' ? en[id] : he[id]) || id;
}

function formatNumber(value) {
  const n = Number(String(value).replace('+', ''));
  return Number.isFinite(n) ? n.toLocaleString('he-IL') : String(value);
}

function formatWikidataDate(time, lang) {
  const raw = String(time || '');
  const match = raw.match(/^([+-])(\d{1,})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!match) return raw;
  const sign = match[1];
  const year = Number(match[2]);
  const month = Number(match[3] || 0);
  const day = Number(match[4] || 0);
  const y = year.toLocaleString(lang === 'en' ? 'en-US' : 'he-IL', { useGrouping: false });
  const suffix = sign === '-' ? (lang === 'en' ? ' BCE' : ' לפנה״ס') : '';
  if (!month || !day) return `${y}${suffix}`;
  return `${day}.${month}.${y}${suffix}`;
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
