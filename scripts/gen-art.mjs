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

const MANIFEST = FACTIONS.map(f => ({
  id: `emblem:${f.id}`,
  out: `art/emblems/${f.id}.png`,
  size: '1024x1024',
  prompt:
    `Circular national military crest insignia for a fictional superpower. ` +
    `Dominant color ${f.color}. Central motif: ${f.motif}. ` +
    `Heraldic badge inside a clean circular medallion frame. ${STYLE}.`,
}));

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
