import { createFileRoute } from '@tanstack/react-router'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { SepoliaNoticeBanner } from '@/components/SepoliaNoticeBanner'
import {
  HomeHeader,
  HomeSearchInput,
  InfoBlockCard,
  LinkBlockCard,
  RecentActivityTable,
} from '@/features/dashboard/components'

export const Route = createFileRoute('/')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
  staticData: { hideSidebar: true },
})

function RouteComponent() {
  return (
    <main className="min-h-screen flex flex-col items-center gap-24 px-6 pt-6 pb-18">
      <SepoliaNoticeBanner />
      <HomeHeader />

      <section className="flex flex-col gap-12 items-center w-full max-w-3xl">
        <p className="font-serif text-[24px] sm:text-[36px] font-[350] text-center leading-[1.35] text-foreground">
          Explore the source of truth for
          <br />
          Ethereum Name Service
        </p>
        <HomeSearchInput className="bg-card dark:bg-transparent w-91.75 max-w-full rounded-sm border-border shadow-none" />
      </section>

      <section className="flex flex-col gap-8 items-center w-full max-w-3xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full">
          <InfoBlockCard
            title="Welcome to the ENS Explorer Beta!"
            description="This is in active development, and new features will roll out regularly"
          />
          <LinkBlockCard
            title="Learn what's new in ENSv2"
            description="Visit our info hub"
            href="https://ens.domains/ensv2"
            hoverColor="peridot"
          />
          <LinkBlockCard
            title="Deep dive into the new contracts"
            description="Read about ENSv2 architecture"
            href="https://ens.domains/blog/post/ensv2-architecture"
            hoverColor="garnet"
          />
        </div>
        <div className="w-full max-w-3xl">
          <RecentActivityTable />
        </div>
      </section>
    </main>
  )
}
