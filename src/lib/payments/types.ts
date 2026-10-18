// واجهة موحّدة لبوابات الدفع: لإضافة HyperPay/Tap/PayTabs يكفي تنفيذ هذه الواجهة.
export type VerifiedPayment = {
  id: string;
  status: 'paid' | 'failed' | 'pending' | 'refunded' | 'other';
  amountHalalas: number;
  currency: string;
  orderId: string | null;
};
export type WebhookEvent = { eventId: string; type: string; paymentId: string | null };

export interface PaymentProvider {
  name: string;
  /** يتحقق من أصالة الطلب ويرمي Error عند الفشل */
  verifyWebhook(rawBody: string): WebhookEvent;
  /** يجلب حالة الدفعة من البوابة مباشرة (المصدر الموثوق، لا بيانات الـ Webhook) */
  fetchPayment(paymentId: string): Promise<VerifiedPayment>;
}
