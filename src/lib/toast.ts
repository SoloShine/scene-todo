import { toast } from "sonner"

export const notify = {
  success: (msg: string) => toast.success(msg),
  error: (msg: string) => toast.error(msg, { duration: Infinity }),
  warning: (msg: string, desc?: string) => toast.warning(msg, { description: desc }),
  info: (msg: string) => toast.info(msg),
}
