export default async function handler(request, response) {
  try {
    const { q = '', lang = 'he' } = request.query;
    const safeLang = /^[a-z-]{2,12}$/i.test(lang) ? lang : 'he';
    const query = String(q || '').trim();
    if (!query) return response.status(400).json({ error: 'Missing search query' });

    const wikiUrl = `https://${safeLang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=extracts|pageimages|coordinates|info|pageprops&exintro=1&explaintext=1&exchars=900&piprop=thumbnail|original&pithumbsize=900&inprop=url&format=json`;
    const wikiResponse = await fetch(wikiUrl, { headers: { 'User-Agent': 'UniversalKnowledgeAtlas/1.0' } });
    if (!wikiResponse.ok) return response.status(502).json({ error: 'Wikipedia request failed' });

    const data = await wikiResponse.json();
    const page = data?.query?.pages ? Object.values(data.query.pages)[0] : null;
    if (page) {
      let imageUrl = page.original?.source || page.thumbnail?.source || null;
      const itemId = page.pageprops?.wikibase_item || null;
      if (itemId) {
        const wd = await getWikidataFacts(itemId, safeLang);
        page.wikidataId = itemId;
        page.facts = wd.facts;
        page.entityType = wd.entityType;
        page.entityKind = wd.entityKind;
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
  if (!entity) return { facts: [], entityType: '', entityKind: 'general', imageUrl: null };

  const claims = entity.claims || {};
  const labelIds = collectEntityIds(claims, ['P31','P105','P17','P36','P106','P171','P141','P27','P19','P20','P37','P38','P30','P131','P706','P403','P885','P122','P1622']);
  const labels = await fetchLabels(labelIds, lang);
  const facts = [];
  let imageUrl = null;

  const valueOf = (pid) => bestClaim(claims[pid])?.mainsnak?.datavalue?.value;
  const valuesOf = (pid) => bestClaims(claims[pid]).map(c => c?.mainsnak?.datavalue?.value).filter(Boolean);
  const idOf = (pid) => valueOf(pid)?.id;
  const idsOf = (pid) => valuesOf(pid).map(v => v?.id).filter(Boolean);
  const labelOf = (id) => labels[id] || friendlyFallback(id, lang);
  const add = (labelHe, labelEn, value) => { if (value && !facts.some(f => f.label === (lang === 'en' ? labelEn : labelHe))) facts.push({ label: lang === 'en' ? labelEn : labelHe, value }); };
  const addId = (pid, he, en) => { const id = idOf(pid); if (id) add(he, en, labelOf(id)); };
  const addIds = (pid, he, en, limit = 3) => {
    const vals = unique(idsOf(pid).map(labelOf).filter(Boolean)).slice(0, limit);
    if (vals.length) add(he, en, vals.join(', '));
  };
  const addString = (pid, he, en) => { const v = valueOf(pid); if (typeof v === 'string') add(he, en, v); };

  const imageName = valueOf('P18');
  if (imageName) imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageName)}?width=900`;

  const instanceIds = idsOf('P31');
  const entityKind = detectKind(instanceIds, claims);
  const entityType = cleanType(instanceIds.map(labelOf).filter(Boolean).slice(0, 2).join(', '), entityKind, lang);
  if (entityType) add('סוג הערך', 'Type', entityType);

  if (entityKind === 'person') {
    add('תאריך לידה', 'Date of birth', formatWikidataDate(valueOf('P569')?.time, lang));
    add('תאריך פטירה', 'Date of death', formatWikidataDate(valueOf('P570')?.time, lang));
    addIds('P106', 'מקצוע', 'Occupation', 4);
    addId('P27', 'אזרחות/לאום', 'Citizenship');
    addId('P19', 'מקום לידה', 'Place of birth');
    addId('P20', 'מקום פטירה', 'Place of death');
  } else if (entityKind === 'animal') {
    add('שם מדעי', 'Scientific name', valueOf('P225'));
    addId('P105', 'דרגה טקסונומית', 'Taxon rank');
    addId('P171', 'קבוצה/משפחה', 'Parent taxon');
    addId('P141', 'מצב שימור', 'Conservation status');
  } else if (entityKind === 'country') {
    addId('P36', 'בירה', 'Capital');
    addIds('P37', 'שפה רשמית', 'Official language', 4);
    addId('P38', 'מטבע', 'Currency');
    addId('P30', 'יבשת', 'Continent');
    addId('P122', 'צורת ממשל', 'Form of government');
    add('תאריך הקמה', 'Inception', formatWikidataDate(valueOf('P571')?.time, lang));
    addString('P78', 'סיומת אינטרנט', 'Internet TLD');
    addString('P474', 'קידומת טלפון', 'Calling code');
    addId('P1622', 'כיוון נסיעה', 'Driving side');
  } else if (entityKind === 'city') {
    addId('P17', 'מדינה', 'Country');
    addId('P131', 'אזור מנהלי', 'Administrative region');
    add('אוכלוסייה', 'Population', formatNumber(valueOf('P1082')?.amount));
    add('גובה', 'Elevation', formatMeters(valueOf('P2044')?.amount, lang));
    add('תאריך יסוד/הקמה', 'Inception', formatWikidataDate(valueOf('P571')?.time, lang));
  } else if (entityKind === 'mountain') {
    add('גובה', 'Elevation', formatMeters(valueOf('P2044')?.amount, lang));
    addId('P17', 'מדינה', 'Country');
    addId('P706', 'רכס/אזור', 'Mountain range / location');
  } else if (entityKind === 'river') {
    addId('P17', 'מדינה', 'Country');
    add('אורך', 'Length', formatKm(valueOf('P2043')?.amount, lang));
    addId('P403', 'נשפך אל', 'Mouth of the watercourse');
    addId('P885', 'מקור הנהר', 'Origin of the watercourse');
  } else {
    add('שם מדעי', 'Scientific name', valueOf('P225'));
    addId('P17', 'מדינה', 'Country');
    add('תאריך יסוד/הקמה', 'Inception', formatWikidataDate(valueOf('P571')?.time, lang));
    addIds('P106', 'מקצוע', 'Occupation', 3);
  }

  return { facts: facts.slice(0, 10), entityType, entityKind, imageUrl };
}

function bestClaim(list = []) {
  const ranked = bestClaims(list);
  return ranked[0] || null;
}

function bestClaims(list = []) {
  if (!Array.isArray(list) || !list.length) return [];
  const preferred = list.filter(c => c.rank === 'preferred');
  const normal = list.filter(c => c.rank !== 'deprecated');
  const source = preferred.length ? preferred : normal;
  return [...source].sort((a, b) => claimYear(b) - claimYear(a));
}

function claimYear(claim) {
  const raw = claim?.qualifiers?.P585?.[0]?.datavalue?.value?.time || claim?.qualifiers?.P580?.[0]?.datavalue?.value?.time || '';
  const m = String(raw).match(/^([+-])(\d+)/);
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * Number(m[2]);
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
  for (const pid of pids) for (const claim of bestClaims(claims[pid] || [])) {
    const id = claim?.mainsnak?.datavalue?.value?.id;
    if (id) ids.add(id);
  }
  return [...ids];
}

async function fetchLabels(ids, lang) {
  if (!ids.length) return {};
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(ids.join('|'))}&props=labels&languages=${encodeURIComponent(lang + '|he|en')}&format=json`;
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

function detectKind(instanceIds, claims) {
  const set = new Set(instanceIds);
  const has = (...ids) => ids.some(id => set.has(id));
  if (has('Q5')) return 'person';
  if (has('Q6256','Q3624078')) return 'country';
  if (has('Q515','Q1549591','Q3957','Q486972')) return 'city';
  if (has('Q8502','Q46831')) return 'mountain';
  if (has('Q4022','Q355304')) return 'river';
  if (claims.P225 || claims.P105 || claims.P171 || has('Q16521','Q729','Q55983715')) return 'animal';
  return 'general';
}

function cleanType(type, kind, lang) {
  if (kind === 'country') return lang === 'en' ? 'country' : 'מדינה';
  if (kind === 'city') return lang === 'en' ? 'city / settlement' : 'עיר / יישוב';
  if (kind === 'person') return lang === 'en' ? 'person' : 'אדם';
  if (kind === 'animal') return lang === 'en' ? 'animal / taxon' : 'בעל חיים / טקסון';
  return type;
}

function friendlyFallback(id, lang) {
  const he = { Q5:'אדם', Q515:'עיר', Q6256:'מדינה', Q8502:'הר', Q4022:'נהר', Q16521:'טקסון', Q729:'בעל חיים', Q486972:'יישוב', Q1549591:'עיר גדולה', Q13196750:'נהיגה בצד ימין', Q14565199:'נהיגה בצד שמאל' };
  const en = { Q5:'human', Q515:'city', Q6256:'country', Q8502:'mountain', Q4022:'river', Q16521:'taxon', Q729:'animal', Q486972:'human settlement', Q1549591:'big city', Q13196750:'right-hand traffic', Q14565199:'left-hand traffic' };
  return (lang === 'en' ? en[id] : he[id]) || id;
}

function unique(arr) { return [...new Set(arr)]; }

function formatNumber(value) {
  if (!value) return '';
  const n = Number(String(value).replace('+', ''));
  return Number.isFinite(n) ? n.toLocaleString('he-IL') : String(value);
}

function formatMeters(value, lang) {
  const n = formatNumber(value);
  return n ? `${n} ${lang === 'en' ? 'm' : 'מ׳'}` : '';
}

function formatKm(value, lang) {
  const n = Number(String(value || '').replace('+', ''));
  if (!Number.isFinite(n)) return '';
  return `${n.toLocaleString(lang === 'en' ? 'en-US' : 'he-IL')} ${lang === 'en' ? 'km' : 'ק״מ'}`;
}

function formatArea(value, lang) {
  const n = Number(String(value || '').replace('+', ''));
  if (!Number.isFinite(n)) return '';
  return `${n.toLocaleString(lang === 'en' ? 'en-US' : 'he-IL')} ${lang === 'en' ? 'km²' : 'קמ״ר'}`;
}

function formatWikidataDate(time, lang) {
  const raw = String(time || '');
  const match = raw.match(/^([+-])(\d{1,})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!match) return '';
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
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(title)}&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=900&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'UniversalKnowledgeAtlas/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
    return pages[0]?.imageinfo?.[0]?.thumburl || pages[0]?.imageinfo?.[0]?.url || null;
  } catch { return null; }
}
