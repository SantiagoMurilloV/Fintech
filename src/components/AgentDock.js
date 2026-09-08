/**
 * Floating chat dock.
 *
 * Lets the user talk to the agent without leaving the screen they are on, and
 * tells the agent where that is: every message carries `{view}` as context, so
 * "¿y esto?" resolves against the table in front of them.
 *
 * It shares its thread with the full agent view through the `chat` hook.
 */
import { h, useEffect, useRef, useState } from '../core/runtime.js';
import { VIEW_LABELS, VIEW_SUGGESTIONS } from '../lib/labels.js';
import { ChatMessage, TypingIndicator } from './ChatMessage.js';
import { LogoMark } from './Logo.js';

const ACCEPTED_FILES = '.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.txt,.md,.json';

export function AgentDock({ chat, view, email, onClose, onExpand, onNewConversation }) {
  const [draft, setDraft] = useState('');
  const threadRef = useRef(null);
  const fileRef = useRef(null);

  const viewLabel = VIEW_LABELS[view] || view;
  const suggestions = VIEW_SUGGESTIONS[view] || VIEW_SUGGESTIONS.agent;

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [chat.messages.length, chat.pending]);

  // Escape closes the dock, matching the modal behaviour.
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const send = (text) => {
    const content = text ?? draft;
    if (!content.trim() && chat.attachments.length === 0) return;
    setDraft('');
    chat.send(content, { view });
  };

  return h('section', { className: 'dock', role: 'dialog', 'aria-label': 'Agente' },
    h('header', { className: 'dock__head' },
      h('span', { className: 'dock__mark', 'aria-hidden': 'true' },
        h(LogoMark, { size: 15, strokeWidth: 1.8 })),
      h('span', { className: 'dock__title' }, 'Agente'),
      // Makes the context the agent receives visible to the user.
      h('span', { className: 'dock__context', title: 'Contexto que recibe el agente' },
        `Viendo: ${viewLabel}`),
      h('button', {
        className: 'dock__icon-btn', onClick: onNewConversation,
        title: 'Nueva conversación', 'aria-label': 'Nueva conversación',
      }, '+'),
      h('button', {
        className: 'dock__icon-btn', onClick: onExpand,
        title: 'Abrir en pantalla completa', 'aria-label': 'Abrir en pantalla completa',
      }, '⤢'),
      h('button', {
        className: 'dock__icon-btn', onClick: onClose,
        title: 'Cerrar', 'aria-label': 'Cerrar',
      }, '✕')),

    h('div', { className: 'dock__thread', ref: threadRef },
      chat.messages.length === 0
        ? h('div', { className: 'dock__empty' },
            h('p', null, `Pregúnteme sobre ${viewLabel.toLowerCase()} o sobre cualquier cifra del panel.`),
            h('div', { className: 'dock__suggestions' },
              suggestions.map((suggestion) =>
                h('button', {
                  key: suggestion,
                  className: 'dock__suggestion',
                  onClick: () => send(suggestion),
                }, suggestion))))
        : chat.messages.map((message, index) =>
            h(ChatMessage, {
              key: index,
              role: message.role,
              content: message.content,
              blocks: message.blocks,
              attachments: message.attachments,
              email,
            })),
      chat.pending ? h(TypingIndicator) : null),

    chat.attachments.length || chat.uploading || chat.uploadError
      ? h('div', { className: 'dock__attachments' },
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

    h('div', { className: 'dock__composer' },
      h('button', {
        className: 'dock__attach', onClick: () => fileRef.current?.click(),
        title: 'Adjuntar archivo', 'aria-label': 'Adjuntar archivo',
      }, '+'),
      h('input', {
        ref: fileRef, type: 'file', accept: ACCEPTED_FILES, className: 'is-hidden',
        onChange: (event) => { chat.attach(event.target.files[0]); event.target.value = ''; },
      }),
      h('input', {
        className: 'dock__input',
        value: draft,
        placeholder: `Pregunta sobre ${viewLabel.toLowerCase()}…`,
        autocomplete: 'off',
        'aria-label': 'Mensaje para el agente',
        onInput: (event) => setDraft(event.target.value),
        onKeyDown: (event) => { if (event.key === 'Enter') send(); },
      }),
      h('button', {
        className: 'dock__send',
        disabled: chat.pending || (!draft.trim() && chat.attachments.length === 0),
        onClick: () => send(),
        'aria-label': 'Enviar',
      }, '↑')));
}
