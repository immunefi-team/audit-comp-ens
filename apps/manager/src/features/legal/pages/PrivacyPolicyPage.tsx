export const PrivacyPolicyPage = () => {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-12">
      <article className="prose prose-gray max-w-none">
        <h1 className="mb-2 font-bold text-3xl text-ens-blue-dark md:text-4xl">
          Privacy Policy
        </h1>
        <p className="mb-8 text-gray-500 text-sm">
          Last modified: November 11, 2022
        </p>

        <section className="mb-8">
          <h2 className="font-semibold text-ens-blue-dark text-xl">
            1. Introduction
          </h2>
          <p className="mt-4 text-gray-700">
            This privacy policy applies to all personal data collected by the
            ENS Foundation and its subcontractors across its websites and
            applications, including ens.domains. Users consent to these data
            practices by continuing to use the service.
          </p>
          <p className="mt-4 text-gray-700">
            The organization defines personal data as information that
            identifies individuals.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-semibold text-ens-blue-dark text-xl">
            2. Data Types Collected
          </h2>
          <p className="mt-4 text-gray-700">
            The foundation gathers several categories of data:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
            <li>Contact information (names, emails, phone numbers)</li>
            <li>
              Technical data (IP addresses, browser information, device details)
            </li>
            <li>Usage patterns and transaction details</li>
            <li>Profile information and blockchain addresses</li>
            <li>Marketing preferences</li>
            <li>
              Data from activity that is publicly visible and/or accessible on
              blockchains
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-semibold text-ens-blue-dark text-xl">
            3. Collection Methods
          </h2>
          <p className="mt-4 text-gray-700">
            Data comes through direct interactions (forms, emails, Discord),
            automated tracking via cookies and pixel tags, and third-party
            sources like wallet providers.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-semibold text-ens-blue-dark text-xl">
            4. Cookie Usage
          </h2>
          <p className="mt-4 text-gray-700">
            The policy outlines use of session and persistent cookies for
            analytics, functionality, and targeting purposes. Users may disable
            cookies through browser settings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-semibold text-ens-blue-dark text-xl">
            5. Data Purposes
          </h2>
          <p className="mt-4 text-gray-700">
            Personal data supports various purposes including:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
            <li>Website functionality</li>
            <li>Customer support</li>
            <li>Contract performance</li>
            <li>Legal compliance</li>
            <li>Fraud prevention</li>
            <li>Marketing communications</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-semibold text-ens-blue-dark text-xl">
            6. Data Protection
          </h2>
          <p className="mt-4 text-gray-700">
            The foundation implements administrative, physical, and technical
            safeguards. However, no method of transmission over the Internet is
            completely secure.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-semibold text-ens-blue-dark text-xl">
            7. User Rights
          </h2>
          <p className="mt-4 text-gray-700">
            Individuals may access, correct, or withdraw consent for data
            processing by contacting{' '}
            <a
              className="text-ens-blue hover:underline"
              href="mailto:privacy@ens.domains"
            >
              privacy@ens.domains
            </a>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-semibold text-ens-blue-dark text-xl">
            8. Retention and Governance
          </h2>
          <p className="mt-4 text-gray-700">
            Data is retained as long as necessary for the purposes outlined in
            this policy. This policy is governed by Singapore law with dispute
            resolution through arbitration.
          </p>
        </section>
      </article>
    </div>
  )
}
