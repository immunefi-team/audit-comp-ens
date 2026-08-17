export const TrademarkGuidelinesPage = () => {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-12">
      <article className="prose prose-gray max-w-none">
        <h1 className="mb-2 font-bold text-3xl text-ens-blue-dark md:text-4xl">
          Trademark Guidelines
        </h1>
        <p className="mb-8 text-gray-500 text-sm">ENS Labs Trademark Policy</p>

        <section className="mb-8">
          <h2 className="font-semibold text-ens-blue-dark text-xl">Overview</h2>
          <p className="mt-4 text-gray-700">
            ENS Labs maintains trademark protections for the ENS protocol, a
            decentralized naming system on Ethereum. While the code is
            open-source, the trademarks require compliance with specific
            guidelines.
          </p>
          <p className="mt-4 text-gray-700">
            ENS reserves the right to take action to protect its trademarks and
            the ENS community.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-semibold text-ens-blue-dark text-xl">
            Protected Marks
          </h2>
          <p className="mt-4 text-gray-700">The policy covers:</p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
            <li>
              <strong>Word marks:</strong> ENS™ and Namechain™
            </li>
            <li>
              <strong>Visual marks:</strong> ENS logos and token icons in
              various colors
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-semibold text-ens-blue-dark text-xl">
            Acceptable Uses (No Permission Needed)
          </h2>
          <p className="mt-4 text-gray-700">
            Users may reference ENS without approval when:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
            <li>
              Discussing the original, unmodified ENS software or protocols
            </li>
            <li>
              Describing modified versions with clear disclaimers stating:
              "isn't officially connected to or endorsed by ENS Labs"
            </li>
            <li>Clarifying non-affiliation with ENS Labs</li>
            <li>Referencing ENS integration in compatible applications</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-semibold text-ens-blue-dark text-xl">
            Activities Requiring Written Permission
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
            <li>Selling products or services using ENS marks</li>
            <li>Creating merchandise (t-shirts, hardware wallets, etc.)</li>
            <li>Marketing campaigns and sponsorships</li>
            <li>Company names incorporating ENS</li>
            <li>Educational materials using the marks</li>
            <li>Domain names, emails, or social handles featuring "ENS"</li>
            <li>Third-party endorsements or collaborations</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-semibold text-ens-blue-dark text-xl">
            Proper Usage Standards
          </h2>
          <p className="mt-4 text-gray-700">Users must:</p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
            <li>Spell marks exactly as listed in official guidelines</li>
            <li>Maintain logo spacing and quality</li>
            <li>
              Use trademarks as adjectives paired with generic terms ("ENS
              protocol")
            </li>
            <li>Include trademark notices (® or TM symbols)</li>
            <li>Avoid plural or possessive forms</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-semibold text-ens-blue-dark text-xl">
            Prohibited Uses
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
            <li>Claiming ENS ownership in projects or business names</li>
            <li>Creating confusingly similar branding</li>
            <li>Prioritizing ENS marks over own branding</li>
            <li>Modifying logos without permission</li>
            <li>Implying false endorsement</li>
            <li>
              Pairing marks with gambling, illegal activity, ICOs, or
              cryptocurrency schemes
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-semibold text-ens-blue-dark text-xl">Contact</h2>
          <p className="mt-4 text-gray-700">
            Questions or licensing inquiries:{' '}
            <a
              className="text-ens-blue hover:underline"
              href="mailto:legal@ens.domains"
            >
              legal@ens.domains
            </a>
          </p>
        </section>
      </article>
    </div>
  )
}
