export function Logo({ size = 36, alt = '', className = '' }: { size?: number; alt?: string; className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}icon-192.png`}
      width={size}
      height={size}
      alt={alt}
      className={className}
      style={{ width: size, height: size }}
    />
  )
}
