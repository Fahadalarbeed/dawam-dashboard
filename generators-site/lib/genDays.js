// عدد أيام تركيب المولد (من يوم التوصيل لين الإزالة أو اليوم) — بدون أي اعتماد على المتصفح
export function generatorDays(g) {
  const start = new Date(`${g.connected_on}T00:00:00`);
  const end = g.removed_at ? new Date(g.removed_at) : new Date();
  return Math.max(1, Math.ceil((end - start) / 86400000));
}
