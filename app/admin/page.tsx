'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Part {
  id: string
  partNumber: string
  description: string
  unitsPerBox: number
  boxesPerPallet: number
  pricePerUnit: string
  currentPallets: number
  currentBoxes: number
}

interface Production {
  id: string
  pallets: number
  boxes: number
  totalUnits: number
  notes: string | null
  createdAt: string
  part: {
    partNumber: string
    description: string
  }
  user: {
    name: string
  }
}

interface Release {
  id: string
  releaseNumber: string
  pallets: number
  totalUnits: number
  createdAt: string
  part: {
    partNumber: string
    description: string
    pricePerUnit: string
  }
  shippingLocation: {
    name: string
    city: string
    state: string
  }
  user: {
    name: string
  }
}

type TabType = 'production' | 'billing' | 'inventory'

export default function AdminPage() {
  const { user, isAuthenticated, isLoading: authLoading, token, logout } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('production')
  const [parts, setParts] = useState<Part[]>([])
  const [productions, setProductions] = useState<Production[]>([])
  const [releases, setReleases] = useState<Release[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Production form
  const [selectedPartId, setSelectedPartId] = useState('')
  const [pallets, setPallets] = useState(10)
  const [boxes, setBoxes] = useState(0)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== 'ADMIN')) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, user, authLoading, router])

  useEffect(() => {
    if (isAuthenticated && token && user?.role === 'ADMIN') {
      fetchData()
    }
  }, [isAuthenticated, token, user])

  const fetchData = async () => {
    try {
      const [partsRes, productionsRes, releasesRes] = await Promise.all([
        fetch('/api/parts', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/production', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/releases', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const [partsData, productionsData, releasesData] = await Promise.all([
        partsRes.json(),
        productionsRes.json(),
        releasesRes.json(),
      ])

      setParts(partsData.parts || [])
      setProductions(productionsData.productions || [])
      setReleases(releasesData.releases || [])
    } catch (err) {
      setError('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddProduction = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/production', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partId: selectedPartId,
          pallets,
          boxes,
          notes,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add production')
      }

      // Reset form
      setSelectedPartId('')
      setPallets(10)
      setBoxes(0)
      setNotes('')

      // Refresh data
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add production')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading || !user || user.role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const selectedPart = parts.find((p) => p.id === selectedPartId)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">JD Graphic - Management Portal</p>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
                Customer View
              </Link>
              <button
                onClick={logout}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('production')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'production'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Production Management
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'billing'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Billing & Reports
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'inventory'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Current Inventory
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Production Management Tab */}
        {activeTab === 'production' && (
          <div className="space-y-6">
            {/* Add Production Form */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Add Production Run</h2>
              <form onSubmit={handleAddProduction} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Part Number
                    </label>
                    <select
                      value={selectedPartId}
                      onChange={(e) => setSelectedPartId(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select a part...</option>
                      {parts.map((part) => (
                        <option key={part.id} value={part.id}>
                          #{part.partNumber} - {part.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pallets
                    </label>
                    <input
                      type="number"
                      value={pallets}
                      onChange={(e) => setPallets(parseInt(e.target.value) || 0)}
                      min={0}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Loose Boxes (Optional)
                    </label>
                    <input
                      type="number"
                      value={boxes}
                      onChange={(e) => setBoxes(parseInt(e.target.value) || 0)}
                      min={0}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  {selectedPart && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-700 font-medium">Calculation:</p>
                      <p className="text-sm text-gray-600">
                        {pallets} pallets + {boxes} boxes
                      </p>
                      <p className="text-sm text-gray-600">
                        = {pallets * selectedPart.boxesPerPallet + boxes} total boxes
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        = {((pallets * selectedPart.boxesPerPallet + boxes) * selectedPart.unitsPerBox).toLocaleString()} units
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Production run notes..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add to Inventory'}
                </button>
              </form>
            </div>

            {/* Production History */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Production History</h2>
              {isLoading ? (
                <div className="text-center py-8 text-gray-600">Loading...</div>
              ) : productions.length === 0 ? (
                <p className="text-center py-8 text-gray-600">No production runs yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Part
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Added By
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {productions.map((prod) => (
                        <tr key={prod.id}>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {new Date(prod.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div>#{prod.part.partNumber}</div>
                            <div className="text-xs text-gray-500">{prod.part.description}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div>{prod.pallets} pallets</div>
                            <div className="text-xs text-gray-500">
                              {prod.totalUnits.toLocaleString()} units
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{prod.user.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{prod.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Billing & Reports Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Release Report (All Time)</h2>
              {isLoading ? (
                <div className="text-center py-8 text-gray-600">Loading...</div>
              ) : releases.length === 0 ? (
                <p className="text-center py-8 text-gray-600">No releases yet</p>
              ) : (
                <>
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Release #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Part
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Quantity
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Price/Unit
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Total Value
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Released By
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {releases.map((release) => {
                          const totalValue = release.totalUnits * parseFloat(release.part.pricePerUnit)
                          return (
                            <tr key={release.id}>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {new Date(release.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {release.releaseNumber}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                <div>#{release.part.partNumber}</div>
                                <div className="text-xs text-gray-500">{release.part.description}</div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {release.totalUnits.toLocaleString()} units
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                ${parseFloat(release.part.pricePerUnit).toFixed(4)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                                ${totalValue.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{release.user.name}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Total Releases</p>
                        <p className="text-2xl font-bold text-gray-900">{releases.length}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Total Pallets</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {releases.reduce((sum, r) => sum + r.pallets, 0)}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Total Units</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {releases.reduce((sum, r) => sum + r.totalUnits, 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-blue-900 mb-1 font-medium">Total Value</p>
                        <p className="text-2xl font-bold text-blue-900">
                          ${releases
                            .reduce(
                              (sum, r) => sum + r.totalUnits * parseFloat(r.part.pricePerUnit),
                              0
                            )
                            .toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Current Inventory Tab */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Current Inventory Levels</h2>
              {isLoading ? (
                <div className="text-center py-8 text-gray-600">Loading...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {parts.map((part) => (
                    <div key={part.id} className="border-2 border-gray-200 rounded-lg p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        Part #{part.partNumber}
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">{part.description}</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded">
                          <p className="text-sm text-gray-600 mb-1">Pallets</p>
                          <p className="text-3xl font-bold text-gray-900">{part.currentPallets}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded">
                          <p className="text-sm text-gray-600 mb-1">Boxes</p>
                          <p className="text-3xl font-bold text-gray-900">{part.currentBoxes}</p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-200 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Boxes:</span>
                          <span className="font-semibold">
                            {(part.currentPallets * part.boxesPerPallet + part.currentBoxes).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Units:</span>
                          <span className="font-semibold">
                            {((part.currentPallets * part.boxesPerPallet + part.currentBoxes) * part.unitsPerBox).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Unit Price:</span>
                          <span className="font-semibold">${part.pricePerUnit}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-gray-700 font-medium">Inventory Value:</span>
                          <span className="font-bold text-blue-600">
                            ${(
                              (part.currentPallets * part.boxesPerPallet + part.currentBoxes) *
                              part.unitsPerBox *
                              parseFloat(part.pricePerUnit)
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
