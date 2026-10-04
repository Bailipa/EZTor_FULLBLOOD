export const INTERFACE_STYLES = [
  { id: 'reading', label: '静阅', description: '留白 · 专注阅读' },
  { id: 'studio', label: '工作台', description: '紧凑 · 高效整理' },
  { id: 'vivid', label: '悦学', description: '鲜明 · 轻快学习' },
] as const

export type InterfaceStyle = (typeof INTERFACE_STYLES)[number]['id']

export function isInterfaceStyle(value: unknown): value is InterfaceStyle {
  return INTERFACE_STYLES.some((style) => style.id === value)
}
