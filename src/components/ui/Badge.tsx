import { cn } from '../../lib/cn'

const tones: Record<string, string> = {
  'Por contactar': 'bg-slate-100 text-slate-700',
  Contactado: 'bg-sky-50 text-sky-700',
  'Sin respuesta': 'bg-amber-50 text-amber-800',
  Respondió: 'bg-indigo-50 text-indigo-700',
  'Reunión acordada': 'bg-violet-50 text-violet-700',
  'Propuesta enviada': 'bg-fuchsia-50 text-fuchsia-700',
  Cliente: 'bg-emerald-50 text-emerald-700',
  'No interesado': 'bg-rose-50 text-rose-700',
  Ingreso: 'bg-emerald-50 text-emerald-700',
  Gasto: 'bg-rose-50 text-rose-700',
  Pendiente: 'bg-amber-50 text-amber-800',
  'En curso': 'bg-sky-50 text-sky-700',
  Hecho: 'bg-emerald-50 text-emerald-700',
  Instagram: 'bg-pink-50 text-pink-700',
  Correo: 'bg-blue-50 text-blue-700',
  WhatsApp: 'bg-green-50 text-green-700',
  Llamada: 'bg-orange-50 text-orange-700',
  Otro: 'bg-slate-100 text-slate-700',
}

export function Badge({ children }: { children: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[children] ?? 'bg-soft text-muted',
      )}
    >
      {children}
    </span>
  )
}
