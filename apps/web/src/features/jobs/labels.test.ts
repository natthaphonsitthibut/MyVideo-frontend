import { describe, expect, it } from 'vitest';
import { stepDuration } from './labels';

describe('step duration', () => {
  it('seconds, minutes, hours; a running step counts up to now', () => {
    const t0 = '2026-11-12T10:00:00.000Z';
    expect(stepDuration(t0, '2026-11-12T10:00:12.400Z')).toBe('12 วิ');
    expect(stepDuration(t0, '2026-11-12T10:03:05.000Z')).toBe('3 นาที 05 วิ');
    expect(stepDuration(t0, '2026-11-12T12:07:00.000Z')).toBe('2 ชม. 07 นาที');
    expect(stepDuration(t0, null, Date.parse('2026-11-12T10:00:45.000Z'))).toBe('45 วิ');
  });
});
