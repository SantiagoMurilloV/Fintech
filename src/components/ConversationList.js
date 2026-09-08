/**
 * Recent conversations with delete affordances.
 *
 * Two modes: browsing (hover shows a per-item delete) and selection (checkboxes
 * plus bulk actions), so the history never piles up.
 */
import { h, useState } from '../core/runtime.js';

export function ConversationList({
  conversations, activeId, onOpen, onDelete, onDeleteMany, onNewConversation,
}) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [confirmingAll, setConfirmingAll] = useState(false);

  const toggle = (id) => setSelected((current) =>
    current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const exitSelection = () => {
    setSelecting(false);
    setSelected([]);
    setConfirmingAll(false);
  };

  const removeSelected = async () => {
    await onDeleteMany(selected);
    exitSelection();
  };

  const removeAll = async () => {
    await onDeleteMany([]);   // empty list = clear everything
    exitSelection();
  };

  return h('section', { className: 'history' },
    h('header', { className: 'history__head' },
      h('h2', { className: 'history__title' }, 'Recientes'),
      conversations.length > 0
        ? h('button', {
            className: 'history__action',
            onClick: () => (selecting ? exitSelection() : setSelecting(true)),
          }, selecting ? 'Listo' : 'Editar')
        : null,
      h('button', {
        className: 'history__new',
        title: 'Nueva conversación',
        'aria-label': 'Nueva conversación',
        onClick: () => { exitSelection(); onNewConversation(); },
      }, '+')),

    h('div', { className: 'history__items' },
      conversations.length === 0
        ? h('p', { className: 'history__empty' }, 'Sin conversaciones aún')
        : conversations.map((conversation) =>
            h('div', {
              key: conversation.id,
              className: `history-item ${conversation.id === activeId ? 'is-active' : ''}`.trim(),
            },
              selecting
                ? h('button', {
                    className: `history-item__check ${selected.includes(conversation.id) ? 'is-checked' : ''}`.trim(),
                    'aria-label': `Seleccionar ${conversation.title}`,
                    onClick: () => toggle(conversation.id),
                  }, selected.includes(conversation.id) ? '✓' : '')
                : null,
              h('button', {
                className: 'history-item__label',
                title: conversation.title,
                onClick: () => (selecting ? toggle(conversation.id) : onOpen(conversation.id)),
              }, conversation.title),
              !selecting
                ? h('button', {
                    className: 'history-item__delete',
                    title: 'Eliminar conversación',
                    'aria-label': `Eliminar ${conversation.title}`,
                    onClick: (event) => { event.stopPropagation(); onDelete(conversation.id); },
                  }, '✕')
                : null))),

    selecting
      ? h('div', { className: 'history__bulk' },
          confirmingAll
            ? h('div', { className: 'history__confirm' },
                h('span', null, '¿Borrar todo el historial?'),
                h('div', { className: 'history__confirm-actions' },
                  h('button', { className: 'history__danger', onClick: removeAll }, 'Sí, borrar'),
                  h('button', { className: 'history__action', onClick: () => setConfirmingAll(false) }, 'Cancelar')))
            : h('div', { className: 'history__bulk-actions' },
                h('button', {
                  className: 'history__danger',
                  disabled: selected.length === 0,
                  onClick: removeSelected,
                }, `Eliminar (${selected.length})`),
                h('button', {
                  className: 'history__action',
                  onClick: () => setConfirmingAll(true),
                }, 'Borrar todo')))
      : null);
}
