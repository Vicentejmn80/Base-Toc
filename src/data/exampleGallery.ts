export interface ExampleMetric {
  label: string
  value: string
}

export interface ExampleCard {
  id: string
  icon: 'building' | 'activity' | 'wallet' | 'sparkles' | 'briefcase' | 'book' | 'apple' | 'dumbbell'
  title: string
  description: string
  prompt: string
  tableColumns: string[]
  tableRows: string[][]
  metrics: ExampleMetric[]
}

export const exampleGallery: ExampleCard[] = [
  {
    id: 'crm',
    icon: 'building',
    title: 'Ventas / CRM',
    description: 'Contactos, respuestas, reuniones y clientes por canal.',
    prompt:
      'Quiero registrar los colegios que contacto para Aulas Inca, saber si respondieron, por qué medio los contacté y cuándo debo hacer seguimiento.',
    tableColumns: ['Colegio', 'Estado', 'Canal', 'Próximo seguimiento'],
    tableRows: [
      ['Colegio San Agustín', 'Reunión acordada', 'Correo', '16 sep'],
      ['IE Melitón Carvajal', 'Sin respuesta', 'Llamada', '15 sep'],
      ['Colegio Reina de los Ángeles', 'Cliente', 'WhatsApp', '25 sep'],
    ],
    metrics: [
      { label: 'Contactados', value: '42' },
      { label: 'Respuestas', value: '19' },
      { label: 'Clientes', value: '6' },
    ],
  },
  {
    id: 'running',
    icon: 'activity',
    title: 'Running',
    description: 'Distancia, ritmo y consistencia semanal.',
    prompt: 'Quiero registrar mis entrenamientos de running con distancia, duración y ritmo.',
    tableColumns: ['Fecha', 'Distancia', 'Duración', 'Ritmo'],
    tableRows: [
      ['12 sep', '7.4 km', '42 min', '5:41/km'],
      ['9 sep', '10.1 km', '58 min', '5:44/km'],
      ['5 sep', '5.0 km', '27 min', '5:24/km'],
    ],
    metrics: [
      { label: 'Km acumulados', value: '96.4' },
      { label: 'Ritmo promedio', value: '5:47/km' },
      { label: 'Sesiones', value: '18' },
    ],
  },
  {
    id: 'finance',
    icon: 'wallet',
    title: 'Finanzas',
    description: 'Ingresos, gastos y balance por categoría.',
    prompt: 'Quiero organizar mis ingresos, gastos y ahorro para ver mi balance mensual.',
    tableColumns: ['Fecha', 'Tipo', 'Categoría', 'Monto'],
    tableRows: [
      ['11 sep', 'Ingreso', 'Ventas', 'S/ 2,400'],
      ['10 sep', 'Gasto', 'Herramientas', 'S/ 120'],
      ['08 sep', 'Gasto', 'Transporte', 'S/ 75'],
    ],
    metrics: [
      { label: 'Ingresos', value: 'S/ 7,820' },
      { label: 'Gastos', value: 'S/ 2,310' },
      { label: 'Balance', value: 'S/ 5,510' },
    ],
  },
  {
    id: 'habits',
    icon: 'sparkles',
    title: 'Hábitos',
    description: 'Seguimiento diario y cobertura de cumplimiento.',
    prompt: 'Quiero medir mis hábitos diarios y ver mi porcentaje de cumplimiento.',
    tableColumns: ['Fecha', 'Hábito', 'Cumplido', 'Nota'],
    tableRows: [
      ['12 sep', 'Leer', 'Sí', '24 páginas'],
      ['12 sep', 'Meditar', 'No', 'Me ganó el tiempo'],
      ['11 sep', 'Estudiar', 'Sí', '1 hora'],
    ],
    metrics: [
      { label: 'Cumplimiento', value: '74%' },
      { label: 'Cobertura', value: '5 de 7 días' },
      { label: 'Registros', value: '31' },
    ],
  },
  {
    id: 'job-search',
    icon: 'briefcase',
    title: 'Búsqueda de empleo',
    description: 'Postulaciones, etapas y próximos pasos.',
    prompt: 'Quiero llevar seguimiento de mis postulaciones y entrevistas de trabajo.',
    tableColumns: ['Empresa', 'Etapa', 'Última acción', 'Próximo paso'],
    tableRows: [
      ['Acme Labs', 'Entrevista técnica', '11 sep', 'Enviar reto'],
      ['Nexa Cloud', 'Postulado', '10 sep', 'Follow-up'],
      ['BrightOps', 'Oferta', '08 sep', 'Evaluar propuesta'],
    ],
    metrics: [
      { label: 'Postulaciones', value: '23' },
      { label: 'Entrevistas', value: '7' },
      { label: 'Ofertas', value: '2' },
    ],
  },
  {
    id: 'reading',
    icon: 'book',
    title: 'Lectura',
    description: 'Libros, páginas, tiempo y avance por semana.',
    prompt: 'Quiero registrar mis lecturas de libros y medir mi constancia semanal.',
    tableColumns: ['Libro', 'Fecha', 'Páginas', 'Tiempo'],
    tableRows: [
      ['Hábitos Atómicos', '12 sep', '26', '35 min'],
      ['Deep Work', '10 sep', '18', '25 min'],
      ['Measure What Matters', '09 sep', '22', '30 min'],
    ],
    metrics: [
      { label: 'Páginas', value: '412' },
      { label: 'Sesiones', value: '19' },
      { label: 'Días activos', value: '14' },
    ],
  },
  {
    id: 'nutrition',
    icon: 'apple',
    title: 'Nutrición',
    description: 'Comidas, energía y adherencia a tu plan.',
    prompt: 'Quiero medir mi nutrición diaria y el cumplimiento de mis comidas.',
    tableColumns: ['Fecha', 'Comida', 'Cumplida', 'Nota'],
    tableRows: [
      ['12 sep', 'Desayuno', 'Sí', 'Proteína + fruta'],
      ['12 sep', 'Almuerzo', 'No', 'Comí fuera'],
      ['11 sep', 'Cena', 'Sí', 'Ligera'],
    ],
    metrics: [
      { label: 'Adherencia', value: '68%' },
      { label: 'Comidas ok', value: '34' },
      { label: 'Promedio energía', value: '7.3/10' },
    ],
  },
  {
    id: 'weights',
    icon: 'dumbbell',
    title: 'Entrenamiento de pesas',
    description: 'Sesiones, grupos musculares y progresión de carga.',
    prompt: 'Quiero registrar mis entrenamientos de pesas para ver mi progreso semanal.',
    tableColumns: ['Fecha', 'Rutina', 'Series', 'Carga total'],
    tableRows: [
      ['12 sep', 'Piernas', '16', '4,820 kg'],
      ['10 sep', 'Espalda', '14', '3,940 kg'],
      ['08 sep', 'Pecho', '15', '3,510 kg'],
    ],
    metrics: [
      { label: 'Sesiones', value: '15' },
      { label: 'Carga semanal', value: '12.3 t' },
      { label: 'PR nuevos', value: '3' },
    ],
  },
]
