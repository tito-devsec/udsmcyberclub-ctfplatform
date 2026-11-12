// The skill paths, modules and labs currently loaded, shared by the route files.

import type { Content } from './content.js'

export let content: Content

export function setContent(next: Content) {
  content = next
}

export const contentSize = () => ({
  paths: content.paths.length,
  modules: content.modules.length,
  sections: content.modules.reduce((sum, module) => sum + module.sections.length, 0),
  labs: content.labs.length,
})
