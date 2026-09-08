/** Full agent view: greeting, thread with rich blocks, composer with attachments. */
import { h, useEffect, useMemo, useRef, useState } from '../core/runtime.js';
import { CHAT_SUGGESTIONS } from '../lib/labels.js';
import { greeting } from '../lib/format.js';
import { ChatMessage, TypingIndicator } from '../components/ChatMessage.js';
import { Logo } from '../components/Logo.js';

const ACCEPTED_FILES = '.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.txt,.md,.json';

export function AgentView({ chat, email }) {
  const [draft, setDraft] = useState('');
  const threadRef = useRef(null);
  const fileRef = useRef(null);

  // Computed once per mount so the greeting does not flicker on re-render.
  const hello = useMemo(() => greeting(email), [email]);

  // Keep the latest message in view as the thread grows.
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [chat.messages.length, chat.pending]);

  const send = (text) => {
    const content = text ?? draft;
    if (!content.trim() && chat.attachments.length === 0) return;
    setDraft('');
    chat.send(content, { view: 'agent' });
  };

  const isEmpty = chat.messages.length === 0;

  return h('div', { className: 'chat' },
    isEmpty
      ? h('div', { className: 'chat__empty' },
          h(Logo, { size: 56, radius: '50%' }),
          h('h1', { className: 'chat__headline' }, hello, h('br'), '¿Cuál es su enfoque hoy?'),
          h('div', { className: 'chat__suggestions' },
            CHAT_SUGGESTIONS.map((suggestion) =>
              h('button', {
                key: suggestion.text,
                className: 'suggestion',
                onClick: () => send(suggestion.text),
              },
                h('span', { className: 'suggestion__icon', 'aria-hidden': 'true' }, suggestion.icon),
                suggestion.text))))
      : h('div', { className: 'chat__thread', ref: threadRef },
          chat.messages.map((message, index) =>
            h(ChatMessage, {
              key: index,
              role: message.role,
              content: message.content,
              blocks: message.blocks,
              attachments: message.attachments,
              email,
            })),
          chat.pending ? h(TypingIndicator) : null),

    h('div', { className: 'composer' },
      chat.attachments.length || chat.uploading || chat.uploadError
        ? h('div', { className: 'composer__attachments' },
            chat.attachments.map((file) =>
              h('span', { key: file.id, className: 'attachment-chip' },
                h('span', { 'aria-hidden': 'true' }, '▤'),
                file.filename,
                h('button', {
                  className: 'attachment-chip__remove',
                  'aria-label': `Quitar ${file.filename}`,
                  onClick: () => chat.removeAttachment(file.id),
                }, '✕'))),
            chat.uploading ? h('span', { className: 'attachment-chip is-loading' }, 'Subiendo…') : null,
            chat.uploadError ? h('span', { className: 'attachment-chip is-error' }, chat.uploadError) : null)
        : null,

      h('div', { className: 'composer__box' },
        h('button', {
          className: 'composer__attach',
          'aria-label': 'Adjuntar archivo',
          title: 'Adjuntar PDF, imagen o planilla',
          onClick: () => fileRef.current?.click(),
        }, '+'),
        h('input', {
          ref: fileRef,
          type: 'file',
          accept: ACCEPTED_FILES,
          className: 'is-hidden',
          onChange: (event) => { chat.attach(event.target.files[0]); event.target.value = ''; },
        }),
        h('input', {
          className: 'composer__input',
          value: draft,
          placeholder: 'Pregunte por sus finanzas…',
          autocomplete: 'off',
          'aria-label': 'Mensaje para el agente',
          onInput: (event) => setDraft(event.target.value),
          onKeyDown: (event) => { if (event.key === 'Enter') send(); },
        }),
        h('button', {
          className: 'composer__send',
          disabled: chat.pending || (!draft.trim() && chat.attachments.length === 0),
          onClick: () => send(),
          'aria-label': 'Enviar',
        }, '↑')),

      h('p', { className: 'composer__note' },
        'El agente calcula con los datos reales del panel. Verifique cifras críticas contra los reportes.')));
}
