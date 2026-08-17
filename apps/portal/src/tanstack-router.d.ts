// export {} makes this a module so augmentation merges instead of overwrites
export {}

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** Set to true to hide the sidebar. Use for routes that don't use SidebarProvider (e.g. /, /register). Defaults to false. */
    hideSidebar?: boolean
  }
}
