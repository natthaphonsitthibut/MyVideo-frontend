import { expect, it } from 'vitest';
import { wordMarking } from './word-marking';

it('marks AI words and keeps heard text available for revert', () => {
  expect(wordMarking({ original: null, aiFixed: true, heard: 'พิม' })).toEqual({
    ai: true,
    edited: false,
    heard: 'พิม',
    title: 'AI แก้จาก “พิม”',
    canRevert: true,
  });
});
it('merchant edits win; untouched and older words have no AI mark', () => {
  expect(wordMarking({ original: 'พิม', aiFixed: false, heard: 'พิม' })).toMatchObject({
    ai: false,
    edited: true,
    canRevert: true,
  });
  expect(wordMarking({ original: null })).toMatchObject({ ai: false, edited: false, canRevert: false });
  expect(wordMarking({ original: null, aiFixed: false, heard: null }).title).toBeUndefined();
});
