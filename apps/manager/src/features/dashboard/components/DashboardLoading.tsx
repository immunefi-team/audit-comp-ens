export const DashboardLoading = () => {
  return (
    <div
      aria-label="Loading dashboard"
      className="flex h-[calc(100dvh-80px)] min-h-0 w-full flex-1 items-center justify-center" // 80px is the md+ Manager header height.
      role="status"
    >
      <div
        className="size-5 animate-spin rounded-full border-2 border-ens-blue/20 border-t-ens-blue"
        data-testid="dashboard-loading-spinner"
      />
    </div>
  )
}
