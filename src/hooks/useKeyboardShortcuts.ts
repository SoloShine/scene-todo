import { useEffect } from "react"

interface ShortcutActions {
  newTodo?: () => void
  search?: () => void
  viewAll?: () => void
  viewToday?: () => void
  settings?: () => void
  escape?: () => void
}

export function useKeyboardShortcuts(actions: ShortcutActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (ctrl && key === "n") {
        e.preventDefault()
        actions.newTodo?.()
      } else if (ctrl && key === "f") {
        e.preventDefault()
        actions.search?.()
      } else if (ctrl && key === "1") {
        e.preventDefault()
        actions.viewAll?.()
      } else if (ctrl && key === "2") {
        e.preventDefault()
        actions.viewToday?.()
      } else if (ctrl && key === ",") {
        e.preventDefault()
        actions.settings?.()
      } else if (key === "escape") {
        actions.escape?.()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [actions])
}
