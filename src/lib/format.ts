const fmt = new Intl.NumberFormat('ar-SA-u-nu-latn', { style: 'currency', currency: 'SAR' });
export const formatSAR = (halalas: number) => fmt.format(halalas / 100);

export const TYPE_LABELS: Record<string, string> = { code: 'كود', account: 'حساب', subscription: 'اشتراك', key: 'مفتاح تفعيل' };
export const PAY_LABELS: Record<string, string> = { pending: 'بانتظار الدفع', paid: 'مدفوع', failed: 'فشل الدفع', refunded: 'مسترد' };
export const FULFIL_LABELS: Record<string, string> = { pending: 'قيد التسليم', fulfilled: 'تم التسليم', failed: 'تعذّر التسليم' };

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
