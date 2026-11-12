/** Signal names in rules-mode reasons → Thai (the reason lists what the seller said). */
const SIGNAL_TH: Record<string, string> = {
  price: 'ราคา',
  promo: 'โปร',
  urgency: 'เร่งซื้อ',
  cta: 'บอกวิธีสั่ง',
  detail: 'รายละเอียดสินค้า',
  benefit: 'จุดเด่น',
  product: 'ชื่อสินค้า',
  'question-answered': 'ตอบคำถาม',
  'speech-rate': 'พูดเร็ว',
  loudness: 'เสียงดังขึ้น',
  complete: 'ครบทั้งราคา-รายละเอียด-วิธีสั่ง',
};
export const rulesReason = (r: string) =>
  r
    .split(' · ')
    .slice(0, 3)
    .map((part) => {
      const m = /^([a-z-]+) ×(\d+)/.exec(part);
      return m ? `${SIGNAL_TH[m[1] ?? ''] ?? m[1]} ×${m[2]}` : part;
    })
    .join(' · ');
