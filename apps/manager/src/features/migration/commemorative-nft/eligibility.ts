import * as v from 'valibot'
import { type Address, getAddress, type Hex, isAddress, isHex } from 'viem'
import {
  buildCommemorativeNftAssets,
  buildCommemorativeNftEligibilityUrl,
} from './config'
import { getCommemorativeNftDevFixture } from './eligibility.fixture'
import {
  COMMEMORATIVE_NFT_TRAIT_VALUES,
  type CommemorativeNftAssets,
  type CommemorativeNftEligibility,
  type CommemorativeNftEligibilityResult,
  type RendererTraits,
} from './types'

const seedSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(4_294_967_295),
)

const traitsSchema = v.object({
  Era: v.picklist(COMMEMORATIVE_NFT_TRAIT_VALUES.Era),
  Depth: v.picklist(COMMEMORATIVE_NFT_TRAIT_VALUES.Depth),
  Gasveteran: v.picklist(COMMEMORATIVE_NFT_TRAIT_VALUES.Gasveteran),
  Archetype: v.picklist(COMMEMORATIVE_NFT_TRAIT_VALUES.Archetype),
  Rarity: v.picklist(COMMEMORATIVE_NFT_TRAIT_VALUES.Rarity),
  Seed: seedSchema,
})

const attributeSchema = v.object({
  trait_type: v.string(),
  value: v.union([v.string(), v.number()]),
})

const payloadSchema = v.object({
  address: v.string(),
  name: v.string(),
  profileName: v.optional(v.string()),
  profile_name: v.optional(v.string()),
  rendererName: v.optional(v.string()),
  renderer_name: v.optional(v.string()),
  proof: v.pipe(v.array(v.string()), v.minLength(1)),
  traits: v.optional(v.unknown()),
  attributes: v.optional(v.array(attributeSchema)),
  image: v.optional(v.string()),
  animation_url: v.optional(v.string()),
  external_url: v.optional(v.string()),
})

export class CommemorativeNftEligibilityError extends Error {
  override readonly name = 'CommemorativeNftEligibilityError'
}

const normalizeProfileName = (name: string): string => {
  const trimmed = name.trim()
  return trimmed.includes('.') ? trimmed : `${trimmed}.eth`
}

const parseHttpUrl = (value: string | undefined): string | undefined => {
  if (!value) return undefined

  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.toString()
      : undefined
  } catch {
    return undefined
  }
}

const parseTraits = (
  directTraits: unknown,
  attributes: readonly v.InferOutput<typeof attributeSchema>[] | undefined,
): RendererTraits => {
  if (directTraits !== undefined) {
    const directResult = v.safeParse(traitsSchema, directTraits)
    if (directResult.success) return directResult.output
  }

  const attributeValues = Object.fromEntries(
    (attributes ?? []).map(({ trait_type, value }) => [trait_type, value]),
  )
  const attributeResult = v.safeParse(traitsSchema, attributeValues)
  if (attributeResult.success) return attributeResult.output

  throw new CommemorativeNftEligibilityError(
    'Eligibility payload contains invalid renderer traits',
  )
}

const parseProof = (proof: readonly string[]): readonly Hex[] => {
  if (!proof.every((value) => isHex(value) && value.length === 66)) {
    throw new CommemorativeNftEligibilityError(
      'Eligibility payload contains an invalid Merkle proof',
    )
  }
  return proof as readonly Hex[]
}

const mergeAssets = (
  derived: CommemorativeNftAssets,
  payload: v.InferOutput<typeof payloadSchema>,
): CommemorativeNftAssets => ({
  metadataUrl: derived.metadataUrl,
  imageUrl: parseHttpUrl(payload.image) ?? derived.imageUrl,
  animationUrl: parseHttpUrl(payload.animation_url) ?? derived.animationUrl,
  externalUrl: parseHttpUrl(payload.external_url),
})

export const parseCommemorativeNftEligibility = (params: {
  readonly ownerAddress: Address
  readonly payload: unknown
  readonly assetOrigin?: string
}): CommemorativeNftEligibility => {
  const parsed = v.safeParse(payloadSchema, params.payload)
  if (!parsed.success) {
    throw new CommemorativeNftEligibilityError(
      'Eligibility payload does not match the expected schema',
    )
  }

  const payloadAddress = parsed.output.address
  if (!isAddress(payloadAddress, { strict: false })) {
    throw new CommemorativeNftEligibilityError(
      'Eligibility payload contains an invalid address',
    )
  }
  if (
    getAddress(payloadAddress).toLowerCase() !==
    params.ownerAddress.toLowerCase()
  ) {
    throw new CommemorativeNftEligibilityError(
      'Eligibility payload does not belong to the connected address',
    )
  }

  const profileName = normalizeProfileName(
    parsed.output.profileName ??
      parsed.output.profile_name ??
      parsed.output.name,
  )
  const rendererName =
    parsed.output.rendererName ??
    parsed.output.renderer_name ??
    parsed.output.name

  return {
    ownerAddress: params.ownerAddress,
    profileName,
    rendererName,
    proof: parseProof(parsed.output.proof),
    traits: parseTraits(parsed.output.traits, parsed.output.attributes),
    assets: mergeAssets(
      buildCommemorativeNftAssets(params.assetOrigin, params.ownerAddress),
      parsed.output,
    ),
    source: 'remote',
  }
}

export const fetchCommemorativeNftEligibility = async (params: {
  readonly ownerAddress: Address
  readonly eligibilityOrigin?: string
  readonly assetOrigin?: string
  readonly allowDevFixture?: boolean
  readonly fetcher?: typeof fetch
}): Promise<CommemorativeNftEligibilityResult> => {
  if (!params.eligibilityOrigin) {
    const fixture =
      params.allowDevFixture && import.meta.env.DEV
        ? getCommemorativeNftDevFixture(params.ownerAddress)
        : undefined
    return fixture
      ? { status: 'eligible', eligibility: fixture }
      : { status: 'unavailable' }
  }

  const response = await (params.fetcher ?? fetch)(
    buildCommemorativeNftEligibilityUrl(
      params.eligibilityOrigin,
      params.ownerAddress,
    ),
  )

  if (response.status === 404) return { status: 'ineligible' }
  if (!response.ok) {
    throw new CommemorativeNftEligibilityError(
      `Eligibility request failed with HTTP ${response.status}`,
    )
  }

  const payload: unknown = await response.json()
  return {
    status: 'eligible',
    eligibility: parseCommemorativeNftEligibility({
      ownerAddress: params.ownerAddress,
      payload,
      assetOrigin: params.assetOrigin,
    }),
  }
}
