interface QRPatternProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'h-24 w-24',
  md: 'h-32 w-32',
  lg: 'h-40 w-40',
}

export const QRPattern = ({ size = 'md', className = '' }: QRPatternProps) => {
  return (
    <div className={`grid grid-cols-8 gap-1 ${sizeMap[size]} ${className}`}>
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
      <div className="h-3 w-3 bg-gray-200" />
      <div className="h-3 w-3 bg-gray-800" />
    </div>
  )
}
