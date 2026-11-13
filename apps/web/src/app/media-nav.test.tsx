import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it } from 'vitest';
import { MediaNav } from './AppShell';

afterEach(() => {
  cleanup();
  localStorage.clear();
});
it('hides submenu links from keyboard/accessibility navigation while collapsed and restores them on expand', () => {
  render(
    <MemoryRouter initialEntries={['/projects']}>
      <MediaNav />
    </MemoryRouter>,
  );
  const toggle = screen.getByRole('button', { name: 'คลังสื่อ' });
  expect(screen.getByRole('link', { name: 'คลังรูป' })).toBeTruthy();
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('link', { name: 'คลังรูป' })).toBeNull();
  expect(document.getElementById('media-submenu')?.hasAttribute('inert')).toBe(true);
  fireEvent.click(toggle);
  expect(screen.getByRole('link', { name: 'คลังวิดีโอ' }).getAttribute('href')).toBe('/library');
  expect(screen.getByRole('link', { name: 'คลังรูป' }).getAttribute('href')).toBe('/photos');
});
