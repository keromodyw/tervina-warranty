import type { AdminClaim } from './adminApi'

/**
 * WhatsApp activation notice - the client's verbatim template.
 *
 * Kept byte-for-byte as supplied: the greeting is bold (*...*), the item and
 * product share one line, the duration reads "و لمدة N شهر", and the footer
 * carries the company Facebook link, the 19301 number and the rose emoji. Do
 * not "tidy" the spacing - WhatsApp renders it literally.
 */
const TEMPLATE = `*عزيزنا العميل / {name}*

الضمان الخاص ب: {item} - نوع: {product}
برقم سيريال {serial} و أن رقم الضمان {code}
و تاريخ التفعيل {start} و لمدة {months} شهر
حيث ينتهي الضمان بتاريخ {end}

لينك الصفحة الخاصة بالشركة، يشرفنا متابعتكم
https://www.facebook.com/share/1Ac2pkZuhG/

 *برجاء عدم الرد على هذه الرسالة!*
و في حالة وجود أي استفسارات، يُرجى التواصل علي الرقم 19301
شكرا لتواصلك بترفينا، و نتمنى لكم يوماً سعيداً.🌹`

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function buildWhatsAppMessage(claim: AdminClaim): string {
  return TEMPLATE.replaceAll('{name}', claim.customer?.full_name ?? '')
    .replaceAll('{item}', claim.item_type)
    .replaceAll('{product}', claim.product_type)
    .replaceAll('{serial}', claim.serial)
    .replaceAll('{code}', claim.activation_code ?? '—')
    .replaceAll('{start}', formatDate(claim.warranty_start))
    .replaceAll('{end}', formatDate(claim.warranty_end))
    .replaceAll('{months}', claim.warranty_months == null ? '—' : String(claim.warranty_months))
}

/** WhatsApp URL. The customer's phone is already stored as +20XXXXXXXXXX. */
export function buildWhatsAppUrl(claim: AdminClaim): string {
  const digits = (claim.customer?.phone ?? '').replace(/[^0-9]/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(buildWhatsAppMessage(claim))}`
}
