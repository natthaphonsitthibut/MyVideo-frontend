// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

afterEach(cleanup);

function Example() {
  return (
    <Tabs defaultValue="captions">
      <TabsList aria-label="เครื่องมือตัดต่อ">
        <TabsTrigger value="captions">คำบรรยาย</TabsTrigger>
        <TabsTrigger value="crop" disabled>
          ครอบภาพ
        </TabsTrigger>
        <TabsTrigger value="style">สไตล์</TabsTrigger>
      </TabsList>
      <TabsContent value="captions">แก้คำบรรยาย</TabsContent>
      <TabsContent value="style">เลือกสไตล์</TabsContent>
    </Tabs>
  );
}

it('links tabs to panels and supports arrows, Home and End with automatic activation', () => {
  render(<Example />);
  const first = screen.getByRole('tab', { name: 'คำบรรยาย' });
  const last = screen.getByRole('tab', { name: 'สไตล์' });
  expect(screen.getByRole('tablist', { name: 'เครื่องมือตัดต่อ' })).toBeTruthy();
  const panel = screen.getByRole('tabpanel');
  expect(first.getAttribute('aria-controls')).toBe(panel.id);
  expect(panel.getAttribute('aria-labelledby')).toBe(first.id);
  first.focus();
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(document.activeElement).toBe(last);
  expect(last.getAttribute('aria-selected')).toBe('true');
  expect(screen.getByRole('tabpanel').textContent).toBe('เลือกสไตล์');
  expect(first.tabIndex).toBe(-1);
  fireEvent.keyDown(last, { key: 'ArrowRight' });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: 'End' });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last, { key: 'Home' });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: 'ArrowLeft' });
  expect(document.activeElement).toBe(last);
});

it('activates on click but never activates disabled tabs', () => {
  render(<Example />);
  fireEvent.click(screen.getByRole('tab', { name: 'สไตล์' }));
  fireEvent.click(screen.getByRole('tab', { name: 'ครอบภาพ' }));
  expect(screen.getByRole('tabpanel').textContent).toBe('เลือกสไตล์');
});

it('keeps loading tabs unavailable and exposes the busy state', () => {
  render(
    <Tabs defaultValue="captions" state="loading" aria-label="เครื่องมือ">
      <TabsList aria-label="เครื่องมือตัดต่อ">
        <TabsTrigger value="captions">คำบรรยาย</TabsTrigger>
        <TabsTrigger value="style">สไตล์</TabsTrigger>
      </TabsList>
      <TabsContent value="captions">กำลังโหลด…</TabsContent>
      <TabsContent value="style">เลือกสไตล์</TabsContent>
    </Tabs>,
  );
  const first = screen.getByRole('tab', { name: 'คำบรรยาย' });
  expect((first as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByLabelText('เครื่องมือ').getAttribute('aria-busy')).toBe('true');
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  fireEvent.click(screen.getByRole('tab', { name: 'สไตล์' }));
  expect(screen.getByRole('tabpanel').textContent).toBe('กำลังโหลด…');
});
