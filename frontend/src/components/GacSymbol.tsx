/**
 * 경기도의회 공식 심볼(무궁화) 모티프를 단순화한 SVG.
 * — 실제 GAC CI 의 정확한 도형은 사용 가이드라인상 변형 금지이므로
 *   "무궁화 5장 꽃잎" 도형을 자체 디자인한 인터페이스용 심볼로 표현.
 *   공식 CI 파일은 별도 첨부/링크로 제공해야 함.
 */
export default function GacSymbol({
  size = 32,
  color = "currentColor",
  className,
}: { size?: number; color?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* 5장 꽃잎 (무궁화) */}
      {[0, 72, 144, 216, 288].map((rot) => (
        <ellipse
          key={rot}
          cx="32"
          cy="20"
          rx="9"
          ry="14"
          fill={color}
          transform={`rotate(${rot} 32 32)`}
          opacity={0.85}
        />
      ))}
      {/* 중앙 원 */}
      <circle cx="32" cy="32" r="5" fill="#FFFFFF" />
      <circle cx="32" cy="32" r="3" fill={color} />
    </svg>
  );
}
