/**
 * Wizard state (one useReducer, PROJECT_MAP [STACK]) backed by the session
 * draft cache. Every change is persisted immediately, so a reload - or the
 * customer returning later - resumes exactly where they left off (M2/M3 gate).
 */
import { useEffect, useReducer } from 'react'
import {
  freshDraft,
  loadDraft,
  saveDraft,
  type Draft,
  type PersonalDraft,
  type ProductDraft,
} from '@/core/session/session'

export type DraftAction =
  | { type: 'setStep'; step: number }
  | { type: 'patchPersonal'; patch: Partial<PersonalDraft> }
  | { type: 'patchProduct'; patch: Partial<ProductDraft> }
  | { type: 'setClaimId'; claimId: string }
  | { type: 'reset' }
  | { type: 'resetKeepingPersonal' }

function reducer(state: Draft, action: DraftAction): Draft {
  const stamp = new Date().toISOString()
  switch (action.type) {
    case 'setStep':
      return { ...state, step: action.step, updatedAt: stamp }
    case 'patchPersonal':
      return { ...state, personal: { ...state.personal, ...action.patch }, updatedAt: stamp }
    case 'patchProduct':
      return { ...state, product: { ...state.product, ...action.patch }, updatedAt: stamp }
    case 'setClaimId':
      return { ...state, claimId: action.claimId, updatedAt: stamp }
    case 'reset':
      return freshDraft()
    case 'resetKeepingPersonal':
      // Abort/next-activation: drop product, photos and claim id, keep the
      // personal block so the customer can start again (or edit) without
      // re-typing their details.
      return { ...freshDraft(), personal: state.personal }
  }
}

export function useActivationDraft() {
  const [draft, dispatch] = useReducer(reducer, undefined, () => loadDraft() ?? freshDraft())

  useEffect(() => {
    saveDraft(draft)
  }, [draft])

  return { draft, dispatch }
}
