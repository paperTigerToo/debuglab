// Where each kind of content lives on the site. Resources are external, so they have no path here.
export const conceptPath = (id: string) => `/concepts/${id}`
export const playbookPath = (id: string) => `/playbook/${id}`
export const incidentPath = (id: string) => `/lab/${id}`

/** The page for a link to content on this site. */
export const sitePaths = { concept: conceptPath, playbook: playbookPath, incident: incidentPath } as const
