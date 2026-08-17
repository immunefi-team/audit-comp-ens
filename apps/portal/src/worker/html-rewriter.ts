import { cspMetaTag } from './csp'

export class MetaTagInjector {
  readonly #tags: string

  constructor(tags: string) {
    this.#tags = tags
  }

  element(element: Element): void {
    // CSP meta tag mirrors the HTTP header (defense-in-depth); injected on
    // every HTML route since this runs on each `<head>`.
    element.append(`${cspMetaTag}\n${this.#tags}`, { html: true })
  }
}

export class TitleRewriter {
  readonly #title: string

  constructor(title: string) {
    this.#title = title
  }

  element(element: Element): void {
    element.setInnerContent(this.#title)
  }
}
