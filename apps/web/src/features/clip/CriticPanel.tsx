import type { ProjectRecord } from '@/api/projects';

const LABELS = [
  'ใช้เฉพาะฟุตเทจที่เลือก',
  'ที่มาของแต่ละช่วง',
  'ตัวเลขและหน่วย',
  'คำกล่าวอ้างและโปรโมชัน',
  'ขอบตัดไม่คร่อมคำ',
  'ฟังขอบคำและเทคที่เลือก',
  'ซับตรงกับเสียงที่เก็บ',
  'ลำดับคำและการขึ้นบรรทัด',
  'คำเน้นในซับ',
  'พื้นที่ปลอดภัยและใบหน้า',
  'ข้อความซ้ำกับซับ',
  'เวลาอ่านกราฟิก',
  'รูปและไฟล์อ้างอิง',
  'สัดส่วนซูม',
  'จำนวนทรานซิชัน',
  'แฟลช',
  'ความชัดบนภาพจริง',
  'ที่มาเพลงและเอฟเฟกต์',
  'ลดเพลงตอนพูด',
  'ความดังไฟล์ส่งออก',
  'ภาพตัวอย่างตรงกับส่งออก',
  'ภาพเปิดและเรื่องเล่า',
  'ตอนจบและเวลาอ่าน',
  'ไม่คัดลอกเนื้อหาอ้างอิง',
  'ส่งออกซ้ำใช้ข้อมูลเดิม',
  'บันทึกผลตรวจและการแก้',
];
export function CriticPanel({ report }: { report: NonNullable<ProjectRecord['doc']['meta']['director']> }) {
  const failed = report.checks.filter((c) => c.status === 'fail'),
    pending = report.checks.filter((c) => c.status === 'not_run');
  const last = report.judge.rounds.at(-1);
  const low = last?.items.filter((i) => i.score <= 7).length ?? 0;
  return (
    <details className="rounded-xl border p-4 text-sm">
      <summary className="cursor-pointer font-medium">
        ผลตรวจงานตัด {failed.length ? `· พบ ${failed.length} ข้อ` : '· ตรวจโครงสร้างแล้ว'}
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-muted-foreground">
          บันทึกจากตอนสร้างคลิป · {report.codeFixes?.length ?? 0} การแก้อัตโนมัติ · {pending.length} ข้อรอตรวจเพิ่มเติม
        </p>
        <p>
          ตรวจภาพด้วย AI:{' '}
          {report.judge.status === 'reviewed'
            ? `${report.judge.rounds.length} รอบ${low ? ` · ยังมี ${low} จุดให้ดูต่อ` : ''}`
            : report.judge.status === 'unavailable'
              ? 'ตรวจไม่สำเร็จ โปรดดูภาพด้วยตัวเอง'
              : 'ยังไม่ได้ตรวจ'}
        </p>
        <ol className="space-y-2">
          {report.checks.map((c) => (
            <li key={c.checkId} className="flex gap-2">
              <span className={c.status === 'fail' ? 'text-destructive' : 'text-muted-foreground'}>
                {c.status === 'pass' ? 'ผ่าน' : c.status === 'fail' ? 'ให้แก้' : 'รอตรวจ'}
              </span>
              <span>
                {c.checkId} {LABELS[Number(c.checkId) - 1]}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">ผลนี้อ้างอิงฉบับที่สร้างครั้งแรก หลังแก้ไขให้ตรวจภาพและเสียงอีกครั้ง</p>
      </div>
    </details>
  );
}
