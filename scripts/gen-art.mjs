#!/usr/bin/env node
/**
 * gen-art.mjs — gerador de arte do Supremacia Digital (OpenRouter + Gemini).
 *
 * Ferramenta de PRODUÇÃO DE ASSETS, offline. NÃO é código de runtime do jogo.
 * Lê OPENROUTER_API_KEY do ambiente (use --env-file=.env.local) e gera PNGs
 * direto em client/public/art/. O jogo consome só os arquivos prontos — a chave
 * nunca toca o navegador nem o deploy. Ver seção "Geração de arte" no CLAUDE.md.
 *
 * Uso:
 *   node --env-file=.env.local scripts/gen-art.mjs            # gera o que falta
 *   node --env-file=.env.local scripts/gen-art.mjs --force    # regera tudo
 *   node --env-file=.env.local scripts/gen-art.mjs emblem:china  # só 1 asset (por id)
 *   node --env-file=.env.local scripts/gen-art.mjs --pro      # usa o modelo pro (final)
 *
 * Requer Node 18+ (fetch nativo). Sem dependências externas.
 */

import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = resolve(ROOT, 'client/public');

const MODEL_FLASH = 'google/gemini-3.1-flash-image'; // rascunho rápido/barato
const MODEL_PRO = 'google/gemini-3-pro-image';       // qualidade final

const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) {
  console.error('✗ OPENROUTER_API_KEY ausente. Rode com: node --env-file=.env.local scripts/gen-art.mjs');
  process.exit(1);
}

// ── Estilo comum a toda a arte (mantém coerência visual entre os assets) ──────
const STYLE = [
  'Cold-War geopolitical board-game art, modern flat-vector military emblem style',
  'clean bold shapes, subtle metallic sheen, slight grain texture',
  'no text, no letters, no words, no typography',
  'centered subject, plain dark transparent-friendly background',
  'crisp edges, high contrast, readable at small size',
].join(', ');

// ── Manifesto de assets ───────────────────────────────────────────────────────
// Cada item: { id, out (relativo a client/public), prompt, size }
// As cores espelham initialPlayers.ts (não muda mecânica — só identidade visual).
const FACTIONS = [
  { id: 'south_america', color: 'emerald green',  motif: 'a soaring condor over the Andes mountains and a wheat sheaf' },
  { id: 'africa',        color: 'amber gold',      motif: 'a lion head over a rising sun and a baobab silhouette' },
  { id: 'europe',        color: 'royal blue',      motif: 'a ring of stars over a fortified gothic tower' },
  { id: 'china',         color: 'crimson red',     motif: 'an eastern dragon coiled around a rising sun' },
  { id: 'usa',           color: 'pale steel white', motif: 'a bald eagle with spread wings over a shield' },
  { id: 'ussr',          color: 'deep soviet red',  motif: 'a bear head over an industrial gear and star' },
];

// Marcadores de unidade no mapa. Precisam LER em tamanho minúsculo (zoom até 6x):
// silhueta cheia, alto contraste, claro/prateado em fundo escuro de token (casa com
// o badge escuro do mapa). Sem cor de facção — neutros para ler em qualquer pílula.
const MARKER_STYLE = [
  'minimalist bold military unit icon, single centered subject, heavy silhouette',
  'light silver-white metallic finish with subtle bevel, on a dark slate circular token disc',
  'no text, no numbers, no letters, flat game-token style, high contrast, crisp edges',
  'readable when tiny, generous margin around the subject',
].join(', ');

const MARKERS = [
  {
    id: 'marker:army',
    out: 'art/markers/army.png',
    prompt: `Top-down board-game token: a single modern main battle tank seen from a 3/4 top view, ` +
      `as a clean emblematic icon. ${MARKER_STYLE}.`,
  },
  {
    id: 'marker:navy',
    out: 'art/markers/navy.png',
    prompt: `Board-game token: a single modern naval destroyer warship in side profile, ` +
      `as a clean emblematic icon. ${MARKER_STYLE}.`,
  },
];

// Ilustrações de carta — banner no topo do modal de revelação (DrawnCardModal).
// Landscape cinematográfico, coerente com o resto da arte. Sem texto.
const CARD_STYLE = [
  'Cold-War era cinematic illustration for a geopolitical strategy board game card',
  'modern semi-flat painterly style, dramatic lighting, rich but muted palette',
  'wide landscape banner composition, no text, no letters, no numbers, no logos',
  'atmospheric, high production value',
].join(', ');

const CARDS = [
  { id: 'card:grain',   tint: 'warm golden yellow',  scene: 'vast golden wheat fields at harvest with grain silos and a combine harvester under a wide sky' },
  { id: 'card:oil',     tint: 'amber and black',     scene: 'a field of oil derricks and pumpjacks at dusk with a refinery silhouette and burning flare stacks' },
  { id: 'card:mineral', tint: 'violet and steel',    scene: 'a massive open-pit terraced mine with haul trucks and glinting raw ore and crystals' },
  { id: 'card:nuke',    tint: 'ominous crimson red', scene: 'an intercontinental ballistic missile launching with a distant mushroom cloud on the horizon, ominous' },
  { id: 'card:laser',   tint: 'electric blue',       scene: 'an orbital defense laser satellite in space firing a beam down toward the curved earth, sci-fi' },
];

const MANIFEST = [
  ...FACTIONS.map(f => ({
    id: `emblem:${f.id}`,
    out: `art/emblems/${f.id}.png`,
    size: '1024x1024',
    prompt:
      `Circular national military crest insignia for a fictional superpower. ` +
      `Dominant color ${f.color}. Central motif: ${f.motif}. ` +
      `Heraldic badge inside a clean circular medallion frame. ${STYLE}.`,
  })),
  ...MARKERS,
  ...CARDS.map(c => ({
    id: c.id,
    out: `art/cards/${c.id.split(':')[1]}.png`,
    prompt: `${c.scene}. Dominant color tone ${c.tint}. ${CARD_STYLE}.`,
  })),
  {
    id: 'ocean',
    out: 'art/map/ocean.png',
    prompt:
      `Top-down stylized ocean background for a Cold-War strategy world map. ` +
      `Deep navy water, subtle depth gradient (teal-blue near center fading to near-black at the edges), ` +
      `faint cartographic latitude and longitude grid lines, very subtle wave and current texture. ` +
      `No land, no continents, no text, no labels, no compass. Muted, dark, non-distracting, ` +
      `seamless flat atlas look that leaves bright land pieces readable on top. Wide 2:1 landscape.`,
  },
  {
    // Fundo da Home. Composição centrada e escura nas bordas (vinheta) para o
    // menu/logo lerem por cima; foco no centro tolera crop em retrato (mobile).
    id: 'home:bg',
    out: 'art/home/bg.png',
    prompt:
      `Atmospheric Cold-War strategic command war-room backdrop for a game main menu. ` +
      `A dark situation room with a faint glowing holographic world map / war table at the center, ` +
      `cool blue and amber accent lighting, volumetric haze, deep heavy dark vignette on all edges. ` +
      `Cinematic, moody, very dark, no text, no letters, no UI, no people in focus. ` +
      `Lots of empty dark negative space in the center for menu buttons to sit on top. ${STYLE}.`,
  },
  {
    // Textura seamless de relevo NEUTRO (clara) para ser tingida pela cor da
    // facção via blend no mapa — não substitui a cor, só adiciona grão/relevo.
    id: 'terrain',
    out: 'art/map/terrain.png',
    prompt:
      `Seamless tileable subtle terrain texture for a strategy map: soft top-down topographic relief, ` +
      `faint contour lines, fine paper/atlas grain, gentle highlands and lowlands. ` +
      `Neutral light grey monochrome (no strong colors, will be tinted later), low contrast, ` +
      `no text, no labels, no borders, no water, evenly lit, repeats seamlessly. Flat, understated.`,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const USE_PRO = args.includes('--pro');
const MODEL = USE_PRO ? MODEL_PRO : MODEL_FLASH;
const ONLY = args.filter(a => !a.startsWith('--')); // ids específicos

const exists = (p) => access(p).then(() => true).catch(() => false);

async function generate(item) {
  const outPath = resolve(PUBLIC, item.out);
  if (!FORCE && await exists(outPath)) {
    console.log(`• pulando ${item.id} (já existe — use --force)`);
    return { id: item.id, skipped: true };
  }

  console.log(`→ gerando ${item.id}  [${MODEL}]`);
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://supremacia.local',
      'X-Title': 'Supremacia Digital art gen',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: item.prompt }],
      modalities: ['image', 'text'],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} em ${item.id}: ${txt.slice(0, 400)}`);
  }

  const data = await res.json();
  const img = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!img || !img.startsWith('data:image')) {
    throw new Error(`sem imagem na resposta de ${item.id}: ${JSON.stringify(data).slice(0, 400)}`);
  }

  const b64 = img.split(',')[1];
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, Buffer.from(b64, 'base64'));
  console.log(`✓ ${item.out}`);
  return { id: item.id, ok: true };
}

// ── Run ───────────────────────────────────────────────────────────────────────
const todo = ONLY.length ? MANIFEST.filter(m => ONLY.includes(m.id)) : MANIFEST;
if (todo.length === 0) {
  console.error(`Nenhum asset casou com: ${ONLY.join(', ')}`);
  console.error(`Ids disponíveis:\n  ${MANIFEST.map(m => m.id).join('\n  ')}`);
  process.exit(1);
}

console.log(`Gerando ${todo.length} asset(s) com ${MODEL}${FORCE ? ' (--force)' : ''}\n`);
let ok = 0, skip = 0, fail = 0;
for (const item of todo) {
  try {
    const r = await generate(item);
    if (r.skipped) skip++; else ok++;
  } catch (e) {
    fail++;
    console.error(`✗ ${item.id}: ${e.message}`);
  }
}
console.log(`\nResumo — gerados: ${ok} · pulados: ${skip} · falhas: ${fail}`);
process.exit(fail ? 1 : 0);
