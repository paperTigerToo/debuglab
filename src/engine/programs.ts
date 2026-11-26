// What the engine knows about real tools, independent of any Incident:
// which programs exist, their flags, and which spellings mean the same thing.

export type FlagSpec = {
  /** Canonical name, e.g. "namespace". */
  name: string
  /** Every spelling, e.g. ["-n", "--namespace"]. */
  spellings: readonly string[]
  takesValue?: boolean
  /** The subcommands this flag belongs to; absent means every subcommand. */
  only?: readonly string[]
}

export type ProgramSpec = {
  flags?: readonly FlagSpec[]
  /** Short flags may be clustered with letters the engine does not know (ps -ef, ss -tlnp). */
  clustersFreely?: boolean
  /** A leading argument of bare letters is a flag cluster (BSD-style "ps aux"). */
  bareCluster?: boolean
  /** Known first arguments, used for typo suggestions ("kubectl gte"). */
  subcommands?: readonly string[]
}

const kubectlFlags: FlagSpec[] = [
  { name: 'namespace', spellings: ['-n', '--namespace'], takesValue: true },
  { name: 'output', spellings: ['-o', '--output'], takesValue: true },
  { name: 'selector', spellings: ['-l', '--selector'], takesValue: true },
  { name: 'all-namespaces', spellings: ['-A', '--all-namespaces'] },
  { name: 'container', spellings: ['-c', '--container'], takesValue: true },
  { name: 'previous', spellings: ['-p', '--previous'], only: ['logs'] },
  { name: 'follow', spellings: ['-f', '--follow'], only: ['logs'] },
  { name: 'filename', spellings: ['-f', '--filename'], takesValue: true, only: ['apply', 'create', 'delete', 'replace', 'diff', 'get', 'describe'] },
  { name: 'patch', spellings: ['-p', '--patch'], takesValue: true, only: ['patch'] },
  { name: 'watch', spellings: ['-w', '--watch'] },
  { name: 'stdin', spellings: ['-i', '--stdin'] },
  { name: 'tty', spellings: ['-t', '--tty'] },
  { name: 'tail', spellings: ['--tail'], takesValue: true },
  { name: 'since', spellings: ['--since'], takesValue: true },
  { name: 'revision', spellings: ['--revision'], takesValue: true },
  { name: 'to-revision', spellings: ['--to-revision'], takesValue: true },
  { name: 'replicas', spellings: ['--replicas'], takesValue: true },
  { name: 'image', spellings: ['--image'], takesValue: true },
  { name: 'grace-period', spellings: ['--grace-period'], takesValue: true },
  { name: 'all', spellings: ['--all'] },
  { name: 'force', spellings: ['--force'] },
  { name: 'sort-by', spellings: ['--sort-by'], takesValue: true },
  { name: 'timestamps', spellings: ['--timestamps'] },
  { name: 'show-labels', spellings: ['--show-labels'] },
]

const linuxTool: ProgramSpec = { clustersFreely: true }

export const programs: Record<string, ProgramSpec> = {
  kubectl: {
    flags: kubectlFlags,
    subcommands: [
      'get', 'describe', 'logs', 'exec', 'top', 'rollout', 'events', 'delete', 'scale', 'apply', 'edit',
      'set', 'patch', 'port-forward', 'cp', 'explain', 'diff', 'label', 'annotate', 'cordon', 'drain',
      'version', 'config', 'cluster-info', 'auth', 'debug', 'create', 'run', 'expose', 'replace', 'wait',
      'attach', 'proxy', 'autoscale', 'uncordon', 'taint', 'certificate', 'api-resources', 'api-versions',
      'kustomize', 'plugin', 'completion', 'alpha', 'help',
    ],
  },
  jq: linuxTool,
  awk: linuxTool,
  sed: linuxTool,
  echo: linuxTool,
  sort: linuxTool,
  uniq: linuxTool,
  cut: linuxTool,
  tr: linuxTool,
  xargs: linuxTool,
  watch: linuxTool,
  ip: linuxTool,
  nc: linuxTool,
  tcpdump: linuxTool,
  openssl: linuxTool,
  which: linuxTool,
  whoami: linuxTool,
  hostname: linuxTool,
  date: linuxTool,
  pwd: linuxTool,
  cd: linuxTool,
  mount: linuxTool,
  wget: linuxTool,
  telnet: linuxTool,
  traceroute: linuxTool,
  ps: { clustersFreely: true, bareCluster: true },
  top: linuxTool,
  htop: linuxTool,
  free: linuxTool,
  df: linuxTool,
  du: linuxTool,
  ss: linuxTool,
  netstat: linuxTool,
  lsof: linuxTool,
  strace: linuxTool,
  vmstat: linuxTool,
  iostat: linuxTool,
  dmesg: linuxTool,
  uptime: linuxTool,
  ls: linuxTool,
  cat: linuxTool,
  tail: linuxTool,
  head: linuxTool,
  grep: linuxTool,
  wc: linuxTool,
  less: linuxTool,
  find: linuxTool,
  env: linuxTool,
  curl: linuxTool,
  dig: linuxTool,
  nslookup: linuxTool,
  ping: linuxTool,
  journalctl: linuxTool,
  systemctl: linuxTool,
  psql: {
    clustersFreely: true,
    flags: [
      { name: 'username', spellings: ['-U', '--username'], takesValue: true },
      { name: 'dbname', spellings: ['-d', '--dbname'], takesValue: true },
      { name: 'command', spellings: ['-c', '--command'], takesValue: true },
    ],
  },
  'redis-cli': linuxTool,
  helm: linuxTool,
  docker: linuxTool,
  git: linuxTool,
  ssh: linuxTool,
  sudo: linuxTool,
  vim: linuxTool,
  nano: linuxTool,
  node: linuxTool,
  npm: linuxTool,
  kill: linuxTool,
  pkill: linuxTool,
  rm: linuxTool,
  reboot: linuxTool,
}

/** Every accepted spelling of a kube resource type, mapped to its canonical singular. */
export const kubeResourceTypes: Record<string, string> = Object.fromEntries(
  [
    ['pod', 'po', 'pods'],
    ['deployment', 'deploy', 'deployments'],
    ['service', 'svc', 'services'],
    ['replicaset', 'rs', 'replicasets'],
    ['node', 'no', 'nodes'],
    ['event', 'ev', 'events'],
    ['namespace', 'ns', 'namespaces'],
    ['configmap', 'cm', 'configmaps'],
    ['secret', 'secrets'],
    ['ingress', 'ing', 'ingresses'],
    ['statefulset', 'sts', 'statefulsets'],
    ['persistentvolumeclaim', 'pvc', 'persistentvolumeclaims'],
    ['persistentvolume', 'pv', 'persistentvolumes'],
    ['storageclass', 'sc', 'storageclasses'],
  ].flatMap(([canonical, ...aliases]) => [canonical!, ...aliases].map((a) => [a, canonical!])),
)
