import { describe, expect, it } from 'vitest';
import { formatBytes, validateFile } from './upload-manager';

const cfg = {
  endpoint: '/uploads',
  maxBytes: 8 * 1024 ** 3,
  extensions: ['mp4', 'mov'],
  chunkBytes: 8 * 1024 * 1024,
};

describe('validateFile', () => {
  it('accepts supported videos within the limit', () => {
    expect(validateFile({ name: 'ไลฟ์ 12 พ.ย..MP4', size: 10 }, cfg)).toBeNull();
  });
  it('explains wrong types, empty files and oversized files in Thai', () => {
    expect(validateFile({ name: 'notes.txt', size: 10 }, cfg)).toMatch(/ไม่ใช่วิดีโอที่รองรับ/);
    expect(validateFile({ name: 'a.mp4', size: 0 }, cfg)).toMatch(/ว่างเปล่า/);
    expect(validateFile({ name: 'a.mp4', size: 9 * 1024 ** 3 }, cfg)).toMatch(
      /ใหญ่เกินไป \(9\.0 GB — สูงสุด 8\.0 GB\)/,
    );
  });
});

describe('formatBytes', () => {
  it('uses KB/MB/GB', () => {
    expect(formatBytes(500)).toBe('1 KB');
    expect(formatBytes(5.5 * 1024 * 1024)).toBe('5.5 MB');
    expect(formatBytes(2 * 1024 ** 3)).toBe('2.0 GB');
  });
});
