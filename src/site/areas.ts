export type Area = {
  path: string
  name: string
  kind: 'Broad' | 'Granular' | 'Hands-on' | 'Sources'
  summary: string
}

export const areas: readonly Area[] = [
  {
    path: '/concepts',
    name: 'Concepts',
    kind: 'Broad',
    summary: 'The ideas behind incident response: the lifecycle, mitigating before investigating, and working by hypothesis.',
  },
  {
    path: '/playbook',
    name: 'Playbook',
    kind: 'Granular',
    summary: 'Investigative questions with the exact commands that answer them and what their output means.',
  },
  {
    path: '/lab',
    name: 'Incident Lab',
    kind: 'Hands-on',
    summary: 'Work a simulated Incident in a terminal and dashboard, from the alert to the Root Cause.',
  },
  {
    path: '/resources',
    name: 'Resources',
    kind: 'Sources',
    summary: 'Primary sources worth reading in depth, each with a note on why.',
  },
]
