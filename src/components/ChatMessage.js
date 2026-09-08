/** Chat bubbles and the typing indicator. */
import { h } from '../core/runtime.js';
import { initials } from '../lib/format.js';
import { LogoMark } from './Logo.js';
import { BlockRenderer } from './blocks/BlockRenderer.js';

export function ChatMessage({ role, content, blocks, email, attachments }) {
  const isUser = role === 'user';
  const hasBlocks = Array.isArray(blocks) && blocks.length > 0;

  return h('article', { className: `message message--${isUser ? 'user' : 'agent'}` },
    h('span', { className: 'message__avatar', 'aria-hidden': 'true' },
      isUser ? initials(email) : h(LogoMark, { size: 14, strokeWidth: 2.8 })),
    // Agent answers render as structured blocks; user turns stay a plain bubble.
    hasBlocks
      ? h('div', { className: 'message__blocks' }, h(BlockRenderer, { blocks }))
      : h('div', { className: 'message__bubble' },
          content,
          attachments && attachments.length
            ? h('span', { className: 'message__attachments' },
                attachments.map((file) =>
                  h('span', { key: file.id, className: 'attachment-chip is-sent' },
                    h('span', { 'aria-hidden': 'true' }, '▤'), file.filename)))
            : null));
}

export function TypingIndicator() {
  return h('div', { className: 'typing', 'aria-label': 'El agente está escribiendo' },
    h('span'), h('span'), h('span'));
}
