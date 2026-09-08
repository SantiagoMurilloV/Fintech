/**
 * Paragraph block.
 *
 * The agent writes plain prose, but bullet lines ("• …") are promoted to a
 * real list so the message reads as UI rather than a text dump.
 */
import { h } from '../../core/runtime.js';

export function TextBlock({ content }) {
  const lines = String(content || '').split('\n').filter((line) => line.trim() !== '');
  const isBullet = (line) => /^\s*[•\-*]\s+/.test(line);

  const nodes = [];
  let bullets = [];

  const flush = () => {
    if (bullets.length === 0) return;
    nodes.push(h('ul', { key: `list-${nodes.length}`, className: 'block-text__list' },
      bullets.map((item, i) => h('li', { key: i }, item.replace(/^\s*[•\-*]\s+/, '')))));
    bullets = [];
  };

  for (const line of lines) {
    if (isBullet(line)) {
      bullets.push(line);
    } else {
      flush();
      nodes.push(h('p', { key: `p-${nodes.length}`, className: 'block-text__p' }, line));
    }
  }
  flush();

  return h('div', { className: 'block block-text' }, nodes);
}
