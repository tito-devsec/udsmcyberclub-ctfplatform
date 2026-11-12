// The club's own artwork, kept under the names of its files in src/assets: the logo of each
// category. A new design replaces the file of the same name.
import { Category } from '@Utils/Range'
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
