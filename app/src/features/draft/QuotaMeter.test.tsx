import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QuotaMeter } from './QuotaMeter'

describe('QuotaMeter', () => {
  it('announces tribe counts', () => {
    render(
      <QuotaMeter
        manualTotal={5}
        manualSlots={8}
        tribes={[
          { id: 'a', name: 'Coco', count: 3, cap: 3 },
          { id: 'b', name: 'Gata', count: 2, cap: 3 },
          { id: 'c', name: 'Lulu', count: 0, cap: 3 },
        ]}
      />,
    )
    expect(screen.getByRole('region', { name: 'Tribe quotas' })).toBeInTheDocument()
    expect(screen.getByText('5/8 manual picks · finish 3 / 3 / 2 before the wildcard')).toBeInTheDocument()
    expect(screen.getByText('Coco')).toBeInTheDocument()
    expect(screen.getByText('3/3')).toBeInTheDocument()
  })
})
