import { Toaster as SonnerToaster } from 'sonner'

export default function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#16161A',
          border: '1px solid rgba(255,255,255,0.06)',
          color: '#EDEDEF',
          fontSize: '13px',
        },
      }}
    />
  )
}

export { toast } from 'sonner'
