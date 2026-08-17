import { ExternalLink } from 'react-external-link'

type RecordKey =
  | 'com.twitter'
  | 'org.telegram'
  | 'com.discord'
  | 'com.github'
  | 'com.instagram'
  | 'com.linkedin'
  | 'xyz.farcaster'
  | 'com.reddit'
  | 'com.youtube'

type SocialRecordType = {
  key: RecordKey
  value?: string
}

const baseUrls: Record<RecordKey, string> = {
  'com.twitter': 'x.com',
  'org.telegram': 't.me',
  'com.discord': 'discord.com/users',
  'com.github': 'github.com',
  'com.instagram': 'instagram.com',
  'com.linkedin': 'linkedin.com/in',
  'xyz.farcaster': 'warpcast.com',
  'com.reddit': 'reddit.com/user',
  'com.youtube': 'youtube.com/@',
}

const Icon = ({ record }: { record: SocialRecordType }) => {
  switch (record.key) {
    case 'com.twitter':
      return (
        <img
          src="/icons/profile/X.png"
          alt="X"
          height={16}
          width={16}
          className="rounded-xs h-[16px] w-[16px]"
        />
      )
    case 'org.telegram':
      return (
        <img
          src="/icons/profile/telegram.png"
          alt="Telegram"
          height={16}
          width={16}
          className="rounded-xs h-[16px] w-[16px]"
        />
      )
    case 'com.discord':
      return (
        <img
          src="/icons/profile/discord.png"
          alt="Discord"
          height={16}
          width={16}
          className="rounded-xs h-[16px] w-[16px]"
        />
      )
    case 'com.github':
      return (
        <img
          src="/icons/profile/github.svg"
          alt="GitHub"
          height={16}
          width={16}
          className="rounded-xs h-[16px] w-[16px]"
        />
      )
    case 'com.instagram':
      return (
        <img
          src="/icons/profile/instagram.png"
          alt="Instagram"
          height={16}
          width={16}
          className="rounded-xs h-[16px] w-[16px]"
        />
      )
    case 'com.linkedin':
      return (
        <img
          src="/icons/profile/linkedin.svg"
          alt="LinkedIn"
          height={16}
          width={16}
          className="rounded-xs h-[16px] w-[16px]"
        />
      )
    case 'xyz.farcaster':
      return (
        <img
          src="/icons/profile/farcaster.svg"
          alt="Farcaster"
          height={16}
          width={16}
          className="rounded-xs h-[16px] w-[16px]"
        />
      )
    case 'com.reddit':
      return (
        <img
          src="/icons/profile/reddit.svg"
          alt="Reddit"
          height={16}
          width={16}
          className="rounded-xs h-[16px] w-[16px]"
        />
      )
    case 'com.youtube':
      return (
        <img
          src="/icons/profile/youtube.png"
          alt="YouTube"
          height={16}
          width={16}
          className="rounded-xs h-[16px] w-[16px]"
        />
      )
    default:
      return null
  }
}

export const SocialRecord = ({ record }: { record: SocialRecordType }) => {
  if (!record.value) return null
  return (
    <span>
      <ExternalLink
        href={`https://${baseUrls[record.key]}/${record.value}`}
        className="decoration-dotted decoration-2 underline flex flex-row gap-1 items-center hover:text-muted-foreground"
      >
        <Icon record={record} /> {record.value}
      </ExternalLink>
    </span>
  )
}
