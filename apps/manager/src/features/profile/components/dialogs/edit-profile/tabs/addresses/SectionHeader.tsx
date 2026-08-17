interface SectionHeaderProps {
  readonly title: string
  readonly description: string
}

export const SectionHeader = ({ title, description }: SectionHeaderProps) => (
  <div className="flex flex-col gap-1.5">
    <p className="font-bold font-sans text-[#525252] text-[16px] leading-[0.96] tracking-[-0.32px]">
      {title}
    </p>
    <p className="text-[14px] text-ens-quartz-400 leading-[1.2]">
      {description}
    </p>
  </div>
)
