// The club's own artwork, kept under the names of its files in src/assets: the logo of each
// category and the medal of each badge. A new design replaces the file of the same name.
import { Category } from '@Utils/Range'
import allRounder from '../assets/badges/all-rounder.svg'
import codebreaker from '../assets/badges/codebreaker.svg'
import detective from '../assets/badges/detective.svg'
import eliteHacker from '../assets/badges/elite-hacker.svg'
import firstSteps from '../assets/badges/first-steps.svg'
import flagHunter from '../assets/badges/flag-hunter.svg'
import guru from '../assets/badges/guru.svg'
import hacker from '../assets/badges/hacker.svg'
import hallOfFamer from '../assets/badges/hall-of-famer.svg'
import handsOn from '../assets/badges/hands-on.svg'
import investigator from '../assets/badges/investigator.svg'
import labRat from '../assets/badges/lab-rat.svg'
import moduleComplete from '../assets/badges/module-complete.svg'
import omniscient from '../assets/badges/omniscient.svg'
import onFire from '../assets/badges/on-fire.svg'
import pathfinder from '../assets/badges/pathfinder.svg'
import proHacker from '../assets/badges/pro-hacker.svg'
import webExplorer from '../assets/badges/web-explorer.svg'
import aiLogo from '../assets/categories/ai.svg'
import cryptoLogo from '../assets/categories/crypto.svg'
import forensicsLogo from '../assets/categories/forensics.svg'
import hardwareLogo from '../assets/categories/hardware.svg'
import icsLogo from '../assets/categories/ics.svg'
import miscLogo from '../assets/categories/misc.svg'
import osintLogo from '../assets/categories/osint.svg'
import pwnLogo from '../assets/categories/pwn.svg'
import reverseLogo from '../assets/categories/reverse-engineering.svg'
import stegoLogo from '../assets/categories/steganography.svg'
import web3Logo from '../assets/categories/web3.svg'
import webLogo from '../assets/categories/web.svg'

// A badge with the category's name on its ribbon, worn by the certificates of its modules and
// skill paths. The general category has none.
export const CategoryLogo: Partial<Record<Category, string>> = {
  web: webLogo,
  crypto: cryptoLogo,
  forensics: forensicsLogo,
  osint: osintLogo,
  reverse: reverseLogo,
  pwn: pwnLogo,
  stego: stegoLogo,
  misc: miscLogo,
  hardware: hardwareLogo,
  ics: icsLogo,
  ai: aiLogo,
  web3: web3Logo,
}

// The medal of each badge, by the badge's name in the API: medals for first steps, shields for
// the category badges, seals for the ranks and a wreath for the hall of fame.
export const BadgeArt: Record<string, string> = {
  'first-answer': firstSteps,
  'first-flag': flagHunter,
  'first-module': moduleComplete,
  'first-path': pathfinder,
  'first-lab': labRat,
  'five-labs': handsOn,
  web: webExplorer,
  crypto: codebreaker,
  forensics: investigator,
  osint: detective,
  'all-rounder': allRounder,
  streak: onFire,
  hacker,
  'pro-hacker': proHacker,
  'elite-hacker': eliteHacker,
  guru,
  omniscient,
  'hall-of-fame': hallOfFamer,
}
