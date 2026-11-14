// One meaning per colour, shared by Path Sections and Cut & Fill.
export const COLORS = {
  cut: '#dc2626',
  cutSoft: '#fecaca',
  fill: '#2563eb',
  fillSoft: '#bfdbfe',
  ground: '#1a2e05', // existing ground
  groundSoft: '#bef264',
  design: '#c026d3', // planned / design grade
  designSoft: '#f5d0fe',
  path: '#000000',
  contour: '#65a30d',
  section: '#ea580c', // the section being looked at
  sectionIdle: '#57534e',
  grid: '#d9f99d',
  gridStrong: '#a3e635',
  ink: '#000000',
} as const;

export const AXIS_TICK = { fontSize: 11, fontWeight: 700, fill: COLORS.ink } as const;
