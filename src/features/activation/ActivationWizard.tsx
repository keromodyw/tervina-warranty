import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { ensureAnonymousUserId, upsertCustomer, type PersonalDraft, type ProductDraft } from '@/core/session/session'
import type { PhotoKind } from '@/core/photos/photoManifest'
import { newClaimId, submitClaim, type SubmitResult } from '@/core/claims/submit'
import { useActivationDraft } from './useActivationDraft'
import { PersonalStep } from './PersonalStep'
import { ProductStep } from './ProductStep'
import { PhotoStep, type PhotoMap } from './PhotoStep'
import { ReviewStep } from './ReviewStep'
import { SuccessStep } from './SuccessStep'

const STEP_TITLES = ['البيانات الشخصية', 'بيانات المنتج', 'التصوير', 'المراجعة'] as const

/**
 * Wizard shell. Steps 1–4 are live; a successful submit swaps to SuccessStep
 * and the draft is reset to a fresh step 1 that still remembers the personal
 * block, so the customer can start another activation without re-typing.
 */
export function ActivationWizard() {
  const { draft, dispatch } = useActivationDraft()
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [photos, setPhotos] = useState<PhotoMap>({})
  const [submitted, setSubmitted] = useState<SubmitResult | null>(null)

  const handlePhoto = useCallback((kind: PhotoKind, blob: Blob) => {
    setPhotos((prev) => ({ ...prev, [kind]: blob }))
  }, [])

  const handleSerial = useCallback(
    (serial: string) => {
      dispatch({ type: 'patchProduct', patch: { serial } })
    },
    [dispatch],
  )

  async function handlePersonalSubmit(personal: PersonalDraft) {
    setBusy(true)
    setSubmitError(null)
    try {
      // Session first (RLS ownership), then the customers row, then advance.
      const userId = await ensureAnonymousUserId()
      await upsertCustomer(userId, personal)
      dispatch({ type: 'patchPersonal', patch: personal })
      dispatch({ type: 'setStep', step: 2 })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع، حاول مرة أخرى.')
    } finally {
      setBusy(false)
    }
  }

  function handleProductSubmit(product: ProductDraft) {
    dispatch({ type: 'patchProduct', patch: product })
    dispatch({ type: 'setStep', step: 3 })
  }

  function handleAbort() {
    // On the first step the only data in play is the personal block, so a reset
    // there clears everything; after that we keep the personal block so the
    // customer can start another activation without re-typing.
    const keepPersonal = draft.step > 1
    const message = keepPersonal
      ? 'سيتم إلغاء عملية التفعيل الحالية والبدء من جديد مع الاحتفاظ ببياناتك الشخصية. متابعة؟'
      : 'سيتم مسح البيانات المدخلة والبدء من جديد. متابعة؟'
    if (!window.confirm(message)) return
    dispatch({ type: keepPersonal ? 'resetKeepingPersonal' : 'reset' })
    setPhotos({})
    setSubmitError(null)
    setBusy(false)
    setSubmitted(null)
  }

  async function handleSubmitClaim(): Promise<SubmitResult> {
    const userId = await ensureAnonymousUserId()
    const result = await submitClaim({
      userId,
      claimId: draft.claimId ?? newClaimId(),
      personal: draft.personal,
      product: draft.product,
      photos,
    })
    // Filed: wipe the work-in-progress (product + photos) but keep the personal
    // block, and show success. A reload lands on a fresh step 1.
    setPhotos({})
    dispatch({ type: 'resetKeepingPersonal' })
    setSubmitted(result)
    return result
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl">
        <SuccessStep result={submitted} onNew={() => setSubmitted(null)} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-800">تفعيل الضمان</h1>
          <p className="mt-1 text-sm text-ink-500">
            الخطوة {draft.step} من 4 — {STEP_TITLES[draft.step - 1] ?? ''}
          </p>
        </div>
        <button
          type="button"
          onClick={handleAbort}
          className="rounded-card border border-danger-700 px-4 py-2 text-sm font-semibold text-danger-700 hover:bg-danger-700/10"
        >
          إلغاء
        </button>
      </header>
      {draft.step === 1 && (
        <PersonalStep
          value={draft.personal}
          onChange={(patch) => dispatch({ type: 'patchPersonal', patch })}
          onSubmit={handlePersonalSubmit}
          busy={busy}
          submitError={submitError}
        />
      )}

      {draft.step === 2 && (
        <ProductStep
          value={draft.product}
          onChange={(patch) => dispatch({ type: 'patchProduct', patch })}
          onSubmit={handleProductSubmit}
          onBack={() => dispatch({ type: 'setStep', step: 1 })}
        />
      )}

      {draft.step === 3 && (
        <PhotoStep
          itemType={draft.product.item_type}
          serial={draft.product.serial}
          photos={photos}
          onPhoto={handlePhoto}
          onSerial={handleSerial}
          onContinue={() => dispatch({ type: 'setStep', step: 4 })}
          onBack={() => dispatch({ type: 'setStep', step: 2 })}
        />
      )}

      {draft.step === 4 && (
        <ReviewStep
          personal={draft.personal}
          product={draft.product}
          photos={photos}
          onBack={() => dispatch({ type: 'setStep', step: 3 })}
          onSubmit={handleSubmitClaim}
        />
      )}

      <p className="mt-6 text-center text-sm">
        <Link to="/ar/activation" className="text-link hover:underline">
          الصفحة الرئيسية
        </Link>
      </p>
    </div>
  )
}
