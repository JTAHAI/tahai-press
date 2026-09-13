import test from 'node:test';
import assert from 'node:assert/strict';
import { STORY_BLOCK_TYPES, renderStoryBlocks } from '../scripts/lib/editorial.mjs';

test('the full editorial block vocabulary is declarative and rendered as accessible HTML', () => {
  for (const type of [
    'numbered_findings', 'source_list', 'data_table', 'correction_notice', 'update_notice',
    'related_coverage', 'editor_note', 'definition_box', 'methodology_box'
  ]) assert.ok(STORY_BLOCK_TYPES.includes(type), `${type} is available`);

  const html = renderStoryBlocks({
    story_blocks: [
      { type: 'numbered_findings', heading: 'Findings', items: ['First finding', 'Second finding'] },
      { type: 'source_list', heading: 'Sources', items: ['Meeting minutes', 'Budget record'] },
      { type: 'data_table', heading: 'Votes', columns: ['Member', 'Vote'], rows: [['Avery', 'Yes'], ['Morgan', 'No']] },
      { type: 'correction_notice', body: 'An earlier version misstated the vote count.' },
      { type: 'update_notice', body: 'Updated after the agenda was published.' },
      { type: 'related_coverage', items: ['Related coverage'] },
      { type: 'editor_note', body: 'Editor context.' },
      { type: 'definition_box', body: 'A plain-language definition.' },
      { type: 'methodology_box', body: 'How the reporting was done.' }
    ]
  });
  assert.match(html, /story-block-numbered_findings/);
  assert.match(html, /<table>/);
  assert.match(html, /<th scope="col">Member/);
  assert.match(html, /story-block-correction_notice/);
  assert.match(html, /story-block-methodology_box/);
  assert.doesNotMatch(html, /<script/i);
});
