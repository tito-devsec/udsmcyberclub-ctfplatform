import { useLocation } from 'react-router'

// The platform is UDSM CyberRange. Games, with their teams and the admin pages, keep the
// name of the CTF platform they run on.
export const RANGE_NAME = 'UDSM CyberRange'

const CTF_ROUTES = /^\/(games|teams|admin)(\/|$)/

export const useIsCtfRoute = () => CTF_ROUTES.test(useLocation().pathname)
