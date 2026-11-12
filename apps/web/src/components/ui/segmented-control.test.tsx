// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { SegmentedControl } from './segmented-control';

afterEach(cleanup);

const options = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'busy', label: 'กำลังทำ', disabled: true },
  { value: 'ready', label: 'พร้อมแล้ว' },
];

function Example() {
  const [value, setValue] = useState('all');
  return <SegmentedControl label="คลิป" options={options} value={value} onValueChange={setValue} />;
}

it('moves selection with arrows, skips disabled options and wraps', () => {
  render(<Example />);
  const first = screen.getByRole('radio', { name: 'ทั้งหมด' });
  const last = screen.getByRole('radio', { name: 'พร้อมแล้ว' });
  expect(screen.getByRole('radiogroup', { name: 'คลิป' })).toBeTruthy();
  first.focus();
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(document.activeElement).toBe(last);
  expect((last as HTMLInputElement).checked).toBe(true);
  expect(first.tabIndex).toBe(-1);
  fireEvent.keyDown(last, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: 'ArrowLeft' });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last, { key: 'Home' });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: 'End' });
  expect(document.activeElement).toBe(last);
});

it('selects by click and prevents changes while loading or disabled', () => {
  const { rerender } = render(<Example />);
  fireEvent.click(screen.getByRole('radio', { name: 'พร้อมแล้ว' }));
  expect((screen.getByRole('radio', { name: 'พร้อมแล้ว' }) as HTMLInputElement).checked).toBe(true);
  for (const state of ['loading', 'disabled'] as const) {
    rerender(
      <SegmentedControl
        label="คลิป"
        options={options}
        value="all"
        state={state}
        onValueChange={() => {
          throw new Error('Must not change');
        }}
      />,
    );
    const first = screen.getByRole('radio', { name: 'ทั้งหมด' });
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('radio', { name: 'พร้อมแล้ว' }));
    expect((first as HTMLInputElement).disabled).toBe(true);
  }
});
