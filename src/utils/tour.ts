import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { setTourCompleted } from './storage';

export function startProductTour(onComplete?: () => void) {
  const driverObj = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    overlayColor: 'rgba(15, 23, 42, 0.45)',
    nextBtnText: 'ถัดไป →',
    prevBtnText: '← ย้อนกลับ',
    doneBtnText: 'เริ่มต้นใช้งาน ✨',
    steps: [
      {
        element: '#tour-brand',
        popover: {
          title: '⚡ ยินดีต้อนรับสู่ jodbill (จดบิล)',
          description: 'แอปช่วยบันทึกและคำนวณค่าน้ำ-ค่าไฟแบบ Real-time เหมาะสำหรับเด็กหอพัก คอนโด และบ้านอยู่อาศัย',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#tour-record-btn',
        popover: {
          title: '📸 ปุ่มจดบิล & สแกนมิเตอร์',
          description: 'กดที่นี่เมื่อต้องการจดมิเตอร์ใหม่ สามารถเปิดกล้องถ่ายรูปให้อ่านเลขอัตโนมัติ (AI OCR) หรือพิมพ์ใส่เองได้ทันที',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#tour-hero-cards',
        popover: {
          title: '📊 ประมาณการบิลสิ้นเดือนแบบ Real-Time',
          description: 'ดูยอดเงินค่าไฟและค่าน้ำที่คาดว่าจะต้องจ่ายสิ้นรอบบิล พร้อมอัตราการใช้เฉลี่ยต่อวัน และมาตรวัดงบประมาณ',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-charts',
        popover: {
          title: '📈 สถิติและกราฟแนวโน้ม',
          description: 'ดูกราฟการใช้ไฟ-น้ำรายวัน และเปรียบเทียบค่าใช้จ่ายย้อนหลังแต่ละรอบบิล',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-simulator-tab',
        popover: {
          title: '❄️ คำนวณค่าไฟแอร์ & เครื่องใช้ไฟฟ้า',
          description: 'อยากรู้ว่าเปิดแอร์กี่ชั่วโมงกินไฟกี่บาท? เข้าแท็บนี้เพื่อปรับชั่วโมงการใช้งานและจำลองค่าไฟได้ทันที',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-settings-btn',
        popover: {
          title: '⚙️ ตั้งค่าเรทราคา & รอบตัดบิล',
          description: 'กำหนดราคาค่าไฟต่อหน่วย (เช่น 8 บาท), ค่าน้ำต่อหน่วย (เช่น 18 บาท) และวันตัดรอบบิลของหอพักคุณได้ที่นี่',
          side: 'bottom',
          align: 'end',
        },
      },
    ],
    onDestroyed: () => {
      setTourCompleted(true);
      if (onComplete) onComplete();
    },
  });

  driverObj.drive();
}
