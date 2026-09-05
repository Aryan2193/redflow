// Renders a shareable PNG of the current answer. No libraries: plain canvas text layout.
import type { Objection, Paragraph, Question, Room } from '../module_bindings/types';

const COLORS: Record<string, string> = {
  verified: '#2f7a4d',
  agreed: '#5a6577',
  contested: '#a86a0b',
  unresolved: '#b8321f',
};
const LABEL: Record<string, string> = {
  verified: 'VERIFIED',
  agreed: 'AGREED',
  contested: 'CONTESTED',
  unresolved: 'UNRESOLVED',
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderShareCard(opts: {
  room: Room;
  question: Question;
  paragraphs: Paragraph[];
  objections: readonly Objection[];
  models: string[];
  siteUrl?: string;
}): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load('500 40px Newsreader'), document.fonts.load('600 22px "Instrument Sans"'), document.fonts.load('400 22px "Instrument Sans"')]);
  } catch {
    // fall back to whatever is available
  }
  const W = 1080;
  const pad = 64;
  const textW = W - pad * 2;
  const serif = 'Newsreader, Georgia, serif';
  const sans = '"Instrument Sans", system-ui, sans-serif';

  // Measure first with a scratch canvas.
  const scratch = document.createElement('canvas').getContext('2d')!;
  scratch.font = `500 44px ${serif}`;
  const qLines = wrap(scratch, opts.question.text, textW).slice(0, 4);
  const paras = opts.paragraphs.filter(p => p.current && p.text).sort((a, b) => a.ordinal - b.ordinal).slice(0, 5);
  scratch.font = `400 26px ${serif}`;
  const paraLines = paras.map(p => wrap(scratch, p.text, textW - 28).slice(0, 6));
  const withdrawn = opts.objections.filter(o => o.status === 'withdrawn' || o.status === 'overruled').length;
  const unresolved = opts.objections.filter(o => o.status === 'unresolved').length;

  let H = pad + 40 + 20 + qLines.length * 54 + 30;
  for (const lines of paraLines) H += lines.length * 36 + 26 + 22;
  H += 40 + 90;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f6f4ef';
  ctx.fillRect(0, 0, W, H);

  let y = pad;
  ctx.fillStyle = '#b8321f';
  ctx.beginPath();
  ctx.arc(pad + 10, y + 12, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1a17';
  ctx.font = `600 24px ${sans}`;
  ctx.fillText('Redflow', pad + 32, y + 21);
  ctx.fillStyle = '#7a746a';
  ctx.font = `400 20px ${sans}`;
  const meta = `${opts.room.title}  ·  version ${opts.question.version}`;
  ctx.fillText(meta, pad + 32 + ctx.measureText('Redflow ').width + 20, y + 21);
  y += 40 + 20;

  ctx.fillStyle = '#1c1a17';
  ctx.font = `500 44px ${serif}`;
  for (const l of qLines) {
    ctx.fillText(l, pad, y + 40);
    y += 54;
  }
  y += 30;

  paras.forEach((p, i) => {
    const lines = paraLines[i];
    const color = COLORS[p.status] ?? COLORS.agreed;
    const top = y;
    ctx.fillStyle = color;
    ctx.fillRect(pad, top + 6, 5, lines.length * 36 + 10);
    ctx.fillStyle = '#1c1a17';
    ctx.font = `400 26px ${serif}`;
    for (const l of lines) {
      ctx.fillText(l, pad + 28, y + 28);
      y += 36;
    }
    ctx.fillStyle = color;
    ctx.font = `600 15px ${sans}`;
    ctx.fillText(LABEL[p.status] ?? p.status.toUpperCase(), pad + 28, y + 22);
    y += 26 + 22;
  });

  y += 20;
  ctx.fillStyle = '#4a463f';
  ctx.font = `400 21px ${sans}`;
  const summary = `${opts.models.join(', ')} argued. ${withdrawn} objection${withdrawn === 1 ? '' : 's'} resolved, ${unresolved} unresolved.`;
  for (const l of wrap(ctx, summary, textW)) {
    ctx.fillText(l, pad, y + 20);
    y += 30;
  }
  y += 14;
  ctx.fillStyle = '#7a746a';
  ctx.font = `400 19px ${sans}`;
  const url = opts.siteUrl ? `${opts.siteUrl.replace(/\/$/, '')}/r/${opts.room.code}` : `Room ${opts.room.code}`;
  ctx.fillText(url + '  ·  Several AI models argue over your question. Your team argues back.', pad, y + 20);

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('canvas failed'))), 'image/png'));
}

export async function shareOrDownload(blob: Blob, filename: string): Promise<'shared' | 'downloaded' | 'copied'> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    await nav.share({ files: [file], title: 'Redflow verdict' });
    return 'shared';
  }
  try {
    if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return 'copied';
    }
  } catch {
    // fall through to download
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
  return 'downloaded';
}
