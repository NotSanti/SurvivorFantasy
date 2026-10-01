import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function showPwaUpdateToast(update: () => void) {
  toast('A new version of SFL is ready.', {
    duration: Infinity,
    action: (
      <Button type="button" size="sm" className="min-h-11" onClick={update}>
        Update
      </Button>
    ),
  })
}
