import type { sections, specialSections, staticTextRecords } from './text'

// Section types
export type Section = keyof typeof sections
export type SpecialSection = (typeof specialSections)[number]
export type AnySection = Section | SpecialSection

export type SectionData = {
  label: string
  hidden?: boolean
}

export type StaticRecordKey = (typeof staticTextRecords)[number]

// Base record type that all records extend
type BaseRecord = {
  name: string
  icon?: React.FC<{ className?: string }> | string
  placeholder?: string
}

type BaseAddressRecord = BaseRecord & {
  coinType: number
}

// Enhanced text record with validation and UI configuration
type TextRecordBase = BaseRecord & {
  key: string
  section: Section | SpecialSection
  displayPrefix?: string
  normalize?: (value: string) => string
  /**
   * Controls if the record should be fetched from the chain.
   * - 'always': Always fetch the record value regardless of indexing status.
   * - 'whenNotIndexed': Include if the name hasn't been indexed (for example off-chain names).
   * - false: Only include if in the indexed records.
   *
   * @default false
   */
  forceFetch?: 'always' | 'whenNotIndexed' | false
}

type TextRecordKind =
  | {
      kind: 'link'
      /**
       * The base URL to use for the link.
       * - If `href` is a string, it will be prefixed to the URI-escaped record value.
       * - If `href` is a function, it will be called with the text record value, and the function is responsible for escaping the value as needed.
       */
      href: string | ((value: string) => string)
    }
  | {
      /** Copy the value to the clipboard @default */
      kind?: 'copy'
    }
  | {
      kind: 'custom'
      render: (value: string) => React.ReactNode
    }

export type TextRecordDef = TextRecordBase & TextRecordKind

// Enhanced address record
export type AddressRecordDef = BaseAddressRecord & {
  notation?: string
}
