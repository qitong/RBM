export const SYNTHETIC_DISCLAIMER = '合成研究验证数据，非真实临床试验监查证据'

export default function SyntheticNote() {
  const offline = import.meta.env.VITE_RBQM_STATIC_FALLBACK === '1'
  return (
    <p role="note" data-synthetic="true">
      {SYNTHETIC_DISCLAIMER}
      {offline ? ' 离线静态合成回退模式（fallbackActive）。' : ''}
    </p>
  )
}
