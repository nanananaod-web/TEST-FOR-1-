// Env vars: NOTION_TOKEN, DB_REFLECTIONS, DB_TASKS
const txt = (s) => ({ rich_text: [{ text: { content: String(s || '').slice(0, 2000) } }] });
const ttl = (s) => ({ title: [{ text: { content: String(s || '').slice(0, 2000) } }] });

const builders = {
  reflection: (b) => ({
    db: process.env.DB_REFLECTIONS,
    props: {
      Headline: ttl(b.headline),
      Clarity: { number: Number(b.clarity) },
      Energy: { number: Number(b.energy) },
      'Primary win': txt(b.win),
      'Lessons & calibration': txt(b.lessons)
    }
  }),
  tasks: (b) => {
    const props = { Task: ttl(b.task), Priority: { select: { name: b.priority || 'Medium' } }, Note: txt(b.note) };
    if (b.due) props.Due = { date: { start: b.due } };
    return { db: process.env.DB_TASKS, props };
  }
};

export default async function handler(req, res) {
  // Needed when the HTML is hosted on GitHub Pages and this API is on Vercel.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = req.body || {};
  const build = builders[body.type];
  if (!build) return res.status(400).json({ error: 'Unknown card type' });
  if (!(body.headline || body.task)) return res.status(400).json({ error: 'Title is required' });

  const { db, props } = build(body);
  const r = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ parent: { database_id: db }, properties: props })
  });

  const data = await r.json();
  if (!r.ok) return res.status(r.status).json({ error: data.message || 'Notion error' });
  res.status(200).json({ ok: true, id: data.id });
}
