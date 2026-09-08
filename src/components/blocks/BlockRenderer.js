/**
 * Renders the agent's structured blocks as real UI.
 *
 * The backend never sends markdown: it sends typed blocks (see
 * fintech_back/app/agent/blocks.py) and this module maps each one to a
 * component, so a table looks like a table and a chart like a chart.
 */
import { h } from '../../core/runtime.js';
import { TextBlock } from './TextBlock.js';
import { KpiBlock } from './KpiBlock.js';
import { TableBlock } from './TableBlock.js';
import { ChartBlock } from './ChartBlock.js';
import { FileBlock } from './FileBlock.js';
import { ListBlock } from './ListBlock.js';
import { NoticeBlock } from './NoticeBlock.js';
import { HeadingBlock } from './HeadingBlock.js';

const RENDERERS = {
  text: TextBlock,
  kpis: KpiBlock,
  table: TableBlock,
  chart: ChartBlock,
  file: FileBlock,
  list: ListBlock,
  notice: NoticeBlock,
  heading: HeadingBlock,
};

export function BlockRenderer({ blocks }) {
  if (!blocks || blocks.length === 0) return null;
  return h('div', { className: 'blocks' },
    blocks.map((block, index) => {
      const Component = RENDERERS[block.type];
      // An unknown block type must never blank the message.
      if (!Component) return h(TextBlock, { key: index, content: JSON.stringify(block) });
      return h(Component, { key: index, ...block });
    }));
}
