/** Click-or-drop file picker used by the import modal. */
import { h, useRef, useState } from '../core/runtime.js';

export function FileDropzone({ accept, file, onSelect, hint }) {
  const inputRef = useRef(null);
  const [isOver, setIsOver] = useState(false);

  const pick = (selected) => { if (selected) onSelect(selected); };

  return h('div', null,
    h('button', {
      type: 'button',
      className: `dropzone ${isOver ? 'is-over' : ''}`.trim(),
      onClick: () => inputRef.current?.click(),
      onDragOver: (event) => { event.preventDefault(); setIsOver(true); },
      onDragLeave: () => setIsOver(false),
      onDrop: (event) => {
        event.preventDefault();
        setIsOver(false);
        pick(event.dataTransfer.files[0]);
      },
    }, file ? `Archivo: ${file.name}` : (hint || 'Arrastre el archivo aquí o haga clic para seleccionarlo')),

    h('input', {
      ref: inputRef,
      type: 'file',
      accept,
      className: 'is-hidden',
      onChange: (event) => pick(event.target.files[0]),
    }));
}
