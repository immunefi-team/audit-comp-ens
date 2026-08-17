import {
  type DisallowedToken,
  ens_tokenize,
  type ValidToken,
} from '@adraffy/ens-normalize'

export function escapeUnicode(name: string) {
  const tokens = ens_tokenize(name)
  return tokens
    .map((tok) => {
      const cps =
        (tok as ValidToken).cps ||
        ((tok as DisallowedToken).cp !== undefined
          ? [(tok as DisallowedToken).cp]
          : [])
      return cps
        .map((cp) => {
          if (cp > 0x7f) {
            // anything beyond ASCII
            return `{${cp.toString(16).toUpperCase()}}`
          }
          return String.fromCodePoint(cp)
        })
        .join('')
    })
    .join('')
}
