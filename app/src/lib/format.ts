// Costs are stored as integer cents; format only at the edge.
export function formatCost(costCents: number) {
  return (costCents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}
